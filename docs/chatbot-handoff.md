# Chatbot handoff (2026-11-27)

Where the chatbot stands, for whoever picks it up next. Branch `feat/chatbot`, not merged.

## What was built

One bot brain that every channel asks, answering from the shop's own data.

| Part | Where |
| --- | --- |
| Rule brain: intents, everyday words ("semir", "cukur", "keriting"), answers | `src/domain/chat.ts` (+ `chat.test.ts`) |
| Shop-data snapshot: prices, branches with live queue, 7-day rotation, member rules | `src/server/chat/facts.ts` |
| `ask()`: daily limit per chat, AI with fallback to rules, logging | `src/server/chat/answer.ts` (+ test) |
| AI brain through Vercel AI Gateway (AI SDK 7, `generateText`) | `src/server/chat/ai.ts` |
| AI instructions, kept apart so they can be tuned on their own | `src/server/chat/prompt.ts` |
| Telegram adapter: read update, secret check, reply in the webhook response, setWebhook | `src/server/chat/telegram.ts` (+ test) |
| Web chat API / Telegram webhook | `src/app/api/chat/route.ts`, `src/app/api/telegram/route.ts` |
| Web chat page, linked from home ("Ada pertanyaan?") | `src/app/(customer)/tanya/` |
| Admin → Chat: channel status, "Sambungkan Telegram", latest conversations | `src/app/(staff)/admin/chat/page.tsx`, `connectTelegramAction` |
| Log table `chat_messages` | `src/db/schema.ts`, `drizzle/0009_chatbot.sql` |

The bot can't take a number, pay, cancel or change anything; it links to `/antre`, `/harga`, `/barber`, `/kartu`.

## Decisions

- **No real WhatsApp yet.** Meta locks a new WhatsApp business account, test number included, until the business is verified with legal documents. Unofficial gateways (Fonnte and the like) were ruled out: they risk the number being banned.
- **Route to WhatsApp:** an NIB perorangan from OSS (free). Partner blogs say Meta accepts NIB; Meta's own pages couldn't be read to confirm. Name, address and website on Meta must match the NIB exactly.
- **Meanwhile:** web chat on the site plus Telegram, on the same brain, so WhatsApp is only a new adapter.
- **Two brains:** rules always work (free, predictable); the AI brain is off by default and falls back to rules on any error or past its daily cap.

## Env vars (set in Vercel by Nopal, never in the repo)

| Var | Needed for | Notes |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Telegram | From @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram | Any random 16+ chars of A-Z a-z 0-9 _ - (`openssl rand -hex 24`) |
| `CHAT_AI` | AI answers | `1` to turn on; anything else = rules only |
| `AI_GATEWAY_API_KEY` | AI answers outside Vercel | On Vercel, OIDC works without it. Gateway usage is billed |
| `CHAT_MODEL` | optional | Comma-separated models tried in order until one is allowed (free-tier accounts cannot use every model). Default: Gemini Flash first, Claude Haiku 5.5 last |
| `CHAT_AI_DAILY_CAP` | optional | Default 300 AI answers per shop day |

After setting the Telegram pair and redeploying: Admin → Chat → "Sambungkan Telegram" (needs the https site).

## Tested and not tested

- Tested: lint, typecheck, 210 unit tests (36 new), production build, and the web chat API against the demo database on a local server.
- Not tested: the `/tanya` page by eye in a browser, a real Telegram bot, a real AI Gateway call.
- Preview deployments use the same database as production, so pushing this branch ran migration `0009_chatbot` there: the live database now has an empty `chat_messages` table. The live app doesn't use it until this branch is merged.
- The project-files copies of `docs/brief.md` and `docs/design.md` (consigliere-brief.md, consigliere-design.md) were not updated from this branch.

## Next steps

1. Try `/tanya` on the branch preview; set the Telegram pair and connect it; optionally turn on `CHAT_AI`.
2. Open a PR `feat/chatbot` → `main`, merge once happy (production deploys from `main`).
3. Get the NIB, verify the business in Meta, register the number on the Cloud API (PR 29 code, `src/server/whatsapp.ts`).
4. WhatsApp adapter: a webhook route (`hub.verify_token` check on GET, `X-Hub-Signature-256` check on POST) that reads incoming text and calls `ask(db, { channel: "whatsapp", ... })`, then replies with a free-form text message (allowed inside the 24-hour window after the customer writes). No new template needed for replies.
