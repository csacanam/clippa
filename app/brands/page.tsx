"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ClippaLogo } from "@/components/clippa-logo";
import { LocaleToggle } from "@/components/locale-toggle";
import { Button } from "@/components/ui/button";

export default function BrandsLanding() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();

  // Already signed in? Take them straight to the brand dashboard.
  // The dashboard handles first-time role assignment.
  useEffect(() => {
    if (ready && authenticated) router.replace("/brand");
  }, [ready, authenticated, router]);

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <ClippaLogo />
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="hidden font-body text-sm font-medium text-ink-soft underline-offset-4 hover:underline sm:inline"
          >
            For creators →
          </Link>
          <LocaleToggle />
          <button
            onClick={() => login()}
            disabled={!ready}
            className="font-body text-sm font-medium text-ink underline-offset-4 hover:underline disabled:opacity-50"
          >
            Sign in
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
            Pay per view.
            <br />
            Not per promise.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="mt-6 max-w-md font-body text-base text-ink-soft md:text-lg"
          >
            Fund a USDT escrow. Creators publish clips on Instagram and TikTok.
            You only pay when real views land. No agency, no upfront retainer.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            className="mt-10"
          >
            <Button onClick={() => login()} disabled={!ready} size="xl">
              Launch a campaign →
            </Button>
          </motion.div>

          {/* How it works — three steps */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
            className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3"
          >
            <Step
              n={1}
              title="Define your campaign"
              body="Product, rate per view, max payout per clip, and the rules creators must follow."
            />
            <Step
              n={2}
              title="Fund the escrow"
              body="USDT goes on-chain into your campaign's escrow. You control the budget."
            />
            <Step
              n={3}
              title="Pay on results"
              body="As creators publish and views land, payouts flow straight to their wallets."
            />
          </motion.div>
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-ink-soft/70 md:px-12">
        Trustless escrow on Celo. Audited contract. No middlemen.
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border-2 border-ink bg-cream p-4 shadow-sticker">
      <div className="flex size-7 items-center justify-center rounded-full border-2 border-ink bg-lime font-display text-sm font-bold">
        {n}
      </div>
      <p className="font-display text-base font-bold tracking-tight">{title}</p>
      <p className="font-body text-sm text-ink-soft">{body}</p>
    </div>
  );
}
