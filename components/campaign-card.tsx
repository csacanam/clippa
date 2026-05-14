"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  budgetPercentSpent,
  budgetRemaining,
  formatUsd,
  type Campaign,
} from "@/lib/campaigns";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const remaining = budgetRemaining(campaign);
  const percentSpent = budgetPercentSpent(campaign);

  return (
    <Link
      href={`/app/campaigns/${campaign.slug}`}
      className="block transition-transform hover:-translate-y-[2px] active:translate-y-0"
    >
      <Card className="bg-peach hover:shadow-sticker-lg">
        <CardContent className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl md:text-2xl">
                {campaign.productName}
              </CardTitle>
              <p className="mt-1 text-sm text-ink-soft">
                {campaign.shortDescription}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {campaign.platforms.map((p) => (
                <Badge key={p} variant="default" className="capitalize">
                  {p}
                </Badge>
              ))}
            </div>
          </div>

          {/* Budget bar */}
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-display font-bold uppercase tracking-wider">
                {formatUsd(remaining, { decimals: 0 })} budget left
              </span>
              <span className="text-ink-soft">
                of {formatUsd(campaign.totalBudgetUsd, { decimals: 0 })}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-cream">
              <div
                className="h-full bg-lime transition-all"
                style={{ width: `${percentSpent}%` }}
              />
            </div>
          </div>

          {/* Terms */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-display font-bold">
              {formatUsd(campaign.ratePerViewUsd, { decimals: 2 })} per view
            </span>
            <span className="text-ink-soft">·</span>
            <span className="text-ink-soft">
              up to {formatUsd(campaign.maxPayoutPerClipUsd, { decimals: 0 })}{" "}
              per clip
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
