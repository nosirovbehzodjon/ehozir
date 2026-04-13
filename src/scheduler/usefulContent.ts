import cron from "node-cron";
import { Bot } from "grammy";
import {
  listYoutubeChannels,
  upsertYoutubeChannel,
} from "@/db/youtubeChannels";
import {
  insertUsefulContent,
  getLatestUsefulContent,
  getGroupsWithUsefulContentEnabled,
  type UsefulContentRow,
} from "@/db/usefulContent";
import { getUsefulContentHours } from "@/db/botSettings";
import { fetchLatestUploads, resolveChannel } from "@/services/youtube";
import { t, type Lang } from "@/i18n";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const TIMEZONE = "Asia/Tashkent";
const MAX_PER_DELIVERY = 5;

function buildTrackingUrl(contentId: number, chatId: number): string {
  return `${SUPABASE_URL}/functions/v1/yt-redirect?id=${contentId}&chat=${chatId}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMessage(
  rows: UsefulContentRow[],
  chatId: number,
  lang: Lang,
): string {
  const tr = t(lang);
  let text = tr.usefulContentHeader;
  for (const item of rows) {
    const url = buildTrackingUrl(item.id, chatId);
    text += `• <b>${escapeHtml(item.channel_title)}</b>\n<a href="${url}">${escapeHtml(item.title)}</a>\n\n`;
  }
  return text;
}

async function resolvePendingChannels(): Promise<void> {
  const channels = await listYoutubeChannels(true);
  for (const ch of channels) {
    if (
      !ch.channel_id.startsWith("pending:") &&
      ch.uploads_playlist_id !== "pending"
    ) {
      continue;
    }
    try {
      const input = ch.handle ?? ch.channel_id.replace(/^pending:/, "");
      const info = await resolveChannel(input);
      if (ch.channel_id.startsWith("pending:")) {
        // Insert real row, then the old pending row can stay deactivated.
        await upsertYoutubeChannel({
          channel_id: info.channelId,
          handle: info.handle,
          title: info.title,
          uploads_playlist_id: info.uploadsPlaylistId,
          is_active: true,
        });
        await upsertYoutubeChannel({
          channel_id: ch.channel_id,
          handle: ch.handle,
          title: ch.title,
          uploads_playlist_id: "resolved",
          is_active: false,
        });
      } else {
        await upsertYoutubeChannel({
          channel_id: info.channelId,
          handle: info.handle,
          title: info.title,
          uploads_playlist_id: info.uploadsPlaylistId,
          is_active: true,
        });
      }
      console.log(
        `Resolved YouTube channel: ${info.title} (${info.channelId})`,
      );
    } catch (err) {
      console.error(`Failed to resolve channel ${ch.channel_id}:`, err);
    }
  }
}

async function fetchAndStoreUploads(): Promise<UsefulContentRow[]> {
  await resolvePendingChannels();
  const channels = await listYoutubeChannels(true);
  const all: UsefulContentRow[] = [];

  for (const ch of channels) {
    if (
      !ch.uploads_playlist_id ||
      ch.uploads_playlist_id === "pending" ||
      ch.uploads_playlist_id === "resolved"
    ) {
      continue;
    }
    try {
      const videos = await fetchLatestUploads(ch.uploads_playlist_id, 10);
      const inserted = await insertUsefulContent(videos);
      all.push(...inserted);
    } catch (err) {
      console.error(`Failed to fetch uploads for ${ch.title}:`, err);
    }
  }
  return all;
}

export async function sendUsefulContentToChat(
  bot: Bot,
  chatId: number,
  lang: Lang,
): Promise<boolean> {
  await fetchAndStoreUploads();
  const rows = await getLatestUsefulContent(MAX_PER_DELIVERY);
  if (rows.length === 0) return false;

  const text = buildMessage(rows, chatId, lang);
  await bot.api.sendMessage(chatId, text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: false },
  });
  return true;
}

export async function sendDailyUsefulContent(bot: Bot): Promise<number> {
  await fetchAndStoreUploads();
  const [rows, groups] = await Promise.all([
    getLatestUsefulContent(MAX_PER_DELIVERY),
    getGroupsWithUsefulContentEnabled(),
  ]);
  if (rows.length === 0 || groups.length === 0) return 0;

  for (const group of groups) {
    const lang = (group.language as Lang) || "uz";
    const text = buildMessage(rows, group.chatId, lang);
    try {
      await bot.api.sendMessage(group.chatId, text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
      });
    } catch (err) {
      console.error(`Failed to send useful content to ${group.chatId}:`, err);
    }
  }
  return groups.length;
}

export function startUsefulContentScheduler(bot: Bot) {
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

      const targetHours = await getUsefulContentHours();
      if (!targetHours.includes(tashkentHour)) return;

      console.log(
        `Running useful content job (${String(tashkentHour).padStart(2, "0")}:00 Tashkent)...`,
      );
      const count = await sendDailyUsefulContent(bot);
      console.log(`Useful content sent to ${count} group(s).`);
    },
    { timezone: TIMEZONE },
  );

  console.log(
    "Useful content scheduler started (checks hourly, Tashkent time).",
  );
}
