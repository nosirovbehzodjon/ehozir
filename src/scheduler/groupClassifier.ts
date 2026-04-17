import { Bot } from "grammy";
import cron from "node-cron";
import {
  listAllGroups,
  setGroupKind,
  type GroupKind,
} from "@/db/groups";
import { notifyDevelopers } from "@/utils/notify";

/**
 * Decide whether a chat is a plain group or a discussion group. Discussion
 * groups are supergroups linked to a Telegram channel — they carry a
 * `linked_chat_id` on the full Chat object (not the partial one on updates).
 *
 * Returns null if the chat is not a group/supergroup or the call fails
 * (bot kicked, chat deleted, Telegram hiccup). Null results are not
 * persisted so the previous classification is preserved on failure.
 */
export async function classifyGroup(
  api: Bot["api"],
  chatId: number,
): Promise<GroupKind | null> {
  try {
    const chat = await api.getChat(chatId);
    if (chat.type !== "group" && chat.type !== "supergroup") return null;
    return "linked_chat_id" in chat && chat.linked_chat_id
      ? "discussion"
      : "group";
  } catch {
    return null;
  }
}

export async function refreshAllGroupKinds(bot: Bot): Promise<void> {
  const groups = await listAllGroups();
  console.log(`[groupClassifier] refreshing ${groups.length} group(s)`);

  let updated = 0;
  for (const g of groups) {
    const kind = await classifyGroup(bot.api, g.chat_id);
    if (kind !== null) {
      await setGroupKind(g.chat_id, kind);
      updated++;
    }
    // 50ms gap keeps us well under Telegram's ~30 req/s global cap even
    // with thousands of groups.
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(
    `[groupClassifier] refreshed ${updated}/${groups.length} group(s)`,
  );
}

export function startGroupClassifierScheduler(bot: Bot): void {
  // Sunday 03:00 Tashkent — 24h before the Monday weekly stats job so any
  // consumer of `kind` sees fresh values.
  cron.schedule(
    "0 3 * * 0",
    () => {
      refreshAllGroupKinds(bot).catch((err) =>
        notifyDevelopers("groupClassifier scheduler run failed", {
          error: err,
        }),
      );
    },
    { timezone: "Asia/Tashkent" },
  );
  console.log(
    "[groupClassifier] scheduler started (Sun 03:00 Asia/Tashkent)",
  );
}
