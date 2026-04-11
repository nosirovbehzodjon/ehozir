import { Bot, InlineKeyboard } from "grammy";
import { getNewsHours, setNewsHours } from "@/db/botSettings";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number): boolean {
  return DEVELOPER_IDS.includes(userId);
}

function buildTimeKeyboard(activeHours: number[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  // 06:00 to 21:00, 4 buttons per row
  for (let h = 6; h <= 21; h++) {
    const isActive = activeHours.includes(h);
    const label = isActive
      ? `✅ ${String(h).padStart(2, "0")}:00`
      : `${String(h).padStart(2, "0")}:00`;
    keyboard.text(label, `news_hours_toggle:${h}`);
    if ((h - 5) % 4 === 0) keyboard.row();
  }
  return keyboard;
}

function formatActiveHours(hours: number[]): string {
  return [...hours]
    .sort((a, b) => a - b)
    .map((h) => `${String(h).padStart(2, "0")}:00`)
    .join(", ");
}

export function registerSettings(bot: Bot) {
  bot.command("settings", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    const currentHours = await getNewsHours();
    const keyboard = buildTimeKeyboard(currentHours);

    await ctx.reply(
      `⚙️ Bot Settings\n\n📰 Daily news times: ${formatActiveHours(currentHours)} (Tashkent)\n\nTap to toggle hours on/off:`,
      { reply_markup: keyboard },
    );
  });

  bot.callbackQuery(/^news_hours_toggle:(\d+)$/, async (ctx) => {
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

    const currentHours = await getNewsHours();
    let updatedHours: number[];

    if (currentHours.includes(hour)) {
      // Don't allow removing the last hour
      if (currentHours.length <= 1) {
        await ctx.answerCallbackQuery({
          text: "At least one hour must be active.",
        });
        return;
      }
      updatedHours = currentHours.filter((h) => h !== hour);
    } else {
      updatedHours = [...currentHours, hour];
    }

    await setNewsHours(updatedHours);

    const keyboard = buildTimeKeyboard(updatedHours);

    await ctx.editMessageText(
      `⚙️ Bot Settings\n\n📰 Daily news times: ${formatActiveHours(updatedHours)} (Tashkent)\n\nTap to toggle hours on/off:`,
      { reply_markup: keyboard },
    );

    await ctx.answerCallbackQuery({
      text: `News times: ${formatActiveHours(updatedHours)}`,
    });
  });
}
