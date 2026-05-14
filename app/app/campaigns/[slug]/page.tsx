"use client";

import { Check, ChevronLeft, Copy } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { RichText } from "@/components/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  findCampaignBySlug,
  getCampaignStats,
  type CampaignStats,
} from "@/lib/actions/campaigns";
import { submitClip } from "@/lib/actions/clips";
import { getOrCreateTrackingCode } from "@/lib/actions/tracking-codes";
import {
  budgetPercentSpent,
  budgetRemaining,
  formatUsd,
  type Campaign,
  type Platform,
} from "@/lib/campaigns";
import { validatePostUrl } from "@/lib/clips";
import { useAccessToken } from "@/lib/hooks/use-access-token";

type FormState =
  | { stage: "form" }
  | { stage: "submitted" };

function CampaignDetail() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const identityToken = useAccessToken();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [postUrl, setPostUrl] = useState("");
  const [trackingCode, setTrackingCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState<FormState>({ stage: "form" });
  const [copied, setCopied] = useState(false);

  // Load campaign from DB.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await findCampaignBySlug(slug);
        if (cancelled) return;
        if (!c) {
          notFound();
          return;
        }
        setCampaign(c);
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
  }, [slug]);

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
          Loading...
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

  const remaining = budgetRemaining(campaign);
  const percentSpent = budgetPercentSpent(campaign);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!platform) {
      setError("Pick a platform first.");
      return;
    }
    const v = validatePostUrl(platform, postUrl);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (!trackingCode) {
      setError("Your code is still loading — try again in a sec.");
      return;
    }
    if (!identityToken) {
      setError("Auth not ready yet — try again in a sec.");
      return;
    }

    setSubmitting(true);

    // Pre-validate: post is reachable, video, caption contains the code.
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
        | { ok: true; warning?: string }
        | { ok: false; error: string };
      if (!data.ok) {
        setError(data.error);
        setSubmitting(false);
        return;
      }
    } catch {
      setError("Couldn't verify the post. Check your connection and try again.");
      setSubmitting(false);
      return;
    }

    const result = await submitClip(identityToken, {
      campaignSlug: campaign.slug,
      platform,
      postUrl: postUrl.trim(),
      trackingCode,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFormState({ stage: "submitted" });
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <header className="flex items-center justify-between">
        <ClippaLogo />
        <Link
          href="/app"
          className="flex items-center gap-1 font-body text-sm font-medium text-ink hover:underline"
        >
          <ChevronLeft className="size-4" />
          Back
        </Link>
      </header>

      <section className="mx-auto mt-8 w-full max-w-2xl">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex items-start justify-between gap-3"
        >
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              {campaign.productName}
            </h1>
            <p className="mt-1 font-body text-sm text-ink-soft md:text-base">
              {campaign.shortDescription}
            </p>
          </div>
          <div className="flex shrink-0 gap-1 pt-1">
            {campaign.platforms.map((p) => (
              <Badge key={p} variant="default" className="capitalize">
                {p}
              </Badge>
            ))}
          </div>
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
                What you earn
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {formatUsd(campaign.ratePerViewUsd, { decimals: 2 })}
                </span>
                <span className="font-body text-sm text-ink-soft">per view</span>
                <span className="mx-1 text-ink-soft">·</span>
                <span className="font-display text-lg font-bold">
                  {formatUsd(campaign.maxPayoutPerClipUsd, { decimals: 0 })}
                </span>
                <span className="font-body text-sm text-ink-soft">
                  max per clip
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
                Campaign budget
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold tracking-tight">
                  {formatUsd(remaining, { decimals: 0 })} left
                </span>
                <span className="font-body text-sm text-ink-soft">
                  of {formatUsd(campaign.totalBudgetUsd, { decimals: 0 })} total
                </span>
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
                        ? `${stats.paidCreatorsCount} creator${stats.paidCreatorsCount === 1 ? "" : "s"} earning`
                        : null,
                      stats.liveClipsCount > 0
                        ? `${stats.liveClipsCount} clip${stats.liveClipsCount === 1 ? "" : "s"} live`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Be the first to clip this."}
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
            About this campaign
          </h2>
          <p className="mt-2 font-body text-sm md:text-base">
            {campaign.longDescription}
          </p>
        </motion.div>

        {/* Script */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
          className="mt-10"
        >
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">
            Suggested script
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
            Rules
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
            How Clippa works
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5 font-body text-sm md:text-base">
            <li>· Make it feel like you, not an ad.</li>
            <li>· Hook in the first 2 seconds.</li>
            <li>· Drop your unique code in the caption — that&apos;s how we know the post is yours.</li>
            <li>· We track views every hour. Your balance updates on its own.</li>
          </ul>
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
                <CardTitle className="text-xl">Submit your clip</CardTitle>
                <p className="mt-1 text-sm text-ink-soft">
                  Add the code to your caption, post on IG or TikTok, then drop the link here.
                </p>

                {/* Your code — prominent step 1 */}
                <div className="mt-6 rounded-card border-2 border-ink bg-lime p-5 shadow-sticker">
                  <p className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                    Step 1 — Your code
                  </p>
                  <p className="mt-1 text-xs text-ink/80">
                    Paste this somewhere in your caption so we know the post is yours.
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
                          <Check className="size-4" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" /> Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-2">
                    <label className="font-display text-sm font-bold uppercase tracking-wide">
                      Step 2 — Where did you post it?
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
                      Step 3 — Paste the link
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
                      {submitting ? "Verifying..." : "Submit clip →"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-magenta text-cream">
              <CardContent className="flex flex-col gap-3 py-8 text-center">
                <CardTitle className="text-2xl text-cream">
                  Got it.
                </CardTitle>
                <p className="text-sm text-cream/90">
                  Your clip is being reviewed.
                  <br />
                  We&apos;ll let you know as soon as it&apos;s live.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button
                    onClick={() => router.push("/app")}
                    variant="default"
                    size="lg"
                  >
                    Go home
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </section>
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
