import { Bot, InlineKeyboard } from "grammy";
import type { User } from "grammy/types";
import {
  createPendingBan,
  setAdminNotifications,
  getPendingBan,
  resolvePendingBan,
  type AdminNotification,
  type PendingBanRow,
} from "@/db/pendingBans";
import { getUser } from "@/db/users";
import { translations, type Lang, DEFAULT_LANG } from "@/i18n/translations";
import { applyNsfwBan } from "./nsfwBan";
import { notifyDevelopers } from "@/utils/notify";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatUserName(user: {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}): string {
  const full = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (full) return full;
  if (user.username) return `@${user.username}`;
  return "User";
}

function reasonLabel(lang: Lang, reason: string): string {
  const map = translations[lang].nsfwApprovalReason;
  return (map as Record<string, string>)[reason] ?? reason;
}

function buildApprovalKeyboard(lang: Lang, pendingId: number): InlineKeyboard {
  const tr = translations[lang];
  return new InlineKeyboard()
    .text(tr.nsfwApproveButton, `nsfw:approve:${pendingId}`)
    .text(tr.nsfwRejectButton, `nsfw:reject:${pendingId}`);
}

function buildApprovalBody(lang: Lang, row: PendingBanRow): string {
  const tr = translations[lang];
  const name = escapeHtml(
    formatUserName({
      first_name: row.first_name,
      last_name: row.last_name,
      username: row.username,
    }),
  );
  const username = row.username ? `@${escapeHtml(row.username)}` : "—";
  const group = escapeHtml(row.group_title ?? String(row.chat_id));
  const pct = (row.confidence * 100).toFixed(1);
  return (
    `🛡 <b>${escapeHtml(tr.nsfwApprovalTitle)}</b>\n\n` +
    `👤 ${name} (${username}, <code>${row.user_id}</code>)\n` +
    `💬 ${group}\n` +
    `🔍 ${escapeHtml(reasonLabel(lang, row.reason))}\n` +
    `📊 ${escapeHtml(row.category)} — ${pct}%`
  );
}

function buildPendingText(lang: Lang, row: PendingBanRow): string {
  const tr = translations[lang];
  return `${buildApprovalBody(lang, row)}\n\n${escapeHtml(tr.nsfwApprovalFooter)}`;
}

function buildResolvedText(
  lang: Lang,
  row: PendingBanRow,
  decision: "approved" | "rejected" | "expired",
  decisionByName?: string,
): string {
  const tr = translations[lang];
  const byName = decisionByName ?? "—";
  let line: string;
  if (decision === "approved") line = tr.nsfwApprovedBy(byName);
  else if (decision === "rejected") line = tr.nsfwRejectedBy(byName);
  else line = tr.nsfwExpired;
  return `${buildApprovalBody(lang, row)}\n\n<b>${escapeHtml(line)}</b>`;
}

/**
 * Creates a pending ban row, fetches chat admins, DMs those who have started
 * the bot in private chat, and records message ids so the DMs can be edited
 * on resolve/expire. Returns the created row (or null if a pending row
 * already exists for this chat+user).
 */
export async function createPendingBanAndNotifyAdmins(
  bot: Bot,
  params: {
    chatId: number;
    user: User;
    reason: string;
    category: string;
    confidence: number;
    messageId?: number | null;
    reactionMessageId?: number | null;
    groupTitle?: string | null;
  },
): Promise<PendingBanRow | null> {
  const row = await createPendingBan({
    userId: params.user.id,
    chatId: params.chatId,
    username: params.user.username ?? null,
    firstName: params.user.first_name ?? null,
    lastName: params.user.last_name ?? null,
    reason: params.reason,
    category: params.category,
    confidence: params.confidence,
    messageId: params.messageId ?? null,
    reactionMessageId: params.reactionMessageId ?? null,
    groupTitle: params.groupTitle ?? null,
  });

  if (!row) return null;

  let admins;
  try {
    admins = await bot.api.getChatAdministrators(params.chatId);
  } catch (err) {
    console.error(
      `[nsfwApproval] getChatAdministrators failed for ${params.chatId}:`,
      err,
    );
    return row;
  }

  const notifications: AdminNotification[] = [];
  for (const a of admins) {
    if (a.user.is_bot) continue;
    const adminUser = await getUser(a.user.id);
    if (!adminUser) continue;
    const lang = adminUser.language ?? DEFAULT_LANG;
    try {
      const msg = await bot.api.sendMessage(
        a.user.id,
        buildPendingText(lang, row),
        {
          parse_mode: "HTML",
          reply_markup: buildApprovalKeyboard(lang, row.id),
        },
      );
      notifications.push({ admin_id: a.user.id, message_id: msg.message_id });
    } catch (err) {
      console.warn(
        `[nsfwApproval] DM to admin ${a.user.id} failed for chat ${params.chatId}:`,
        (err as Error).message,
      );
    }
  }

  if (notifications.length === 0) {
    await notifyDevelopers(
      `NSFW approval: no admin reachable for chat ${params.chatId} (user ${params.user.id}, ${params.reason}). Auto-dismiss in 48h.`,
      { dedupKey: `nsfw-pending-no-admin-${params.chatId}` },
    );
  } else {
    await setAdminNotifications(row.id, notifications);
  }

  return row;
}

async function editAllAdminDms(
  bot: Bot,
  row: PendingBanRow,
  buildText: (lang: Lang) => string,
): Promise<void> {
  for (const n of row.admin_notifications) {
    try {
      const u = await getUser(n.admin_id);
      const lang = u?.language ?? DEFAULT_LANG;
      await bot.api.editMessageText(n.admin_id, n.message_id, buildText(lang), {
        parse_mode: "HTML",
      });
    } catch {
      // Message may be too old, or the admin blocked the bot — ignore
    }
  }
}

export type ApprovalResult =
  | "ok"
  | "already_resolved"
  | "not_found"
  | "not_authorized";

export async function approvePendingBan(
  bot: Bot,
  pendingId: number,
  admin: User,
): Promise<ApprovalResult> {
  const row = await getPendingBan(pendingId);
  if (!row) return "not_found";
  if (row.status !== "pending") return "already_resolved";
  if (!row.admin_notifications.some((n) => n.admin_id === admin.id)) {
    return "not_authorized";
  }

  const resolved = await resolvePendingBan(pendingId, "approved", admin.id);
  if (!resolved) return "already_resolved";

  try {
    await applyNsfwBan(
      bot,
      resolved.chat_id,
      {
        id: resolved.user_id,
        is_bot: false,
        first_name: resolved.first_name ?? "User",
        last_name: resolved.last_name ?? undefined,
        username: resolved.username ?? undefined,
      },
      resolved.reason,
      resolved.category,
      resolved.confidence,
      resolved.message_id,
      resolved.reaction_message_id,
    );
  } catch (err) {
    console.error("[nsfwApproval] applyNsfwBan failed:", err);
  }

  const byName = formatUserName({
    first_name: admin.first_name ?? null,
    last_name: admin.last_name ?? null,
    username: admin.username ?? null,
  });
  await editAllAdminDms(bot, resolved, (lang) =>
    buildResolvedText(lang, resolved, "approved", byName),
  );
  return "ok";
}

export async function rejectPendingBan(
  bot: Bot,
  pendingId: number,
  admin: User,
): Promise<ApprovalResult> {
  const row = await getPendingBan(pendingId);
  if (!row) return "not_found";
  if (row.status !== "pending") return "already_resolved";
  if (!row.admin_notifications.some((n) => n.admin_id === admin.id)) {
    return "not_authorized";
  }

  const resolved = await resolvePendingBan(pendingId, "rejected", admin.id);
  if (!resolved) return "already_resolved";

  const byName = formatUserName({
    first_name: admin.first_name ?? null,
    last_name: admin.last_name ?? null,
    username: admin.username ?? null,
  });
  await editAllAdminDms(bot, resolved, (lang) =>
    buildResolvedText(lang, resolved, "rejected", byName),
  );
  return "ok";
}

export async function expirePendingBan(
  bot: Bot,
  pendingId: number,
): Promise<void> {
  const resolved = await resolvePendingBan(pendingId, "expired", null);
  if (!resolved) return;
  await editAllAdminDms(bot, resolved, (lang) =>
    buildResolvedText(lang, resolved, "expired"),
  );
}
