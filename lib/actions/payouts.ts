"use server";

import { getCampaignIdBySlug } from "@/lib/actions/campaigns";
import { requireAdmin, requireCreator } from "@/lib/auth-server";
import {
  ensureGasStipend,
  explorerTxUrl,
  getUsdtBalance,
  recordPayout,
  usdToBaseUnits,
} from "@/lib/payments/celo";
import { createServerClient } from "@/lib/supabase/server";

export type RunPayoutsResult = {
  ok: true;
  paidCount: number;
  failedCount: number;
  skippedForCap: number;
  totalPaidUsd: number;
  firstError?: string;
};

type ClipRow = {
  id: string;
  campaign_id: string;
  creator_id: string;
  verified_views: number;
  paid_views: number;
  earnings_usd: string | number;
  paid_out_usd: string | number;
  creators: { wallet_address: string };
};

function n(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

/**
 * Pays out everything that's been earned but not yet paid.
 *
 * For each `tracking` clip with `earnings_usd > paid_out_usd`:
 *   1. delta = earnings - paid_out  (what we still owe)
 *   2. insert a `payouts` row (status: pending) — its id IS the on-chain payoutId
 *   3. call recordPayout() on the escrow contract
 *   4. on success: mark payout sent + advance clip.paid_out_usd / paid_views
 *      on failure: mark payout failed with the error
 *
 * Idempotency: the contract rejects a repeated payoutId, so even if this job
 * crashes mid-run and is retried, a clip can't be double-paid.
 *
 * A per-run cap (DAILY_PAYOUT_CAP_USD) bounds the blast radius.
 */
export async function runPayouts(
  identityToken: string,
  opts?: { campaignSlug?: string }
): Promise<RunPayoutsResult> {
  await requireAdmin(identityToken);
  const sb = createServerClient();

  const cap = Number(process.env.DAILY_PAYOUT_CAP_USD ?? "500");

  let q = sb
    .from("clips")
    .select(
      "id, campaign_id, creator_id, verified_views, paid_views, earnings_usd, paid_out_usd, creators!inner(wallet_address)"
    )
    .eq("status", "tracking")
    .order("created_at", { ascending: true });
  if (opts?.campaignSlug) {
    const id = await getCampaignIdBySlug(opts.campaignSlug);
    q = q.eq("campaign_id", id);
  }
  const { data, error } = await q;
  if (error) throw error;

  const clips = (data ?? []) as unknown as ClipRow[];

  let paidCount = 0;
  let failedCount = 0;
  let skippedForCap = 0;
  let totalPaidUsd = 0;
  let firstError: string | undefined;
  // Campaigns touched this run — their spent_usd is recomputed at the end.
  const touchedCampaigns = new Set<string>();

  for (const clip of clips) {
    const earned = n(clip.earnings_usd);
    const paidOut = n(clip.paid_out_usd);
    const rawDelta = earned - paidOut;
    if (rawDelta <= 0) continue;

    // Floor to whole USDT base units so on-chain + DB stay consistent.
    const deltaBaseUnits = usdToBaseUnits(rawDelta);
    if (deltaBaseUnits <= 0n) continue;
    const delta = Number(deltaBaseUnits) / 1_000_000;

    if (totalPaidUsd + delta > cap) {
      skippedForCap++;
      continue;
    }

    const payoutId = crypto.randomUUID();
    const recipient = clip.creators.wallet_address as `0x${string}`;
    const viewsPaidNow = Math.max(0, clip.verified_views - clip.paid_views);

    // 1. Insert the pending payout row — its id is the on-chain payoutId.
    const insert = await sb.from("payouts").insert({
      id: payoutId,
      clip_id: clip.id,
      creator_id: clip.creator_id,
      views_paid: viewsPaidNow,
      amount_usd: delta,
      rail: "celo",
      status: "pending",
      memo: `clip:${clip.id.slice(0, 8)}`,
    });
    if (insert.error) {
      failedCount++;
      if (!firstError) firstError = insert.error.message;
      continue;
    }

    // 2. Call the escrow contract.
    const res = await recordPayout({
      campaignUuid: clip.campaign_id,
      clipUuid: clip.id,
      payoutUuid: payoutId,
      recipient,
      amountUsd: delta,
    });

    if (res.ok) {
      await sb
        .from("payouts")
        .update({
          status: "sent",
          tx_hash: res.txHash,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", payoutId);
      await sb
        .from("clips")
        .update({
          paid_out_usd: paidOut + delta,
          paid_views: clip.verified_views,
          last_payout_at: new Date().toISOString(),
        })
        .eq("id", clip.id);
      paidCount++;
      totalPaidUsd += delta;
      touchedCampaigns.add(clip.campaign_id);

      // Best-effort gas stipend so the creator can sign their own withdrawal.
      // Privy embedded wallets can't pay gas in USDT, so they need a little
      // native CELO. A failure here must NOT undo the payout above.
      try {
        await ensureGasStipend(recipient);
      } catch (e) {
        console.error(
          `Gas stipend failed for ${recipient}:`,
          (e as Error).message
        );
      }
    } else {
      await sb
        .from("payouts")
        .update({ status: "failed", error_message: res.error })
        .eq("id", payoutId);
      failedCount++;
      if (!firstError) firstError = res.error;
    }
  }

  // Recompute spent_usd for every campaign we paid into — it's just the sum
  // of paid_out_usd across that campaign's clips. Doing it as a recompute
  // (rather than an increment) keeps it correct even if a run is retried.
  for (const campaignId of touchedCampaigns) {
    const { data: clipRows } = await sb
      .from("clips")
      .select("paid_out_usd")
      .eq("campaign_id", campaignId);
    const spent = (clipRows ?? []).reduce(
      (sum, r) => sum + n((r as { paid_out_usd: string | number }).paid_out_usd),
      0
    );
    await sb.from("campaigns").update({ spent_usd: spent }).eq("id", campaignId);
  }

  return {
    ok: true,
    paidCount,
    failedCount,
    skippedForCap,
    totalPaidUsd,
    firstError,
  };
}

// ============================================================
// Reads
// ============================================================

export type PayoutHistoryRow = {
  id: string;
  campaignName: string;
  platform: string;
  amountUsd: number;
  viewsPaid: number;
  status: "pending" | "sent" | "confirmed" | "failed";
  txHash: string | null;
  explorerUrl: string | null;
  createdAt: string;
  /** Only populated for the admin view. */
  creatorEmail?: string;
};

type PayoutJoinRow = {
  id: string;
  amount_usd: string | number;
  views_paid: number;
  status: PayoutHistoryRow["status"];
  tx_hash: string | null;
  created_at: string;
  clips: {
    platform: string;
    campaigns: { product_name: string };
  };
  creators?: { email: string };
};

function toHistoryRow(r: PayoutJoinRow, withCreator: boolean): PayoutHistoryRow {
  return {
    id: r.id,
    campaignName: r.clips.campaigns.product_name,
    platform: r.clips.platform,
    amountUsd: n(r.amount_usd),
    viewsPaid: r.views_paid,
    status: r.status,
    txHash: r.tx_hash,
    explorerUrl: r.tx_hash ? explorerTxUrl(r.tx_hash) : null,
    createdAt: r.created_at,
    creatorEmail: withCreator ? r.creators?.email : undefined,
  };
}

/** The current creator's full payout history, newest first. */
export async function listMyPayouts(
  identityToken: string
): Promise<PayoutHistoryRow[]> {
  const creator = await requireCreator(identityToken);
  const sb = createServerClient();
  const { data, error } = await sb
    .from("payouts")
    .select(
      "id, amount_usd, views_paid, status, tx_hash, created_at, clips!inner(platform, campaigns!inner(product_name))"
    )
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PayoutJoinRow[]).map((r) =>
    toHistoryRow(r, false)
  );
}

/** Every payout across all creators — admin only. */
export async function listAllPayouts(
  identityToken: string
): Promise<PayoutHistoryRow[]> {
  await requireAdmin(identityToken);
  const sb = createServerClient();
  const { data, error } = await sb
    .from("payouts")
    .select(
      "id, amount_usd, views_paid, status, tx_hash, created_at, clips!inner(platform, campaigns!inner(product_name)), creators!inner(email)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PayoutJoinRow[]).map((r) =>
    toHistoryRow(r, true)
  );
}

/** The current creator's real USDT balance on Celo. */
export async function getMyWalletBalance(
  identityToken: string
): Promise<number> {
  const creator = await requireCreator(identityToken);
  return getUsdtBalance(creator.wallet_address);
}
