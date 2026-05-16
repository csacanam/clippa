"use client";

import { ArrowUpRight, Camera, Music2 } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd, type Platform } from "@/lib/campaigns";
import type { ShowcaseClip } from "@/lib/actions/stats";

/**
 * Grid of real published clips with their views + earnings. Each card
 * deep-links out to the actual Instagram / TikTok post so visitors can
 * see the format and verify the social proof. Identity-free — we never
 * expose the creator's email or handle, just the campaign + numbers.
 */
export function TopClipsShowcase({ clips }: { clips: ShowcaseClip[] }) {
  const { t } = useTranslation();
  if (clips.length === 0) {
    return (
      <p className="py-6 text-center font-body text-sm text-ink-soft">
        {t("landing.topClipsEmpty")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((c) => (
        <ClipCard key={c.id} clip={c} />
      ))}
    </div>
  );
}

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

const CARD_BGS = ["bg-peach", "bg-lime", "bg-cream"] as const;

function ClipCard({ clip }: { clip: ShowcaseClip }) {
  const { t } = useTranslation();
  // Stable color per clip id so the grid keeps the same colors across renders.
  const colorIndex =
    clip.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    CARD_BGS.length;
  const bg = CARD_BGS[colorIndex];
  const platformLabel = PLATFORM_LABELS[clip.platform];

  return (
    <a
      href={clip.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-transform hover:-translate-y-[2px] active:translate-y-0"
    >
      <Card className={`${bg} h-full hover:shadow-sticker-lg`}>
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-cream px-2.5 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-wider">
              {clip.platform === "instagram" ? (
                <Camera className="size-3" />
              ) : (
                <Music2 className="size-3" />
              )}
              {platformLabel}
            </span>
            <span className="truncate font-display text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
              {clip.campaignName}
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-1 py-4 text-center">
            <span className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
              {t("landing.topClipsEarnedLabel")}
            </span>
            <span className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              {formatUsd(clip.earningsUsd)}
            </span>
            <span className="font-mono text-xs text-ink-soft">
              {clip.verifiedViews.toLocaleString()}{" "}
              {t("landing.topClipsViewsLabel")}
            </span>
          </div>

          <div className="flex items-center justify-between border-t-2 border-ink/10 pt-2">
            <span className="font-display text-[0.7rem] font-bold uppercase tracking-wider text-indigo">
              {t("landing.topClipsWatchOn", { platform: platformLabel })}
            </span>
            <ArrowUpRight className="size-3.5 text-indigo" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
