import { Bot } from "grammy";
import { setGroupSetting, getGroupSetting, getGroupLanguage } from "@/db/settings";
import {
  listYoutubeChannels,
  upsertYoutubeChannel,
  deactivateYoutubeChannel,
} from "@/db/youtubeChannels";
import { resolveChannel } from "@/services/youtube";
import { sendUsefulContentToChat } from "@/scheduler/usefulContent";
import { onCommand, t, type Lang } from "@/i18n";

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isDeveloper(userId: number | undefined): boolean {
  return !!userId && DEVELOPER_IDS.includes(userId);
}

export function registerUsefulContent(bot: Bot) {
  // ---------------------------------------------------------------------------
  // Group toggle: /foydali /useful /полезное
  // ---------------------------------------------------------------------------
  onCommand(bot, ["foydali", "useful", "полезное"], async (ctx) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      await ctx.reply(t("uz").groupOnly);
      return;
    }

    const lang = await getGroupLanguage(ctx.chat.id);
    const current = await getGroupSetting(ctx.chat.id, "usefulContent");

    if (current === true) {
      await ctx.reply(t(lang).usefulAlreadyEnabled, {
        reply_to_message_id: ctx.msg?.message_id,
      });
      return;
    }

    await setGroupSetting(ctx.chat.id, "usefulContent", true);
    await ctx.reply(t(lang).usefulEnabled, {
      reply_to_message_id: ctx.msg?.message_id,
    });
  });

  onCommand(
    bot,
    ["foydali_bekor", "useful_off", "отмена_полезного"],
    async (ctx) => {
      if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
        await ctx.reply(t("uz").groupOnly);
        return;
      }

      const lang = await getGroupLanguage(ctx.chat.id);
      const current = await getGroupSetting(ctx.chat.id, "usefulContent");

      if (current !== true) {
        await ctx.reply(t(lang).usefulNotEnabled, {
          reply_to_message_id: ctx.msg?.message_id,
        });
        return;
      }

      await setGroupSetting(ctx.chat.id, "usefulContent", false);
      await ctx.reply(t(lang).usefulDisabled, {
        reply_to_message_id: ctx.msg?.message_id,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // Developer: /testUseful — send now to current group
  // ---------------------------------------------------------------------------
  onCommand(bot, ["testUseful", "test_foydali"], async (ctx) => {
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
      const sent = await sendUsefulContentToChat(bot, ctx.chat!.id, lang);
      if (!sent) {
        await ctx.reply("No useful content available right now.");
      }
    } catch (err) {
      console.error("testUseful error:", err);
      await ctx.reply(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ---------------------------------------------------------------------------
  // Developer bot-DM: /addChannel <url|@handle|UC...>
  // ---------------------------------------------------------------------------
  bot.command("addChannel", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    if (!isDeveloper(ctx.from?.id)) {
      await ctx.reply(t("uz").developerOnly);
      return;
    }

    const input = ctx.match?.trim();
    if (!input) {
      await ctx.reply("Usage: /addChannel <url | @handle | UC...>");
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
      });
      await ctx.reply(
        `Added: ${info.title}\nchannel_id: ${info.channelId}\nuploads: ${info.uploadsPlaylistId}`,
      );
    } catch (err) {
      await ctx.reply(
        `Failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  bot.command("removeChannel", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    if (!isDeveloper(ctx.from?.id)) {
      await ctx.reply(t("uz").developerOnly);
      return;
    }

    const input = ctx.match?.trim();
    if (!input) {
      await ctx.reply("Usage: /removeChannel <channel_id>");
      return;
    }
    await deactivateYoutubeChannel(input);
    await ctx.reply(`Deactivated: ${input}`);
  });

  bot.command("listChannels", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    if (!isDeveloper(ctx.from?.id)) {
      await ctx.reply(t("uz").developerOnly);
      return;
    }

    const channels = await listYoutubeChannels(false);
    if (channels.length === 0) {
      await ctx.reply("No YouTube channels configured.");
      return;
    }

    const lines = channels.map(
      (c) =>
        `${c.is_active ? "[on]" : "[off]"} ${c.title} — ${c.channel_id}${c.handle ? ` (${c.handle})` : ""}`,
    );
    await ctx.reply(lines.join("\n"));
  });
}
