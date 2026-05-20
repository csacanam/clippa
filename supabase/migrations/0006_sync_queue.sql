-- View-sync work queue.
--
-- Scraping every tracking clip in one synchronous request times out long
-- before we reach thousands of videos. Instead we treat the `clips` table
-- itself as a queue: a worker claims a bounded chunk of the oldest-synced
-- clips, processes them, and releases. Many workers / overlapping cron runs
-- stay safe via `FOR UPDATE SKIP LOCKED` plus a lease lock.
--
-- No separate jobs table: the queue is just "tracking clips ordered by
-- last_scraped_at", so there's nothing to keep in sync with the real data.

-- Lease lock — while set in the future, the clip is "claimed". A crashed
-- worker's lease simply expires and another worker repicks the clip.
alter table clips
  add column if not exists sync_locked_until timestamptz;

-- How many times a worker has claimed this clip. Lets us spot clips that
-- keep failing without blocking the rest of the queue.
alter table clips
  add column if not exists sync_attempts integer not null default 0;

-- Index for the claim query: filter by status + lease, order by staleness.
create index if not exists clips_sync_queue_idx
  on clips (last_scraped_at asc nulls first)
  where status = 'tracking';

-- Atomically claim up to `batch_size` tracking clips that aren't currently
-- leased, lock them for `lease_minutes`, bump their attempt counter, and
-- return them. `FOR UPDATE SKIP LOCKED` guarantees two concurrent workers
-- never grab the same clip.
create or replace function claim_sync_batch(
  batch_size integer,
  lease_minutes integer default 5
)
returns setof clips
language sql
as $$
  update clips
  set sync_locked_until = now() + make_interval(mins => lease_minutes),
      sync_attempts = sync_attempts + 1
  where id in (
    select id from clips
    where status = 'tracking'
      and (sync_locked_until is null or sync_locked_until < now())
    order by last_scraped_at asc nulls first
    limit batch_size
    for update skip locked
  )
  returning *;
$$;
