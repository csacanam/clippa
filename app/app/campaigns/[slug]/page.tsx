"use client";

import { Check, ChevronLeft, Copy } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { CommunityHint } from "@/components/community-card";
import { LocaleToggle } from "@/components/locale-toggle";
import { useTranslation } from "@/components/locale-provider";
import { RichText } from "@/components/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  findCampaignBySlug,
  getCampaignChainStateBySlug,
  getCampaignStats,
  type CampaignStats,
} from "@/lib/actions/campaigns";
import {
  getClipVideoUploadAuthorization,
  submitClip,
} from "@/lib/actions/clips";
import { getOrCreateTrackingCode } from "@/lib/actions/tracking-codes";
import {
  budgetPercentSpent,
  formatUsd,
  type Campaign,
  type CampaignChainState,
  type Platform,
} from "@/lib/campaigns";
import { validatePostUrl } from "@/lib/clips";
import { useAccessToken } from "@/lib/hooks/use-access-token";

type FormState =
  | { stage: "form" }
  | { stage: "submitted" };

const LANGUAGE_NATIVE_NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
};

function languageLabel(code: string): string {
  return LANGUAGE_NATIVE_NAMES[code] ?? code.toUpperCase();
}

function CampaignDetail() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const identityToken = useAccessToken();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [chain, setChain] = useState<CampaignChainState | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [postUrl, setPostUrl] = useState("");
  const [trackingCode, setTrackingCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingStage, setUploadingStage] = useState<
    "idle" | "uploading" | "submitting"
  >("idle");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [formState, setFormState] = useState<FormState>({ stage: "form" });
  const [copied, setCopied] = useState(false);

  // Load campaign from DB.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await findCampaignBySlug(slug, locale);
        if (cancelled) return;
        if (!c) {
          notFound();
          return;
        }
        setCampaign(c);
        // Budget comes from the on-chain escrow — the source of truth for money.
        getCampaignChainStateBySlug(slug)
          .then((s) => {
            if (!cancelled) setChain(s);
          })
          .catch(() => {});
        // Stats are non-critical — don't block the page on them.
        getCampaignStats(slug)
          .then((s) => {
            if (!cancelled) setStats(s);
          })
          .catch(() => {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, locale]);

  // Assign (or recover) a tracking code for this creator × campaign.
  useEffect(() => {
    if (!campaign || !identityToken) return;
    let cancelled = false;
    (async () => {
      try {
        const code = await getOrCreateTrackingCode(identityToken, campaign.slug);
        if (!cancelled) setTrackingCode(code);
      } catch (err) {
        console.error("Failed to allocate tracking code:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaign, identityToken]);

  if (loading || !campaign) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="font-display text-sm uppercase tracking-wider text-ink-soft">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  const displayCode = trackingCode ? `#${trackingCode}` : "";

  const handleCopyCode = async () => {
    if (!trackingCode) return;
    try {
      // Copy with the # so the user just pastes it in the caption as-is.
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const percentSpent = chain ? budgetPercentSpent(chain) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!platform) {
      setError(t("campaign.errPickPlatform"));
      return;
    }
    const v = validatePostUrl(platform, postUrl);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (!trackingCode) {
      setError(t("campaign.errCodeLoading"));
      return;
    }
    if (!identityToken) {
      setError(t("campaign.errAuthNotReady"));
      return;
    }
    if (!videoFile) {
      setError(t("campaign.errPickFile"));
      return;
    }
    if (!videoFile.type.startsWith("video/")) {
      setError(t("campaign.errFileNotVideo"));
      return;
    }
    if (videoFile.size > 25 * 1024 * 1024) {
      setError(t("campaign.errFileTooLarge"));
      return;
    }

    setSubmitting(true);

    // Pre-validate: post is reachable, video, caption contains the code.
    // The endpoint also returns a canonical URL — short links (vt.tiktok.com)
    // resolve to the full www.tiktok.com/@user/video/123 form.
    let finalUrl = postUrl.trim();
    try {
      const res = await fetch("/api/clips/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          postUrl: postUrl.trim(),
          trackingCode,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; canonicalUrl?: string; warning?: string }
        | { ok: false; code?: string; error: string };
      if (!data.ok) {
        console.error("[validate] client", data);
        // Map server error codes to localized messages.
        let msg = data.error;
        switch (data.code) {
          case "post_not_found":
            msg = t("campaign.errPostNotFound");
            break;
          case "short_link_unresolved":
            msg = t("campaign.errShortLinkUnresolved");
            break;
          case "tracking_unavailable":
            msg = t("campaign.errTrackingUnavailable");
            break;
          case "code_missing":
            msg = t("campaign.errTrackingCodeMissing", { code: trackingCode });
            break;
          case "rate_limited":
          case "network_error":
            msg = t("campaign.errScraperTimeout");
            break;
        }
        setError(msg);
        setSubmitting(false);
        return;
      }
      if (data.canonicalUrl) finalUrl = data.canonicalUrl;
    } catch (e) {
      console.error("[validate] client network", e);
      setError(t("campaign.errCouldntVerify"));
      setSubmitting(false);
      return;
    }

    // Generate the clip's UUID up-front so the uploaded file and the eventual
    // DB row share an id. Use crypto.randomUUID; widely supported.
    const clipId = crypto.randomUUID();

    setUploadingStage("uploading");
    console.log(
      `[upload] clipId=${clipId} size=${videoFile.size} type=${videoFile.type}`
    );
    // Get a signed Supabase Storage URL and upload directly from the browser.
    // Going through Vercel was timing out on bigger files.
    const auth = await getClipVideoUploadAuthorization(identityToken, clipId);
    if (!auth.ok) {
      console.error("[upload] auth failed", auth.error);
      setError(t("campaign.errUploadAuth"));
      setUploadingStage("idle");
      setSubmitting(false);
      return;
    }
    try {
      const putRes = await fetch(auth.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": videoFile.type || "video/mp4" },
        body: videoFile,
      });
      if (!putRes.ok) {
        const body = await putRes.text().catch(() => "");
        console.error(
          `[upload] PUT failed status=${putRes.status} body=${body.slice(0, 200)}`
        );
        setError(t("campaign.errUploadFailed"));
        setUploadingStage("idle");
        setSubmitting(false);
        return;
      }
      console.log("[upload] PUT ok");
    } catch (e) {
      console.error("[upload] network", e);
      setError(t("campaign.errUploadFailed"));
      setUploadingStage("idle");
      setSubmitting(false);
      return;
    }

    setUploadingStage("submitting");
    const result = await submitClip(identityToken, {
      clipId,
      campaignSlug: campaign.slug,
      platform,
      postUrl: finalUrl,
      trackingCode,
      featuredVideoUrl: auth.publicUrl,
    });
    setSubmitting(false);
    setUploadingStage("idle");

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFormState({ stage: "submitted" });
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <header className="flex items-center justify-between gap-3">
          <ClippaLogo />
          <div className="flex items-center gap-4">
            <LocaleToggle />
            <Link
              href="/app"
              className="flex items-center gap-1 font-body text-sm font-medium text-ink hover:underline"
            >
              <ChevronLeft className="size-4" />
              {t("common.back")}
            </Link>
          </div>
        </header>

        <section className="mt-8 w-full">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {campaign.productName}
          </h1>
          <p className="mt-1 font-body text-sm text-ink-soft md:text-base">
            {campaign.shortDescription}
          </p>
        </motion.div>

        {/* Payout terms — what the creator earns */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="mt-6"
        >
          <Card className="bg-lime">
            <CardContent>
              <p className="font-display text-xs font-bold uppercase tracking-wider">
                {t("campaign.whatYouEarn")}
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {formatUsd(campaign.ratePerViewUsd, { decimals: 2 })}
                </span>
                <span className="font-body text-sm text-ink-soft">
                  {t("campaign.perView")}
                </span>
                <span className="mx-1 text-ink-soft">·</span>
                <span className="font-display text-lg font-bold">
                  {formatUsd(campaign.maxPayoutPerClipUsd, { decimals: 0 })}
                </span>
                <span className="font-body text-sm text-ink-soft">
                  {t("campaign.maxPerClip")}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Campaign budget — how much the campaign has left */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
          className="mt-3"
        >
          <Card className="bg-peach">
            <CardContent>
              <p className="font-display text-xs font-bold uppercase tracking-wider">
                {t("campaign.budgetLabel")}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold tracking-tight">
                  {chain
                    ? t("campaign.budgetLeft", {
                        amount: formatUsd(chain.balanceUsd, { decimals: 2 }),
                      })
                    : t("campaign.budgetLoading")}
                </span>
                {chain && (
                  <span className="font-body text-sm text-ink-soft">
                    {t("campaign.budgetOf", {
                      total: formatUsd(chain.totalFundedUsd, { decimals: 2 }),
                    })}
                  </span>
                )}
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-cream">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${percentSpent}%` }}
                />
              </div>
              <p className="mt-1.5 font-body text-xs text-ink-soft">
                {stats && (stats.paidCreatorsCount > 0 || stats.liveClipsCount > 0)
                  ? [
                      stats.paidCreatorsCount > 0
                        ? t(
                            stats.paidCreatorsCount === 1
                              ? "campaign.creatorsEarningOne"
                              : "campaign.creatorsEarningMany",
                            { n: stats.paidCreatorsCount }
                          )
                        : null,
                      stats.liveClipsCount > 0
                        ? t(
                            stats.liveClipsCount === 1
                              ? "campaign.clipsLiveOne"
                              : "campaign.clipsLiveMany",
                            { n: stats.liveClipsCount }
                          )
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : t("campaign.beFirst")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* About this campaign */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="mt-10"
        >
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">
            {t("campaign.about")}
          </h2>
          <p className="mt-2 font-body text-sm md:text-base">
            {campaign.longDescription}
          </p>
        </motion.div>

        {/* Where to post & what languages are accepted */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.12 }}
          className="mt-8 flex flex-col gap-6 sm:flex-row sm:gap-12"
        >
          <div className="min-w-0">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
              {t("campaign.postOnLabel")}
            </h3>
            <p className="mt-2 font-body text-xs text-ink-soft">
              {t("campaign.postOnHint")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {campaign.platforms.map((p) => (
                <Badge key={p} variant="default" className="capitalize">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
          {campaign.availableLanguages.length > 0 && (
            <div className="min-w-0">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                {t("campaign.languagesLabel")}
              </h3>
              <p className="mt-2 font-body text-xs text-ink-soft">
                {t("campaign.languagesHint")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {campaign.availableLanguages.map((l) => (
                  <Badge key={l} variant="default">
                    {languageLabel(l)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Script */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
          className="mt-10"
        >
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">
            {t("campaign.script")}
          </h2>
          <Card className="mt-3 bg-cream">
            <CardContent>
              <RichText className="text-sm md:text-base">
                {campaign.scriptMarkdown}
              </RichText>
            </CardContent>
          </Card>
        </motion.div>

        {/* Campaign-specific rules — comes from the campaigns row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
          className="mt-10"
        >
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">
            {t("campaign.rules")}
          </h2>
          <RichText className="mt-2 text-sm md:text-base">
            {campaign.instructionsMarkdown}
          </RichText>
        </motion.div>

        {/* Common Clippa reminders — same across every campaign, hardcoded */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.22 }}
          className="mt-10"
        >
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">
            {t("campaign.howItWorks")}
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5 font-body text-sm md:text-base">
            <li>· {t("campaign.howItWorks1")}</li>
            <li>· {t("campaign.howItWorks2")}</li>
            <li>· {t("campaign.howItWorks3")}</li>
            <li>· {t("campaign.howItWorks4")}</li>
          </ul>
          <div className="mt-4">
            <CommunityHint />
          </div>
        </motion.div>

        {/* Submit form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.25 }}
          className="mt-12 mb-16"
        >
          {formState.stage === "form" ? (
            <Card>
              <CardContent>
                <CardTitle className="text-xl">
                  {t("campaign.submitTitle")}
                </CardTitle>
                <p className="mt-1 text-sm text-ink-soft">
                  {t("campaign.submitSubtitle")}
                </p>

                {/* Your code — prominent step 1 */}
                <div className="mt-6 rounded-card border-2 border-ink bg-lime p-5 shadow-sticker">
                  <p className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                    {t("campaign.step1Title")}
                  </p>
                  <p className="mt-1 text-xs text-ink/80">
                    {t("campaign.step1Subtitle")}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <code className="w-full truncate rounded-md border-2 border-ink bg-cream px-3 py-2 font-mono text-base font-bold tracking-wider sm:flex-1">
                      {displayCode || "..."}
                    </code>
                    <Button
                      type="button"
                      onClick={handleCopyCode}
                      variant="outline"
                      size="default"
                      disabled={!trackingCode}
                      className="w-full sm:w-auto"
                    >
                      {copied ? (
                        <>
                          <Check className="size-4" /> {t("common.copied")}
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" /> {t("common.copy")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-2">
                    <label className="font-display text-sm font-bold uppercase tracking-wide">
                      {t("campaign.step2Title")}
                    </label>
                    <div className="flex gap-2">
                      {campaign.platforms.map((p) => {
                        const selected = platform === p;
                        return (
                          <button
                            type="button"
                            key={p}
                            onClick={() => setPlatform(p)}
                            aria-pressed={selected}
                            className="cursor-pointer outline-none"
                          >
                            <Badge
                              variant={selected ? "indigo" : "default"}
                              className="px-4 py-1.5 text-sm capitalize"
                            >
                              {p}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-display text-sm font-bold uppercase tracking-wide">
                      {t("campaign.step3Title")}
                    </label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={postUrl}
                      onChange={(e) => setPostUrl(e.target.value)}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-display text-sm font-bold uppercase tracking-wide">
                      {t("campaign.step4Title")}
                    </label>
                    <label className="inline-flex cursor-pointer items-center justify-between gap-3 rounded-md border-2 border-dashed border-ink/40 bg-cream/50 px-4 py-3 transition-colors hover:bg-peach/60">
                      <span className="truncate font-body text-sm text-ink-soft">
                        {videoFile
                          ? t("campaign.step4FileReady", { name: videoFile.name })
                          : t("campaign.step4PickFile")}
                      </span>
                      <span className="shrink-0 rounded-md border-2 border-ink bg-cream px-2.5 py-1 font-display text-[0.7rem] font-bold uppercase tracking-wider">
                        {t("campaign.step4PickFile")}
                      </span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setVideoFile(f);
                          setError(null);
                        }}
                      />
                    </label>
                    <p className="text-xs text-ink-soft">{t("campaign.step4Hint")}</p>
                  </div>

                  {error && (
                    <p className="font-body text-sm text-error">{error}</p>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={submitting}
                      variant="magenta"
                      size="lg"
                    >
                      {uploadingStage === "uploading"
                        ? t("campaign.uploading")
                        : submitting
                          ? t("campaign.submitting")
                          : t("campaign.submitButton")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-magenta text-cream">
              <CardContent className="flex flex-col gap-3 py-8 text-center">
                <CardTitle className="text-2xl text-cream">
                  {t("campaign.doneTitle")}
                </CardTitle>
                <p className="text-sm text-cream/90">
                  {t("campaign.doneSubtitleLine1")}
                  <br />
                  {t("campaign.doneSubtitleLine2")}
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button
                    onClick={() => router.push("/app")}
                    variant="default"
                    size="lg"
                  >
                    {t("campaign.goHome")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
        </section>
      </div>
    </main>
  );
}

export default function CampaignDetailPage() {
  return (
    <AuthGuard>
      <CampaignDetail />
    </AuthGuard>
  );
}
