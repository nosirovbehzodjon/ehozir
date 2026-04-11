import { supabase } from "./client";

export async function getBotSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("bot_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error("bot_settings select error:", error.message);
    return null;
  }
  return data?.value ?? null;
}

export async function setBotSetting(
  key: string,
  value: string,
): Promise<void> {
  const { error } = await supabase.from("bot_settings").upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    console.error("bot_settings upsert error:", error.message);
  }
}

export async function getNewsHour(): Promise<number> {
  const value = await getBotSetting("news_hour");
  const hour = value ? parseInt(value, 10) : 9;
  return isNaN(hour) ? 9 : hour;
}

export async function setNewsHour(hour: number): Promise<void> {
  await setBotSetting("news_hour", String(hour));
}

export async function getNewsHours(): Promise<number[]> {
  const value = await getBotSetting("news_hours");
  if (!value) {
    // Fallback to legacy single news_hour
    const legacy = await getNewsHour();
    return [legacy];
  }
  return value
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((h) => !isNaN(h) && h >= 0 && h <= 23);
}

export async function setNewsHours(hours: number[]): Promise<void> {
  const sorted = [...hours].sort((a, b) => a - b);
  await setBotSetting("news_hours", sorted.join(","));
}
