import { Bot } from "grammy";
import { getActiveCommands } from "@/db/commands";

export function registerHelp(bot: Bot) {
  bot.command("help", async (ctx) => {
    const commands = await getActiveCommands();

    if (commands.length === 0) {
      await ctx.reply("No commands available.");
      return;
    }

    let text = "Available commands:\n\n";
    for (const cmd of commands) {
      text += `${cmd.usage ?? `/${cmd.name}`} — ${cmd.description}\n`;
    }

    await ctx.reply(text, { reply_to_message_id: ctx.msg.message_id });
  });
}
