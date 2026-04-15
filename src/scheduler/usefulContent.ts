import cron from "node-cron";
import { Bot } from "grammy";
import {
  listYoutubeChannels,
  upsertYoutubeChannel,
  type ChannelCategory,
} from "@/db/youtubeChannels";
import {
  insertUsefulContent,
  pickUsefulContentForDelivery,
  incrementUsefulContentSent,
  pruneExhaustedUsefulContent,
  pruneOldUsefulContent,
  getGroupsWithFeatureEnabled,
  type UsefulContentRow,
} from "@/db/usefulContent";
import {
  getUsefulContentHours,
  getEnglishContentHours,
} from "@/db/botSettings";
import { fetchLatestUploads, resolveChannel } from "@/services/youtube";
import { t, type Lang } from "@/i18n";

type Translation = ReturnType<typeof t>;

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const TIMEZONE = "Asia/Tashkent";
const MAX_PER_DELIVERY = 10;

type ContentKind = {
  category: ChannelCategory;
  feature: "usefulContent" | "englishContent";
  getHours: () => Promise<number[]>;
  getHeader: (tr: Translation) => string;
  logLabel: string;
};

const USEFUL: ContentKind = {
  category: "useful",
  feature: "usefulContent",
  getHours: getUsefulContentHours,
  getHeader: (tr) => tr.usefulContentHeader,
  logLabel: "useful content",
};

const ENGLISH: ContentKind = {
  category: "english",
  feature: "englishContent",
  getHours: getEnglishContentHours,
  getHeader: (tr) => tr.englishContentHeader,
  logLabel: "english content",
};

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
  kind: ContentKind,
): string {
  const tr = t(lang);
  let text = kind.getHeader(tr);
  for (const item of rows) {
    const url = buildTrackingUrl(item.id, chatId);
    text += `• <b>${escapeHtml(item.channel_title)}</b>\n<a href="${url}">${escapeHtml(item.title)}</a>\n\n`;
  }
  return text;
}

async function resolvePendingChannels(
  category: ChannelCategory,
): Promise<void> {
  const channels = await listYoutubeChannels(true, category);
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
        await upsertYoutubeChannel({
          channel_id: info.channelId,
          handle: info.handle,
          title: info.title,
          uploads_playlist_id: info.uploadsPlaylistId,
          is_active: true,
          category,
        });
        await upsertYoutubeChannel({
          channel_id: ch.channel_id,
          handle: ch.handle,
          title: ch.title,
          uploads_playlist_id: "resolved",
          is_active: false,
          category,
        });
      } else {
        await upsertYoutubeChannel({
          channel_id: info.channelId,
          handle: info.handle,
          title: info.title,
          uploads_playlist_id: info.uploadsPlaylistId,
          is_active: true,
          category,
        });
      }
      console.log(
        `Resolved YouTube channel: ${info.title} (${info.channelId}) [${category}]`,
      );
    } catch (err) {
      console.error(`Failed to resolve channel ${ch.channel_id}:`, err);
    }
  }
}

async function fetchAndStoreUploads(
  kind: ContentKind,
): Promise<UsefulContentRow[]> {
  await resolvePendingChannels(kind.category);
  const channels = await listYoutubeChannels(true, kind.category);
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
      const inserted = await insertUsefulContent(videos, kind.category);
      all.push(...inserted);
    } catch (err) {
      console.error(`Failed to fetch uploads for ${ch.title}:`, err);
    }
  }
  return all;
}

async function sendContentToChat(
  bot: Bot,
  chatId: number,
  lang: Lang,
  kind: ContentKind,
): Promise<boolean> {
  await fetchAndStoreUploads(kind);
  const rows = await pickUsefulContentForDelivery(
    MAX_PER_DELIVERY,
    kind.category,
  );
  if (rows.length === 0) return false;

  const text = buildMessage(rows, chatId, lang, kind);
  await bot.api.sendMessage(chatId, text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: false },
  });

  await incrementUsefulContentSent(rows.map((r) => r.id));
  await pruneExhaustedUsefulContent(kind.category);
  await pruneOldUsefulContent(kind.category);
  return true;
}

async function sendDailyContent(bot: Bot, kind: ContentKind): Promise<number> {
  await fetchAndStoreUploads(kind);
  const [rows, groups] = await Promise.all([
    pickUsefulContentForDelivery(MAX_PER_DELIVERY, kind.category),
    getGroupsWithFeatureEnabled(kind.feature),
  ]);
  if (rows.length === 0 || groups.length === 0) return 0;

  for (const group of groups) {
    const lang = (group.language as Lang) || "uz";
    const text = buildMessage(rows, group.chatId, lang, kind);
    try {
      await bot.api.sendMessage(group.chatId, text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
      });
    } catch (err) {
      console.error(
        `Failed to send ${kind.logLabel} to ${group.chatId}:`,
        err,
      );
    }
  }

  await incrementUsefulContentSent(rows.map((r) => r.id));
  await pruneExhaustedUsefulContent(kind.category);
  await pruneOldUsefulContent(kind.category);
  return groups.length;
}

function startScheduler(bot: Bot, kind: ContentKind) {
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

      const targetHours = await kind.getHours();
      if (!targetHours.includes(tashkentHour)) return;

      console.log(
        `Running ${kind.logLabel} job (${String(tashkentHour).padStart(2, "0")}:00 Tashkent)...`,
      );
      const count = await sendDailyContent(bot, kind);
      console.log(`${kind.logLabel} sent to ${count} group(s).`);
    },
    { timezone: TIMEZONE },
  );

  console.log(
    `${kind.logLabel} scheduler started (checks hourly, Tashkent time).`,
  );
}

// ---- Useful content public API ----
export async function sendUsefulContentToChat(
  bot: Bot,
  chatId: number,
  lang: Lang,
): Promise<boolean> {
  return sendContentToChat(bot, chatId, lang, USEFUL);
}

export async function sendDailyUsefulContent(bot: Bot): Promise<number> {
  return sendDailyContent(bot, USEFUL);
}

export function startUsefulContentScheduler(bot: Bot) {
  startScheduler(bot, USEFUL);
}

// ---- English content public API ----
export async function sendEnglishContentToChat(
  bot: Bot,
  chatId: number,
  lang: Lang,
): Promise<boolean> {
  return sendContentToChat(bot, chatId, lang, ENGLISH);
}

export async function sendDailyEnglishContent(bot: Bot): Promise<number> {
  return sendDailyContent(bot, ENGLISH);
}

export function startEnglishContentScheduler(bot: Bot) {
  startScheduler(bot, ENGLISH);
}
