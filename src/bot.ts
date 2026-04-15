import { Bot, GrammyError, HttpError } from "grammy";
import { registerTracker } from "@/middleware/tracker";
import { registerHamma } from "@/commands/hamma";
import { registerStats } from "@/commands/stats";
import { registerHelp } from "@/commands/help";
import { registerNews } from "@/commands/news";
import { registerSensitiveContent } from "@/commands/sensitiveContent";
import { registerTestNews } from "@/commands/testNews";
import { registerUsefulContent } from "@/commands/usefulContent";
import { registerEnglishContent } from "@/commands/englishContent";
import { registerDev } from "@/commands/dev";
import { registerSettings } from "@/commands/settings";
import { registerNewsStats } from "@/commands/newsStats";
import { registerUsefulStats } from "@/commands/usefulStats";
import { registerTestStatsCard } from "@/commands/testStatsCard";
import { registerWeeklyStats } from "@/commands/weeklyStats";
import { registerGreeting } from "@/commands/greeting";
import {
  startWeeklyStatsScheduler,
  startMonthlyStatsScheduler,
  startYearlyStatsScheduler,
} from "@/scheduler/weeklyStats";
import { registerLanguage } from "@/commands/language";
import { registerNsfwMiddleware } from "@/middleware/nsfw";
import { registerStatsLogger } from "@/middleware/statsLogger";
import { loadModel } from "@/services/nsfw";
import { warmupCardRenderer } from "@/services/statsCard";
import { startDailyNewsScheduler } from "@/scheduler/dailyNews";
import {
  startUsefulContentScheduler,
  startEnglishContentScheduler,
} from "@/scheduler/usefulContent";
import { initNotifier, notifyDevelopers } from "@/utils/notify";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN environment variable is not set");
  process.exit(1);
}

const bot = new Bot(token);
initNotifier(bot);

// Raw update logger — prints every update key Telegram sends.
bot.use(async (ctx, next) => {
  console.log("[update]", Object.keys(ctx.update).filter((k) => k !== "update_id"));
  await next();
});

// Middleware
registerTracker(bot);
registerStatsLogger(bot);
registerNsfwMiddleware(bot);

// Commands
registerLanguage(bot);
registerHamma(bot);
registerStats(bot);
registerHelp(bot);
registerNews(bot);
registerSensitiveContent(bot);
registerTestNews(bot);
registerUsefulContent(bot);
registerEnglishContent(bot);
registerDev(bot);
registerSettings(bot);
registerNewsStats(bot);
registerUsefulStats(bot);
registerTestStatsCard(bot);
registerWeeklyStats(bot);
registerGreeting(bot);

// Schedulers
startDailyNewsScheduler(bot);
startUsefulContentScheduler(bot);
startEnglishContentScheduler(bot);
startWeeklyStatsScheduler(bot);
startMonthlyStatsScheduler(bot);
startYearlyStatsScheduler(bot);

// Error handler
bot.catch(async (err) => {
  const ctx = err.ctx;
  const e = err.error;

  let message = `Update ${ctx.update.update_id}:\n`;
  if (e instanceof GrammyError) {
    message += `Telegram API error: ${e.description}`;
  } else if (e instanceof HttpError) {
    message += `Network error: ${e.message}`;
  } else if (e instanceof Error) {
    message += `${e.message}\n${e.stack ?? ""}`;
  } else {
    message += String(e);
  }

  console.error(message);
  await notifyDevelopers(message);
});

// Global uncaught error handlers
process.on("uncaughtException", async (err) => {
  const message = `Uncaught Exception:\n${err.message}\n${err.stack ?? ""}`;
  console.error(message);
  await notifyDevelopers(message);
});

process.on("unhandledRejection", async (reason) => {
  const message = `Unhandled Rejection:\n${reason instanceof Error ? `${reason.message}\n${reason.stack ?? ""}` : String(reason)}`;
  console.error(message);
  await notifyDevelopers(message);
});

// Pre-load NSFW model + stats card renderer, then start the bot
Promise.all([loadModel(), warmupCardRenderer()])
  .then(() => {
    bot.start({
      allowed_updates: [
        "message",
        "edited_message",
        "chat_member",
        "my_chat_member",
        "message_reaction",
        "message_reaction_count",
        "callback_query",
      ],
      onStart: () =>
        console.log(
          "Bot started. Use /hamma or /all in groups to mention all members.",
        ),
    });
  })
  .catch((err) => {
    console.error("Failed to load NSFW model:", err);
    process.exit(1);
  });
