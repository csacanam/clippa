"use client";

import { useWallets } from "@privy-io/react-auth";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Card, CardContent } from "@/components/ui/card";
import { getMyWalletBalance } from "@/lib/actions/payouts";
import { formatUsd } from "@/lib/campaigns";

/**
 * Wallet panel for the brand dashboard — surfaces the embedded wallet's
 * address and USDT balance so the brand knows where to send funds. The
 * actual on-chain calls (approve / createCampaign / fundCampaign) use
 * Celo's CIP-64 fee abstraction, so USDT is the only token they ever
 * need; no CELO required for gas.
 */
export function BrandWalletCard({
  identityToken,
}: {
  identityToken: string | null;
}) {
  const { t } = useTranslation();
  const { wallets } = useWallets();
  const wallet =
    wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  const address = wallet?.address;

  const [balance, setBalance] = useState<number | null>(null);
  const [reloading, setReloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    if (!identityToken) return;
    setReloading(true);
    try {
      const b = await getMyWalletBalance(identityToken);
      setBalance(b);
    } catch {
      setBalance(null);
    } finally {
      setReloading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityToken]);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const short = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "—";

  return (
    <Card className="mt-6 bg-cream">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wider">
              {t("brand.walletTitle")}
            </p>
            <p className="mt-0.5 font-body text-xs text-ink-soft">
              {t("brand.walletSubtitle")}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
              {t("brand.walletBalanceLabel")}
            </p>
            <p className="font-display text-2xl font-bold tracking-tight">
              {balance === null ? "—" : formatUsd(balance, { decimals: 2 })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border-2 border-dashed border-ink/40 bg-cream/60 px-3 py-2">
          <code className="font-mono text-sm font-bold break-all" title={address}>
            {short}
          </code>
          <button
            type="button"
            onClick={copy}
            disabled={!address}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-cream px-2.5 py-1 font-display text-[0.7rem] font-bold uppercase tracking-wider shadow-sticker-sm transition-transform hover:-translate-y-[1px] hover:shadow-sticker disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="size-3.5" />
                {t("common.copied")}
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                {t("common.copy")}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={reloading || !identityToken}
            aria-label={t("brand.walletRefresh")}
            className="inline-flex items-center justify-center rounded-md border-2 border-ink bg-cream p-1.5 shadow-sticker-sm transition-transform hover:-translate-y-[1px] hover:shadow-sticker disabled:opacity-40"
          >
            <RefreshCw
              className={`size-3.5 ${reloading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <p className="font-body text-xs text-ink-soft">
          {t("brand.walletHint")}
        </p>
      </CardContent>
    </Card>
  );
}
