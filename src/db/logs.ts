import { supabase } from "./client";

export type ActionType =
  | "message"
  | "reaction_given"
  | "reaction_received"
  | "reply"
  | "sticker"
  | "voice"
  | "media";

export type LogEntry = {
  chat_id: number;
  user_id: number | null;
  action_type: ActionType;
};

export async function logAction(entry: LogEntry): Promise<void> {
  const { error } = await supabase.from("logs").insert(entry);
  if (error) console.error("logs insert error:", error.message);
}

export async function logActions(entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await supabase.from("logs").insert(entries);
  if (error) console.error("logs batch insert error:", error.message);
}

/**
 * Manually trigger an aggregation tier. pg_cron runs these on schedule, but
 * this lets the bot (or a developer command) kick one off on demand.
 */
export async function runAggregation(
  tier: "weekly" | "monthly" | "yearly",
): Promise<void> {
  const fn = `aggregate_${tier}_stats`;
  const { error } = await supabase.rpc(fn);
  if (error) console.error(`${fn} rpc error:`, error.message);
}
