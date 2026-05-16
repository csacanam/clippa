"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { CampaignCard } from "@/components/campaign-card";
import { ClippaLogo } from "@/components/clippa-logo";
import { CommunityCard } from "@/components/community-card";
import { ModeBar } from "@/components/mode-bar";
import { LocaleToggle } from "@/components/locale-toggle";
import { useTranslation } from "@/components/locale-provider";
import { MyClipCard } from "@/components/my-clip-card";
import { PayoutHistoryDialog } from "@/components/payout-history-dialog";
import { WithdrawDialog } from "@/components/withdraw-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { isAdmin } from "@/lib/admin";
import { listActiveCampaigns } from "@/lib/actions/campaigns";
import { listMyClips, getOperatorStats } from "@/lib/actions/clips";
import { getMyOnboarding } from "@/lib/actions/onboarding";
import { getMyWalletBalance, listMyPayouts } from "@/lib/actions/payouts";
import { formatUsd, type Campaign } from "@/lib/campaigns";
import { type Clip } from "@/lib/clips";
import { useAccessToken } from "@/lib/hooks/use-access-token";

function AppHome() {
  const router = useRouter();
  const { user, logout } = usePrivy();
  const { t, locale } = useTranslation();
  const identityToken = useAccessToken();
  const [checking, setChecking] = useState(true);
  const [clips, setClips] = useState<Clip[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [balance, setBalance] = useState<number | null>(null);

  const email = user?.email?.address;
  const showAdminBanner = isAdmin(email);

  const reloadClips = useCallback(async () => {
    if (!identityToken) return;
    const [myClips, opStats, walletBalance] = await Promise.all([
      listMyClips(identityToken),
      showAdminBanner
        ? getOperatorStats(identityToken).catch(() => ({ pendingCount: 0 }))
        : Promise.resolve({ pendingCount: 0 }),
      getMyWalletBalance(identityToken).catch(() => null),
    ]);
    setClips(myClips);
    setPendingCount(opStats.pendingCount);
    setBalance(walletBalance);
  }, [identityToken, showAdminBanner]);

  // Onboarding gate + initial load
  useEffect(() => {
    if (!identityToken) return;
    let cancelled = false;
    (async () => {
      try {
        const [onboarding, activeCampaigns] = await Promise.all([
          getMyOnboarding(identityToken),
          listActiveCampaigns(locale),
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
  }, [identityToken, reloadClips, router, locale]);

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="font-display text-sm uppercase tracking-wider text-ink-soft">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  const displayName = email?.split("@")[0] ?? "creator";

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between gap-3">
          <ClippaLogo />
          <div className="flex items-center gap-4">
            {isAdmin(email) && (
              <Link href="/admin">
                <Badge variant="indigo" className="px-2.5 py-1 text-[0.7rem]">
                  {t("home.adminLabel")}
                </Badge>
              </Link>
            )}
            <LocaleToggle />
            <span className="hidden font-body text-xs text-ink-soft md:inline">
              {email}
            </span>
            <Button onClick={() => logout()} variant="ghost" size="sm">
              {t("common.signOut")}
            </Button>
          </div>
        </header>

        <ModeBar currentMode="creator" />

        <section className="mt-8 w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {t("home.greeting", { name: displayName })}
          </h1>
          <p className="mt-1 font-body text-sm text-ink-soft md:text-base">
            {t("home.subtitle")}
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
                    {t("home.adminLabel")}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-tight md:text-xl">
                    {pendingCount === 0
                      ? t("home.adminAllCaught")
                      : pendingCount === 1
                        ? t("home.adminPendingOne", { n: pendingCount })
                        : t("home.adminPendingMany", { n: pendingCount })}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border-2 border-cream/30 bg-cream/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider">
                  {pendingCount > 0
                    ? t("home.adminReviewNow")
                    : t("home.adminOpenAdmin")}
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
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-wider">
                  {t("home.balanceLabel")}
                </p>
                <p className="mt-1 font-display text-5xl font-bold tracking-tight md:text-6xl">
                  {balance === null ? "—" : formatUsd(balance)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <PayoutHistoryDialog
                  load={() => listMyPayouts(identityToken!)}
                  title={t("payoutDialog.myPayoutsTitle")}
                  description={t("payoutDialog.myPayoutsSubtitle")}
                  trigger={
                    <button className="font-display text-xs font-bold uppercase tracking-wider underline-offset-4 hover:underline">
                      {t("home.history")}
                    </button>
                  }
                />
                <WithdrawDialog
                  balance={balance ?? 0}
                  onDone={reloadClips}
                  trigger={
                    <Button variant="outline" size="default">
                      {t("home.withdraw")}
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.07 }}
          className="mt-4"
        >
          <CommunityCard />
        </motion.div>

        {clips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
            className="mt-10"
          >
            <h2 className="font-display text-xl font-bold tracking-tight">
              {t("home.yourClips")}
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
            {t("home.liveCampaigns")}
          </h2>

          {campaigns.length === 0 ? (
            <Card className="mt-4 bg-peach">
              <CardContent className="flex flex-col gap-2 py-8 text-center">
                <CardTitle>{t("home.noCampaignsTitle")}</CardTitle>
                <p className="text-sm text-ink-soft">
                  {t("home.noCampaignsSubtitle")}
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
      </div>
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
