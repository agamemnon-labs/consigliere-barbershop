import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { getDb } from "@/db";
import { formatRupiah } from "@/domain/money";
import { shortDate } from "@/domain/schedule";
import { shopClock, shopDate } from "@/domain/time";
import { type OnlinePayment, onlinePayments, receivedTotal } from "@/server/online-payments";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Bayar online", robots: { index: false } };

const DAYS = 7;

/** Every QRIS charge started from a phone, to match against the Xendit dashboard. */
export default function OnlinePaymentsPage() {
  return (
    <AdminShell title="Bayar online">
      <Suspense fallback={<div aria-busy className="h-40 rounded-3xl bg-sunk" />}>
        <Payments />
      </Suspense>
    </AdminShell>
  );
}

const STATUS: Record<OnlinePayment["status"], { label: string; tone: string }> = {
  paid: { label: "Lunas", tone: "bg-mint text-mint-ink" },
  credited: { label: "Jadi kredit", tone: "bg-butter text-butter-ink" },
  pending: { label: "Menunggu", tone: "bg-blue-soft text-blue" },
  expired: { label: "Tidak dibayar", tone: "bg-sunk text-muted" },
  refunded: { label: "Dikembalikan", tone: "bg-sunk text-muted" },
};

async function Payments() {
  await connection();
  const now = new Date();
  const rows = await onlinePayments(await getDb(), now, DAYS);
  const days = Map.groupBy(rows, (r) => shopDate(r.createdAt));

  return (
    <>
      <div className="rounded-3xl bg-navy p-5 text-navy-fg sm:p-6">
        <p className="text-[0.9375rem] text-navy-muted">Masuk lewat QRIS, {DAYS} hari terakhir</p>
        <p className="num mt-1 text-[2.5rem] leading-tight font-semibold">
          {formatRupiah(receivedTotal(rows))}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 text-muted">Belum ada pembayaran online</p>
      ) : (
        [...days].map(([date, list]) => (
          <section key={date} className="mt-6">
            <h2 className="num text-[0.9375rem] font-medium text-muted">{shortDate(date)}</h2>
            <ul className="mt-2 overflow-hidden rounded-2xl border border-rule bg-surface">
              {list.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function Row({ p }: { p: OnlinePayment }) {
  const status = STATUS[p.status];
  return (
    <li className="border-b border-rule last:border-b-0">
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-bg [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{p.who}</span>
            <span className="block text-sm text-muted">
              {p.kind === "booking" ? `Antre di ${p.detail}` : `Top-up ${p.detail}`}
            </span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <span className="num font-semibold">{formatRupiah(p.amount)}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${status.tone}`}>
              {status.label}
            </span>
          </span>
          <ChevronDownIcon size={18} className="text-faint transition-transform group-open:rotate-180" />
        </summary>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 border-t border-rule bg-bg px-4 py-3 text-sm">
          <dt className="text-muted">Dibuat</dt>
          <dd className="num">{shopClock(p.createdAt)}</dd>
          <dt className="text-muted">Dibayar</dt>
          <dd className="num">{p.paidAt ? shopClock(p.paidAt) : "Belum"}</dd>
          <dt className="text-muted">ID Xendit</dt>
          <dd className="num min-w-0 break-all select-all">{p.paymentId}</dd>
        </dl>
      </details>
    </li>
  );
}
