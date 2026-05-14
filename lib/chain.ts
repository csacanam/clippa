/**
 * Client-safe chain constants. These are public on-chain addresses — no secrets.
 */

// USDT (Tether) on Celo mainnet. 6 decimals.
export const CELO_USDT_ADDRESS =
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const;

export const USDT_DECIMALS = 6;

export function celoExplorerTx(txHash: string): string {
  return `https://celo.blockscout.com/tx/${txHash}`;
}
