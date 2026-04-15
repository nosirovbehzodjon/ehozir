import { Bot } from "grammy";
import { onCommand } from "@/i18n";
import { translations, DEFAULT_LANG } from "@/i18n/translations";
import { getGroupLanguage } from "@/db/settings";
import { upsertUser, getUser, awardInvitePoints } from "@/db/users";

const INVITE_POINTS = 10;

const DEVELOPER_IDS = (process.env.DEVELOPER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

/**
 * Post a warm greeting when the bot is added to a new group, and register
 * the /imkoniyatlarim (+ /capabilities, /возможности) command that shows
 * the full capability list in the group's language.
 */
export function registerGreeting(bot: Bot) {
  // my_chat_member fires whenever the bot's own membership status changes.
  // We only greet on the transition from non-member → member/admin.
  bot.on("my_chat_member", async (ctx) => {
    const upd = ctx.myChatMember;
    if (!upd) return;

    const chat = upd.chat;
    if (chat.type !== "group" && chat.type !== "supergroup") return;

    const oldStatus = upd.old_chat_member.status;
    const newStatus = upd.new_chat_member.status;

    const wasOutside = oldStatus === "left" || oldStatus === "kicked";
    const isInside = newStatus === "member" || newStatus === "administrator";

    if (!wasOutside || !isInside) return;

    // Skip greeting when a developer added the bot — they already know
    // what it does and don't need the welcome copy in their test groups.
    if (upd.from && DEVELOPER_IDS.includes(upd.from.id)) return;

    // Language defaults to Uzbek for brand-new groups; if someone already
    // set a language before re-adding, we honour it.
    const lang = await getGroupLanguage(chat.id).catch(() => DEFAULT_LANG);

    try {
      await ctx.api.sendMessage(chat.id, translations[lang].greeting);
    } catch (err) {
      console.error("[greeting] failed to send greeting:", err);
    }

    // Award invite points to the user who added the bot. Skip developers
    // (they're already excluded above via early return). The unique row
    // in user_group_invites keeps this idempotent per (inviter, chat).
    if (upd.from && !upd.from.is_bot) {
      try {
        await upsertUser(upd.from);
        const awarded = await awardInvitePoints(
          upd.from.id,
          chat.id,
          INVITE_POINTS,
        );
        if (awarded > 0) {
          const inviter = await getUser(upd.from.id);
          const inviterLang = inviter?.language ?? DEFAULT_LANG;
          const total = inviter?.points ?? awarded;
          try {
            await ctx.api.sendMessage(
              upd.from.id,
              translations[inviterLang].invitePointsAwarded(awarded, total),
              { parse_mode: "HTML" },
            );
          } catch {
            // user hasn't started the bot in DM — silently skip notification
          }
        }
      } catch (err) {
        console.error("[greeting] invite points error:", err);
      }
    }
  });

  // /imkoniyatlarim (uz), /capabilities (en), /возможности (ru)
  onCommand(
    bot,
    ["imkoniyatlarim", "capabilities", "возможности"],
    async (ctx) => {
      const chat = ctx.chat;
      if (!chat) return;

      const lang =
        chat.type === "group" || chat.type === "supergroup"
          ? await getGroupLanguage(chat.id)
          : DEFAULT_LANG;

      await ctx.reply(translations[lang].capabilitiesFull, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    },
  );
}
