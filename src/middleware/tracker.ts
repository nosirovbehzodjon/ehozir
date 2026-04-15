import { Bot } from "grammy";
import { upsertGroupAndMember } from "@/db/groups";
import type { Context, NextFunction } from "grammy";

export function registerTracker(bot: Bot) {
  // Track every message sender
  bot.on("message", async (ctx: Context, next: NextFunction) => {
    const chat = ctx.chat;
    const user = ctx.from;

    if (chat && (chat.type === "group" || chat.type === "supergroup") && user) {
      await upsertGroupAndMember(chat, user);
    }

    await next();
  });

  // When new members join via "added by another user" event
  bot.on("message:new_chat_members", async (ctx) => {
    const chat = ctx.chat;
    if (chat.type !== "group" && chat.type !== "supergroup") return;

    for (const member of ctx.message.new_chat_members) {
      if (member.is_bot) continue;
      await upsertGroupAndMember(chat, member);
    }
  });

  // When a member's status changes (joined, left, promoted, etc.)
  bot.on("chat_member", async (ctx) => {
    const chat = ctx.chat;
    if (chat.type !== "group" && chat.type !== "supergroup") return;

    const update = ctx.chatMember;
    const newStatus = update.new_chat_member.status;
    const user = update.new_chat_member.user;

    if (user.is_bot) return;

    if (
      newStatus === "member" ||
      newStatus === "administrator" ||
      newStatus === "creator" ||
      newStatus === "restricted"
    ) {
      await upsertGroupAndMember(chat, user);
    }
  });

  // When a user reacts to a message. Silent members who only react to others'
  // posts (no messages of their own) would otherwise never land in
  // group_members — `message_reaction` is the only signal we get from them.
  // Requires admin rights on the group and `message_reaction` in
  // allowed_updates (both already set in bot.ts).
  bot.on("message_reaction", async (ctx, next) => {
    const chat = ctx.chat;
    if (chat.type === "group" || chat.type === "supergroup") {
      const user = ctx.messageReaction?.user;
      if (user && !user.is_bot) {
        await upsertGroupAndMember(chat, user);
      }
    }
    await next();
  });
}
