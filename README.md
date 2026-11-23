# Consigliere

Queue, booking and membership for a three-branch barbershop in Samarinda. Customers see every price and barber, watch the live queue per barber, take a number and pay by QRIS from their phone. Cashiers run the queue with one tap per action; the counter tablet shows who is next; the owner gets a real back office.

A portfolio piece by **Agamemnon**. The brand is fictional; the pricelist is real.

**Live demo:** https://consigliere-barbershop.vercel.app (try any role at `/demo`).

## Stack

Next.js 16 · React 19 · TypeScript 7 · Tailwind CSS 4 · Supabase Postgres + Realtime · Drizzle ORM · Better Auth · Xendit (QRIS, test mode) · Vitest + PGlite · Playwright · Biome · pnpm · Vercel.

## Run it

Without any setup it runs on an in-memory demo database (PGlite) with demo payments:

```
pnpm install
pnpm dev        # http://localhost:3000, /demo for one-tap logins
```

With your own Supabase database:

```
cp .env.example .env.local   # fill in Supabase + BETTER_AUTH_SECRET
pnpm db:migrate && pnpm db:seed
pnpm dev
```
Open `/` for the customer site, `/demo` to try every role, `/studi-kasus` for the case study, `/gaya` for the style sheet, `/staf/masuk` for staff (demo accounts are in `src/db/seed/data.ts`).

## Deploy (Vercel + Supabase)

1. Create a Supabase project (region Singapore) and a login role for the app that owns the tables (it then bypasses RLS; nothing else can read them). Use the pooler with user `<role>.<project-ref>`: port 6543 for `DATABASE_URL`, 5432 for `DATABASE_URL_DIRECT`.
2. Import the repo in Vercel (region `sin1` is set in `vercel.json`). The build runs `pnpm build:deploy`: migrate, seed the demo if the database is empty, then `next build`. Add the variables from `.env.example`: `DATABASE_URL`, `DATABASE_URL_DIRECT`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, the two `NEXT_PUBLIC_SUPABASE_*` keys, and for the public demo `DEMO_MODE=1`, `DEMO_STAFF_PASSWORD` (same as `SEED_STAFF_PASSWORD`) and `CRON_SECRET`.
3. Optional: Xendit development keys (`XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`) and the webhook URL `<origin>/api/pembayaran/xendit`. Without them, payments run in demo mode.
4. After the first migration, make `postgres` own `public.broadcast_queue_change()` (`alter function … owner to postgres`) so it may call `realtime.send`, and revoke `execute` on it from `public, anon, authenticated`.
5. The cron in `vercel.json` calls `/api/demo/reset` at 00.00 WITA to give the demo a fresh day.

Checks before every push: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build`; CI also runs `pnpm e2e`.

## Docs

- [Brief](docs/brief.md) — what and why
- [Design](docs/design.md) — how: stack, data model, rules, phases, visual language
