# Clippa

**Make clips. Get paid.**

Make clips for products on Instagram or TikTok. Earn stablecoin for every view.

---

## What is Clippa?

A pay-per-view creator platform. Creators sign up, pick a campaign, post a short clip on Instagram or TikTok with a unique code in the caption, and earn stablecoin on Celo for every verified view.

Status: **work in progress** — hackathon MVP.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | Tailwind 4, shadcn/ui, motion, recharts |
| Brand | Bricolage Grotesque + Inter, sticker-pop palette |
| Auth + wallets | [Privy](https://privy.io) (email login + embedded EVM wallet) |
| DB | [Supabase](https://supabase.com) (Postgres) |
| Payments | [Celo](https://celo.org) + USDT, paid via Privy server wallet (CIP-64 — gas paid in USDT) |
| View scraping | [Apify](https://apify.com) (TikTok + Instagram actors) |

## Local setup

1. Clone + install:
   ```bash
   pnpm install
   ```

2. Copy `.env.example` (TODO: add one) or fill these in `.env`:

   ```bash
   # Privy
   PRIVY_APP_ID=
   PRIVY_APP_SECRET=
   NEXT_PUBLIC_PRIVY_APP_ID=

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_SECRET_KEY=

   # Apify (used for both IG and TikTok scraping)
   APIFY_API_TOKEN=

   # Admin gate (CSV of emails)
   ADMIN_EMAILS=you@example.com
   NEXT_PUBLIC_ADMIN_EMAILS=you@example.com

   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_USE_TESTNET=true
   ```

3. Apply the Supabase schema:
   - Open Supabase SQL Editor
   - Paste contents of `supabase/migrations/0001_initial.sql`
   - Run

4. Dev:
   ```bash
   pnpm dev
   ```
   Open http://localhost:3000.

## Project structure

```
app/
  page.tsx                 Landing
  app/
    page.tsx               Authenticated home (balance + clips + campaigns)
    campaigns/[slug]/      Campaign detail + submit form
    clips/[id]/            Clip detail (views chart + payouts)
  admin/                   Admin review queue + ops dashboard
  onboarding/              Country picker
  api/
    scrape/                On-demand scrape (used by admin refresh)
    clips/validate/        Pre-submit caption validation
components/
  ui/                      shadcn customized for the sticker theme
  ...
lib/
  actions/                 Server actions (Supabase + Privy + scrape)
  scrapers/                Apify adapters per platform
  supabase/server.ts       Service-role Supabase client
  auth-server.ts           Privy token verification + creator upsert
  campaigns.ts, clips.ts, onboarding.ts   Types + pure helpers
supabase/migrations/       SQL schema + seed
```

## Flow at a glance

```
1. Sign up with email (Privy) → embedded EVM wallet created on Celo
2. Pick a campaign → get a unique CLIPPA-XXXX tracking code
3. Post on IG or TikTok with the code in the caption
4. Submit the link → server validates caption + URL with Apify scrape
5. Admin approves the clip in /admin
6. Cron refreshes views (Apify) → balance grows
7. Payout agent sends USDT on Celo (in progress)
```

## Why "Make clips. Get paid."

Most creator-payout platforms hide the simple promise behind crypto jargon. Clippa keeps the wallet, the chain, and the USDT invisible — the creator just sees `Your balance: $X`. Stablecoins on Celo are the rail, not the product.

## License

MIT.
