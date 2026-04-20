import { Bot } from "grammy";
import {
  logAction,
  logActions,
  type ActionType,
  type LogEntry,
} from "@/db/logs";
import {
  rememberAuthor as rememberAuthorDb,
  lookupAuthor as lookupAuthorDb,
} from "@/db/messageAuthors";
import { notifyDevelopers } from "@/utils/notify";

// ---------------------------------------------------------------------------
// Message-author cache.
//
// Telegram's `message_reaction` update does NOT include the author of the
// message being reacted to — it only tells us who reacted. To log
// `reaction_received` against the right user, we remember `(chat, msg) ->
// author_id` when the message is first seen and look it up on reaction.
//
// Two-tier: in-memory LRU (fast path, zero DB roundtrip on recent messages)
// backed by `message_authors` in Postgres (survives bot restarts, cleaned up
// by a daily pg_cron purge). Cache miss → DB lookup → backfill into cache.
// ---------------------------------------------------------------------------

const AUTHOR_CACHE_MAX = 20_000;
const authorCache = new Map<string, number>();

function authorKey(chatId: number, messageId: number): string {
  return `${chatId}:${messageId}`;
}

function cachePut(chatId: number, messageId: number, userId: number) {
  const key = authorKey(chatId, messageId);
  if (authorCache.has(key)) authorCache.delete(key); // refresh LRU position
  authorCache.set(key, userId);
  if (authorCache.size > AUTHOR_CACHE_MAX) {
    const oldest = authorCache.keys().next().value;
    if (oldest !== undefined) authorCache.delete(oldest);
  }
}

function rememberAuthor(chatId: number, messageId: number, userId: number) {
  cachePut(chatId, messageId, userId);
  // Fire-and-forget DB write — we don't block the message handler on it.
  // Dedup key caps DMs at one per window even if the DB is down under load;
  // every failure is still console-logged.
  rememberAuthorDb(chatId, messageId, userId).catch((err) =>
    notifyDevelopers("rememberAuthorDb failed", {
      error: err,
      dedupKey: "rememberAuthorDb",
    }),
  );
}

async function lookupAuthor(
  chatId: number,
  messageId: number,
): Promise<number | null> {
  const hit = authorCache.get(authorKey(chatId, messageId));
  if (hit !== undefined) return hit;
  const fromDb = await lookupAuthorDb(chatId, messageId);
  if (fromDb !== null) cachePut(chatId, messageId, fromDb);
  return fromDb;
}

// Matches bare URLs that Telegram didn't parse into an entity (rare on modern
// clients, but guards against plain-text links in forwarded/edited messages).
const URL_REGEX = /\bhttps?:\/\/[^\s<>"']+|(?<![@\w])(?:www\.|\w+\.(?:com|net|org|io|dev|uz|ru|me))[^\s<>"']*/i;

function hasLink(msg: any): boolean {
  const entities = msg.entities ?? msg.caption_entities ?? [];
  for (const e of entities) {
    if (e.type === "url" || e.type === "text_link") return true;
  }
  // Some clients (and old Android Telegram) don't emit url entities for
  // messages that are purely a URL. Fall back to a regex scan so those still
  // count.
  const text: string = msg.text ?? msg.caption ?? "";
  if (text && URL_REGEX.test(text)) return true;
  return false;
}

/**
 * Classify a Telegram message into zero or more stat action types.
 * A single message can count as multiple (e.g. a voice reply = reply + voice).
 * `link` is added at most once per message regardless of how many URLs it
 * contains, and whether it's a reply or a plain message — the user either
 * sent a link or didn't.
 */
function classifyMessage(msg: any): ActionType[] {
  const types: ActionType[] = ["message"];
  if (msg.reply_to_message) types.push("reply");
  if (msg.sticker) types.push("sticker");
  if (msg.video_note) types.push("video_note");
  else if (msg.voice) types.push("voice");
  if (msg.animation) {
    types.push("gif");
  } else if (msg.photo || msg.video || msg.document || msg.audio) {
    types.push("media");
  }
  if (hasLink(msg)) types.push("link");
  return types;
}

// Telegram's service account that forwards channel posts to discussion groups.
const TELEGRAM_SERVICE_ID = 777000;

export function registerStatsLogger(bot: Bot) {
  bot.on("message", async (ctx, next) => {
    const chat = ctx.chat;
    const user = ctx.from;
    if (
      chat &&
      (chat.type === "group" || chat.type === "supergroup") &&
      user &&
      !user.is_bot &&
      user.id !== TELEGRAM_SERVICE_ID
    ) {
      rememberAuthor(chat.id, ctx.message.message_id, user.id);

      const types = classifyMessage(ctx.message);
      const entries: LogEntry[] = types.map((t) => ({
        chat_id: chat.id,
        user_id: user.id,
        action_type: t,
      }));
      await logActions(entries);
    }
    await next();
  });

  // Identified user reactions. Telegram ONLY delivers this update if the
  // bot is an admin in the group — otherwise the update is silently dropped.
  bot.on("message_reaction", async (ctx, next) => {
    const chat = ctx.chat;
    const reaction = ctx.messageReaction;
    if (
      chat &&
      (chat.type === "group" || chat.type === "supergroup") &&
      reaction
    ) {
      const oldCount = reaction.old_reaction?.length ?? 0;
      const newCount = reaction.new_reaction?.length ?? 0;
      if (newCount > oldCount) {
        // Reactor: null for anonymous admins / channel-as-user, by design.
        const reactor = reaction.user?.id ?? null;

        // Receiver: Telegram doesn't include it in the update, so look up
        // the author we cached when the original message was seen. Cache
        // miss (bot restart, message predates bot) → null.
        const receiver = await lookupAuthor(chat.id, reaction.message_id);

        const entries: LogEntry[] = [];
        if (reactor !== null) {
          entries.push({
            chat_id: chat.id,
            user_id: reactor,
            action_type: "reaction_given",
          });
        }
        // Don't credit the bot for receiving reactions on its own posts.
        if (receiver !== null && receiver !== ctx.me.id) {
          entries.push({
            chat_id: chat.id,
            user_id: receiver,
            action_type: "reaction_received",
          });
        }
        if (entries.length > 0) await logActions(entries);
      }
    }
    await next();
  });

  // Anonymous / channel-signed reactions come through message_reaction_count
  // (aggregate counts, no per-user info). Still useful for volume stats.
  bot.on("message_reaction_count", async (ctx, next) => {
    console.log("[statsLogger] message_reaction_count", {
      chat: ctx.chat?.id,
      reactions: ctx.messageReactionCount?.reactions?.length,
    });

    const chat = ctx.chat;
    const payload = ctx.messageReactionCount;
    if (
      chat &&
      (chat.type === "group" || chat.type === "supergroup") &&
      payload
    ) {
      const total = (payload.reactions ?? []).reduce(
        (n, r) => n + (r.total_count ?? 0),
        0,
      );
      if (total > 0) {
        await logAction({
          chat_id: chat.id,
          user_id: null,
          action_type: "reaction_received",
        });
      }
    }
    await next();
  });
}

export { logAction };
