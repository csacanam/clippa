"use server";

import { requireAdmin } from "@/lib/auth-server";
import { createServerClient } from "@/lib/supabase/server";
import type { Campaign, CampaignChainState, Platform } from "@/lib/campaigns";
import { getCampaignChainState } from "@/lib/payments/celo";

type CampaignRow = {
  id: string;
  slug: string;
  product_name: string;
  short_description: string;
  long_description: string;
  example_video_url: string | null;
  script_markdown: string;
  instructions_markdown: string;
  rate_per_view_usd: string | number;
  max_payout_per_clip_usd: string | number;
  total_budget_usd: string | number;
  spent_usd: string | number;
  platforms: string[];
  status: "active" | "paused" | "ended";
};

function n(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

function rowToCampaign(row: CampaignRow): Campaign {
  return {
    slug: row.slug,
    productName: row.product_name,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    exampleVideoUrl: row.example_video_url ?? undefined,
    scriptMarkdown: row.script_markdown,
    instructionsMarkdown: row.instructions_markdown,
    ratePerViewUsd: n(row.rate_per_view_usd),
    maxPayoutPerClipUsd: n(row.max_payout_per_clip_usd),
    totalBudgetUsd: n(row.total_budget_usd),
    spentUsd: n(row.spent_usd),
    platforms: row.platforms as Platform[],
    status: row.status,
  };
}

export async function listActiveCampaigns(): Promise<Campaign[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToCampaign(r as CampaignRow));
}

export async function findCampaignBySlug(slug: string): Promise<Campaign | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCampaign(data as CampaignRow) : null;
}

/**
 * Returns the internal UUID of a campaign by slug, or throws.
 * Used by other server actions that need to insert relations.
 */
export async function getCampaignIdBySlug(slug: string): Promise<string> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Campaign not found: ${slug}`);
  return (data as { id: string }).id;
}

/**
 * Reads the campaign's real budget state from the on-chain escrow contract.
 * This is the source of truth for funded / available / paid amounts.
 */
export async function getCampaignChainStateBySlug(
  slug: string
): Promise<CampaignChainState> {
  const campaignId = await getCampaignIdBySlug(slug);
  return getCampaignChainState(campaignId);
}

export type CampaignStats = {
  liveClipsCount: number;
  paidCreatorsCount: number;
};

/**
 * Public social-proof stats for a campaign:
 *  - liveClipsCount: clips currently tracking
 *  - paidCreatorsCount: distinct creators who've received at least one payout
 */
export async function getCampaignStats(slug: string): Promise<CampaignStats> {
  const sb = createServerClient();
  const campaignId = await getCampaignIdBySlug(slug);

  const liveClips = await sb
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "tracking");
  if (liveClips.error) throw liveClips.error;

  // Distinct creators with payouts on clips of this campaign.
  const paid = await sb
    .from("payouts")
    .select("creator_id, clips!inner(campaign_id)")
    .eq("clips.campaign_id", campaignId);
  if (paid.error) throw paid.error;
  const distinctCreators = new Set(
    ((paid.data ?? []) as { creator_id: string }[]).map((r) => r.creator_id)
  );

  return {
    liveClipsCount: liveClips.count ?? 0,
    paidCreatorsCount: distinctCreators.size,
  };
}

export type AdminCampaignBudget = {
  slug: string;
  productName: string;
  status: Campaign["status"];
  /** Number of clips currently tracking on this campaign. */
  liveClipsCount: number;
  /** Sum of (earnings - paid_out) across this campaign's tracking clips — what
   *  runPayouts would try to pay right now. */
  owedNowUsd: number;
  /** On-chain escrow state. exists:false if the campaign hasn't been funded yet. */
  chain: CampaignChainState;
};

/**
 * Per-campaign budget snapshot for the admin panel — answers "before I press
 * Run payouts, does each campaign have enough USDT in its escrow?".
 *
 * Lists every non-ended campaign. For each one, reads the on-chain balance
 * (source of truth for funded money) and aggregates the un-paid earnings of
 * its tracking clips. Excludes ended campaigns since they can't accrue more.
 */
export async function getAdminCampaignBudgets(
  identityToken: string
): Promise<AdminCampaignBudget[]> {
  await requireAdmin(identityToken);
  const sb = createServerClient();

  const { data: campaignRows, error: campErr } = await sb
    .from("campaigns")
    .select("id, slug, product_name, status")
    .neq("status", "ended")
    .order("created_at", { ascending: true });
  if (campErr) throw campErr;

  const campaigns = (campaignRows ?? []) as {
    id: string;
    slug: string;
    product_name: string;
    status: Campaign["status"];
  }[];
  if (campaigns.length === 0) return [];

  const ids = campaigns.map((c) => c.id);

  // One query for all tracking clips across these campaigns; group in memory.
  const { data: clipRows, error: clipErr } = await sb
    .from("clips")
    .select("campaign_id, earnings_usd, paid_out_usd")
    .in("campaign_id", ids)
    .eq("status", "tracking");
  if (clipErr) throw clipErr;

  const owedByCampaign = new Map<string, number>();
  const liveCountByCampaign = new Map<string, number>();
  for (const r of (clipRows ?? []) as {
    campaign_id: string;
    earnings_usd: string | number;
    paid_out_usd: string | number;
  }[]) {
    const delta = Math.max(0, n(r.earnings_usd) - n(r.paid_out_usd));
    owedByCampaign.set(
      r.campaign_id,
      (owedByCampaign.get(r.campaign_id) ?? 0) + delta
    );
    liveCountByCampaign.set(
      r.campaign_id,
      (liveCountByCampaign.get(r.campaign_id) ?? 0) + 1
    );
  }

  // Fetch on-chain state in parallel — one RPC per campaign.
  const chainStates = await Promise.all(
    campaigns.map((c) => getCampaignChainState(c.id))
  );

  return campaigns.map((c, i) => ({
    slug: c.slug,
    productName: c.product_name,
    status: c.status,
    liveClipsCount: liveCountByCampaign.get(c.id) ?? 0,
    owedNowUsd: owedByCampaign.get(c.id) ?? 0,
    chain: chainStates[i],
  }));
}
