import { Bot } from "grammy";
import { getGroupStats, setTelegramMemberCount } from "@/db/groups";

export function registerStats(bot: Bot) {
  bot.command("stats", async (ctx) => {
    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
      await ctx.reply("This command only works in groups.");
      return;
    }

    let total: number | null = null;
    try {
      total = await ctx.getChatMemberCount();
      await setTelegramMemberCount(ctx.chat.id, total);
    } catch (err) {
      console.error("getChatMemberCount failed:", err);
    }

    const stats = await getGroupStats(ctx.chat.id);
    const totalShown = total ?? stats.total;

    const lines = [
      `Tracked by bot: ${stats.tracked}`,
      `Total in group: ${totalShown ?? "unknown"}`,
      "",
      "Members are added as they send messages or join.",
    ];

    await ctx.reply(lines.join("\n"), {
      reply_to_message_id: ctx.msg.message_id,
    });
  });
}
