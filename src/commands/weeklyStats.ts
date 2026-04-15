import { Bot, InputMediaBuilder } from "grammy";
import type { InputMediaPhoto } from "grammy/types";
import { getPendingCard, updatePendingStatus } from "@/db/pendingCards";
import {
  runWeeklyStatsNow,
  runMonthlyStatsNow,
  runYearlyStatsNow,
} from "@/scheduler/weeklyStats";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number): boolean {
  return DEVELOPER_IDS.includes(userId);
}

// Parse an optional chat id argument: "/testweeklystats -1001234567890".
// Returns undefined for no arg, or throws for a malformed one.
function parseChatIdArg(raw: string | undefined): number | undefined {
  const arg = raw?.toString().trim();
  if (!arg) return undefined;
  const n = Number(arg);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`Invalid group id: "${arg}"`);
  }
  return n;
}

export function registerWeeklyStats(bot: Bot) {
  // Developer-only manual trigger (bot chat). Useful for testing without
  // waiting until the scheduled cron fires.
  //
  // Usage:
  //   /testweeklystats            — run for every group (slow)
  //   /testweeklystats <chat_id>  — run for a single group only
  bot.command("testweeklystats", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    let chatId: number | undefined;
    try {
      chatId = parseChatIdArg(ctx.match);
    } catch (err) {
      await ctx.reply((err as Error).message);
      return;
    }

    await ctx.reply(
      chatId !== undefined
        ? `Running weekly stats job for ${chatId}...`
        : "Running weekly stats job for all groups...",
    );
    try {
      await runWeeklyStatsNow(bot, chatId);
      await ctx.reply("Weekly stats job finished.");
    } catch (err) {
      await ctx.reply(`Job failed: ${(err as Error).message}`);
    }
  });

  bot.command("testmonthlystats", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    let chatId: number | undefined;
    try {
      chatId = parseChatIdArg(ctx.match);
    } catch (err) {
      await ctx.reply((err as Error).message);
      return;
    }

    await ctx.reply(
      chatId !== undefined
        ? `Running monthly stats job for ${chatId}...`
        : "Running monthly stats job for all groups...",
    );
    try {
      await runMonthlyStatsNow(bot, chatId);
      await ctx.reply("Monthly stats job finished.");
    } catch (err) {
      await ctx.reply(`Job failed: ${(err as Error).message}`);
    }
  });

  bot.command("testyearlystats", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    let chatId: number | undefined;
    try {
      chatId = parseChatIdArg(ctx.match);
    } catch (err) {
      await ctx.reply((err as Error).message);
      return;
    }

    await ctx.reply(
      chatId !== undefined
        ? `Running yearly stats job for ${chatId}...`
        : "Running yearly stats job for all groups...",
    );
    try {
      await runYearlyStatsNow(bot, chatId);
      await ctx.reply("Yearly stats job finished.");
    } catch (err) {
      await ctx.reply(`Job failed: ${(err as Error).message}`);
    }
  });

  // Approve callback — look up the pending row, re-send stored file_ids
  // to the target group, mark approved.
  bot.callbackQuery(/^wkly_ok:(\d+)$/, async (ctx) => {
    if (!ctx.from || !isDeveloper(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Developers only." });
      return;
    }

    const match = ctx.match as RegExpMatchArray;
    const id = parseInt(match[1], 10);
    const row = await getPendingCard(id);

    if (!row) {
      await ctx.answerCallbackQuery({ text: "Pending row not found." });
      return;
    }
    if (row.status !== "pending") {
      await ctx.answerCallbackQuery({ text: `Already ${row.status}.` });
      return;
    }

    try {
      // Send all cards as a single album (sendMediaGroup, max 10 items).
      // Order: gold → silver → bronze → top10 → leaderboard. The localized
      // caption goes on the first item so Telegram shows it as the album
      // caption in clients that support it.
      const fileIds = [
        row.champion_file_id,
        row.silver_file_id,
        row.bronze_file_id,
        row.top_ten_file_id,
        row.leaderboard_file_id,
      ].filter((id): id is string => !!id);

      if (fileIds.length > 0) {
        const caption = row.caption ?? undefined;
        const media: InputMediaPhoto[] = fileIds.map((id, i) =>
          i === 0
            ? InputMediaBuilder.photo(id, caption ? { caption } : undefined)
            : InputMediaBuilder.photo(id),
        );
        await ctx.api.sendMediaGroup(row.chat_id, media);
      }
      await updatePendingStatus(id, "approved");
      await ctx.editMessageText(
        `${ctx.callbackQuery.message?.text ?? ""}\n\n✅ Approved and sent.`,
      );
      await ctx.answerCallbackQuery({ text: "Sent." });
    } catch (err) {
      console.error("[weeklyStats] approve send failed:", err);
      await ctx.answerCallbackQuery({
        text: `Send failed: ${(err as Error).message}`,
      });
    }
  });

  // Reject callback — mark rejected, no delivery.
  bot.callbackQuery(/^wkly_no:(\d+)$/, async (ctx) => {
    if (!ctx.from || !isDeveloper(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Developers only." });
      return;
    }

    const match = ctx.match as RegExpMatchArray;
    const id = parseInt(match[1], 10);
    const row = await getPendingCard(id);

    if (!row) {
      await ctx.answerCallbackQuery({ text: "Pending row not found." });
      return;
    }
    if (row.status !== "pending") {
      await ctx.answerCallbackQuery({ text: `Already ${row.status}.` });
      return;
    }

    await updatePendingStatus(id, "rejected");
    await ctx.editMessageText(
      `${ctx.callbackQuery.message?.text ?? ""}\n\n❌ Rejected.`,
    );
    await ctx.answerCallbackQuery({ text: "Rejected." });
  });
}
