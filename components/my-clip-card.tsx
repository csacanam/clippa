"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { removeClip } from "@/lib/actions/clips";
import { formatUsd } from "@/lib/campaigns";
import { type Clip, type ClipStatus } from "@/lib/clips";
import { useAccessToken } from "@/lib/hooks/use-access-token";

function statusInfo(s: ClipStatus): {
  key: string;
  variant: "live" | "review" | "rejected" | "muted";
} {
  switch (s) {
    case "tracking":
      return { key: "common.statusLive", variant: "live" };
    case "pending":
      return { key: "common.statusUnderReview", variant: "review" };
    case "rejected":
      return { key: "common.statusNotApproved", variant: "rejected" };
    case "paused":
      return { key: "common.statusPaused", variant: "muted" };
    case "maxed_out":
      return { key: "common.statusMaxedOut", variant: "muted" };
  }
}

export function MyClipCard({
  clip,
  onRemoved,
}: {
  clip: Clip;
  onRemoved: () => void | Promise<void>;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const identityToken = useAccessToken();
  const badge = statusInfo(clip.status);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    if (!identityToken) return;
    setRemoving(true);
    setError(null);
    const r = await removeClip(identityToken, clip.id);
    setRemoving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    await onRemoved();
  };

  // Click anywhere on the card → detail. Inner anchors / buttons stop propagation.
  const handleCardClick = (e: React.MouseEvent) => {
    if (confirming) return;
    // If a child anchor or button caught the event already, ignore.
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    router.push(`/app/clips/${clip.id}`);
  };

  const earnedSomething = clip.paidOutUsd > 0;

  return (
    <Card
      onClick={handleCardClick}
      className="bg-peach cursor-pointer transition-transform hover:-translate-y-[2px] hover:shadow-sticker-lg"
    >
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">
              {clip.campaignName}{" "}
              <span className="font-body font-medium text-ink-soft capitalize">
                · {clip.platform}
              </span>
            </CardTitle>
            <p className="mt-1 truncate text-xs text-ink-soft">
              <a
                href={clip.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {clip.postUrl}
              </a>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={badge.variant} className="px-2.5 py-0.5">
              {t(badge.key)}
            </Badge>
            {!confirming && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(true);
                }}
                aria-label={t("clipCard.removeAria")}
                className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-cream hover:text-ink"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <ChevronRight className="size-4 text-ink-soft" />
          </div>
        </div>

        {clip.status === "tracking" && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="font-mono">
              {t("clipCard.viewsLabel", {
                n: clip.verifiedViews.toLocaleString(),
              })}
            </span>
            <span className="text-ink-soft">·</span>
            <span className="font-display font-bold">
              {t("clipCard.earnedLabel", {
                amount: formatUsd(clip.earningsUsd),
              })}
            </span>
            <span className="text-ink-soft">·</span>
            <span className="font-display font-bold text-ink-soft">
              {t("clipCard.paidLabel", {
                amount: formatUsd(clip.paidOutUsd),
              })}
            </span>
          </div>
        )}

        {clip.status === "rejected" && clip.rejectionReason && (
          <p className="text-xs text-ink-soft">
            <span className="font-display font-bold uppercase tracking-wider">
              {t("clipCard.reasonLabel")}
            </span>{" "}
            {clip.rejectionReason}
          </p>
        )}

        {confirming && (
          <div className="mt-2 flex flex-col gap-2 rounded-md border-2 border-ink bg-cream p-3">
            <p className="text-sm">
              {t("clipCard.confirmRemove")}{" "}
              <span className="text-ink-soft">
                {earnedSomething
                  ? t("clipCard.payoutsStay")
                  : t("clipCard.noLoss")}
              </span>
            </p>
            {error && <p className="text-xs text-error">{error}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handleRemove}
                disabled={removing}
                variant="destructive"
                size="sm"
              >
                {removing ? t("clipCard.removing") : t("clipCard.yesRemove")}
              </Button>
              <Button
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                variant="ghost"
                size="sm"
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
