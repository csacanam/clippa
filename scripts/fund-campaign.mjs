/**
 * Funds a Clippa campaign's on-chain escrow with USDT.
 *
 * The operator wallet must hold enough USDT first. This script does the two
 * on-chain steps: approve the Clippa contract to pull the USDT, then call
 * fundCampaign — which moves the USDT into the campaign's escrow balance.
 *
 * Usage:
 *   node scripts/fund-campaign.mjs <campaignUuid> <amountUsd>
 *
 * Example (fund nerdos-fun with 20 USDT):
 *   node scripts/fund-campaign.mjs 29ee7c97-e2ac-47f3-a449-0517d0d31387 20
 *
 * Reads OPERATOR_PRIVATE_KEY, CELO_RPC_URL, CLIPPA_CONTRACT_ADDRESS and
 * CELO_USDT_ADDRESS from .env (load with: set -a; source .env; set +a).
 */

import {
  createWalletClient,
  erc20Abi,
  http,
  pad,
  publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const [campaignUuid, amountUsdRaw] = process.argv.slice(2);
if (!campaignUuid || !amountUsdRaw) {
  console.error("Usage: node scripts/fund-campaign.mjs <campaignUuid> <amountUsd>");
  process.exit(1);
}
const amountUsd = Number(amountUsdRaw);
if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
  console.error(`Invalid amount: ${amountUsdRaw}`);
  process.exit(1);
}

const RPC_URL = process.env.CELO_RPC_URL;
const CONTRACT = process.env.CLIPPA_CONTRACT_ADDRESS;
const USDT = process.env.CELO_USDT_ADDRESS;
const rawKey = process.env.OPERATOR_PRIVATE_KEY;
if (!RPC_URL || !CONTRACT || !USDT || !rawKey) {
  console.error("Missing env: CELO_RPC_URL, CLIPPA_CONTRACT_ADDRESS, CELO_USDT_ADDRESS, OPERATOR_PRIVATE_KEY");
  process.exit(1);
}

const fundAbi = [
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
];

// USDT has 6 decimals. Floor to base units.
const amount = BigInt(Math.floor(amountUsd * 1_000_000));
const campaignId = pad(`0x${campaignUuid.replace(/-/g, "")}`, { size: 32 });

const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
const account = privateKeyToAccount(key);
const client = createWalletClient({
  account,
  chain: celo,
  transport: http(RPC_URL),
}).extend(publicActions);

const fmt = (v) => (Number(v) / 1_000_000).toFixed(6);

console.log(`Operator:  ${account.address}`);
console.log(`Campaign:  ${campaignUuid}`);
console.log(`Amount:    ${amountUsd} USDT (${amount} base units)\n`);

const usdtBalance = await client.readContract({
  address: USDT,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});
console.log(`Operator USDT balance: ${fmt(usdtBalance)}`);
if (usdtBalance < amount) {
  console.error(`\nNot enough USDT. Need ${amountUsd}, have ${fmt(usdtBalance)}.`);
  console.error(`Send USDT to ${account.address} on Celo mainnet first.`);
  process.exit(1);
}

const before = await client.readContract({
  address: CONTRACT,
  abi: fundAbi,
  functionName: "getCampaign",
  args: [campaignId],
});
if (!before.exists) {
  console.error("\nCampaign does not exist on-chain. Create it first.");
  process.exit(1);
}
console.log(`Escrow balance before: ${fmt(before.balance)} (totalFunded ${fmt(before.totalFunded)})\n`);

console.log("1/2 approve...");
const approveHash = await client.writeContract({
  address: USDT,
  abi: erc20Abi,
  functionName: "approve",
  args: [CONTRACT, amount],
});
await client.waitForTransactionReceipt({ hash: approveHash });
console.log(`    approved: ${approveHash}`);

console.log("2/2 fundCampaign...");
const fundHash = await client.writeContract({
  address: CONTRACT,
  abi: fundAbi,
  functionName: "fundCampaign",
  args: [campaignId, amount],
});
const receipt = await client.waitForTransactionReceipt({ hash: fundHash });
if (receipt.status !== "success") {
  console.error(`    fundCampaign reverted: ${fundHash}`);
  process.exit(1);
}
console.log(`    funded: ${fundHash}`);

const after = await client.readContract({
  address: CONTRACT,
  abi: fundAbi,
  functionName: "getCampaign",
  args: [campaignId],
});
console.log(`\nEscrow balance after: ${fmt(after.balance)} (totalFunded ${fmt(after.totalFunded)})`);
console.log("Done.");
