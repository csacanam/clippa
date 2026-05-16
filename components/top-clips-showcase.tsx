"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";

import { useTranslation } from "@/components/locale-provider";
import { formatUsd, type Platform } from "@/lib/campaigns";
import type { FeaturedClip } from "@/lib/actions/stats";

/**
 * Bounty-style social-proof marquee: cards slide left at constant speed
 * with muted-loop videos and the earnings pinned on top. The track is
 * rendered as two copies of the (possibly repeated) clip list; the
 * animation moves -50% so the loop seam never crosses the viewport.
 *
 * Each copy is repeated until it's wider than any reasonable screen,
 * so on ultra-wide monitors the loop boundary never becomes visible.
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

  // Build a single "copy" wide enough to overflow any reasonable viewport.
  // Each card is ~290px (260 + gap + paddings). Aiming for ≥ 2400px per
  // copy covers ultrawide screens with margin to spare.
  const cardsPerCopy = Math.max(8, Math.ceil(8 / clips.length) * clips.length);
  const oneCopy = Array.from({ length: cardsPerCopy }, (_, i) => clips[i % clips.length]);
  const doubled = [...oneCopy, ...oneCopy];

  // Slow down a little when we have more cards so the speed feels constant
  // regardless of total track length.
  const duration = Math.max(30, doubled.length * 4);

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="flex w-max gap-4 animate-marquee"
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        {doubled.map((c, i) => (
          <ClipVideoCard key={`${c.id}-${i}`} clip={c} index={i} />
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

// Cycle accent colors so adjacent cards visually differ even when the
// same clip repeats. Stable per-position so layout doesn't shuffle.
const VIDEO_BGS = ["bg-peach", "bg-lime", "bg-magenta"] as const;

function ClipVideoCard({
  clip,
  index,
}: {
  clip: FeaturedClip;
  index: number;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const platformLabel = PLATFORM_LABELS[clip.platform];
  const videoBg = VIDEO_BGS[index % VIDEO_BGS.length];

  // Belt-and-suspenders: some browsers ignore the autoplay attribute
  // on a freshly-mounted <video> until interaction; calling .play()
  // explicitly works around it (silent because muted + playsInline).
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
      className="group block w-[68vw] max-w-[260px] shrink-0 rounded-card border-2 border-ink bg-cream p-3 shadow-sticker transition-transform hover:-translate-y-[2px] hover:shadow-sticker-lg sm:w-[260px]"
    >
      {/* Inner ink-bordered video frame — matches the rest of the
       *  brutalist sticker style. The brand-coloured bg shows during
       *  the brief moment before the video file loads, so the frame is
       *  never a blank black/white rectangle. */}
      <div
        className={`relative aspect-[9/16] w-full overflow-hidden rounded-md border-2 border-ink ${videoBg}`}
      >
        <video
          ref={videoRef}
          src={clip.featuredVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Top overlay: platform + campaign */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-3 text-cream">
          <span className="rounded-full border border-cream/40 bg-black/40 px-2 py-0.5 font-display text-[0.6rem] font-bold uppercase tracking-wider backdrop-blur-sm">
            {platformLabel}
          </span>
          <span className="truncate text-right font-display text-[0.6rem] font-bold uppercase tracking-wider opacity-90">
            {clip.campaignName}
          </span>
        </div>

        {/* Bottom overlay: earnings + views */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 text-cream">
          <span className="font-display text-[0.6rem] font-bold uppercase tracking-wider opacity-80">
            {t("landing.topClipsEarnedLabel")}
          </span>
          <span className="font-display text-3xl font-bold tracking-tight">
            {formatUsd(clip.earningsUsd)}
          </span>
          <span className="font-mono text-[0.65rem] opacity-80">
            {clip.verifiedViews.toLocaleString()}{" "}
            {t("landing.topClipsViewsLabel")}
          </span>
        </div>
      </div>

      {/* CTA below the video frame — just text in the cream wrapper,
       *  no separate panel, so the card reads as one sticker. */}
      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <span className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-indigo">
          {t("landing.topClipsWatchOn", { platform: platformLabel })}
        </span>
        <ArrowUpRight className="size-3.5 text-indigo transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </a>
  );
}
