"use client";

import { usePrivy } from "@privy-io/react-auth";
import { ArrowUpRight, Check, Coins, RefreshCw, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminGuard } from "@/components/admin-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  approveClip,
  getOperatorStats,
  listAllClips,
  listPendingClips,
  refreshAllViews,
  rejectClip,
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

function AdminDashboard() {
  const { user, logout } = usePrivy();
  const identityToken = useAccessToken();
  const adminEmail = user?.email?.address ?? "";

  const [pending, setPending] = useState<Clip[]>([]);
  const [allClips, setAll] = useState<Clip[]>([]);
  const [payouts, setPayouts] = useState<PayoutHistoryRow[]>([]);
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!identityToken) return;
    try {
      const [p, a, s, py] = await Promise.all([
        listPendingClips(identityToken),
        listAllClips(identityToken),
        getOperatorStats(identityToken),
        listAllPayouts(identityToken),
      ]);
      setPending(p);
      setAll(a);
      setStats(s);
      setPayouts(py);
    } catch (err) {
      console.error("Failed to refresh:", err);
    }
  }, [identityToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshViews = async () => {
    if (!identityToken) return;
    setScraping(true);
    setScrapeMsg(null);
    try {
      const r = await refreshAllViews(identityToken);
      await refresh();
      if (r.updated === 0 && r.failed === 0) {
        setScrapeMsg("No live clips to sync.");
      } else if (r.failed === 0) {
        setScrapeMsg(`Updated ${r.updated} clip${r.updated === 1 ? "" : "s"}.`);
      } else {
        setScrapeMsg(
          `Updated ${r.updated}, ${r.failed} failed. ${r.firstError ?? ""}`
        );
      }
    } catch (err) {
      setScrapeMsg(`Failed: ${(err as Error).message}`);
    } finally {
      setScraping(false);
    }
  };

  const handleRunPayouts = async () => {
    if (!identityToken) return;
    setPaying(true);
    setPayMsg(null);
    try {
      const r = await runPayouts(identityToken);
      await refresh();
      const parts: string[] = [];
      if (r.paidCount > 0) {
        parts.push(
          `Paid ${r.paidCount} clip${r.paidCount === 1 ? "" : "s"} (${formatUsd(
            r.totalPaidUsd
          )})`
        );
      }
      if (r.failedCount > 0) {
        parts.push(`${r.failedCount} failed${r.firstError ? `: ${r.firstError}` : ""}`);
      }
      if (r.skippedForCap > 0) {
        parts.push(`${r.skippedForCap} skipped (daily cap)`);
      }
      setPayMsg(parts.length ? parts.join(" · ") : "Nothing to pay out.");
    } catch (err) {
      setPayMsg(`Failed: ${(err as Error).message}`);
    } finally {
      setPaying(false);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "all") return allClips;
    return allClips.filter((c) => c.status === filter);
  }, [allClips, filter]);

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
                  {stats ? formatUsd(stats.totalEarnedUsd) : "—"}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  earned from verified views
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

          {/* Run payouts */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleRunPayouts}
              disabled={paying || !identityToken}
              variant="default"
              size="default"
            >
              <Coins className={`size-4 ${paying ? "animate-pulse" : ""}`} />
              {paying ? "Paying out..." : "Run payouts"}
            </Button>
            {payMsg && (
              <p className="font-body text-xs text-ink-soft">{payMsg}</p>
            )}
          </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight">
              All clips
            </h2>
            <Button
              onClick={refreshViews}
              disabled={scraping || !identityToken}
              variant="indigo"
              size="default"
            >
              <RefreshCw className={`size-4 ${scraping ? "animate-spin" : ""}`} />
              {scraping ? "Syncing..." : "Sync now"}
            </Button>
          </div>

          {scrapeMsg && (
            <p className="mt-2 text-xs text-ink-soft">{scrapeMsg}</p>
          )}

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
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id} className="border-b border-ink/10 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {c.campaignName}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Payout history — inline, full width for trazabilidad */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
          className="mt-12 mb-16"
        >
          <h2 className="font-display text-xl font-bold tracking-tight">
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

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  );
}
