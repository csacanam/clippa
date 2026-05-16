"use client";

import { ArrowUpRight, Check, Download, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { useTranslation } from "@/components/locale-provider";
import { ModeBar } from "@/components/mode-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  listClipsForBrandCampaign,
  type BrandCampaignClip,
} from "@/lib/actions/campaigns";
import { approveClip, rejectClip } from "@/lib/actions/clips";
import { formatUsd } from "@/lib/campaigns";
import { useAccessToken } from "@/lib/hooks/use-access-token";

function statusVariant(
  s: BrandCampaignClip["status"]
): "live" | "review" | "rejected" | "muted" {
  switch (s) {
    case "tracking":
      return "live";
    case "pending":
      return "review";
    case "rejected":
      return "rejected";
    case "paused":
    case "maxed_out":
      return "muted";
  }
}

function ClipsPage() {
  const { slug } = useParams<{ slug: string }>();
  const identityToken = useAccessToken();
  const { t } = useTranslation();
  const [data, setData] = useState<
    | null
    | { ok: true; campaignName: string; clips: BrandCampaignClip[] }
    | { ok: false; error: string }
  >(null);

  const load = () => {
    if (!identityToken || !slug) return;
    listClipsForBrandCampaign(identityToken, slug)
      .then(setData)
      .catch((e) => setData({ ok: false, error: (e as Error).message }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityToken, slug]);

  const statusLabel = (s: BrandCampaignClip["status"]) => {
    switch (s) {
      case "tracking":
        return t("brand.clipsStatusTracking");
      case "pending":
        return t("brand.clipsStatusPending");
      case "rejected":
        return t("brand.clipsStatusRejected");
      case "paused":
        return t("brand.clipsStatusPaused");
      case "maxed_out":
        return t("brand.clipsStatusMaxed");
    }
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <header className="flex items-center justify-between gap-3">
          <ClippaLogo />
          <Link
            href="/brand"
            className="font-body text-sm font-medium text-ink-soft underline-offset-4 hover:underline"
          >
            {t("brand.backToDashboard")}
          </Link>
        </header>

        <ModeBar currentMode="brand" />

        <section className="mt-8 w-full">
          {data === null ? (
            <p className="text-center font-display text-sm uppercase tracking-wider text-ink-soft">
              {t("common.loading")}
            </p>
          ) : !data.ok ? (
            <Card className="bg-peach">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="font-display text-lg font-bold tracking-tight">
                  {data.error}
                </p>
                <Link
                  href="/brand"
                  className="font-body text-sm text-indigo underline-offset-4 hover:underline"
                >
                  {t("brand.resumeBack")}
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {t("brand.clipsTitle", { campaign: data.campaignName })}
                </h1>
                <p className="mt-1 font-body text-sm text-ink-soft">
                  {t("brand.clipsSubtitle")}
                </p>
              </motion.div>

              {data.clips.length === 0 ? (
                <Card className="mt-6 bg-peach">
                  <CardContent className="py-10 text-center font-body text-sm text-ink-soft">
                    {t("brand.clipsEmpty")}
                  </CardContent>
                </Card>
              ) : (
                <div className="mt-6 flex flex-col gap-3">
                  {data.clips.map((c, i) => (
                    <ClipRow
                      key={c.id}
                      clip={c}
                      index={i}
                      statusLabel={statusLabel}
                      identityToken={identityToken ?? ""}
                      onChange={load}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function ClipRow({
  clip,
  index,
  statusLabel,
  identityToken,
  onChange,
}: {
  clip: BrandCampaignClip;
  index: number;
  statusLabel: (s: BrandCampaignClip["status"]) => string;
  identityToken: string;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = clip.status === "pending";

  const handleApprove = async () => {
    if (!identityToken) return;
    setWorking(true);
    setError(null);
    const r = await approveClip(identityToken, clip.id);
    setWorking(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onChange();
  };

  const handleReject = async () => {
    if (!identityToken) return;
    setWorking(true);
    setError(null);
    const r = await rejectClip(identityToken, clip.id, reason);
    setWorking(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onChange();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Card className="bg-cream">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={statusVariant(clip.status)}
                  className="px-2 py-0.5 text-[0.6rem]"
                >
                  {statusLabel(clip.status)}
                </Badge>
                <span className="font-display text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
                  {clip.platform}
                </span>
              </div>
              <a
                href={clip.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 truncate font-body text-xs text-indigo underline-offset-2 hover:underline"
              >
                {t("brand.clipsViewPost")}
                <ArrowUpRight className="size-3 shrink-0" />
              </a>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                <span>
                  <span className="font-mono font-bold text-ink">
                    {clip.verifiedViews.toLocaleString()}
                  </span>{" "}
                  {t("brand.clipsViews")}
                </span>
                <span>
                  <span className="font-mono font-bold text-ink">
                    {formatUsd(clip.earningsUsd)}
                  </span>{" "}
                  {t("brand.clipsEarned")}
                </span>
                <span>
                  <span className="font-mono font-bold text-ink">
                    {formatUsd(clip.paidOutUsd)}
                  </span>{" "}
                  {t("brand.clipsPaid")}
                </span>
              </div>
            </div>

            <div className="shrink-0">
              {clip.featuredVideoUrl ? (
                <a
                  href={clip.featuredVideoUrl}
                  download={`${clip.id}.mp4`}
                  className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-lime px-3 py-1.5 font-display text-[0.7rem] font-bold uppercase tracking-wider shadow-sticker transition-transform hover:-translate-y-[1px] hover:shadow-sticker-lg active:translate-y-0"
                >
                  <Download className="size-3.5" />
                  {t("brand.clipsDownload")}
                </a>
              ) : (
                <span className="font-display text-[0.7rem] uppercase tracking-wider text-ink-soft">
                  {t("brand.clipsNoVideo")}
                </span>
              )}
            </div>
          </div>

          {/* Moderation row — only for clips the brand still has to review */}
          {isPending && (
            <div className="border-t-2 border-ink/10 pt-3">
              {error && (
                <p className="mb-2 font-body text-xs text-error">{error}</p>
              )}
              {!confirming ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={working}
                    variant="default"
                    size="sm"
                  >
                    <Check className="size-3.5" />
                    {t("brand.clipsApprove")}
                  </Button>
                  <Button
                    onClick={() => {
                      setConfirming(true);
                      setError(null);
                    }}
                    disabled={working}
                    variant="outline"
                    size="sm"
                  >
                    <X className="size-3.5" />
                    {t("brand.clipsReject")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder={t("brand.clipsRejectReason")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    autoFocus
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      onClick={() => {
                        setConfirming(false);
                        setReason("");
                        setError(null);
                      }}
                      disabled={working}
                      variant="ghost"
                      size="sm"
                    >
                      {t("brand.clipsCancel")}
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={!reason.trim() || working}
                      variant="destructive"
                      size="sm"
                    >
                      {t("brand.clipsConfirmReject")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If the clip was rejected, show the reason inline for the brand
           *  (so they remember what they told the creator). */}
          {clip.status === "rejected" && clip.rejectionReason && (
            <div className="rounded-md border-2 border-dashed border-ink/30 bg-cream/50 px-3 py-2 text-xs text-ink-soft">
              <span className="font-display font-bold uppercase tracking-wider">
                {t("brand.clipsReasonLabel")}
              </span>{" "}
              <span className="text-ink">{clip.rejectionReason}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function BrandClipsPage() {
  return (
    <AuthGuard redirectTo="/brands">
      <ClipsPage />
    </AuthGuard>
  );
}
