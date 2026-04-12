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
      u.media;
    if (total > bestTotal) {
      bestTotal = total;
      best = u;
    }
  }
  return best;
}

// re-export ACTION_TO_CATEGORY in case callers need it
export { ACTION_TO_CATEGORY };
