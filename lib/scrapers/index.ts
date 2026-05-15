import type { Platform } from "@/lib/campaigns";

import { scrapeInstagram, scrapeInstagramBatch } from "./instagram";
import { scrapeTiktok, scrapeTiktokBatch } from "./tiktok";
import type { ScrapeResult } from "./types";

export async function scrapePost(
  platform: Platform,
  url: string
): Promise<ScrapeResult> {
  if (platform === "tiktok") return scrapeTiktok(url);
  if (platform === "instagram") return scrapeInstagram(url);
  return { ok: false, error: `Unknown platform: ${platform}` };
}

/**
 * Scrapes many posts of one platform in a single Apify run. Returns a map
 * keyed by the input URL. Batching keeps us to one actor run per platform —
 * one run per clip blew Apify's concurrent-memory limit.
 */
export async function scrapePostsBatch(
  platform: Platform,
  urls: string[]
): Promise<Map<string, ScrapeResult>> {
  if (platform === "tiktok") return scrapeTiktokBatch(urls);
  if (platform === "instagram") return scrapeInstagramBatch(urls);
  const out = new Map<string, ScrapeResult>();
  for (const u of urls) {
    out.set(u, { ok: false, error: `Unknown platform: ${platform}` });
  }
  return out;
}

export type { ScrapeResult } from "./types";
