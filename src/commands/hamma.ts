import { Bot } from "grammy";
import { getGroupMembers } from "@/db/groups";
import { getGroupLanguage } from "@/db/settings";
import { escapeMarkdown } from "@/utils/markdown";
import { onCommand, t } from "@/i18n";

export function registerHamma(bot: Bot) {
  onCommand(bot, ["hamma", "all", "все"], async (ctx) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      const lang = "uz";
      await ctx.reply(t(lang).groupOnly);
      return;
    }

    const lang = await getGroupLanguage(ctx.chat.id);
    const members = await getGroupMembers(ctx.chat.id);

    if (members.length === 0) {
      await ctx.reply(t(lang).noMembers, {
        reply_to_message_id: ctx.msg?.message_id,
      });
      return;
    }

    let mentionText = t(lang).attentionMembers;
    for (const m of members) {
      const name = escapeMarkdown(m.first_name || m.username || "User");
      mentionText += `[${name}](tg://user?id=${m.user_id}) `;
    }

    await ctx.reply(mentionText, {
      parse_mode: "MarkdownV2",
      reply_to_message_id: ctx.msg?.message_id,
    });
  });
}
