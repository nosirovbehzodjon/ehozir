import { Bot } from "grammy";
import { sendDailyNews } from "@/scheduler/dailyNews";
import { getGroupLanguage } from "@/db/settings";
import { onCommand, t } from "@/i18n";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

export function registerTestNews(bot: Bot) {
  onCommand(
    bot,
    ["testNews", "test_yangiliklar", "тест_новости"],
    async (ctx) => {
      if (!ctx.from || !DEVELOPER_IDS.includes(ctx.from.id)) {
        const lang =
          ctx.chat?.type === "group" || ctx.chat?.type === "supergroup"
            ? await getGroupLanguage(ctx.chat.id)
            : "uz";
        await ctx.reply(t(lang).developerOnly, {
          reply_to_message_id: ctx.msg?.message_id,
        });
        return;
      }

      const lang =
        ctx.chat?.type === "group" || ctx.chat?.type === "supergroup"
          ? await getGroupLanguage(ctx.chat.id)
          : "uz";

      await ctx.reply(t(lang).sendingNews, {
        reply_to_message_id: ctx.msg?.message_id,
      });

      const count = await sendDailyNews(bot);

      await ctx.reply(t(lang).newsSent(count));
    },
  );
}
