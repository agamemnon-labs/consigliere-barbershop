# Consigliere

Queue, booking and membership for a three-branch barbershop in Samarinda. Customers see every price and barber, watch the live queue per barber, take a number and pay by QRIS from their phone. Cashiers run the queue with one tap per action; the counter tablet shows who is next; the owner gets a real back office.

A portfolio piece by **Agamemnon**. The brand is fictional; the pricelist is real.

## Stack

Next.js 16 · React 19 · TypeScript 7 · Tailwind CSS 4 · Supabase Postgres + Realtime · Drizzle ORM · Better Auth · Xendit (QRIS, test mode) · Vitest + PGlite · Playwright · Biome · pnpm · Vercel.

## Run it

```
cp .env.example .env.local   # fill in Supabase + BETTER_AUTH_SECRET
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
```
Open `/` for the customer site, `/gaya` for the style sheet, `/staf/masuk` for staff (demo accounts are in `src/db/seed/data.ts`).

## Docs

- [Brief](docs/brief.md) — what and why
- [Design](docs/design.md) — how: stack, data model, rules, phases, visual language
