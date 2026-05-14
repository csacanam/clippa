"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ClippaLogo } from "@/components/clippa-logo";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();

  // If user is already signed in and lands here, send them to /app.
  useEffect(() => {
    if (ready && authenticated) router.replace("/app");
  }, [ready, authenticated, router]);

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <ClippaLogo />
        <button
          onClick={() => login()}
          disabled={!ready}
          className="font-body text-sm font-medium text-ink underline-offset-4 hover:underline disabled:opacity-50"
        >
          Sign in
        </button>
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
            Make clips.
            <br />
            Get paid.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="mt-6 max-w-md font-body text-base text-ink-soft md:text-lg"
          >
            Short videos for products on Instagram or TikTok. Drop the link.
            Earn for every view.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
            className="mt-10"
          >
            <Button onClick={() => login()} disabled={!ready} size="xl">
              Start earning →
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer hint */}
      <footer className="px-6 py-6 text-center text-xs text-ink-soft/70 md:px-12">
        Built for creators worldwide. Payments anywhere.
      </footer>
    </main>
  );
}
