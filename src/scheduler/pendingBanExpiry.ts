import cron from "node-cron";
import { Bot } from "grammy";
import { getExpiredPendingBans } from "@/db/pendingBans";
import { expirePendingBan } from "@/services/nsfwApproval";

const TIMEZONE = "Asia/Tashkent";
const EXPIRY_MS = 48 * 60 * 60 * 1000;

async function runExpirySweep(bot: Bot): Promise<void> {
  const cutoff = new Date(Date.now() - EXPIRY_MS);
  const rows = await getExpiredPendingBans(cutoff);
  if (rows.length === 0) return;
  console.log(`[nsfwExpiry] auto-dismissing ${rows.length} pending ban(s)`);
  for (const row of rows) {
    try {
      await expirePendingBan(bot, row.id);
    } catch (err) {
      console.error(`[nsfwExpiry] failed to expire ${row.id}:`, err);
    }
  }
}

export function startPendingBanExpiryScheduler(bot: Bot) {
  // Run once at startup to catch rows that aged past 48h while we were down,
  // then hourly.
  runExpirySweep(bot).catch((err) =>
    console.error("[nsfwExpiry] initial sweep error:", err),
  );

  cron.schedule(
    "0 * * * *",
    async () => {
      await runExpirySweep(bot);
    },
    { timezone: TIMEZONE },
  );

  console.log("Pending NSFW ban expiry scheduler started (hourly).");
}
