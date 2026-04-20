import { supabase } from "./client";

export type PendingBanStatus = "pending" | "approved" | "rejected" | "expired";

export type AdminNotification = {
  admin_id: number;
  message_id: number;
};

export type PendingBanRow = {
  id: number;
  user_id: number;
  chat_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  reason: string;
  category: string;
  confidence: number;
  message_id: number | null;
  reaction_message_id: number | null;
  group_title: string | null;
  admin_notifications: AdminNotification[];
  status: PendingBanStatus;
  resolved_by: number | null;
  resolved_at: string | null;
  created_at: string;
};

export type CreatePendingBanInput = {
  userId: number;
  chatId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  reason: string;
  category: string;
  confidence: number;
  messageId: number | null;
  reactionMessageId: number | null;
  groupTitle: string | null;
};

/**
 * Creates a pending ban row. Returns the row on success, or null if a pending
 * row already exists for (chat_id, user_id) — the partial unique index raises
 * a 23505 conflict which we treat as "already pending, nothing to do".
 */
export async function createPendingBan(
  input: CreatePendingBanInput,
): Promise<PendingBanRow | null> {
  const { data, error } = await supabase
    .from("pending_nsfw_bans")
    .insert({
      user_id: input.userId,
      chat_id: input.chatId,
      username: input.username,
      first_name: input.firstName,
      last_name: input.lastName,
      reason: input.reason,
      category: input.category,
      confidence: input.confidence,
      message_id: input.messageId,
      reaction_message_id: input.reactionMessageId,
      group_title: input.groupTitle,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") return null;
    console.error("pending_nsfw_bans insert error:", error.message);
    return null;
  }
  return (data as PendingBanRow) ?? null;
}

export async function setAdminNotifications(
  id: number,
  notifications: AdminNotification[],
): Promise<void> {
  const { error } = await supabase
    .from("pending_nsfw_bans")
    .update({ admin_notifications: notifications })
    .eq("id", id);
  if (error) {
    console.error("pending_nsfw_bans update notifications error:", error.message);
  }
}

export async function getPendingBan(id: number): Promise<PendingBanRow | null> {
  const { data, error } = await supabase
    .from("pending_nsfw_bans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("pending_nsfw_bans select error:", error.message);
    return null;
  }
  return (data as PendingBanRow) ?? null;
}

/**
 * Atomically transitions a row from 'pending' to the given status. Returns the
 * updated row if this caller won the race, null if someone else already
 * resolved it (or if the id doesn't exist).
 */
export async function resolvePendingBan(
  id: number,
  status: Exclude<PendingBanStatus, "pending">,
  resolvedBy: number | null,
): Promise<PendingBanRow | null> {
  const { data, error } = await supabase
    .from("pending_nsfw_bans")
    .update({
      status,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("pending_nsfw_bans resolve error:", error.message);
    return null;
  }
  return (data as PendingBanRow) ?? null;
}

/**
 * Returns all rows still in 'pending' status older than the given timestamp.
 * Used by the expiry scheduler.
 */
export async function getExpiredPendingBans(
  olderThan: Date,
): Promise<PendingBanRow[]> {
  const { data, error } = await supabase
    .from("pending_nsfw_bans")
    .select("*")
    .eq("status", "pending")
    .lt("created_at", olderThan.toISOString());

  if (error) {
    console.error("pending_nsfw_bans expired select error:", error.message);
    return [];
  }
  return (data ?? []) as PendingBanRow[];
}
