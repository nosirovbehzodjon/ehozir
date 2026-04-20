import { Bot } from "grammy";
import {
  approvePendingBan,
  rejectPendingBan,
  type ApprovalResult,
} from "@/services/nsfwApproval";
import { getUser } from "@/db/users";
import { translations, DEFAULT_LANG } from "@/i18n/translations";

async function toast(
  ctx: any,
  key:
    | "nsfwToastApproved"
    | "nsfwToastRejected"
    | "nsfwToastAlreadyResolved"
    | "nsfwToastNotAuthorized",
): Promise<void> {
  const adminId = ctx.from?.id;
  let lang = DEFAULT_LANG;
  if (adminId) {
    const u = await getUser(adminId);
    lang = u?.language ?? DEFAULT_LANG;
  }
  await ctx.answerCallbackQuery({ text: translations[lang][key] });
}

async function describe(result: ApprovalResult, action: "approve" | "reject") {
  if (result === "ok") {
    return action === "approve" ? "nsfwToastApproved" : "nsfwToastRejected";
  }
  if (result === "not_authorized") return "nsfwToastNotAuthorized";
  return "nsfwToastAlreadyResolved";
}

export function registerNsfwApproval(bot: Bot) {
  bot.callbackQuery(/^nsfw:approve:(\d+)$/, async (ctx) => {
    const pendingId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    if (!ctx.from) return;
    const result = await approvePendingBan(bot, pendingId, ctx.from);
    const key = await describe(result, "approve");
    await toast(ctx, key);
  });

  bot.callbackQuery(/^nsfw:reject:(\d+)$/, async (ctx) => {
    const pendingId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    if (!ctx.from) return;
    const result = await rejectPendingBan(bot, pendingId, ctx.from);
    const key = await describe(result, "reject");
    await toast(ctx, key);
  });
}
