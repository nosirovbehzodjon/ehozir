import { Bot, InputFile, InlineKeyboard } from "grammy";
import cron from "node-cron";
import {
  renderLeaderboardCard,
  renderStatsCard,
  renderTopTenCard,
  type LeaderboardWinner,
  type TopTenEntry,
} from "@/services/statsCard";
import {
  getWeeklyActivity,
  getMonthlyActivity,
  getYearlyActivity,
  pickWinners,
  pickTopN,
  type UserActionCounts,
} from "@/db/weeklyWinners";
import { listAllGroups, getGroupMembersByIds } from "@/db/groups";
import { getGroupLanguage } from "@/db/settings";
import { insertPendingCard } from "@/db/pendingCards";
import { runAggregation } from "@/db/logs";
import { notifyDevelopers } from "@/utils/notify";
import { translations } from "@/i18n/translations";

export type StatsPeriod = "week" | "month" | "year";

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

function monthLabel(): string {
  // Previous calendar month, e.g. "March 2026"
  const now = new Date();
  const prev = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
  return prev.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function yearLabel(): string {
  // Previous calendar year
  return String(new Date().getUTCFullYear() - 1);
}

function periodLabel(period: StatsPeriod): string {
  if (period === "month") return monthLabel();
  if (period === "year") return yearLabel();
  return weekLabel();
}

async function getActivityForPeriod(
  chatId: number,
  period: StatsPeriod,
): Promise<UserActionCounts[]> {
  if (period === "month") return getMonthlyActivity(chatId);
  if (period === "year") return getYearlyActivity(chatId);
  return getWeeklyActivity(chatId, 7);
}

function captionForPeriod(lang: "uz" | "ru" | "en", period: StatsPeriod, bot: string): string {
  const t = translations[lang].statsCard;
  if (period === "month") return t.monthlyCaption(bot);
  if (period === "year") return t.yearlyCaption(bot);
  return t.weeklyCaption(bot);
}

/**
 * Render + upload one group's weekly package, send it to each developer
 * with Approve/Reject buttons, and record a pending row for each.
 */
async function processGroup(
  bot: Bot,
  chat: { chat_id: number; title: string | null },
  period: StatsPeriod = "week",
): Promise<void> {
  const activity = await getActivityForPeriod(chat.chat_id, period);
  if (activity.length === 0) {
    console.log(`[${period}Stats] ${chat.chat_id} — no activity, skipped`);
    return;
  }

  const winners = pickWinners(activity);
  const topTen = pickTopN(activity, 10);
  const topThree = topTen.slice(0, 3);
  if (winners.length === 0 || topThree.length === 0) return;

  const lang = await getGroupLanguage(chat.chat_id);
  const groupTitle = chat.title || `Group ${chat.chat_id}`;
  const label = periodLabel(period);

  // Dedupe user IDs across winners + top10 (heavy overlap) and resolve
  // members in one batched DB call + avatars once per unique user.
  // Fixes RISK 3.1 (N+1 member lookup + duplicate avatar fetches).
  const uniqueUserIds = [
    ...new Set([
      ...winners.map((w) => w.userId),
      ...topTen.map((u) => u.userId),
    ]),
  ];

  const members = await getGroupMembersByIds(chat.chat_id, uniqueUserIds);
  const memberById = new Map(members.map((m) => [m.user_id, m]));

  const avatarList = await Promise.all(
    uniqueUserIds.map((id) => getUserAvatar(bot, id)),
  );
  const avatarById = new Map(
    uniqueUserIds.map((id, i) => [id, avatarList[i]]),
  );

  const resolvedWinners: LeaderboardWinner[] = winners.map((w) => {
    const member = memberById.get(w.userId);
    return {
      category: w.category,
      fullName: member ? fullName(member) : `User ${w.userId}`,
      avatarUrl: avatarById.get(w.userId) ?? pickFallbackAvatar(),
      count: w.count,
    };
  });

  const resolvedTopTen = topTen.map((user) => {
    const member = memberById.get(user.userId);
    return {
      user,
      name: member ? fullName(member) : `User ${user.userId}`,
      username: member?.username ?? undefined,
      avatarUrl: avatarById.get(user.userId) ?? pickFallbackAvatar(),
    };
  });
  const resolvedTop = resolvedTopTen.slice(0, 3);

  const topTenEntries: TopTenEntry[] = resolvedTopTen.map((r) => ({
    fullName: r.name,
    avatarUrl: r.avatarUrl,
    total:
      r.user.messages +
      r.user.replies +
      r.user.reactionsGiven +
      r.user.reactionsReceived +
      r.user.stickers +
      r.user.voices +
      r.user.media +
      r.user.videoNotes +
      r.user.gifs,
  }));

  // Render leaderboard + top10 + up to 3 podium cards in parallel.
  const [leaderboardPng, topTenPng, ...podiumPngs] = await Promise.all([
    renderLeaderboardCard({
      lang,
      period,
      groupTitle,
      weekLabel: label,
      winners: resolvedWinners,
      botUsername: bot.botInfo?.username,
    }),
    renderTopTenCard({
      lang,
      period,
      groupTitle,
      weekLabel: label,
      entries: topTenEntries,
      botUsername: bot.botInfo?.username,
    }),
    ...resolvedTop.map((r, i) =>
      renderStatsCard({
        lang,
        period,
        groupTitle,
        fullName: r.name,
        username: r.username,
        avatarUrl: r.avatarUrl,
        rank: i + 1,
        weekLabel: label,
        botUsername: bot.botInfo?.username,
        stats: {
          messages: r.user.messages,
          replies: r.user.replies,
          reactionsGiven: r.user.reactionsGiven,
          reactionsReceived: r.user.reactionsReceived,
          stickers: r.user.stickers,
          voices: r.user.voices,
          media: r.user.media,
          videoNotes: r.user.videoNotes,
          gifs: r.user.gifs,
        },
      }),
    ),
  ]);
  const championPng = podiumPngs[0];
  const silverPng = podiumPngs[1];
  const bronzePng = podiumPngs[2];

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
  const groupCaption = captionForPeriod(lang, period, botUsername);

  const uploadPng = async (
    png: Buffer | undefined,
    filename: string,
    caption: string,
  ): Promise<string | null> => {
    if (!png) return null;
    const msg = await bot.api.sendPhoto(
      firstDev,
      new InputFile(png, filename),
      { caption },
    );
    return msg.photo?.[msg.photo.length - 1]?.file_id ?? null;
  };

  const leaderboardFileId = await uploadPng(
    leaderboardPng,
    "leaderboard.png",
    `Preview · ${groupTitle} (leaderboard)`,
  );
  const championFileId = await uploadPng(
    championPng,
    "champion.png",
    `Preview · ${groupTitle} (gold #1)`,
  );
  const silverFileId = await uploadPng(
    silverPng,
    "silver.png",
    `Preview · ${groupTitle} (silver #2)`,
  );
  const bronzeFileId = await uploadPng(
    bronzePng,
    "bronze.png",
    `Preview · ${groupTitle} (bronze #3)`,
  );
  const topTenFileId = await uploadPng(
    topTenPng,
    "top10.png",
    `Preview · ${groupTitle} (top 10)`,
  );

  const pendingId = await insertPendingCard({
    chat_id: chat.chat_id,
    leaderboard_file_id: leaderboardFileId,
    champion_file_id: championFileId,
    silver_file_id: silverFileId,
    bronze_file_id: bronzeFileId,
    top_ten_file_id: topTenFileId,
    caption: groupCaption,
    period,
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
        `Approve ${period}ly cards for <b>${escapeHtml(groupTitle)}</b>?`,
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

export async function runStatsNow(
  bot: Bot,
  period: StatsPeriod = "week",
  chatId?: number,
): Promise<void> {
  // Monthly/yearly need aggregate tables populated before reading. Weekly
  // reads raw logs and needs no pre-aggregation.
  if (period === "month") {
    await runAggregation("weekly");
    await runAggregation("monthly");
  } else if (period === "year") {
    await runAggregation("weekly");
    await runAggregation("monthly");
    await runAggregation("yearly");
  }

  const allGroups = await listAllGroups();
  const groups =
    chatId !== undefined
      ? allGroups.filter((g) => g.chat_id === chatId)
      : allGroups;

  if (chatId !== undefined && groups.length === 0) {
    throw new Error(`group ${chatId} not found`);
  }

  console.log(
    `[${period}Stats] processing ${groups.length} group(s)${chatId !== undefined ? ` (filtered to ${chatId})` : ""}`,
  );
  for (const g of groups) {
    try {
      await processGroup(bot, g, period);
    } catch (err) {
      console.error(`[${period}Stats] group ${g.chat_id} failed:`, err);
      await notifyDevelopers(
        `${period}Stats failed for ${g.chat_id}: ${(err as Error).message}`,
      );
    }
  }
}

export async function runWeeklyStatsNow(
  bot: Bot,
  chatId?: number,
): Promise<void> {
  return runStatsNow(bot, "week", chatId);
}

export async function runMonthlyStatsNow(
  bot: Bot,
  chatId?: number,
): Promise<void> {
  return runStatsNow(bot, "month", chatId);
}

export async function runYearlyStatsNow(
  bot: Bot,
  chatId?: number,
): Promise<void> {
  return runStatsNow(bot, "year", chatId);
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

export function startMonthlyStatsScheduler(bot: Bot): void {
  // 1st of month, 04:00 Tashkent — after weekly job window, early enough
  // that pg_cron's own monthly roll-up (05:15 Tashkent) has not yet drained
  // the previous month's rows from monthly_stats.
  cron.schedule(
    "0 4 1 * *",
    () => {
      runMonthlyStatsNow(bot).catch((err) =>
        console.error("[monthlyStats] scheduler run failed:", err),
      );
    },
    { timezone: "Asia/Tashkent" },
  );
  console.log("[monthlyStats] scheduler started (1st 04:00 Asia/Tashkent)");
}

export function startYearlyStatsScheduler(bot: Bot): void {
  // Jan 1, 05:00 Tashkent — after the monthly job so the prior year's
  // December rows have been rolled up into yearly_stats.
  cron.schedule(
    "0 5 1 1 *",
    () => {
      runYearlyStatsNow(bot).catch((err) =>
        console.error("[yearlyStats] scheduler run failed:", err),
      );
    },
    { timezone: "Asia/Tashkent" },
  );
  console.log("[yearlyStats] scheduler started (Jan 1 05:00 Asia/Tashkent)");
}
