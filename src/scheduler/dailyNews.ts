import cron from "node-cron";
import { Bot } from "grammy";
import { getLatestNews, getGroupsWithNewsEnabled } from "@/db/news";
import { getNewsHour } from "@/db/botSettings";
import { t, type Lang } from "@/i18n";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const TIMEZONE = "Asia/Tashkent";

function buildTrackingUrl(newsId: number, chatId: number): string {
  return `${SUPABASE_URL}/functions/v1/redirect?id=${newsId}&chat=${chatId}`;
}

export async function sendDailyNews(bot: Bot): Promise<number> {
  const [news, groups] = await Promise.all([
    getLatestNews(5),
    getGroupsWithNewsEnabled(),
  ]);

  if (news.length === 0 || groups.length === 0) return 0;

  for (const group of groups) {
    const lang = (group.language as Lang) || "uz";
    let text = t(lang).dailyNewsHeader;
    for (const item of news) {
      const url = buildTrackingUrl(item.id, group.chatId);
      text += `• <a href="${url}">${escapeHtml(item.title)}</a>\n\n`;
    }

    try {
      await bot.api.sendMessage(group.chatId, text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error(`Failed to send news to ${group.chatId}:`, err);
    }
  }

  return groups.length;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function startDailyNewsScheduler(bot: Bot) {
  // Check every hour (at :00) in Tashkent time.
  // Compare current hour with the configured news_hour from DB.
  cron.schedule(
    "0 * * * *",
    async () => {
      const now = new Date();
      const tashkentHour = parseInt(
        now.toLocaleString("en-US", {
          timeZone: TIMEZONE,
          hour: "numeric",
          hour12: false,
        }),
        10,
      );

      const newsHour = await getNewsHour();

      if (tashkentHour !== newsHour) return;

      console.log(
        `Running daily news job (${String(newsHour).padStart(2, "0")}:00 Tashkent)...`,
      );
      const count = await sendDailyNews(bot);
      console.log(`Daily news sent to ${count} group(s).`);
    },
    { timezone: TIMEZONE },
  );

  console.log("Daily news scheduler started (checks hourly, Tashkent time).");
}
