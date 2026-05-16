"use client";

import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";

import { useTranslation } from "@/components/locale-provider";
import { formatUsd, type Platform } from "@/lib/campaigns";
import type { FeaturedClip } from "@/lib/actions/stats";

/**
 * Bounty-style social-proof carousel: each card plays a muted-loop video
 * (admin-curated, hosted anywhere reachable by URL) with the earnings
 * pinned on top. Click anywhere on the card to open the original post.
 *
 * Horizontal scroll with CSS scroll-snap — no JS carousel lib needed.
 * Arrow buttons scroll a card-width at a time on desktop; mobile users
 * swipe natively.
 */
export function TopClipsShowcase({ clips }: { clips: FeaturedClip[] }) {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (clips.length === 0) {
    return (
      <p className="py-6 text-center font-body text-sm text-ink-soft">
        {t("landing.topClipsEmpty")}
      </p>
    );
  }

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Card width incl. gap — keep in sync with the card sizing below.
    const step = el.clientWidth * 0.85;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {clips.map((c) => (
          <ClipVideoCard key={c.id} clip={c} />
        ))}
      </div>

      {clips.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Previous"
            className="inline-flex size-9 items-center justify-center rounded-full border-2 border-ink bg-cream text-ink shadow-sticker transition-transform hover:-translate-y-[1px] active:translate-y-0"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Next"
            className="inline-flex size-9 items-center justify-center rounded-full border-2 border-ink bg-cream text-ink shadow-sticker transition-transform hover:-translate-y-[1px] active:translate-y-0"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

function ClipVideoCard({ clip }: { clip: FeaturedClip }) {
  const { t } = useTranslation();
  const platformLabel = PLATFORM_LABELS[clip.platform];

  return (
    <a
      href={clip.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block w-[70vw] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-card border-2 border-ink bg-ink shadow-sticker transition-transform hover:-translate-y-[2px] hover:shadow-sticker-lg sm:w-[280px]"
    >
      {/* 9:16 vertical video aspect — matches TikTok / Instagram Reels */}
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-ink">
        <video
          src={clip.featuredVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />

        {/* Top: platform + campaign */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-3 text-cream">
          <span className="rounded-full border border-cream/40 bg-black/40 px-2 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-wider backdrop-blur-sm">
            {platformLabel}
          </span>
          <span className="truncate text-right font-display text-[0.65rem] font-bold uppercase tracking-wider opacity-90">
            {clip.campaignName}
          </span>
        </div>

        {/* Bottom: earnings overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-cream">
          <span className="font-display text-[0.65rem] font-bold uppercase tracking-wider opacity-80">
            {t("landing.topClipsEarnedLabel")}
          </span>
          <span className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {formatUsd(clip.earningsUsd)}
          </span>
          <span className="font-mono text-[0.7rem] opacity-80">
            {clip.verifiedViews.toLocaleString()}{" "}
            {t("landing.topClipsViewsLabel")}
          </span>
        </div>
      </div>

      {/* Footer: watch CTA */}
      <div className="flex items-center justify-between gap-2 bg-cream px-3 py-2">
        <span className="font-display text-[0.7rem] font-bold uppercase tracking-wider text-indigo">
          {t("landing.topClipsWatchOn", { platform: platformLabel })}
        </span>
        <ArrowUpRight className="size-3.5 text-indigo transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </a>
  );
}
