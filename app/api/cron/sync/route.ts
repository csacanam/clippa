import { after } from "next/server";

import { requireAdmin } from "@/lib/auth-server";
import { runSyncBatch } from "@/lib/sync/worker";
import { sendAdminAlert } from "@/lib/telegram/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The drain runs in `after()` (post-response), so it gets the full ceiling
// while the trigger itself returns instantly.
export const maxDuration = 300;

const BATCH_SIZE = 40;
const TIME_BUDGET_MS = 260_000;

/**
 * Authorizes the request: Vercel Cron secret / external-cron secret, or an
 * admin Privy token (the dashboard's "Sync" button).
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

/** Drains the whole view-sync queue, looping bounded batches. */
async function drainSyncQueue(): Promise<void> {
  const startedAt = Date.now();
  let processed = 0;
  let updated = 0;
  let failed = 0;
  let batches = 0;
  let firstError: string | undefined;
  let drained = false;

  try {
    for (;;) {
      const r = await runSyncBatch(BATCH_SIZE);
      batches++;
      processed += r.processed;
      updated += r.updated;
      failed += r.failed;
      if (r.firstError && !firstError) firstError = r.firstError;
      if (r.processed < BATCH_SIZE) {
        drained = true;
        break;
      }
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        console.warn("[cron/sync] time budget hit — queue not fully drained");
        break;
      }
    }
    console.log(
      `[cron/sync] batches=${batches} processed=${processed} updated=${updated} failed=${failed} drained=${drained} ${firstError ?? ""}`
    );
    if (failed > 0) {
      await sendAdminAlert(
        `⚠️ <b>Sync</b>: ${failed} de ${processed} clips fallaron al scrapear.\n` +
          `Primer error: ${firstError ?? "desconocido"}`
      );
    }
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`[cron/sync] error ${msg}`);
    await sendAdminAlert(`🚨 <b>El cron de sync crasheó</b>: ${msg}`);
  }
}

/**
 * View-sync trigger. Hit every ~10 min by an external scheduler
 * (cron-job.org) and also by the admin dashboard's "Sync" button.
 *
 * Responds instantly and drains the queue in `after()` — the sync is slow
 * (TikWM is rate-limited to 1 req/s), so a synchronous response would blow
 * the external scheduler's HTTP timeout and show false failures.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await authorize(req))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  after(drainSyncQueue);
  return Response.json({ ok: true, started: true });
}
