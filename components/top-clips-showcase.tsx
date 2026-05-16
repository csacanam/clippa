"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";

import { useTranslation } from "@/components/locale-provider";
import { formatUsd, type Platform } from "@/lib/campaigns";
import type { FeaturedClip } from "@/lib/actions/stats";

/**
 * Bounty-style social-proof marquee: cards slide left-to-right
 * continuously; each card plays a muted-loop video with earnings pinned
 * on top. Click anywhere on a card to open the original post.
 *
 * The track is rendered twice; once the first copy has scrolled half its
 * width off-screen the second copy is exactly where the first started,
 * so the loop is seamless. Pauses on hover so visitors can read the
 * earnings, and respects prefers-reduced-motion.
 */
export function TopClipsShowcase({ clips }: { clips: FeaturedClip[] }) {
  const { t } = useTranslation();

  if (clips.length === 0) {
    return (
      <p className="py-6 text-center font-body text-sm text-ink-soft">
        {t("landing.topClipsEmpty")}
      </p>
    );
  }

  // Slower for fewer cards so each is on-screen long enough to register;
  // faster for many so the loop doesn't feel sluggish.
  const duration = Math.max(20, clips.length * 8);
  const doubled = [...clips, ...clips];

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="flex w-max gap-4 animate-marquee"
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        {doubled.map((c, i) => (
          // The second half of the list shares ids with the first half;
          // tag each render with the index so React doesn't get confused.
          <ClipVideoCard key={`${c.id}-${i}`} clip={c} />
        ))}
      </div>

      {/* Soft cream fades on the edges so the marquee feels like it
       *  emerges from / disappears into the page instead of a hard cut. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-cream to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-cream to-transparent sm:w-24" />
    </div>
  );
}

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

function ClipVideoCard({ clip }: { clip: FeaturedClip }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const platformLabel = PLATFORM_LABELS[clip.platform];

  // Belt-and-suspenders: ask for play once the file is loaded enough.
  // Some browsers ignore the autoplay attribute on a freshly-mounted
  // <video> until interaction; calling .play() explicitly works around it
  // (it'll succeed silently because the video is muted + playsInline).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => {
      void v.play().catch(() => {});
    };
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("loadeddata", tryPlay, { once: true });
    return () => v.removeEventListener("loadeddata", tryPlay);
  }, []);

  return (
    <a
      href={clip.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block w-[68vw] max-w-[260px] shrink-0 overflow-hidden rounded-card border-2 border-ink bg-ink shadow-sticker transition-transform hover:-translate-y-[2px] hover:shadow-sticker-lg sm:w-[260px]"
    >
      {/* 9:16 vertical video aspect — matches TikTok / Instagram Reels */}
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-ink">
        <video
          ref={videoRef}
          src={clip.featuredVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
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
