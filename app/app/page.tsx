"use client";

import { usePrivy } from "@privy-io/react-auth";

import { useAccessToken } from "@/lib/hooks/use-access-token";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { CampaignCard } from "@/components/campaign-card";
import { ClippaLogo } from "@/components/clippa-logo";
import { MyClipCard } from "@/components/my-clip-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { isAdmin } from "@/lib/admin";
import { listActiveCampaigns } from "@/lib/actions/campaigns";
import { listMyClips, getOperatorStats } from "@/lib/actions/clips";
import { getMyOnboarding } from "@/lib/actions/onboarding";
import { formatUsd, type Campaign } from "@/lib/campaigns";
import { type Clip } from "@/lib/clips";

function truncateAddress(address: string | undefined) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function AppHome() {
  const router = useRouter();
  const { user, logout } = usePrivy();
  const identityToken = useAccessToken();
  const [checking, setChecking] = useState(true);
  const [clips, setClips] = useState<Clip[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const email = user?.email?.address;
  const wallet = useMemo(() => {
    return user?.wallet?.address ?? user?.linkedAccounts?.find((a) => a.type === "wallet")?.address;
  }, [user]);
  const showAdminBanner = isAdmin(email);

  const reloadClips = useCallback(async () => {
    if (!identityToken) return;
    const [myClips, opStats] = await Promise.all([
      listMyClips(identityToken),
      showAdminBanner
        ? getOperatorStats(identityToken).catch(() => ({ pendingCount: 0 }))
        : Promise.resolve({ pendingCount: 0 }),
    ]);
    setClips(myClips);
    setPendingCount(opStats.pendingCount);
  }, [identityToken, showAdminBanner]);

  // Onboarding gate + initial load
  useEffect(() => {
    if (!identityToken) return;
    let cancelled = false;
    (async () => {
      try {
        const [onboarding, activeCampaigns] = await Promise.all([
          getMyOnboarding(identityToken),
          listActiveCampaigns(),
        ]);
        if (cancelled) return;
        if (!onboarding) {
          router.replace("/onboarding");
          return;
        }
        setCampaigns(activeCampaigns);
        await reloadClips();
        setChecking(false);
      } catch (err) {
        console.error("Failed to load app:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identityToken, reloadClips, router]);

  const totalEarnings = useMemo(
    () => clips.reduce((sum, c) => sum + c.earningsUsd, 0),
    [clips]
  );

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="font-display text-sm uppercase tracking-wider text-ink-soft">
          Loading...
        </div>
      </div>
    );
  }

  const displayName = email?.split("@")[0] ?? "creator";

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <header className="flex items-center justify-between">
        <ClippaLogo />
        <div className="flex items-center gap-4">
          {isAdmin(email) && (
            <Link href="/admin">
              <Badge variant="indigo" className="px-2.5 py-1 text-[0.7rem]">
                Admin
              </Badge>
            </Link>
          )}
          <span className="hidden font-body text-xs text-ink-soft md:inline">
            {email}
          </span>
          <Button onClick={() => logout()} variant="ghost" size="sm">
            Sign out
          </Button>
        </div>
      </header>

      <section className="mx-auto mt-12 w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Hi, {displayName}.
          </h1>
          <p className="mt-1 font-body text-sm text-ink-soft md:text-base">
            Pick a campaign below and start earning.
          </p>
        </motion.div>

        {showAdminBanner && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.03 }}
            className="mt-6"
          >
            <Link
              href="/admin"
              className="block transition-transform hover:-translate-y-[2px] active:translate-y-0"
            >
              <div className="flex items-center justify-between gap-3 rounded-card border-2 border-ink bg-indigo p-5 text-cream shadow-sticker">
                <div>
                  <p className="font-display text-xs font-bold uppercase tracking-wider opacity-90">
                    Admin
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-tight md:text-xl">
                    {pendingCount > 0
                      ? `${pendingCount} clip${pendingCount === 1 ? "" : "s"} waiting to be reviewed`
                      : "Nothing pending. All caught up."}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border-2 border-cream/30 bg-cream/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider">
                  {pendingCount > 0 ? "Review now →" : "Open admin →"}
                </span>
              </div>
            </Link>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="mt-6"
        >
          <Card className="bg-lime">
            <CardContent className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-wider">
                  Your balance
                </p>
                <p className="mt-1 font-display text-5xl font-bold tracking-tight md:text-6xl">
                  {formatUsd(totalEarnings)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="font-display uppercase tracking-wider">
                  Get paid at:
                </span>
                <span className="font-mono">{truncateAddress(wallet)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {clips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
            className="mt-10"
          >
            <h2 className="font-display text-xl font-bold tracking-tight">
              Your clips
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {clips.map((clip) => (
                <MyClipCard
                  key={clip.id}
                  clip={clip}
                  onRemoved={reloadClips}
                />
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="mt-10"
        >
          <h2 className="font-display text-xl font-bold tracking-tight">
            Earn money
          </h2>

          {campaigns.length === 0 ? (
            <Card className="mt-4 bg-peach">
              <CardContent className="flex flex-col gap-2 py-8 text-center">
                <CardTitle>No campaigns yet.</CardTitle>
                <p className="text-sm text-ink-soft">
                  New ones drop here. Check back soon.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {campaigns.map((c) => (
                <CampaignCard key={c.slug} campaign={c} />
              ))}
            </div>
          )}
        </motion.div>
      </section>
    </main>
  );
}

export default function AppPage() {
  return (
    <AuthGuard>
      <AppHome />
    </AuthGuard>
  );
}
