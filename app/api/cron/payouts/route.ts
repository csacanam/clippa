import { requireAdmin } from "@/lib/auth-server";
import { runPayoutBatch } from "@/lib/payouts/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Each clip is a real Celo tx (~6-12 s). maxDuration gives the small batch
// room to finish.
export const maxDuration = 60;

// Tiny on purpose — on-chain txs are slow, so a batch of 4 stays well inside
// maxDuration. To pay more, the caller loops (cron fires again; the admin
// button drains in a client-side loop).
const BATCH_SIZE = 4;

/**
 * Authorizes the request: either the Vercel Cron secret, or an admin's
 * Privy identity token (the admin dashboard's "Run payouts" button).
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
 * Payout worker. Triggered by Vercel Cron; also called by the admin
 * dashboard's "Run payouts" button (which drains in a client-side loop).
 *
 * Each call claims and pays one bounded chunk. `likelyMore` is true when a
 * full batch came back — the caller keeps going until it's false.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await authorize(req))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const r = await runPayoutBatch(BATCH_SIZE);
    console.log(
      `[cron/payouts] processed=${r.processed} paid=${r.paid} failed=${r.failed} skipped=${r.skippedForCap} ${r.firstError ?? ""}`
    );
    return Response.json({
      ok: true,
      ...r,
      likelyMore: r.processed === BATCH_SIZE,
    });
  } catch (e) {
    console.error(`[cron/payouts] error ${(e as Error).message}`);
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
