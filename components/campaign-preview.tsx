"use client";

import { Eye } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
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

export function CampaignPreview({ data }: { data: CampaignPreviewData }) {
  const { t } = useTranslation();
  const name = data.productName.trim() || t("brand.pvPlaceholderProduct");
  const short =
    data.shortDescription.trim() || t("brand.pvPlaceholderShort");
  const longDesc =
    data.longDescription.trim() || t("brand.pvPlaceholderLong");
  const script = data.scriptMarkdown.trim();
  const rules = data.instructionsMarkdown.trim();

  return (
    <div className="flex flex-col gap-6">
      {/* Catalog card preview */}
      <section>
        <PreviewLabel>{t("brand.pvCatalog")}</PreviewLabel>
        <p className="mt-1 text-xs text-ink-soft">
          {t("brand.pvCatalogHint")}
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
                    {t("brand.pvBudgetLeft", {
                      amount: formatUsd(data.totalBudgetUsd),
                    })}
                  </span>
                  <span className="text-ink-soft">
                    {t("brand.pvBudgetOf", {
                      amount: formatUsd(data.totalBudgetUsd),
                    })}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-cream">
                  <div className="h-full bg-lime" style={{ width: "0%" }} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-display font-bold">
                  {t("brand.pvRatePerView", {
                    rate: data.ratePerViewUsd.toFixed(2),
                  })}
                </span>
                <span className="text-ink-soft">·</span>
                <span className="text-ink-soft">
                  {t("brand.pvUpTo", {
                    amount: formatUsd(data.maxPayoutPerClipUsd, {
                      decimals: 0,
                    }),
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Detail page preview */}
      <section>
        <PreviewLabel>{t("brand.pvDetail")}</PreviewLabel>
        <p className="mt-1 text-xs text-ink-soft">
          {t("brand.pvDetailHint")}
        </p>
        <div className="mt-3 flex flex-col gap-4 rounded-card border-2 border-dashed border-ink/40 bg-cream/40 p-5">
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

          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-lime">
              <CardContent className="py-3">
                <p className="font-display text-2xl font-bold tracking-tight">
                  ${data.ratePerViewUsd.toFixed(2)}
                </p>
                <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                  {t("brand.pvPerView")}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-magenta text-cream">
              <CardContent className="py-3">
                <p className="font-display text-2xl font-bold tracking-tight">
                  {formatUsd(data.maxPayoutPerClipUsd, { decimals: 0 })}
                </p>
                <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider opacity-90">
                  {t("brand.pvMaxPerClip")}
                </p>
              </CardContent>
            </Card>
          </div>

          <Section heading={t("brand.pvAbout")}>
            <p className="font-body text-sm leading-relaxed">{longDesc}</p>
          </Section>

          <Section heading={t("brand.pvScript")}>
            {script ? (
              <RichText className="text-sm leading-relaxed">{script}</RichText>
            ) : (
              <p className="font-body text-sm italic text-ink-soft">
                {t("brand.pvScriptEmpty")}
              </p>
            )}
          </Section>

          <Section heading={t("brand.pvRules")}>
            {rules ? (
              <RichText className="text-sm leading-relaxed">{rules}</RichText>
            ) : (
              <p className="font-body text-sm italic text-ink-soft">
                {t("brand.pvRulesEmpty")}
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
