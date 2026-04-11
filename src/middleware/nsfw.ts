import { Bot } from "grammy";
import type { Context, NextFunction } from "grammy";
import type { User } from "grammy/types";
import { classifyImage, downloadTelegramFile } from "@/services/nsfw";
import { isKnownSensitiveUser, logSensitiveProfile } from "@/db/sensitiveLog";
import { notifyDevelopers } from "@/utils/notify";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number): boolean {
  return DEVELOPER_IDS.includes(userId);
}

// In-memory cache: userId → last profile check timestamp
const profileCheckCache = new Map<number, number>();
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function wasRecentlyChecked(userId: number): boolean {
  const lastCheck = profileCheckCache.get(userId);
  if (!lastCheck) return false;
  return Date.now() - lastCheck < CHECK_INTERVAL_MS;
}

async function banAndNotify(
  bot: Bot,
  chatId: number,
  user: User,
  reason: string,
  category: string,
  confidence: number,
  messageId?: number,
): Promise<void> {
  const userName = user.first_name || user.username || "User";

  // Developers are never banned — just notify them
  if (isDeveloper(user.id)) {
    const devMsg = `NSFW detected (${reason}): ${category} (${(confidence * 100).toFixed(1)}%) — you are a developer, no ban applied.`;
    try {
      await bot.api.sendMessage(chatId, devMsg, {
        reply_parameters: messageId ? { message_id: messageId } : undefined,
      });
    } catch {
      // ignore
    }
    console.log(`NSFW ${reason} (developer skip): ${userName} (${user.id}) in ${chatId} — ${category} ${(confidence * 100).toFixed(1)}%`);
    return;
  }

  // Log to sensitive_profile_log for cross-group recognition
  await logSensitiveProfile({
    userId: user.id,
    username: user.username ?? null,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    reason,
    category,
    confidence,
    detectedInChatId: chatId,
  });

  // Delete the offending message
  if (messageId) {
    try {
      await bot.api.deleteMessage(chatId, messageId);
    } catch {
      // May fail if bot lacks delete permission
    }
  }

  // Ban the user
  try {
    await bot.api.banChatMember(chatId, user.id);
  } catch {
    // May fail if bot lacks ban permission
  }

  await notifyDevelopers(
    `NSFW Ban (${reason}):\nUser: ${userName} (@${user.username ?? "none"}, ${user.id})\nGroup: ${chatId}\nCategory: ${category} (${(confidence * 100).toFixed(1)}%)`,
  );

  console.log(
    `NSFW ${reason}: ${userName} (${user.id}) in ${chatId} — ${category} ${(confidence * 100).toFixed(1)}%`,
  );
}

/**
 * Check user's profile photo and personal channel photo.
 * Returns true if NSFW was detected and user was banned.
 */
async function checkUserProfile(
  bot: Bot,
  chatId: number,
  user: User,
  messageId?: number,
): Promise<boolean> {
  if (user.is_bot) return false;
  if (wasRecentlyChecked(user.id)) return false;

  // Mark as checked early to prevent duplicate checks
  profileCheckCache.set(user.id, Date.now());

  // 1. Check if already flagged in another group → instant ban (skip for developers)
  if (!isDeveloper(user.id)) {
    const isKnown = await isKnownSensitiveUser(user.id);
    if (isKnown) {
      await banAndNotify(
        bot,
        chatId,
        user,
        "known_sensitive",
        "Previously flagged",
        1.0,
        messageId,
      );
      return true;
    }
  }

  // 2. Check profile photo
  try {
    const photos = await bot.api.getUserProfilePhotos(user.id, { limit: 1 });
    if (photos.total_count > 0 && photos.photos.length > 0) {
      const photoSizes = photos.photos[0];
      const photo = photoSizes[photoSizes.length > 1 ? 1 : 0];
      const file = await bot.api.getFile(photo.file_id);

      if (file.file_path) {
        const buffer = await downloadTelegramFile(file.file_path);
        const result = await classifyImage(buffer);

        if (result.isNsfw) {
          await banAndNotify(
            bot,
            chatId,
            user,
            "profile_photo",
            result.category,
            result.confidence,
            messageId,
          );
          return true;
        }
      }
    }
  } catch (err) {
    console.error(`Profile photo check failed for ${user.id}:`, err);
  }

  // 3. Check personal channel photo
  try {
    const userChat = await bot.api.getChat(user.id);
    // Check if user has a personal channel
    const personalChat = (userChat as any).personal_chat;
    if (personalChat?.id) {
      try {
        const channelInfo = await bot.api.getChat(personalChat.id);
        if (channelInfo.photo) {
          const file = await bot.api.getFile(
            channelInfo.photo.big_file_id,
          );
          if (file.file_path) {
            const buffer = await downloadTelegramFile(file.file_path);
            const result = await classifyImage(buffer);

            if (result.isNsfw) {
              await banAndNotify(
                bot,
                chatId,
                user,
                "channel_photo",
                result.category,
                result.confidence,
                messageId,
              );
              return true;
            }
          }
        }
      } catch {
        // May fail if channel is private or inaccessible
      }
    }
  } catch (err) {
    console.error(`Personal channel check failed for ${user.id}:`, err);
  }

  return false;
}

export function registerNsfwMiddleware(bot: Bot) {
  // Profile check on every message
  bot.on("message", async (ctx: Context, next: NextFunction) => {
    try {
      const chat = ctx.chat;
      const user = ctx.from;

      if (
        !chat ||
        !user ||
        user.is_bot ||
        (chat.type !== "group" && chat.type !== "supergroup")
      ) {
        await next();
        return;
      }

      const banned = await checkUserProfile(bot, chat.id, user, ctx.msg?.message_id);
      if (banned) return; // Don't call next() — user is banned
    } catch (err) {
      console.error("NSFW profile check error:", err);
    }

    await next();
  });

  // Message photo check
  bot.on("message:photo", async (ctx: Context, next: NextFunction) => {
    try {
      const chat = ctx.chat;
      const user = ctx.from;

      if (
        !chat ||
        !user ||
        user.is_bot ||
        (chat.type !== "group" && chat.type !== "supergroup")
      ) {
        await next();
        return;
      }

      const photoArray = ctx.msg?.photo;
      if (!photoArray || photoArray.length === 0) {
        await next();
        return;
      }

      // Use the largest photo for better accuracy
      const photo = photoArray[photoArray.length - 1];
      const file = await ctx.api.getFile(photo.file_id);

      if (!file.file_path) {
        await next();
        return;
      }

      const buffer = await downloadTelegramFile(file.file_path);
      const result = await classifyImage(buffer);

      if (result.isNsfw) {
        await banAndNotify(
          bot,
          chat.id,
          user,
          "message_photo",
          result.category,
          result.confidence,
          ctx.msg?.message_id,
        );
        return; // Don't call next()
      }
    } catch (err) {
      console.error("NSFW image check error:", err);
    }

    await next();
  });

  // Reaction check — when someone reacts, check their profile
  bot.on("message_reaction", async (ctx: Context, next: NextFunction) => {
    try {
      const chat = ctx.chat;
      const update = (ctx.update as any).message_reaction;
      const user = update?.user;

      if (
        !chat ||
        !user ||
        user.is_bot ||
        (chat.type !== "group" && chat.type !== "supergroup")
      ) {
        await next();
        return;
      }

      const banned = await checkUserProfile(bot, chat.id, user);
      if (banned) return;
    } catch (err) {
      console.error("NSFW reaction check error:", err);
    }

    await next();
  });
}
