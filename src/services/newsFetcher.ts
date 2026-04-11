export type ExternalNewsItem = {
  source: "daryo";
  title: string;
  link: string;
  externalId: string;
  category: string;
  publishedAt: string | null;
};

type DaryoNewsItem = {
  id: number;
  title: string;
  slug: string;
  category: string;
  date: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

export async function fetchDaryoNews(
  limit: number = 8,
): Promise<ExternalNewsItem[]> {
  const res = await fetch(
    `https://data.daryo.uz/api/v1/site/news-latest/list?limit=${limit + 4}&offset=0&order=date%2Bdesc`,
    {
      headers: {
        accept: "*/*",
        "user-agent": USER_AGENT,
        origin: "https://daryo.uz",
        referer: "https://daryo.uz/",
        "accept-language": "uz",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    throw new Error(`daryo.uz API returned ${res.status}`);
  }

  const json = await res.json();
  const data: DaryoNewsItem[] = Array.isArray(json) ? json : json.data ?? json.items ?? [];

  return data
    .filter((item) => item.category !== "Reklama")
    .slice(0, limit)
    .map((item) => {
      // date format: "2026-04-11 20:27:21" → extract "2026/04/11"
      const datePart = item.date ? item.date.split(" ")[0].replace(/-/g, "/") : "";
      return {
        source: "daryo" as const,
        title: item.title,
        link: `https://daryo.uz/${datePart}/${item.slug}`,
        externalId: String(item.id),
        category: item.category,
        publishedAt: item.date
          ? new Date(item.date.replace(" ", "T") + "+05:00").toISOString()
          : null,
      };
    });
}

export async function fetchAllExternalNews(): Promise<ExternalNewsItem[]> {
  return fetchDaryoNews(8);
}
