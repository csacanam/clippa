-- Brands MVP
--
-- 1. Rename `creators` → `users`. The table represents a user identity
--    (Privy account + wallet), not a role; roles are layered on top now
--    that brands can also sign up.
-- 2. Add `users.primary_role` so we know which dashboard to land them in.
-- 3. Add `campaigns.created_by_user_id` so brands can own their campaigns
--    (legacy operator-seeded ones get backfilled to the admin).
--
-- FK columns named `creator_id` (in clips, payouts, creator_campaign_codes)
-- stay as-is — semantically they still mean "the user acting as creator
-- in that context". Postgres rewires FK targets automatically when a
-- referenced table is renamed.

-- ----------------------------------------------------------------------
-- 1. Rename creators → users (idempotent)
-- ----------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_tables where tablename = 'creators' and schemaname = 'public') then
    alter table creators rename to users;
  end if;
end $$;

-- ----------------------------------------------------------------------
-- 2. Role column
-- ----------------------------------------------------------------------
alter table users
  add column if not exists primary_role text not null default 'creator'
    check (primary_role in ('creator', 'brand'));

-- ----------------------------------------------------------------------
-- 3. Campaign ownership
-- ----------------------------------------------------------------------
alter table campaigns
  add column if not exists created_by_user_id uuid references users(id) on delete set null;

create index if not exists campaigns_created_by_user_idx
  on campaigns (created_by_user_id);

-- Backfill the legacy Nerdos.fun campaign to the admin if they already
-- have a users row. If the admin hasn't onboarded yet, this is a no-op
-- and ownership can be set manually later.
update campaigns
set created_by_user_id = (select id from users where email = 'camilo@peewah.co')
where slug = 'nerdos-fun' and created_by_user_id is null;
