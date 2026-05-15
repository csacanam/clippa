"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ClippaLogo } from "@/components/clippa-logo";
import { LocaleToggle } from "@/components/locale-toggle";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { getPublicStats, type PublicStats } from "@/lib/actions/stats";

export default function LandingPage() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();
  const { t } = useTranslation();
  const [stats, setStats] = useState<PublicStats | null>(null);

  // If user is already signed in and lands here, send them to /app.
  useEffect(() => {
    if (ready && authenticated) router.replace("/app");
  }, [ready, authenticated, router]);

  // Social-proof counts — non-critical, load in the background.
  useEffect(() => {
    let cancelled = false;
    getPublicStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
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
      <section className="flex flex-1 items-center justify-center px-6 pb-20 md:px-12">
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
