if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
import { Bot, Context, GrammyError, HttpError, NextFunction } from "grammy";
import {
  getGroupMembers,
  getGroupStats,
  setTelegramMemberCount,
  upsertGroupAndMember,
} from "./supabase";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set in .env file");
  process.exit(1);
}

const bot = new Bot(token);

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

// When a member's status in the chat changes (joined, left, promoted, etc.)
// Requires the bot to be admin AND `chat_member` to be in allowed_updates below.
bot.on("chat_member", async (ctx) => {
  const chat = ctx.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") return;

  const update = ctx.chatMember;
  const newStatus = update.new_chat_member.status;
  const user = update.new_chat_member.user;

  if (user.is_bot) return;

  // User is currently in the group
  if (
    newStatus === "member" ||
    newStatus === "administrator" ||
    newStatus === "creator" ||
    newStatus === "restricted"
  ) {
    await upsertGroupAndMember(chat, user);
  }
});

// Handle /hamma and /all commands
bot.command(["hamma", "all"], async (ctx) => {
  if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
    await ctx.reply("This command only works in groups.");
    return;
  }

  const members = await getGroupMembers(ctx.chat.id);

  if (members.length === 0) {
    await ctx.reply(
      "No members tracked yet. Members are tracked as they send messages.",
      { reply_to_message_id: ctx.msg.message_id },
    );
    return;
  }

  let mentionText = "Attention group members:\n\n";
  for (const m of members) {
    const name = escapeMarkdown(m.first_name || m.username || "User");
    mentionText += `[${name}](tg://user?id=${m.user_id}) `;
  }

  await ctx.reply(mentionText, {
    parse_mode: "MarkdownV2",
    reply_to_message_id: ctx.msg.message_id,
  });
});

// Show tracked vs. true total member count
bot.command("stats", async (ctx) => {
  if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
    await ctx.reply("This command only works in groups.");
    return;
  }

  let total: number | null = null;
  try {
    total = await ctx.getChatMemberCount();
    await setTelegramMemberCount(ctx.chat.id, total);
  } catch (err) {
    console.error("getChatMemberCount failed:", err);
  }

  const stats = await getGroupStats(ctx.chat.id);
  const totalShown = total ?? stats.total;

  const lines = [
    `Tracked by bot: ${stats.tracked}`,
    `Total in group: ${totalShown ?? "unknown"}`,
    "",
    "Members are added as they send messages or join.",
  ];

  await ctx.reply(lines.join("\n"), {
    reply_to_message_id: ctx.msg.message_id,
  });
});

// Escape MarkdownV2 reserved characters
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Telegram API error:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Network error:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

bot.start({
  // chat_member updates are NOT delivered by default — must be opted into.
  // The bot must also be an admin in the group to receive them.
  allowed_updates: [
    "message",
    "edited_message",
    "chat_member",
    "my_chat_member",
  ],
  onStart: () =>
    console.log(
      "Bot started. Use /hamma or /all in groups to mention all members.",
    ),
});
