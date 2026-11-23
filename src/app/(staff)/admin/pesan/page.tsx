import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice } from "@/components/notice";
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
      <Notice tone="info" title="WhatsApp belum tersambung">
        Pesan hanya dicatat di sini
      </Notice>
      <Suspense fallback={<div aria-busy className="mt-4 h-40 rounded-2xl bg-sunk" />}>
        <Messages />
      </Suspense>
    </AdminShell>
  );
}

async function Messages() {
  const rows = await outboxList(await getDb());
  if (rows.length === 0) return <p className="mt-5 text-muted">Belum ada pesan</p>;
  return (
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
          {/* One-time codes stay hidden, even from admins. */}
          <p>{m.body.replace(/\b\d{6}\b/g, "••••••")}</p>
        </li>
      ))}
    </ul>
  );
}
