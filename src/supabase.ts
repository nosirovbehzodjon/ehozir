import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Chat, User } from "grammy/types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env",
  );
  process.exit(1);
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type GroupMemberRow = {
  chat_id: number;
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_bot: boolean;
  language_code: string | null;
};

export async function upsertGroupAndMember(
  chat: Chat,
  user: User,
): Promise<void> {
  if (chat.type !== "group" && chat.type !== "supergroup") return;

  const now = new Date().toISOString();

  const groupRow = {
    chat_id: chat.id,
    title: "title" in chat ? (chat.title ?? null) : null,
    type: chat.type,
    username: "username" in chat ? (chat.username ?? null) : null,
    updated_at: now,
  };

  const { error: groupErr } = await supabase
    .from("groups")
    .upsert(groupRow, { onConflict: "chat_id" });
  if (groupErr) {
    console.error("groups upsert error:", groupErr.message);
    return;
  }

  const memberRow = {
    chat_id: chat.id,
    user_id: user.id,
    username: user.username ?? null,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    is_bot: user.is_bot ?? false,
    language_code: user.language_code ?? null,
    last_seen: now,
  };

  const { error: memberErr } = await supabase
    .from("group_members")
    .upsert(memberRow, { onConflict: "chat_id,user_id" });
  if (memberErr) {
    console.error("group_members upsert error:", memberErr.message);
  }
}

export async function setTelegramMemberCount(
  chatId: number,
  count: number,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({
      telegram_member_count: count,
      telegram_member_count_updated_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId);
  if (error) {
    console.error("groups telegram_member_count update error:", error.message);
  }
}

export type GroupStats = {
  tracked: number;
  total: number | null;
  totalUpdatedAt: string | null;
};

export async function getGroupStats(chatId: number): Promise<GroupStats> {
  const { data, error } = await supabase
    .from("groups")
    .select(
      "member_count, telegram_member_count, telegram_member_count_updated_at",
    )
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error) {
    console.error("groups stats select error:", error.message);
    return { tracked: 0, total: null, totalUpdatedAt: null };
  }
  return {
    tracked: data?.member_count ?? 0,
    total: data?.telegram_member_count ?? null,
    totalUpdatedAt: data?.telegram_member_count_updated_at ?? null,
  };
}

export async function getGroupMembers(
  chatId: number,
): Promise<GroupMemberRow[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      "chat_id,user_id,username,first_name,last_name,is_bot,language_code",
    )
    .eq("chat_id", chatId)
    .eq("is_bot", false);

  if (error) {
    console.error("group_members select error:", error.message);
    return [];
  }
  return data ?? [];
}
