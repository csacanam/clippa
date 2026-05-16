/**
 * Clip types + URL validation (pure).
 * Data access lives in lib/actions/clips.ts (server actions).
 */

import type { Platform } from "./campaigns";

export type ClipStatus =
  | "pending"
  | "tracking"
  | "rejected"
  | "paused"
  | "maxed_out";

export type Clip = {
  id: string;
  campaignSlug: string;
  campaignName: string; // joined from campaigns table for display
  creatorEmail?: string; // joined from creators table — admin views only
  platform: Platform;
  postUrl: string;
  trackingCode?: string;
  status: ClipStatus;
  rejectionReason?: string;
  verifiedViews: number;
  paidViews: number;
  earningsUsd: number;
  paidOutUsd: number;
  createdAt: string; // ISO
  approvedAt?: string;
  lastScrapedAt?: string;
  /** Admin-curated video URL shown in the public landing carousel. */
  featuredVideoUrl?: string;
};

// ---- URL validation ---------------------------------------------------

const IG_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+\/?/i;

// TikTok has two link shapes:
//  - full:  www.tiktok.com/@user/video/123 , www.tiktok.com/t/CODE , .../v/123
//  - short: vt.tiktok.com/CODE , vm.tiktok.com/CODE  (app "share" links — redirects)
const TT_FULL_REGEX =
  /^https?:\/\/(www\.|m\.)?tiktok\.com\/(@[^/]+\/video\/\d+|t\/[A-Za-z0-9]+|v\/\d+)/i;
const TT_SHORT_REGEX =
  /^https?:\/\/(vt|vm)\.tiktok\.com\/[A-Za-z0-9]+/i;
const TT_REGEX = new RegExp(
  `(${TT_FULL_REGEX.source})|(${TT_SHORT_REGEX.source})`,
  "i"
);

/** True when the URL is a TikTok app short link that needs redirect-resolving. */
export function isTikTokShortLink(url: string): boolean {
  return TT_SHORT_REGEX.test(url.trim());
}

export function validatePostUrl(
  platform: Platform,
  url: string
): { ok: true } | { ok: false; error: string } {
  const u = url.trim();
  if (!u) return { ok: false, error: "Paste the link to your post." };
  if (platform === "instagram") {
    if (!IG_REGEX.test(u)) {
      return {
        ok: false,
        error: "Doesn't look like an Instagram reel or post link.",
      };
    }
  } else if (platform === "tiktok") {
    if (!TT_REGEX.test(u)) {
      return {
        ok: false,
        error: "Doesn't look like a TikTok video link.",
      };
    }
  }
  return { ok: true };
}
