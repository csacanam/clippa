"use server";

import { requireAdmin, requireCreator } from "@/lib/auth-server";
import { explorerTxUrl, getUsdtBalance } from "@/lib/payments/celo";
import { createServerClient } from "@/lib/supabase/server";

function n(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
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
  users?: { email: string };
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
    creatorEmail: withCreator ? r.users?.email : undefined,
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
      "id, amount_usd, views_paid, status, tx_hash, created_at, clips!inner(platform, campaigns!inner(product_name)), users!inner(email)"
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
