"use client";

import { usePrivy } from "@privy-io/react-auth";
import { ArrowDownToLine, Camera, Check, Music2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ClippaLogo } from "@/components/clippa-logo";
import { LocaleToggle } from "@/components/locale-toggle";
import { useTranslation } from "@/components/locale-provider";
import { TopClipsShowcase } from "@/components/top-clips-showcase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getPublicStats,
  listFeaturedClips,
  type FeaturedClip,
  type PublicStats,
} from "@/lib/actions/stats";

export default function LandingPage() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();
  const { t } = useTranslation();
  const [topClips, setTopClips] = useState<FeaturedClip[] | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);

  // If user is already signed in and lands here, send them to /app.
  useEffect(() => {
    if (ready && authenticated) router.replace("/app");
  }, [ready, authenticated, router]);

  // Featured clips for the marquee + the public counters for the final
  // social-proof line. Both are non-critical — load in the background.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listFeaturedClips(8).catch(() => []),
      getPublicStats().catch(() => null),
    ]).then(([clips, s]) => {
      if (cancelled) return;
      setTopClips(clips ?? []);
      if (s) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const creatorsCount = stats?.creatorsCount ?? 0;

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <ClippaLogo />
        <div className="flex items-center gap-4">
          <Link
            href="/brands"
            className="hidden font-body text-sm font-medium text-ink-soft underline-offset-4 hover:underline sm:inline"
          >
            {t("landing.forBrands")}
          </Link>
          <LocaleToggle />
          <button
            onClick={() => login()}
            disabled={!ready}
            className="font-body text-sm font-medium text-ink underline-offset-4 hover:underline disabled:opacity-50"
          >
            {t("common.signIn")}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex items-center justify-center px-6 pb-16 pt-8 md:px-12 md:pt-12">
        <div className="flex w-full max-w-2xl flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="font-display text-6xl font-bold tracking-tighter md:text-7xl"
          >
            {t("landing.title1")}
            <br />
            {t("landing.title2")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="mt-6 max-w-md font-body text-base text-ink-soft md:text-lg"
          >
            {t("landing.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            className="mt-10"
          >
            <Button onClick={() => login()} disabled={!ready} size="xl">
              {t("landing.cta")}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Top clips — full-bleed marquee, only render once we have at least one. */}
      {topClips && topClips.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pb-16"
        >
          <TopClipsShowcase clips={topClips} />
        </motion.section>
      )}

      {/* How it works — three visual cards */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:px-12">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center font-display text-3xl font-bold tracking-tight md:text-5xl"
        >
          {t("landing.howTitle")}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          <RecreateCard clips={topClips ?? []} />
          <PostCard />
          <PaidCard />
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-20 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {t("landing.faqTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md font-body text-sm text-ink-soft md:text-base">
            {t("landing.faqSubtitle")}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-8 flex flex-col gap-3"
        >
          <Faq q={t("landing.faqQ1")} a={t("landing.faqA1")} />
          <Faq q={t("landing.faqQ2")} a={t("landing.faqA2")} />
          <Faq q={t("landing.faqQ3")} a={t("landing.faqA3")} />
          <Faq q={t("landing.faqQ4")} a={t("landing.faqA4")} />
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-20 text-center md:px-12">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="font-display text-2xl font-bold tracking-tight md:text-3xl"
        >
          {creatorsCount > 0
            ? creatorsCount === 1
              ? t("landing.finalCtaTitleOne", { n: String(creatorsCount) })
              : t("landing.finalCtaTitleMany", { n: String(creatorsCount) })
            : t("landing.finalCtaTitleFallback")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-6 flex justify-center"
        >
          <Button onClick={() => login()} disabled={!ready} size="xl">
            {t("landing.finalCtaButton")}
          </Button>
        </motion.div>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-ink-soft/70 md:px-12">
        {t("landing.footer")}
      </footer>
    </main>
  );
}

// ============================================================
// How-it-works visual cards
// ============================================================

/**
 * Card 1 — two columns of vertical-scrolling featured videos to show
 * "recreate a video" visually. Column A scrolls up, column B scrolls
 * down for contrast. Falls back to a small static label if we don't
 * have any featured videos yet so the card isn't empty.
 */
function RecreateCard({ clips }: { clips: FeaturedClip[] }) {
  const { t } = useTranslation();
  const half = Math.ceil(clips.length / 2);
  const colA = clips.slice(0, half);
  const colB = clips.slice(half).length > 0 ? clips.slice(half) : colA;

  return (
    <Card className="bg-lime overflow-hidden">
      <CardContent className="flex h-full flex-col gap-3 p-0">
        <div className="relative h-64 overflow-hidden border-b-2 border-ink bg-ink">
          {/* Vertical-gradient masks to fade videos at the edges */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-ink to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-ink to-transparent" />
          {clips.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-cream/70">
                Your clip here →
              </span>
            </div>
          ) : (
            <div className="grid h-full grid-cols-2 gap-2 p-2">
              <VideoColumn clips={colA} direction="up" />
              <VideoColumn clips={colB} direction="down" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
          <div className="flex size-7 items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-sm font-bold">
            1
          </div>
          <p className="font-display text-lg font-bold tracking-tight">
            {t("landing.howStep1Title")}
          </p>
          <p className="font-body text-sm text-ink">
            {t("landing.howStep1Body")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function VideoColumn({
  clips,
  direction,
}: {
  clips: FeaturedClip[];
  direction: "up" | "down";
}) {
  // Duplicate items so the loop is seamless: when first half scrolls off,
  // second half is exactly where it started.
  const doubled = [...clips, ...clips];
  const animClass =
    direction === "up" ? "animate-marquee-y-up" : "animate-marquee-y-down";
  return (
    <div className="relative overflow-hidden rounded-md">
      <div
        className={`flex flex-col gap-2 ${animClass}`}
        style={{ ["--marquee-duration" as string]: "18s" }}
      >
        {doubled.map((c, i) => (
          <div
            key={`${c.id}-${i}`}
            className="aspect-[9/16] w-full overflow-hidden rounded-md border-2 border-cream/20"
          >
            <video
              src={c.featuredVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Card 2 — Instagram + TikTok logos that scale + tilt on hover.
 */
function PostCard() {
  const { t } = useTranslation();
  return (
    <Card className="bg-peach overflow-hidden">
      <CardContent className="flex h-full flex-col gap-3 p-0">
        <div className="flex h-64 items-center justify-center gap-4 border-b-2 border-ink bg-cream p-6 sm:gap-6">
          <PlatformBadge icon={<Camera className="size-10" />} label="Instagram" />
          <PlatformBadge icon={<Music2 className="size-10" />} label="TikTok" />
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
          <div className="flex size-7 items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-sm font-bold">
            2
          </div>
          <p className="font-display text-lg font-bold tracking-tight">
            {t("landing.howStep2Title")}
          </p>
          <p className="font-body text-sm text-ink">
            {t("landing.howStep2Body")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="group flex flex-col items-center gap-2">
      <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-ink bg-cream shadow-sticker transition-all duration-200 group-hover:-translate-y-1 group-hover:rotate-[-4deg] group-hover:bg-lime group-hover:shadow-sticker-lg sm:size-20">
        {icon}
      </div>
      <span className="font-display text-[0.7rem] font-bold uppercase tracking-wider text-ink">
        {label}
      </span>
    </div>
  );
}

/**
 * Card 3 — fake wallet receipt to show "get paid". Static numbers, no
 * data fetching — illustrative of the payout UX.
 */
function PaidCard() {
  const { t } = useTranslation();
  return (
    <Card className="bg-magenta overflow-hidden text-cream">
      <CardContent className="flex h-full flex-col gap-3 p-0">
        <div className="flex h-64 items-center justify-center border-b-2 border-ink bg-ink p-6">
          <ReceiptMockup />
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
          <div className="flex size-7 items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-sm font-bold text-ink">
            3
          </div>
          <p className="font-display text-lg font-bold tracking-tight">
            {t("landing.howStep3Title")}
          </p>
          <p className="font-body text-sm text-cream/90">
            {t("landing.howStep3Body")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-[0.65rem] font-bold uppercase tracking-wider text-cream/80">
            <span className="inline-flex items-center gap-1">
              <Check className="size-3" /> {t("landing.receiptInstant")}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Check className="size-3" /> {t("landing.receiptNoFees")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptMockup() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ y: 12, opacity: 0, rotate: -2 }}
      whileInView={{ y: 0, opacity: 1, rotate: -2 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      className="w-full max-w-[200px] rounded-xl border-2 border-ink bg-cream p-4 text-ink shadow-sticker-lg"
    >
      <p className="font-display text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
        {t("landing.receiptBalance")}
      </p>
      <p className="mt-0.5 font-display text-3xl font-bold tracking-tight">
        $4,200
      </p>
      <div className="mt-3 flex flex-col gap-1 border-t-2 border-ink/10 pt-2 text-[0.7rem]">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-soft">{t("landing.receiptToday")}</span>
          <span className="font-mono font-bold">+$50</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-ink-soft">{t("landing.receiptWeek")}</span>
          <span className="font-mono font-bold">+$320</span>
        </div>
      </div>
      <div className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-ink bg-lime px-3 py-1.5 font-display text-[0.65rem] font-bold uppercase tracking-wider shadow-sticker-sm">
        <ArrowDownToLine className="size-3" />
        {t("landing.receiptCashOut")}
      </div>
    </motion.div>
  );
}

// ============================================================
// FAQ accordion
// ============================================================

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-card border-2 border-ink bg-cream px-4 py-3 shadow-sticker">
      <summary className="flex cursor-pointer items-center justify-between gap-3 font-display text-sm font-bold tracking-tight md:text-base">
        {q}
        <span className="inline-block transition-transform group-open:rotate-45 font-display text-lg leading-none text-ink-soft">
          +
        </span>
      </summary>
      <p className="mt-3 font-body text-sm leading-relaxed text-ink-soft">
        {a}
      </p>
    </details>
  );
}
