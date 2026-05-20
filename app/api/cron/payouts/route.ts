import { after } from "next/server";

import { requireAdmin } from "@/lib/auth-server";
import { runPayoutBatch } from "@/lib/payouts/worker";
import { announcePendingPayouts } from "@/lib/telegram/announce";
import { sendAdminAlert } from "@/lib/telegram/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Each clip is a Celo tx (~6-12 s) — give the run the full Pro ceiling.
export const maxDuration = 300;

const BATCH_SIZE = 4;
// Stop starting batches past this point so the function returns in time.
const TIME_BUDGET_MS = 240_000;
// Self-chain depth cap — 80 links × ~28 payouts ≈ 2200 payouts before the
// chain gives up and leaves the rest for the next daily run.
const MAX_CHAIN = 80;

/**
 * Authorizes the request: Vercel Cron secret, an admin Privy token (the
 * dashboard's "Run payouts" button), or an internal self-chain hop.
 */
async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  if (!secret) return true; // local dev — CRON_SECRET usually unset
  const token = req.headers.get("x-identity-token");
  if (!token) return false;
  try {
    await requireAdmin(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Payout worker — triggered once a day by Vercel Cron (also callable from
 * the admin dashboard). Drains the entire payout queue.
 *
 * One invocation loops bounded batches until the queue is empty OR its
 * time budget runs out. If the budget runs out first, it self-chains: it
 * re-triggers itself so the next invocation continues — so a single daily
 * trigger drains the whole queue no matter how large, without any single
 * function call timing out.
 *
 * The community payout digest is posted only once the queue is fully
 * drained (the real "all of today's payouts" moment). announcePendingPayouts
 * is idempotent via payouts.announced_at.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await authorize(req))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const chain = Number(new URL(req.url).searchParams.get("chain") ?? "0");
  const startedAt = Date.now();
  let paid = 0;
  let failed = 0;
  let skippedForCap = 0;
  let totalPaidUsd = 0;
  let batches = 0;
  let firstError: string | undefined;
  let drained = false;

  try {
    for (;;) {
      const r = await runPayoutBatch(BATCH_SIZE);
      batches++;
      paid += r.paid;
      failed += r.failed;
      skippedForCap += r.skippedForCap;
      totalPaidUsd += r.totalPaidUsd;
      if (r.firstError && !firstError) firstError = r.firstError;

      if (r.processed < BATCH_SIZE) {
        drained = true;
        break;
      }
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    }

    let digestAnnounced = 0;
    if (drained) {
      // Queue empty — post the day's digest.
      const digest = await announcePendingPayouts();
      digestAnnounced = digest.announced;
    } else if (chain < MAX_CHAIN) {
      // Budget hit with clips still owed — re-trigger to continue the drain
      // after this response is sent.
      const next = new URL(req.url);
      next.searchParams.set("chain", String(chain + 1));
      const secret = process.env.CRON_SECRET;
      after(async () => {
        try {
          await fetch(next.toString(), {
            headers: secret ? { authorization: `Bearer ${secret}` } : {},
          });
        } catch (e) {
          console.error(
            `[cron/payouts] self-chain trigger failed: ${(e as Error).message}`
          );
        }
      });
    } else {
      console.warn(
        `[cron/payouts] chain cap ${MAX_CHAIN} hit — leftover waits for next run`
      );
    }

    console.log(
      `[cron/payouts] chain=${chain} batches=${batches} paid=${paid} failed=${failed} drained=${drained} digest=${digestAnnounced} ${firstError ?? ""}`
    );
    // A failed payout means a creator didn't get paid — always worth an
    // alert. (Reported once, from the chain's first link.)
    if (failed > 0 && chain === 0) {
      await sendAdminAlert(
        `⚠️ <b>Pagos</b>: ${failed} pago(s) fallaron.\n` +
          `Primer error: ${firstError ?? "desconocido"}\n` +
          `Los clips quedan en cola y reintentan — revisa el balance del escrow.`
      );
    }
    return Response.json({
      ok: true,
      chain,
      drained,
      batches,
      paid,
      failed,
      skippedForCap,
      totalPaidUsd,
      digestAnnounced,
      firstError,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`[cron/payouts] error ${msg}`);
    await sendAdminAlert(`🚨 <b>El cron de pagos crasheó</b>: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
