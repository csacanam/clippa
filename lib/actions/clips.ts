"use server";

import { isAdminEmail, requireAdmin, requireCreator, requireUser } from "@/lib/auth-server";
import { getCampaignIdBySlug } from "@/lib/actions/campaigns";
import type { Platform } from "@/lib/campaigns";
import type { Clip, ClipStatus } from "@/lib/clips";
import { validatePostUrl } from "@/lib/clips";
import { sendEmail } from "@/lib/email/send";
import {
  localeFromCountry,
  renderClipApproved,
  renderClipRejected,
} from "@/lib/email/templates";
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
  featured_video_url: string | null;
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
    featuredVideoUrl: r.featured_video_url ?? undefined,
  };
}

const CLIP_SELECT = `
  id, creator_id, campaign_id, platform, post_url, tracking_code,
  status, rejection_reason, approved_at, verified_views, paid_views,
  earnings_usd, paid_out_usd, last_scraped_at, created_at, featured_video_url,
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
  earnings_usd, paid_out_usd, last_scraped_at, created_at, featured_video_url,
  campaigns!inner(slug, product_name),
  users!inner(email)
`;

type AdminRawJoinRow = RawJoinRow & { users: { email: string } };

function adminJoinRowToClip(r: AdminRawJoinRow): Clip {
  return rowToClip({
    ...r,
    campaign_slug: r.campaigns.slug,
    campaign_name: r.campaigns.product_name,
    creator_email: r.users.email,
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
    /** Client-generated UUID. Becomes the clip's primary key + the video
     *  filename in Storage, so the file and row stay in lockstep. */
    clipId: string;
    campaignSlug: string;
    platform: Platform;
    postUrl: string;
    trackingCode: string;
    /** Public URL of the MP4 already uploaded via the signed-upload flow.
     *  Required — the brand needs to be able to download the original clip. */
    featuredVideoUrl: string;
  }
): Promise<{ ok: true; clip: Clip } | { ok: false; error: string }> {
  if (!UUID_RE.test(input.clipId)) {
    return { ok: false, error: "Invalid clip id." };
  }
  const v = validatePostUrl(input.platform, input.postUrl);
  if (!v.ok) return v;
  if (!input.featuredVideoUrl?.startsWith("http")) {
    return { ok: false, error: "Video upload is required." };
  }

  const creator = await requireCreator(identityToken);
  const campaignId = await getCampaignIdBySlug(input.campaignSlug);
  const sb = createServerClient();

  const { data, error } = await sb
    .from("clips")
    .insert({
      id: input.clipId,
      creator_id: creator.id,
      campaign_id: campaignId,
      platform: input.platform,
      post_url: input.postUrl.trim(),
      tracking_code: input.trackingCode,
      status: "pending",
      featured_video_url: input.featuredVideoUrl,
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

/**
 * Deletes a clip. Allowed only while it's still 'pending' (awaiting review)
 * or 'rejected' — never once it has been tracking. A tracking / paused /
 * maxed_out clip may have produced on-chain payouts whose DB records
 * (view_snapshots, payouts) would cascade-delete with the row and break
 * the audit trail.
 */
export async function removeClip(
  identityToken: string,
  clipId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const creator = await requireCreator(identityToken);
  const sb = createServerClient();

  // Single statement: delete only if status is in the allowed set AND owned.
  const { error, count } = await sb
    .from("clips")
    .delete({ count: "exact" })
    .eq("id", clipId)
    .eq("creator_id", creator.id)
    .in("status", ["pending", "rejected"]);
  if (error) return { ok: false, error: error.message };
  if (!count) {
    // Either the clip doesn't exist / isn't ours, or it's no longer deletable.
    // Look it up to give a clearer error.
    const found = await sb
      .from("clips")
      .select("status")
      .eq("id", clipId)
      .eq("creator_id", creator.id)
      .maybeSingle();
    if (found.data) {
      return {
        ok: false,
        error: "Live clips can't be deleted — they have on-chain payouts.",
      };
    }
    return { ok: false, error: "Clip not found." };
  }
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

/**
 * Authorizes a user to moderate a specific clip — admin globally, or the
 * brand that owns the clip's campaign. Returns the user record so the
 * caller can stamp `approved_by`. Throws on unauthorized.
 *
 * The whole point: the brand owns the campaign and should be the one
 * approving its clips. Admin keeps the same power as a fallback /
 * moderation backstop.
 */
async function requireClipModerator(
  identityToken: string,
  clipId: string
): Promise<{ user: { id: string; email: string }; isAdmin: boolean }> {
  const user = await requireUser(identityToken);
  if (isAdminEmail(user.email)) return { user, isAdmin: true };

  const sb = createServerClient();
  const { data, error } = await sb
    .from("clips")
    .select("campaigns!inner(created_by_user_id)")
    .eq("id", clipId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Clip not found.");
  const owner = (data as unknown as {
    campaigns: { created_by_user_id: string | null };
  }).campaigns.created_by_user_id;
  if (owner !== user.id) {
    throw new Error("Not authorized to moderate this clip.");
  }
  return { user, isAdmin: false };
}

/**
 * Best-effort email to the clip's creator after a moderation decision.
 * Never throws — an email failure must not roll back the approve/reject.
 */
async function emailClipDecision(
  clipId: string,
  decision: "approved" | "rejected",
  reason?: string
): Promise<void> {
  try {
    const sb = createServerClient();
    const { data } = await sb
      .from("clips")
      .select("users!inner(email, country), campaigns!inner(product_name)")
      .eq("id", clipId)
      .maybeSingle();
    if (!data) return;
    const row = data as unknown as {
      users: { email: string; country: string | null };
      campaigns: { product_name: string };
    };
    const lang = localeFromCountry(row.users.country);
    const email =
      decision === "approved"
        ? renderClipApproved(lang, {
            campaignName: row.campaigns.product_name,
          })
        : renderClipRejected(lang, {
            campaignName: row.campaigns.product_name,
            reason: reason ?? "",
          });
    await sendEmail({ to: row.users.email, ...email });
  } catch (e) {
    console.error(`[email] clip decision notify failed: ${(e as Error).message}`);
  }
}

export async function approveClip(
  identityToken: string,
  clipId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: { email: string };
  try {
    actor = (await requireClipModerator(identityToken, clipId)).user;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const sb = createServerClient();
  const { error, count } = await sb
    .from("clips")
    .update(
      {
        status: "tracking",
        approved_at: new Date().toISOString(),
        approved_by: actor.email,
        rejection_reason: null,
      },
      { count: "exact" }
    )
    .eq("id", clipId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Clip not pending." };
  await emailClipDecision(clipId, "approved");
  return { ok: true };
}

export async function rejectClip(
  identityToken: string,
  clipId: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = reason.trim();
  if (!r) return { ok: false, error: "A reason is required." };
  try {
    await requireClipModerator(identityToken, clipId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const sb = createServerClient();
  const { error, count } = await sb
    .from("clips")
    .update({ status: "rejected", rejection_reason: r }, { count: "exact" })
    .eq("id", clipId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Clip not pending." };
  await emailClipDecision(clipId, "rejected", r);
  return { ok: true };
}

const STORAGE_BUCKET = "featured_clips";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mints a one-shot signed upload URL the browser can PUT the video to
 * directly. Going browser → Supabase Storage (instead of browser → Vercel
 * → Supabase) sidesteps the Vercel function body buffer + execution
 * timeout that was hanging 20 MB uploads.
 *
 * The caller must pre-generate the clipId (UUID) so the filename matches
 * the eventual DB row id — `sync-featured-videos` and the brand download
 * flow find the file by id without any join table.
 *
 * The signed URL is upsert-enabled so a creator can re-pick a file before
 * submitting without colliding on a stale upload.
 */
export async function getClipVideoUploadAuthorization(
  identityToken: string,
  clipId: string
): Promise<
  | { ok: true; uploadUrl: string; publicUrl: string }
  | { ok: false; error: string }
> {
  await requireCreator(identityToken);
  if (!UUID_RE.test(clipId)) return { ok: false, error: "Invalid clip id." };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !process.env.SUPABASE_SECRET_KEY) {
    return { ok: false, error: "Storage is not configured." };
  }

  const sb = createServerClient();
  const filename = `${clipId}.mp4`;
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(filename, { upsert: true });
  if (error || !data?.signedUrl) {
    console.error(
      `[upload-auth] failed clipId=${clipId} ${error?.message ?? "no signed URL"}`
    );
    return {
      ok: false,
      error: `Authorization failed: ${error?.message ?? "no signed URL"}`,
    };
  }

  console.log(`[upload-auth] minted clipId=${clipId}`);
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
  return { ok: true, uploadUrl: data.signedUrl, publicUrl };
}

/**
 * Sets (or clears) the featured_video_url of a clip — the landing's
 * social-proof carousel reads this. Admin-only because it controls what
 * shows up on the public landing.
 */
export async function setClipFeaturedVideo(
  identityToken: string,
  clipId: string,
  videoUrl: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin(identityToken);
  const trimmed = videoUrl?.trim() || null;
  if (trimmed && !/^https?:\/\/.+/.test(trimmed)) {
    return { ok: false, error: "Video URL must start with http(s)://." };
  }
  const sb = createServerClient();
  const { error, count } = await sb
    .from("clips")
    .update({ featured_video_url: trimmed }, { count: "exact" })
    .eq("id", clipId);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Clip not found." };
  return { ok: true };
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
    sb
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("primary_role", "creator"),
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
