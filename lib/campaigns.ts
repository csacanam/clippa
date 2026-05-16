/**
 * Campaign types and pure helpers.
 * Data access lives in lib/actions/campaigns.ts (server actions).
 */

export type Platform = "instagram" | "tiktok";

export type Campaign = {
  slug: string;
  productName: string;
  shortDescription: string;
  longDescription: string;
  exampleVideoUrl?: string;
  scriptMarkdown: string;
  instructionsMarkdown: string;
  ratePerViewUsd: number;
  maxPayoutPerClipUsd: number;
  totalBudgetUsd: number;
  spentUsd: number;
  platforms: Platform[];
  status: "pending_funding" | "active" | "paused" | "ended";
};

/**
 * The real budget state, read from the on-chain escrow contract — the single
 * source of truth for money. `total_budget_usd` / `spent_usd` in the DB are
 * not used for display (they can drift from on-chain).
 */
export type CampaignChainState = {
  /** Whether the campaign exists on-chain yet. */
  exists: boolean;
  /** Total USDT ever funded into the campaign. */
  totalFundedUsd: number;
  /** USDT still available for payouts. */
  balanceUsd: number;
  /** USDT already paid out to creators. */
  totalPaidOutUsd: number;
  /** 0 = Active, 1 = Paused, 2 = Ended. */
  status: number;
};

export function budgetPercentSpent(chain: CampaignChainState): number {
  if (chain.totalFundedUsd <= 0) return 0;
  return Math.min(
    100,
    Math.round((chain.totalPaidOutUsd / chain.totalFundedUsd) * 100)
  );
}

export function formatUsd(n: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? 2;
  return `$${n.toFixed(decimals)}`;
}
