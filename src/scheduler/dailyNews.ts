import cron from "node-cron";
import { Bot } from "grammy";
import { getLatestNews, getGroupsWithNewsEnabled } from "@/db/news";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";

function buildTrackingUrl(newsId: number, chatId: number): string {
  return `${SUPABASE_URL}/functions/v1/redirect?id=${newsId}&chat=${chatId}`;
}

export async function sendDailyNews(bot: Bot): Promise<number> {
  const [news, chatIds] = await Promise.all([
    getLatestNews(5),
    getGroupsWithNewsEnabled(),
  ]);

  if (news.length === 0 || chatIds.length === 0) return 0;

  for (const chatId of chatIds) {
    let text = "📰 Daily News:\n\n";
    for (const item of news) {
      const url = buildTrackingUrl(item.id, chatId);
      text += `• <a href="${url}">${escapeHtml(item.title)}</a>\n\n`;
    }

    try {
      await bot.api.sendMessage(chatId, text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error(`Failed to send news to ${chatId}:`, err);
    }
  }

  return chatIds.length;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function startDailyNewsScheduler(bot: Bot) {
  cron.schedule("0 9 * * *", async () => {
    console.log("Running daily news job...");
    const count = await sendDailyNews(bot);
    console.log(`Daily news sent to ${count} group(s).`);
  });

  console.log("Daily news scheduler started (09:00 every day).");
}
