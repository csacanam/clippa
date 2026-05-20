"use client";

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

import { useTranslation } from "@/components/locale-provider";
import { Card, CardContent } from "@/components/ui/card";
import {
  getCampaignViewsTimeseries,
  type CampaignViewsPoint,
} from "@/lib/actions/campaigns";

/**
 * Campaign-level "views over time" chart for the campaign owner — the total
 * verified views across all the campaign's clips, day by day. Self-fetching
 * and non-critical: if it errors it just renders nothing.
 */
export function CampaignViewsChart({
  identityToken,
  slug,
}: {
  identityToken: string;
  slug: string;
}) {
  const { t, locale } = useTranslation();
  const [points, setPoints] = useState<CampaignViewsPoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!identityToken || !slug) return;
    getCampaignViewsTimeseries(identityToken, slug)
      .then(setPoints)
      .catch(() => setFailed(true));
  }, [identityToken, slug]);

  const data = useMemo(() => {
    return (points ?? []).map((p) => {
      const d = new Date(`${p.day}T00:00:00Z`);
      return {
        label: d.toLocaleDateString(locale === "es" ? "es" : "en", {
          month: "short",
          day: "numeric",
        }),
        views: p.views,
      };
    });
  }, [points, locale]);

  // Non-critical: hide entirely on error or while there's nothing to show.
  if (failed) return null;
  if (points === null) return null;
  if (data.length === 0) return null;

  return (
    <Card className="mt-6 bg-cream">
      <CardContent>
        <p className="font-display text-sm font-bold uppercase tracking-wider">
          {t("brand.viewsChartTitle")}
        </p>
        <p className="mt-0.5 font-body text-xs text-ink-soft">
          {t("brand.viewsChartSubtitle")}
        </p>
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="campaignViewsGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#C7FF3A" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#C7FF3A" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="#0A0A0A"
                strokeOpacity={0.1}
              />
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
                formatter={(v) => [
                  Number(v).toLocaleString(),
                  t("brand.viewsChartLabel"),
                ]}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#0A0A0A"
                strokeWidth={2}
                fill="url(#campaignViewsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
