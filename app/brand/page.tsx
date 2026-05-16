"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";
import Link from "next/link";
import { Coins, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { useTranslation } from "@/components/locale-provider";
import { FundCampaignDialog } from "@/components/fund-campaign-dialog";
import { ModeBar } from "@/components/mode-bar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  listMyBrandCampaigns,
  type BrandCampaign,
} from "@/lib/actions/campaigns";
import { getMyUser } from "@/lib/actions/users";
import { formatUsd } from "@/lib/campaigns";
import { useAccessToken } from "@/lib/hooks/use-access-token";

function statusVariant(
  s: BrandCampaign["status"]
): "live" | "muted" | "rejected" | "review" {
  switch (s) {
    case "active":
      return "live";
    case "paused":
      return "muted";
    case "ended":
      return "rejected";
    case "pending_funding":
      return "review";
  }
}

function BrandDashboard() {
  const { user, logout } = usePrivy();
  const { t } = useTranslation();
  const identityToken = useAccessToken();
  const email = user?.email?.address ?? "";

  const [campaigns, setCampaigns] = useState<BrandCampaign[] | null>(null);

  const refresh = useCallback(async () => {
    if (!identityToken) return;
    try {
      const list = await listMyBrandCampaigns(identityToken);
      setCampaigns(list);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      setCampaigns([]);
    }
  }, [identityToken]);

  // On first visit, this lazy-creates the user row with role='brand'.
  // For existing users it's a no-op (their existing role wins).
  useEffect(() => {
    if (!identityToken) return;
    getMyUser(identityToken, "brand").catch(() => {});
    refresh();
  }, [identityToken, refresh]);

  const statusLabel = (s: BrandCampaign["status"]): string => {
    switch (s) {
      case "active":
        return t("brand.statusActive");
      case "paused":
        return t("brand.statusPaused");
      case "ended":
        return t("brand.statusEnded");
      case "pending_funding":
        return t("brand.statusAwaitingFunding");
    }
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <header className="flex items-center justify-between gap-3">
          <ClippaLogo />
          <div className="flex items-center gap-4">
            <span className="hidden font-body text-xs text-ink-soft md:inline">
              {email}
            </span>
            <Button onClick={() => logout()} variant="ghost" size="sm">
              {t("common.signOut")}
            </Button>
          </div>
        </header>

        <ModeBar currentMode="brand" />

        <section className="mt-8 w-full">
          <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              {t("brand.dashTitle")}
            </h1>
            <p className="mt-1 font-body text-sm text-ink-soft">
              {t("brand.dashSubtitle")}
            </p>
          </div>
          <Link
            href="/brand/campaigns/new"
            className={buttonVariants({ variant: "default", size: "default" })}
          >
            <Plus className="size-4" />
            {t("brand.dashNewCampaign")}
          </Link>
        </motion.div>

        {campaigns === null ? (
          <LoadingState />
        ) : campaigns.length === 0 ? (
          <EmptyCampaignsCard />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {campaigns.map((c, i) => (
              <BrandCampaignCard
                key={c.slug}
                campaign={c}
                index={i}
                onChange={refresh}
                statusLabel={statusLabel}
              />
            ))}
          </div>
        )}
        </section>
      </div>
    </main>
  );
}

function LoadingState() {
  const { t } = useTranslation();
  return (
    <p className="mt-10 text-center font-display text-sm uppercase tracking-wider text-ink-soft">
      {t("common.loading")}
    </p>
  );
}

function EmptyCampaignsCard() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      className="mt-6"
    >
      <Card className="bg-peach">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-display text-lg font-bold tracking-tight">
            {t("brand.dashEmptyTitle")}
          </p>
          <p className="max-w-sm font-body text-sm text-ink-soft">
            {t("brand.dashEmptyBody")}
          </p>
          <Link
            href="/brand/campaigns/new"
            className={`${buttonVariants({ variant: "default", size: "default" })} mt-2`}
          >
            {t("brand.dashEmptyCta")}
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const CARD_COLORS = ["bg-cream", "bg-peach", "bg-lime"] as const;

function BrandCampaignCard({
  campaign,
  index,
  onChange,
  statusLabel,
}: {
  campaign: BrandCampaign;
  index: number;
  onChange: () => void | Promise<void>;
  statusLabel: (s: BrandCampaign["status"]) => string;
}) {
  const { t } = useTranslation();
  const bg = CARD_COLORS[index % CARD_COLORS.length];
  const { chain } = campaign;
  const isPending = campaign.status === "pending_funding";
  const balanceLow =
    chain.exists &&
    chain.totalFundedUsd > 0 &&
    (chain.balanceUsd < 10 ||
      chain.balanceUsd / chain.totalFundedUsd < 0.1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: index * 0.04 }}
    >
      <Card className={bg}>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate">{campaign.productName}</CardTitle>
              <p className="mt-1 font-mono text-[0.7rem] text-ink-soft">
                {campaign.slug}
              </p>
            </div>
            <Badge
              variant={statusVariant(campaign.status)}
              className="shrink-0 px-2 py-0.5 text-[0.6rem]"
            >
              {statusLabel(campaign.status)}
            </Badge>
          </div>

          {campaign.shortDescription && (
            <p className="line-clamp-2 font-body text-xs text-ink-soft">
              {campaign.shortDescription}
            </p>
          )}

          {isPending ? (
            <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-ink/30 bg-cream/50 p-4 text-center">
              <p className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                {t("brand.cardFundingIncomplete")}
              </p>
              <p className="text-[0.7rem] text-ink-soft">
                {t("brand.cardFundingIncompleteBody")}
              </p>
              <Link
                href={`/brand/campaigns/${campaign.id}/fund`}
                className={`${buttonVariants({ variant: "default", size: "sm" })} mt-1`}
              >
                {t("brand.cardResumeDeposit")}
              </Link>
            </div>
          ) : !chain.exists ? (
            <div className="rounded-md border-2 border-dashed border-ink/30 bg-cream/50 p-3 text-center">
              <p className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                {t("brand.cardNotFunded")}
              </p>
              <p className="mt-1 text-[0.7rem] text-ink-soft">
                {t("brand.cardNotFundedBody")}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                    {t("brand.cardBalanceLeft")}
                  </p>
                  <p
                    className={`mt-0.5 font-display text-2xl font-bold tracking-tight ${
                      balanceLow ? "text-error" : ""
                    }`}
                  >
                    {formatUsd(chain.balanceUsd)}
                  </p>
                  {balanceLow && (
                    <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-error">
                      {t("brand.cardRunningLow")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                    {t("brand.cardPaidToCreators")}
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-bold tracking-tight">
                    {formatUsd(chain.totalPaidOutUsd)}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-ink-soft">
                    {t("brand.cardOfFunded", {
                      amount: formatUsd(chain.totalFundedUsd),
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t-2 border-ink/10 pt-2 text-center text-[0.7rem] text-ink-soft">
                <div>
                  <p className="font-mono font-bold text-ink">
                    {campaign.totalClipsCount.toLocaleString()}
                  </p>
                  <p>
                    {campaign.totalClipsCount === 1
                      ? t("brand.cardClip")
                      : t("brand.cardClips")}
                  </p>
                </div>
                <div>
                  <p className="font-mono font-bold text-ink">
                    {campaign.liveClipsCount.toLocaleString()}
                  </p>
                  <p>{t("brand.cardLive")}</p>
                </div>
                <div>
                  <p className="font-mono font-bold text-ink">
                    {campaign.totalViews.toLocaleString()}
                  </p>
                  <p>{t("brand.cardViews")}</p>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[0.7rem] text-ink-soft">
            <span>
              {t("brand.cardRate")}{" "}
              <span className="font-mono font-bold text-ink">
                ${campaign.ratePerViewUsd.toFixed(4)}
              </span>{" "}
              {t("brand.cardPerView")}
            </span>
            <span>
              {t("brand.cardMax")}{" "}
              <span className="font-mono font-bold text-ink">
                {formatUsd(campaign.maxPayoutPerClipUsd)}
              </span>{" "}
              {t("brand.cardPerClip")}
            </span>
          </div>

          {chain.exists && !isPending && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink/10 pt-3">
              <Link
                href={`/brand/campaigns/${campaign.slug}/clips`}
                className="font-display text-[0.7rem] font-bold uppercase tracking-wider text-indigo hover:underline"
              >
                {t("brand.cardViewClips")}
              </Link>
              <FundCampaignDialog
                campaignId={campaign.id}
                campaignName={campaign.productName}
                currentBalanceUsd={chain.balanceUsd}
                onDone={onChange}
                trigger={
                  <Button variant="default" size="sm">
                    <Coins className="size-3.5" />
                    {t("brand.cardAddFunds")}
                  </Button>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function BrandPage() {
  return (
    <AuthGuard redirectTo="/brands">
      <BrandDashboard />
    </AuthGuard>
  );
}
