import { Bot } from "grammy";
import { getGroupLanguage } from "@/db/settings";
import { onCommand, t } from "@/i18n";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const CBU_API = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";
const WANTED = ["USD", "EUR", "RUB", "CNY"];

type CbuRate = {
  Ccy: string;
  CcyNm_UZ: string;
  CcyNm_RU: string;
  CcyNm_EN: string;
  Rate: string;
  Diff: string;
  Date: string;
};

async function fetchRates(): Promise<CbuRate[]> {
  const res = await fetch(CBU_API);
  if (!res.ok) throw new Error(`CBU API ${res.status}`);
  const data: CbuRate[] = await res.json();
  return data.filter((r) => WANTED.includes(r.Ccy));
}

const FLAGS: Record<string, string> = {
  USD: "\u{1F1FA}\u{1F1F8}",
  EUR: "\u{1F1EA}\u{1F1FA}",
  RUB: "\u{1F1F7}\u{1F1FA}",
  CNY: "\u{1F1E8}\u{1F1F3}",
};

function formatDiff(diff: string): string {
  const n = parseFloat(diff);
  const arrow = n > 0 ? "\u2197" : n < 0 ? "\u2198" : "";
  const sign = n > 0 ? `+${diff}` : diff;
  return `${arrow} ${sign}`;
}

function buildMessage(rates: CbuRate[], lang: "uz" | "ru" | "en"): string {
  const tr = t(lang);
  const date = rates[0]?.Date ?? "";

  const nameKey =
    lang === "uz" ? "CcyNm_UZ" : lang === "ru" ? "CcyNm_RU" : "CcyNm_EN";

  let msg = `${escapeHtml(tr.currencyTitle)} (${escapeHtml(date)})\n\n`;
  for (const r of rates) {
    const flag = FLAGS[r.Ccy] ?? "";
    msg += `${flag} ${escapeHtml(r[nameKey])} (${r.Ccy})\n`;
    msg += `   ${r.Rate} UZS  ${formatDiff(r.Diff)}\n\n`;
  }
  msg += `\n<a href="https://cbu.uz/">${tr.currencySource}</a>`;

  return msg;
}

export function registerCurrency(bot: Bot) {
  onCommand(bot, ["kurs", "rate", "курс"], async (ctx) => {
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      await ctx.reply(t("uz").groupOnly);
      return;
    }

    const lang = await getGroupLanguage(ctx.chat.id);

    try {
      const rates = await fetchRates();
      if (rates.length === 0) {
        await ctx.reply(t(lang).currencyError, {
          reply_to_message_id: ctx.msg?.message_id,
        });
        return;
      }
      const text = buildMessage(rates, lang);
      await ctx.reply(text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_to_message_id: ctx.msg?.message_id,
      });
    } catch (err) {
      console.error("[currency] fetch failed:", err);
      await ctx.reply(t(lang).currencyError, {
        reply_to_message_id: ctx.msg?.message_id,
      });
    }
  });
}
