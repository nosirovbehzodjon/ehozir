import { Bot } from "grammy";
import { setGroupSetting, getGroupSetting, getGroupLanguage } from "@/db/settings";
import { onCommand, t } from "@/i18n";

export const NSFW_FEATURE = "nsfwCheck";

export function registerSensitiveContent(bot: Bot) {
  onCommand(bot, ["sensitive_content"], async (ctx) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      await ctx.reply(t("uz").groupOnly);
      return;
    }

    const lang = await getGroupLanguage(ctx.chat.id);
    const current = await getGroupSetting(ctx.chat.id, NSFW_FEATURE);

    if (current === true) {
      await ctx.reply(t(lang).sensitiveAlreadyEnabled, {
        reply_to_message_id: ctx.msg?.message_id,
      });
      return;
    }

    await setGroupSetting(ctx.chat.id, NSFW_FEATURE, true);
    await ctx.reply(t(lang).sensitiveEnabled, {
      reply_to_message_id: ctx.msg?.message_id,
    });
  });

  onCommand(bot, ["sensitive_content_off"], async (ctx) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      await ctx.reply(t("uz").groupOnly);
      return;
    }

    const lang = await getGroupLanguage(ctx.chat.id);
    const current = await getGroupSetting(ctx.chat.id, NSFW_FEATURE);

    if (current !== true) {
      await ctx.reply(t(lang).sensitiveNotEnabled, {
        reply_to_message_id: ctx.msg?.message_id,
      });
      return;
    }

    await setGroupSetting(ctx.chat.id, NSFW_FEATURE, false);
    await ctx.reply(t(lang).sensitiveDisabled, {
      reply_to_message_id: ctx.msg?.message_id,
    });
  });
}
