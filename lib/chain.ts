/**
 * Client-safe chain constants and helpers. No secrets — public addresses only.
 */

import { pad, type Hex } from "viem";

// USDT (Tether) on Celo mainnet. 6 decimals.
export const CELO_USDT_ADDRESS =
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const;

export const USDT_DECIMALS = 6;

/** Clippa escrow contract on Celo. Exposed to the client because the brand
 *  wallet calls createCampaign + fundCampaign directly. */
export const CLIPPA_CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_CLIPPA_CONTRACT_ADDRESS as Hex;

export function celoExplorerTx(txHash: string): string {
  return `https://celo.blockscout.com/tx/${txHash}`;
}

/**
 * Converts a Supabase UUID to the bytes32 id the contract expects:
 * 16 UUID bytes left-padded to 32 bytes. Matches server-side uuidToBytes32.
 */
export function uuidToBytes32(uuid: string): Hex {
  const hex = `0x${uuid.replace(/-/g, "")}` as Hex;
  return pad(hex, { size: 32 });
}

/** USD amount → USDT base units (6 decimals). Floors to avoid rounding-up. */
export function usdToBaseUnits(usd: number): bigint {
  return BigInt(Math.floor(usd * 1_000_000));
}
