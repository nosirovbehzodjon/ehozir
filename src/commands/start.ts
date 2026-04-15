import { Bot, InlineKeyboard, type Context } from "grammy";
import { t, type Lang, DEFAULT_LANG } from "@/i18n";
import { translations } from "@/i18n/translations";
import { upsertUser, getUser, setUserLanguage } from "@/db/users";

function languagePickerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("O'zbekcha", "start:lang:uz")
    .text("Русский", "start:lang:ru")
    .text("English", "start:lang:en");
}

function welcomeKeyboard(lang: Lang, botUsername: string): InlineKeyboard {
  const tr = t(lang);
  return new InlineKeyboard()
    .url(
      tr.startAddToGroupButton,
      `https://t.me/${botUsername}?startgroup=true`,
    )
    .row()
    .text(tr.startCapabilitiesButton, "start:caps");
}

async function sendWelcome(ctx: Context, lang: Lang, userId: number) {
  const user = await getUser(userId);
  const points = user?.points ?? 0;
  const botUsername = ctx.me.username;
  await ctx.reply(t(lang).startWelcome(points), {
    parse_mode: "HTML",
    reply_markup: welcomeKeyboard(lang, botUsername),
    link_preview_options: { is_disabled: true },
  });
}

export function registerStart(bot: Bot) {
  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    if (!ctx.from) return;

    // Look up first — if the row exists, the user has already picked a
    // language before and we skip straight to the welcome.
    const existing = await getUser(ctx.from.id);
    await upsertUser(ctx.from);

    if (existing) {
      await sendWelcome(ctx, existing.language, ctx.from.id);
      return;
    }

    await ctx.reply(translations[DEFAULT_LANG].startPickLanguage, {
      reply_markup: languagePickerKeyboard(),
    });
  });

  bot.callbackQuery(/^start:lang:(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match![1] as Lang;
    if (!ctx.from) return;

    await upsertUser(ctx.from);
    await setUserLanguage(ctx.from.id, lang);

    await ctx.answerCallbackQuery(t(lang).startLanguageSaved);
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {
      // message may be too old to edit; ignore
    }
    await sendWelcome(ctx, lang, ctx.from.id);
  });

  bot.callbackQuery("start:caps", async (ctx) => {
    if (!ctx.from) return;
    const user = await getUser(ctx.from.id);
    const lang = user?.language ?? DEFAULT_LANG;
    await ctx.answerCallbackQuery();
    await ctx.reply(t(lang).capabilitiesFull, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });
}
