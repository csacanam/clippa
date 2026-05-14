import "server-only";

import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  http,
  pad,
  parseEther,
  publicActions,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

import { clippaAbi } from "./clippa-abi";

const USDT_ADDRESS = process.env.CELO_USDT_ADDRESS as Hex;

// Gas stipend config. In practice a Privy-signed USDT transfer on Celo costs
// ~0.021 CELO (the embedded wallet uses a generous gas limit), so 0.02 wasn't
// enough for even one withdrawal. A 0.1 CELO stipend covers ~4-5 withdrawals.
const GAS_STIPEND_THRESHOLD = parseEther("0.05"); // top up if below this
const GAS_STIPEND_AMOUNT = parseEther("0.1"); // how much to send

/**
 * Celo payment rail — wraps the Clippa escrow contract's `recordPayout`.
 *
 * The operator wallet is the contract's `payer`. It signs the recordPayout
 * tx; the contract moves USDT from the campaign's escrow balance to the
 * creator, enforcing the per-clip cap and idempotency by payoutId.
 *
 * Env:
 *   OPERATOR_PRIVATE_KEY      — payer wallet key
 *   CELO_RPC_URL              — Celo mainnet RPC
 *   CLIPPA_CONTRACT_ADDRESS   — deployed escrow address
 */

const RPC_URL = process.env.CELO_RPC_URL!;
const CONTRACT = process.env.CLIPPA_CONTRACT_ADDRESS as Hex;

function operatorClient() {
  const raw = process.env.OPERATOR_PRIVATE_KEY!;
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  const account = privateKeyToAccount(key);
  return createWalletClient({
    account,
    chain: celo,
    transport: http(RPC_URL),
  }).extend(publicActions);
}

/**
 * Converts a Supabase UUID to the bytes32 id the contract expects:
 * the 16 UUID bytes, left-padded with zeros to 32 bytes.
 * Must match `pad(0x<uuid>, { size: 32 })` used when the campaign was created.
 */
export function uuidToBytes32(uuid: string): Hex {
  const hex = `0x${uuid.replace(/-/g, "")}` as Hex;
  return pad(hex, { size: 32 });
}

/** USD amount → USDT base units (6 decimals). Floors to avoid overpaying. */
export function usdToBaseUnits(usd: number): bigint {
  return BigInt(Math.floor(usd * 1_000_000));
}

export type RecordPayoutResult =
  | { ok: true; txHash: string }
  | { ok: false; error: string };

/**
 * Calls recordPayout on the escrow. Waits for the receipt.
 * The contract is idempotent on payoutId — a retried call with the same
 * payoutId reverts, so a crashed-and-retried job can't double-pay.
 */
export async function recordPayout(input: {
  campaignUuid: string;
  clipUuid: string;
  payoutUuid: string;
  recipient: Hex;
  amountUsd: number;
}): Promise<RecordPayoutResult> {
  const client = operatorClient();
  const amount = usdToBaseUnits(input.amountUsd);
  if (amount <= 0n) {
    return { ok: false, error: "Amount rounds to zero." };
  }

  try {
    const hash = await client.writeContract({
      address: CONTRACT,
      abi: clippaAbi,
      functionName: "recordPayout",
      args: [
        uuidToBytes32(input.campaignUuid),
        uuidToBytes32(input.clipUuid),
        uuidToBytes32(input.payoutUuid),
        input.recipient,
        amount,
      ],
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { ok: false, error: `Transaction reverted (${hash})` };
    }
    return { ok: true, txHash: hash };
  } catch (e) {
    // viem surfaces contract reverts with the custom error name in the message.
    return { ok: false, error: (e as Error).message.slice(0, 300) };
  }
}

export function explorerTxUrl(txHash: string): string {
  return `https://celo.blockscout.com/tx/${txHash}`;
}

/** Reads a wallet's USDT balance on Celo. Returns USD (6-decimal token). */
export async function getUsdtBalance(wallet: string): Promise<number> {
  const client = createPublicClient({
    chain: celo,
    transport: http(RPC_URL),
  });
  const raw = (await client.readContract({
    address: USDT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet as Hex],
  })) as bigint;
  return Number(raw) / 1_000_000;
}

/**
 * Tops up a creator's CELO balance for gas, but only if they're running low.
 *
 * Privy embedded wallets can't pay gas in USDT (no CIP-64 support), so a
 * creator needs a little native CELO to sign their own withdrawal. We send a
 * small stipend after paying them — just enough to cover a handful of txs.
 *
 * Best-effort: callers should not let a stipend failure block the payout.
 */
export async function ensureGasStipend(
  recipient: string
): Promise<{ sent: boolean; txHash?: string; reason?: string }> {
  const client = operatorClient();
  const to = recipient as Hex;

  const balance = await client.getBalance({ address: to });
  if (balance >= GAS_STIPEND_THRESHOLD) {
    return { sent: false, reason: "already funded" };
  }

  const hash = await client.sendTransaction({
    to,
    value: GAS_STIPEND_AMOUNT,
  });
  await client.waitForTransactionReceipt({ hash });
  return { sent: true, txHash: hash };
}

/** Reads a wallet's native CELO balance, formatted as a decimal string. */
export async function getCeloBalance(wallet: string): Promise<string> {
  const client = createPublicClient({
    chain: celo,
    transport: http(RPC_URL),
  });
  const raw = await client.getBalance({ address: wallet as Hex });
  return formatEther(raw);
}

export type ChainCampaign = {
  exists: boolean;
  totalFundedUsd: number;
  balanceUsd: number;
  totalPaidOutUsd: number;
  status: number;
};

/**
 * Reads a campaign's real state from the escrow contract — the source of
 * truth for funded/available/paid amounts. Returns exists:false if the
 * campaign hasn't been created on-chain yet.
 */
export async function getCampaignChainState(
  campaignUuid: string
): Promise<ChainCampaign> {
  const client = createPublicClient({
    chain: celo,
    transport: http(RPC_URL),
  });
  try {
    const c = (await client.readContract({
      address: CONTRACT,
      abi: clippaAbi,
      functionName: "getCampaign",
      args: [uuidToBytes32(campaignUuid)],
    })) as {
      balance: bigint;
      totalFunded: bigint;
      totalPaidOut: bigint;
      status: number;
      exists: boolean;
    };
    return {
      exists: c.exists,
      totalFundedUsd: Number(c.totalFunded) / 1_000_000,
      balanceUsd: Number(c.balance) / 1_000_000,
      totalPaidOutUsd: Number(c.totalPaidOut) / 1_000_000,
      status: Number(c.status),
    };
  } catch {
    // getCampaign reverts with CampaignNotFound when it doesn't exist on-chain.
    return {
      exists: false,
      totalFundedUsd: 0,
      balanceUsd: 0,
      totalPaidOutUsd: 0,
      status: 0,
    };
  }
}
