const API_KEY = process.env.GOOGLE_API_KEY ?? "";
const BASE = "https://www.googleapis.com/youtube/v3";

export type YoutubeChannelInfo = {
  channelId: string;
  handle: string | null;
  title: string;
  uploadsPlaylistId: string;
};

export type YoutubeVideo = {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  thumbnailUrl: string | null;
  link: string;
  publishedAt: string | null;
};

function requireKey(): string {
  if (!API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
  }
  return API_KEY;
}

function parseChannelIdentifier(input: string): { kind: "id" | "handle"; value: string } {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/youtube\.com\/(channel\/(UC[\w-]+)|@([\w.-]+))/i);
  if (urlMatch) {
    if (urlMatch[2]) return { kind: "id", value: urlMatch[2] };
    if (urlMatch[3]) return { kind: "handle", value: `@${urlMatch[3]}` };
  }

  if (trimmed.startsWith("@")) return { kind: "handle", value: trimmed };
  if (/^UC[\w-]+$/.test(trimmed)) return { kind: "id", value: trimmed };

  return { kind: "handle", value: trimmed.startsWith("@") ? trimmed : `@${trimmed}` };
}

export async function resolveChannel(input: string): Promise<YoutubeChannelInfo> {
  const key = requireKey();
  const parsed = parseChannelIdentifier(input);

  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    key,
  });
  if (parsed.kind === "id") {
    params.set("id", parsed.value);
  } else {
    params.set("forHandle", parsed.value);
  }

  const res = await fetch(`${BASE}/channels?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`YouTube channels.list returned ${res.status}`);
  }
  const json: any = await res.json();
  const item = json.items?.[0];
  if (!item) {
    throw new Error(`Channel not found for input: ${input}`);
  }

  return {
    channelId: item.id,
    handle: parsed.kind === "handle" ? parsed.value : null,
    title: item.snippet?.title ?? "Unknown",
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? "",
  };
}

export async function fetchLatestUploads(
  playlistId: string,
  max: number = 10,
): Promise<YoutubeVideo[]> {
  const key = requireKey();
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    playlistId,
    maxResults: String(max),
    key,
  });

  const res = await fetch(`${BASE}/playlistItems?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`YouTube playlistItems.list returned ${res.status}`);
  }
  const json: any = await res.json();

  return (json.items ?? []).map((item: any): YoutubeVideo => {
    const snippet = item.snippet ?? {};
    const videoId: string =
      item.contentDetails?.videoId ?? snippet.resourceId?.videoId ?? "";
    const thumbs = snippet.thumbnails ?? {};
    const thumb =
      thumbs.maxres?.url ??
      thumbs.standard?.url ??
      thumbs.high?.url ??
      thumbs.medium?.url ??
      thumbs.default?.url ??
      null;

    return {
      videoId,
      channelId: snippet.videoOwnerChannelId ?? snippet.channelId ?? "",
      channelTitle: snippet.videoOwnerChannelTitle ?? snippet.channelTitle ?? "",
      title: snippet.title ?? "",
      thumbnailUrl: thumb,
      link: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
      publishedAt: item.contentDetails?.videoPublishedAt ?? snippet.publishedAt ?? null,
    };
  }).filter((v: YoutubeVideo) => v.videoId && v.title);
}
