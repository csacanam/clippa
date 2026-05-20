import { requireAdmin } from "@/lib/auth-server";
import { runSyncBatch } from "@/lib/sync/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One batch is bounded, but scraping a chunk still takes a few seconds —
// give the function room.
export const maxDuration = 60;

// How many clips one invocation claims. Tuned to comfortably finish inside
// maxDuration even when some clips fall back to the slower Apify path.
const BATCH_SIZE = 25;

/**
 * Authorizes the request: either the Vercel Cron secret, or an admin's
 * Privy identity token (the admin dashboard's manual "Sync" button).
 */
async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  // Locally CRON_SECRET is usually unset — allow unauthenticated drain.
  if (!secret) return true;
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
 * View-sync worker. Triggered by Vercel Cron on a schedule; also called by
 * the admin dashboard's "Sync" button (which drains in a client-side loop).
 *
 * Each call claims and processes one bounded chunk. `likelyMore` is true
 * when a full batch came back — the caller keeps going until it's false.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await authorize(req))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const r = await runSyncBatch(BATCH_SIZE);
    console.log(
      `[cron/sync] processed=${r.processed} updated=${r.updated} failed=${r.failed} ${r.firstError ?? ""}`
    );
    return Response.json({
      ok: true,
      ...r,
      likelyMore: r.processed === BATCH_SIZE,
    });
  } catch (e) {
    console.error(`[cron/sync] error ${(e as Error).message}`);
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
