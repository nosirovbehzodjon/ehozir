import { supabase } from "./client";

export type YoutubeChannelRow = {
  channel_id: string;
  handle: string | null;
  title: string;
  uploads_playlist_id: string;
  is_active: boolean;
  added_at: string;
};

export async function listYoutubeChannels(
  onlyActive: boolean = true,
): Promise<YoutubeChannelRow[]> {
  let query = supabase.from("youtube_channels").select("*").order("added_at");
  if (onlyActive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.error("youtube_channels select error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function upsertYoutubeChannel(row: {
  channel_id: string;
  handle: string | null;
  title: string;
  uploads_playlist_id: string;
  is_active?: boolean;
}): Promise<void> {
  const { error } = await supabase.from("youtube_channels").upsert(
    {
      ...row,
      is_active: row.is_active ?? true,
    },
    { onConflict: "channel_id" },
  );
  if (error) {
    console.error("youtube_channels upsert error:", error.message);
  }
}

export async function deactivateYoutubeChannel(channelId: string): Promise<void> {
  const { error } = await supabase
    .from("youtube_channels")
    .update({ is_active: false })
    .eq("channel_id", channelId);
  if (error) {
    console.error("youtube_channels deactivate error:", error.message);
  }
}

export async function deleteYoutubeChannel(channelId: string): Promise<void> {
  const { error } = await supabase
    .from("youtube_channels")
    .delete()
    .eq("channel_id", channelId);
  if (error) {
    console.error("youtube_channels delete error:", error.message);
  }
}
