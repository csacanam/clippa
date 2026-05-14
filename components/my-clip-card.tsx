"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { removeClip } from "@/lib/actions/clips";
import { formatUsd } from "@/lib/campaigns";
import { type Clip, type ClipStatus } from "@/lib/clips";
import { useAccessToken } from "@/lib/hooks/use-access-token";

function statusBadge(s: ClipStatus): {
  label: string;
  variant: "live" | "review" | "rejected" | "muted";
} {
  switch (s) {
    case "tracking":
      return { label: "Live", variant: "live" };
    case "pending":
      return { label: "Under review", variant: "review" };
    case "rejected":
      return { label: "Not approved", variant: "rejected" };
    case "paused":
      return { label: "Paused", variant: "muted" };
    case "maxed_out":
      return { label: "Max payout reached", variant: "muted" };
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
  const identityToken = useAccessToken();
  const badge = statusBadge(clip.status);
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
              {badge.label}
            </Badge>
            {!confirming && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(true);
                }}
                aria-label="Remove clip"
                className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-cream hover:text-ink"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <ChevronRight className="size-4 text-ink-soft" />
          </div>
        </div>

        {clip.status === "tracking" && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="font-mono">
              {clip.verifiedViews.toLocaleString()} views
            </span>
            <span className="text-ink-soft">·</span>
            <span className="font-display font-bold">
              {formatUsd(clip.earningsUsd)} earned
            </span>
          </div>
        )}

        {clip.status === "rejected" && clip.rejectionReason && (
          <p className="text-xs text-ink-soft">
            <span className="font-display font-bold uppercase tracking-wider">
              Reason:
            </span>{" "}
            {clip.rejectionReason}
          </p>
        )}

        {confirming && (
          <div className="mt-2 flex flex-col gap-2 rounded-md border-2 border-ink bg-cream p-3">
            <p className="text-sm">
              Remove this clip?{" "}
              {earnedSomething ? (
                <span className="text-ink-soft">
                  Payouts already sent stay yours. We&apos;ll stop tracking new
                  views.
                </span>
              ) : (
                <span className="text-ink-soft">
                  You haven&apos;t earned anything yet, so nothing&apos;s lost.
                </span>
              )}
            </p>
            {error && <p className="text-xs text-error">{error}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handleRemove}
                disabled={removing}
                variant="destructive"
                size="sm"
              >
                {removing ? "Removing..." : "Yes, remove"}
              </Button>
              <Button
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
