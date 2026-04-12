import { Bot, InputFile, InlineKeyboard } from "grammy";
import cron from "node-cron";
import {
  renderLeaderboardCard,
  renderStatsCard,
  type LeaderboardWinner,
} from "@/services/statsCard";
import {
  getWeeklyActivity,
  pickWinners,
  pickChampion,
} from "@/db/weeklyWinners";
import { listAllGroups, getGroupMember } from "@/db/groups";
import { getGroupLanguage } from "@/db/settings";
import { insertPendingCard } from "@/db/pendingCards";
import { notifyDevelopers } from "@/utils/notify";
import { translations } from "@/i18n/translations";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

const FALLBACK_AVATARS = [
  "https://api.dicebear.com/9.x/adventurer-neutral/png?flip=false&size=240&seed=Aneka",
  "https://api.dicebear.com/9.x/adventurer-neutral/png?seed=Felix&size=240",
];

function pickFallbackAvatar(): string {
  return FALLBACK_AVATARS[Math.floor(Math.random() * FALLBACK_AVATARS.length)];
}

async function getUserAvatar(bot: Bot, userId: number): Promise<string> {
  try {
    const photos = await bot.api.getUserProfilePhotos(userId, { limit: 1 });
    if (photos.total_count > 0) {
      const file = await bot.api.getFile(photos.photos[0][0].file_id);
      return `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    }
  } catch {}
  return pickFallbackAvatar();
}

function fullName(m: {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}): string {
  const n = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  return n || m.username || "Unknown";
}

function weekLabel(): string {
  const now = new Date();
  const end = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  const startDate = new Date(now.getTime() - 6 * 86400000);
  const start = startDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  return `${start} – ${end}`;
}

/**
 * Render + upload one group's weekly package, send it to each developer
 * with Approve/Reject buttons, and record a pending row for each.
 */
async function processGroup(
  bot: Bot,
  chat: { chat_id: number; title: string | null },
): Promise<void> {
  const activity = await getWeeklyActivity(chat.chat_id, 7);
  if (activity.length === 0) {
    console.log(`[weeklyStats] ${chat.chat_id} — no activity, skipped`);
    return;
  }

  const winners = pickWinners(activity);
  const champion = pickChampion(activity);
  if (winners.length === 0 || !champion) return;

  const lang = await getGroupLanguage(chat.chat_id);
  const groupTitle = chat.title || `Group ${chat.chat_id}`;
  const label = weekLabel();

  // Resolve winner names + avatars for leaderboard.
  const resolvedWinners: LeaderboardWinner[] = await Promise.all(
    winners.map(async (w) => {
      const member = await getGroupMember(chat.chat_id, w.userId);
      const name = member ? fullName(member) : `User ${w.userId}`;
      const avatarUrl = await getUserAvatar(bot, w.userId);
      return {
        category: w.category,
        fullName: name,
        avatarUrl,
        count: w.count,
      };
    }),
  );

  // Champion data.
  const championMember = await getGroupMember(chat.chat_id, champion.userId);
  const championName = championMember
    ? fullName(championMember)
    : `User ${champion.userId}`;
  const championUsername = championMember?.username ?? undefined;
  const championAvatar = await getUserAvatar(bot, champion.userId);

  // Render both cards.
  const [leaderboardPng, championPng] = await Promise.all([
    renderLeaderboardCard({
      lang,
      groupTitle,
      weekLabel: label,
      winners: resolvedWinners,
    }),
    renderStatsCard({
      lang,
      groupTitle,
      fullName: championName,
      username: championUsername,
      avatarUrl: championAvatar,
      rank: 1,
      weekLabel: label,
      stats: {
        messages: champion.messages,
        replies: champion.replies,
        reactionsGiven: champion.reactionsGiven,
        reactionsReceived: champion.reactionsReceived,
        stickers: champion.stickers,
        voices: champion.voices,
        media: champion.media,
      },
    }),
  ]);

  // Upload once to the first developer — Telegram returns a file_id we can
  // reuse to deliver to the group later without re-uploading.
  if (DEVELOPER_IDS.length === 0) {
    console.warn("[weeklyStats] no DEVELOPER_IDS set, cannot request approval");
    return;
  }

  const firstDev = DEVELOPER_IDS[0];

  // Localized caption that the approved group post will carry. Includes a
  // @bot_username mention so readers can add the bot to their own groups,
  // and asks for admin rights so reaction stats become available.
  const botUsername = (bot.botInfo?.username ?? "").replace(/^@/, "");
  const groupCaption = translations[lang].statsCard.weeklyCaption(botUsername);

  const leaderboardMsg = await bot.api.sendPhoto(
    firstDev,
    new InputFile(leaderboardPng, "leaderboard.png"),
    { caption: `Preview · ${groupTitle} (leaderboard)` },
  );
  const championMsg = await bot.api.sendPhoto(
    firstDev,
    new InputFile(championPng, "champion.png"),
    { caption: `Preview · ${groupTitle} (champion)` },
  );

  const leaderboardFileId =
    leaderboardMsg.photo?.[leaderboardMsg.photo.length - 1]?.file_id ?? null;
  const championFileId =
    championMsg.photo?.[championMsg.photo.length - 1]?.file_id ?? null;

  const pendingId = await insertPendingCard({
    chat_id: chat.chat_id,
    leaderboard_file_id: leaderboardFileId,
    champion_file_id: championFileId,
    caption: groupCaption,
  });

  if (pendingId === null) return;

  const kb = new InlineKeyboard()
    .text("Approve", `wkly_ok:${pendingId}`)
    .text("Reject", `wkly_no:${pendingId}`);

  // Send approval prompt to every developer.
  for (const devId of DEVELOPER_IDS) {
    try {
      await bot.api.sendMessage(
        devId,
        `Approve weekly cards for <b>${escapeHtml(groupTitle)}</b>?`,
        { parse_mode: "HTML", reply_markup: kb },
      );
    } catch (err) {
      console.error(`[weeklyStats] failed to prompt dev ${devId}:`, err);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function runWeeklyStatsNow(bot: Bot): Promise<void> {
  const groups = await listAllGroups();
  console.log(`[weeklyStats] processing ${groups.length} groups`);
  for (const g of groups) {
    try {
      await processGroup(bot, g);
    } catch (err) {
      console.error(`[weeklyStats] group ${g.chat_id} failed:`, err);
      await notifyDevelopers(
        `weeklyStats failed for ${g.chat_id}: ${(err as Error).message}`,
      );
    }
  }
}

export function startWeeklyStatsScheduler(bot: Bot): void {
  // Monday 03:00 Tashkent — uses a rolling 7-day window, so exact week
  // boundaries don't matter.
  cron.schedule(
    "0 3 * * 1",
    () => {
      runWeeklyStatsNow(bot).catch((err) =>
        console.error("[weeklyStats] scheduler run failed:", err),
      );
    },
    { timezone: "Asia/Tashkent" },
  );
  console.log("[weeklyStats] scheduler started (Mon 03:00 Asia/Tashkent)");
}
