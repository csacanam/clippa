/**
 * Instagram view scraper via Apify.
 *
 * Uses `apify/instagram-scraper` (~$1.50 / 1,000 results). Returns
 * videoPlayCount, caption, ownerUsername. Apify handles the headless
 * browser, IP rotation, and HTML changes for us.
 *
 * Scraping is batched: one actor run handles every URL at once. Firing one
 * run per clip blew Apify's concurrent-memory limit (8 GB across all runs).
 *
 * Set APIFY_API_TOKEN in .env to enable. APIFY_API_TOKEN_2, _3, etc. are
 * picked up automatically as fallbacks when the primary's quota runs out.
 */

import type { ScrapeResult } from "./types";

import { callApifyActor, hasApifyTokens } from "./apify-client";

const APIFY_ACTOR = "apify~instagram-scraper/run-sync-get-dataset-items";

type ApifyItem = {
  videoPlayCount?: number;
  videoViewCount?: number;
  caption?: string;
  ownerUsername?: string;
  type?: string;
  shortCode?: string;
  url?: string;
  inputUrl?: string;
  error?: string;
};

/** Extracts the post shortcode from an Instagram URL, used to match results. */
function instagramShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function viewsOf(item: ApifyItem): number {
  if (typeof item.videoPlayCount === "number") return item.videoPlayCount;
  if (typeof item.videoViewCount === "number") return item.videoViewCount;
  return 0;
}

/**
 * Scrapes many Instagram posts in a single Apify run. Returns a map keyed by
 * the input URL — every input URL gets an entry (a ScrapeError if unmatched).
 */
export async function scrapeInstagramBatch(
  urls: string[]
): Promise<Map<string, ScrapeResult>> {
  const out = new Map<string, ScrapeResult>();
  if (urls.length === 0) return out;

  if (!hasApifyTokens()) {
    const err: ScrapeResult = {
      ok: false,
      error:
        "Instagram scraping isn't configured. Set APIFY_API_TOKEN to enable.",
      structural: false,
    };
    for (const u of urls) out.set(u, err);
    return out;
  }

  let items: ApifyItem[];
  try {
    const { status, body } = await callApifyActor(APIFY_ACTOR, {
      directUrls: urls,
      resultsType: "details",
      resultsLimit: 1,
      addParentData: false,
    });
    if (status < 200 || status >= 300) {
      const err: ScrapeResult = {
        ok: false,
        error: `Apify ${status}: ${body.slice(0, 200)}`,
        structural: status === 401 || status === 402 || status === 403,
      };
      for (const u of urls) out.set(u, err);
      return out;
    }
    items = JSON.parse(body) as ApifyItem[];
  } catch (e) {
    const err: ScrapeResult = {
      ok: false,
      error: `Apify network error: ${(e as Error).message}`,
    };
    for (const u of urls) out.set(u, err);
    return out;
  }

  // Index returned items by shortcode so we can match them back to inputs.
  const byCode = new Map<string, ApifyItem>();
  for (const it of items) {
    if (it.shortCode) byCode.set(it.shortCode, it);
    const fromUrl = it.url ? instagramShortcode(it.url) : null;
    if (fromUrl) byCode.set(fromUrl, it);
    const fromInput = it.inputUrl ? instagramShortcode(it.inputUrl) : null;
    if (fromInput) byCode.set(fromInput, it);
  }

  for (const u of urls) {
    const code = instagramShortcode(u);
    const item = code ? byCode.get(code) : undefined;
    if (!item) {
      out.set(u, {
        ok: false,
        error: "Apify returned no results for that Instagram URL.",
        structural: true,
      });
      continue;
    }
    if (item.error) {
      out.set(u, {
        ok: false,
        error: `Apify scraper: ${item.error}`,
        structural: true,
      });
      continue;
    }
    out.set(u, {
      ok: true,
      views: viewsOf(item),
      caption: (item.caption ?? "").trim(),
      authorHandle: item.ownerUsername?.replace(/^@/, ""),
    });
  }
  return out;
}

export async function scrapeInstagram(url: string): Promise<ScrapeResult> {
  const map = await scrapeInstagramBatch([url]);
  return (
    map.get(url) ?? {
      ok: false,
      error: "Apify returned no results for that Instagram URL.",
      structural: true,
    }
  );
}
