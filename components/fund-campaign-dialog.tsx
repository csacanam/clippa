"use client";

import { useWallets } from "@privy-io/react-auth";
import { ArrowUpRight, Check, Coins } from "lucide-react";
import { useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  http,
  type Hex,
} from "viem";
import { celo } from "viem/chains";

import { notifyCampaignTopUp } from "@/lib/actions/campaigns";
import { ensureMyGasStipend } from "@/lib/actions/payouts";
import { useAccessToken } from "@/lib/hooks/use-access-token";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/campaigns";
import {
  CELO_USDT_ADDRESS,
  CLIPPA_CONTRACT_ADDRESS,
  celoExplorerTx,
  usdToBaseUnits,
  uuidToBytes32,
} from "@/lib/chain";

const FUND_ABI = [
  {
    type: "function",
    name: "fundCampaign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

type Stage =
  | { kind: "form" }
  | { kind: "approving" }
  | { kind: "funding" }
  | { kind: "done"; txHash: string }
  | { kind: "error"; message: string };

/**
 * Tops up an existing on-chain campaign with more USDT. The campaign must
 * already exist on-chain (status='active' in DB). For brands who want to
 * extend a running campaign without going through the wizard again.
 */
export function FundCampaignDialog({
  campaignId,
  campaignName,
  currentBalanceUsd,
  trigger,
  onDone,
}: {
  campaignId: string;
  campaignName: string;
  currentBalanceUsd: number;
  trigger: React.ReactNode;
  onDone?: () => void;
}) {
  const { wallets } = useWallets();
  const { t } = useTranslation();
  const identityToken = useAccessToken();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "form" });

  const reset = () => {
    setAmount("");
    setStage({ kind: "form" });
  };

  const numericAmount = parseFloat(amount);
  const amountValid = !isNaN(numericAmount) && numericAmount > 0;
  const canSubmit = amountValid && stage.kind === "form";

  const handleFund = async () => {
    if (!CLIPPA_CONTRACT_ADDRESS) {
      setStage({ kind: "error", message: t("brand.errContractNotConfigured") });
      return;
    }
    try {
      const wallet =
        wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      if (!wallet) throw new Error(t("brand.errNoWallet"));
      try {
        await wallet.switchChain(celo.id);
      } catch {
        /* already on celo */
      }

      const provider = await wallet.getEthereumProvider();
      const account = wallet.address as Hex;
      const walletClient = createWalletClient({
        account,
        chain: celo,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({ chain: celo, transport: http() });

      // Brand pays in USDT only — top up their CELO for gas if needed.
      // Best-effort: don't block on stipend errors (Privy may still have CELO).
      try {
        await ensureMyGasStipend(identityToken ?? "");
      } catch {
        /* ignore */
      }

      const fundUnits = usdToBaseUnits(numericAmount);
      const campaignIdBytes = uuidToBytes32(campaignId);

      // Approve only if existing allowance is short.
      const allowance = (await publicClient.readContract({
        address: CELO_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, CLIPPA_CONTRACT_ADDRESS],
      })) as bigint;
      if (allowance < fundUnits) {
        setStage({ kind: "approving" });
        const approveTx = await walletClient.writeContract({
          address: CELO_USDT_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [CLIPPA_CONTRACT_ADDRESS, fundUnits],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx as Hex });
      }

      setStage({ kind: "funding" });
      const fundTx = await walletClient.writeContract({
        address: CLIPPA_CONTRACT_ADDRESS,
        abi: FUND_ABI,
        functionName: "fundCampaign",
        args: [campaignIdBytes, fundUnits],
      });
      await publicClient.waitForTransactionReceipt({ hash: fundTx as Hex });

      setStage({ kind: "done", txHash: fundTx });
      // Best-effort admin ping — fire-and-forget, the server action runs to
      // completion regardless of whether we await it.
      void notifyCampaignTopUp(identityToken ?? "", campaignId, numericAmount);
      onDone?.();
    } catch (e) {
      const raw = (e as Error).message ?? "Something went wrong.";
      let message = raw.slice(0, 200);
      if (/rejected|denied/i.test(raw)) message = t("brand.errSigningCancelled");
      else if (/insufficient/i.test(raw))
        message = t("brand.errInsufficientFunds");
      setStage({ kind: "error", message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-md !rounded-card !border-2 !border-ink !bg-cream !shadow-sticker-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold tracking-tight">
            {t("brand.addFundsTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">
            {t("brand.addFundsSubtitle", { name: campaignName })}
          </DialogDescription>
        </DialogHeader>

        {stage.kind === "done" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border-2 border-ink bg-lime">
              <Check className="size-6" />
            </div>
            <p className="font-display text-lg font-bold">
              {t("brand.addFundsDoneTitle")}
            </p>
            <p className="text-sm text-ink-soft">
              {t("brand.addFundsDoneBody", {
                amount: formatUsd(numericAmount),
              })}
            </p>
            <a
              href={celoExplorerTx(stage.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo hover:underline"
            >
              {t("brand.addFundsDoneReceipt")}
              <ArrowUpRight className="size-3" />
            </a>
            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
              variant="default"
              size="default"
              className="mt-2"
            >
              {t("common.done")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border-2 border-ink bg-peach/60 p-3 text-xs text-ink">
              <p className="font-display font-bold uppercase tracking-wider">
                {t("brand.addFundsCurrent")}
              </p>
              <p className="mt-1 font-display text-2xl font-bold tracking-tight">
                {formatUsd(currentBalanceUsd)}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-display text-sm font-bold uppercase tracking-wide">
                {t("brand.addFundsLabel")}
              </label>
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min="1"
                placeholder="50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={stage.kind !== "form" && stage.kind !== "error"}
              />
              <p className="text-xs text-ink-soft">
                {t("brand.addFundsHint")}
              </p>
            </div>

            {stage.kind === "approving" && (
              <p className="text-sm text-ink-soft">
                {t("brand.addFundsApproving")}
              </p>
            )}
            {stage.kind === "funding" && (
              <p className="text-sm text-ink-soft">
                {t("brand.addFundsSending")}
              </p>
            )}
            {stage.kind === "error" && (
              <p className="text-sm text-error">{stage.message}</p>
            )}

            <Button
              onClick={handleFund}
              disabled={!canSubmit && stage.kind !== "error"}
              variant="default"
              size="lg"
            >
              <Coins
                className={`size-4 ${
                  stage.kind === "approving" || stage.kind === "funding"
                    ? "animate-pulse"
                    : ""
                }`}
              />
              {stage.kind === "approving"
                ? t("brand.addFundsBtnApproving")
                : stage.kind === "funding"
                  ? t("brand.addFundsBtnSending")
                  : amountValid
                    ? t("brand.addFundsBtnIdleFilled", {
                        amount: formatUsd(numericAmount),
                      })
                    : t("brand.addFundsBtnIdle")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
