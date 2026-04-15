import { Bot } from "grammy";
import {
  setGroupSetting,
  getGroupSetting,
  getGroupLanguage,
} from "@/db/settings";
import {
  listYoutubeChannels,
  upsertYoutubeChannel,
  deactivateYoutubeChannel,
} from "@/db/youtubeChannels";
import { resolveChannel } from "@/services/youtube";
import { sendEnglishContentToChat } from "@/scheduler/usefulContent";
import { getMonthlyUsefulClicksByChannel } from "@/db/usefulContent";
import { onCommand, t, type Lang } from "@/i18n";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number | undefined): boolean {
  return !!userId && DEVELOPER_IDS.includes(userId);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseYearMonth(arg: string | undefined): {
  year: number;
  month: number;
} {
  const now = new Date();
  if (!arg) {
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  const m = arg.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) {
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
}

export function registerEnglishContent(bot: Bot) {
  // ---------------------------------------------------------------------------
  // Group toggle: /ingliz /english /английский
  // ---------------------------------------------------------------------------
  onCommand(bot, ["ingliz", "english", "английский"], async (ctx) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      await ctx.reply(t("uz").groupOnly);
      return;
    }

    const lang = await getGroupLanguage(ctx.chat.id);
    const current = await getGroupSetting(ctx.chat.id, "englishContent");

    if (current === true) {
      await ctx.reply(t(lang).englishAlreadyEnabled, {
        reply_to_message_id: ctx.msg?.message_id,
      });
      return;
    }

    await setGroupSetting(ctx.chat.id, "englishContent", true);
    await ctx.reply(t(lang).englishEnabled, {
      reply_to_message_id: ctx.msg?.message_id,
    });
  });

  onCommand(
    bot,
    ["ingliz_bekor", "english_off", "отмена_английского"],
    async (ctx) => {
      if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
        await ctx.reply(t("uz").groupOnly);
        return;
      }

      const lang = await getGroupLanguage(ctx.chat.id);
      const current = await getGroupSetting(ctx.chat.id, "englishContent");

      if (current !== true) {
        await ctx.reply(t(lang).englishNotEnabled, {
          reply_to_message_id: ctx.msg?.message_id,
        });
        return;
      }

      await setGroupSetting(ctx.chat.id, "englishContent", false);
      await ctx.reply(t(lang).englishDisabled, {
        reply_to_message_id: ctx.msg?.message_id,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // Developer: /testEnglish — send now to current group
  // ---------------------------------------------------------------------------
  onCommand(bot, ["testEnglish", "test_ingliz"], async (ctx) => {
    const lang: Lang =
      ctx.chat?.type === "group" || ctx.chat?.type === "supergroup"
        ? ((await getGroupLanguage(ctx.chat.id)) as Lang)
        : "uz";

    if (!isDeveloper(ctx.from?.id)) {
      await ctx.reply(t(lang).developerOnly, {
        reply_to_message_id: ctx.msg?.message_id,
      });
      return;
    }

    try {
      const sent = await sendEnglishContentToChat(bot, ctx.chat!.id, lang);
      if (!sent) {
        await ctx.reply("No english content available right now.");
      }
    } catch (err) {
      console.error("testEnglish error:", err);
      await ctx.reply(
        `Failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Developer bot-DM: /addEnglishChannel <url|@handle|UC...>
  // ---------------------------------------------------------------------------
  bot.command("addEnglishChannel", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    if (!isDeveloper(ctx.from?.id)) {
      await ctx.reply(t("uz").developerOnly);
      return;
    }

    const input = ctx.match?.trim();
    if (!input) {
      await ctx.reply("Usage: /addEnglishChannel <url | @handle | UC...>");
      return;
    }

    try {
      const info = await resolveChannel(input);
      await upsertYoutubeChannel({
        channel_id: info.channelId,
        handle: info.handle,
        title: info.title,
        uploads_playlist_id: info.uploadsPlaylistId,
        is_active: true,
        category: "english",
      });
      await ctx.reply(
        `Added (english): ${info.title}\nchannel_id: ${info.channelId}\nuploads: ${info.uploadsPlaylistId}`,
      );
    } catch (err) {
      await ctx.reply(
        `Failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  bot.command("removeEnglishChannel", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    if (!isDeveloper(ctx.from?.id)) {
      await ctx.reply(t("uz").developerOnly);
      return;
    }

    const input = ctx.match?.trim();
    if (!input) {
      await ctx.reply("Usage: /removeEnglishChannel <channel_id>");
      return;
    }
    await deactivateYoutubeChannel(input);
    await ctx.reply(`Deactivated: ${input}`);
  });

  bot.command("listEnglishChannels", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    if (!isDeveloper(ctx.from?.id)) {
      await ctx.reply(t("uz").developerOnly);
      return;
    }

    const channels = await listYoutubeChannels(false, "english");
    if (channels.length === 0) {
      await ctx.reply("No english channels configured.");
      return;
    }

    const lines = channels.map(
      (c) =>
        `${c.is_active ? "[on]" : "[off]"} ${c.title} — ${c.channel_id}${c.handle ? ` (${c.handle})` : ""}`,
    );
    await ctx.reply(lines.join("\n"));
  });

  // ---------------------------------------------------------------------------
  // Developer bot-DM: /englishstats [YYYY-MM]
  // ---------------------------------------------------------------------------
  bot.command("englishstats", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (!isDeveloper(ctx.from?.id)) return;

    const arg = ctx.match?.toString().trim() || undefined;
    const { year, month } = parseYearMonth(arg);
    const stats = await getMonthlyUsefulClicksByChannel(year, month, "english");

    const label = `${year}-${String(month).padStart(2, "0")}`;
    if (stats.length === 0) {
      await ctx.reply(`No english content clicks for ${label}.`);
      return;
    }

    let text = `<b>English content clicks — ${label}</b>\n\n`;
    let totalClicks = 0;
    let totalVideos = 0;
    for (const row of stats) {
      totalClicks += row.clicks;
      totalVideos += row.videos;
      text += `<b>${escapeHtml(row.channel_title)}</b>\n`;
      text += `  ${row.videos} videos · ${row.clicks} clicks\n\n`;
    }
    text += `Total: ${totalVideos} videos, ${totalClicks} clicks\n`;
    text += `\nUse <code>/englishstats YYYY-MM</code> for another month.`;

    await ctx.reply(text, { parse_mode: "HTML" });
  });
}
