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
  'Nerdos.fun is a daily game where players answer quick questions and win real money. We want creators to show the game in action — make viewers curious enough to try it. The best clips feel like a personal discovery: "wait, I just won money playing this".',
  E'**[hook · 0–3s]**\n\nThis might be the only game on the internet that pays you for actually using your brain.\n\n**[gameplay · 3–15s]**\n\nOpen Nerdos.fun.\nAnswer a few questions live.\nShow the timer, the pressure, your reactions, your score climbing, the rewards.\n\n"This is harder than I expected."\n"No way people are this fast."\n\n**[outro · 15–20s]**\n\nFree to play.\nDaily rewards.\nOnly for nerdos.\n\nTry it now at **Nerdos.fun**.',
  E'**1. Mention Nerdos.fun on screen at least once.**\nName, URL, logo, or "play on Nerdos.fun".\n\n**2. Show real gameplay.**\nCapture the timer, questions, rankings, pressure, reactions, or rewards.\n\n**3. Don''t talk about crypto.**\nSay "money", "cash", "USD", or "rewards" instead.\n\n**4. Don''t fake earnings or unrealistic results.**\nKeep it authentic.\n\n**5. The best videos feel competitive, surprising, or stressful.**\nThink: "How are people this fast?" · "This is harder than it looks." · "I thought this would be easy."',
  0.010000,
  20.00,
  100.00,
  0.00,
  array['instagram', 'tiktok']::text[],
  'active'
)
on conflict (slug) do nothing;
