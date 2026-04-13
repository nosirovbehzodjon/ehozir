import { Bot, InputFile } from "grammy";
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

export function registerWeeklyStats(bot: Bot) {
  // Developer-only manual trigger (bot chat). Useful for testing without
  // waiting until Monday 03:00 Tashkent.
  bot.command("testweeklystats", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    await ctx.reply("Running weekly stats job now...");
    try {
      await runWeeklyStatsNow(bot);
      await ctx.reply("Weekly stats job finished.");
    } catch (err) {
      await ctx.reply(`Job failed: ${(err as Error).message}`);
    }
  });

  bot.command("testmonthlystats", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    await ctx.reply("Running monthly stats job now...");
    try {
      await runMonthlyStatsNow(bot);
      await ctx.reply("Monthly stats job finished.");
    } catch (err) {
      await ctx.reply(`Job failed: ${(err as Error).message}`);
    }
  });

  bot.command("testyearlystats", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    await ctx.reply("Running yearly stats job now...");
    try {
      await runYearlyStatsNow(bot);
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
      // Champion card first (no caption), then leaderboard with the
      // localized caption — Telegram shows the caption under the last
      // photo when clients view them in order.
      if (row.champion_file_id) {
        await ctx.api.sendPhoto(row.chat_id, row.champion_file_id);
      }
      if (row.leaderboard_file_id) {
        await ctx.api.sendPhoto(row.chat_id, row.leaderboard_file_id, {
          caption: row.caption ?? undefined,
        });
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
