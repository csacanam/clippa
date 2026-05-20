import { requireAdmin } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/server";
import { sendAdminAlert } from "@/lib/telegram/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A clip failing this many consecutive scrapes is effectively frozen —
// its views (and the creator's earnings) stopped updating.
const STUCK_SYNC_ATTEMPTS = 30;
// A clip owed money for longer than this hasn't been getting paid.
const STUCK_PAYOUT_DAYS = 2;

/** Authorizes: Vercel Cron secret or an admin Privy token. */
async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
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

function n(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

function handle(url: string): string {
  const m = url.match(/tiktok\.com\/@([^/?#]+)/i);
  return m ? m[1] : url.slice(0, 48);
}

/**
 * Daily health check — catches the slow, silent failures that per-run
 * alerts miss: a clip whose views froze (so its creator silently stops
 * earning), or a clip owed money that hasn't been paid in days.
 *
 * Sends one consolidated alert to the admin only when something is wrong.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await authorize(req))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const sb = createServerClient();
    // Owed-clip / earnings comparisons are column-vs-column, which PostgREST
    // filters can't express — fetch the tracking clips and check in JS.
    // Run once a day, so the read is fine.
    const { data, error } = await sb
      .from("clips")
      .select(
        "id, post_url, sync_attempts, earnings_usd, paid_out_usd, last_payout_at, created_at"
      )
      .eq("status", "tracking");
    if (error) throw new Error(error.message);

    const clips = (data ?? []) as Array<{
      id: string;
      post_url: string;
      sync_attempts: number;
      earnings_usd: string | number;
      paid_out_usd: string | number;
      last_payout_at: string | null;
      created_at: string;
    }>;

    const frozen = clips.filter(
      (c) => (c.sync_attempts ?? 0) >= STUCK_SYNC_ATTEMPTS
    );
    const payoutCutoff = Date.now() - STUCK_PAYOUT_DAYS * 86_400_000;
    const unpaid = clips.filter((c) => {
      if (n(c.earnings_usd) <= n(c.paid_out_usd)) return false;
      const since = new Date(c.last_payout_at ?? c.created_at).getTime();
      return since < payoutCutoff;
    });

    console.log(
      `[cron/health] tracking=${clips.length} frozen=${frozen.length} unpaid=${unpaid.length}`
    );

    if (frozen.length === 0 && unpaid.length === 0) {
      return Response.json({ ok: true, frozen: 0, unpaid: 0 });
    }

    let msg = "🩺 <b>Chequeo de salud</b>\n";
    if (frozen.length > 0) {
      msg += `\n⚠️ ${frozen.length} clip(s) con views congeladas (no se pueden scrapear):\n`;
      msg += frozen
        .slice(0, 15)
        .map((c) => `• ${handle(c.post_url)} — falló ${c.sync_attempts}×`)
        .join("\n");
      if (frozen.length > 15) msg += `\n• +${frozen.length - 15}`;
      msg += "\n";
    }
    if (unpaid.length > 0) {
      msg += `\n⚠️ ${unpaid.length} clip(s) con pago pendiente hace +${STUCK_PAYOUT_DAYS} días:\n`;
      msg += unpaid
        .slice(0, 15)
        .map((c) => {
          const owed = n(c.earnings_usd) - n(c.paid_out_usd);
          return `• ${handle(c.post_url)} — debe $${owed.toFixed(2)}`;
        })
        .join("\n");
      if (unpaid.length > 15) msg += `\n• +${unpaid.length - 15}`;
    }

    await sendAdminAlert(msg);
    return Response.json({
      ok: true,
      frozen: frozen.length,
      unpaid: unpaid.length,
    });
  } catch (e) {
    const m = (e as Error).message;
    console.error(`[cron/health] error ${m}`);
    await sendAdminAlert(`🚨 <b>El chequeo de salud crasheó</b>: ${m}`);
    return Response.json({ ok: false, error: m }, { status: 500 });
  }
}
