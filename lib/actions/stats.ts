"use server";

import { createServerClient } from "@/lib/supabase/server";
import { type Platform } from "@/lib/campaigns";

export type PublicStats = {
  creatorsCount: number;
  clipsCount: number;
  payoutsCount: number;
};

export type ShowcaseClip = {
  id: string;
  campaignName: string;
  platform: Platform;
  postUrl: string;
  verifiedViews: number;
  earningsUsd: number;
};

/**
 * Platform-wide counts for the public landing page. No auth — only returns
 * aggregate counts, no row data.
 */
export async function getPublicStats(): Promise<PublicStats> {
  const sb = createServerClient();
  const [creators, clips, payouts] = await Promise.all([
    sb
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("primary_role", "creator"),
    sb.from("clips").select("id", { count: "exact", head: true }),
    sb.from("payouts").select("id", { count: "exact", head: true }),
  ]);
  return {
    creatorsCount: creators.count ?? 0,
    clipsCount: clips.count ?? 0,
    payoutsCount: payouts.count ?? 0,
  };
}

/**
 * Top-earning live clips for the landing showcase. Public — only returns
 * what creators are already publishing on social media, plus aggregate
 * earnings. No creator identity is exposed.
 *
 * Only includes `tracking` clips with non-zero earnings so the showcase
 * doesn't pad with stale or zero-revenue rows.
 */
export async function listTopEarningClips(
  limit = 6
): Promise<ShowcaseClip[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("clips")
    .select(
      "id, platform, post_url, verified_views, earnings_usd, campaigns!inner(product_name)"
    )
    .eq("status", "tracking")
    .gt("earnings_usd", 0)
    .order("earnings_usd", { ascending: false })
    .limit(limit);
  if (error) return [];
  type Row = {
    id: string;
    platform: Platform;
    post_url: string;
    verified_views: number;
    earnings_usd: string | number;
    campaigns: { product_name: string };
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    campaignName: r.campaigns.product_name,
    platform: r.platform,
    postUrl: r.post_url,
    verifiedViews: r.verified_views,
    earningsUsd:
      typeof r.earnings_usd === "string"
        ? parseFloat(r.earnings_usd)
        : r.earnings_usd,
  }));
}
