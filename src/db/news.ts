import { supabase } from "./client";

export type NewsRow = {
  id: number;
  title: string;
  link: string;
  created_at: string;
};

export async function getLatestNews(limit = 5): Promise<NewsRow[]> {
  const { data, error } = await supabase
    .from("news")
    .select("id, title, link, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("news select error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getNewsById(id: number): Promise<NewsRow | null> {
  const { data, error } = await supabase
    .from("news")
    .select("id, title, link, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("news select by id error:", error.message);
    return null;
  }
  return data;
}

export async function recordNewsClick(
  newsId: number,
  chatId: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("news_clicks")
    .insert({ news_id: newsId, chat_id: chatId });

  if (error) {
    console.error("news_clicks insert error:", error.message);
  }
}

export type NewsStats = {
  news_id: number;
  title: string;
  link: string;
  click_count: number;
};

export async function getNewsClickStats(): Promise<NewsStats[]> {
  const { data, error } = await supabase
    .from("news")
    .select("id, title, link, news_clicks(count)")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("news stats select error:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    news_id: row.id,
    title: row.title,
    link: row.link,
    click_count: row.news_clicks?.[0]?.count ?? 0,
  }));
}

export async function getGroupsWithNewsEnabled(): Promise<number[]> {
  const { data, error } = await supabase
    .from("group_settings")
    .select("chat_id")
    .eq("feature", "dailyNews")
    .eq("enabled", true);

  if (error) {
    console.error("group_settings news select error:", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.chat_id);
}
