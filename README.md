# hello-supabase-server

Showcase `@supabase/server` in three runtimes:

- **Supabase Edge Function** (Deno)
- **Vercel Function** on the Bun runtime
- **Cloudflare Worker**

The handler accepts `POST { "name": "MyName" }` with an `apikey` header. [`withSupabase({ auth: "publishable" })`](https://github.com/supabase/server) validates the `apikey` against your project's publishable keys, then `ctx.supabaseAdmin` bypasses RLS to fetch a random localized greeting from the `greetings` table — returns e.g. `Aloha, MyName! (Hawaiian)`.

## Layout

```
packages/handler        the single shared handler
apps/supabase           Supabase Edge Function entrypoint + migrations
apps/vercel             Vercel + Bun entrypoint
apps/cloudflare         Cloudflare Worker entrypoint
scripts/call-all.ts     POSTs to all three deployed URLs
```

## Setup

```sh
pnpm install
cp .env.example .env
```

## Env Variables

`@supabase/server` reads these four at runtime. Supabase Edge Functions auto-provide them — only Vercel and Cloudflare need them set manually.

- `SUPABASE_URL` — `https://<ref>.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` — validated against the inbound `apikey` header
- `SUPABASE_SECRET_KEY` — used by `ctx.supabaseAdmin` (service_role, bypasses RLS)
- `SUPABASE_JWKS` — JWKs for verifying user JWTs

Grab them from Supabase Studio → **Project Settings → API**.

## Database

```sh
pnpm --filter ./apps/supabase exec supabase link --project-ref <project-ref>
pnpm --filter ./apps/supabase exec supabase db push
```

Creates `public.greetings` with RLS enabled, then seeds ~20 languages. anon has the grant but no policy (cannot read any row), authenticated can read all rows, service_role bypasses RLS — that's what `ctx.supabaseAdmin` uses.

## Deploy

```sh
# Supabase (variables provided automatically)
pnpm deploy:supabase

# Vercel (set env in dashboard or via `vercel env add`)
pnpm deploy:vercel

# Cloudflare (set secrets via `wrangler secret put`)
pnpm deploy:cloudflare
```

## Test

Fill in `.env` with the three deployed URLs and the publishable key, then:

```sh
pnpm call
```

Expected output (language is random per call):

```
supabase    200  Aloha, MyName! (Hawaiian)
vercel      200  Hola, MyName! (Spanish)
cloudflare  200  Bonjour, MyName! (French)
```
