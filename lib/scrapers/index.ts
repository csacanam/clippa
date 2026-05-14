import type { Platform } from "@/lib/campaigns";

import { scrapeInstagram } from "./instagram";
import { scrapeTiktok } from "./tiktok";
import type { ScrapeResult } from "./types";

export async function scrapePost(
  platform: Platform,
  url: string
): Promise<ScrapeResult> {
  if (platform === "tiktok") return scrapeTiktok(url);
  if (platform === "instagram") return scrapeInstagram(url);
  return { ok: false, error: `Unknown platform: ${platform}` };
}

export type { ScrapeResult } from "./types";
