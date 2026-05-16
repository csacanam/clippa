"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Camera, Check, Music2 } from "lucide-react";
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
import { TELEGRAM_URL } from "@/lib/community";
import {
  getPublicStats,
  listFeaturedClips,
  type FeaturedClip,
  type PublicStats,
} from "@/lib/actions/stats";

export default function BrandsLanding() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();
  const { t } = useTranslation();
  const [topClips, setTopClips] = useState<FeaturedClip[] | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);

  // Already signed in? Take them straight to the brand dashboard.
  useEffect(() => {
    if (ready && authenticated) router.replace("/brand");
  }, [ready, authenticated, router]);

  // Featured clips + public counters in the background.
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
            className="font-display text-5xl font-bold tracking-tighter md:text-6xl"
          >
            {t("brand.landingTitle")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="mt-6 max-w-md font-body text-base text-ink-soft md:text-lg"
          >
            {t("brand.landingSubtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            className="mt-10"
          >
            <Button onClick={() => login()} disabled={!ready} size="xl">
              {t("brand.landingCta")}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Marquee of real published clips — same source as creator landing.
       * For brands this reads as "look at the clips creators are already
       * making for campaigns like yours." */}
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
          {t("brand.landingHowTitle")}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          <DefineCard />
          <DepositCard />
          <DashboardCard />
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
            {t("brand.landingFaqTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md font-body text-sm text-ink-soft md:text-base">
            {t("brand.landingFaqSubtitle")}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-8 flex flex-col gap-3"
        >
          <Faq q={t("brand.landingFaqQ1")} a={t("brand.landingFaqA1")} />
          <Faq q={t("brand.landingFaqQ2")} a={t("brand.landingFaqA2")} />
          <Faq q={t("brand.landingFaqQ3")} a={t("brand.landingFaqA3")} />
          <Faq q={t("brand.landingFaqQ4")} a={t("brand.landingFaqA4")} />
          <Faq q={t("brand.landingFaqQ5")} a={t("brand.landingFaqA5")} />
          <Faq q={t("brand.landingFaqQ6")} a={t("brand.landingFaqA6")} />
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
              ? t("brand.landingFinalCtaTitleOne", { n: String(creatorsCount) })
              : t("brand.landingFinalCtaTitleMany", { n: String(creatorsCount) })
            : t("brand.landingFinalCtaTitleFallback")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-6 flex justify-center"
        >
          <Button onClick={() => login()} disabled={!ready} size="xl">
            {t("brand.landingFinalCtaButton")}
          </Button>
        </motion.div>
      </section>

      <footer className="flex flex-col items-center gap-2 border-t-2 border-ink/10 px-6 py-8 text-center text-xs text-ink-soft md:px-12">
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-display text-sm font-bold uppercase tracking-wider text-indigo underline-offset-4 hover:underline"
        >
          {t("brand.landingFooterCommunity")}
        </a>
        <Link
          href="/"
          className="font-body text-sm text-ink-soft underline-offset-4 hover:underline"
        >
          {t("brand.landingFooterCreators")}
        </Link>
        <p className="mt-1 text-ink-soft/70">{t("brand.landingFooter")}</p>
      </footer>
    </main>
  );
}

// ============================================================
// How-it-works visual cards (brand-specific mockups)
// ============================================================

/**
 * Card 1 — campaign-builder mockup, shows the brand the actual wizard
 * shape with a few key fields filled in.
 */
function DefineCard() {
  const { t } = useTranslation();
  return (
    <Card className="bg-peach">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex h-56 items-center justify-center rounded-md border-2 border-ink bg-cream p-4">
          <CampaignFormMockup />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex size-7 items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-sm font-bold">
            1
          </div>
          <p className="font-display text-lg font-bold tracking-tight">
            {t("brand.landingStep1Title")}
          </p>
          <p className="font-body text-sm text-ink">
            {t("brand.landingStep1Body")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignFormMockup() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
      className="w-full max-w-[220px] rounded-md border-2 border-ink bg-cream p-3 shadow-sticker"
    >
      <p className="font-display text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
        {t("brand.mockTitleCampaign")}
      </p>
      <div className="mt-2 flex flex-col gap-1.5 text-[0.7rem]">
        <FormRow label={t("brand.mockProduct")} value={t("brand.mockProductValue")} mono />
        <FormRow label={t("brand.mockRate")} value={t("brand.mockRateValue")} mono />
        <FormRow label={t("brand.mockCap")} value={t("brand.mockCapValue")} mono />
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t-2 border-ink/10 pt-2">
        <span className="font-display text-[0.55rem] font-bold uppercase tracking-wider text-ink-soft">
          {t("brand.mockPlatforms")}:
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-indigo px-1.5 py-0 text-[0.55rem] font-display font-bold uppercase tracking-wider text-cream">
          <Camera className="size-2.5" /> IG
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-indigo px-1.5 py-0 text-[0.55rem] font-display font-bold uppercase tracking-wider text-cream">
          <Music2 className="size-2.5" /> TT
        </span>
      </div>
    </motion.div>
  );
}

function FormRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={mono ? "font-mono font-bold" : "font-bold"}>{value}</span>
    </div>
  );
}

/**
 * Card 2 — deposit mockup, captures the "your money in escrow" idea.
 */
function DepositCard() {
  const { t } = useTranslation();
  return (
    <Card className="bg-lime">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex h-56 items-center justify-center rounded-md border-2 border-ink bg-cream p-6">
          <DepositMockup />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex size-7 items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-sm font-bold">
            2
          </div>
          <p className="font-display text-lg font-bold tracking-tight">
            {t("brand.landingStep2Title")}
          </p>
          <p className="font-body text-sm text-ink">
            {t("brand.landingStep2Body")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DepositMockup() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, rotate: -2 }}
      whileInView={{ opacity: 1, y: 0, rotate: -2 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      className="w-full max-w-[200px] rounded-xl border-2 border-ink bg-cream p-4 shadow-sticker-lg"
    >
      <p className="font-display text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
        {t("brand.mockDeposit")}
      </p>
      <p className="mt-0.5 font-display text-3xl font-bold tracking-tight">
        $500
      </p>
      <div className="mt-3 flex flex-col gap-1 border-t-2 border-ink/10 pt-2 text-[0.65rem]">
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">{t("brand.mockEscrow")}</span>
          <span className="inline-flex size-3 items-center justify-center rounded-full border border-ink bg-lime">
            <Check className="size-2" strokeWidth={4} />
          </span>
        </div>
      </div>
      <p className="mt-2 text-[0.6rem] italic leading-snug text-ink-soft">
        {t("brand.mockYourMoney")}
      </p>
    </motion.div>
  );
}

/**
 * Card 3 — dashboard mockup showing live results.
 */
function DashboardCard() {
  const { t } = useTranslation();
  return (
    <Card className="bg-magenta text-cream">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex h-56 items-center justify-center rounded-md border-2 border-ink bg-ink p-4">
          <DashboardMockup />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex size-7 items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-sm font-bold text-ink">
            3
          </div>
          <p className="font-display text-lg font-bold tracking-tight">
            {t("brand.landingStep3Title")}
          </p>
          <p className="font-body text-sm text-cream/90">
            {t("brand.landingStep3Body")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardMockup() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
      className="w-full max-w-[220px] rounded-md border-2 border-ink bg-cream p-3 text-ink shadow-sticker"
    >
      <p className="font-display text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
        {t("brand.mockDashTitle")}
      </p>
      <p className="mt-0.5 font-display text-2xl font-bold tracking-tight">
        12,840
      </p>
      {/* Tiny sparkline-style ascending bars */}
      <div className="mt-2 flex h-6 items-end gap-0.5">
        {[3, 4, 3, 5, 6, 7, 8, 9, 10, 12, 11, 14, 15, 18].map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm bg-lime"
            style={{ height: `${h * 6}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t-2 border-ink/10 pt-2 text-[0.65rem]">
        <div>
          <p className="text-ink-soft">{t("brand.mockDashClips")}</p>
          <p className="font-mono font-bold">3</p>
        </div>
        <div>
          <p className="text-ink-soft">{t("brand.mockDashSpent")}</p>
          <p className="font-mono font-bold">$128</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// FAQ accordion (same pattern as creator landing)
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
