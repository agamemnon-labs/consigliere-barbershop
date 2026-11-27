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
- Gotchas learned the hard way:
  - `pnpm typecheck` can pass on a stale `tsconfig.tsbuildinfo`; delete it when a type error "should" appear.
  - A client component that calls `usePathname()` (tabs, bottom nav) must sit inside `<Suspense>` on dynamic routes or the build fails.
  - Path-dependent UI in a shared layout (the customer tabs) renders per request behind `await connection()`. A prerendered copy shipped on Vercel with no tab marked and broke hydration on the live home (React #418).
  - A visually hidden (`sr-only`) input inside a card label needs `relative` on the label, or focus and taps land in the wrong place. In e2e, click the card (`locator("label", { hasText })`), then assert the input is checked.
  - Grid children default to `min-width: auto`, so a `<select>` with long options pushes the grid wider than its column. Use `grid-cols-1` and `min-w-0` on controls.

## Design rules (Nopal hates anything that looks AI-generated)

- **Direction (v3, 2026-11-23): the neighbourhood barbershop of a mob film, in daylight.** Cream wall tiles, kraft-paper claim tickets, sign-painted lettering, a bottle-green pinstripe suit, the red-white-blue pole and a checkered floor. Light and warm everywhere; the gangster side shows in the lettering, the suit-green member card and a light wink in the copy ("Jadi orang dalam", "Keluarga kami"), never in a dark costume. Nopal rejected the dark/serif "tailor shop" look (dull, confusing) and then the cool-white v2 (too plain, generic); do not bring either back. See `/gaya` and `docs/design.md` §8.
- Use the tokens in `src/app/globals.css`: neutrals `bg` `surface` `sunk` `fg` `muted` `faint` `rule` `rule-strong`; `accent` (bottle green) with `accent-ink` `accent-soft`; `danger`/`danger-soft` (errors and destructive states only); meaning colours `blue`/`blue-soft` (selected, focus, links), `mint`/`mint-ink` (free chair, paid, done), `butter`/`butter-ink` (called, attention); `suit` (bottle green) with the `.pinstripe` class (member card, owner's money figure, tablet footer); `.floor` is the checkered tile band (the shop window's foot only). One light theme everywhere; `data-theme="display"` only lightens the tablet page. No raw hex in components.
- **Bottle green (`accent`) is the one action colour**: the primary button, the ticket, money and the call action. One green button per screen at most. Non-money "next" actions use the espresso `dark` button. Blue, mint and butter only carry meaning, never decoration.
- **Red is never brand or decoration (Nopal, 2026-11-27).** Users read red as danger, error or warning. Use `danger` only where UX calls for it: error text, `Notice tone="alert"`, `aria-invalid` borders, failed states, destructive confirmations. "Closed" is muted text, "called" is butter.
- Components to reuse before writing new ones: `Button`/`ButtonLink` (`primary`, `dark`, `quiet`, `soft`), `Choice` (tappable card for radio/checkbox), `Notice` (`info`, `ok`, `warn`, `alert`), `Ticket`, `QrisPanel`, `Pole`, `Avatar`, `Steps`, `Field`, `StaffShell` + `StaffTabs`, icons in `components/icons.tsx` (`Svg` wrapper).
- **Banned:** dark page backgrounds, gradients, gold/brass, neon, glow, glassmorphism, drop shadows, pill buttons, emoji, stock illustrations, default shadcn look, lucide icon confetti, centred-hero-with-three-feature-cards layouts, uppercase tracked eyebrows, middle-dot meta strings, arrows appended to links.
- Phone-first, vertical only: no carousels, no sideways swipe; details expand downward. Tap targets ≥ 48 px (44 px only for secondary inline links). Cards `rounded-2xl`, hero and member card `rounded-3xl`, controls `rounded-xl`.
- Fonts (`src/app/fonts.ts`), two faces with one job each: **Alfa Slab One** (`.slab`, `font-display`) is the sign painter for the wordmark, every `h1` (automatic), the member card name and every ticket number; it has one weight, so never bold it and never use it below ~18 px. **Archivo** does all reading: labels, lists, `h2`/`h3` at 600, prices, buttons; `.condensed` for dense figures, all numbers tabular (`.num`).
- **User friendly is a hard requirement.** One job per screen, little text, nothing overwhelming. Say it in fewer words; hide detail behind a tap (`<details>`) instead of printing it. If a screen feels full, cut before adding.
- Research notes and sources: `docs/design-research.md`.
- **Be proactive.** Research good current frontend, visual and UX practice yourself when it helps, without waiting to be asked. Fix anything that looks bad or sloppy as soon as you see it, in code or design. Record the lessons in `docs/design-research.md` or here.
- UI work follows **unslop** (github.com/heydamir/unslop by Damir Sokolovsky, CC BY 4.0) as the design checklist, on top of the design skills (frontend-design, design-skills:design-elevation / design-critique / ux-writing, accessibility-audit). Review screenshots before shipping. Its rules that matter most here:
  - Sentence-case labels, not UPPERCASE with wide tracking.
  - No italic for emphasis.
  - Spacing on a 4px grid.
  - Weights 400–500 for text; 600 only for headings, the ticket and money figures.
  - One accent used rarely.
  - One primary and at most one secondary action per screen.
  - No trailing periods on labels and buttons, no exclamation marks.
  - Numbers in one tabular format.
  - Motion only when it explains something.
  - Final check: the screen should only fit this product.
