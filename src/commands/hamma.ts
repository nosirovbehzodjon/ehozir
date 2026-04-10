import { Bot } from "grammy";
import { getGroupMembers } from "@/db/groups";
import { escapeMarkdown } from "@/utils/markdown";

export function registerHamma(bot: Bot) {
  bot.command(["hamma", "all"], async (ctx) => {
    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
      await ctx.reply("This command only works in groups.");
      return;
    }

    const members = await getGroupMembers(ctx.chat.id);

    if (members.length === 0) {
      await ctx.reply(
        "No members tracked yet. Members are tracked as they send messages.",
        { reply_to_message_id: ctx.msg.message_id },
      );
      return;
    }

    let mentionText = "Attention group members:\n\n";
    for (const m of members) {
      const name = escapeMarkdown(m.first_name || m.username || "User");
      mentionText += `[${name}](tg://user?id=${m.user_id}) `;
    }

    await ctx.reply(mentionText, {
      parse_mode: "MarkdownV2",
      reply_to_message_id: ctx.msg.message_id,
    });
  });
}
