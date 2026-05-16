"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatUsd } from "@/lib/campaigns";
import type { PayoutHistoryRow } from "@/lib/actions/payouts";

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(
  s: PayoutHistoryRow["status"]
): "live" | "review" | "rejected" | "muted" {
  switch (s) {
    case "sent":
    case "confirmed":
      return "live";
    case "pending":
      return "review";
    case "failed":
      return "rejected";
    default:
      return "muted";
  }
}

export function PayoutHistoryDialog({
  trigger,
  load,
  showCreator = false,
  title,
  description,
}: {
  trigger: React.ReactNode;
  load: () => Promise<PayoutHistoryRow[]>;
  showCreator?: boolean;
  title?: string;
  description?: string;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<PayoutHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const resolvedTitle = title ?? t("payoutDialog.defaultTitle");
  const resolvedDescription = description ?? t("payoutDialog.defaultSubtitle");

  const handleOpenChange = async (open: boolean) => {
    if (open && rows === null && !loading) {
      setLoading(true);
      try {
        setRows(await load());
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-2xl !rounded-card !border-2 !border-ink !bg-cream !shadow-sticker-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold tracking-tight">
            {resolvedTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">
            {resolvedDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              {t("common.loading")}
            </p>
          ) : !rows || rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              {t("payoutDialog.noPayouts")}
            </p>
          ) : (
            <>
              {/* Desktop: dense table */}
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b-2 border-ink text-left">
                    <th className="px-3 py-2 font-display text-xs font-bold uppercase tracking-wider">
                      {t("payoutDialog.headerWhen")}
                    </th>
                    {showCreator && (
                      <th className="px-3 py-2 font-display text-xs font-bold uppercase tracking-wider">
                        {t("payoutDialog.headerCreator")}
                      </th>
                    )}
                    <th className="px-3 py-2 font-display text-xs font-bold uppercase tracking-wider">
                      {t("payoutDialog.headerCampaign")}
                    </th>
                    <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-wider">
                      {t("payoutDialog.headerAmount")}
                    </th>
                    <th className="px-3 py-2 font-display text-xs font-bold uppercase tracking-wider">
                      {t("payoutDialog.headerStatus")}
                    </th>
                    <th className="px-3 py-2 text-right font-display text-xs font-bold uppercase tracking-wider">
                      {t("payoutDialog.headerReceipt")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-ink/10 last:border-0"
                    >
                      <td className="px-3 py-2 text-xs text-ink-soft">
                        {shortTime(p.createdAt)}
                      </td>
                      {showCreator && (
                        <td className="px-3 py-2 text-xs">{p.creatorEmail}</td>
                      )}
                      <td className="px-3 py-2">
                        {p.campaignName}{" "}
                        <span className="text-ink-soft capitalize">
                          · {p.platform}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-display font-bold">
                        {formatUsd(p.amountUsd)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={statusVariant(p.status)}
                          className="px-2 py-0.5 text-[0.6rem]"
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.explorerUrl ? (
                          <a
                            href={p.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo hover:underline"
                          >
                            {t("common.view")}
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

              {/* Mobile: stacked cards */}
              <ul className="flex flex-col gap-2 md:hidden">
                {rows.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border-2 border-ink bg-cream p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-bold tracking-tight">
                          {p.campaignName}{" "}
                          <span className="font-body font-normal capitalize text-ink-soft">
                            · {p.platform}
                          </span>
                        </p>
                        {showCreator && p.creatorEmail && (
                          <p className="mt-0.5 truncate text-[0.7rem] text-ink-soft">
                            {p.creatorEmail}
                          </p>
                        )}
                        <p className="mt-0.5 text-[0.7rem] text-ink-soft">
                          {shortTime(p.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant={statusVariant(p.status)}
                        className="shrink-0 px-2 py-0.5 text-[0.6rem]"
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-display text-lg font-bold tracking-tight">
                        {formatUsd(p.amountUsd)}
                      </span>
                      {p.explorerUrl ? (
                        <a
                          href={p.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo hover:underline"
                        >
                          {t("common.view")}
                          <ArrowUpRight className="size-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-ink-soft">—</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
