import { Resvg } from "@resvg/resvg-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Lang, translations, DEFAULT_LANG } from "@/i18n/translations";

// ---------------------------------------------------------------------------
// Preloaded resources — satori/satori-html are ESM-only so we dynamic-import
// them once at boot via warmupCardRenderer() and reuse the resolved modules
// for every render. Fonts are loaded the same way.
// ---------------------------------------------------------------------------

let modulesPromise: Promise<{ satori: any; html: any }> | null = null;
let fontsPromise: Promise<{
  regular: ArrayBuffer;
  bold: ArrayBuffer;
}> | null = null;

function loadModulesOnce() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([import("satori"), import("satori-html")]).then(
      ([s, h]) => ({ satori: s.default, html: h.html }),
    );
  }
  return modulesPromise;
}

function loadFontsOnce() {
  if (!fontsPromise) {
    const fontsDir = path.join(process.cwd(), "src/assets/fonts");
    fontsPromise = Promise.all([
      readFile(path.join(fontsDir, "Montserrat-Regular.ttf")),
      readFile(path.join(fontsDir, "Montserrat-Black.ttf")),
    ]).then(([regular, black]) => ({
      regular: regular.buffer.slice(
        regular.byteOffset,
        regular.byteOffset + regular.byteLength,
      ) as ArrayBuffer,
      bold: black.buffer.slice(
        black.byteOffset,
        black.byteOffset + black.byteLength,
      ) as ArrayBuffer,
    }));
  }
  return fontsPromise;
}

/**
 * Call once at bot startup to pay the satori + resvg + font cold-start cost
 * up-front instead of on the first /teststats invocation.
 */
export async function warmupCardRenderer(): Promise<void> {
  await Promise.all([loadModulesOnce(), loadFontsOnce()]);
}

// ---------------------------------------------------------------------------
// Render queue — satori + resvg are CPU-bound (~0.5–1s per card). If many
// groups generate at once they starve the event loop. serialize() runs them
// one at a time so other bot work (message tracking, NSFW scans) stays
// responsive. This trades latency for fairness, which is the right call for
// weekly/monthly batch jobs where a few seconds of extra wait is irrelevant.
// ---------------------------------------------------------------------------

let renderChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = renderChain.then(fn, fn);
  renderChain = next.catch(() => undefined);
  return next;
}

// ---------------------------------------------------------------------------
// Avatar cache — same user appearing in multiple weekly cards should not
// re-download their avatar. Capped at 500 entries with FIFO eviction so the
// cache can't grow unbounded in a bot serving thousands of groups.
// ---------------------------------------------------------------------------

const AVATAR_CACHE_MAX = 500;
const avatarCache = new Map<string, string>();

async function toDataUrl(url: string): Promise<string> {
  if (!url) return "";
  const cached = avatarCache.get(url);
  if (cached !== undefined) return cached;

  let result = "";
  try {
    if (url.startsWith("file://")) {
      const filePath = url.slice("file://".length);
      const buf = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";
      result = `data:${mime};base64,${buf.toString("base64")}`;
    } else {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // Telegram's file CDN returns application/octet-stream, which satori
      // rejects. Sniff magic bytes; fall back to extension, then jpeg.
      let mime = "image/jpeg";
      if (buf[0] === 0x89 && buf[1] === 0x50) mime = "image/png";
      else if (buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
      else if (buf[0] === 0x47 && buf[1] === 0x49) mime = "image/gif";
      else if (buf[8] === 0x57 && buf[9] === 0x45) mime = "image/webp";
      else {
        const ext = path.extname(new URL(url).pathname).toLowerCase();
        if (ext === ".png") mime = "image/png";
        else if (ext === ".webp") mime = "image/webp";
      }
      result = `data:${mime};base64,${buf.toString("base64")}`;
    }
  } catch (err) {
    console.error(`[statsCard] avatar fetch failed for ${url}:`, err);
    result = "";
  }

  if (avatarCache.size >= AVATAR_CACHE_MAX) {
    const firstKey = avatarCache.keys().next().value;
    if (firstKey !== undefined) avatarCache.delete(firstKey);
  }
  avatarCache.set(url, result);
  return result;
}

// ---------------------------------------------------------------------------

export type StatsPeriod = "week" | "month" | "year";

export type StatsCardData = {
  lang?: Lang;
  period?: StatsPeriod;
  groupTitle: string;
  fullName: string;
  username?: string;
  avatarUrl: string;
  rank: number;
  weekLabel: string;
  botUsername?: string;
  stats: {
    messages: number;
    replies: number;
    reactionsGiven: number;
    reactionsReceived: number;
    stickers: number;
    voices: number;
    media: number;
    videoNotes: number;
    gifs: number;
  };
};

export async function renderStatsCard(data: StatsCardData): Promise<Buffer> {
  return serialize(async () => {
    const [{ satori, html }, fonts, avatar] = await Promise.all([
      loadModulesOnce(),
      loadFontsOnce(),
      toDataUrl(data.avatarUrl),
    ]);
    const t = translations[data.lang ?? DEFAULT_LANG].statsCard;
    const championLabel =
      data.period === "month"
        ? t.monthlyChampion
        : data.period === "year"
          ? t.yearlyChampion
          : t.weeklyChampion;

    const s = data.stats;
    const total =
      s.messages +
      s.replies +
      s.reactionsGiven +
      s.reactionsReceived +
      s.stickers +
      s.voices +
      s.media +
      s.videoNotes +
      s.gifs;

    const rows: [string, string][][] = [
      [
        [t.messages, fmt(s.messages)],
        [t.replies, fmt(s.replies)],
      ],
      [
        [t.reactionsGiven, fmt(s.reactionsGiven)],
        [t.reactionsReceived, fmt(s.reactionsReceived)],
      ],
      [
        [t.stickers, fmt(s.stickers)],
        [t.voices, fmt(s.voices)],
      ],
      [
        [t.media, fmt(s.media)],
        [t.gifs, fmt(s.gifs)],
      ],
      [[t.videoNotes, fmt(s.videoNotes)]],
    ];

    const botHandle = (data.botUsername ?? "").replace(/^@/, "");

    const markup = html(`
      <div style="display:flex;width:900px;height:1440px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:55px;flex-direction:column;font-family:Montserrat;color:white;">
        <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:26px;">
          <div style="display:flex;font-size:22px;letter-spacing:6px;color:#a0a0c0;text-transform:uppercase;margin-bottom:6px;">${escapeHtml(championLabel)}</div>
          <div style="display:flex;font-size:30px;font-weight:900;color:white;margin-bottom:4px;">${escapeHtml(data.groupTitle)}</div>
          <div style="display:flex;font-size:24px;color:#a3e635;font-weight:700;">${escapeHtml(data.weekLabel)}</div>
        </div>

        <div style="display:flex;align-items:center;margin-bottom:36px;">
          <div style="display:flex;width:180px;height:180px;border-radius:28px;border:5px solid #a3e635;overflow:hidden;background:#2a2a4a;flex-shrink:0;">
            ${avatar ? `<img src="${avatar}" width="180" height="180" style="width:180px;height:180px;object-fit:cover;" />` : ""}
          </div>
          <div style="display:flex;flex-direction:column;margin-left:35px;flex:1;">
            <div style="display:flex;font-size:44px;font-weight:900;line-height:1.1;">${escapeHtml(data.fullName)}</div>
            ${data.username ? `<div style="display:flex;font-size:24px;color:#a0a0c0;margin-top:6px;">@${escapeHtml(data.username)}</div>` : ""}
            <div style="display:flex;align-items:center;margin-top:14px;">
              <div style="display:flex;font-size:20px;color:#a0a0c0;letter-spacing:2px;text-transform:uppercase;margin-right:14px;">${escapeHtml(t.rank)}</div>
              <div style="display:flex;font-size:56px;font-weight:900;color:#a3e635;line-height:1;">#${data.rank}</div>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:18px;">
          ${rows.map((row) => `<div style="display:flex;gap:18px;">${row.map(([l, v]) => statBox(l, v, row.length === 1)).join("")}</div>`).join("")}
        </div>

        <div style="display:flex;justify-content:center;align-items:center;margin-top:30px;padding:22px;border-top:2px solid rgba(163,230,53,0.3);">
          <div style="display:flex;font-size:22px;color:#a0a0c0;text-transform:uppercase;letter-spacing:3px;margin-right:18px;">${escapeHtml(t.totalActions)}</div>
          <div style="display:flex;font-size:44px;font-weight:900;color:#a3e635;">${fmt(total)}</div>
        </div>

        ${cardFooter(botHandle, t.cardTagline)}
      </div>
    `);

    const svg = await satori(markup as any, {
      width: 900,
      height: 1440,
      fonts: [
        { name: "Montserrat", data: fonts.regular, weight: 400, style: "normal" },
        { name: "Montserrat", data: fonts.bold, weight: 700, style: "normal" },
        { name: "Montserrat", data: fonts.bold, weight: 900, style: "normal" },
      ],
    });

    const png = new Resvg(svg, { fitTo: { mode: "width", value: 900 } })
      .render()
      .asPng();
    return Buffer.from(png);
  });
}

function cardFooter(botHandle: string, tagline: string): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;margin-top:auto;padding-top:24px;">
    ${botHandle ? `<div style="display:flex;font-size:26px;font-weight:900;color:#a3e635;letter-spacing:2px;">@${escapeHtml(botHandle)}</div>` : ""}
    <div style="display:flex;font-size:18px;color:#a0a0c0;margin-top:6px;letter-spacing:1px;">${escapeHtml(tagline)}</div>
  </div>`;
}

function statBox(label: string, value: string, wide: boolean): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:22px;padding:28px 16px;${wide ? "min-width:100%;" : ""}">
    <div style="display:flex;font-size:52px;font-weight:900;color:white;line-height:1;">${value}</div>
    <div style="display:flex;font-size:18px;color:#a0a0c0;text-transform:uppercase;letter-spacing:2px;margin-top:10px;">${escapeHtml(label)}</div>
  </div>`;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------

export type LeaderboardCategory =
  | "topMessager"
  | "topReplier"
  | "topReactionGiver"
  | "topReactionReceiver"
  | "topStickerSender"
  | "topVoiceSender"
  | "topMediaSender"
  | "topVideoNoteSender"
  | "topGifSender";

export type LeaderboardWinner = {
  category: LeaderboardCategory;
  fullName: string;
  avatarUrl: string;
  count: number;
};

export type LeaderboardCardData = {
  lang?: Lang;
  period?: StatsPeriod;
  groupTitle: string;
  weekLabel: string;
  winners: LeaderboardWinner[];
  botUsername?: string;
};

export async function renderLeaderboardCard(
  data: LeaderboardCardData,
): Promise<Buffer> {
  return serialize(async () => {
    const [{ satori, html }, fonts] = await Promise.all([
      loadModulesOnce(),
      loadFontsOnce(),
    ]);
    const t = translations[data.lang ?? DEFAULT_LANG].statsCard;
    const leaderboardLabel =
      data.period === "month"
        ? t.monthlyLeaderboard
        : data.period === "year"
          ? t.yearlyLeaderboard
          : t.weeklyLeaderboard;

    const avatars = await Promise.all(
      data.winners.map((w) => toDataUrl(w.avatarUrl)),
    );

    const rowsHtml = data.winners
      .map((w, i) => winnerRow(t[w.category], w.fullName, w.count, avatars[i]))
      .join("");

    const height = 280 + data.winners.length * 120 + 80 + 90;
    const botHandle = (data.botUsername ?? "").replace(/^@/, "");

    const markup = html(`
      <div style="display:flex;width:900px;height:${height}px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:55px;flex-direction:column;font-family:Montserrat;color:white;">
        <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:40px;">
          <div style="display:flex;font-size:22px;letter-spacing:6px;color:#a0a0c0;text-transform:uppercase;margin-bottom:10px;">${escapeHtml(leaderboardLabel)}</div>
          <div style="display:flex;font-size:40px;font-weight:900;color:white;margin-bottom:6px;">${escapeHtml(data.groupTitle)}</div>
          <div style="display:flex;font-size:24px;color:#a3e635;font-weight:700;">${escapeHtml(data.weekLabel)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${rowsHtml}
        </div>
        ${cardFooter(botHandle, t.cardTagline)}
      </div>
    `);

    const svg = await satori(markup as any, {
      width: 900,
      height,
      fonts: [
        { name: "Montserrat", data: fonts.regular, weight: 400, style: "normal" },
        { name: "Montserrat", data: fonts.bold, weight: 700, style: "normal" },
        { name: "Montserrat", data: fonts.bold, weight: 900, style: "normal" },
      ],
    });

    const png = new Resvg(svg, { fitTo: { mode: "width", value: 900 } })
      .render()
      .asPng();
    return Buffer.from(png);
  });
}

function winnerRow(
  category: string,
  fullName: string,
  count: number,
  avatar: string,
): string {
  return `<div style="display:flex;align-items:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:22px;padding:18px 26px;">
    <div style="display:flex;width:80px;height:80px;border-radius:16px;border:3px solid #a3e635;overflow:hidden;background:#2a2a4a;flex-shrink:0;">
      ${avatar ? `<img src="${avatar}" width="80" height="80" style="width:80px;height:80px;object-fit:cover;" />` : ""}
    </div>
    <div style="display:flex;flex-direction:column;margin-left:22px;flex:1;">
      <div style="display:flex;font-size:18px;color:#a0a0c0;text-transform:uppercase;letter-spacing:2px;">${escapeHtml(category)}</div>
      <div style="display:flex;font-size:30px;font-weight:900;color:white;margin-top:2px;">${escapeHtml(fullName)}</div>
    </div>
    <div style="display:flex;font-size:42px;font-weight:900;color:#a3e635;margin-left:16px;">${fmt(count)}</div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
