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
 * Runs before weekly aggregation has drained `logs`, so per-user data is
 * available directly from the raw log rows.
 */
export async function getWeeklyActivity(
  chatId: number,
  days: number = 7,
): Promise<UserActionCounts[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from("logs")
    .select("user_id, action_type")
    .eq("chat_id", chatId)
    .gte("created_at", since)
    .not("user_id", "is", null);

  if (error) {
    console.error("logs weekly select error:", error.message);
    return [];
  }

  const map = new Map<number, UserActionCounts>();
  for (const row of data ?? []) {
    const r = row as { user_id: number; action_type: ActionType };
    let entry = map.get(r.user_id);
    if (!entry) {
      entry = {
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
      map.set(r.user_id, entry);
    }
    switch (r.action_type) {
      case "message":           entry.messages++; break;
      case "reply":             entry.replies++; break;
      case "reaction_given":    entry.reactionsGiven++; break;
      case "reaction_received": entry.reactionsReceived++; break;
      case "sticker":           entry.stickers++; break;
      case "voice":             entry.voices++; break;
      case "media":             entry.media++; break;
      case "video_note":        entry.videoNotes++; break;
      case "gif":               entry.gifs++; break;
    }
  }
  return Array.from(map.values());
}

/**
 * Pick the top user in each category. Returns at most 7 winners. A single
 * user can win multiple categories. Users with zero counts in every
 * category are ignored.
 */
export function pickWinners(activity: UserActionCounts[]): WinnerRow[] {
  const fields: [keyof Omit<UserActionCounts, "userId">, LeaderboardCategory][] = [
    ["messages",           "topMessager"],
    ["replies",            "topReplier"],
    ["reactionsGiven",     "topReactionGiver"],
    ["reactionsReceived",  "topReactionReceiver"],
    ["stickers",           "topStickerSender"],
    ["voices",             "topVoiceSender"],
    ["media",              "topMediaSender"],
    ["videoNotes",         "topVideoNoteSender"],
    ["gifs",               "topGifSender"],
  ];

  const winners: WinnerRow[] = [];
  for (const [field, category] of fields) {
    let best: UserActionCounts | null = null;
    for (const u of activity) {
      if ((u[field] as number) > 0 && (!best || (u[field] as number) > (best[field] as number))) {
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

/**
 * Sum across all users for the champion card (rank #1 = top total actions).
 */
export function pickChampion(
  activity: UserActionCounts[],
): UserActionCounts | null {
  if (activity.length === 0) return null;
  let best: UserActionCounts | null = null;
  let bestTotal = 0;
  for (const u of activity) {
    const total =
      u.messages +
      u.replies +
      u.reactionsGiven +
      u.reactionsReceived +
      u.stickers +
      u.voices +
      u.media +
      u.videoNotes +
      u.gifs;
    if (total > bestTotal) {
      bestTotal = total;
      best = u;
    }
  }
  return best;
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
    e.messages          += Number(r.messages           ?? 0);
    e.replies           += Number(r.replies            ?? 0);
    e.reactionsGiven    += Number(r.reactions_given    ?? 0);
    e.reactionsReceived += Number(r.reactions_received ?? 0);
    e.stickers          += Number(r.stickers           ?? 0);
    e.voices            += Number(r.voices             ?? 0);
    e.media             += Number(r.media              ?? 0);
    e.videoNotes        += Number(r.video_notes        ?? 0);
    e.gifs              += Number(r.gifs               ?? 0);
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
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
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
