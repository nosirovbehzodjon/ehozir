import { supabase } from "@/db/client";

export async function getGroupSetting(
  chatId: number,
  feature: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("group_settings")
    .select("enabled")
    .eq("chat_id", chatId)
    .eq("feature", feature)
    .maybeSingle();

  if (error) {
    console.error("group_settings select error:", error.message);
    return null;
  }
  return data?.enabled ?? null;
}

export async function setGroupSetting(
  chatId: number,
  feature: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase.from("group_settings").upsert(
    {
      chat_id: chatId,
      feature,
      enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id,feature" },
  );

  if (error) {
    console.error("group_settings upsert error:", error.message);
  }
}
