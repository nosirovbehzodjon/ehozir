import cron from "node-cron";
import { Bot } from "grammy";
import { getGroupsWithNewsEnabled, insertExternalNews } from "@/db/news";
import { getNewsHours } from "@/db/botSettings";
import { fetchAllExternalNews } from "@/services/newsFetcher";
import { t, type Lang } from "@/i18n";
import type { ExternalNewsRow } from "@/db/news";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const TIMEZONE = "Asia/Tashkent";

function buildTrackingUrl(newsId: number, chatId: number): string {
  return `${SUPABASE_URL}/functions/v1/redirect?id=${newsId}&chat=${chatId}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildNewsMessage(
  rows: ExternalNewsRow[],
  chatId: number,
  lang: Lang,
): string {
  const tr = t(lang);
  let text = tr.dailyNewsHeader;

  for (const item of rows) {
    const url = buildTrackingUrl(item.id, chatId);
    text += `• <a href="${url}">${escapeHtml(item.title)}</a>\n\n`;
  }

  return text;
}

async function fetchAndStoreNews(): Promise<ExternalNewsRow[]> {
  const items = await fetchAllExternalNews();
  if (items.length === 0) return [];
  return insertExternalNews(items);
}

export async function sendNewsToChat(
  bot: Bot,
  chatId: number,
  lang: Lang,
): Promise<boolean> {
  const rows = await fetchAndStoreNews();
  if (rows.length === 0) return false;

  const text = buildNewsMessage(rows, chatId, lang);

  await bot.api.sendMessage(chatId, text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });

  return true;
}

export async function sendDailyNews(bot: Bot): Promise<number> {
  const [rows, groups] = await Promise.all([
    fetchAndStoreNews(),
    getGroupsWithNewsEnabled(),
  ]);

  if (rows.length === 0 || groups.length === 0) return 0;

  for (const group of groups) {
    const lang = (group.language as Lang) || "uz";
    const text = buildNewsMessage(rows, group.chatId, lang);

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

export function startDailyNewsScheduler(bot: Bot) {
  // Check every hour (at :00) in Tashkent time.
  // Compare current hour against the configured news_hours list from DB.
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

      const newsHours = await getNewsHours();

      if (!newsHours.includes(tashkentHour)) return;

      console.log(
        `Running daily news job (${String(tashkentHour).padStart(2, "0")}:00 Tashkent)...`,
      );
      const count = await sendDailyNews(bot);
      console.log(`Daily news sent to ${count} group(s).`);
    },
    { timezone: TIMEZONE },
  );

  console.log("Daily news scheduler started (checks hourly, Tashkent time).");
}
