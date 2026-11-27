import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice } from "@/components/notice";
import { getDb } from "@/db";
import { shortDate } from "@/domain/schedule";
import { shopClock, shopDate } from "@/domain/time";
import { connectTelegramAction } from "@/server/actions/admin";
import { aiEnabled } from "@/server/chat/ai";
import { recentChats } from "@/server/chat/answer";
import { telegramConfigured, webhookStatus } from "@/server/chat/telegram";
import { AdminForm } from "../_ui/form";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Chat", robots: { index: false } };

export default function ChatAdminPage() {
  return (
    <AdminShell title="Chatbot">
      <Suspense fallback={<div aria-busy className="mt-4 h-40 rounded-2xl bg-sunk" />}>
        <Channels />
      </Suspense>
      <h2 className="mt-10 text-xl">Percakapan terbaru</h2>
      <Suspense fallback={<div aria-busy className="mt-4 h-40 rounded-2xl bg-sunk" />}>
        <Conversations />
      </Suspense>
    </AdminShell>
  );
}

async function Channels() {
  let telegram: Awaited<ReturnType<typeof webhookStatus>> = null;
  let telegramError: string | null = null;
  if (telegramConfigured()) {
    try {
      telegram = await webhookStatus();
    } catch (error) {
      telegramError = error instanceof Error ? error.message : "Telegram tidak bisa dihubungi";
    }
  }
  const connected = Boolean(telegram?.url.endsWith("/api/telegram"));

  return (
    <div className="mt-4 grid gap-4">
      <section className="rounded-2xl border border-rule bg-surface p-4">
        <h2 className="text-lg font-medium">Web chat</h2>
        <p className="mt-1 text-muted">
          Selalu aktif di halaman /tanya.{" "}
          {aiEnabled()
            ? "Dijawab AI lewat Vercel AI Gateway, dengan cadangan jawaban aturan"
            : "Dijawab dengan aturan dari data toko. AI belum dinyalakan"}
        </p>
      </section>

      <section className="rounded-2xl border border-rule bg-surface p-4">
        <h2 className="text-lg font-medium">Telegram</h2>
        {!telegramConfigured() ? (
          <Notice tone="info" title="Telegram belum diatur" className="mt-3">
            Isi TELEGRAM_BOT_TOKEN dan TELEGRAM_WEBHOOK_SECRET di Vercel, lalu sambungkan dari sini
          </Notice>
        ) : telegramError ? (
          <Notice tone="alert" title="Telegram menolak" className="mt-3">
            {telegramError}
          </Notice>
        ) : (
          <>
            <p className="mt-1 text-muted">
              {telegram?.username ? `@${telegram.username}` : "Bot"}{" "}
              {connected ? `tersambung ke ${telegram?.url}` : "belum tersambung ke situs ini"}
            </p>
            {telegram?.lastError ? (
              <p className="mt-2 text-sm text-danger">Error terakhir: {telegram.lastError}</p>
            ) : null}
            <AdminForm
              action={connectTelegramAction}
              submit={connected ? "Sambungkan ulang" : "Sambungkan Telegram"}
              variant={connected ? "quiet" : "dark"}
              className="mt-4"
            >
              <span className="sr-only">Arahkan bot Telegram ke situs ini</span>
            </AdminForm>
          </>
        )}
      </section>
    </div>
  );
}

const CHANNEL = { web: "Web", telegram: "Telegram", whatsapp: "WhatsApp" } as Record<string, string>;
const BRAIN = { rules: "aturan", ai: "AI", limit: "batas harian" } as Record<string, string>;

async function Conversations() {
  const rows = await recentChats(await getDb());
  if (rows.length === 0) return <p className="mt-4 text-muted">Belum ada percakapan</p>;
  return (
    <ul className="mt-4 overflow-hidden rounded-2xl border border-rule bg-surface">
      {rows.map((m) => (
        <li
          key={m.id}
          className="grid gap-1 border-b border-rule px-4 py-3 last:border-b-0 sm:grid-cols-[12rem_1fr]"
        >
          <p className="num text-sm text-muted">
            {CHANNEL[m.channel] ?? m.channel} {m.chatId.slice(0, 6)}
            <br />
            {shortDate(shopDate(m.createdAt))}, {shopClock(m.createdAt)}
          </p>
          <div>
            <p className={m.role === "user" ? "font-medium" : "whitespace-pre-line text-muted"}>
              {m.role === "user" ? "Pelanggan: " : "Bot: "}
              {/* PINs and codes stay hidden here too. */}
              {m.body.replace(/\b\d{6}\b/g, "••••••")}
            </p>
            {m.brain ? <p className="mt-1 text-sm text-faint">Dijawab {BRAIN[m.brain] ?? m.brain}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
