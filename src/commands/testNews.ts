import { Bot } from "grammy";
import { sendNewsToChat } from "@/scheduler/dailyNews";
import { getGroupLanguage } from "@/db/settings";
import { onCommand, t, type Lang } from "@/i18n";

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
      const lang: Lang =
        ctx.chat?.type === "group" || ctx.chat?.type === "supergroup"
          ? ((await getGroupLanguage(ctx.chat.id)) as Lang)
          : "uz";

      if (!ctx.from || !DEVELOPER_IDS.includes(ctx.from.id)) {
        await ctx.reply(t(lang).developerOnly, {
          reply_to_message_id: ctx.msg?.message_id,
        });
        return;
      }

      await ctx.reply(t(lang).sendingNews, {
        reply_to_message_id: ctx.msg?.message_id,
      });

      try {
        const sent = await sendNewsToChat(bot, ctx.chat!.id, lang);
        if (!sent) {
          await ctx.reply("No news available right now.");
        }
      } catch (err) {
        console.error("testNews error:", err);
        await ctx.reply("Failed to fetch news.");
      }
    },
  );
}
