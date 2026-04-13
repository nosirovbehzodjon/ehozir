import { Bot, InlineKeyboard } from "grammy";
import {
  getNewsHours,
  setNewsHours,
  getUsefulContentHours,
  setUsefulContentHours,
} from "@/db/botSettings";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number): boolean {
  return DEVELOPER_IDS.includes(userId);
}

type Section = "news" | "useful";

function buildHoursKeyboard(
  section: Section,
  activeHours: number[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const prefix = section === "news" ? "news_hours_toggle" : "useful_hours_toggle";
  for (let h = 6; h <= 21; h++) {
    const isActive = activeHours.includes(h);
    const label = isActive
      ? `✅ ${String(h).padStart(2, "0")}:00`
      : `${String(h).padStart(2, "0")}:00`;
    keyboard.text(label, `${prefix}:${h}`);
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

async function buildSettingsMessage(
  section: Section,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
  if (section === "news") {
    const hours = await getNewsHours();
    return {
      text: `📰 Daily news\n\nActive hours: ${formatActiveHours(hours)} (Tashkent)\n\nTap to toggle hours on/off.`,
      keyboard: buildHoursKeyboard("news", hours),
    };
  }
  const hours = await getUsefulContentHours();
  return {
    text: `🎬 Useful content (YouTube)\n\nActive hours: ${formatActiveHours(hours)} (Tashkent)\n\nTap to toggle hours on/off.`,
    keyboard: buildHoursKeyboard("useful", hours),
  };
}

function buildSectionPicker(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📰 Daily news", "time_section:news")
    .text("🎬 Useful content", "time_section:useful");
}

export function registerSettings(bot: Bot) {
  bot.command("time", async (ctx) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") return;
    if (!ctx.from || !isDeveloper(ctx.from.id)) return;

    await ctx.reply(
      "⏰ Delivery time settings\n\nWhich feature do you want to configure?",
      { reply_markup: buildSectionPicker() },
    );
  });

  bot.callbackQuery(/^time_section:(news|useful)$/, async (ctx) => {
    if (!ctx.from || !isDeveloper(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Developers only." });
      return;
    }
    const section = (ctx.match as RegExpMatchArray)[1] as Section;
    const { text, keyboard } = await buildSettingsMessage(section);
    await ctx.editMessageText(text, { reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  async function handleToggle(
    section: Section,
    hour: number,
    getter: () => Promise<number[]>,
    setter: (h: number[]) => Promise<void>,
    ctx: any,
  ) {
    if (!ctx.from || !isDeveloper(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Developers only." });
      return;
    }
    if (hour < 6 || hour > 21) {
      await ctx.answerCallbackQuery({ text: "Invalid hour." });
      return;
    }

    const current = await getter();
    let updated: number[];

    if (current.includes(hour)) {
      if (current.length <= 1) {
        await ctx.answerCallbackQuery({
          text: "At least one hour must be active.",
        });
        return;
      }
      updated = current.filter((h) => h !== hour);
    } else {
      updated = [...current, hour];
    }

    await setter(updated);

    const { text, keyboard } = await buildSettingsMessage(section);
    await ctx.editMessageText(text, { reply_markup: keyboard });

    const label = section === "news" ? "News" : "Useful content";
    await ctx.answerCallbackQuery({
      text: `${label}: ${formatActiveHours(updated)}`,
    });
  }

  bot.callbackQuery(/^news_hours_toggle:(\d+)$/, async (ctx) => {
    const hour = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handleToggle("news", hour, getNewsHours, setNewsHours, ctx);
  });

  bot.callbackQuery(/^useful_hours_toggle:(\d+)$/, async (ctx) => {
    const hour = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handleToggle(
      "useful",
      hour,
      getUsefulContentHours,
      setUsefulContentHours,
      ctx,
    );
  });
}
