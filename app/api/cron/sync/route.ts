import { requireAdmin } from "@/lib/auth-server";
import { runSyncBatch } from "@/lib/sync/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Drains the whole view-sync queue in one invocation. Scraping is parallel
// (bounded), so a batch is fast — the full Pro-plan ceiling lets one run
// sweep thousands of clips.
export const maxDuration = 300;

// Clips claimed per batch. The route loops batches until the queue is
// empty or the time budget runs out.
const BATCH_SIZE = 40;
// Stop starting new batches past this point so the function returns first.
const TIME_BUDGET_MS = 260_000;

/**
 * Authorizes the request: Vercel Cron secret, or an admin Privy token
 * (the dashboard's "Sync" button).
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
 * View-sync worker. Triggered hourly by Vercel Cron; also called by the
 * admin dashboard's "Sync" button.
 *
 * Drains the entire sync queue: loops bounded batches until the queue is
 * empty. Scraping inside a batch is parallel with a concurrency cap, so a
 * single invocation comfortably sweeps thousands of clips. If the time
 * budget is hit first, the leftover clips stay queued for the next run.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await authorize(req))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

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
    return Response.json({
      ok: true,
      drained,
      batches,
      processed,
      updated,
      failed,
      firstError,
    });
  } catch (e) {
    console.error(`[cron/sync] error ${(e as Error).message}`);
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
