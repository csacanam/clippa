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
};

// ---- URL validation ---------------------------------------------------

const IG_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+\/?/i;
const TT_REGEX =
  /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com\/(@[^/]+\/video\/\d+|t\/[A-Za-z0-9]+|v\/\d+)/i;

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
