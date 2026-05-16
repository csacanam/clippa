"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Check } from "lucide-react";
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
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [topClips, setTopClips] = useState<FeaturedClip[] | null>(null);

  // If user is already signed in and lands here, send them to /app.
  useEffect(() => {
    if (ready && authenticated) router.replace("/app");
  }, [ready, authenticated, router]);

  // Social-proof counts and top clips — non-critical, load in the background.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getPublicStats().catch(() => null),
      listFeaturedClips(8).catch(() => []),
    ]).then(([s, clips]) => {
      if (cancelled) return;
      if (s) setStats(s);
      setTopClips(clips ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
              className="mt-14 flex items-stretch gap-6 sm:gap-10"
            >
              <Stat
                value={stats.creatorsCount}
                label={t("landing.statsCreators")}
              />
              <div className="w-px bg-ink/15" />
              <Stat
                value={stats.clipsCount}
                label={t("landing.statsClipsPosted")}
              />
              <div className="w-px bg-ink/15" />
              <Stat
                value={stats.payoutsCount}
                label={t("landing.statsPaymentsSent")}
              />
            </motion.div>
          )}
        </div>
      </section>

      {/* Top clips — only render once we know there's at least one */}
      {topClips && topClips.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-6 pb-16 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              {t("landing.topClipsTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-md font-body text-sm text-ink-soft md:text-base">
              {t("landing.topClipsSubtitle")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="mt-8"
          >
            <TopClipsShowcase clips={topClips} />
          </motion.div>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-16 md:px-12">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center font-display text-3xl font-bold tracking-tight md:text-4xl"
        >
          {t("landing.howTitle")}
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <Step
            n={1}
            title={t("landing.howStep1Title")}
            body={t("landing.howStep1Body")}
          />
          <Step
            n={2}
            title={t("landing.howStep2Title")}
            body={t("landing.howStep2Body")}
          />
          <Step
            n={3}
            title={t("landing.howStep3Title")}
            body={t("landing.howStep3Body")}
          />
        </motion.div>
      </section>

      {/* Why join today */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-16 md:px-12">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center font-display text-3xl font-bold tracking-tight md:text-4xl"
        >
          {t("landing.whyTitle")}
        </motion.h2>
        <motion.ul
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mx-auto mt-8 flex max-w-md flex-col gap-3"
        >
          {[
            t("landing.why1"),
            t("landing.why2"),
            t("landing.why3"),
            t("landing.why4"),
          ].map((line, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-lime">
                <Check className="size-3.5" />
              </span>
              <span className="font-body text-base text-ink">{line}</span>
            </li>
          ))}
        </motion.ul>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-20 md:px-12">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center font-display text-3xl font-bold tracking-tight md:text-4xl"
        >
          {t("landing.faqTitle")}
        </motion.h2>
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

        {/* Repeat CTA after FAQ — visitors who read this far are warm */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="mt-10 flex justify-center"
        >
          <Button onClick={() => login()} disabled={!ready} size="xl">
            {t("landing.cta")}
          </Button>
        </motion.div>
      </section>

      {/* Footer hint */}
      <footer className="px-6 py-6 text-center text-xs text-ink-soft/70 md:px-12">
        {t("landing.footer")}
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-3xl font-bold tracking-tight md:text-4xl">
        {value.toLocaleString()}
      </span>
      <span className="mt-1 font-display text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <Card className="bg-cream">
      <CardContent className="flex flex-col gap-2 text-left">
        <div className="flex size-7 items-center justify-center rounded-full border-2 border-ink bg-lime font-display text-sm font-bold">
          {n}
        </div>
        <p className="font-display text-base font-bold tracking-tight">
          {title}
        </p>
        <p className="font-body text-sm text-ink-soft">{body}</p>
      </CardContent>
    </Card>
  );
}

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
