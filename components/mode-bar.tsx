"use client";

import { ArrowRight } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import { RoleSwitchLink } from "@/components/role-switch-link";
import { Badge } from "@/components/ui/badge";
import { type UserRole } from "@/lib/auth-server";

/**
 * Persistent context bar that shows the user's current dashboard mode
 * (creator vs brand) and surfaces the action to switch to the other one.
 * Sits below the page header so it's reachable on mobile, where the
 * header would otherwise truncate the switch link.
 */
export function ModeBar({ currentMode }: { currentMode: UserRole }) {
  const { t } = useTranslation();
  const otherMode: UserRole = currentMode === "brand" ? "creator" : "brand";
  const otherHref = otherMode === "brand" ? "/brand" : "/app";
  const switchLabel =
    otherMode === "brand" ? t("brand.brandMode") : t("brand.creatorMode");
  const currentLabel =
    currentMode === "brand" ? t("brand.badgeBrand") : t("brand.badgeCreator");

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-ink bg-cream px-3 py-2 shadow-sticker">
      <div className="flex items-center gap-2">
        <span className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
          {t("brand.modeLabel")}
        </span>
        <Badge variant="indigo" className="px-2 py-0.5 text-[0.65rem]">
          {currentLabel}
        </Badge>
      </div>
      <RoleSwitchLink
        targetRole={otherMode}
        targetHref={otherHref}
        label={
          <span className="inline-flex items-center gap-1">
            {switchLabel}
            <ArrowRight className="size-3" />
          </span>
        }
        className="inline-flex items-center font-display text-[0.7rem] font-bold uppercase tracking-wider text-indigo hover:underline disabled:opacity-50"
      />
    </div>
  );
}
