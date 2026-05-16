-- Multi-language campaign content.
--
-- A campaign is written in one source language (declared by the brand at
-- creation time). On activation, we auto-translate the user-facing copy
-- to every other locale the app supports, cached in campaign_translations.
-- Creators see the campaign in their UI locale if a translation exists;
-- otherwise we fall back to the source language.
--
-- `source_language` and `language` are plain text — not enums — so adding
-- a new locale (e.g. 'pt') doesn't require a schema migration; only the
-- code's SUPPORTED_LOCALES list and a one-off backfill of existing rows.

alter table campaigns
  add column if not exists source_language text not null default 'en';

create table if not exists campaign_translations (
  campaign_id            uuid not null references campaigns(id) on delete cascade,
  language               text not null,
  product_name           text not null,
  short_description      text not null,
  long_description       text not null,
  script_markdown        text not null,
  instructions_markdown  text not null,
  created_at             timestamptz not null default now(),
  primary key (campaign_id, language)
);

create index if not exists campaign_translations_language_idx
  on campaign_translations (language);
