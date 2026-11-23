import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice } from "@/components/notice";
import { getDb } from "@/db";
import { phoneLabel } from "@/domain/booking";
import { shortDate } from "@/domain/schedule";
import { shopClock, shopDate } from "@/domain/time";
import { outboxList } from "@/server/backoffice";
import { whatsappConnected } from "@/server/whatsapp";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Pesan", robots: { index: false } };

export default function OutboxPage() {
  return (
    <AdminShell title="Pesan WhatsApp">
      <Suspense fallback={<div aria-busy className="mt-4 h-40 rounded-2xl bg-sunk" />}>
        <Messages />
      </Suspense>
    </AdminShell>
  );
}

const STATUS = {
  pending: { label: "Menunggu dikirim", className: "text-muted" },
  sent: { label: "Terkirim", className: "text-mint-ink" },
  failed: { label: "Gagal", className: "text-accent-ink" },
  logged: { label: "Hanya dicatat", className: "text-faint" },
  skipped: { label: "Tidak dikirim", className: "text-butter-ink" },
} as const;

async function Messages() {
  const rows = await outboxList(await getDb());
  const notice = whatsappConnected() ? null : (
    <Notice tone="info" title="WhatsApp belum tersambung">
      Pesan hanya dicatat di sini
    </Notice>
  );
  if (rows.length === 0)
    return (
      <>
        {notice}
        <p className="mt-5 text-muted">Belum ada pesan</p>
      </>
    );
  return (
    <>
      {notice}
      <ul className="mt-5 overflow-hidden rounded-2xl border border-rule bg-surface">
        {rows.map((m) => (
          <li
            key={m.id}
            className="grid gap-1 border-b border-rule px-4 py-3 last:border-b-0 sm:grid-cols-[12rem_1fr]"
          >
            <p className="num text-sm text-muted">
              {phoneLabel(m.to)}
              <br />
              {shortDate(shopDate(m.createdAt))}, {shopClock(m.createdAt)}
            </p>
            <div>
              {/* One-time codes stay hidden, even from admins (older rows still hold them). */}
              <p>{m.body.replace(/\b\d{6}\b/g, "••••••")}</p>
              <p className={`mt-1 text-sm font-medium ${STATUS[m.status].className}`}>
                {STATUS[m.status].label}
                {m.error ? <span className="font-normal text-muted">, {m.error}</span> : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
