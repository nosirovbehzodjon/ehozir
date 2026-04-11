import { supabase } from "./client";

export type SensitiveProfileRow = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  reason: string;
  category: string;
  confidence: number;
  detected_in_chat_id: number | null;
  created_at: string;
};

export async function isKnownSensitiveUser(
  userId: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sensitive_profile_log")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("sensitive_profile_log select error:", error.message);
    return false;
  }
  return data !== null;
}

export async function logSensitiveProfile(entry: {
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  reason: string;
  category: string;
  confidence: number;
  detectedInChatId: number | null;
}): Promise<void> {
  const { error } = await supabase.from("sensitive_profile_log").upsert(
    {
      user_id: entry.userId,
      username: entry.username,
      first_name: entry.firstName,
      last_name: entry.lastName,
      reason: entry.reason,
      category: entry.category,
      confidence: entry.confidence,
      detected_in_chat_id: entry.detectedInChatId,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("sensitive_profile_log upsert error:", error.message);
  }
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function wasRecentlyChecked(userId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from("nsfw_check_log")
    .select("checked_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("nsfw_check_log select error:", error.message);
    return false;
  }
  if (!data) return false;

  const checkedAt = new Date(data.checked_at).getTime();
  return Date.now() - checkedAt < CHECK_INTERVAL_MS;
}

export async function markAsChecked(userId: number): Promise<void> {
  const { error } = await supabase.from("nsfw_check_log").upsert(
    {
      user_id: userId,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("nsfw_check_log upsert error:", error.message);
  }
}
