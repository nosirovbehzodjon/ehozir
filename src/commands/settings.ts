import { Bot, InlineKeyboard } from "grammy";
import { getNewsHour, setNewsHour } from "@/db/botSettings";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number): boolean {
  return DEVELOPER_IDS.includes(userId);
}

function buildTimeKeyboard(currentHour: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  // 06:00 to 21:00, 4 buttons per row
  for (let h = 6; h <= 21; h++) {
    const label =
      h === currentHour
        ? `✅ ${String(h).padStart(2, "0")}:00`
        : `${String(h).padStart(2, "0")}:00`;
    keyboard.text(label, `news_hour:${h}`);
    if ((h - 5) % 4 === 0) keyboard.row();
  }
  return keyboard;
}

export function registerSettings(bot: Bot) {
  bot.command("settings", async (ctx) => {
    if (!ctx.from || !isDeveloper(ctx.from.id)) {
      await ctx.reply("This command is for developers only.");
      return;
    }

    const currentHour = await getNewsHour();
    const keyboard = buildTimeKeyboard(currentHour);

    await ctx.reply(
      `⚙️ Bot Settings\n\n📰 Daily news time: ${String(currentHour).padStart(2, "0")}:00 (Tashkent)\n\nSelect new time:`,
      { reply_markup: keyboard },
    );
  });

  bot.callbackQuery(/^news_hour:(\d+)$/, async (ctx) => {
    if (!ctx.from || !isDeveloper(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Developers only." });
      return;
    }

    const match = ctx.match as RegExpMatchArray;
    const hour = parseInt(match[1], 10);

    if (hour < 6 || hour > 21) {
      await ctx.answerCallbackQuery({ text: "Invalid hour." });
      return;
    }

    await setNewsHour(hour);

    const keyboard = buildTimeKeyboard(hour);

    await ctx.editMessageText(
      `⚙️ Bot Settings\n\n📰 Daily news time: ${String(hour).padStart(2, "0")}:00 (Tashkent) ✅\n\nSelect new time:`,
      { reply_markup: keyboard },
    );

    await ctx.answerCallbackQuery({
      text: `News time set to ${String(hour).padStart(2, "0")}:00`,
    });
  });
}
