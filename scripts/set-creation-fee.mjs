/**
 * Reads (or updates) the Clippa contract's `creationFee` — the flat USDT
 * fee non-owner addresses pay when calling `createCampaign`.
 *
 * No arg → just reads and prints the current value.
 * With arg → sends `setCreationFee(<newFeeUsd>)` from OPERATOR_PRIVATE_KEY.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node scripts/set-creation-fee.mjs            # read only
 *   node scripts/set-creation-fee.mjs 0          # set to $0 (no fee)
 *   node scripts/set-creation-fee.mjs 5          # set to $5
 *
 * Reads OPERATOR_PRIVATE_KEY, CELO_RPC_URL, CLIPPA_CONTRACT_ADDRESS from .env.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const newFeeUsdRaw = process.argv[2];
const writeMode = newFeeUsdRaw !== undefined;

const RPC_URL = process.env.CELO_RPC_URL;
const CONTRACT = process.env.CLIPPA_CONTRACT_ADDRESS;
const rawKey = process.env.OPERATOR_PRIVATE_KEY;
if (!RPC_URL || !CONTRACT) {
  console.error("Missing env: CELO_RPC_URL, CLIPPA_CONTRACT_ADDRESS");
  process.exit(1);
}
if (writeMode && !rawKey) {
  console.error("Set mode requires OPERATOR_PRIVATE_KEY in env.");
  process.exit(1);
}

const abi = [
  {
    type: "function",
    name: "creationFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "setCreationFee",
    stateMutability: "nonpayable",
    inputs: [{ name: "newFee", type: "uint256" }],
    outputs: [],
  },
];

const publicClient = createPublicClient({ chain: celo, transport: http(RPC_URL) });

const current = await publicClient.readContract({
  address: CONTRACT,
  abi,
  functionName: "creationFee",
});
const currentUsd = Number(current) / 1_000_000;
console.log(`Current creationFee: ${current} base units = $${currentUsd.toFixed(2)} USDT`);

if (!writeMode) process.exit(0);

const newFeeUsd = Number(newFeeUsdRaw);
if (!Number.isFinite(newFeeUsd) || newFeeUsd < 0) {
  console.error(`Invalid amount: ${newFeeUsdRaw}`);
  process.exit(1);
}
const newFeeBaseUnits = BigInt(Math.floor(newFeeUsd * 1_000_000));
if (newFeeBaseUnits === current) {
  console.log("Already at that value — no change needed.");
  process.exit(0);
}

const key = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`);
const account = privateKeyToAccount(key);
const walletClient = createWalletClient({
  account,
  chain: celo,
  transport: http(RPC_URL),
}).extend(publicActions);

console.log(`Sending setCreationFee(${newFeeBaseUnits}) = $${newFeeUsd.toFixed(2)}...`);
const hash = await walletClient.writeContract({
  address: CONTRACT,
  abi,
  functionName: "setCreationFee",
  args: [newFeeBaseUnits],
});
console.log(`Tx submitted: ${hash}`);
const receipt = await walletClient.waitForTransactionReceipt({ hash });
console.log(`Confirmed in block ${receipt.blockNumber}. Status: ${receipt.status}`);
