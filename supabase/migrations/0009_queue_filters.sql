-- Queue claim refinements.
--
-- Two changes to both claim RPCs:
--   1. Skip clips whose campaign isn't `active` — a paused/ended campaign
--      shouldn't have its clips scraped or paid.
--   2. (sync only) Skip clips that have failed to scrape too many times in
--      a row — a deleted/private video would otherwise be retried forever,
--      wasting scrape calls. `sync_attempts` now means "consecutive sync
--      failures": the worker resets it to 0 on success and bumps it on
--      failure (the RPC no longer touches it).

-- ── sync queue ────────────────────────────────────────────────────────────
-- `claim_sync_batch` gains a third parameter (max_failures). A new parameter
-- changes the signature, so `create or replace` would leave the old 2-arg
-- version behind and PostgREST couldn't pick between them — drop it first.
drop function if exists claim_sync_batch(integer, integer);

create or replace function claim_sync_batch(
  batch_size integer,
  lease_minutes integer default 5,
  max_failures integer default 50
)
returns setof clips
language sql
as $$
  update clips
  set sync_locked_until = now() + make_interval(mins => lease_minutes)
  where id in (
    select c.id
    from clips c
    join campaigns ca on ca.id = c.campaign_id
    where c.status = 'tracking'
      and ca.status = 'active'
      and c.sync_attempts < max_failures
      and (c.sync_locked_until is null or c.sync_locked_until < now())
    order by c.last_scraped_at asc nulls first
    limit batch_size
    for update of c skip locked
  )
  returning *;
$$;

-- ── payout queue ──────────────────────────────────────────────────────────
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
    select c.id
    from clips c
    join campaigns ca on ca.id = c.campaign_id
    where c.status = 'tracking'
      and ca.status = 'active'
      and c.earnings_usd > c.paid_out_usd
      and (c.payout_locked_until is null or c.payout_locked_until < now())
    order by c.last_payout_at asc nulls first
    limit batch_size
    for update of c skip locked
  )
  returning *;
$$;
