import { Bot } from "grammy";
import { sendDailyNews } from "@/scheduler/dailyNews";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

export function registerTestNews(bot: Bot) {
  bot.command("testNews", async (ctx) => {
    if (!ctx.from || !DEVELOPER_IDS.includes(ctx.from.id)) {
      await ctx.reply("This command is for developers only.", {
        reply_to_message_id: ctx.msg.message_id,
      });
      return;
    }

    await ctx.reply("Sending news to all subscribed groups...", {
      reply_to_message_id: ctx.msg.message_id,
    });

    const count = await sendDailyNews(bot);

    await ctx.reply(`Done. News sent to ${count} group(s).`);
  });
}
