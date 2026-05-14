import "server-only";

import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  pad,
  publicActions,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

import { clippaAbi } from "./clippa-abi";

const USDT_ADDRESS = process.env.CELO_USDT_ADDRESS as Hex;

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
