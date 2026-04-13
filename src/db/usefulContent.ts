import { supabase } from "./client";
import type { YoutubeVideo } from "@/services/youtube";

export type UsefulContentRow = {
  id: number;
  video_id: string;
  channel_id: string;
  channel_title: string;
  title: string;
  thumbnail_url: string | null;
  link: string;
  published_at: string | null;
  fetched_at: string;
};

export type UsefulContentGroup = {
  chatId: number;
  language: string;
};

export async function insertUsefulContent(
  videos: YoutubeVideo[],
): Promise<UsefulContentRow[]> {
  if (videos.length === 0) return [];

  const rows = videos.map((v) => ({
    video_id: v.videoId,
    channel_id: v.channelId,
    channel_title: v.channelTitle,
    title: v.title,
    thumbnail_url: v.thumbnailUrl,
    link: v.link,
    published_at: v.publishedAt,
    fetched_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("useful_content")
    .upsert(rows, { onConflict: "video_id", ignoreDuplicates: true })
    .select();

  if (error) {
    console.error("useful_content upsert error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getLatestUsefulContent(
  limit: number = 5,
): Promise<UsefulContentRow[]> {
  const { data, error } = await supabase
    .from("useful_content")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error("useful_content latest error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getUsefulContentById(
  id: number,
): Promise<UsefulContentRow | null> {
  const { data, error } = await supabase
    .from("useful_content")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("useful_content by id error:", error.message);
    return null;
  }
  return data;
}

export async function recordUsefulContentClick(
  contentId: number,
  chatId: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("useful_content_clicks")
    .insert({ content_id: contentId, chat_id: chatId });
  if (error) {
    console.error("useful_content_clicks insert error:", error.message);
  }
}

export async function getGroupsWithUsefulContentEnabled(): Promise<
  UsefulContentGroup[]
> {
  const { data, error } = await supabase
    .from("group_settings")
    .select("chat_id")
    .eq("feature", "usefulContent")
    .eq("enabled", true);

  if (error) {
    console.error("group_settings useful select error:", error.message);
    return [];
  }

  const chatIds = (data ?? []).map((row: any) => row.chat_id);
  if (chatIds.length === 0) return [];

  const { data: langData } = await supabase
    .from("group_settings")
    .select("chat_id, value")
    .eq("feature", "language")
    .in("chat_id", chatIds);

  const langMap = new Map<number, string>();
  for (const row of langData ?? []) {
    langMap.set(row.chat_id, row.value ?? "uz");
  }

  return chatIds.map((chatId: number) => ({
    chatId,
    language: langMap.get(chatId) ?? "uz",
  }));
}
