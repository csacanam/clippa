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

  // 4. Apply results. Release the lease on every clip either way: succeeded
  //    clips also get a fresh last_scraped_at (moves them to the back of the
  //    queue); failed clips keep their old timestamp so they're retried
  //    next cycle.
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
        // Bump last_scraped_at even on failure so the clip rotates to the
        // back of the queue, and increment sync_attempts (consecutive
        // failures). Once it crosses claim_sync_batch's max_failures the
        // clip drops out of the queue entirely — the daily health check
        // then surfaces it for review.
        await sb
          .from("clips")
          .update({
            last_scraped_at: new Date().toISOString(),
            sync_attempts: c.sync_attempts + 1,
            sync_locked_until: null,
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
