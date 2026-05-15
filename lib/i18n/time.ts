/**
 * Localized "X ago" formatter. Hook-style so callers can just do:
 *   const timeAgo = useTimeAgo();
 *   timeAgo(clip.createdAt)
 */

"use client";

import { useTranslation } from "@/components/locale-provider";

export function useTimeAgo() {
  const { t } = useTranslation();
  return (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return t("common.timeSecondsAgo", { n: s });
    const m = Math.floor(s / 60);
    if (m < 60) return t("common.timeMinutesAgo", { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("common.timeHoursAgo", { n: h });
    const d = Math.floor(h / 24);
    return t("common.timeDaysAgo", { n: d });
  };
}
