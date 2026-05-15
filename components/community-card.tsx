"use client";

import { Send } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { TELEGRAM_URL } from "@/lib/community";

/**
 * Telegram community invite. Shown on the creator home so support and
 * announcements live in one obvious place. Sticker-card style to match
 * the rest of the UI.
 */
export function CommunityCard() {
  const { t } = useTranslation();
  return (
    <Card className="bg-magenta text-cream">
      <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-cream/40 bg-cream/15">
            <Send className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg text-cream md:text-xl">
              {t("community.title")}
            </CardTitle>
            <p className="mt-1 text-xs text-cream/85 md:text-sm">
              {t("community.subtitle")}
            </p>
          </div>
        </div>
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <Button variant="default" size="default">
            {t("community.cta")}
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

/**
 * Compact one-line variant — for places where the full card would be too
 * loud (campaign / clip detail).
 */
export function CommunityHint() {
  const { t } = useTranslation();
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-ink-soft underline-offset-4 hover:text-ink hover:underline"
    >
      <Send className="size-3.5" />
      {t("community.inlineHint")}
    </a>
  );
}
