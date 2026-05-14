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
  status: "active" | "paused" | "ended";
};

export function budgetRemaining(c: Campaign): number {
  return Math.max(0, c.totalBudgetUsd - c.spentUsd);
}

export function budgetPercentSpent(c: Campaign): number {
  if (c.totalBudgetUsd <= 0) return 0;
  return Math.min(100, Math.round((c.spentUsd / c.totalBudgetUsd) * 100));
}

export function formatUsd(n: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? 2;
  return `$${n.toFixed(decimals)}`;
}
