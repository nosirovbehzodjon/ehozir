import { Bot } from "grammy";
import type { Context, NextFunction } from "grammy";
import type { User } from "grammy/types";
import {
  classifyImage,
  downloadTelegramFile,
  type NsfwResult,
} from "@/services/nsfw";
import { isFeatureEnabled } from "@/db/settings";
import { NSFW_FEATURE } from "@/commands/sensitiveContent";
import {
  isKnownSensitiveUser,
  wasRecentlyChecked,
  markAsChecked,
} from "@/db/sensitiveLog";
import { applyNsfwBan } from "@/services/nsfwBan";
import { createPendingBanAndNotifyAdmins } from "@/services/nsfwApproval";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number): boolean {
  return DEVELOPER_IDS.includes(userId);
}

function formatPredictions(result: NsfwResult, label: string): string {
  const lines = result.all
    .sort((a, b) => b.probability - a.probability)
    .map((p) => `  ${p.className}: ${(p.probability * 100).toFixed(1)}%`);
  return `📊 ${label}:\n${lines.join("\n")}`;
}

function buildPhotoLink(
  chat: { id: number; type: string; username?: string | null },
  messageId?: number,
): string | null {
  if (!messageId) return null;
  if (chat.username) {
    return `https://t.me/${chat.username}/${messageId}`;
  }
  if (chat.type === "supergroup" || chat.type === "channel") {
    const internal = String(chat.id).replace(/^-100/, "");
    return `https://t.me/c/${internal}/${messageId}`;
  }
  return null;
}

async function sendDevBreakdown(
  bot: Bot,
  chat: {
    id: number;
    type: string;
    title?: string | null;
    username?: string | null;
  },
  result: NsfwResult,
  label: string,
  messageId?: number,
): Promise<void> {
  if (DEVELOPER_IDS.length === 0) return;

  const groupLabel = chat.title ? ` · ${chat.title}` : "";
  const breakdown = formatPredictions(result, label);
  const link = buildPhotoLink(chat, messageId);

  const text = link
    ? `${breakdown}${groupLabel}\n\n🔗 ${link}`
    : `${breakdown}${groupLabel}`;

  for (const devId of DEVELOPER_IDS) {
    try {
      await bot.api.sendMessage(devId, text, {
        link_preview_options: { is_disabled: true },
      });
    } catch {
      // ignore individual DM failures
    }
  }
}

/**
 * Handles a newly-detected NSFW user. Developers get an in-group notice and
 * are never banned. Regular users enter the admin-approval flow: a pending
 * row is created and every reachable admin receives a DM with Approve /
 * Dismiss buttons.
 */
async function handleNewDetection(
  bot: Bot,
  chat: {
    id: number;
    type: string;
    title?: string | null;
    username?: string | null;
  },
  user: User,
  reason: string,
  category: string,
  confidence: number,
  messageId?: number,
  reactionMessageId?: number,
): Promise<void> {
  const userName = user.first_name || user.username || "User";

  if (isDeveloper(user.id)) {
    const devMsg = `NSFW detected (${reason}): ${category} (${(confidence * 100).toFixed(1)}%) — you are a developer, no ban applied.`;
    try {
      await bot.api.sendMessage(chat.id, devMsg, {
        reply_parameters: messageId ? { message_id: messageId } : undefined,
      });
    } catch {
      // ignore
    }
    console.log(
      `NSFW ${reason} (developer skip): ${userName} (${user.id}) in ${chat.id} — ${category} ${(confidence * 100).toFixed(1)}%`,
    );
    return;
  }

  await createPendingBanAndNotifyAdmins(bot, {
    chatId: chat.id,
    user,
    reason,
    category,
    confidence,
    messageId,
    reactionMessageId,
    groupTitle: chat.title ?? null,
  });

  console.log(
    `NSFW ${reason} (pending admin approval): ${userName} (${user.id}) in ${chat.id} — ${category} ${(confidence * 100).toFixed(1)}%`,
  );
}

/**
 * Check user's profile photo and personal channel photo.
 * Returns true if an action was taken (instant ban OR pending approval).
 */
async function checkUserProfile(
  bot: Bot,
  chat: {
    id: number;
    type: string;
    title?: string | null;
    username?: string | null;
  },
  user: User,
  messageId?: number,
  reactionMessageId?: number,
): Promise<boolean> {
  if (user.is_bot) return false;

  const checked = await wasRecentlyChecked(user.id);
  if (checked) return false;

  await markAsChecked(user.id);

  console.log(
    `NSFW: checking profile of ${user.first_name ?? user.id} (${user.id})`,
  );

  // 1. Already flagged in another group → instant cross-group ban (skipped for developers)
  if (!isDeveloper(user.id)) {
    const isKnown = await isKnownSensitiveUser(user.id);
    if (isKnown) {
      await applyNsfwBan(
        bot,
        chat.id,
        user,
        "known_sensitive",
        "Previously flagged",
        1.0,
        messageId,
        reactionMessageId,
      );
      return true;
    }
  }

  // 2. Profile photo
  try {
    const photos = await bot.api.getUserProfilePhotos(user.id, { limit: 1 });
    if (photos.total_count > 0 && photos.photos.length > 0) {
      const photoSizes = photos.photos[0];
      const photo = photoSizes[photoSizes.length - 1];
      const file = await bot.api.getFile(photo.file_id);

      if (file.file_path) {
        const buffer = await downloadTelegramFile(file.file_path);
        console.log(
          `NSFW: downloaded profile photo for ${user.id} (${buffer.length} bytes)`,
        );
        const result = await classifyImage(buffer);
        console.log(
          `NSFW: profile photo result for ${user.id}: ${result.category} (${(result.confidence * 100).toFixed(1)}%)`,
        );
        if (result.isNsfw) {
          await handleNewDetection(
            bot,
            chat,
            user,
            "profile_photo",
            result.category,
            result.confidence,
            messageId,
            reactionMessageId,
          );
          return true;
        }
      }
    } else {
      console.log(`NSFW: no profile photo for ${user.id}`);
    }
  } catch (err) {
    console.error(`NSFW: profile photo check failed for ${user.id}:`, err);
  }

  // 3. Personal channel photo
  try {
    const userChat = await bot.api.getChat(user.id);
    const personalChat = (userChat as any).personal_chat;
    if (personalChat?.id) {
      console.log(
        `NSFW: checking personal channel ${personalChat.id} for ${user.id}`,
      );
      try {
        const channelInfo = await bot.api.getChat(personalChat.id);
        if (channelInfo.photo) {
          const file = await bot.api.getFile(channelInfo.photo.big_file_id);
          if (file.file_path) {
            const buffer = await downloadTelegramFile(file.file_path);
            console.log(
              `NSFW: downloaded channel photo for ${user.id} (${buffer.length} bytes)`,
            );
            const result = await classifyImage(buffer);
            console.log(
              `NSFW: channel photo result for ${user.id}: ${result.category} (${(result.confidence * 100).toFixed(1)}%)`,
            );
            if (result.isNsfw) {
              await handleNewDetection(
                bot,
                chat,
                user,
                "channel_photo",
                result.category,
                result.confidence,
                messageId,
                reactionMessageId,
              );
              return true;
            }
          }
        }
      } catch {
        // channel may be private or inaccessible
      }
    }
  } catch (err) {
    console.error(`NSFW: personal channel check failed for ${user.id}:`, err);
  }

  return false;
}

export function registerNsfwMiddleware(bot: Bot) {
  // Profile check on every message
  bot.on("message", async (ctx: Context, next: NextFunction) => {
    const chat = ctx.chat;
    const user = ctx.from;

    if (
      chat &&
      user &&
      !user.is_bot &&
      (chat.type === "group" || chat.type === "supergroup")
    ) {
      try {
        const enabled = await isFeatureEnabled(chat.id, NSFW_FEATURE, false);
        if (enabled) {
          const chatInfo = {
            id: chat.id,
            type: chat.type,
            title: "title" in chat ? chat.title : null,
            username: "username" in chat ? chat.username : null,
          };
          const handled = await checkUserProfile(
            bot,
            chatInfo,
            user,
            ctx.msg?.message_id,
          );
          if (handled) return;
        }
      } catch (err) {
        console.error("NSFW profile check error:", err);
      }
    }

    await next();
  });

  // Message photo check
  bot.on("message:photo", async (ctx: Context, next: NextFunction) => {
    const chat = ctx.chat;
    const user = ctx.from;

    if (
      chat &&
      user &&
      !user.is_bot &&
      (chat.type === "group" || chat.type === "supergroup")
    ) {
      try {
        const enabled = await isFeatureEnabled(chat.id, NSFW_FEATURE, false);
        if (enabled) {
          const photoArray = ctx.msg?.photo;
          if (photoArray && photoArray.length > 0) {
            const photo = photoArray[photoArray.length - 1];
            const file = await ctx.api.getFile(photo.file_id);

            if (file.file_path) {
              const buffer = await downloadTelegramFile(file.file_path);
              const result = await classifyImage(buffer);
              const chatInfo = {
                id: chat.id,
                type: chat.type,
                title: "title" in chat ? chat.title : null,
                username: "username" in chat ? chat.username : null,
              };
              await sendDevBreakdown(
                bot,
                chatInfo,
                result,
                "Message photo",
                ctx.msg?.message_id,
              );

              if (result.isNsfw) {
                await handleNewDetection(
                  bot,
                  chatInfo,
                  user,
                  "message_photo",
                  result.category,
                  result.confidence,
                  ctx.msg?.message_id,
                );
                return;
              }
            }
          }
        }
      } catch (err) {
        console.error("NSFW image check error:", err);
      }
    }

    await next();
  });

  // Reaction check — when someone reacts, check their profile
  bot.on("message_reaction", async (ctx: Context, next: NextFunction) => {
    const chat = ctx.chat;
    const reaction =
      (ctx as any).messageReaction ?? (ctx.update as any).message_reaction;
    const user: User | undefined = reaction?.user ?? ctx.from;

    if (
      chat &&
      user &&
      !user.is_bot &&
      (chat.type === "group" || chat.type === "supergroup")
    ) {
      try {
        const enabled = await isFeatureEnabled(chat.id, NSFW_FEATURE, false);
        if (enabled) {
          const reactedMessageId: number | undefined = reaction?.message_id;

          console.log(
            `NSFW: reaction from ${user.first_name ?? user.id} (${user.id}) in ${chat.id} on message ${reactedMessageId}`,
          );

          const chatInfo = {
            id: chat.id,
            type: chat.type,
            title: "title" in chat ? chat.title : null,
            username: "username" in chat ? chat.username : null,
          };
          const handled = await checkUserProfile(
            bot,
            chatInfo,
            user,
            undefined,
            reactedMessageId,
          );
          if (handled) return;
        }
      } catch (err) {
        console.error("NSFW reaction check error:", err);
      }
    }

    await next();
  });
}
