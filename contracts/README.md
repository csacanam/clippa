# Clippa contracts

Smart contracts for Clippa — pay-per-view creator campaigns on Celo.

## `Clippa.sol`

USDT escrow for creator campaigns.

### IDs

Campaign, clip and payout ids on-chain **are** the off-chain (Supabase) UUIDs,
encoded as `bytes32` — the 16 UUID bytes left-padded with zeros. There is no
separate on-chain id and no mapping table to keep in sync.

```ts
import { pad, type Hex } from "viem";
const id = pad(`0x${uuid.replaceAll("-", "")}` as Hex, { size: 32 });
```

`createCampaign` takes the id from the caller and rejects duplicates
(`CampaignAlreadyExists`) and the zero id (`ZeroId`).

### Actors

- **owner** — Clippa admin. Sets the creation fee, authorizes the payer, pauses
  campaigns, and withdraws unspent campaign balances + accrued fees. Creates
  campaigns for free.
- **payer** — the payout agent (server wallet). The only address allowed to call
  `recordPayout`.
- **anyone** — can create a campaign (paying the creation fee in USDT) and fund
  any active campaign.

### Lifecycle

```
createCampaign(id, maxPayoutPerClip)         -> charges creationFee USDT (waived for owner)
fundCampaign(id, amount)                     -> anyone tops up an active campaign
recordPayout(id, clipId, payoutId, to, amt)  -> payer pays an approved creator; enforces
                                                campaign balance + per-clip cap
```

Per-clip spend is tracked on-chain in `clipPaidOut[campaignId][clipId]`. A clip
can never receive more than the campaign's `maxPayoutPerClip` across all payouts.

`recordPayout` is **idempotent on `payoutId`**: each payout UUID can only be
processed once (`payoutProcessed` mapping). A crashed-and-retried payout job that
re-submits the same `payoutId` is rejected with `PayoutAlreadyProcessed` — it
cannot double-pay. The agent should write the Supabase `payouts` row first (so it
has a stable UUID), then call `recordPayout` with that id, then mark the row sent.

### Campaign states

```
Active  -> accepts funding and payouts
Paused  -> rejects funding and payouts; can be resumed or ended
Ended   -> terminal; rejects funding and payouts; cannot be resumed
```

Transitions are owner-only: `pauseCampaign` (Active→Paused),
`resumeCampaign` (Paused→Active), `endCampaign` (Active/Paused→Ended).

### Admin

- `setCreationFee(newFee)` — fee is in USDT base units (10e6 = $10 at 6 decimals).
- `setPayer(newPayer)` — rotate the payout agent.
- `pauseCampaign(id)` / `resumeCampaign(id)` / `endCampaign(id)` — lifecycle control.
- `withdrawCampaign(id, amount, to)` — pull unspent USDT out of a campaign. Only
  allowed when the campaign is **paused or ended** — funds can't be pulled from an
  active campaign.
- `withdrawFees(amount, to)` — withdraw accrued creation fees. Cannot touch
  campaign balances (fees are accounted separately in `feesCollected`).

### Approvals

`createCampaign` and `fundCampaign` use `transferFrom` — the caller must
`approve` the Clippa contract for the USDT amount first.

## Develop

```bash
forge build      # compile
forge test       # run tests (56 tests, incl. fuzz)
forge fmt        # format
```

## Deploy

Set env vars, then run the deploy script:

```bash
export USDT_ADDRESS=0x...      # Celo USDT (mainnet or Sepolia)
export CREATION_FEE=10000000   # $10 at 6 decimals
export PAYER_ADDRESS=0x...     # payout agent wallet

forge script script/DeployClippa.s.sol \
  --rpc-url <celo-rpc-url> \
  --broadcast \
  --private-key <deployer-key>
```

The deployer becomes `owner`.

### Celo USDT addresses

Both are **6 decimals** (verified via Blockscout), so `$10 = 10_000_000`.

| Network      | USDT address                                 | Decimals |
|--------------|-----------------------------------------------|----------|
| Celo mainnet | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6        |
| Celo Sepolia | `0xd077A400968890Eacc75cdc901F0356c943e4fDb` | 6        |
