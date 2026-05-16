"use client";

import { Eye } from "lucide-react";

import { RichText } from "@/components/rich-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { formatUsd, type Platform } from "@/lib/campaigns";

export type CampaignPreviewData = {
  productName: string;
  shortDescription: string;
  longDescription: string;
  scriptMarkdown: string;
  instructionsMarkdown: string;
  ratePerViewUsd: number;
  maxPayoutPerClipUsd: number;
  totalBudgetUsd: number;
  platforms: Platform[];
};

/**
 * Mirrors what creators see on the public catalog + campaign detail page —
 * but rendered from the brand's in-progress form data so they can preview
 * before paying to fund. Read-only, no on-chain calls. The visual fidelity
 * is intentionally close (same components, same copy patterns) but stripped
 * of the live-data bits (balance bar, clips count) that don't exist yet.
 */
export function CampaignPreview({ data }: { data: CampaignPreviewData }) {
  const name = data.productName.trim() || "Your product name";
  const short = data.shortDescription.trim() || "Your one-line catalog tagline.";
  const longDesc = data.longDescription.trim() || "Your longer description goes here.";
  const script = data.scriptMarkdown.trim();
  const rules = data.instructionsMarkdown.trim();

  return (
    <div className="flex flex-col gap-6">
      {/* Catalog card preview */}
      <section>
        <PreviewLabel>1. In the catalog</PreviewLabel>
        <p className="mt-1 text-xs text-ink-soft">
          What creators see when browsing campaigns.
        </p>
        <div className="mt-3">
          <Card className="bg-peach">
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl md:text-2xl">{name}</CardTitle>
                  <p className="mt-1 text-sm text-ink-soft">{short}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {data.platforms.length === 0 ? (
                    <Badge variant="muted" className="capitalize">—</Badge>
                  ) : (
                    data.platforms.map((p) => (
                      <Badge key={p} variant="default" className="capitalize">
                        {p}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-display font-bold uppercase tracking-wider">
                    {formatUsd(data.totalBudgetUsd)} left
                  </span>
                  <span className="text-ink-soft">
                    of {formatUsd(data.totalBudgetUsd)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-cream">
                  <div className="h-full bg-lime" style={{ width: "0%" }} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-display font-bold">
                  ${data.ratePerViewUsd.toFixed(2)} / view
                </span>
                <span className="text-ink-soft">·</span>
                <span className="text-ink-soft">
                  Up to {formatUsd(data.maxPayoutPerClipUsd, { decimals: 0 })} per clip
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Detail page preview */}
      <section>
        <PreviewLabel>2. On the campaign page</PreviewLabel>
        <p className="mt-1 text-xs text-ink-soft">
          What creators see after clicking your card.
        </p>
        <div className="mt-3 flex flex-col gap-4 rounded-card border-2 border-dashed border-ink/40 bg-cream/40 p-5">
          {/* Title */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                {name}
              </h2>
              <p className="mt-1 font-body text-sm text-ink-soft">{short}</p>
            </div>
            <div className="flex shrink-0 gap-1 pt-1">
              {data.platforms.length === 0 ? (
                <Badge variant="muted">—</Badge>
              ) : (
                data.platforms.map((p) => (
                  <Badge key={p} variant="default" className="capitalize">
                    {p}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* What you earn */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-lime">
              <CardContent className="py-3">
                <p className="font-display text-2xl font-bold tracking-tight">
                  ${data.ratePerViewUsd.toFixed(2)}
                </p>
                <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                  Per view
                </p>
              </CardContent>
            </Card>
            <Card className="bg-magenta text-cream">
              <CardContent className="py-3">
                <p className="font-display text-2xl font-bold tracking-tight">
                  {formatUsd(data.maxPayoutPerClipUsd, { decimals: 0 })}
                </p>
                <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider opacity-90">
                  Max per clip
                </p>
              </CardContent>
            </Card>
          </div>

          {/* About */}
          <Section heading="About">
            <p className="font-body text-sm leading-relaxed">{longDesc}</p>
          </Section>

          {/* Script */}
          <Section heading="Script">
            {script ? (
              <RichText className="text-sm leading-relaxed">{script}</RichText>
            ) : (
              <p className="font-body text-sm italic text-ink-soft">
                Your suggested video script will render here.
              </p>
            )}
          </Section>

          {/* Rules */}
          <Section heading="Rules">
            {rules ? (
              <RichText className="text-sm leading-relaxed">{rules}</RichText>
            ) : (
              <p className="font-body text-sm italic text-ink-soft">
                Your rules for clips will render here.
              </p>
            )}
          </Section>
        </div>
      </section>
    </div>
  );
}

function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-cream px-2.5 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-wider">
      <Eye className="size-3" />
      {children}
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink-soft">
        {heading}
      </h3>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
