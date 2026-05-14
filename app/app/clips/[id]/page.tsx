"use client";

import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  findMyClip,
  listMyClipPayouts,
  listMyClipViewSnapshots,
  type Payout,
  type ViewSnapshot,
} from "@/lib/actions/clips";
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

function shortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(s: ClipStatus): {
  label: string;
  variant: "live" | "review" | "rejected" | "muted";
} {
  switch (s) {
    case "tracking":
      return { label: "Live", variant: "live" };
    case "pending":
      return { label: "Under review", variant: "review" };
    case "rejected":
      return { label: "Not approved", variant: "rejected" };
    case "paused":
      return { label: "Paused", variant: "muted" };
    case "maxed_out":
      return { label: "Max payout reached", variant: "muted" };
  }
}

function ClipDetail() {
  const { id } = useParams<{ id: string }>();
  const identityToken = useAccessToken();
  const [clip, setClip] = useState<Clip | null>(null);
  const [snapshots, setSnapshots] = useState<ViewSnapshot[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    if (!identityToken) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, s, p] = await Promise.all([
          findMyClip(identityToken, id),
          listMyClipViewSnapshots(identityToken, id),
          listMyClipPayouts(identityToken, id),
        ]);
        if (cancelled) return;
        if (!c) {
          setNotFoundFlag(true);
          return;
        }
        setClip(c);
        setSnapshots(s);
        setPayouts(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, identityToken]);

  if (notFoundFlag) notFound();

  if (loading || !clip) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="font-display text-sm uppercase tracking-wider text-ink-soft">
          Loading...
        </div>
      </div>
    );
  }

  const badge = statusBadge(clip.status);
  const pendingPayoutUsd = Math.max(0, clip.earningsUsd - clip.paidOutUsd);

  const chartData = useMemo(() => {
    if (snapshots.length === 0) {
      // Anchor with submission row so the chart isn't empty for pending clips.
      return [{ t: new Date(clip.createdAt).getTime(), label: shortTime(clip.createdAt), views: 0 }];
    }
    return snapshots.map((s) => ({
      t: new Date(s.scrapedAt).getTime(),
      label: shortTime(s.scrapedAt),
      views: s.views,
    }));
  }, [snapshots, clip.createdAt]);

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <header className="flex items-center justify-between">
        <ClippaLogo />
        <Link
          href="/app"
          className="flex items-center gap-1 font-body text-sm font-medium text-ink hover:underline"
        >
          <ChevronLeft className="size-4" />
          Back
        </Link>
      </header>

      <section className="mx-auto mt-8 w-full max-w-3xl">
        {/* Title + status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                {clip.campaignName}{" "}
                <span className="font-body font-medium text-ink-soft capitalize">
                  · {clip.platform}
                </span>
              </h1>
              <p className="mt-1 text-xs text-ink-soft">
                Submitted {timeAgo(clip.createdAt)}
              </p>
            </div>
            <Badge variant={badge.variant} className="shrink-0 px-2.5 py-0.5">
              {badge.label}
            </Badge>
          </div>

          <a
            href={clip.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-ink-soft hover:underline"
          >
            {clip.postUrl}
            <ArrowUpRight className="size-3.5" />
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          <StatCard
            label="Total views"
            value={clip.verifiedViews.toLocaleString()}
            color="lime"
          />
          <StatCard
            label="Earned"
            value={formatUsd(clip.earningsUsd)}
            color="peach"
          />
          <StatCard
            label="Paid"
            value={formatUsd(clip.paidOutUsd)}
            color="indigo"
          />
          <StatCard
            label="Coming next"
            value={formatUsd(pendingPayoutUsd)}
            color="magenta"
          />
        </motion.div>

        {/* Chart */}
        {clip.status === "tracking" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
            className="mt-10"
          >
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">
              Views over time
            </h2>
            <Card className="mt-3 bg-cream">
              <CardContent>
                {snapshots.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-soft">
                    No data yet. We track views every hour.
                  </p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C7FF3A" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="#C7FF3A" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke="#0A0A0A" strokeOpacity={0.1} />
                        <XAxis
                          dataKey="label"
                          stroke="#4D4D4D"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#4D4D4D"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          width={50}
                          tickFormatter={(v: number) =>
                            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#FFFCF5",
                            border: "2px solid #0A0A0A",
                            borderRadius: "12px",
                            boxShadow: "4px 4px 0 0 #0A0A0A",
                            fontFamily: "var(--font-body)",
                          }}
                          labelStyle={{ fontWeight: 700 }}
                          formatter={(v) => [Number(v).toLocaleString(), "Views"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="views"
                          stroke="#0A0A0A"
                          strokeWidth={2}
                          fill="url(#viewsGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Rejection reason */}
        {clip.status === "rejected" && clip.rejectionReason && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
            className="mt-10"
          >
            <Card className="bg-peach">
              <CardContent>
                <CardTitle>Why this wasn&apos;t approved</CardTitle>
                <p className="mt-2 text-sm">{clip.rejectionReason}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Payment history */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
          className="mt-10 mb-16"
        >
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">
            Payment history
          </h2>
          {payouts.length === 0 ? (
            <Card className="mt-3 bg-peach">
              <CardContent className="py-6 text-center text-sm text-ink-soft">
                No payments yet. They&apos;ll show up here as views come in.
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
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-bold uppercase tracking-wider">
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id} className="border-b border-ink/10 last:border-0">
                        <td className="px-4 py-3 text-xs text-ink-soft">
                          {shortTime(p.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {p.viewsPaid.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-display font-bold">
                          {formatUsd(p.amountUsd)}
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
                            <span className="text-xs text-ink-soft">{p.status}</span>
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

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "lime" | "peach" | "indigo" | "magenta";
}) {
  const bg = {
    lime: "bg-lime",
    peach: "bg-peach",
    indigo: "bg-indigo text-cream",
    magenta: "bg-magenta text-cream",
  }[color];
  return (
    <div className={`rounded-card border-2 border-ink ${bg} p-4 shadow-sticker-sm`}>
      <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-bold tracking-tight md:text-2xl">
        {value}
      </p>
    </div>
  );
}

export default function ClipDetailPage() {
  return (
    <AuthGuard>
      <ClipDetail />
    </AuthGuard>
  );
}
