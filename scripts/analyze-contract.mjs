/**
 * Generic Celo contract analyzer. Pulls every external transaction sent to a
 * given address via the BlockScout API and prints the three metrics that
 * Talent Protocol Proof-of-Ship looks at:
 *
 *   - Transactions       — total (success + reverted)
 *   - DAU (user-days)    — sum of unique active addresses per UTC day
 *                          (same wallet active 3 days counts as 3)
 *   - Gas fees           — gasUsed × gasPrice, summed, in CELO
 *
 * Not tied to any project — handy to verify how Talent Protocol scores any
 * Celo contract.
 *
 * Usage:
 *   node scripts/analyze-contract.mjs <address>
 *   node scripts/analyze-contract.mjs <address> --since=YYYY-MM-DD
 */

import { formatEther } from "viem";

const CONTRACT = process.argv[2];
if (!CONTRACT || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT)) {
  console.error("Usage: node scripts/analyze-contract.mjs <0x address> [--since=YYYY-MM-DD]");
  process.exit(1);
}

const sinceArg = process.argv.find((a) => a.startsWith("--since="));
const sinceDateStr = sinceArg ? sinceArg.split("=")[1] : null;
const sinceTs = sinceDateStr
  ? Math.floor(new Date(`${sinceDateStr}T00:00:00Z`).getTime() / 1000)
  : 0;

async function fetchAllTxs() {
  // BlockScout v2 paginates with `next_page_params`. Keep pulling until null.
  const all = [];
  const base = `https://celo.blockscout.com/api/v2/addresses/${CONTRACT}/transactions`;
  let nextParams = "";
  for (;;) {
    const url = nextParams ? `${base}?${nextParams}` : base;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`BlockScout error: HTTP ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    all.push(...(data.items ?? []));
    if (!data.next_page_params) break;
    nextParams = new URLSearchParams(data.next_page_params).toString();
  }
  return all;
}

/** Normalize a BlockScout tx into the fields we care about. */
function normalize(tx) {
  return {
    hash: tx.hash,
    from: typeof tx.from === "string" ? tx.from : tx.from?.hash,
    to: typeof tx.to === "string" ? tx.to : tx.to?.hash,
    timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000),
    success: tx.status === "ok",
    gasUsed: BigInt(tx.gas_used ?? 0),
    gasPrice: BigInt(tx.gas_price ?? 0),
  };
}

/**
 * Count user-days: for each UTC day in the window, take the set of unique
 * `from` addresses and sum the cardinalities. Same address active 3 days = 3.
 * This is how Talent Protocol counts "users" for Proof-of-Ship.
 */
function sumDailyActiveUsers(txs) {
  const byDay = new Map(); // "YYYY-MM-DD" => Set<address>
  for (const t of txs) {
    const day = new Date(t.timestamp * 1000).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(t.from.toLowerCase());
  }
  let total = 0;
  for (const set of byDay.values()) total += set.size;
  return { total, days: byDay.size };
}

function summarize(txs, label) {
  if (txs.length === 0) {
    console.log(`\n${label}: 0 transactions`);
    return;
  }
  const ok = txs.filter((t) => t.success).length;
  const failed = txs.length - ok;
  const uniqueUsers = new Set(txs.map((t) => t.from.toLowerCase()));
  const dau = sumDailyActiveUsers(txs);
  const gasWei = txs.reduce((sum, t) => sum + t.gasUsed * t.gasPrice, 0n);
  console.log(`\n${label}:`);
  console.log(`  Transactions:        ${txs.length}  (${ok} ok, ${failed} failed)`);
  console.log(`  DAU (user-days):     ${dau.total}  (across ${dau.days} active days)`);
  console.log(`  Unique users:        ${uniqueUsers.size}`);
  console.log(`  Gas spent (CELO):    ${formatEther(gasWei)}`);
}

(async () => {
  console.log(`Analyzing contract ${CONTRACT} on Celo…`);
  const raw = await fetchAllTxs();
  if (raw.length === 0) {
    console.log("No transactions found.");
    return;
  }
  const all = raw.map(normalize).sort((a, b) => a.timestamp - b.timestamp);

  const first = new Date(all[0].timestamp * 1000);
  const last = new Date(all[all.length - 1].timestamp * 1000);
  console.log(`First tx: ${first.toISOString()}`);
  console.log(`Latest tx: ${last.toISOString()}`);

  summarize(all, "All time");

  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 24 * 3600;
  summarize(
    all.filter((t) => t.timestamp >= weekAgo),
    "Last 7 days"
  );

  if (sinceTs > 0) {
    summarize(
      all.filter((t) => t.timestamp >= sinceTs),
      `Since ${sinceDateStr}`
    );
  }
})();
