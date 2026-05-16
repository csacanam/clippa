"use client";

import { usePrivy } from "@privy-io/react-auth";
import { ArrowUpRight, Check, Coins, RefreshCw, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminGuard } from "@/components/admin-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAdminCampaignBudgets,
  type AdminCampaignBudget,
} from "@/lib/actions/campaigns";
import {
  approveClip,
  getOperatorStats,
  listAllClips,
  listPendingClips,
  refreshAllViews,
  rejectClip,
  setClipFeaturedVideo,
  type OperatorStats,
} from "@/lib/actions/clips";
import {
  listAllPayouts,
  runPayouts,
  type PayoutHistoryRow,
} from "@/lib/actions/payouts";
import { formatUsd } from "@/lib/campaigns";
import { type Clip, type ClipStatus } from "@/lib/clips";
import { useAccessToken } from "@/lib/hooks/use-access-token";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function statusVariant(s: ClipStatus): "live" | "review" | "rejected" | "muted" {
  switch (s) {
    case "tracking":
      return "live";
    case "pending":
      return "review";
    case "rejected":
      return "rejected";
    default:
      return "muted";
  }
}

function statusLabel(s: ClipStatus): string {
  switch (s) {
    case "tracking":
      return "Live";
    case "pending":
      return "Under review";
    case "rejected":
      return "Not approved";
    case "paused":
      return "Paused";
    case "maxed_out":
      return "Max payout";
  }
}

type Filter = "all" | "pending" | "tracking" | "rejected";

function PendingClipCard({
  clip,
  identityToken,
  onChange,
}: {
  clip: Clip;
  identityToken: string;
  onChange: () => void | Promise<void>;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const handleApprove = async () => {
    setError(null);
    setWorking(true);
    const r = await approveClip(identityToken, clip.id);
    setWorking(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    await onChange();
  };

  const handleReject = async () => {
    setError(null);
    setWorking(true);
    const r = await rejectClip(identityToken, clip.id, reason);
    setWorking(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    await onChange();
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">
              {clip.campaignName}{" "}
              <span className="font-body font-medium text-ink-soft capitalize">
                · {clip.platform}
              </span>
            </CardTitle>
            <p className="mt-1 text-xs text-ink-soft">
              Submitted {timeAgo(clip.createdAt)}
            </p>
          </div>
          <a
            href={clip.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-ink bg-cream px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider hover:bg-peach"
          >
            View post
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>

        {clip.trackingCode && (
          <p className="text-xs">
            <span className="text-ink-soft">Code: </span>
            <span className="font-mono font-bold">{clip.trackingCode}</span>
          </p>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        {!rejectMode ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={handleApprove}
              disabled={working}
              variant="default"
              size="default"
            >
              <Check className="size-4" />
              Approve
            </Button>
            <Button
              onClick={() => setRejectMode(true)}
              disabled={working}
              variant="outline"
              size="default"
            >
              <X className="size-4" />
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-1">
            <Input
              placeholder="Reason (shown to the creator)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleReject}
                variant="destructive"
                size="default"
                disabled={!reason.trim() || working}
              >
                Confirm reject
              </Button>
              <Button
                onClick={() => {
                  setRejectMode(false);
                  setReason("");
                  setError(null);
                }}
                variant="ghost"
                size="default"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const BUDGET_CARD_COLORS = ["bg-peach", "bg-lime", "bg-cream"] as const;

function CampaignBudgetCard({
  budget,
  colorIndex,
  identityToken,
  onChange,
}: {
  budget: AdminCampaignBudget;
  colorIndex: number;
  identityToken: string;
  onChange: () => void | Promise<void>;
}) {
  const bg = BUDGET_CARD_COLORS[colorIndex % BUDGET_CARD_COLORS.length];
  const { chain, owedNowUsd } = budget;
  const shortfall = owedNowUsd - chain.balanceUsd;
  // Underfunded only matters when there's actually something to pay.
  const underfunded = owedNowUsd > 0 && shortfall > 0;
  const fullyFunded = owedNowUsd > 0 && shortfall <= 0;

  const [syncing, setSyncing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState<React.ReactNode | null>(null);

  const handleSync = async () => {
    if (!identityToken) return;
    setSyncing(true);
    setMsg(null);
    try {
      const r = await refreshAllViews(identityToken, {
        campaignSlug: budget.slug,
      });
      await onChange();
      if (r.updated === 0 && r.failed === 0) {
        setMsg("No live clips to sync.");
      } else if (r.failed === 0) {
        setMsg(`Synced ${r.updated} clip${r.updated === 1 ? "" : "s"}.`);
      } else {
        setMsg(
          `Synced ${r.updated}, ${r.failed} failed. ${r.firstError ?? ""}`
        );
      }
    } catch (err) {
      setMsg(`Failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePay = async () => {
    if (!identityToken) return;
    setPaying(true);
    setMsg(null);
    try {
      const r = await runPayouts(identityToken, {
        campaignSlug: budget.slug,
      });
      await onChange();
      const parts: React.ReactNode[] = [];
      if (r.paidCount === 1 && r.paidTxs[0]) {
        parts.push(
          <>
            Paid {formatUsd(r.totalPaidUsd)} ·{" "}
            <a
              href={r.paidTxs[0].explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-indigo hover:underline"
            >
              View tx
              <ArrowUpRight className="size-3" />
            </a>
          </>
        );
      } else if (r.paidCount > 1) {
        parts.push(
          <>
            Paid {r.paidCount} clips ({formatUsd(r.totalPaidUsd)}) ·{" "}
            <a
              href="#payout-history"
              className="text-indigo hover:underline"
            >
              View receipts ↓
            </a>
          </>
        );
      }
      if (r.failedCount > 0) {
        parts.push(
          `${r.failedCount} failed${r.firstError ? `: ${r.firstError}` : ""}`
        );
      }
      if (r.skippedForCap > 0) {
        parts.push(`${r.skippedForCap} skipped (daily cap)`);
      }
      if (parts.length === 0) {
        setMsg("Nothing to pay out.");
      } else {
        setMsg(
          <>
            {parts.map((p, i) => (
              <span key={i}>
                {i > 0 ? " · " : ""}
                {p}
              </span>
            ))}
          </>
        );
      }
    } catch (err) {
      setMsg(`Failed: ${(err as Error).message}`);
    } finally {
      setPaying(false);
    }
  };

  const busy = syncing || paying;
  const payDisabled =
    busy || owedNowUsd <= 0 || underfunded || !chain.exists || !identityToken;
  const payTitle = !chain.exists
    ? "Campaign not yet funded on-chain"
    : owedNowUsd <= 0
      ? "Nothing to pay out right now"
      : underfunded
        ? `Insufficient escrow balance (short ${formatUsd(shortfall)})`
        : undefined;

  return (
    <Card className={bg}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{budget.productName}</CardTitle>
            <p className="mt-1 font-mono text-[0.7rem] text-ink-soft">
              {budget.slug}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {budget.status === "paused" && (
              <Badge variant="muted" className="px-2 py-0.5 text-[0.6rem]">
                Paused
              </Badge>
            )}
            {!chain.exists ? (
              <Badge variant="muted" className="px-2 py-0.5 text-[0.6rem]">
                Not on-chain
              </Badge>
            ) : underfunded ? (
              <Badge
                variant="destructive"
                className="px-2 py-0.5 text-[0.6rem]"
              >
                Short {formatUsd(shortfall)}
              </Badge>
            ) : fullyFunded ? (
              <Badge variant="live" className="px-2 py-0.5 text-[0.6rem]">
                Funded
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
              Escrow balance
            </p>
            <p
              className={`mt-0.5 font-display text-2xl font-bold tracking-tight ${
                underfunded ? "text-error" : ""
              }`}
            >
              {formatUsd(chain.balanceUsd)}
            </p>
          </div>
          <div>
            <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
              Owed now
            </p>
            <p className="mt-0.5 font-display text-2xl font-bold tracking-tight">
              {formatUsd(owedNowUsd)}
            </p>
            <p className="mt-0.5 text-[0.65rem] text-ink-soft">
              {budget.liveClipsCount}{" "}
              {budget.liveClipsCount === 1 ? "live clip" : "live clips"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t-2 border-ink/10 pt-2 text-[0.7rem] text-ink-soft">
          <span>
            Funded total{" "}
            <span className="font-mono font-bold text-ink">
              {formatUsd(chain.totalFundedUsd)}
            </span>
          </span>
          <span>
            Paid out{" "}
            <span className="font-mono font-bold text-ink">
              {formatUsd(chain.totalPaidOutUsd)}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink/10 pt-3">
          <Button
            onClick={handleSync}
            disabled={busy || !identityToken}
            variant="indigo"
            size="sm"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          {paying ? (
            <Button disabled variant="default" size="sm">
              <Coins className="size-3.5 animate-pulse" />
              Paying...
            </Button>
          ) : owedNowUsd <= 0 && chain.exists ? (
            <Badge variant="live" className="px-2.5 py-1 text-[0.65rem]">
              <Check className="size-3.5" />
              All paid
            </Badge>
          ) : (
            <Button
              onClick={handlePay}
              disabled={payDisabled}
              variant="default"
              size="sm"
              title={payTitle}
            >
              <Coins className="size-3.5" />
              Run payouts
            </Button>
          )}
        </div>

        {msg && <p className="font-body text-xs text-ink-soft">{msg}</p>}
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const { user, logout } = usePrivy();
  const identityToken = useAccessToken();
  const adminEmail = user?.email?.address ?? "";

  const [pending, setPending] = useState<Clip[]>([]);
  const [allClips, setAll] = useState<Clip[]>([]);
  const [payouts, setPayouts] = useState<PayoutHistoryRow[]>([]);
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [budgets, setBudgets] = useState<AdminCampaignBudget[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    if (!identityToken) return;
    try {
      const [p, a, s, py, b] = await Promise.all([
        listPendingClips(identityToken),
        listAllClips(identityToken),
        getOperatorStats(identityToken),
        listAllPayouts(identityToken),
        getAdminCampaignBudgets(identityToken),
      ]);
      setPending(p);
      setAll(a);
      setStats(s);
      setPayouts(py);
      setBudgets(b);
    } catch (err) {
      console.error("Failed to refresh:", err);
    }
  }, [identityToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === "all") return allClips;
    return allClips.filter((c) => c.status === filter);
  }, [allClips, filter]);

  // Payouts aggregated per calendar day, oldest first — for the chart.
  const payoutsByDay = useMemo(() => {
    const map = new Map<
      string,
      { day: string; total: number; count: number; t: number }
    >();
    for (const p of payouts) {
      const d = new Date(p.createdAt);
      const startOfDay = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate()
      ).getTime();
      const key = String(startOfDay);
      const existing = map.get(key);
      if (existing) {
        existing.total += p.amountUsd;
        existing.count += 1;
      } else {
        map.set(key, {
          day: d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          total: p.amountUsd,
          count: 1,
          t: startOfDay,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [payouts]);

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClippaLogo />
          <Badge variant="indigo" className="px-2.5 py-1 text-[0.7rem]">
            Admin
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-body text-xs text-ink-soft md:inline">
            {adminEmail}
          </span>
          <Button onClick={() => logout()} variant="ghost" size="sm">
            Sign out
          </Button>
        </div>
      </header>

      <section className="mx-auto mt-8 w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card className="bg-indigo text-cream">
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-wider opacity-90">
                  Owed to creators
                </p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight">
                  {stats
                    ? formatUsd(
                        Math.max(
                          0,
                          stats.totalEarnedUsd - stats.totalPaidUsd
                        )
                      )
                    : "—"}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  still pending payout
                </p>
              </div>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-wider opacity-90">
                  Paid out
                </p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight">
                  {stats ? formatUsd(stats.totalPaidUsd) : "—"}
                </p>
                <p className="mt-1 text-xs opacity-80">USDT sent on Celo</p>
              </div>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-wider opacity-90">
                  Pending review
                </p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight">
                  {pending.length}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  {pending.length === 1 ? "clip" : "clips"} waiting
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Headline counts */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Card className="bg-lime">
              <CardContent className="py-4">
                <p className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {stats ? stats.creatorsCount : "—"}
                </p>
                <p className="mt-0.5 font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {stats?.creatorsCount === 1 ? "Creator" : "Creators"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-peach">
              <CardContent className="py-4">
                <p className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {stats ? stats.clipsCount : "—"}
                </p>
                <p className="mt-0.5 font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {stats?.clipsCount === 1 ? "Clip" : "Clips"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-cream">
              <CardContent className="py-4">
                <p className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                  {stats ? stats.payoutsCount : "—"}
                </p>
                <p className="mt-0.5 font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {stats?.payoutsCount === 1 ? "Payout" : "Payouts"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Per-campaign budgets — sync + payouts live inside each card. */}
          {budgets.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display text-xl font-bold tracking-tight">
                Campaign budgets
              </h2>
              <p className="mt-1 font-body text-xs text-ink-soft">
                On-chain escrow balance vs. what creators are owed right now.
                Sync and pay out per campaign.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {budgets.map((b, i) => (
                  <CampaignBudgetCard
                    key={b.slug}
                    budget={b}
                    colorIndex={i}
                    identityToken={identityToken ?? ""}
                    onChange={refresh}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="mt-10"
        >
          <h2 className="font-display text-xl font-bold tracking-tight">
            Review queue
          </h2>

          {pending.length === 0 ? (
            <Card className="mt-3 bg-peach">
              <CardContent className="py-6 text-center text-sm text-ink-soft">
                No clips waiting. You&apos;re all caught up.
              </CardContent>
            </Card>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {pending.map((c) => (
                <PendingClipCard
                  key={c.id}
                  clip={c}
                  identityToken={identityToken ?? ""}
                  onChange={refresh}
                />
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="mt-12 mb-16"
        >
          <h2 className="font-display text-xl font-bold tracking-tight">
            All clips
          </h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { v: "all", label: "All" },
                { v: "pending", label: "Under review" },
                { v: "tracking", label: "Live" },
                { v: "rejected", label: "Not approved" },
              ] as { v: Filter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setFilter(opt.v)}
                aria-pressed={filter === opt.v}
                className="cursor-pointer outline-none"
              >
                <Badge
                  variant={filter === opt.v ? "indigo" : "default"}
                  className="px-3 py-1 text-[0.7rem]"
                >
                  {opt.label}
                </Badge>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card className="mt-3 bg-peach">
              <CardContent className="py-6 text-center text-sm text-ink-soft">
                Nothing here.
              </CardContent>
            </Card>
          ) : (
            <Card className="mt-3 bg-cream">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-ink text-left">
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        Campaign
                      </th>
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        Creator
                      </th>
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        Platform
                      </th>
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Last sync
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Earned
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        When
                      </th>
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        Featured video
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id} className="border-b border-ink/10 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {c.campaignName}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-soft">
                          {c.creatorEmail ?? "—"}
                        </td>
                        <td className="px-4 py-3 capitalize text-ink-soft">
                          {c.platform}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(c.status)} className="px-2 py-0.5 text-[0.65rem]">
                            {statusLabel(c.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {c.verifiedViews.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-ink-soft">
                          {c.lastScrapedAt ? timeAgo(c.lastScrapedAt) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatUsd(c.earningsUsd, { decimals: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-ink-soft">
                          {timeAgo(c.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <FeaturedVideoCell
                            clipId={c.id}
                            initialUrl={c.featuredVideoUrl ?? ""}
                            identityToken={identityToken ?? ""}
                            onChange={refresh}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Payouts per day — bar chart */}
        {payoutsByDay.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.13 }}
            className="mt-12"
          >
            <h2 className="font-display text-xl font-bold tracking-tight">
              Payouts per day
            </h2>
            <p className="mt-1 font-body text-xs text-ink-soft">
              Total USDT paid to creators each day.
            </p>
            <Card className="mt-3 bg-cream">
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={payoutsByDay}
                      margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="2 4"
                        stroke="#0A0A0A"
                        strokeOpacity={0.1}
                      />
                      <XAxis
                        dataKey="day"
                        stroke="#4D4D4D"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#4D4D4D"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        width={50}
                        tickFormatter={(v: number) => `$${v}`}
                      />
                      <Tooltip
                        cursor={{ fill: "#0A0A0A", fillOpacity: 0.05 }}
                        contentStyle={{
                          background: "#FFFCF5",
                          border: "2px solid #0A0A0A",
                          borderRadius: "12px",
                          boxShadow: "4px 4px 0 0 #0A0A0A",
                          fontFamily: "var(--font-body)",
                        }}
                        labelStyle={{ fontWeight: 700 }}
                        formatter={(v, _n, item) => [
                          `${formatUsd(Number(v))} · ${
                            (item.payload as { count: number }).count
                          } payout${
                            (item.payload as { count: number }).count === 1
                              ? ""
                              : "s"
                          }`,
                          "Paid out",
                        ]}
                      />
                      <Bar
                        dataKey="total"
                        fill="#C7FF3A"
                        stroke="#0A0A0A"
                        strokeWidth={2}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Payout history — inline, full width for trazabilidad */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
          className="mt-12 mb-16"
        >
          <h2
            id="payout-history"
            className="scroll-mt-6 font-display text-xl font-bold tracking-tight"
          >
            Payout history
          </h2>
          <p className="mt-1 font-body text-xs text-ink-soft">
            Every payout across all creators, with on-chain receipts.
          </p>

          {payouts.length === 0 ? (
            <Card className="mt-3 bg-peach">
              <CardContent className="py-6 text-center text-sm text-ink-soft">
                No payouts yet.
              </CardContent>
            </Card>
          ) : (
            <Card className="mt-3 bg-cream">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-ink text-left">
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        When
                      </th>
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        Creator
                      </th>
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        Campaign
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Views paid
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-ink/10 last:border-0"
                      >
                        <td className="px-4 py-3 text-xs text-ink-soft">
                          {timeAgo(p.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-xs">{p.creatorEmail}</td>
                        <td className="px-4 py-3">
                          {p.campaignName}{" "}
                          <span className="capitalize text-ink-soft">
                            · {p.platform}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {p.viewsPaid.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-display font-bold">
                          {formatUsd(p.amountUsd)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              p.status === "sent" || p.status === "confirmed"
                                ? "live"
                                : p.status === "failed"
                                  ? "rejected"
                                  : "review"
                            }
                            className="px-2 py-0.5 text-[0.6rem]"
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.explorerUrl ? (
                            <a
                              href={p.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-indigo hover:underline"
                            >
                              View
                              <ArrowUpRight className="size-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-ink-soft">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </section>
    </main>
  );
}

function FeaturedVideoCell({
  clipId,
  initialUrl,
  identityToken,
  onChange,
}: {
  clipId: string;
  initialUrl: string;
  identityToken: string;
  onChange: () => void | Promise<void>;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const save = async (value: string) => {
    if (value === initialUrl) return;
    if (!identityToken) return;
    setStatus("saving");
    setError(null);
    const r = await setClipFeaturedVideo(
      identityToken,
      clipId,
      value || null
    );
    if (!r.ok) {
      setStatus("error");
      setError(r.error);
      return;
    }
    setStatus("saved");
    await onChange();
    setTimeout(() => setStatus("idle"), 1200);
  };

  return (
    <div className="flex min-w-[14rem] flex-col gap-1">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => save(url.trim())}
        placeholder="https://...mp4"
        className="h-8 text-xs"
        disabled={status === "saving"}
      />
      {status === "saving" && (
        <span className="text-[0.6rem] text-ink-soft">Saving…</span>
      )}
      {status === "saved" && (
        <span className="text-[0.6rem] text-success">Saved</span>
      )}
      {status === "error" && error && (
        <span className="text-[0.6rem] text-error">{error}</span>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  );
}
