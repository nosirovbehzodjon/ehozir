import { Bot } from "grammy";
import { getGroupStats, setTelegramMemberCount } from "@/db/groups";
import { getGroupLanguage } from "@/db/settings";
import { onCommand, t } from "@/i18n";

export function registerStats(bot: Bot) {
  onCommand(bot, ["stats", "statistika", "статистика"], async (ctx) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      const lang = "uz";
      await ctx.reply(t(lang).groupOnly);
      return;
    }

    const lang = await getGroupLanguage(ctx.chat.id);

    let total: number | null = null;
    try {
      total = await ctx.getChatMemberCount();
      await setTelegramMemberCount(ctx.chat.id, total);
    } catch (err) {
      console.error("getChatMemberCount failed:", err);
    }

    const stats = await getGroupStats(ctx.chat.id);
    const totalShown = total ?? stats.total;
    const tr = t(lang);

    const lines = [
      `${tr.trackedByBot}: ${stats.tracked}`,
      `${tr.totalInGroup}: ${totalShown ?? tr.unknown}`,
      "",
      tr.membersAddedInfo,
    ];

    await ctx.reply(lines.join("\n"), {
      reply_to_message_id: ctx.msg?.message_id,
    });
  });
}
