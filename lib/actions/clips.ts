"use server";

import { requireAdmin, requireCreator } from "@/lib/auth-server";
import { getCampaignIdBySlug } from "@/lib/actions/campaigns";
import type { Platform } from "@/lib/campaigns";
import type { Clip, ClipStatus } from "@/lib/clips";
import { validatePostUrl } from "@/lib/clips";
import { scrapePostsBatch } from "@/lib/scrapers";
import type { ScrapeResult } from "@/lib/scrapers";
import { createServerClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  creator_id: string;
  campaign_id: string;
  campaign_slug: string;
  campaign_name: string;
  creator_email?: string;
  platform: Platform;
  post_url: string;
  tracking_code: string | null;
  status: ClipStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  verified_views: number;
  paid_views: number;
  earnings_usd: string | number;
  paid_out_usd: string | number;
  last_scraped_at: string | null;
  created_at: string;
};

function n(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

function rowToClip(r: Row): Clip {
  return {
    id: r.id,
    campaignSlug: r.campaign_slug,
    campaignName: r.campaign_name,
    creatorEmail: r.creator_email,
    platform: r.platform,
    postUrl: r.post_url,
    trackingCode: r.tracking_code ?? undefined,
    status: r.status,
    rejectionReason: r.rejection_reason ?? undefined,
    verifiedViews: r.verified_views,
    paidViews: r.paid_views,
    earningsUsd: n(r.earnings_usd),
    paidOutUsd: n(r.paid_out_usd),
    createdAt: r.created_at,
    approvedAt: r.approved_at ?? undefined,
    lastScrapedAt: r.last_scraped_at ?? undefined,
  };
}

const CLIP_SELECT = `
  id, creator_id, campaign_id, platform, post_url, tracking_code,
  status, rejection_reason, approved_at, verified_views, paid_views,
  earnings_usd, paid_out_usd, last_scraped_at, created_at,
  campaigns!inner(slug, product_name)
`;

type RawJoinRow = Omit<Row, "campaign_slug" | "campaign_name"> & {
  campaigns: { slug: string; product_name: string };
};

function joinRowToClip(r: RawJoinRow): Clip {
  return rowToClip({
    ...r,
    campaign_slug: r.campaigns.slug,
    campaign_name: r.campaigns.product_name,
  });
}

// Admin-only select: also joins the creator's email so the admin can see
// who submitted each clip.
const ADMIN_CLIP_SELECT = `
  id, creator_id, campaign_id, platform, post_url, tracking_code,
  status, rejection_reason, approved_at, verified_views, paid_views,
  earnings_usd, paid_out_usd, last_scraped_at, created_at,
  campaigns!inner(slug, product_name),
  creators!inner(email)
`;

type AdminRawJoinRow = RawJoinRow & { creators: { email: string } };

function adminJoinRowToClip(r: AdminRawJoinRow): Clip {
  return rowToClip({
    ...r,
    campaign_slug: r.campaigns.slug,
    campaign_name: r.campaigns.product_name,
    creator_email: r.creators.email,
  });
}

// ============================================================
// Creator actions
// ============================================================

export async function listMyClips(identityToken: string): Promise<Clip[]> {
  const creator = await requireCreator(identityToken);
  const sb = createServerClient();
  const { data, error } = await sb
    .from("clips")
    .select(CLIP_SELECT)
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as RawJoinRow[]).map(joinRowToClip);
}

export async function findMyClip(
  identityToken: string,
  clipId: string
): Promise<Clip | null> {
  const creator = await requireCreator(identityToken);
  const sb = createServerClient();
  const { data, error } = await sb
    .from("clips")
    .select(CLIP_SELECT)
    .eq("id", clipId)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (error) throw error;
  return data ? joinRowToClip(data as unknown as RawJoinRow) : null;
}

export type ViewSnapshot = {
  views: number;
  scrapedAt: string;
};

export async function listMyClipViewSnapshots(
  identityToken: string,
  clipId: string
): Promise<ViewSnapshot[]> {
  const creator = await requireCreator(identityToken);
  const sb = createServerClient();
  // Verify ownership before reading snapshots.
  const owns = await sb
    .from("clips")
    .select("id")
    .eq("id", clipId)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (owns.error) throw owns.error;
  if (!owns.data) return [];

  const { data, error } = await sb
    .from("view_snapshots")
    .select("views, scraped_at")
    .eq("clip_id", clipId)
    .order("scraped_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { views: number; scraped_at: string }[]).map((r) => ({
    views: r.views,
    scrapedAt: r.scraped_at,
  }));
}

export type Payout = {
  id: string;
  viewsPaid: number;
  amountUsd: number;
  txHash: string | null;
  status: "pending" | "sent" | "confirmed" | "failed";
  createdAt: string;
  confirmedAt: string | null;
  explorerUrl: string | null;
};

function explorerUrlForTx(rail: string, txHash: string | null): string | null {
  if (!txHash) return null;
  if (rail === "celo") {
    const testnet = process.env.NEXT_PUBLIC_USE_TESTNET === "true";
    return testnet
      ? `https://celo-sepolia.blockscout.com/tx/${txHash}`
      : `https://celo.blockscout.com/tx/${txHash}`;
  }
  if (rail === "tempo") return `https://explorer.tempo.xyz/tx/${txHash}`;
  return null;
}

export async function listMyClipPayouts(
  identityToken: string,
  clipId: string
): Promise<Payout[]> {
  const creator = await requireCreator(identityToken);
  const sb = createServerClient();
  // Ownership check.
  const owns = await sb
    .from("clips")
    .select("id")
    .eq("id", clipId)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (owns.error) throw owns.error;
  if (!owns.data) return [];

  const { data, error } = await sb
    .from("payouts")
    .select("id, views_paid, amount_usd, tx_hash, status, created_at, confirmed_at, rail")
    .eq("clip_id", clipId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    views_paid: number;
    amount_usd: string | number;
    tx_hash: string | null;
    status: "pending" | "sent" | "confirmed" | "failed";
    created_at: string;
    confirmed_at: string | null;
    rail: string;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    viewsPaid: r.views_paid,
    amountUsd: n(r.amount_usd),
    txHash: r.tx_hash,
    status: r.status,
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
    explorerUrl: explorerUrlForTx(r.rail, r.tx_hash),
  }));
}

export async function submitClip(
  identityToken: string,
  input: {
    campaignSlug: string;
    platform: Platform;
    postUrl: string;
    trackingCode: string;
  }
): Promise<{ ok: true; clip: Clip } | { ok: false; error: string }> {
  const v = validatePostUrl(input.platform, input.postUrl);
  if (!v.ok) return v;

  const creator = await requireCreator(identityToken);
  const campaignId = await getCampaignIdBySlug(input.campaignSlug);
  const sb = createServerClient();

  const { data, error } = await sb
    .from("clips")
    .insert({
      creator_id: creator.id,
      campaign_id: campaignId,
      platform: input.platform,
      post_url: input.postUrl.trim(),
      tracking_code: input.trackingCode,
      status: "pending",
    })
    .select(CLIP_SELECT)
    .single();

  if (error) {
    // 23505 = unique_violation → either same creator submitted twice OR
    // another creator already claimed this URL on this campaign.
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "This link is already submitted." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, clip: joinRowToClip(data as unknown as RawJoinRow) };
}

export async function removeClip(
  identityToken: string,
  clipId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const creator = await requireCreator(identityToken);
  const sb = createServerClient();
  // Only the owner can delete.
  const { error, count } = await sb
    .from("clips")
    .delete({ count: "exact" })
    .eq("id", clipId)
    .eq("creator_id", creator.id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Clip not found." };
  return { ok: true };
}

// ============================================================
// Admin actions
// ============================================================

export async function listPendingClips(identityToken: string): Promise<Clip[]> {
  await requireAdmin(identityToken);
  const sb = createServerClient();
  const { data, error } = await sb
    .from("clips")
    .select(ADMIN_CLIP_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AdminRawJoinRow[]).map(adminJoinRowToClip);
}

export async function listAllClips(identityToken: string): Promise<Clip[]> {
  await requireAdmin(identityToken);
  const sb = createServerClient();
  const { data, error } = await sb
    .from("clips")
    .select(ADMIN_CLIP_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as AdminRawJoinRow[]).map(adminJoinRowToClip);
}

export async function approveClip(
  identityToken: string,
  clipId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin(identityToken);
  const sb = createServerClient();
  const { error, count } = await sb
    .from("clips")
    .update({
      status: "tracking",
      approved_at: new Date().toISOString(),
      approved_by: admin.email,
      rejection_reason: null,
    }, { count: "exact" })
    .eq("id", clipId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Clip not pending." };
  return { ok: true };
}

export async function rejectClip(
  identityToken: string,
  clipId: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = reason.trim();
  if (!r) return { ok: false, error: "A reason is required." };
  await requireAdmin(identityToken);
  const sb = createServerClient();
  const { error, count } = await sb
    .from("clips")
    .update({ status: "rejected", rejection_reason: r }, { count: "exact" })
    .eq("id", clipId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Clip not pending." };
  return { ok: true };
}

/**
 * Iterates all `tracking` clips, scrapes views, persists snapshot + max-views.
 * Returns counts and first error for UX feedback.
 */
export async function refreshAllViews(
  identityToken: string
): Promise<{
  ok: true;
  updated: number;
  failed: number;
  firstError?: string;
}> {
  await requireAdmin(identityToken);
  const sb = createServerClient();

  // Join campaign rate + cap so we can compute earnings on the fly.
  const { data: rows, error } = await sb
    .from("clips")
    .select(
      "id, platform, post_url, verified_views, campaigns!inner(rate_per_view_usd, max_payout_per_clip_usd)"
    )
    .eq("status", "tracking");
  if (error) throw error;

  const live = (rows ?? []) as unknown as Array<{
    id: string;
    platform: Platform;
    post_url: string;
    verified_views: number;
    campaigns: {
      rate_per_view_usd: string | number;
      max_payout_per_clip_usd: string | number;
    };
  }>;

  if (live.length === 0) return { ok: true, updated: 0, failed: 0 };

  let updated = 0;
  let failed = 0;
  let firstError: string | undefined;

  // Scrape in one Apify run per platform, not one per clip. N parallel runs
  // blew Apify's 8 GB concurrent-memory limit. Platforms run sequentially so
  // only one actor run holds memory at a time.
  const byPlatform = new Map<Platform, string[]>();
  for (const c of live) {
    const urls = byPlatform.get(c.platform) ?? [];
    urls.push(c.post_url);
    byPlatform.set(c.platform, urls);
  }
  const scraped = new Map<string, ScrapeResult>();
  for (const [platform, urls] of byPlatform) {
    const results = await scrapePostsBatch(platform, urls);
    for (const [url, result] of results) scraped.set(url, result);
  }

  await Promise.all(
    live.map(async (c) => {
      const result = scraped.get(c.post_url);
      if (!result || !result.ok) {
        failed++;
        if (!firstError) {
          firstError = `${c.platform}: ${result?.error ?? "no scrape result"}`;
        }
        return;
      }
      const newViews = Math.max(c.verified_views, result.views);

      // earnings = views * rate, capped at the campaign's max payout per clip.
      const rate = n(c.campaigns.rate_per_view_usd);
      const maxPayout = n(c.campaigns.max_payout_per_clip_usd);
      const earnings = Math.min(newViews * rate, maxPayout);

      const now = new Date().toISOString();
      const upd = await sb
        .from("clips")
        .update({
          verified_views: newViews,
          earnings_usd: earnings,
          last_scraped_at: now,
          last_caption: result.caption,
        })
        .eq("id", c.id);
      if (upd.error) {
        failed++;
        if (!firstError) firstError = upd.error.message;
        return;
      }
      // Audit snapshot
      await sb.from("view_snapshots").insert({
        clip_id: c.id,
        views: newViews,
        raw_payload: { caption: result.caption, authorHandle: result.authorHandle },
      });
      updated++;
    })
  );

  return { ok: true, updated, failed, firstError };
}

// ============================================================
// Stats helpers
// ============================================================

export type OperatorStats = {
  pendingCount: number;
  liveClipsCount: number;
  /** Sum of earnings_usd across all clips — what we owe creators so far. */
  totalEarnedUsd: number;
  /** Sum of paid_out_usd — what's actually been transferred (0 until Phase 8). */
  totalPaidUsd: number;
  /** Total clips submitted, all statuses. */
  clipsCount: number;
  /** Total registered creators. */
  creatorsCount: number;
  /** Total payout rows recorded. */
  payoutsCount: number;
};

export async function getOperatorStats(
  identityToken: string
): Promise<OperatorStats> {
  await requireAdmin(identityToken);
  const sb = createServerClient();

  const [pending, live, all, creators, payouts] = await Promise.all([
    sb
      .from("clips")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    sb
      .from("clips")
      .select("id", { count: "exact", head: true })
      .eq("status", "tracking"),
    sb.from("clips").select("earnings_usd, paid_out_usd"),
    sb.from("creators").select("id", { count: "exact", head: true }),
    sb.from("payouts").select("id", { count: "exact", head: true }),
  ]);

  const rows = (all.data ?? []) as {
    earnings_usd: string | number;
    paid_out_usd: string | number;
  }[];
  const totalEarnedUsd = rows.reduce((sum, r) => sum + n(r.earnings_usd), 0);
  const totalPaidUsd = rows.reduce((sum, r) => sum + n(r.paid_out_usd), 0);

  return {
    pendingCount: pending.count ?? 0,
    liveClipsCount: live.count ?? 0,
    totalEarnedUsd,
    totalPaidUsd,
    clipsCount: rows.length,
    creatorsCount: creators.count ?? 0,
    payoutsCount: payouts.count ?? 0,
  };
}
