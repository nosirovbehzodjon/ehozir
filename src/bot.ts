import { Bot, GrammyError, HttpError } from "grammy";
import { registerTracker } from "@/middleware/tracker";
import { registerHamma } from "@/commands/hamma";
import { registerStats } from "@/commands/stats";
import { registerHelp } from "@/commands/help";
import { registerNews } from "@/commands/news";
import { registerTestNews } from "@/commands/testNews";
import { startDailyNewsScheduler } from "@/scheduler/dailyNews";
import { initNotifier, notifyDevelopers } from "@/utils/notify";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN environment variable is not set");
  process.exit(1);
}

const bot = new Bot(token);
initNotifier(bot);

// Middleware
registerTracker(bot);

// Commands
registerHamma(bot);
registerStats(bot);
registerHelp(bot);
registerNews(bot);
registerTestNews(bot);

// Schedulers
startDailyNewsScheduler(bot);

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

bot.start({
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
