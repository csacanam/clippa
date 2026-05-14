"use server";

import { createServerClient } from "@/lib/supabase/server";
import type { Campaign, Platform } from "@/lib/campaigns";

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
