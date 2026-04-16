import { Bot } from "grammy";
import { getGroupMembers } from "@/db/groups";
import { getGroupLanguage } from "@/db/settings";
import { escapeMarkdown } from "@/utils/markdown";
import { onCommand, t } from "@/i18n";

export function registerRandom(bot: Bot) {
  onCommand(bot, ["qura", "random", "случайный"], async (ctx) => {
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

    // Parse count from command argument (default 1)
    let count = 1;
    const arg = ctx.match?.toString().trim();
    if (arg) {
      const n = parseInt(arg, 10);
      if (!Number.isNaN(n) && n > 0) {
        count = Math.min(n, members.length);
      }
    }

    // Shuffle and pick
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);

    let text = escapeMarkdown(t(lang).randomPicked) + "\n\n";
    for (const m of picked) {
      const name = escapeMarkdown(m.first_name || m.username || "User");
      text += `[${name}](tg://user?id=${m.user_id})\n`;
    }

    await ctx.reply(text, {
      parse_mode: "MarkdownV2",
      reply_to_message_id: ctx.msg?.message_id,
    });
  });
}
