import { supabase } from "./client";

export type PendingCardStatus = "pending" | "approved" | "rejected";

export type PendingCardRow = {
  id: number;
  chat_id: number;
  leaderboard_file_id: string | null;
  champion_file_id: string | null;
  caption: string | null;
  status: PendingCardStatus;
  created_at: string;
  decided_at: string | null;
};

export async function insertPendingCard(
  row: Omit<PendingCardRow, "id" | "status" | "created_at" | "decided_at">,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("pending_weekly_cards")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("pending_weekly_cards insert error:", error.message);
    return null;
  }
  return data.id;
}

export async function getPendingCard(id: number): Promise<PendingCardRow | null> {
  const { data, error } = await supabase
    .from("pending_weekly_cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("pending_weekly_cards select error:", error.message);
    return null;
  }
  return data;
}

export async function updatePendingStatus(
  id: number,
  status: PendingCardStatus,
): Promise<void> {
  const { error } = await supabase
    .from("pending_weekly_cards")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error)
    console.error("pending_weekly_cards update error:", error.message);
}
