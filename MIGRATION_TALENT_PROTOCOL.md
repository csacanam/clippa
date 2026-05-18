# Migration plan — make creator activity visible on-chain

Working doc for a potential evolution of the Clippa contract so that real
users (brands + creators) show up in the metrics Talent Protocol uses for
Proof-of-Ship. **Not a committed roadmap** — this is a tradeoff exploration.

## Why this exists

Talent Protocol scores Celo apps on three on-chain metrics derived from a
contract address:

| Metric           | How it's measured                                                |
| ---------------- | ---------------------------------------------------------------- |
| Transactions     | Total successful + reverted txs sent to the contract             |
| DAU (user-days)  | Sum, per UTC day, of unique `tx.from` addresses (returning = +1) |
| Gas fees         | `Σ gasUsed × gasPrice`, in CELO                                  |

Reproduce locally with `node scripts/analyze-contract.mjs <address>`.

## What the current contract already counts

Reality is more nuanced than "everything is operator-signed":

| Action                                | Signed by      | Counted by Talent Protocol? |
| ------------------------------------- | -------------- | --------------------------- |
| `createCampaign`                      | Brand (Privy)  | ✅ Brand appears in txlist  |
| `fundCampaign`                        | Brand (Privy)  | ✅ Brand appears in txlist  |
| USDT `approve` to escrow              | Brand (Privy)  | (different contract — n/a)  |
| `recordPayout` (hourly, per creator)  | Operator       | ❌ Only operator counted    |
| `setCreationFee`, `setPayer`, etc.    | Operator       | ❌ Only operator counted    |
| Creator USDT withdrawal to exchange   | Creator (Privy)| (different contract — n/a)  |

So the missing piece is **creators don't sign anything on the Clippa
contract**. They receive USDT pushed by `recordPayout`, but never personally
appear in the txlist. Every brand that creates a campaign already shows up;
every payout pushed by the operator doesn't credit the recipient creator.

This means today the contract's "users" metric scales with brand count, not
creator count. Given the platform's actual ratio (1 brand : many creators),
that's the wrong shape for proof-of-ship.

## Goal

Add at least one creator-signed action on the Clippa contract so that
**every active creator shows up in `tx.from` at least once per active day**.

Constraints to preserve:

- No scary wallet popups — creators don't see gas, don't see signatures
- Privy embedded wallets sign server-side with the user's identity token
- Don't break existing UX flows (clip submission, earning, withdrawal)
- Gas budget per creator stays bounded (we already have `topUpForGas`
  stipend infra at [lib/payments/celo.ts:138](lib/payments/celo.ts#L138))

## Option A — On-chain clip submission (recommended)

Add a `submitClip(bytes32 campaignId, bytes32 clipId, string postUrl)`
function to the contract. Creator's Privy wallet signs it at the moment they
click "Submit clip" in the UI.

**Pros**

- Maps 1:1 to a natural user action — every clip submission = 1 tx from the
  creator, 1 user-day credited
- Doesn't touch the payment rail — `recordPayout` stays operator-pushed
- Adds a provable on-chain timeline of submissions (nice as a creator résumé)
- Single new function, additive — no breaking change for brands

**Cons**

- Extra ~$0.01–0.05 of gas per submission (negligible on Celo, but real)
- Submission failure modes get more complex: tx revert vs DB write vs upload
- Need to make sure the stipend tops up creators *before* they submit, not
  just after their first payout. Today the stipend triggers post-payout, so
  brand-new creators have $0 CELO when they try to sign.

**Implementation sketch**

1. Add `submitClip` to V2 contract — emits `ClipSubmitted(campaignId, clipId,
   creator, postUrl)`. No state change, just an event.
2. New server action `prepareSubmitClip` returns the tx calldata + checks
   creator's CELO balance, tops up via `topUpForGas` if below threshold.
3. Client `submitClip` flow becomes: validate post → upload video → wait for
   stipend → sign on-chain `submitClip` → write DB row. The on-chain tx is
   what gives us the user-day credit.
4. Existing `lib/actions/clips.ts` `submitClip` becomes the post-tx
   bookkeeping step.

## Option B — Pull-based payout claims

Replace the operator-pushed `recordPayout` with a creator-signed
`claimEarnings(campaignId, clipId, uint256 amount, bytes signature)`. The
operator signs an off-chain authorization (amount + nonce); the creator's
wallet submits it on-chain to pull the funds.

**Pros**

- Each claim = 1 tx from creator = 1 user-day. Strongest DAU multiplier.
- Aligns with how most DeFi protocols handle this (merkle drops, etc.)

**Cons**

- Big architectural shift. Today payouts are automatic and invisible; in this
  model creators have to actively claim (or we add a background "auto-claim"
  job that's basically the same as today but more expensive)
- Reverts the gasless feel for the core money flow
- Operator still signs the authorization off-chain, but creator pays gas to
  claim — stipend infra has to cover every claim, not just bootstrapping
- More on-chain txs but most of them happen at the auto-claim worker, which
  again lives in one EOA → same problem as today

## Option C — Hybrid: A plus periodic check-in

Add Option A's `submitClip`. Then also add a no-op `checkIn(bytes32
creatorRef)` function the creator's wallet calls once per session opening the
dashboard. Cheap, low-friction, gives a steady daily heartbeat for active
creators that haven't submitted a clip that day.

Probably overkill unless we want to inflate DAU artificially — better to let
real submissions be the natural pulse.

## Recommendation

Ship **Option A** alongside the V2 contract work (already deferred — see
`MVP_SPEC.md`). It gives the right metric, the smallest blast radius, no
breaking changes for brands, and reuses existing stipend infra.

Open before committing:

- Pre-submission stipend top-up: when does the operator top up a brand-new
  creator's CELO? Probably at first dashboard load, not at first payout.
  Worth a separate ticket.
- Should `submitClip` also store a hash of the post URL on-chain? Trade-off:
  more gas vs better tamper-evidence. Probably no — DB is the source of
  truth, the event is just a "this creator was here today" beacon.
- Privy server-side signing throughput — confirm we can sign N concurrent
  user txs per minute at peak.

## Out of scope here

- The V2 contract redesign itself (min funding, 20% fee config). That's
  tracked separately and is the right vehicle to ship this change.
- Migration of existing campaign balances from V1 to V2.
- Whether to also count brand `withdraw` activity (already counts; brand
  flows are not the bottleneck).
