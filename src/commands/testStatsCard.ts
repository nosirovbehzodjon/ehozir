import { Bot, InputFile } from "grammy";
import { renderStatsCard, renderLeaderboardCard } from "@/services/statsCard";
import { onCommand } from "@/i18n";
import { getGroupLanguage } from "@/db/settings";

const FALLBACK_AVATARS = [
  "https://api.dicebear.com/9.x/adventurer-neutral/png?flip=false&size=240&seed=Aneka",
  "https://api.dicebear.com/9.x/adventurer-neutral/png?seed=Felix&size=240",
];

function pickFallbackAvatar(): string {
  return FALLBACK_AVATARS[Math.floor(Math.random() * FALLBACK_AVATARS.length)];
}

async function getCallerAvatar(
  bot: Bot,
  api: any,
  userId: number,
): Promise<string> {
  try {
    const photos = await api.getUserProfilePhotos(userId, { limit: 1 });
    if (photos.total_count > 0) {
      // Pick the smallest size — satori embeds the image and resvg rasterizes
      // every pixel, so a 160px thumb renders ~10x faster than a 640px original.
      const sizes = photos.photos[0];
      const smallest = sizes[0];
      const file = await api.getFile(smallest.file_id);
      const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      console.log(`[teststats] using avatar: ${url}`);
      return url;
    }
    console.log(`[teststats] no profile photo, using fallback`);
  } catch (err) {
    console.error(`[teststats] getUserProfilePhotos failed:`, err);
  }
  return pickFallbackAvatar();
}

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

export function registerTestStatsCard(bot: Bot) {
  onCommand(bot, ["teststats", "test_stats"], async (ctx) => {
    if (!ctx.from || !DEVELOPER_IDS.includes(ctx.from.id)) return;
    if (!ctx.chat) return;

    await ctx.reply("Generating stats card...");

    try {
      const lang =
        ctx.chat.type === "group" || ctx.chat.type === "supergroup"
          ? await getGroupLanguage(ctx.chat.id)
          : undefined;

      const avatarUrl = await getCallerAvatar(bot, ctx.api, ctx.from.id);

      const png = await renderStatsCard({
        lang,
        groupTitle:
          (ctx.chat.type !== "private" && ctx.chat.title) || "Test Group",
        fullName:
          ctx.from.first_name +
          (ctx.from.last_name ? ` ${ctx.from.last_name}` : ""),
        username: ctx.from.username,
        avatarUrl,
        rank: 1,
        weekLabel: "Week 15 · April 2026",
        botUsername: bot.botInfo?.username,
        stats: {
          messages: 1247,
          replies: 312,
          reactionsGiven: 428,
          reactionsReceived: 561,
          stickers: 87,
          voices: 19,
          media: 73,
        },
      });

      await ctx.replyWithPhoto(new InputFile(png, "stats.png"), {
        caption: "Weekly Champion (test data)",
      });
    } catch (err) {
      console.error("teststats error:", err);
      await ctx.reply(`Failed to render card: ${(err as Error).message}`);
    }
  });

  onCommand(bot, ["testleaderboard", "test_leaderboard"], async (ctx) => {
    if (!ctx.from || !DEVELOPER_IDS.includes(ctx.from.id)) return;
    if (!ctx.chat) return;

    await ctx.reply("Generating leaderboard card...");

    try {
      const lang =
        ctx.chat.type === "group" || ctx.chat.type === "supergroup"
          ? await getGroupLanguage(ctx.chat.id)
          : undefined;

      // Reuse one small avatar for all 7 winners. The avatar cache in
      // statsCard.ts memoizes by URL, so resvg decodes the image exactly
      // once instead of 7 times — the main reason renders were slow.
      const avatarUrl = await getCallerAvatar(bot, ctx.api, ctx.from.id);

      const png = await renderLeaderboardCard({
        lang,
        groupTitle:
          (ctx.chat.type !== "private" && ctx.chat.title) || "Test Group",
        weekLabel: "Week 15 · April 2026",
        botUsername: bot.botInfo?.username,
        winners: [
          {
            category: "topMessager",
            fullName: "Nosirov Behzod",
            avatarUrl,
            count: 1247,
          },
          {
            category: "topReplier",
            fullName: "Akmal Tursunov",
            avatarUrl,
            count: 412,
          },
          {
            category: "topReactionGiver",
            fullName: "Jamshid Karimov",
            avatarUrl,
            count: 389,
          },
          {
            category: "topReactionReceiver",
            fullName: "Maftuna Yusupova",
            avatarUrl,
            count: 561,
          },
          {
            category: "topStickerSender",
            fullName: "Dilshod Rahimov",
            avatarUrl,
            count: 143,
          },
          {
            category: "topVoiceSender",
            fullName: "Gulnora Sobirova",
            avatarUrl,
            count: 68,
          },
          {
            category: "topMediaSender",
            fullName: "Sardor Aliyev",
            avatarUrl,
            count: 94,
          },
        ],
      });

      await ctx.replyWithPhoto(new InputFile(png, "leaderboard.png"), {
        caption: "Weekly Leaderboard (test data)",
      });
    } catch (err) {
      console.error("testleaderboard error:", err);
      await ctx.reply(`Failed to render card: ${(err as Error).message}`);
    }
  });
}
