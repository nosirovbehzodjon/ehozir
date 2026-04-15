import { supabase } from "./client";
import type { YoutubeVideo } from "@/services/youtube";
import type { ChannelCategory } from "./youtubeChannels";

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
  send_count: number;
  category: ChannelCategory;
};

export type UsefulContentGroup = {
  chatId: number;
  language: string;
};

export async function insertUsefulContent(
  videos: YoutubeVideo[],
  category: ChannelCategory = "useful",
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
    category,
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
  category: ChannelCategory = "useful",
): Promise<UsefulContentRow[]> {
  const { data, error } = await supabase
    .from("useful_content")
    .select("*")
    .eq("category", category)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error("useful_content latest error:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Pick up to `limit` videos for a single delivery:
 *   - only rows that have been sent fewer than 2 times
 *   - prefer never-sent (send_count = 0) over reruns
 *   - round-robin across channels so one prolific channel can't dominate
 *     a delivery, while still filling the slate if only a few channels
 *     have fresh uploads
 */
export async function pickUsefulContentForDelivery(
  limit: number = 10,
  category: ChannelCategory = "useful",
): Promise<UsefulContentRow[]> {
  const { data, error } = await supabase
    .from("useful_content")
    .select("*")
    .eq("category", category)
    .lt("send_count", 2)
    .order("send_count", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit * 5);

  if (error) {
    console.error("useful_content pick error:", error.message);
    return [];
  }

  const pool = (data ?? []) as UsefulContentRow[];
  if (pool.length === 0) return [];

  const byChannel = new Map<string, UsefulContentRow[]>();
  for (const row of pool) {
    const bucket = byChannel.get(row.channel_id) ?? [];
    bucket.push(row);
    byChannel.set(row.channel_id, bucket);
  }

  const picked: UsefulContentRow[] = [];
  while (picked.length < limit) {
    let progressed = false;
    for (const bucket of byChannel.values()) {
      if (picked.length >= limit) break;
      const next = bucket.shift();
      if (next) {
        picked.push(next);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return picked;
}

export async function incrementUsefulContentSent(
  ids: number[],
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc("increment_useful_content_sent", {
    p_ids: ids,
  });
  if (error) {
    const { data: rows } = await supabase
      .from("useful_content")
      .select("id, send_count")
      .in("id", ids);
    for (const row of rows ?? []) {
      await supabase
        .from("useful_content")
        .update({ send_count: (row.send_count ?? 0) + 1 })
        .eq("id", row.id);
    }
  }
}

export async function pruneExhaustedUsefulContent(
  category: ChannelCategory = "useful",
): Promise<number> {
  const { data, error } = await supabase
    .from("useful_content")
    .delete()
    .eq("category", category)
    .gte("send_count", 2)
    .select("id");
  if (error) {
    console.error("useful_content prune exhausted error:", error.message);
    return 0;
  }
  return (data ?? []).length;
}

export async function pruneOldUsefulContent(
  category: ChannelCategory = "useful",
): Promise<number> {
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("useful_content")
    .delete()
    .eq("category", category)
    .lt("fetched_at", cutoff)
    .select("id");
  if (error) {
    console.error("useful_content prune old error:", error.message);
    return 0;
  }
  return (data ?? []).length;
}

export type UsefulChannelClicks = {
  channel_id: string;
  channel_title: string;
  videos: number;
  clicks: number;
};

export async function getMonthlyUsefulClicksByChannel(
  year: number,
  month: number,
  category: ChannelCategory = "useful",
): Promise<UsefulChannelClicks[]> {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();

  const { data, error } = await supabase
    .from("useful_content_clicks")
    .select(
      "content_id, useful_content:content_id(channel_id, channel_title, category)",
    )
    .gte("clicked_at", start)
    .lt("clicked_at", end);

  if (error) {
    console.error("useful_content_clicks monthly error:", error.message);
    return [];
  }

  const agg = new Map<string, UsefulChannelClicks>();
  const seenVideos = new Map<string, Set<number>>();
  for (const row of (data ?? []) as any[]) {
    const uc = row.useful_content;
    if (!uc) continue;
    if (uc.category !== category) continue;
    const key = uc.channel_id as string;
    let entry = agg.get(key);
    if (!entry) {
      entry = {
        channel_id: key,
        channel_title: uc.channel_title as string,
        videos: 0,
        clicks: 0,
      };
      agg.set(key, entry);
      seenVideos.set(key, new Set());
    }
    entry.clicks += 1;
    seenVideos.get(key)!.add(row.content_id as number);
  }
  for (const [key, set] of seenVideos) {
    const entry = agg.get(key);
    if (entry) entry.videos = set.size;
  }

  return Array.from(agg.values()).sort((a, b) => b.clicks - a.clicks);
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

export async function getGroupsWithFeatureEnabled(
  feature: string,
): Promise<UsefulContentGroup[]> {
  const { data, error } = await supabase
    .from("group_settings")
    .select("chat_id")
    .eq("feature", feature)
    .eq("enabled", true);

  if (error) {
    console.error("group_settings feature select error:", error.message);
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

export function getGroupsWithUsefulContentEnabled() {
  return getGroupsWithFeatureEnabled("usefulContent");
}
