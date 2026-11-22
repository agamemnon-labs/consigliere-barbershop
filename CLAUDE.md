# Consigliere — rules for working in this repo

Barbershop queue, booking and membership system. One fictional brand, three branches in Samarinda, one app with role-based views (customer phone web, cashier desktop, counter tablet, admin back office). A portfolio piece by Agamemnon that should genuinely work.

## Read first

- `docs/brief.md` — what and why. Decisions there are final unless Nopal changes them. **Log every change Nopal makes in its change log.**
- `docs/design.md` — how we build it: stack, data model, rules, build phases, design language.
- These are mirrored from the project's shared files (`consigliere-brief.md`, `consigliere-design.md`). Update both when you change one.
- Next.js 16 differs from older training data. Read `node_modules/next/dist/docs/` before using an API you are not sure of (see `AGENTS.md`).

## Commits and authorship (strict)

- Commits are authored and committed as **Naufal Fahrozi <147592190+NaufalFahrozi@users.noreply.github.com>** (GitHub `NaufalFahrozi`). Set it per repo: `git config user.name "Naufal Fahrozi"` and `git config user.email "147592190+NaufalFahrozi@users.noreply.github.com"`.
- **No AI attribution anywhere in the repo**: no `Co-Authored-By` trailers, no session links, no "Generated with …" lines in commits, PR titles or PR bodies.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Small and often. Each build phase on its own branch with one PR into `main`.

## Stack (checked 2026-11-22; check npm before upgrading, never downgrade to something older)

Next.js 16.4 (App Router, Turbopack, Cache Components, React Compiler, typed routes, `proxy.ts`) · React 19.3 · TypeScript 7 strict · Node 26 · pnpm 12 · Tailwind CSS 4.3 · Biome 2.6 · Drizzle ORM 0.45 on Supabase Postgres · Better Auth 1.7 · Zod 4 · Vitest 5 + PGlite · Playwright 1.65.

## Commands

```
pnpm dev            # http://localhost:3000, /gaya is the live style sheet
pnpm check          # Biome lint + format check (pnpm check:fix to apply)
pnpm typecheck      # route types + tsc
pnpm test           # Vitest: domain rules, migrations + seed + auth on PGlite
pnpm e2e            # Playwright against `pnpm start` (run `pnpm build` first)
pnpm db:generate    # SQL migration from src/db/schema.ts
pnpm db:migrate     # apply migrations (DATABASE_URL_DIRECT)
pnpm db:seed        # reset demo data
```
All four of check, typecheck, test and build must pass before a push. CI runs them plus e2e on every PR.

## Code rules

- **Business rules live in `src/domain/`** as pure, tested functions (queue, pricing, points, balance, time). UI and actions call them; they never re-implement them.
- Money is **integer rupiah**. Points and balances are **ledgers** (sum of rows), never a mutable number.
- All "today" logic uses WITA (`Asia/Makassar`) through `src/domain/time.ts`.
- Database code is server-only (`import "server-only"`). Every table has RLS on; add policies deliberately.
- Schema changes: edit `src/db/schema.ts`, run `pnpm db:generate`, commit the SQL. Never edit an applied migration.
- Session reads (`requireStaff`, `getStaff`) happen inside a `<Suspense>` boundary (Cache Components rule). `proxy.ts` is only an optimistic cookie check.
- Brand facts come from `src/config/brand.ts`; nothing brand-specific elsewhere.
- Copy is Indonesian, plain and warm.

## Design rules (Nopal hates anything that looks AI-generated)

- Quiet, editorial "old tailor shop / 70s film credits". See `/gaya` and `docs/design.md` §8.
- Use the tokens in `src/app/globals.css` (`bg`, `surface`, `fg`, `muted`, `faint`, `rule`, `accent`, `accent-ink`…) and the themes `night` (customer), `paper` (cashier/admin), `display` (tablet/TV). No raw hex in components.
- One oxblood accent, used sparingly (ticket number, money actions, call action, errors).
- **Banned:** gradients, gold/brass, neon, glow, glassmorphism, drop shadows, pill buttons, emoji, stock illustrations, default shadcn look, lucide icon confetti, centred-hero-with-three-feature-cards layouts.
- Phone-first, vertical only: no carousels, no sideways swipe; details expand downward. Tap targets ≥ 48 px.
- Fonts: Bodoni Moda (display), Libre Franklin (text), IBM Plex Mono (numbers, tabular).
- **User friendly is a hard requirement.** One job per screen, little text, nothing overwhelming. Say it in fewer words; hide detail behind a tap (`<details>`) instead of printing it. If a screen feels full, cut before adding.
- Research notes and sources: `docs/design-research.md`.
- UI work follows **unslop** (github.com/heydamir/unslop by Damir Sokolovsky, CC BY 4.0) as the design checklist, on top of the design skills (frontend-design, design-skills:design-elevation / design-critique / ux-writing, accessibility-audit). Review screenshots before shipping. Its rules that matter most here:
  - Sentence-case labels, not UPPERCASE with wide tracking.
  - No italic for emphasis.
  - Spacing on a 4px grid.
  - Weights 400–500.
  - One accent used rarely.
  - One primary and at most one secondary action per screen.
  - No trailing periods on labels and buttons, no exclamation marks.
  - Numbers in one tabular format.
  - Motion only when it explains something.
  - Final check: the screen should only fit this product.
