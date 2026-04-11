import { Bot } from "grammy";
import { setGroupSetting, getGroupSetting, getGroupLanguage } from "@/db/settings";
import { onCommand, t } from "@/i18n";

export function registerNews(bot: Bot) {
  onCommand(bot, ["news", "yangiliklar", "новости"], async (ctx) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      await ctx.reply(t("uz").groupOnly);
      return;
    }

    const lang = await getGroupLanguage(ctx.chat.id);
    const current = await getGroupSetting(ctx.chat.id, "dailyNews");

    if (current === true) {
      await ctx.reply(t(lang).newsAlreadyEnabled, {
        reply_to_message_id: ctx.msg?.message_id,
      });
      return;
    }

    await setGroupSetting(ctx.chat.id, "dailyNews", true);
    await ctx.reply(t(lang).newsEnabled, {
      reply_to_message_id: ctx.msg?.message_id,
    });
  });

  onCommand(
    bot,
    ["cancelNews", "yangiliklar_bekor", "отмена_новостей"],
    async (ctx) => {
      if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
        await ctx.reply(t("uz").groupOnly);
        return;
      }

      const lang = await getGroupLanguage(ctx.chat.id);
      const current = await getGroupSetting(ctx.chat.id, "dailyNews");

      if (current !== true) {
        await ctx.reply(t(lang).newsNotEnabled, {
          reply_to_message_id: ctx.msg?.message_id,
        });
        return;
      }

      await setGroupSetting(ctx.chat.id, "dailyNews", false);
      await ctx.reply(t(lang).newsDisabled, {
        reply_to_message_id: ctx.msg?.message_id,
      });
    },
  );
}
