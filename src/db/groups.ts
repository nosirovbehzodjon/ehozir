import { supabase } from "./client";
import type { Chat, User } from "grammy/types";

export type GroupKind = "group" | "discussion";

export type GroupMemberRow = {
  chat_id: number;
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_bot: boolean;
  language_code: string | null;
};

export type GroupStats = {
  tracked: number;
  total: number | null;
  totalUpdatedAt: string | null;
};

// Telegram's service account that forwards channel posts to discussion groups.
const TELEGRAM_SERVICE_ID = 777000;

export async function upsertGroupAndMember(
  chat: Chat,
  user: User,
): Promise<void> {
  if (chat.type !== "group" && chat.type !== "supergroup") return;
  if (user.id === TELEGRAM_SERVICE_ID) return;

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

export async function setGroupKind(
  chatId: number,
  kind: GroupKind,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ kind, updated_at: new Date().toISOString() })
    .eq("chat_id", chatId);
  if (error) {
    console.error("groups kind update error:", error.message);
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

export async function listAllGroups(): Promise<
  { chat_id: number; title: string | null }[]
> {
  const { data, error } = await supabase
    .from("groups")
    .select("chat_id, title");
  if (error) {
    console.error("groups list error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getGroupMember(
  chatId: number,
  userId: number,
): Promise<GroupMemberRow | null> {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      "chat_id,user_id,username,first_name,last_name,is_bot,language_code",
    )
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("group_members single select error:", error.message);
    return null;
  }
  return data;
}

export async function getGroupMembersByIds(
  chatId: number,
  userIds: number[],
): Promise<GroupMemberRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("group_members")
    .select(
      "chat_id,user_id,username,first_name,last_name,is_bot,language_code",
    )
    .eq("chat_id", chatId)
    .in("user_id", userIds);
  if (error) {
    console.error("group_members batch select error:", error.message);
    return [];
  }
  return data ?? [];
}

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
