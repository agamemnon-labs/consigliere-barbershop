import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { getDb } from "@/db";
import { formatRupiah } from "@/domain/money";
import { shortDate } from "@/domain/schedule";
import { shopDate } from "@/domain/time";
import { todayOverview } from "@/server/admin";
import { applyDueLevels } from "@/server/backoffice";
import { AdminShell } from "./_ui/shell";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/** The owner's first screen, phone-sized: each branch today in four numbers. */
export default function AdminToday() {
  return (
    <AdminShell title="Hari ini">
      <Suspense fallback={<div aria-busy className="h-32 rounded-3xl bg-sunk" />}>
        <Today />
      </Suspense>
    </AdminShell>
  );
}

async function Today() {
  await connection();
  const db = await getDb();
  const date = shopDate();
  await applyDueLevels(db, date);
  const branches = await todayOverview(db, date);
  const total = branches.reduce((s, b) => s + b.takings, 0);
  return (
    <>
      <div className="rounded-3xl bg-suit p-5 text-suit-fg sm:p-6">
        <p className="text-[0.9375rem] text-suit-muted">
          Uang masuk di semua cabang, <span className="num">{shortDate(date)}</span>
        </p>
        <p className="num mt-1 text-[2.5rem] leading-tight font-semibold">{formatRupiah(total)}</p>
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {branches.map((b) => (
          <li key={b.id} className="flex flex-col rounded-2xl border border-rule bg-surface p-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-xl leading-snug font-semibold">{b.name}</span>
              <span className="num shrink-0 font-semibold">{formatRupiah(b.takings)}</span>
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Selesai" value={b.served} />
              <Stat label="Antre" value={b.inLine} tone={b.inLine > 0 ? "butter" : undefined} />
              <Stat label="Barber" value={b.barbers} />
            </dl>
            <Link
              href={`/kasir?cabang=${b.slug}`}
              className="mt-3 inline-flex min-h-11 items-center justify-between rounded-xl px-1 text-[0.9375rem] font-medium text-blue hover:bg-blue-soft/50"
            >
              Buka papan antrean
              <ChevronRightIcon size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "butter" }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${tone === "butter" ? "bg-butter text-butter-ink" : "bg-sunk"}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num text-xl font-semibold">{value}</dd>
    </div>
  );
}
