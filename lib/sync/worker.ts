import "server-only";

import type { Platform } from "@/lib/campaigns";
import { scrapePostsBatch, type ScrapeResult } from "@/lib/scrapers";
import { createServerClient } from "@/lib/supabase/server";

/**
 * One unit of work for the view-sync queue.
 *
 * Claims a bounded chunk of the oldest-synced `tracking` clips via the
 * `claim_sync_batch` RPC (FOR UPDATE SKIP LOCKED — concurrency-safe),
 * scrapes their current view counts, writes the results, and releases the
 * lease. Designed to be called repeatedly (cron, or a manual drain loop):
 * each call is bounded so it always finishes well under the function
 * timeout, no matter how many clips exist in total.
 */
export type SyncBatchResult = {
  processed: number;
  updated: number;
  failed: number;
  firstError?: string;
};

type ClaimedClip = {
  id: string;
  platform: Platform;
  post_url: string;
  campaign_id: string;
  verified_views: number;
  sync_attempts: number;
};

function n(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

export async function runSyncBatch(batchSize: number): Promise<SyncBatchResult> {
  const sb = createServerClient();

  // 1. Claim a chunk. The RPC locks the rows so overlapping workers / cron
  //    runs never grab the same clip.
  const { data, error } = await sb.rpc("claim_sync_batch", {
    batch_size: batchSize,
  });
  if (error) throw new Error(`claim_sync_batch failed: ${error.message}`);
  const clips = (data ?? []) as ClaimedClip[];
  if (clips.length === 0) {
    return { processed: 0, updated: 0, failed: 0 };
  }
  console.log(`[sync-worker] claimed ${clips.length} clips`);

  // 2. Fetch the rate + cap for the campaigns in this chunk (the RPC only
  //    returns clip columns, not the campaign join).
  const campaignIds = [...new Set(clips.map((c) => c.campaign_id))];
  const { data: campaigns } = await sb
    .from("campaigns")
    .select("id, rate_per_view_usd, max_payout_per_clip_usd")
    .in("id", campaignIds);
  const rateById = new Map<string, { rate: number; cap: number }>();
  for (const c of campaigns ?? []) {
    const row = c as {
      id: string;
      rate_per_view_usd: string | number;
      max_payout_per_clip_usd: string | number;
    };
    rateById.set(row.id, {
      rate: n(row.rate_per_view_usd),
      cap: n(row.max_payout_per_clip_usd),
    });
  }

  // 3. Scrape, one batch call per platform.
  const byPlatform = new Map<Platform, string[]>();
  for (const c of clips) {
    const urls = byPlatform.get(c.platform) ?? [];
    urls.push(c.post_url);
    byPlatform.set(c.platform, urls);
  }
  const scraped = new Map<string, ScrapeResult>();
  for (const [platform, urls] of byPlatform) {
    const results = await scrapePostsBatch(platform, urls);
    for (const [url, result] of results) scraped.set(url, result);
  }

  // 4. Apply results. Release the lease on every clip either way; succeeded
  //    and failed clips both get a fresh last_scraped_at so the queue keeps
  //    rotating.
  //
  //    Mass failure (most of the batch failed) = a scraper outage, not the
  //    clips' fault. In that case we do NOT bump sync_attempts — otherwise
  //    a multi-hour TikWM outage would push every clip past max_failures and
  //    silently empty the whole queue. sync_attempts only counts failures
  //    that are specific to a clip.
  const failedCount = clips.filter((c) => {
    const r = scraped.get(c.post_url);
    return !r || !r.ok;
  }).length;
  const massFailure = failedCount > clips.length / 2;
  if (massFailure) {
    console.warn(
      `[sync-worker] mass failure ${failedCount}/${clips.length} — not counting sync_attempts`
    );
  }

  let updated = 0;
  let failed = 0;
  let firstError: string | undefined;

  await Promise.all(
    clips.map(async (c) => {
      const result = scraped.get(c.post_url);
      if (!result || !result.ok) {
        failed++;
        if (!firstError) {
          firstError = `${c.platform}: ${result?.error ?? "no scrape result"}`;
        }
        // Bump last_scraped_at so the clip rotates to the back of the
        // queue. Increment sync_attempts only on a non-mass failure — a
        // clip past max_failures drops out of the queue (surfaced by the
        // daily health check); an outage shouldn't trigger that.
        await sb
          .from("clips")
          .update({
            last_scraped_at: new Date().toISOString(),
            sync_locked_until: null,
            ...(massFailure ? {} : { sync_attempts: c.sync_attempts + 1 }),
          })
          .eq("id", c.id);
        return;
      }

      const newViews = Math.max(c.verified_views, result.views);
      const rc = rateById.get(c.campaign_id);
      const earnings = rc ? Math.min(newViews * rc.rate, rc.cap) : 0;

      const upd = await sb
        .from("clips")
        .update({
          verified_views: newViews,
          earnings_usd: earnings,
          last_scraped_at: new Date().toISOString(),
          last_caption: result.caption,
          // Persist the author handle — Instagram URLs don't carry it, so
          // this is the only place the payout digest can get it from.
          ...(result.authorHandle
            ? { author_handle: result.authorHandle }
            : {}),
          // Scrape succeeded — clear the consecutive-failure counter.
          sync_attempts: 0,
          sync_locked_until: null,
        })
        .eq("id", c.id);
      if (upd.error) {
        failed++;
        if (!firstError) firstError = upd.error.message;
        return;
      }

      await sb.from("view_snapshots").insert({
        clip_id: c.id,
        views: newViews,
        raw_payload: {
          caption: result.caption,
          authorHandle: result.authorHandle,
        },
      });
      updated++;
    })
  );

  console.log(
    `[sync-worker] done processed=${clips.length} updated=${updated} failed=${failed}`
  );
  return { processed: clips.length, updated, failed, firstError };
}
