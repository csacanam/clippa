-- Author handle on clips.
--
-- TikTok post URLs carry the @username, but Instagram reel URLs are just
-- `/reel/<code>` — no username. The scraper does return the author handle
-- for both platforms (`ownerUsername` for IG); we just never stored it.
--
-- The sync worker now writes `author_handle` on every successful scrape,
-- so the payout digest can show a real handle for Instagram clips instead
-- of the "un creador" fallback.

alter table clips
  add column if not exists author_handle text;
