import { Bot } from "grammy";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

let botInstance: Bot | null = null;

export function initNotifier(bot: Bot) {
  botInstance = bot;
}

// Per-key last-DM timestamp for optional dedup. Keeps hot-path callers
// (e.g. every message in busy groups) from spamming developer DMs when a
// dependency is degraded — console logs still capture every occurrence.
const lastDmByKey = new Map<string, number>();
const DEFAULT_DEDUP_WINDOW_MS = 5 * 60 * 1000;

export type NotifyOptions = {
  error?: unknown;
  dedupKey?: string;
  dedupWindowMs?: number;
};

/**
 * Global error sink. Always logs to console; DMs developers unless a
 * dedupKey silences a repeat within the window. Safe to call fire-and-forget
 * in hot paths when a dedupKey is provided. Pass the caught error via
 * `options.error` to get stack traces in both log and DM.
 */
export async function notifyDevelopers(
  message: string,
  options?: NotifyOptions,
): Promise<void> {
  const err = options?.error;
  if (err instanceof Error) {
    console.error(`[notify] ${message}`, err.stack ?? err.message);
  } else if (err !== undefined) {
    console.error(`[notify] ${message}`, err);
  } else {
    console.error(`[notify] ${message}`);
  }

  if (!botInstance || DEVELOPER_IDS.length === 0) return;

  if (options?.dedupKey) {
    const now = Date.now();
    const last = lastDmByKey.get(options.dedupKey) ?? 0;
    const window = options.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS;
    if (now - last < window) return;
    lastDmByKey.set(options.dedupKey, now);
  }

  const tail =
    err instanceof Error
      ? `\n${err.message}`
      : err !== undefined
        ? `\n${String(err)}`
        : "";
  const text = `<b>Bot Error</b>\n\n<pre>${escapeHtml(
    (message + tail).slice(0, 3500),
  )}</pre>`;

  for (const id of DEVELOPER_IDS) {
    try {
      await botInstance.api.sendMessage(id, text, { parse_mode: "HTML" });
    } catch (err) {
      console.error(`Failed to notify developer ${id}:`, err);
    }
  }
}

export async function notifyNsfwBan(
  user: { id: number; first_name?: string; username?: string },
  chatId: number,
  reason: string,
  category: string,
  confidence: number,
): Promise<void> {
  if (!botInstance || DEVELOPER_IDS.length === 0) return;

  const name = escapeHtml(user.first_name ?? "User");
  const uname = user.username ? `@${escapeHtml(user.username)}` : "no username";
  const pct = (confidence * 100).toFixed(1);

  const text =
    `🛡 <b>Sensitive Account Ban</b>\n\n` +
    `👤 <b>${name}</b> (${uname}, <code>${user.id}</code>)\n` +
    `💬 Group: <code>${chatId}</code>\n` +
    `🔍 Reason: <b>${escapeHtml(reason)}</b>\n` +
    `📊 ${escapeHtml(category)} — ${pct}%`;

  for (const id of DEVELOPER_IDS) {
    try {
      await botInstance.api.sendMessage(id, text, { parse_mode: "HTML" });
    } catch (err) {
      console.error(`Failed to send NSFW notification to ${id}:`, err);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
