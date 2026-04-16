import { supabase } from "./client";
import type { ActionType } from "./logs";
import type { LeaderboardCategory } from "@/services/statsCard";

export type UserActionCounts = {
  userId: number;
  messages: number;
  replies: number;
  reactionsGiven: number;
  reactionsReceived: number;
  stickers: number;
  voices: number;
  media: number;
  videoNotes: number;
  gifs: number;
};

export type WinnerRow = {
  category: LeaderboardCategory;
  userId: number;
  count: number;
};

const ACTION_TO_CATEGORY: Record<ActionType, LeaderboardCategory | null> = {
  message: "topMessager",
  reply: "topReplier",
  reaction_given: "topReactionGiver",
  reaction_received: "topReactionReceiver",
  sticker: "topStickerSender",
  voice: "topVoiceSender",
  media: "topMediaSender",
  video_note: "topVideoNoteSender",
  gif: "topGifSender",
};

/**
 * Pull last-7-days activity for a chat, grouped by user and action.
 * Uses a Postgres RPC that does GROUP BY on the server — returns tens of
 * rows (users x action_types) instead of thousands of raw log rows.
 */
export async function getWeeklyActivity(
  chatId: number,
  days: number = 7,
): Promise<UserActionCounts[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // The RPC now pivots counts server-side, returning one row per user
  // instead of (users x action_types) rows — avoids PostgREST's 1000-row cap.
  const { data, error } = await supabase.rpc("get_weekly_action_counts", {
    p_chat_id: chatId,
    p_since: since,
  });

  if (error) {
    console.error("get_weekly_action_counts rpc error:", error.message);
    return [];
  }

  type PivotedRow = {
    user_id: number;
    messages: number;
    replies: number;
    reactions_given: number;
    reactions_received: number;
    stickers: number;
    voices: number;
    media: number;
    video_notes: number;
    gifs: number;
  };

  return ((data ?? []) as PivotedRow[]).map((r) => ({
    userId: r.user_id,
    messages: Number(r.messages ?? 0),
    replies: Number(r.replies ?? 0),
    reactionsGiven: Number(r.reactions_given ?? 0),
    reactionsReceived: Number(r.reactions_received ?? 0),
    stickers: Number(r.stickers ?? 0),
    voices: Number(r.voices ?? 0),
    media: Number(r.media ?? 0),
    videoNotes: Number(r.video_notes ?? 0),
    gifs: Number(r.gifs ?? 0),
  }));
}

/**
 * Pick the top user in each category. Returns at most 7 winners. A single
 * user can win multiple categories. Users with zero counts in every
 * category are ignored.
 */
export function pickWinners(activity: UserActionCounts[]): WinnerRow[] {
  const fields: [
    keyof Omit<UserActionCounts, "userId">,
    LeaderboardCategory,
  ][] = [
    ["messages", "topMessager"],
    ["replies", "topReplier"],
    ["reactionsGiven", "topReactionGiver"],
    ["reactionsReceived", "topReactionReceiver"],
    ["stickers", "topStickerSender"],
    ["voices", "topVoiceSender"],
    ["media", "topMediaSender"],
    ["videoNotes", "topVideoNoteSender"],
    ["gifs", "topGifSender"],
  ];

  const winners: WinnerRow[] = [];
  for (const [field, category] of fields) {
    let best: UserActionCounts | null = null;
    for (const u of activity) {
      if (
        (u[field] as number) > 0 &&
        (!best || (u[field] as number) > (best[field] as number))
      ) {
        best = u;
      }
    }
    if (best) {
      winners.push({
        category,
        userId: best.userId,
        count: best[field] as number,
      });
    }
  }
  return winners;
}

function totalActions(u: UserActionCounts): number {
  return (
    u.messages +
    u.replies +
    u.reactionsGiven +
    u.reactionsReceived +
    u.stickers +
    u.voices +
    u.media +
    u.videoNotes +
    u.gifs
  );
}

/**
 * Sum across all users for the champion card (rank #1 = top total actions).
 */
export function pickChampion(
  activity: UserActionCounts[],
): UserActionCounts | null {
  const top = pickTopN(activity, 1);
  return top[0] ?? null;
}

/**
 * Top N users by total actions, sorted descending. Users with zero total
 * are excluded.
 */
export function pickTopN(
  activity: UserActionCounts[],
  n: number,
): UserActionCounts[] {
  return activity
    .map((u) => ({ u, t: totalActions(u) }))
    .filter(({ t }) => t > 0)
    .sort((a, b) => b.t - a.t)
    .slice(0, n)
    .map(({ u }) => u);
}

type StatRow = {
  user_id: number;
  messages: number | null;
  replies: number | null;
  reactions_given: number | null;
  reactions_received: number | null;
  stickers: number | null;
  voices: number | null;
  media: number | null;
  video_notes: number | null;
  gifs: number | null;
  period_start: string;
};

function rowsToUserCounts(rows: StatRow[]): UserActionCounts[] {
  const map = new Map<number, UserActionCounts>();
  for (const r of rows) {
    let e = map.get(r.user_id);
    if (!e) {
      e = {
        userId: r.user_id,
        messages: 0,
        replies: 0,
        reactionsGiven: 0,
        reactionsReceived: 0,
        stickers: 0,
        voices: 0,
        media: 0,
        videoNotes: 0,
        gifs: 0,
      };
      map.set(r.user_id, e);
    }
    e.messages += Number(r.messages ?? 0);
    e.replies += Number(r.replies ?? 0);
    e.reactionsGiven += Number(r.reactions_given ?? 0);
    e.reactionsReceived += Number(r.reactions_received ?? 0);
    e.stickers += Number(r.stickers ?? 0);
    e.voices += Number(r.voices ?? 0);
    e.media += Number(r.media ?? 0);
    e.videoNotes += Number(r.video_notes ?? 0);
    e.gifs += Number(r.gifs ?? 0);
  }
  return Array.from(map.values());
}

/**
 * Pull per-user activity for a chat across a date range from the given
 * aggregate table. `start` inclusive, `end` exclusive, both ISO YYYY-MM-DD.
 */
async function getActivityFromTable(
  table: "weekly_stats" | "monthly_stats" | "yearly_stats",
  chatId: number,
  start: string,
  end: string,
): Promise<UserActionCounts[]> {
  const { data, error } = await supabase
    .from(table)
    .select(
      "user_id, messages, replies, reactions_given, reactions_received, stickers, voices, media, video_notes, gifs, period_start",
    )
    .eq("chat_id", chatId)
    .gte("period_start", start)
    .lt("period_start", end);

  if (error) {
    console.error(`${table} select error:`, error.message);
    return [];
  }
  return rowsToUserCounts((data ?? []) as StatRow[]);
}

/**
 * Previous calendar month's per-user activity, sourced from `monthly_stats`
 * (populated by `aggregate_monthly_stats` which rolls up `weekly_stats`).
 */
export async function getMonthlyActivity(
  chatId: number,
): Promise<UserActionCounts[]> {
  const now = new Date();
  const thisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const prevMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return getActivityFromTable(
    "monthly_stats",
    chatId,
    prevMonth.toISOString().slice(0, 10),
    thisMonth.toISOString().slice(0, 10),
  );
}

/**
 * Previous calendar year's per-user activity, sourced from `yearly_stats`
 * (populated by `aggregate_yearly_stats` which rolls up `monthly_stats`).
 */
export async function getYearlyActivity(
  chatId: number,
): Promise<UserActionCounts[]> {
  const now = new Date();
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const prevYear = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  return getActivityFromTable(
    "yearly_stats",
    chatId,
    prevYear.toISOString().slice(0, 10),
    thisYear.toISOString().slice(0, 10),
  );
}

// re-export ACTION_TO_CATEGORY in case callers need it
export { ACTION_TO_CATEGORY };
