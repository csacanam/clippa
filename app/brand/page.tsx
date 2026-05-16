"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyUser } from "@/lib/actions/users";
import { useAccessToken } from "@/lib/hooks/use-access-token";

function BrandDashboard() {
  const { user, logout } = usePrivy();
  const identityToken = useAccessToken();
  const email = user?.email?.address ?? "";

  // On first visit, this lazy-creates the user row with role='brand'.
  // For existing users, returns their row unchanged — role stays whatever
  // it already was.
  useEffect(() => {
    if (!identityToken) return;
    getMyUser(identityToken, "brand").catch(() => {});
  }, [identityToken]);

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClippaLogo />
          <Badge variant="indigo" className="px-2.5 py-1 text-[0.7rem]">
            Brand
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/app"
            className="hidden font-body text-sm font-medium text-ink-soft underline-offset-4 hover:underline sm:inline"
          >
            Creator mode →
          </Link>
          <span className="hidden font-body text-xs text-ink-soft md:inline">
            {email}
          </span>
          <Button onClick={() => logout()} variant="ghost" size="sm">
            Sign out
          </Button>
        </div>
      </header>

      <section className="mx-auto mt-12 w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Your campaigns
            </h1>
            <p className="mt-1 font-body text-sm text-ink-soft">
              Launch, fund, and track your creator campaigns.
            </p>
          </div>
          <Link
            href="/brand/campaigns/new"
            className={buttonVariants({ variant: "default", size: "default" })}
          >
            <Plus className="size-4" />
            New campaign
          </Link>
        </motion.div>

        <EmptyCampaignsCard />
      </section>
    </main>
  );
}

function EmptyCampaignsCard() {
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
            No campaigns yet
          </p>
          <p className="max-w-sm font-body text-sm text-ink-soft">
            Launching takes about 2 minutes. Define your product, set a rate per
            view, fund the escrow, and creators take it from there.
          </p>
          <Link
            href="/brand/campaigns/new"
            className={`${buttonVariants({ variant: "default", size: "default" })} mt-2`}
          >
            Create your first campaign
          </Link>
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
