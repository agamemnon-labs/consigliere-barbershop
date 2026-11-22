import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
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
      <Suspense fallback={<p className="text-muted">Memuat…</p>}>
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
      <p className="text-muted">{shortDate(date)}</p>
      <p className="num mt-4 text-5xl">{formatRupiah(total)}</p>
      <p className="mt-1 text-muted">Uang masuk di semua cabang</p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {branches.map((b) => (
          <li key={b.id} className="rounded-sm border border-rule bg-surface p-5">
            <Link href={`/kasir?cabang=${b.slug}`} className="text-xl hover:text-accent-ink">
              {b.name}
            </Link>
            <dl className="mt-4 grid grid-cols-2 gap-y-3">
              <dt className="label">Uang masuk</dt>
              <dd className="num text-right">{formatRupiah(b.takings)}</dd>
              <dt className="label">Selesai</dt>
              <dd className="num text-right">{b.served}</dd>
              <dt className="label">Antre sekarang</dt>
              <dd className="num text-right">{b.inLine}</dd>
              <dt className="label">Barber jaga</dt>
              <dd className="num text-right">{b.barbers}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
