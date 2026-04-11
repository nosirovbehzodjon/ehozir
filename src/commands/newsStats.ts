import { Bot } from "grammy";
import {
  getSourceSummaryStats,
  getExternalNewsStatsBySource,
} from "@/db/news";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number): boolean {
  return DEVELOPER_IDS.includes(userId);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function registerNewsStats(bot: Bot) {
  // /newsstats — summary of all sources (last 30 days)
  // /newsstats daryo — detailed stats for a specific source (last 7 days)
  bot.command("newsstats", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    const args = ctx.match?.toString().trim();

    if (args) {
      // Detailed stats for specific source
      const source = args.toLowerCase();
      const stats = await getExternalNewsStatsBySource(source, 7);

      if (stats.length === 0) {
        await ctx.reply(`No news found for source "${source}" in the last 7 days.`);
        return;
      }

      let text = `📊 <b>${escapeHtml(source)}</b> — last 7 days\n\n`;
      let totalClicks = 0;

      for (const item of stats) {
        totalClicks += item.click_count;
        text += `• ${escapeHtml(item.title)}\n`;
        text += `  👆 ${item.click_count} clicks\n\n`;
      }

      text += `\n📈 Total: ${stats.length} articles, ${totalClicks} clicks`;

      await ctx.reply(text, { parse_mode: "HTML" });
    } else {
      // Summary of all sources
      const stats = await getSourceSummaryStats(30);

      if (stats.length === 0) {
        await ctx.reply("No news stats available for the last 30 days.");
        return;
      }

      let text = "📊 <b>News Stats</b> — last 30 days\n\n";
      let grandTotalNews = 0;
      let grandTotalClicks = 0;

      for (const s of stats) {
        grandTotalNews += s.total_news;
        grandTotalClicks += s.total_clicks;
        const avg = s.total_news > 0
          ? (s.total_clicks / s.total_news).toFixed(1)
          : "0";
        text += `<b>${escapeHtml(s.source)}</b>\n`;
        text += `  📰 ${s.total_news} articles\n`;
        text += `  👆 ${s.total_clicks} clicks (avg ${avg}/article)\n\n`;
      }

      text += `📈 Total: ${grandTotalNews} articles, ${grandTotalClicks} clicks\n`;
      text += `\nUse <code>/newsstats source_name</code> for details`;

      await ctx.reply(text, { parse_mode: "HTML" });
    }
  });
}
