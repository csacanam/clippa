/**
 * TikTok view scraper via Apify.
 *
 * Uses `clockworks/tiktok-scraper` (~$0.40 / 1,000 results). Apify handles
 * the proxy rotation, HTML changes, and soft rate-limits that broke our
 * previous direct-fetch approach.
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

export async function scrapeTiktok(url: string): Promise<ScrapeResult> {
  if (!APIFY_TOKEN) {
    return {
      ok: false,
      error:
        "TikTok scraping isn't configured. Set APIFY_API_TOKEN to enable.",
      structural: false,
    };
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
        postURLs: [url],
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Apify ${res.status}: ${body.slice(0, 200)}`,
        structural: res.status === 401 || res.status === 402 || res.status === 403,
      };
    }
    items = (await res.json()) as ApifyItem[];
  } catch (e) {
    return {
      ok: false,
      error: `Apify network error: ${(e as Error).message}`,
    };
  }

  const item = items[0];
  if (!item) {
    return {
      ok: false,
      error: "Apify returned no results for that TikTok URL.",
      structural: true,
    };
  }
  if (item.error) {
    return {
      ok: false,
      error: `Apify scraper: ${item.error}`,
      structural: true,
    };
  }

  return {
    ok: true,
    views: typeof item.playCount === "number" ? item.playCount : 0,
    caption: (item.text ?? "").trim(),
    authorHandle: item.authorMeta?.name?.replace(/^@/, ""),
  };
}
