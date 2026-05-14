-- Clippa initial schema
-- Mirrors §6.1 of MVP_SPEC.md
-- Run this in Supabase SQL editor (or `supabase db push` if using the CLI).

-- =========================================================================
-- Extensions
-- =========================================================================
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- =========================================================================
-- creators
-- =========================================================================
create table if not exists creators (
  id              uuid primary key default gen_random_uuid(),
  privy_user_id   text unique not null,
  email           text unique not null,
  country         text,
  wallet_address  text unique not null,
  created_at      timestamptz not null default now()
);

-- =========================================================================
-- campaigns
-- =========================================================================
create table if not exists campaigns (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text unique not null,
  product_name            text not null,
  short_description       text not null,
  long_description        text not null,
  example_video_url       text,
  script_markdown         text not null,
  instructions_markdown   text not null,
  rate_per_view_usd       numeric(10,6) not null,
  max_payout_per_clip_usd numeric(10,2) not null,
  total_budget_usd        numeric(10,2) not null,
  spent_usd               numeric(10,2) not null default 0,
  platforms               text[] not null,
  status                  text not null default 'active'
    check (status in ('active', 'paused', 'ended')),
  created_at              timestamptz not null default now()
);

-- =========================================================================
-- creator_campaign_codes
-- One tracking code per (creator, campaign). Generated when the creator
-- first opens the campaign. Used to verify authorship via caption match.
-- =========================================================================
create table if not exists creator_campaign_codes (
  creator_id   uuid not null references creators(id) on delete cascade,
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  code         text not null,
  created_at   timestamptz not null default now(),
  primary key (creator_id, campaign_id),
  unique (campaign_id, code)
);

-- =========================================================================
-- clips
-- =========================================================================
create table if not exists clips (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references creators(id) on delete cascade,
  campaign_id         uuid not null references campaigns(id) on delete restrict,
  platform            text not null check (platform in ('instagram', 'tiktok')),
  post_url            text not null,
  tracking_code       text,
  status              text not null default 'pending'
    check (status in ('pending', 'tracking', 'rejected', 'paused', 'maxed_out')),
  rejection_reason    text,
  approved_at         timestamptz,
  approved_by         text,
  verified_views      bigint not null default 0,
  paid_views          bigint not null default 0,
  earnings_usd        numeric(12,4) not null default 0,
  paid_out_usd        numeric(12,4) not null default 0,
  last_scraped_at     timestamptz,
  last_payout_at      timestamptz,
  last_caption        text,
  created_at          timestamptz not null default now(),
  -- Cross-creator dedup: same post URL on same campaign blocked for anyone.
  unique (campaign_id, post_url)
);

create index if not exists clips_status_scrape_idx
  on clips (status, last_scraped_at);
create index if not exists clips_creator_created_idx
  on clips (creator_id, created_at desc);

-- =========================================================================
-- view_snapshots
-- =========================================================================
create table if not exists view_snapshots (
  id          uuid primary key default gen_random_uuid(),
  clip_id     uuid not null references clips(id) on delete cascade,
  views       bigint not null,
  raw_payload jsonb,
  scraped_at  timestamptz not null default now()
);

create index if not exists view_snapshots_clip_idx
  on view_snapshots (clip_id, scraped_at desc);

-- =========================================================================
-- payouts
-- =========================================================================
create table if not exists payouts (
  id              uuid primary key default gen_random_uuid(),
  clip_id         uuid not null references clips(id) on delete cascade,
  creator_id      uuid not null references creators(id),
  views_paid      bigint not null,
  amount_usd      numeric(12,4) not null,
  rail            text not null default 'celo',
  tx_hash         text,
  memo            text,
  status          text not null default 'pending'
    check (status in ('pending', 'sent', 'confirmed', 'failed')),
  error_message   text,
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz
);

create index if not exists payouts_creator_idx
  on payouts (creator_id, created_at desc);
create index if not exists payouts_status_idx on payouts (status);

-- =========================================================================
-- Row Level Security
-- All client queries will use the anon key. Server actions use the
-- service_role key (which bypasses RLS) for trusted writes.
-- =========================================================================

alter table creators enable row level security;
alter table campaigns enable row level security;
alter table creator_campaign_codes enable row level security;
alter table clips enable row level security;
alter table view_snapshots enable row level security;
alter table payouts enable row level security;

-- Campaigns: public read (anon can list them).
drop policy if exists campaigns_public_read on campaigns;
create policy campaigns_public_read
  on campaigns for select using (true);

-- Everything else: NO anon access. Only service_role (bypasses RLS) writes.
-- The frontend talks to Supabase only via server actions, never directly.
-- If you later need direct client reads, add policies here.

-- =========================================================================
-- Seed: Nerdos.fun campaign
-- =========================================================================
insert into campaigns (
  slug, product_name, short_description, long_description,
  script_markdown, instructions_markdown,
  rate_per_view_usd, max_payout_per_clip_usd, total_budget_usd, spent_usd,
  platforms, status
) values (
  'nerdos-fun',
  'Nerdos.fun',
  'A daily game where curious people compete and win rewards.',
  'Nerdos.fun is a daily game for nerds. You answer quick questions, compete with other players and earn real rewards. New questions drop every day.',
  E'I found a daily game for nerds where you answer quick questions, compete with other players and earn real rewards.\n\nIt''s called **Nerdos.fun**.\n\nYou can play once a day, and if you''re sharp enough, you can win.',
  E'1. Make it feel like you, not an ad.\n2. Hook in the first 2 seconds.\n3. We''ll give you a unique code to drop in your caption — that''s how we link the post to you.\n4. Post on Instagram or TikTok, then drop the link.',
  0.010000,
  20.00,
  100.00,
  24.00,
  array['instagram', 'tiktok']::text[],
  'active'
)
on conflict (slug) do nothing;
