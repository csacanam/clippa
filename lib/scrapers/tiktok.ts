/**
 * TikTok view scraper via Apify.
 *
 * Uses `clockworks/tiktok-scraper` (~$0.40 / 1,000 results). Apify handles
 * the proxy rotation, HTML changes, and soft rate-limits that broke our
 * previous direct-fetch approach.
 *
 * Scraping is batched: one actor run handles every URL at once. Firing one
 * run per clip blew Apify's concurrent-memory limit (8 GB across all runs).
 *
 * Set APIFY_API_TOKEN in .env to enable.
 */

import type { ScrapeResult } from "./types";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

type ApifyItem = {
  id?: string;
  text?: string; // caption
  playCount?: number;
  authorMeta?: {
    name?: string; // username
  };
  webVideoUrl?: string;
  error?: string;
};

/** Extracts the numeric video id from a TikTok URL, used to match results. */
function tiktokVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Scrapes many TikTok posts in a single Apify run. Returns a map keyed by the
 * input URL — every input URL gets an entry (a ScrapeError if it had no match).
 */
export async function scrapeTiktokBatch(
  urls: string[]
): Promise<Map<string, ScrapeResult>> {
  const out = new Map<string, ScrapeResult>();
  if (urls.length === 0) return out;

  if (!APIFY_TOKEN) {
    const err: ScrapeResult = {
      ok: false,
      error: "TikTok scraping isn't configured. Set APIFY_API_TOKEN to enable.",
      structural: false,
    };
    for (const u of urls) out.set(u, err);
    return out;
  }

  const endpoint = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(
    APIFY_TOKEN
  )}`;

  let items: ApifyItem[];
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postURLs: urls,
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      const err: ScrapeResult = {
        ok: false,
        error: `Apify ${res.status}: ${body.slice(0, 200)}`,
        structural:
          res.status === 401 || res.status === 402 || res.status === 403,
      };
      for (const u of urls) out.set(u, err);
      return out;
    }
    items = (await res.json()) as ApifyItem[];
  } catch (e) {
    const err: ScrapeResult = {
      ok: false,
      error: `Apify network error: ${(e as Error).message}`,
    };
    for (const u of urls) out.set(u, err);
    return out;
  }

  // Match each input URL to its result item. First pass: by video id.
  // Second pass: positional fallback for short links (vt.tiktok.com/XXX)
  // whose id we couldn't extract — Apify resolves them internally and
  // returns the item in input order, so the next unclaimed item is the one.
  const matched: (ApifyItem | undefined)[] = new Array(urls.length);
  const claimedItem = new Set<number>();
  for (let i = 0; i < urls.length; i++) {
    const id = tiktokVideoId(urls[i]);
    if (!id) continue;
    for (let j = 0; j < items.length; j++) {
      if (claimedItem.has(j)) continue;
      const it = items[j];
      const itemId = it.id ?? (it.webVideoUrl ? tiktokVideoId(it.webVideoUrl) : null);
      if (itemId === id) {
        matched[i] = it;
        claimedItem.add(j);
        break;
      }
    }
  }
  let cursor = 0;
  for (let i = 0; i < urls.length; i++) {
    if (matched[i]) continue;
    while (cursor < items.length && claimedItem.has(cursor)) cursor++;
    if (cursor < items.length) {
      matched[i] = items[cursor];
      claimedItem.add(cursor);
      cursor++;
    }
  }

  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    const item = matched[i];
    if (!item) {
      out.set(u, {
        ok: false,
        error: "Apify returned no results for that TikTok URL.",
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
      views: typeof item.playCount === "number" ? item.playCount : 0,
      caption: (item.text ?? "").trim(),
      authorHandle: item.authorMeta?.name?.replace(/^@/, ""),
      // Apify resolves short links (vt.tiktok.com) to the full video URL.
      canonicalUrl: item.webVideoUrl ?? undefined,
    });
  }
  return out;
}

export async function scrapeTiktok(url: string): Promise<ScrapeResult> {
  const map = await scrapeTiktokBatch([url]);
  return (
    map.get(url) ?? {
      ok: false,
      error: "Apify returned no results for that TikTok URL.",
      structural: true,
    }
  );
}
