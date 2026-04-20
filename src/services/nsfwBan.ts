import { Bot } from "grammy";
import type { User } from "grammy/types";
import { escapeMarkdown } from "@/utils/markdown";
import { t } from "@/i18n";
import { getGroupLanguage } from "@/db/settings";
import { logSensitiveProfile } from "@/db/sensitiveLog";
import { notifyNsfwBan } from "@/utils/notify";

/**
 * Re-post a message on behalf of the original author, then delete the
 * original so the NSFW user's reaction is removed.
 */
async function repostAndDelete(
  bot: Bot,
  chatId: number,
  messageId: number,
): Promise<void> {
  let forwarded;
  try {
    forwarded = await bot.api.forwardMessage(chatId, chatId, messageId);
  } catch {
    return;
  }

  const origin = (forwarded as any).forward_origin;
  let authorName = "";
  let authorId: number | undefined;

  if (origin?.type === "user" && origin.sender_user) {
    authorId = origin.sender_user.id;
    authorName = origin.sender_user.username
      ? `@${origin.sender_user.username}`
      : origin.sender_user.first_name ?? "User";
  } else if (forwarded.from) {
    authorId = forwarded.from.id;
    authorName = forwarded.from.username
      ? `@${forwarded.from.username}`
      : forwarded.from.first_name ?? "User";
  }

  try {
    await bot.api.deleteMessage(chatId, forwarded.message_id);
  } catch {
    // ignore
  }

  const botId = bot.botInfo?.id;
  const isOwnPost = authorId === botId;

  let suffix = "";
  if (!isOwnPost && authorId) {
    const lang = await getGroupLanguage(chatId);
    const mention = `[${escapeMarkdown(authorName)}](tg://user?id=${authorId})`;
    const explanation = escapeMarkdown(t(lang).nsfwReactionRepost);
    suffix = `\n\n✍️ ${mention}\n${explanation}`;
  }

  try {
    if (forwarded.text) {
      const text = escapeMarkdown(forwarded.text) + suffix;
      await bot.api.sendMessage(chatId, text, { parse_mode: "MarkdownV2" });
    } else if (forwarded.photo && forwarded.photo.length > 0) {
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
      await bot.api.copyMessage(chatId, chatId, messageId);
    }
  } catch {
    return;
  }

  try {
    await bot.api.deleteMessage(chatId, messageId);
  } catch {
    // bot may lack delete permission
  }
}

/**
 * Executes the ban: logs the user to sensitive_profile_log for cross-group
 * recognition, deletes the offending message, bans the user, reposts-and-
 * deletes a reacted-to message if needed, and notifies developers. Assumes
 * the caller has already decided the user should be banned (no developer
 * check — don't call this for developers).
 */
export async function applyNsfwBan(
  bot: Bot,
  chatId: number,
  user: Pick<User, "id" | "first_name" | "last_name" | "username" | "is_bot">,
  reason: string,
  category: string,
  confidence: number,
  messageId?: number | null,
  reactionMessageId?: number | null,
): Promise<void> {
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

  if (messageId) {
    try {
      await bot.api.deleteMessage(chatId, messageId);
    } catch {
      // ignore
    }
  }

  try {
    await bot.api.banChatMember(chatId, user.id);
  } catch {
    // ignore
  }

  if (reactionMessageId) {
    await repostAndDelete(bot, chatId, reactionMessageId);
  }

  await notifyNsfwBan(
    { id: user.id, first_name: user.first_name, username: user.username },
    chatId,
    reason,
    category,
    confidence,
  );

  console.log(
    `NSFW ${reason}: ${user.first_name ?? user.id} (${user.id}) in ${chatId} — ${category} ${(confidence * 100).toFixed(1)}%`,
  );
}
