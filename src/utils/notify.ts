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

export async function notifyDevelopers(message: string): Promise<void> {
  if (!botInstance || DEVELOPER_IDS.length === 0) return;

  const text = `⚠️ <b>Bot Error</b>\n\n<pre>${escapeHtml(message.slice(0, 3500))}</pre>`;

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
    `🛡 <b>NSFW Ban</b>\n\n` +
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
