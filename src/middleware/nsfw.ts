import { Bot } from "grammy";
import type { Context, NextFunction } from "grammy";
import type { User } from "grammy/types";
import {
  classifyImage,
  downloadTelegramFile,
  type NsfwResult,
} from "@/services/nsfw";
import { escapeMarkdown } from "@/utils/markdown";
import { getGroupLanguage } from "@/db/settings";
import { t } from "@/i18n";
import {
  isKnownSensitiveUser,
  logSensitiveProfile,
  wasRecentlyChecked,
  markAsChecked,
} from "@/db/sensitiveLog";
import { notifyNsfwBan } from "@/utils/notify";

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
  // Public group/channel with a username → direct t.me/<username>/<msg>
  if (chat.username) {
    return `https://t.me/${chat.username}/${messageId}`;
  }
  // Private supergroup: chat.id is -100XXXXXXXXXX → https://t.me/c/XXXXXXXXXX/<msg>
  if (chat.type === "supergroup" || chat.type === "channel") {
    const internal = String(chat.id).replace(/^-100/, "");
    return `https://t.me/c/${internal}/${messageId}`;
  }
  return null;
}

/**
 * Send the NSFW classification breakdown directly to every developer's DM
 * (never into the group). Includes a link back to the original photo so
 * the developer can review it in context.
 */
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
 * Re-post a message on behalf of the original author, then delete the
 * original so the NSFW user's reaction is removed.
 * Copies the content and adds a mention of the original author.
 */
async function repostAndDelete(
  bot: Bot,
  chatId: number,
  messageId: number,
): Promise<void> {
  // Forward to same chat to get the original message content + author info
  let forwarded;
  try {
    forwarded = await bot.api.forwardMessage(chatId, chatId, messageId);
  } catch {
    return;
  }

  // Extract original author from the forwarded message
  const origin = (forwarded as any).forward_origin;
  let authorName = "";
  let authorId: number | undefined;

  if (origin?.type === "user" && origin.sender_user) {
    authorId = origin.sender_user.id;
    authorName =
      origin.sender_user.username
        ? `@${origin.sender_user.username}`
        : origin.sender_user.first_name ?? "User";
  } else if (forwarded.from) {
    authorId = forwarded.from.id;
    authorName =
      forwarded.from.username
        ? `@${forwarded.from.username}`
        : forwarded.from.first_name ?? "User";
  }

  // Delete the forwarded copy
  try {
    await bot.api.deleteMessage(chatId, forwarded.message_id);
  } catch {
    // ignore
  }

  // Build attribution suffix — skip for bot's own posts
  const botId = bot.botInfo?.id;
  const isOwnPost = authorId === botId;

  let suffix = "";
  if (!isOwnPost && authorId) {
    const lang = await getGroupLanguage(chatId);
    const mention = `[${escapeMarkdown(authorName)}](tg://user?id=${authorId})`;
    const explanation = escapeMarkdown(t(lang).nsfwReactionRepost);
    suffix = `\n\n✍️ ${mention}\n${explanation}`;
  }

  // Re-send the message with attribution embedded in the content
  try {
    if (forwarded.text) {
      // Text message — append attribution to the text
      const text = escapeMarkdown(forwarded.text) + suffix;
      await bot.api.sendMessage(chatId, text, {
        parse_mode: "MarkdownV2",
      });
    } else if (forwarded.photo && forwarded.photo.length > 0) {
      // Photo message — use original caption + attribution as caption
      const originalCaption = forwarded.caption
        ? escapeMarkdown(forwarded.caption)
        : "";
      const caption = originalCaption + suffix;
      const photoId = forwarded.photo[forwarded.photo.length - 1].file_id;
      await bot.api.sendPhoto(chatId, photoId, {
        caption: caption || undefined,
        parse_mode: caption ? "MarkdownV2" : undefined,
      });
    } else if (forwarded.video) {
      const originalCaption = forwarded.caption
        ? escapeMarkdown(forwarded.caption)
        : "";
      const caption = originalCaption + suffix;
      await bot.api.sendVideo(chatId, forwarded.video.file_id, {
        caption: caption || undefined,
        parse_mode: caption ? "MarkdownV2" : undefined,
      });
    } else if (forwarded.document) {
      const originalCaption = forwarded.caption
        ? escapeMarkdown(forwarded.caption)
        : "";
      const caption = originalCaption + suffix;
      await bot.api.sendDocument(chatId, forwarded.document.file_id, {
        caption: caption || undefined,
        parse_mode: caption ? "MarkdownV2" : undefined,
      });
    } else {
      // Other message types — just copy without attribution
      await bot.api.copyMessage(chatId, chatId, messageId);
    }
  } catch {
    return;
  }

  // Delete the original message (reaction goes with it)
  try {
    await bot.api.deleteMessage(chatId, messageId);
  } catch {
    // May fail if bot lacks delete permission
  }
}

async function banAndNotify(
  bot: Bot,
  chatId: number,
  user: User,
  reason: string,
  category: string,
  confidence: number,
  messageId?: number,
  reactionMessageId?: number,
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
    console.log(
      `NSFW ${reason} (developer skip): ${userName} (${user.id}) in ${chatId} — ${category} ${(confidence * 100).toFixed(1)}%`,
    );
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

  // Delete the offending message (sent by the NSFW user)
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

  // If triggered by a reaction: re-post the original message content
  // (preserving the author's text/media), then delete the original
  // so the NSFW user's reaction is removed
  if (reactionMessageId) {
    await repostAndDelete(bot, chatId, reactionMessageId);
  }

  await notifyNsfwBan(user, chatId, reason, category, confidence);

  console.log(
    `NSFW ${reason}: ${userName} (${user.id}) in ${chatId} — ${category} ${(confidence * 100).toFixed(1)}%`,
  );
}

/**
 * Check user's profile photo and personal channel photo.
 * Returns true if NSFW was detected and user was banned/notified.
 */
async function checkUserProfile(
  bot: Bot,
  chatId: number,
  user: User,
  messageId?: number,
  reactionMessageId?: number,
): Promise<boolean> {
  if (user.is_bot) return false;

  // Skip users checked in the last 24h (persisted in DB)
  const checked = await wasRecentlyChecked(user.id);
  if (checked) return false;

  // Mark as checked immediately to prevent duplicate checks
  await markAsChecked(user.id);

  console.log(
    `NSFW: checking profile of ${user.first_name ?? user.id} (${user.id})`,
  );

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
        reactionMessageId,
      );
      return true;
    }
  }

  // 2. Check profile photo
  try {
    const photos = await bot.api.getUserProfilePhotos(user.id, {
      limit: 1,
    });
    if (photos.total_count > 0 && photos.photos.length > 0) {
      const photoSizes = photos.photos[0];
      // Use the largest available size for best accuracy
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
          await banAndNotify(
            bot,
            chatId,
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

  // 3. Check personal channel photo
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
              await banAndNotify(
                bot,
                chatId,
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
        // May fail if channel is private or inaccessible
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

      const banned = await checkUserProfile(
        bot,
        chat.id,
        user,
        ctx.msg?.message_id,
      );
      if (banned) return;
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

      // Use the largest photo for best accuracy
      const photo = photoArray[photoArray.length - 1];
      const file = await ctx.api.getFile(photo.file_id);

      if (!file.file_path) {
        await next();
        return;
      }

      const buffer = await downloadTelegramFile(file.file_path);
      const result = await classifyImage(buffer);
      await sendDevBreakdown(
        bot,
        {
          id: chat.id,
          type: chat.type,
          title: "title" in chat ? chat.title : null,
          username: "username" in chat ? chat.username : null,
        },
        result,
        "Message photo",
        ctx.msg?.message_id,
      );

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
        return;
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
      // grammY provides ctx.messageReaction for reaction updates
      const reaction =
        (ctx as any).messageReaction ?? (ctx.update as any).message_reaction;
      const user: User | undefined = reaction?.user ?? ctx.from;

      if (
        !chat ||
        !user ||
        user.is_bot ||
        (chat.type !== "group" && chat.type !== "supergroup")
      ) {
        await next();
        return;
      }

      const reactedMessageId: number | undefined = reaction?.message_id;

      console.log(
        `NSFW: reaction from ${user.first_name ?? user.id} (${user.id}) in ${chat.id} on message ${reactedMessageId}`,
      );

      const banned = await checkUserProfile(
        bot,
        chat.id,
        user,
        undefined,
        reactedMessageId,
      );
      if (banned) return;
    } catch (err) {
      console.error("NSFW reaction check error:", err);
    }

    await next();
  });
}
