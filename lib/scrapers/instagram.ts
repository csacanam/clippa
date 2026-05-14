/**
 * Instagram view scraper via Apify.
 *
 * Uses `apify/instagram-scraper` (~$1.50 / 1,000 results). Returns
 * videoPlayCount, caption, ownerUsername. Apify handles the headless
 * browser, IP rotation, and HTML changes for us.
 *
 * Set APIFY_API_TOKEN in .env to enable.
 */

import type { ScrapeResult } from "./types";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

type ApifyItem = {
  videoPlayCount?: number;
  videoViewCount?: number;
  caption?: string;
  ownerUsername?: string;
  type?: string;
  error?: string;
};

export async function scrapeInstagram(url: string): Promise<ScrapeResult> {
  if (!APIFY_TOKEN) {
    return {
      ok: false,
      error:
        "Instagram scraping isn't configured. Set APIFY_API_TOKEN to enable.",
      structural: false,
    };
  }

  const endpoint = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(
    APIFY_TOKEN
  )}`;

  let items: ApifyItem[];
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [url],
        resultsType: "details",
        resultsLimit: 1,
        addParentData: false,
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
      error: "Apify returned no results for that Instagram URL.",
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

  const views =
    typeof item.videoPlayCount === "number"
      ? item.videoPlayCount
      : typeof item.videoViewCount === "number"
        ? item.videoViewCount
        : 0;

  return {
    ok: true,
    views,
    caption: (item.caption ?? "").trim(),
    authorHandle: item.ownerUsername?.replace(/^@/, ""),
  };
}
