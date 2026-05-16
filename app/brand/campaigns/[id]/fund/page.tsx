"use client";

import { useWallets } from "@privy-io/react-auth";
import { ArrowLeft, ArrowUpRight, Check, Coins } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  http,
  type Hex,
} from "viem";
import { celo } from "viem/chains";

import { AuthGuard } from "@/components/auth-guard";
import { ClippaLogo } from "@/components/clippa-logo";
import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getMyPendingCampaign,
  markCampaignActive,
  type PendingCampaign,
} from "@/lib/actions/campaigns";
import {
  CELO_USDT_ADDRESS,
  CLIPPA_CONTRACT_ADDRESS,
  celoExplorerTx,
  usdToBaseUnits,
  uuidToBytes32,
} from "@/lib/chain";
import { useAccessToken } from "@/lib/hooks/use-access-token";

const CLIPPA_WRITE_ABI = [
  {
    type: "function",
    name: "createCampaign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "maxPayoutPerClip", type: "uint256" },
    ],
    outputs: [],
  },
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
  | { kind: "idle" }
  | { kind: "approving" }
  | { kind: "creating" }
  | { kind: "funding" }
  | { kind: "finalizing" }
  | { kind: "done"; fundTx: string }
  | { kind: "error"; message: string };

function FundCampaign() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const identityToken = useAccessToken();
  const { wallets } = useWallets();
  const { t } = useTranslation();

  const [campaign, setCampaign] = useState<PendingCampaign | null | "missing">(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  useEffect(() => {
    if (!identityToken || !params.id) return;
    getMyPendingCampaign(identityToken, params.id)
      .then((c) => setCampaign(c ?? "missing"))
      .catch(() => setCampaign("missing"));
  }, [identityToken, params.id]);

  const handleFund = async () => {
    if (!identityToken || !campaign || campaign === "missing") return;
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

      const campaignId = uuidToBytes32(campaign.id);
      const fundUnits = usdToBaseUnits(campaign.totalBudgetUsd);
      const maxPayoutUnits = usdToBaseUnits(campaign.maxPayoutPerClipUsd);

      // Read existing on-chain campaign — maybe createCampaign already succeeded
      // last time and only funding is left.
      const onChain = (await publicClient.readContract({
        address: CLIPPA_CONTRACT_ADDRESS,
        abi: [
          {
            type: "function",
            name: "getCampaign",
            stateMutability: "view",
            inputs: [{ name: "campaignId", type: "bytes32" }],
            outputs: [
              {
                type: "tuple",
                components: [
                  { name: "creator", type: "address" },
                  { name: "balance", type: "uint256" },
                  { name: "totalFunded", type: "uint256" },
                  { name: "totalPaidOut", type: "uint256" },
                  { name: "maxPayoutPerClip", type: "uint256" },
                  { name: "status", type: "uint8" },
                  { name: "exists", type: "bool" },
                ],
              },
            ],
          },
        ] as const,
        functionName: "getCampaign",
        args: [campaignId],
      }).catch(() => null)) as { exists: boolean; totalFunded: bigint } | null;

      // 1. Approve if needed.
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

      // 2. createCampaign — skip if already on-chain.
      if (!onChain?.exists) {
        setStage({ kind: "creating" });
        const createTx = await walletClient.writeContract({
          address: CLIPPA_CONTRACT_ADDRESS,
          abi: CLIPPA_WRITE_ABI,
          functionName: "createCampaign",
          args: [campaignId, maxPayoutUnits],
        });
        await publicClient.waitForTransactionReceipt({ hash: createTx as Hex });
      }

      // 3. Fund — skip if already funded the full amount.
      let fundTxHash: string;
      if (onChain?.exists && onChain.totalFunded >= fundUnits) {
        fundTxHash = ""; // already funded
      } else {
        setStage({ kind: "funding" });
        fundTxHash = await walletClient.writeContract({
          address: CLIPPA_CONTRACT_ADDRESS,
          abi: CLIPPA_WRITE_ABI,
          functionName: "fundCampaign",
          args: [campaignId, fundUnits],
        });
        await publicClient.waitForTransactionReceipt({ hash: fundTxHash as Hex });
      }

      // 4. Flip DB.
      setStage({ kind: "finalizing" });
      const r = await markCampaignActive(identityToken, campaign.id);
      if (!r.ok) throw new Error(r.error);

      setStage({ kind: "done", fundTx: fundTxHash });
    } catch (e) {
      const raw = (e as Error).message ?? "Something went wrong.";
      let message = raw.slice(0, 200);
      if (/rejected|denied/i.test(raw)) message = t("brand.errSigningCancelled");
      else if (/insufficient/i.test(raw)) message = t("brand.errInsufficientFunds");
      setStage({ kind: "error", message });
    }
  };

  const busy =
    stage.kind === "approving" ||
    stage.kind === "creating" ||
    stage.kind === "funding" ||
    stage.kind === "finalizing";

  return (
    <main className="flex min-h-dvh flex-col px-6 py-6 md:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClippaLogo />
            <Badge variant="indigo" className="px-2.5 py-1 text-[0.7rem]">
              {t("brand.badgeBrand")}
            </Badge>
          </div>
          <Link
            href="/brand"
            className="font-body text-sm font-medium text-ink-soft underline-offset-4 hover:underline"
          >
            {t("brand.backToDashboard")}
          </Link>
        </header>

        <section className="mt-12 w-full">
        {campaign === null ? (
          <p className="text-center font-display text-sm uppercase tracking-wider text-ink-soft">
            {t("common.loading")}
          </p>
        ) : campaign === "missing" ? (
          <Card className="bg-peach">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="font-display text-lg font-bold tracking-tight">
                {t("brand.resumeNotFound")}
              </p>
              <p className="text-sm text-ink-soft">
                {t("brand.resumeNotFoundBody")}
              </p>
              <Link
                href="/brand"
                className="mt-2 font-body text-sm text-indigo underline-offset-4 hover:underline"
              >
                {t("brand.resumeBack")}
              </Link>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Card className="bg-cream">
              <CardContent className="flex flex-col gap-4">
                <div>
                  <p className="font-display text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                    {t("brand.resumeLabel")}
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
                    {campaign.productName}
                  </h1>
                  <p className="mt-0.5 font-mono text-xs text-ink-soft">
                    {campaign.slug}
                  </p>
                </div>

                <div className="rounded-md border-2 border-ink bg-peach p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                      {t("brand.fundAmount")}
                    </span>
                    <span className="font-display text-2xl font-bold tracking-tight">
                      ${campaign.totalBudgetUsd.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-2 text-[0.7rem] text-ink-soft">
                    {t("brand.resumeNote")}
                  </p>
                </div>

                {stage.kind === "done" ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col items-center gap-2 rounded-md border-2 border-ink bg-lime p-4 text-center">
                      <Check className="size-6" />
                      <p className="font-display text-lg font-bold tracking-tight">
                        {t("brand.resumeDoneTitle")}
                      </p>
                      {stage.fundTx && (
                        <a
                          href={celoExplorerTx(stage.fundTx)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo hover:underline"
                        >
                          {t("brand.fundDoneReceipt")}
                          <ArrowUpRight className="size-3" />
                        </a>
                      )}
                    </div>
                    <Button
                      onClick={() => router.push("/brand")}
                      variant="default"
                      size="lg"
                    >
                      {t("brand.fundDoneCta")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-between gap-2 pt-1">
                    <Link
                      href="/brand"
                      className="inline-flex items-center gap-1 self-center font-body text-sm text-ink-soft underline-offset-4 hover:underline"
                    >
                      <ArrowLeft className="size-3" /> {t("brand.resumeCancel")}
                    </Link>
                    <Button
                      onClick={handleFund}
                      disabled={busy}
                      variant="default"
                      size="lg"
                    >
                      <Coins className={`size-4 ${busy ? "animate-pulse" : ""}`} />
                      {stage.kind === "approving"
                        ? t("brand.resumeBtnApproving")
                        : stage.kind === "creating"
                          ? t("brand.resumeBtnCreating")
                          : stage.kind === "funding"
                            ? t("brand.resumeBtnFunding")
                            : stage.kind === "finalizing"
                              ? t("brand.resumeBtnFinalizing")
                              : t("brand.resumeBtnIdle")}
                    </Button>
                  </div>
                )}

                {stage.kind === "error" && (
                  <p className="text-sm text-error">{stage.message}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
        </section>
      </div>
    </main>
  );
}

export default function FundCampaignPage() {
  return (
    <AuthGuard redirectTo="/brands">
      <FundCampaign />
    </AuthGuard>
  );
}
