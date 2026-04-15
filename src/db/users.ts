import { supabase } from "@/db/client";
import { type Lang, DEFAULT_LANG } from "@/i18n/translations";

export type BotUser = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language: Lang;
  points: number;
};

type TelegramUserLike = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export async function upsertUser(user: TelegramUserLike): Promise<void> {
  const { error } = await supabase.from("users").upsert(
    {
      user_id: user.id,
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: false },
  );
  if (error) console.error("users upsert error:", error.message);
}

export async function getUser(userId: number): Promise<BotUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, username, first_name, last_name, language, points")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("users select error:", error.message);
    return null;
  }
  if (!data) return null;
  const lang =
    data.language === "uz" || data.language === "ru" || data.language === "en"
      ? (data.language as Lang)
      : DEFAULT_LANG;
  return { ...data, language: lang } as BotUser;
}

export async function setUserLanguage(
  userId: number,
  language: Lang,
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ language, last_seen: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) console.error("users language update error:", error.message);
}

/**
 * Awards invite points when a user adds the bot to a group. Idempotent per
 * (user, chat): the unique row in user_group_invites guarantees we never
 * double-credit the same pairing even if the bot is removed and re-added.
 *
 * Returns the number of points awarded (0 if already credited for this chat).
 */
export async function awardInvitePoints(
  userId: number,
  chatId: number,
  points: number,
): Promise<number> {
  const { data, error } = await supabase
    .from("user_group_invites")
    .insert({ user_id: userId, chat_id: chatId, points_awarded: points })
    .select("user_id")
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") return 0;
    console.error("user_group_invites insert error:", error.message);
    return 0;
  }
  if (!data) return 0;

  const { error: rpcError } = await supabase.rpc("increment_user_points", {
    p_user_id: userId,
    p_delta: points,
  });
  if (rpcError) {
    console.error("increment_user_points error:", rpcError.message);
  }
  return points;
}
