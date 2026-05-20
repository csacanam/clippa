import "server-only";

import { createServerClient } from "@/lib/supabase/server";

import { sendToTopic } from "./send";

/**
 * Community payout digest. After a payout run finishes draining the queue,
 * one message is posted to the Telegram community (Spanish + English
 * topics) summarizing every payout that hasn't been announced yet.
 *
 * `payouts.announced_at` marks what's already gone out, so this is safe to
 * call after every drain — it only ever posts the new payouts.
 *
 * Env:
 *   TELEGRAM_TOPIC_ID_ES / TELEGRAM_TOPIC_ID_EN  — forum topic ids
 *   TELEGRAM_PAYOUT_THRESHOLD_USD  — skip the digest when the run's total
 *                                    is below this; default 0.50
 */

const APP_URL = "https://clippa.fun";
// At most this many creator lines before we collapse the tail into a "+N".
const MAX_LINES = 12;

/** One creator's total for the digest. */
/** One paid clip in the digest — one line, linking to the clip itself. */
type DigestEntry = {
  handle: string | null;
  amountUsd: number;
  postUrl: string;
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/** TikTok @handle out of a canonical post URL; null for IG / other. */
function handleFromPostUrl(url: string): string | null {
  const m = url.match(/tiktok\.com\/@([^/?#]+)/i);
  return m ? m[1] : null;
}

function renderLines(
  entries: DigestEntry[],
  noHandleLabel: string
): string {
  const shown = entries.slice(0, MAX_LINES);
  const lines = shown.map((e) => {
    // Each line links to the actual clip that earned the money — explicit
    // <a> link (not a "@mention", which Telegram would mis-route). Lets
    // the community watch the real money-making video.
    const label = e.handle ? escapeHtml(e.handle) : noHandleLabel;
    const who = `<a href="${escapeAttr(e.postUrl)}">${label}</a>`;
    return `• ${who} — ${fmtUsd(e.amountUsd)}`;
  });
  const hidden = entries.length - shown.length;
  if (hidden > 0) lines.push(`• +${hidden}`);
  return lines.join("\n");
}

function renderEs(entries: DigestEntry[], total: number): string {
  return `💸 <b>Nuevos pagos enviados en Clippa</b>

<b>${fmtUsd(total)}</b> pagados a creadores por sus clips.

Pagos de hoy:
${renderLines(entries, "un creador")}

Haz clips. Recibe pagos.

<a href="${APP_URL}">clippa.fun</a>`;
}

function renderEn(entries: DigestEntry[], total: number): string {
  return `💸 <b>New payouts sent on Clippa</b>

<b>${fmtUsd(total)}</b> paid out to creators for their clips.

Today's payouts:
${renderLines(entries, "a creator")}

Make clips. Get paid.

<a href="${APP_URL}">clippa.fun</a>`;
}

/** Test-only: render both languages from sample entries without DB / send. */
export function renderDigestPreview(
  entries: DigestEntry[]
): { es: string; en: string; total: number } {
  const total = entries.reduce((s, e) => s + e.amountUsd, 0);
  return { es: renderEs(entries, total), en: renderEn(entries, total), total };
}

export type { DigestEntry };

/**
 * Posts the digest of every not-yet-announced `sent` payout to the
 * community topics, then marks them announced. Best-effort and idempotent.
 */
export async function announcePendingPayouts(): Promise<{
  announced: number;
  totalUsd: number;
  posted: boolean;
}> {
  const sb = createServerClient();

  const { data, error } = await sb
    .from("payouts")
    .select("id, amount_usd, clips!inner(post_url)")
    .eq("status", "sent")
    .is("announced_at", null);
  if (error) {
    console.error(`[telegram] digest query failed: ${error.message}`);
    return { announced: 0, totalUsd: 0, posted: false };
  }
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    amount_usd: string | number;
    clips: { post_url: string };
  }>;
  if (rows.length === 0) return { announced: 0, totalUsd: 0, posted: false };

  // One line per paid clip — each links to the clip that earned the money.
  let total = 0;
  const entries: DigestEntry[] = rows
    .map((r) => {
      const amt =
        typeof r.amount_usd === "string"
          ? parseFloat(r.amount_usd)
          : r.amount_usd;
      total += amt;
      return {
        handle: handleFromPostUrl(r.clips.post_url),
        amountUsd: amt,
        postUrl: r.clips.post_url,
      };
    })
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const threshold = Number(process.env.TELEGRAM_PAYOUT_THRESHOLD_USD ?? "0.5");
  if (total < threshold) {
    console.log(
      `[telegram] digest total ${fmtUsd(total)} below threshold — skipping post`
    );
  } else {
    try {
      await sendToTopic(process.env.TELEGRAM_TOPIC_ID_ES, renderEs(entries, total));
      await sendToTopic(process.env.TELEGRAM_TOPIC_ID_EN, renderEn(entries, total));
    } catch (e) {
      console.error(
        `[telegram] announcePendingPayouts post failed: ${(e as Error).message}`
      );
    }
  }

  // Mark announced regardless — a posted digest shouldn't repeat, and a
  // below-threshold run shouldn't pile up into a later post either.
  const ids = rows.map((r) => r.id);
  const { error: markErr } = await sb
    .from("payouts")
    .update({ announced_at: new Date().toISOString() })
    .in("id", ids);
  if (markErr) {
    console.error(`[telegram] mark announced failed: ${markErr.message}`);
  }

  console.log(
    `[telegram] digest announced=${rows.length} total=${fmtUsd(total)}`
  );
  return { announced: rows.length, totalUsd: total, posted: total >= threshold };
}
