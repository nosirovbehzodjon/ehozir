import { Bot } from "grammy";
import { getMonthlyUsefulClicksByChannel } from "@/db/usefulContent";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number | undefined): boolean {
  return !!userId && DEVELOPER_IDS.includes(userId);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseYearMonth(arg: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (!arg) {
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  const m = arg.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) {
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
}

export function registerUsefulStats(bot: Bot) {
  // /usefulstats           — current month clicks per channel
  // /usefulstats YYYY-MM   — specific month
  bot.command("usefulstats", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (!isDeveloper(ctx.from?.id)) return;

    const arg = ctx.match?.toString().trim() || undefined;
    const { year, month } = parseYearMonth(arg);
    const stats = await getMonthlyUsefulClicksByChannel(year, month);

    const label = `${year}-${String(month).padStart(2, "0")}`;
    if (stats.length === 0) {
      await ctx.reply(`No useful content clicks for ${label}.`);
      return;
    }

    let text = `📊 <b>Useful content clicks — ${label}</b>\n\n`;
    let totalClicks = 0;
    let totalVideos = 0;
    for (const row of stats) {
      totalClicks += row.clicks;
      totalVideos += row.videos;
      text += `<b>${escapeHtml(row.channel_title)}</b>\n`;
      text += `  🎬 ${row.videos} videos · 👆 ${row.clicks} clicks\n\n`;
    }
    text += `📈 Total: ${totalVideos} videos, ${totalClicks} clicks\n`;
    text += `\nUse <code>/usefulstats YYYY-MM</code> for another month.`;

    await ctx.reply(text, { parse_mode: "HTML" });
  });
}
