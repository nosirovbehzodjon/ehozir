import { Bot } from "grammy";
import type { Context, NextFunction } from "grammy";
import { translations, type Lang } from "./translations";
export { type Lang, DEFAULT_LANG } from "./translations";

export function t(lang: Lang) {
  return translations[lang];
}

/**
 * Register a command handler with multiple aliases (Latin + Cyrillic).
 * Latin aliases use bot.command(), Cyrillic aliases use bot.hears().
 */
export function onCommand(
  bot: Bot,
  aliases: string[],
  handler: (ctx: Context, next: NextFunction) => Promise<void>,
) {
  const latin = aliases.filter((a) => /^[a-zA-Z0-9_]+$/.test(a));
  const nonLatin = aliases.filter((a) => !/^[a-zA-Z0-9_]+$/.test(a));

  if (latin.length > 0) {
    bot.command(latin, handler);
  }

  for (const alias of nonLatin) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    bot.hears(new RegExp(`^\\/${escaped}(@\\S+)?(\\s|$)`), handler);
  }
}
