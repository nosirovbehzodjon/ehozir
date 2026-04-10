import { Bot } from "grammy";
import { setGroupSetting, getGroupSetting } from "@/db/settings";

export function registerNews(bot: Bot) {
  bot.command("news", async (ctx) => {
    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
      await ctx.reply("This command only works in groups.");
      return;
    }

    const current = await getGroupSetting(ctx.chat.id, "dailyNews");

    if (current === true) {
      await ctx.reply("Daily news is already enabled for this group.", {
        reply_to_message_id: ctx.msg.message_id,
      });
      return;
    }

    await setGroupSetting(ctx.chat.id, "dailyNews", true);
    await ctx.reply(
      "Daily news enabled! This group will receive news every day.",
      { reply_to_message_id: ctx.msg.message_id },
    );
  });

  bot.command("cancelNews", async (ctx) => {
    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
      await ctx.reply("This command only works in groups.");
      return;
    }

    const current = await getGroupSetting(ctx.chat.id, "dailyNews");

    if (current !== true) {
      await ctx.reply("Daily news is not enabled for this group.", {
        reply_to_message_id: ctx.msg.message_id,
      });
      return;
    }

    await setGroupSetting(ctx.chat.id, "dailyNews", false);
    await ctx.reply("Daily news disabled for this group.", {
      reply_to_message_id: ctx.msg.message_id,
    });
  });
}
