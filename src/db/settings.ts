import { supabase } from "@/db/client";
import { type Lang, DEFAULT_LANG } from "@/i18n/translations";

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

export async function isFeatureEnabled(
  chatId: number,
  feature: string,
  defaultValue = true,
): Promise<boolean> {
  const setting = await getGroupSetting(chatId, feature);
  if (setting === null) return defaultValue;
  return setting;
}

export async function getGroupLanguage(chatId: number): Promise<Lang> {
  const { data, error } = await supabase
    .from("groups")
    .select("language")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) {
    console.error("groups language select error:", error.message);
    return DEFAULT_LANG;
  }
  const lang = data?.language;
  if (lang === "uz" || lang === "ru" || lang === "en") return lang;
  return DEFAULT_LANG;
}

export async function setGroupLanguage(
  chatId: number,
  language: Lang,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ language, updated_at: new Date().toISOString() })
    .eq("chat_id", chatId);

  if (error) {
    console.error("groups language update error:", error.message);
  }
}
