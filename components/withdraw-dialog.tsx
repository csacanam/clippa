"use client";

import { useWallets } from "@privy-io/react-auth";
import { ArrowUpRight, Check } from "lucide-react";
import { useState } from "react";
import {
  createWalletClient,
  custom,
  erc20Abi,
  isAddress,
  parseUnits,
  type Hex,
} from "viem";
import { celo } from "viem/chains";

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
import { CELO_USDT_ADDRESS, USDT_DECIMALS, celoExplorerTx } from "@/lib/chain";
import { formatUsd } from "@/lib/campaigns";

type Stage =
  | { kind: "form" }
  | { kind: "sending" }
  | { kind: "done"; txHash: string }
  | { kind: "error"; message: string };

export function WithdrawDialog({
  balance,
  trigger,
  onDone,
}: {
  balance: number;
  trigger: React.ReactNode;
  onDone?: () => void;
}) {
  const { wallets } = useWallets();
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "form" });

  const reset = () => {
    setDestination("");
    setAmount("");
    setStage({ kind: "form" });
  };

  const numericAmount = parseFloat(amount);
  const amountValid =
    !isNaN(numericAmount) && numericAmount > 0 && numericAmount <= balance;
  const addressValid = isAddress(destination.trim());
  const canSubmit = amountValid && addressValid && stage.kind === "form";

  const handleWithdraw = async () => {
    setStage({ kind: "sending" });
    try {
      // The creator's Privy embedded wallet signs — Clippa never touches it.
      const wallet =
        wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      if (!wallet) throw new Error("No wallet found on your account.");

      // Make sure the wallet is on Celo before signing.
      try {
        await wallet.switchChain(celo.id);
      } catch {
        // Some providers auto-switch or are already on Celo — ignore.
      }

      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: wallet.address as Hex,
        chain: celo,
        transport: custom(provider),
      });

      // Normal EIP-1559 transfer — gas is paid in native CELO. The creator's
      // wallet gets a small CELO stipend with each payout (Privy embedded
      // wallets can't pay gas in USDT), so this just works.
      const hash = await walletClient.writeContract({
        address: CELO_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [
          destination.trim() as Hex,
          parseUnits(amount, USDT_DECIMALS),
        ],
      });

      setStage({ kind: "done", txHash: hash });
      onDone?.();
    } catch (e) {
      const raw = (e as Error).message ?? "Something went wrong.";
      // Surface a friendlier message for the common cases.
      let message = raw.slice(0, 200);
      if (/insufficient/i.test(raw)) {
        message = "Not enough balance to cover this withdrawal.";
      } else if (/rejected|denied/i.test(raw)) {
        message = "You cancelled the transfer.";
      }
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
            Withdraw your money
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">
            Send your balance to your own account.
          </DialogDescription>
        </DialogHeader>

        {stage.kind === "done" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border-2 border-ink bg-lime">
              <Check className="size-6" />
            </div>
            <p className="font-display text-lg font-bold">On its way.</p>
            <p className="text-sm text-ink-soft">
              {formatUsd(numericAmount)} sent. It usually arrives in a few
              seconds.
            </p>
            <a
              href={celoExplorerTx(stage.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo hover:underline"
            >
              View receipt
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
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Plain-language instructions — step by step */}
            <div className="rounded-md border-2 border-ink bg-peach/60 p-3 text-xs text-ink">
              <p className="font-display font-bold uppercase tracking-wider">
                Where do I send it?
              </p>
              <ol className="mt-2 flex flex-col gap-1.5 leading-relaxed">
                <li>1. Open your exchange (Binance, Coinbase, etc.).</li>
                <li>
                  2. Go to <strong>Deposit</strong> and choose{" "}
                  <strong>USDT</strong>.
                </li>
                <li>
                  3. Pick the <strong>Celo</strong> network.
                </li>
                <li>4. Copy the address it gives you and paste it below.</li>
              </ol>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <label className="font-display text-sm font-bold uppercase tracking-wide">
                Amount
              </label>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16"
                />
                <button
                  type="button"
                  onClick={() => setAmount(String(balance))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-display text-xs font-bold uppercase tracking-wider text-indigo hover:underline"
                >
                  Max
                </button>
              </div>
              <p className="text-xs text-ink-soft">
                Available: {formatUsd(balance)}
              </p>
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-1.5">
              <label className="font-display text-sm font-bold uppercase tracking-wide">
                Destination address
              </label>
              <Input
                placeholder="0x..."
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {destination.trim().length > 0 && !addressValid && (
                <p className="text-xs text-error">
                  That doesn&apos;t look like a valid address.
                </p>
              )}
            </div>

            <p className="text-xs text-ink-soft">
              Double-check the address — transfers can&apos;t be undone.
            </p>

            {stage.kind === "error" && (
              <p className="text-sm text-error">{stage.message}</p>
            )}

            <Button
              onClick={handleWithdraw}
              disabled={!canSubmit && stage.kind !== "error"}
              variant="default"
              size="lg"
            >
              {stage.kind === "sending"
                ? "Sending..."
                : amountValid
                  ? `Withdraw ${formatUsd(numericAmount)}`
                  : "Withdraw"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
