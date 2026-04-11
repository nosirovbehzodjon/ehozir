import { Bot } from "grammy";
import { getGroupLanguage } from "@/db/settings";
import { onCommand, t } from "@/i18n";

export function registerHelp(bot: Bot) {
  onCommand(bot, ["help", "yordam", "помощь"], async (ctx) => {
    const lang =
      ctx.chat?.type === "group" || ctx.chat?.type === "supergroup"
        ? await getGroupLanguage(ctx.chat.id)
        : "uz";

    const tr = t(lang);

    if (tr.commands.length === 0) {
      await ctx.reply(tr.noCommands);
      return;
    }

    let text = tr.availableCommands;
    for (const cmd of tr.commands) {
      text += `${cmd.usage} — ${cmd.description}\n`;
    }

    await ctx.reply(text, { reply_to_message_id: ctx.msg?.message_id });
  });
}
