import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db";
import { phoneLabel } from "@/domain/booking";
import { shortDate } from "@/domain/schedule";
import { shopClock, shopDate } from "@/domain/time";
import { outboxList } from "@/server/backoffice";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Pesan", robots: { index: false } };

export default function OutboxPage() {
  return (
    <AdminShell title="Pesan WhatsApp">
      <p className="text-muted">WhatsApp belum tersambung, pesan hanya dicatat</p>
      <Suspense fallback={<p className="mt-6 text-muted">Memuat…</p>}>
        <Messages />
      </Suspense>
    </AdminShell>
  );
}

async function Messages() {
  const rows = await outboxList(await getDb());
  if (rows.length === 0) return <p className="mt-6 text-muted">Belum ada pesan</p>;
  return (
    <ul className="mt-6 border-t border-rule">
      {rows.map((m) => (
        <li key={m.id} className="grid gap-1 border-b border-rule py-4 sm:grid-cols-[12rem_1fr]">
          <p className="num text-sm text-muted">
            {phoneLabel(m.to)}
            <br />
            {shortDate(shopDate(m.createdAt))}, {shopClock(m.createdAt)}
          </p>
          {/* One-time codes stay hidden, even from admins. */}
          <p>{m.body.replace(/\b\d{6}\b/g, "••••••")}</p>
        </li>
      ))}
    </ul>
  );
}
