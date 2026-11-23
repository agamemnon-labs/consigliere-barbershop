# Consigliere Barbershop — Brief

Portfolio project for Agamemnon (Nopal's software house). Brainstorming is done. Build plan chosen and design doc written: see `consigliere-design.md`. **Status:** phase 1 (foundation) built; see the phase 1 PR. Next: phase 2, public read-only site.

## Context
- Fictional brand: **Consigliere** (gangster-film theme). Footer: built by Agamemnon.
- Inspired by the structure of Goodfellas Samarinda (Nopal's own barbershop), but not built for them and does not use their name or logo. No client yet.
- One brand, 3 branches in Samarinda. **Not multi-tenant.** Name, logo, and colors live in one config file.
- Goal: a portfolio piece that could genuinely be used.

## Principles
- People want a barber visit to be effortless (walk in, tell the cashier, sit down). The system adds convenience for those who want it and never makes things harder for those who don't.
- Customer web is **100% mobile-first**: fast, as few steps as possible, vertical top-to-bottom flow, no horizontal swiping, details expand downward when tapped.
- Staff and admin side must be just as easy: one tap per action, so the live queue stays accurate.

## Customer personas
1. **Shy:** wants to see every service, price, and barber without having to ask.
2. **Hates queuing:** wants to see the queue per barber and which branch is quiet, take a queue number and pay from their phone, and arrive right on time.
3. **Walk-in:** checks the queue on the counter tablet, registers at the cashier, leaves (e.g. to eat), comes back for their turn.
4. **Loyal to one barber:** wants to know which branch their barber is at today (barbers rotate between branches) and their days off.
5. **Owner:** wants to modernize and be a pioneer among barbershops.

## Pricing (from a real pricelist)
- **Haircut price depends on barber level:** Regular 80K, Senior 95K, Premium 110K, Executive 125K. A branch can mix levels (e.g. 1 executive, 1 senior, 3 regular).
- **Chemical:** toning 150K, coloring fashion from 300K, curly perm short 400K / long 600K, cold wave short 500K / long 700K, rootlift 90K, down perm 175K.
- **Refreshment:** peel of mask full face 50K, face refreshment 50K, hair refreshment 50K, ear candle 30K, wash & styling 35K, classic shaving 70K, peel of mask nose 25K.
- **Package:** Rootlift + Down Perm 250K.
- Patterns to support: price variants, "starting from" prices, packages, short description per service.
- Cashless only. WhatsApp number for complaints.

## Queue
- One queue per barber; online and walk-in customers share it.
- Online customers must pay first before they enter the queue (no fake bookings). Booking needs no account: name + WhatsApp number.
- If a customer is late when their turn comes: wait 5 minutes, then they move back **one** position only.

## Membership (real barbershop concept, made digital)
- Sign-up 30K: full name, date of birth, phone number, 6-digit PIN. Web login with phone number + PIN; WhatsApp OTP only for a forgotten PIN.
- Digital member card with a QR code the cashier scans.
- 1 point per multiple of 50K; 10 points = 50K off.
- 50% discount in the birthday month, haircuts only (confirmed with a real cashier). Chemical, refreshment and other services are not discounted. Keep it as an admin setting, defaulting to haircut only.
- Prepaid balance: top up 300K → 330K, top up 500K → 575K. Top-up packages and bonuses are set by admin. Top up at the cashier or by QRIS from the phone. Balance history is kept.
- Every membership number is editable by admin.
- If this is ever used for real: check Bank Indonesia rules on stored value / e-money first.

## The four parts of the system
1. **Customer web (phone):** services and prices; barbers per branch with level, schedule, and days off; live queue per barber; take a queue number and pay; member card, points, balance, birthday discount.
2. **Cashier screen (DESKTOP, wide screen):** one column per barber on duty that day; call / done buttons; add walk-in; scan member; take payment.
3. **Counter tablet (faces customers, display only):** queue per barber with estimated wait. No payment screen: payment runs on the EDC machine (card or QRIS), where the cashier enters the amount; the cashier marks it paid in the system.
4. **Admin/owner (desktop-first, still responsive so the owner can check today on a phone):** a real business back office, not just reservations: prices, services, packages; daily barber rotation between branches; days off; barber level promotions; membership and balance rules; revenue reports per branch, barber and service; customer counts; schedules.
- **One system:** one database and backend, with role-based views for customer, cashier, tablet and admin. No separate admin system.
- The barbershop TV keeps playing classy content (music, F1, etc.). A thin queue strip on the TV is optional and off by default.

## Later (not in the first version)
WhatsApp chatbot, hairstyle recommendation from a face photo, multi-tenant.

## Change log
- 2026-11-22: tablet is queue-only (EDC handles payment); admin is desktop-first and responsive, a full back office; one system with role-based views.
- 2026-11-22: Nopal gives Claude full creative and code control of the project.
- 2026-11-22: build plan chosen (Claude): Next.js monolith + Supabase (Postgres, Realtime) on Vercel; payments via Midtrans QRIS in sandbox with a demo-mode ribbon; EDC payments recorded manually. Design doc: consigliere-design.md.
- 2026-11-22: birthday discount is haircut only by default.
- 2026-11-22: code lives in github.com/agamemnon-labs/consigliere-barbershop. Commit and push as Nopal's account throughout the work.
- 2026-11-22: service durations (admin-editable, used for wait estimates): haircut 35 min (range 25–45), toning 60, coloring fashion 120, curly perm short 90 / long 120, cold wave short 120 / long 150, rootlift 45, down perm 60, Rootlift + Down Perm package 90, classic shaving 20, wash & styling 15, other refreshments 15 (ear candle 15, nose mask 10). Later, estimates can learn from each barber's real average.
- 2026-11-22: online booking is "queue now" only, with no clock-time slots, because walk-ins share the queue. Show the estimated turn time plus a "leave now" hint, and send a WhatsApp/web alert when 2 people are ahead.
- 2026-11-22: refund policy: cancelling before being called turns the payment into credit tied to the WhatsApp number, valid 30 days, usable at any branch. Late rule as before (5 min, back 1 spot). Absent again at the second call = no-show, which also becomes 30-day credit. No automatic cash refund; admin can issue a manual refund (e.g. via a WhatsApp complaint). If the barber or shop cancels, there is a full refund.
- 2026-11-22: design doc updated to v1.1 with the decisions above (birthday scope, durations, queue-now booking, refund/credit policy, repo).
- 2026-11-22: haircut duration is 30 min (was 35). Refund for members goes into their prepaid balance with no expiry. Non-members keep the 30-day credit on their WhatsApp number.
- 2026-11-22: barber commission is in the admin reports. It's an admin setting per barber level, default 40% of the haircut price (a common range in Indonesian barbershops is 30–50%; this is an estimate, not Goodfellas data). Product/chemical services can have their own rate.
- 2026-11-22: demo data uses mob-film-flavoured first names for barbers (Vito, Sonny, Michael, Paulie, Henry, Tommy, Jimmy, Tony, Fredo, Luca, etc.). Avoid full real actor names. Visual style is to be discussed next, before phase 1 UI.
- 2026-11-22: visual direction (Claude's call, Nopal wants nothing AI-slop, loud or tacky). The look is a quiet, editorial "old tailor shop / 70s film credits" feel. Colours: warm off-black, bone/cream, and one oxblood accent used sparingly. No gold gradients, neon, glow, glassmorphism, emoji or stock illustrations. Type: a classic serif for headings and a plain sans for body; queue numbers use tabular monospaced digits, styled like ticket stubs. Thin rules, generous spacing, film-credit style footer ("Built by Agamemnon"). Customer web is dark. Cashier and admin use a light cream theme for long-hour readability. The tablet is dark and high-contrast.
- 2026-11-22: tooling must be current, modern and best-in-class, nothing legacy: latest stable Next.js (App Router), React, TypeScript strict, Tailwind CSS v4, Supabase, pnpm, Biome or current ESLint, Vitest and Playwright. Check current versions at build time rather than from memory. Design quality bar: absolutely no AI-slop look.
- 2026-11-22: opening hours are 10:00–21:00 every day. Admin can set holiday closures (e.g. Christmas, Lebaran), which show as an announcement banner on the customer web, and the queue stops taking online bookings near closing time.
- 2026-11-22: haircut includes cut, hair wash (shampoo and conditioner if wanted, free), massage and styling. Show this as the haircut's description, so the "Shy" persona knows what's included. The 30-min duration covers all of it.
- 2026-11-22: stack re-audited from scratch at Nopal's request (no sunk cost). Kept: Next.js (now 16.4 with Cache Components, React Compiler, typed routes), Supabase Postgres, Drizzle (0.45 stable; 1.0 is still RC), Vercel, pnpm. Changed: own auth layer → Better Auth 1.7 (maintained sessions, rate limiting, phone-number plugin for member PIN login and OTP); shadcn/ui → own components on our tokens plus Base UI headless primitives when needed (shadcn's default look reads as generated); Midtrans → Xendit as the planned gateway (API-first, test-mode QRIS simulation, refunds and payouts by API; QRIS fees are regulated so cost is equal), behind a swappable interface; Supabase Realtime Postgres Changes → Broadcast from Database (Supabase's recommended path). Added: TypeScript 7 (native compiler), Node 26 LTS, Biome 2.6, Tailwind 4.3, Zod 4, Vitest 5 with PGlite for real-Postgres tests, Playwright 1.65, GitHub Actions CI. Convex was considered and rejected (weaker for SQL reporting, ledgers and portability). Design doc is now v2.0.
- 2026-11-22: visual system built in phase 1. Fonts: Bodoni Moda (headings), Libre Franklin (body), IBM Plex Mono (numbers). Themes: night (customer), paper (cashier/admin), display (tablet/TV). Brass highlight from design doc v1.2 dropped: one oxblood accent only. Live style sheet at /gaya.

- 2026-11-23: phase 3 (live queue) decisions. The counter tablet is a public read-only page per branch that shows ticket numbers only, never names, so it needs no device login. Live updates use one public Supabase Broadcast topic per branch that only says "something changed"; screens then refetch through the server, so no customer data crosses the socket. The cashier sees only their own branch; admin and owner can switch branches.
- 2026-11-23: phase 4 (online booking) decisions. Coloring and other "from"-priced services can't be booked online, since the final price depends on the hair; they're paid at the counter. "Any barber" picks the shortest line at booking time, so the price is known before paying. A payment that arrives after the 15-minute window becomes 30-day credit on the WhatsApp number. The public demo ignores opening hours for online booking (and says so on the page), so anyone can try it at any hour; a real deployment enforces them.
- 2026-11-23: phase 6 (membership) decisions. Members sign up at the counter only; the member types their own PIN, so the cashier never knows it. The PIN can't be all one digit or a straight run, and 5 wrong tries (login or paying from balance) lock it for 15 minutes. Credit already on the phone number moves into the new member's balance, which doesn't expire. Points are earned on what was actually paid after discounts, balance included. The birthday discount and points don't stack (admin setting, off by default). "Pemasukan hari ini" counts only new money; spending balance or credit is listed separately so top-ups aren't counted twice. Phone top-up by QRIS is still to come.
- 2026-11-23: every UI must be truly user friendly and not overwhelming: little text per screen, no clutter, no AI-slop look. Use design skills (/unslop if available, frontend-design, design-elevation, design-critique, ux-writing) for all UI work. Do a UX polish pass over all screens after phase 7.
- 2026-11-23: WhatsApp chatbot approved as a later phase, after the core app is deployed. Claude may add any feature or improvement it judges valuable (full control).
- 2026-11-23: phase 7 (back office) decisions. Barber commission is paid on what the shop actually earned per service (price minus discount): haircuts at the barber's level share on the day of the sale, other services at one flat share set in Aturan. A level change takes effect from a chosen date and never rewrites past commission. "Uang masuk" in reports counts only new money; balance and credit spending is shown apart. One-time codes are masked in the admin's message log. Nopal asked that every screen be truly user friendly, with little text and nothing that looks AI-made, following the unslop checklist; labels are now sentence case instead of spaced capitals.
- 2026-11-23: phone top-up by QRIS built. A member picks a top-up package on their card, pays a one-off QRIS, and the balance (with bonus) is added only when the payment arrives. Money that arrives after the QR expired still becomes balance, since balance never expires. Online top-ups count as new money (online QRIS) and are booked to the branch the member last visited. The demo now also has four weeks of paid visits so the back office report isn't empty.
