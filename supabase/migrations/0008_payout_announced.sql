-- Community-announcement bookkeeping for payouts.
--
-- Once a payout run finishes draining the queue, one digest message is
-- posted to the Telegram community. `announced_at` marks which `sent`
-- payouts have already been included in a digest, so the announce step
-- can be called repeatedly (after every drain) without ever double-posting
-- a payout.

alter table payouts
  add column if not exists announced_at timestamptz;

-- The announce query: sent payouts that haven't been announced yet.
create index if not exists payouts_unannounced_idx
  on payouts (created_at)
  where status = 'sent' and announced_at is null;
