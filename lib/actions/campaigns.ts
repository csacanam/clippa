"use server";

import { requireAdmin, requireUser } from "@/lib/auth-server";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { createServerClient } from "@/lib/supabase/server";
import type { Campaign, CampaignChainState, Platform } from "@/lib/campaigns";
import { getCampaignChainState } from "@/lib/payments/celo";
import { translateCampaignFields } from "@/lib/translation";

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
  status: Campaign["status"];
  source_language: string;
};

type TranslationRow = {
  language: string;
  product_name: string;
  short_description: string;
  long_description: string;
  script_markdown: string;
  instructions_markdown: string;
};

function n(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

function rowToCampaign(
  row: CampaignRow,
  translations: TranslationRow[] = [],
  viewerLocale?: Locale
): Campaign {
  // Pick the best content variant for the viewer's locale.
  // If the campaign's source matches, use the row as-is.
  // Else look up a translation row for the viewer's locale; fall back to source.
  let pn = row.product_name;
  let sd = row.short_description;
  let ld = row.long_description;
  let sm = row.script_markdown;
  let im = row.instructions_markdown;
  if (viewerLocale && viewerLocale !== row.source_language) {
    const t = translations.find((x) => x.language === viewerLocale);
    if (t) {
      pn = t.product_name;
      sd = t.short_description;
      ld = t.long_description;
      sm = t.script_markdown;
      im = t.instructions_markdown;
    }
  }
  const availableLanguages = Array.from(
    new Set([row.source_language, ...translations.map((t) => t.language)])
  );
  return {
    slug: row.slug,
    productName: pn,
    shortDescription: sd,
    longDescription: ld,
    exampleVideoUrl: row.example_video_url ?? undefined,
    scriptMarkdown: sm,
    instructionsMarkdown: im,
    ratePerViewUsd: n(row.rate_per_view_usd),
    maxPayoutPerClipUsd: n(row.max_payout_per_clip_usd),
    totalBudgetUsd: n(row.total_budget_usd),
    spentUsd: n(row.spent_usd),
    platforms: row.platforms as Platform[],
    status: row.status,
    sourceLanguage: row.source_language,
    availableLanguages,
  };
}

const CAMPAIGN_SELECT_WITH_TRANSLATIONS = `
  id, slug, product_name, short_description, long_description, example_video_url,
  script_markdown, instructions_markdown, rate_per_view_usd, max_payout_per_clip_usd,
  total_budget_usd, spent_usd, platforms, status, source_language,
  campaign_translations(language, product_name, short_description, long_description, script_markdown, instructions_markdown)
`;

type CampaignRowWithTranslations = CampaignRow & {
  campaign_translations: TranslationRow[] | null;
};

export async function listActiveCampaigns(
  viewerLocale?: Locale
): Promise<Campaign[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .select(CAMPAIGN_SELECT_WITH_TRANSLATIONS)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as CampaignRowWithTranslations[]).map((r) =>
    rowToCampaign(r, r.campaign_translations ?? [], viewerLocale)
  );
}

export async function findCampaignBySlug(
  slug: string,
  viewerLocale?: Locale
): Promise<Campaign | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .select(CAMPAIGN_SELECT_WITH_TRANSLATIONS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as CampaignRowWithTranslations;
  return rowToCampaign(row, row.campaign_translations ?? [], viewerLocale);
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

export type BrandCampaign = {
  id: string;
  slug: string;
  productName: string;
  shortDescription: string;
  status: Campaign["status"];
  ratePerViewUsd: number;
  maxPayoutPerClipUsd: number;
  /** Count of clips on this campaign, all statuses. */
  totalClipsCount: number;
  /** Count of clips currently tracking. */
  liveClipsCount: number;
  /** Sum of verified_views across all clips on this campaign. */
  totalViews: number;
  /** On-chain escrow state. exists:false if not funded on-chain yet. */
  chain: CampaignChainState;
  createdAt: string;
};

/**
 * Lists every campaign the current user has created, with per-campaign
 * stats they care about: balance left, money spent, clips count, total
 * views delivered. This powers the brand dashboard.
 */
export async function listMyBrandCampaigns(
  identityToken: string
): Promise<BrandCampaign[]> {
  const user = await requireUser(identityToken);
  const sb = createServerClient();

  const { data: campaignRows, error: campErr } = await sb
    .from("campaigns")
    .select(
      "id, slug, product_name, short_description, status, rate_per_view_usd, max_payout_per_clip_usd, created_at"
    )
    .eq("created_by_user_id", user.id)
    .neq("status", "ended")
    .order("created_at", { ascending: false });
  if (campErr) throw campErr;

  const campaigns = (campaignRows ?? []) as {
    id: string;
    slug: string;
    product_name: string;
    short_description: string;
    status: Campaign["status"];
    rate_per_view_usd: string | number;
    max_payout_per_clip_usd: string | number;
    created_at: string;
  }[];
  if (campaigns.length === 0) return [];

  const ids = campaigns.map((c) => c.id);

  // Aggregate clip stats per campaign in memory — small enough.
  const { data: clipRows, error: clipErr } = await sb
    .from("clips")
    .select("campaign_id, status, verified_views")
    .in("campaign_id", ids);
  if (clipErr) throw clipErr;

  const totalByCampaign = new Map<string, number>();
  const liveByCampaign = new Map<string, number>();
  const viewsByCampaign = new Map<string, number>();
  for (const r of (clipRows ?? []) as {
    campaign_id: string;
    status: string;
    verified_views: number;
  }[]) {
    totalByCampaign.set(
      r.campaign_id,
      (totalByCampaign.get(r.campaign_id) ?? 0) + 1
    );
    if (r.status === "tracking") {
      liveByCampaign.set(
        r.campaign_id,
        (liveByCampaign.get(r.campaign_id) ?? 0) + 1
      );
    }
    viewsByCampaign.set(
      r.campaign_id,
      (viewsByCampaign.get(r.campaign_id) ?? 0) + (r.verified_views ?? 0)
    );
  }

  const chainStates = await Promise.all(
    campaigns.map((c) => getCampaignChainState(c.id))
  );

  return campaigns.map((c, i) => ({
    id: c.id,
    slug: c.slug,
    productName: c.product_name,
    shortDescription: c.short_description,
    status: c.status,
    ratePerViewUsd: n(c.rate_per_view_usd),
    maxPayoutPerClipUsd: n(c.max_payout_per_clip_usd),
    totalClipsCount: totalByCampaign.get(c.id) ?? 0,
    liveClipsCount: liveByCampaign.get(c.id) ?? 0,
    totalViews: viewsByCampaign.get(c.id) ?? 0,
    chain: chainStates[i],
    createdAt: c.created_at,
  }));
}

// ============================================================
// Brand: campaign creation
// ============================================================

export type CampaignDraftInput = {
  productName: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  exampleVideoUrl?: string;
  scriptMarkdown: string;
  instructionsMarkdown: string;
  ratePerViewUsd: number;
  maxPayoutPerClipUsd: number;
  totalBudgetUsd: number;
  platforms: Platform[];
  sourceLanguage: Locale;
};

export type ReserveDraftResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string; field?: keyof CampaignDraftInput };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_RE = /^https?:\/\/.+/;

function validateDraft(input: CampaignDraftInput): {
  ok: true;
} | { ok: false; error: string; field?: keyof CampaignDraftInput } {
  if (!input.productName?.trim() || input.productName.length > 60) {
    return { ok: false, error: "Product name must be 1–60 characters.", field: "productName" };
  }
  if (!SLUG_RE.test(input.slug) || input.slug.length > 40) {
    return {
      ok: false,
      error: "Slug must be lowercase letters, numbers, and dashes (max 40 chars).",
      field: "slug",
    };
  }
  if (!input.shortDescription?.trim() || input.shortDescription.length > 200) {
    return { ok: false, error: "Short description is required (max 200 chars).", field: "shortDescription" };
  }
  if (!input.longDescription?.trim() || input.longDescription.length > 2000) {
    return { ok: false, error: "Long description is required (max 2000 chars).", field: "longDescription" };
  }
  if (input.exampleVideoUrl && !URL_RE.test(input.exampleVideoUrl)) {
    return { ok: false, error: "Example video URL must start with http(s)://.", field: "exampleVideoUrl" };
  }
  if (!input.scriptMarkdown?.trim() || input.scriptMarkdown.length > 5000) {
    return { ok: false, error: "Script is required (max 5000 chars).", field: "scriptMarkdown" };
  }
  if (!input.instructionsMarkdown?.trim() || input.instructionsMarkdown.length > 5000) {
    return { ok: false, error: "Instructions are required (max 5000 chars).", field: "instructionsMarkdown" };
  }
  if (!(input.ratePerViewUsd > 0) || input.ratePerViewUsd > 1) {
    return { ok: false, error: "Rate per view must be between $0 and $1.", field: "ratePerViewUsd" };
  }
  if (!(input.maxPayoutPerClipUsd >= 1) || input.maxPayoutPerClipUsd > 10000) {
    return { ok: false, error: "Max payout per clip must be between $1 and $10,000.", field: "maxPayoutPerClipUsd" };
  }
  if (!(input.totalBudgetUsd >= 1) || input.totalBudgetUsd > 100000) {
    return { ok: false, error: "Total budget must be between $1 and $100,000.", field: "totalBudgetUsd" };
  }
  if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
    return { ok: false, error: "Pick at least one platform.", field: "platforms" };
  }
  if (!LOCALES.includes(input.sourceLanguage)) {
    return { ok: false, error: "Pick a supported language.", field: "sourceLanguage" };
  }
  return { ok: true };
}

/**
 * Reserves a campaign row in the DB with status='pending_funding'. The
 * returned UUID is what the client will use for the on-chain createCampaign
 * + fundCampaign calls. If the user bails before funding completes, the
 * row stays pending and can be resumed from the brand dashboard.
 */
export async function reserveCampaignDraft(
  identityToken: string,
  input: CampaignDraftInput
): Promise<ReserveDraftResult> {
  const v = validateDraft(input);
  if (!v.ok) return v;

  const user = await requireUser(identityToken);
  const sb = createServerClient();

  const { data, error } = await sb
    .from("campaigns")
    .insert({
      slug: input.slug,
      product_name: input.productName,
      short_description: input.shortDescription,
      long_description: input.longDescription,
      example_video_url: input.exampleVideoUrl || null,
      script_markdown: input.scriptMarkdown,
      instructions_markdown: input.instructionsMarkdown,
      rate_per_view_usd: input.ratePerViewUsd,
      max_payout_per_clip_usd: input.maxPayoutPerClipUsd,
      total_budget_usd: input.totalBudgetUsd,
      platforms: input.platforms,
      status: "pending_funding",
      source_language: input.sourceLanguage,
      created_by_user_id: user.id,
    })
    .select("id, slug")
    .single();

  if (error) {
    // 23505 = unique_violation on slug.
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "That slug is already taken.", field: "slug" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: (data as { id: string }).id, slug: (data as { slug: string }).slug };
}

/**
 * Flips a campaign from 'pending_funding' to 'active' after the on-chain
 * createCampaign + fundCampaign txs have succeeded. Only the campaign's
 * creator can call this (and only on their own pending campaigns).
 *
 * After the flip, kicks off best-effort translation to every other supported
 * locale. Translation failures are swallowed — the campaign goes live in its
 * source language and creators of other locales see the source content with
 * a "Content in X" badge.
 */
export async function markCampaignActive(
  identityToken: string,
  campaignId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser(identityToken);
  const sb = createServerClient();
  const { error, count } = await sb
    .from("campaigns")
    .update({ status: "active" }, { count: "exact" })
    .eq("id", campaignId)
    .eq("created_by_user_id", user.id)
    .eq("status", "pending_funding");
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Campaign not found or already active." };

  // Best-effort: translate now so creators see the campaign in their language.
  // Failures don't block — the campaign is already active.
  try {
    await translateCampaignToAllLocales(campaignId);
  } catch (e) {
    console.error(`Translation failed for campaign ${campaignId}:`, e);
  }

  return { ok: true };
}

/**
 * Generates translations for a campaign in every supported locale other than
 * its source. Skips locales that already have a cached translation.
 * Called from markCampaignActive and the backfill script.
 */
export async function translateCampaignToAllLocales(
  campaignId: string
): Promise<void> {
  const sb = createServerClient();

  const { data: campaign, error } = await sb
    .from("campaigns")
    .select(
      "id, source_language, product_name, short_description, long_description, script_markdown, instructions_markdown"
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const row = campaign as {
    id: string;
    source_language: string;
    product_name: string;
    short_description: string;
    long_description: string;
    script_markdown: string;
    instructions_markdown: string;
  };

  const targets = LOCALES.filter((l) => l !== row.source_language);
  if (targets.length === 0) return;

  // Check which translations already exist; skip those.
  const existing = await sb
    .from("campaign_translations")
    .select("language")
    .eq("campaign_id", campaignId);
  const have = new Set(
    ((existing.data ?? []) as { language: string }[]).map((r) => r.language)
  );
  const missing = targets.filter((l) => !have.has(l));
  if (missing.length === 0) return;

  const source = {
    productName: row.product_name,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    scriptMarkdown: row.script_markdown,
    instructionsMarkdown: row.instructions_markdown,
  };

  for (const target of missing) {
    const translated = await translateCampaignFields(
      source,
      row.source_language,
      target
    );
    const { error: insErr } = await sb.from("campaign_translations").insert({
      campaign_id: campaignId,
      language: target,
      product_name: translated.productName,
      short_description: translated.shortDescription,
      long_description: translated.longDescription,
      script_markdown: translated.scriptMarkdown,
      instructions_markdown: translated.instructionsMarkdown,
    });
    if (insErr) throw insErr;
  }
}

export type PendingCampaign = {
  id: string;
  slug: string;
  productName: string;
  totalBudgetUsd: number;
  maxPayoutPerClipUsd: number;
};

/**
 * Returns a pending_funding campaign belonging to the current user, or null.
 * Used by the resume-funding page to restart the on-chain signing flow.
 */
export async function getMyPendingCampaign(
  identityToken: string,
  campaignId: string
): Promise<PendingCampaign | null> {
  const user = await requireUser(identityToken);
  const sb = createServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .select(
      "id, slug, product_name, total_budget_usd, max_payout_per_clip_usd"
    )
    .eq("id", campaignId)
    .eq("created_by_user_id", user.id)
    .eq("status", "pending_funding")
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    slug: string;
    product_name: string;
    total_budget_usd: string | number;
    max_payout_per_clip_usd: string | number;
  };
  return {
    id: row.id,
    slug: row.slug,
    productName: row.product_name,
    totalBudgetUsd: n(row.total_budget_usd),
    maxPayoutPerClipUsd: n(row.max_payout_per_clip_usd),
  };
}

/**
 * Checks if a slug is available. Cheap pre-check so the form can show
 * inline feedback before submit.
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (!SLUG_RE.test(slug)) return false;
  const sb = createServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return false;
  return !data;
}
