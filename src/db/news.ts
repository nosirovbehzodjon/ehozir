import { supabase } from "./client";
import type { ExternalNewsItem } from "@/services/newsFetcher";

export type ExternalNewsRow = {
  id: number;
  source: string;
  title: string;
  link: string;
  external_id: string;
  category: string | null;
  published_at: string | null;
  fetched_at: string;
};

export type NewsGroup = {
  chatId: number;
  language: string;
};

export async function getGroupsWithNewsEnabled(): Promise<NewsGroup[]> {
  const { data, error } = await supabase
    .from("group_settings")
    .select("chat_id")
    .eq("feature", "dailyNews")
    .eq("enabled", true);

  if (error) {
    console.error("group_settings news select error:", error.message);
    return [];
  }

  const chatIds = (data ?? []).map((row: any) => row.chat_id);
  if (chatIds.length === 0) return [];

  // Get language settings for these groups
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

// ---------------------------------------------------------------------------
// External news (kun.uz / daryo.uz)
// ---------------------------------------------------------------------------

export async function insertExternalNews(
  items: ExternalNewsItem[],
): Promise<ExternalNewsRow[]> {
  if (items.length === 0) return [];

  const rows = items.map((item) => ({
    source: item.source,
    title: item.title,
    link: item.link,
    external_id: item.externalId,
    category: item.category,
    published_at: item.publishedAt,
    fetched_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("external_news")
    .upsert(rows, { onConflict: "source,external_id" })
    .select();

  if (error) {
    console.error("external_news upsert error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getExternalNewsById(
  id: number,
): Promise<ExternalNewsRow | null> {
  const { data, error } = await supabase
    .from("external_news")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("external_news select by id error:", error.message);
    return null;
  }
  return data;
}

export async function recordExternalNewsClick(
  newsId: number,
  chatId: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("external_news_clicks")
    .insert({ news_id: newsId, chat_id: chatId });

  if (error) {
    console.error("external_news_clicks insert error:", error.message);
  }
}

export type SourceStats = {
  source: string;
  total_news: number;
  total_clicks: number;
};

export type ExternalNewsStats = {
  news_id: number;
  source: string;
  title: string;
  link: string;
  click_count: number;
  fetched_at: string;
};

export async function getExternalNewsStatsBySource(
  source?: string,
  days: number = 7,
): Promise<ExternalNewsStats[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from("external_news")
    .select("id, source, title, link, fetched_at, external_news_clicks(count)")
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(50);

  if (source) {
    query = query.eq("source", source);
  }

  const { data, error } = await query;

  if (error) {
    console.error("external news stats error:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    news_id: row.id,
    source: row.source,
    title: row.title,
    link: row.link,
    click_count: row.external_news_clicks?.[0]?.count ?? 0,
    fetched_at: row.fetched_at,
  }));
}

export async function getSourceSummaryStats(
  days: number = 30,
): Promise<SourceStats[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from("external_news")
    .select("source, id, external_news_clicks(count)")
    .gte("fetched_at", since);

  if (error) {
    console.error("source summary stats error:", error.message);
    return [];
  }

  const map = new Map<string, { total_news: number; total_clicks: number }>();

  for (const row of data ?? []) {
    const r = row as any;
    const entry = map.get(r.source) ?? { total_news: 0, total_clicks: 0 };
    entry.total_news++;
    entry.total_clicks += r.external_news_clicks?.[0]?.count ?? 0;
    map.set(r.source, entry);
  }

  return Array.from(map.entries()).map(([source, stats]) => ({
    source,
    ...stats,
  }));
}
