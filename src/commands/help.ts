import { Bot } from "grammy";
import { getGroupLanguage } from "@/db/settings";
import { onCommand, t } from "@/i18n";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

export function registerHelp(bot: Bot) {
  onCommand(bot, ["help", "yordam", "помощь"], async (ctx) => {
    const lang =
      ctx.chat?.type === "group" || ctx.chat?.type === "supergroup"
        ? await getGroupLanguage(ctx.chat.id)
        : "uz";

    const tr = t(lang);
    const isDev = ctx.from ? DEVELOPER_IDS.includes(ctx.from.id) : false;

    const categories = [
      tr.groupCommands,
      ...(isDev ? [tr.devGroupCommands, tr.devBotCommands] : []),
    ];

    let text = tr.availableCommands;
    for (const category of categories) {
      text += `${category.title}\n`;
      for (const cmd of category.commands) {
        text += `  ${cmd.usage} — ${cmd.description}\n`;
      }
      text += "\n";
    }

    await ctx.reply(text, { reply_to_message_id: ctx.msg?.message_id });
  });
}
