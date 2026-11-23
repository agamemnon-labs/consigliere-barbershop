# Consigliere Barbershop — Design Doc

Status: v2.1, 2026-11-23. Design language replaced with the daylight barbershop look (see §8). v2.0, 2026-11-22: stack re-audited from scratch (see §1). Earlier: v1.2 folded in birthday scope, durations, queue-now booking, refund/credit policy, repo. Source of truth for decisions is `consigliere-brief.md`; this doc says **how** we build it. Owner of technical decisions: Claude (full control granted by Nopal, 2026-11-22).

---

## 1. Stack audit (v2.0, 2026-11-22)

Nopal asked for a no-sunk-cost review of v1.2 against the best current tooling. Versions were checked on npm on 2026-11-22; ecosystem state was checked on the web the same day. Result: the shape (one TypeScript app on Vercel + managed Postgres) survives; the auth layer, UI kit and payment gateway changed.

| Area | v1.2 said | v2.0 decision | Why |
|---|---|---|---|
| Framework | Next.js App Router | **Next.js 16.4** (App Router, Turbopack, Cache Components, React Compiler, typed routes, `proxy.ts`) | Still the strongest full-stack React framework; Cache Components gives a static shell + streamed dynamic parts, ideal for a fast phone site. |
| React | React | **React 19.3** with the React Compiler | No manual memoisation; `useActionState` / `useOptimistic` for one-tap cashier actions. |
| Language | TypeScript strict | **TypeScript 7.0** (native Go compiler), strict + `noUncheckedIndexedAccess` | ~10x faster type checks; Next 16.4 runs the `tsc` CLI so TS 7 is supported. |
| Runtime | (unspecified) | **Node 26 LTS** (`engines`, `.node-version`) | Current LTS, supported on Vercel; runs `.ts` scripts natively (seed needs no tsx). |
| Package manager | pnpm | **pnpm 12** | Kept. Exact versions saved (`saveExact`). |
| Lint/format | (unspecified) | **Biome 2.6** | One fast tool for lint + format; replaces ESLint + Prettier. |
| Styling | Tailwind + shadcn/ui | **Tailwind CSS 4.3** with our own token system and **own components**; **Base UI** headless primitives only when a widget needs real a11y behaviour (dialog, combobox) | shadcn's default look is the most recognisable "generated" aesthetic. Our components are few and brand-specific. |
| Database | Supabase Postgres | **Supabase Postgres** (Singapore) | Kept. Reporting, ledgers and money need SQL and transactions. Convex was considered (reactive by default, great DX) but loses on SQL reporting, RLS and portability (pg_dump vs rewriting functions). |
| ORM | Drizzle | **Drizzle ORM 0.45** (stable), move to 1.0 once it leaves RC | 1.0 is at rc.6; we don't ship RCs. Schema uses `casing: "snake_case"`. |
| Realtime | Supabase Realtime, Postgres Changes | **Supabase Realtime Broadcast from Database** (trigger → `realtime.send` → one public topic per branch, `queue:<branchId>`, whose payload is only "something changed"; clients refetch through the server) | Supabase now recommends Broadcast over Postgres Changes; it scales and keeps tables private. No PII ever crosses the socket, so the topic can be public. Poll fallback every 15 s stays. |
| Auth | Own small auth layer, argon2 | **Better Auth 1.7** (Drizzle adapter, DB-backed rate limits). Staff: email + password. Members (phase 6): phone-number plugin, phone + 6-digit PIN, WhatsApp OTP for a forgotten PIN | Maintained, audited sessions/cookies/CSRF/rate limiting instead of hand-rolled crypto. Plugin covers phone login and OTP. Password hashing: Better Auth's scrypt. |
| Validation | (unspecified) | **Zod 4** | Forms, env, webhooks. |
| Payments | Midtrans QRIS sandbox | **Xendit** (QRIS, test mode) behind a `PaymentProvider` interface | API-first, clean REST + webhooks with callback token, test-mode QR payment simulation, refunds by API, and payouts later (barber commission). QRIS MDR is regulated (0.7%) so cost is equal. Midtrans stays a drop-in alternative. Built in phase 4 against Payments API v3 (`POST /v3/payment_requests`, `channel_code: QRIS`, `api-version 2024-11-11`); needs a live check with real test keys before launch. |
| Testing | Vitest + Playwright | **Vitest 5** (domain + DB tests on **PGlite**, real migrations, no Docker) + **Playwright 1.65** (phone + desktop projects) | Every migration and the seed are tested on a real Postgres engine in-process. |
| CI | (unspecified) | GitHub Actions: check, typecheck, unit, build, e2e on every PR | |
| Hosting | Vercel + Supabase | **Vercel (Node 26) + Supabase**, region Singapore | Kept. Free tiers cover the demo. |

Laravel and split SPA + API stay rejected for the reasons in v1.2 (more ops, two codebases, no gain for one brand with 3 branches).

**Payments in the portfolio version:** real gateway in test mode. The QRIS checkout, webhook, pay-then-queue are real; no money moves. A "Mode demo, tanpa uang sungguhan" ribbon shows with test keys. EDC payments at the cashier are recorded manually.

---

## 2. Stack details

- **App:** one Next.js app, role-based route groups, Server Components by default, Server Actions for mutations, Route Handlers only for webhooks and auth.
- **Data access:** server-only modules (`import "server-only"`), Drizzle over postgres.js with the Supabase transaction pooler (`prepare: false`). Every table has **RLS enabled with no policies**: the anon key can read nothing; the server connects as owner. Realtime needs no table policies: the broadcast carries no data, and clients refetch through the server.
- **Auth:** Better Auth, cookie prefix `consigliere`. `proxy.ts` does an optimistic cookie check for `/kasir` and `/admin`; the real role check is `requireStaff()` on the server, inside a Suspense boundary (Cache Components rule). Public sign-up is off; staff are created by the owner. Sign-in is limited to 5 tries per 15 min (DB-backed so it holds across serverless instances). The counter tablet is a public, read-only URL that shows ticket numbers only (never names), so it needs no login; `display_devices` stays for a later TV pairing flow if needed.
- **Payments:** `src/server/payments` exposes a `PaymentProvider` (create QRIS, simulate in test mode). Xendit is used when `XENDIT_SECRET_KEY` is set; otherwise a demo provider issues an unpayable QR and a "Simulasikan pembayaran" button settles the booking directly. The webhook is `POST /api/pembayaran/xendit`, verified with `x-callback-token` (`XENDIT_WEBHOOK_TOKEN`); `payment.capture` with status `SUCCEEDED` settles the booking whose id is the `reference_id`. The customer's ticket page is `/tiket/<bookingId>`. Safety net for a missed webhook: before a page expires an unpaid charge it asks Xendit (`GET /v3/payment_requests/{id}`), and a daily cron (`/api/pembayaran/cek`, 23.45 WITA, `CRON_SECRET`) sweeps the last 24 hours; on Vercel Pro make that every 5 minutes. Money paid inside the 15-minute window keeps its place if the news arrives up to 30 minutes late (`paidInTime`); otherwise it becomes credit.
- **Realtime:** Broadcast from Database. A trigger on `queue_entries` and `barber_shifts` calls `realtime.send` on topic `queue:<branchId>` (event `changed`, payload `{branchId, at}`). The client (`LiveRefresh`) calls `router.refresh()` on each event, polls every 60 s while live and every 15 s when the socket is down or Supabase isn't configured, and refreshes when the tab comes back. The trigger is a no-op where the `realtime` schema doesn't exist (PGlite demo and tests).
- **WhatsApp messages** (OTP, "2 orang lagi"): `Notifier` interface; demo writes to `outbox`, viewable in admin.
- **QR member card:** signed, rotating token (not the raw member number).
- **Demo database:** with no `DATABASE_URL`, the app boots an in-memory Postgres (PGlite) with the real migrations and the demo seed (`src/db/demo.ts`). Local dev, CI e2e and a zero-config preview work without Supabase; data resets on restart, so production always sets `DATABASE_URL`.
- **Caching:** public reads in `src/server/catalog.ts` use `use cache` with tags `catalog` and `rotation`; "today" is a cached WITA date that refreshes every minute.
- **Time:** all "today" logic in `Asia/Makassar` (WITA) via `src/domain/time.ts`.
- **Brand config:** `src/config/brand.ts` (name, city, WhatsApp, credits). Colours are CSS tokens in `globals.css`.

---

## 3. One app, four views

| Route group | Who | Device | Notes |
|---|---|---|---|
| `/` (customer) | Public + members | Phone | Home → branches & live queue → services → barbers → book & pay → member area |
| `/kasir` | Cashier | Desktop, wide | One column per barber on duty; call / done / skip; add walk-in; scan member; record payment |
| `/tablet/[branch]` | Nobody (display) | Tablet at counter | Read-only queue per barber + estimated wait; auto-reconnect; no input |
| `/admin` | Admin, owner | Desktop-first, responsive | Full back office (see §6) |
| `/tv/[branch]` | Display | TV | Optional thin queue strip, off by default (admin setting) |

Roles: `customer`, `member`, `cashier`, `admin`, `owner`, `display`. Owner = admin + finance reports + settings. Cashier is scoped to one branch per shift.

---

## 4. Data model (core tables)

> v2.0: the real schema lives in `src/db/schema.ts` (Drizzle) and is the source of truth; the sketch below is the original plan. Changes since: auth tables are Better Auth's (`users` with `role` member/cashier/admin/owner and `branch_id`, `sessions`, `accounts` holding the password/PIN hash, `verifications`, `rate_limits`); `members` links to `users` instead of storing a PIN hash; added `display_devices`, `closures` (holiday closures, per branch or all), `outbox`, `queue_entries.ticket_no` (per branch per day) and `estimated_min`, `barber_levels.commission_bps`, `service_variants.duration_min`. Money is integer rupiah everywhere.


```
branches(id, name, address, maps_url, open_hours, is_active)
barber_levels(id, name, haircut_price, sort)            -- Regular 80K … Executive 125K
barbers(id, name, photo, level_id, bio, is_active)
barber_level_history(barber_id, level_id, effective_from)
barber_shifts(id, barber_id, branch_id, date, start, end, status)   -- daily rotation; day off = no row / status=off
services(id, category, name, description, duration_min,   -- admin-editable, drives wait estimates
         price_type, price, price_from, is_active)
   -- category: haircut | chemical | refreshment | package
   -- price_type: fixed | from | by_level (haircut) | variant
service_variants(id, service_id, name, price)           -- short/long
package_items(package_id, service_id)
customers(id, name, phone, created_at)                  -- booking without account still creates one
members(id, customer_id, member_no, dob, pin_hash, joined_at, status)
queue_entries(id, branch_id, barber_id, date, position, customer_id, source[online|walkin],
              status[waiting|called|in_service|done|no_show|cancelled],
              called_at, grace_until, late_moves, booking_id)
bookings(id, customer_id, branch_id, barber_id, services, amount, status[pending|paid|expired|credited|refunded], payment_id, expires_at)
credit_ledger(phone, delta, reason[cancel|no_show|spend|expire|manual], booking_id, expires_at, created_at)  -- 30-day credit tied to WhatsApp number
transactions(id, branch_id, barber_id, customer_id, member_id, items, subtotal, discounts, total,
             method[edc_card|edc_qris|online_qris|balance|credit|mixed], cashier_id, created_at)
point_ledger(member_id, delta, reason, transaction_id, created_at)
balance_ledger(member_id, delta, reason[topup|bonus|spend|refund|adjust], ref, created_at)
topup_packages(id, pay, get, is_active)                 -- 300K→330K, 500K→575K
settings(key, value)                                     -- birthday discount scope, grace minutes, TV strip, etc.
audit_log(actor_id, action, entity, before, after, created_at)
```

Balances and points are **ledgers** (sum of rows), never a single mutable number. Every admin edit (including member numbers) writes `audit_log`.

---

## 5. Key rules (shared `domain/` module, unit tested)

**Queue**
- One queue per barber per day; online and walk-in share it, ordered by `position`.
- Online booking is **"queue now" only**: no clock-time slots, because walk-ins share the same queue. After paying, the customer sees their position, the estimated turn time and a "leave now" hint based on that estimate. A WhatsApp/web alert goes out when **2 people are ahead**.
- Online: customer picks branch → barber (or "any barber, shortest wait") → services → name + WhatsApp → QRIS. A `pending` booking holds no queue spot. Spot is created **only on paid webhook**. Pending expires after 15 min.
  - "Any barber" is resolved when booking, to the shortest line, so the haircut price (by level) is known before paying.
  - "From"-priced services (coloring) are not sold online; their price is set at the counter.
  - One unpaid booking per phone at a time (asking again returns the same QR); at most 4 bookings per phone per day.
  - Settlement is idempotent and checks payment id and amount. Money that arrives after a booking expired becomes 30-day credit on the phone number instead of a place in line.
  - The public demo (no `DATABASE_URL`) waives opening hours for online booking, with a visible note, so visitors can try it at any hour.
- Walk-in: cashier taps "+ Walk-in" on the barber column (name optional, WhatsApp optional for "your turn" ping).
- Call: cashier taps **Call** on the top entry → `called`, `grace_until = now + 5 min`. Customer phone and tablet highlight it.
- Late: when grace ends and the customer is not there, cashier taps **Late** (or it auto-triggers) → entry swaps with the next one (moves back exactly **one** position), `late_moves += 1`.
- Absent again at the **second call** → `no_show`. A prepaid no-show becomes 30-day credit (see Refunds).
- Done: cashier taps **Done** → opens the payment panel for walk-ins, or closes it for prepaid online bookings (extra services added on the spot are charged at the counter).
- Estimated wait = sum of remaining service durations ahead + remaining time of the current cut. Shown as "± 25 min" plus an approximate turn time ("sekitar 14.40"), never a guaranteed slot.
- Default durations (admin-editable): haircut 30 (real range 25–45), toning 60, coloring fashion 120, curly perm short 90 / long 120, cold wave short 120 / long 150, rootlift 45, down perm 60, Rootlift + Down Perm package 90, classic shaving 20, wash & styling 15, other refreshments 15 (ear candle 15, nose mask 10). Later: learn each barber's real average from `called_at`/done times.

**Opening hours and closures**
- All branches open 10:00–21:00 every day. Holiday closures (Lebaran, Natal…) are set by admin in `closures` (one branch or all) and show as a banner on customer pages and the tablet.
- The online queue stops taking numbers 45 min before closing (admin setting `online_queue_closes_before_min`) and when the barber's remaining queue would run past closing.

**Refunds and credit**
- Customer cancels before being called, or is a no-show (absent at the second call):
  - **Member** (WhatsApp number matches a member) → amount goes to their **prepaid balance** (`balance_ledger`, reason `refund`), **no expiry**.
  - **Non-member** → **credit tied to the WhatsApp number**, valid 30 days, usable at any branch (online booking or at the cashier).
- No automatic cash refund. Admin can issue a manual refund (e.g. after a WhatsApp complaint), logged in `audit_log`.
- Barber or shop cancels → **full refund** (gateway refund in sandbox; manual in production if the gateway can't).
- Credit (non-members) works without an account and expires; balance (members) never expires. If a non-member signs up while holding credit, the remaining credit moves into their balance.

**Pricing**
- Haircut price comes from the barber's **level at service date**. Other services use fixed / from / variant price. "From" services get their final price entered by the cashier.

**Membership**
- Sign-up 30K (paid at cashier or QRIS). Card shows QR, member no, points, balance.
- Points: `floor(total_paid / 50_000)` per transaction. Redeem 10 points = 50K off.
- Birthday month: 50% off **haircut only** (default, matches the real shop); scope is still an admin setting. Does not stack with point redemption in the same transaction (simplest rule; admin can change).
- Points are earned on the amount actually paid after discounts, excluding top-ups.
- Top-up: package from `topup_packages`; bonus written as a separate `bonus` ledger row so reports can split real cash from bonus.

**Payment recording**
- EDC (card or QRIS): cashier selects method, enters amount, taps **Mark paid**. No integration with the EDC machine.
  - Built as **Selesai & bayar** under the chair: the haircut is on the bill already (priced by the barber's level), other services are added from a list, "from" services take a typed price (at least the list price, at most 5 million). One tap on **Lunas** records the transaction and finishes the queue entry in one database transaction; a chair can't be paid twice.
  - Prepaid online customers get a plain **Selesai**, plus **Selesai + tagih tambahan** for services added on the spot.
  - Credit: the cashier types the WhatsApp number and taps **Cek kredit**; credit pays first, the rest goes to the EDC (`method` credit or mixed). Spends are linked to the transaction (`credit_ledger.transaction_id`) and use the credit that expires first.
  - The cashier screen shows today's takings by method (online QRIS counted on the day it was paid) and the last receipts. Receipts (`/kasir/struk/<id>`) print on 58 mm thermal paper through the browser.
- Online QRIS: gateway webhook only. Cashier cannot mark an online booking paid.
- Balance: deducted from ledger after PIN confirmation on the cashier screen (member types PIN on a small keypad or scans QR + PIN).

---

## 6. Admin back office (v1 scope)

- **Today** (also the phone view for the owner): revenue per branch, customers served, queue length now, barbers on duty.
- **Services & prices:** categories, variants, packages, "from" prices, descriptions, active toggle.
- **Barbers:** profile, level promotions (with effective date), active toggle.
- **Rotation:** week grid of barbers × days, cell = branch or OFF. Copy last week. Drives everything customer-facing.
- **Members:** search, edit (incl. member number), point and balance history, manual adjustment with reason.
- **Rules:** top-up packages, birthday scope, points ratio, grace minutes, service durations, credit validity days, TV strip toggle.
- **Credits & refunds:** open credits per phone number, expiries, manual refund with reason.
- **Reports:** revenue by branch / barber / service / payment method, customer counts, top-up cash vs bonus liability, date range, CSV export.
- **Staff accounts** and tablet device tokens.
- **Outbox:** WhatsApp messages sent (demo).

---

## 7. Build order

Each phase ends deployed and usable.

1. **Foundation** ✅ — repo, CLAUDE.md, brand config, design tokens + three themes + `/gaya` style sheet, staff auth (Better Auth), DB schema + migrations + seed (3 fictional Samarinda branches, 12 barbers, full real pricelist, 14 days of rotation, demo staff), CI. Public home renders the pricelist from seed data until phase 2.
2. **Public read-only site** ✅ — services & prices, branches, barbers with level/today's branch/days off. (Covers the "shy" and "loyal" personas already.)
3. **Queue core** ✅ — cashier screen (columns, call/done/late, add walk-in), tablet display, live queue on the phone. Realtime. *This is the heart; demo-able on its own.*
4. **Online booking + QRIS (sandbox)** ✅ — booking flow, webhook, pay-then-queue, expiry.
5. **Cashier payments** ✅ — EDC recording, transactions, receipts.
6. **Membership** ✅ — sign-up at the counter (`/kasir/member`), phone + PIN login (`/masuk`), QR card on the phone (`/kartu`), points, birthday discount, balance + counter top-up, forgot-PIN code (`/masuk/lupa-pin`, via the WhatsApp outbox). The cashier's checkout takes a card number (scanner types it + Enter) or a WhatsApp number and offers the perks the member qualifies for; paying from balance needs the member's PIN, and 5 wrong PINs lock the card for 15 minutes. Today's takings count only new money (EDC + online QRIS); balance and credit spent are shown apart. Phone top-up by QRIS (`/kartu/isi`, table `topup_orders`) reuses the booking QRIS adapter; the Xendit webhook settles whichever booking or top-up the reference names.
7. **Admin back office** ✅ — `/admin` sections:
   - Hari ini: per branch, money in, served, in line now and barbers on duty; phone-sized for the owner.
   - Laporan: a date range with money in, service sales, visits, barber commission, per branch, top services, payment methods, and member money (fees, top-ups, bonus given, balance held, open credit). CSV export of every sale or of the commission.
   - Rotasi: a week grid with "salin dari minggu lalu".
   - Harga: haircut price and commission per level, plus every service's price, variants, duration and on/off.
   - Barber: level change from a date (history kept, so commission on past sales never changes) and active toggle.
   - Member: search, edit name, number and status, and points/balance correction with a reason.
   - Aturan: fee, points, birthday, queue and credit timings, other-service commission, and top-up packages.
   - Pesan: the WhatsApp outbox, with one-time codes masked even for admins.
   - Every change writes the audit log; price and rotation edits refresh the public site at once (`updateTag`).
   - Commission is paid on what the shop earned per service (price minus discount): haircuts at the barber's level share on the day of the sale, everything else at the flat share from Aturan.
   - Deferred: staff accounts and tablet tokens (the tablet is public and needs none), credits & refunds screen.
8. **Polish & portfolio** ✅ — demo ribbon on customer and staff screens (`DEMO_MODE`, always on without a database), one-tap demo logins at `/demo` (member, cashier, owner; customer and tablet need none), nightly demo reset by Vercel Cron (`/api/demo/reset`, bearer `CRON_SECRET`), four weeks of seeded sales, case study at `/studi-kasus` (linked from the credits), favicon, `faint` colour raised to pass WCAG AA. Lighthouse on mobile: performance 91–98, accessibility, best practices and SEO 100 on public pages (noindex pages score SEO 60 by design).

Phases 1–3 are the MVP that proves the idea.

---

## 8. Design language

**An old-school barbershop in daylight** (v2, 2026-11-23). White tiles, the red-white-blue barber pole, mint barber chairs, chrome and take-a-number tickets. Light everywhere, modern and friendly; the gangster brand lives in the names, the pinstripe member card and the voice, not in a dark costume. The first look (dark, Bodoni serif, oxblood, "tailor shop / film credits") was dropped because Nopal found it dull, text-heavy and confusing. Live reference: `/gaya` in the app.

- **Colour** (CSS tokens in `src/app/globals.css`, one light theme):
  - Neutrals: page `#F3F5F8`, surface white, sunk `#E9EDF3`, navy ink `#0E1630`, muted and faint inks that pass 4.5:1.
  - Pole red `#D22D23` is the one action colour: the primary button, the ticket number, money, the call action, errors. One red button per screen at most.
  - Meaning colours, each with a soft fill and a readable ink: blue (selected, focus, links), mint (free chair, paid, done), butter (called, needs attention).
  - Navy pinstripe (`.pinstripe`): the member card and the dark "Lanjut" button for non-money steps.
  - The counter tablet uses `data-theme="display"`: the same palette on a pure white page for reading from across the room.
  - Banned: dark pages, gradients, gold/brass, neon, glow, glassmorphism, emoji, stock illustration, drop shadows, pill buttons.
- **Type:** Archivo variable, one family for everything. The wordmark runs at width 125%; headings are 600 at about 110%; ticket numbers are condensed (72%); every number is tabular. Sentence case everywhere, no tracked capitals.
- **Shape:** controls `rounded-xl`, cards `rounded-2xl`, hero and member card `rounded-3xl`. Hairline rules only between rows of a list. No shadows: surfaces separate by tone (white on cool grey).
- **Signature pieces:** the red take-a-number ticket (notched, with a tear line) for the queue number; the striped barber pole that turns while something is live; the navy pinstripe member card with its QR; barbers as coloured initial tiles.
- **Flow:** one job per screen. Booking is four steps with a progress bar (cabang, barber, layanan, nama + bayar) and a fixed bottom bar showing the total and the one next action. Detail folds behind native `<details>` that open downward.
- **Layout:** phone-first single column (max ~28 rem), vertical only, no carousels or sideways swipes. Tap targets ≥ 48 px. A bottom tab bar (Beranda, Ambil nomor or Tiketku once you hold a ticket, Member) hides inside flows.
- **Cashier:** wide desktop, one column per barber on duty, the chair state on top (mint = free, butter = in the chair), the line below, one tap per action. **Admin:** the same white shell with tabs; reports use single-hue blue bars with values in text. **Tablet/TV:** very large type, no inputs, a QR to take a number.
- **Copy:** Indonesian, plain and warm, few words. Headlines are questions or plain statements ("Mau dicukur siapa?", "Kamu di antrean, Bima").

---

## 9. Risks & notes

- **Stored value (balance):** before any real use, check Bank Indonesia rules on stored value / e-money (closed-loop limits). Portfolio is fine.
- **WhatsApp:** real OTP/notifications need a provider (WhatsApp Cloud API or a local gateway) and a verified number. Interface is ready; demo uses on-screen OTP.
- **Clock and day boundaries:** all "today" logic in WITA, queue resets at close.
- **Abuse:** booking rate limit per phone number; payment required before queue spot blocks fake bookings.
- **Realtime drop:** tablet and cashier show a "reconnecting" badge and fall back to polling.

---

## 10. Repo conventions

- Repo: **github.com/agamemnon-labs/consigliere-barbershop** (org repo). Single app, no monorepo. Package manager: pnpm 12. See the repo's `CLAUDE.md` for commands and rules.
- Commit small and often while working, push to the org repo under Nopal's GitHub account. Conventional commit messages (`feat:`, `fix:`, `chore:`...). Each build phase goes on its own branch with a PR into `main`.
- `src/domain/` pure business rules (queue, pricing, points, balance) with tests; UI never re-implements them.
- Route groups: `src/app/(customer)` (phone web with bottom tabs) and `src/app/(staff)` (`/staf/masuk`, `/kasir`, `/admin`, shared `StaffShell`); `(display)` (`data-theme="display"`) for `/tablet/[branch]`. One root layout, one light theme.
- A `CLAUDE.md` at the root pointing to the brief and this doc, with "log every change Nopal makes in the brief's change log".
