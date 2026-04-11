import { Bot } from "grammy";
import { t, type Lang } from "@/i18n";
import { setGroupLanguage } from "@/db/settings";
import { upsertGroupAndMember } from "@/db/groups";

export function registerLanguage(bot: Bot) {
  for (const lang of ["uz", "ru", "en"] as Lang[]) {
    bot.command(lang, async (ctx) => {
      if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
        await ctx.reply(t(lang).groupOnly);
        return;
      }

      // Ensure group exists in DB before setting language
      if (ctx.from) {
        await upsertGroupAndMember(ctx.chat, ctx.from);
      }

      await setGroupLanguage(ctx.chat.id, lang);
      await ctx.reply(t(lang).languageChanged, {
        reply_to_message_id: ctx.msg.message_id,
      });
    });
  }
}
