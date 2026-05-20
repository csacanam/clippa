import "server-only";

import crypto from "node:crypto";

import {
  ensureGasStipend,
  explorerTxUrl,
  recordPayout,
  usdToBaseUnits,
} from "@/lib/payments/celo";
import { createServerClient } from "@/lib/supabase/server";

/**
 * One unit of work for the payout queue.
 *
 * Claims a small bounded chunk of owed `tracking` clips via the
 * `claim_payout_batch` RPC (FOR UPDATE SKIP LOCKED — a double-claim here
 * could double-pay, so the lock matters), pays each on-chain, and releases
 * the lease. Batches stay tiny because each `recordPayout` is a real Celo
 * transaction (~6-12 s).
 *
 * Idempotency: the contract rejects a repeated payoutId, so a crashed-and-
 * retried run can't double-pay even if the lease logic somehow failed.
 */
export type PayoutBatchResult = {
  processed: number;
  paid: number;
  failed: number;
  skippedForCap: number;
  totalPaidUsd: number;
  firstError?: string;
  paidTxs: { txHash: string; explorerUrl: string }[];
};

type ClaimedClip = {
  id: string;
  campaign_id: string;
  creator_id: string;
  verified_views: number;
  paid_views: number;
  earnings_usd: string | number;
  paid_out_usd: string | number;
};

function n(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

export async function runPayoutBatch(
  batchSize: number
): Promise<PayoutBatchResult> {
  const sb = createServerClient();
  // Per-run safety cap — bounds how much one invocation can move.
  const cap = Number(process.env.DAILY_PAYOUT_CAP_USD ?? "500");

  // 1. Claim a chunk of owed clips.
  const { data, error } = await sb.rpc("claim_payout_batch", {
    batch_size: batchSize,
  });
  if (error) throw new Error(`claim_payout_batch failed: ${error.message}`);
  const clips = (data ?? []) as ClaimedClip[];
  const empty: PayoutBatchResult = {
    processed: 0,
    paid: 0,
    failed: 0,
    skippedForCap: 0,
    totalPaidUsd: 0,
    paidTxs: [],
  };
  if (clips.length === 0) return empty;
  console.log(`[payout-worker] claimed ${clips.length} clips`);

  // 2. Fetch recipient wallets (the RPC returns clip columns only).
  const creatorIds = [...new Set(clips.map((c) => c.creator_id))];
  const { data: users } = await sb
    .from("users")
    .select("id, wallet_address")
    .in("id", creatorIds);
  const walletById = new Map<string, string>();
  for (const u of users ?? []) {
    const row = u as { id: string; wallet_address: string };
    walletById.set(row.id, row.wallet_address);
  }

  let paid = 0;
  let failed = 0;
  let skippedForCap = 0;
  let totalPaidUsd = 0;
  let firstError: string | undefined;
  const paidTxs: { txHash: string; explorerUrl: string }[] = [];
  const touchedCampaigns = new Set<string>();

  // 3. Pay each clip. Sequential — these are on-chain txs and we want a
  //    predictable, bounded run time.
  for (const clip of clips) {
    const earned = n(clip.earnings_usd);
    const paidOut = n(clip.paid_out_usd);
    const rawDelta = earned - paidOut;
    if (rawDelta <= 0) {
      await releaseLease(sb, clip.id);
      continue;
    }

    // Floor to whole USDT base units so on-chain + DB stay consistent.
    const deltaBaseUnits = usdToBaseUnits(rawDelta);
    if (deltaBaseUnits <= 0n) {
      await releaseLease(sb, clip.id);
      continue;
    }
    const delta = Number(deltaBaseUnits) / 1_000_000;

    if (totalPaidUsd + delta > cap) {
      skippedForCap++;
      await releaseLease(sb, clip.id);
      continue;
    }

    const recipient = walletById.get(clip.creator_id) as
      | `0x${string}`
      | undefined;
    if (!recipient) {
      failed++;
      if (!firstError) firstError = `No wallet for creator ${clip.creator_id}`;
      await releaseLease(sb, clip.id);
      continue;
    }

    const payoutId = crypto.randomUUID();
    const viewsPaidNow = Math.max(0, clip.verified_views - clip.paid_views);

    // a. Insert the pending payout row — its id IS the on-chain payoutId.
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
      failed++;
      if (!firstError) firstError = insert.error.message;
      await releaseLease(sb, clip.id);
      continue;
    }

    // b. Call the escrow contract.
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
          payout_locked_until: null,
        })
        .eq("id", clip.id);
      paid++;
      totalPaidUsd += delta;
      touchedCampaigns.add(clip.campaign_id);
      paidTxs.push({
        txHash: res.txHash,
        explorerUrl: explorerTxUrl(res.txHash),
      });

      // Best-effort gas stipend — a failure here must NOT undo the payout.
      try {
        await ensureGasStipend(recipient);
      } catch (e) {
        console.error(
          `[payout-worker] gas stipend failed for ${recipient}:`,
          (e as Error).message
        );
      }
    } else {
      await sb
        .from("payouts")
        .update({ status: "failed", error_message: res.error })
        .eq("id", payoutId);
      failed++;
      if (!firstError) firstError = res.error;
      await releaseLease(sb, clip.id);
    }
  }

  // 4. Recompute spent_usd for every campaign we paid into — a recompute
  //    (not an increment) stays correct even if a run is retried.
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

  console.log(
    `[payout-worker] done processed=${clips.length} paid=${paid} failed=${failed} skipped=${skippedForCap}`
  );
  return {
    processed: clips.length,
    paid,
    failed,
    skippedForCap,
    totalPaidUsd,
    firstError,
    paidTxs,
  };
}

/** Releases the payout lease so the clip can be reclaimed next run. */
async function releaseLease(
  sb: ReturnType<typeof createServerClient>,
  clipId: string
): Promise<void> {
  await sb
    .from("clips")
    .update({ payout_locked_until: null })
    .eq("id", clipId);
}
