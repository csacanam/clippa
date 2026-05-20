-- Payout work queue.
--
-- Same problem as the view-sync queue, worse: paying out every owed clip in
-- one request means one on-chain `recordPayout` tx per clip (~6-12 s each on
-- Celo), so a handful of clips already blows the function timeout.
--
-- Same solution: the `clips` table is the queue. The "owed" set is just
-- `tracking` clips where earnings_usd > paid_out_usd. A worker claims a small
-- bounded chunk (on-chain txs are slow, so batches stay tiny), pays them,
-- releases the lease.

-- Lease lock for the payout worker — separate from sync_locked_until so the
-- sync and payout workers never contend over the same column.
alter table clips
  add column if not exists payout_locked_until timestamptz;

-- Index for the claim query: owed tracking clips, oldest-paid first.
create index if not exists clips_payout_queue_idx
  on clips (last_payout_at asc nulls first)
  where status = 'tracking';

-- Atomically claim up to `batch_size` tracking clips that are owed money
-- (earnings_usd > paid_out_usd) and not currently leased. `FOR UPDATE SKIP
-- LOCKED` keeps concurrent workers / overlapping cron runs from grabbing the
-- same clip — important here because a double-claim could double-pay.
create or replace function claim_payout_batch(
  batch_size integer,
  lease_minutes integer default 5
)
returns setof clips
language sql
as $$
  update clips
  set payout_locked_until = now() + make_interval(mins => lease_minutes)
  where id in (
    select id from clips
    where status = 'tracking'
      and earnings_usd > paid_out_usd
      and (payout_locked_until is null or payout_locked_until < now())
    order by last_payout_at asc nulls first
    limit batch_size
    for update skip locked
  )
  returning *;
$$;
