import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { Notice } from "@/components/notice";
import { Rule } from "@/components/rule";
import { getDb, isDemoDatabase } from "@/db";
import { bookingOptions } from "@/server/booking";
import { getBranches } from "@/server/catalog";
import { paymentProvider } from "@/server/payments";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = {
  title: "Ambil nomor antrean",
  description: "Pilih barber dan layanan, bayar dengan QRIS, lalu datang saat giliranmu.",
};

/** Online queue: pick a branch, then a barber and services, then pay by QRIS. */
export default function BookPage({ searchParams }: PageProps<"/antre">) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/">Beranda</BackLink>
      <header className="pt-10 pb-10">
        <p className="label">Antrean online</p>
        <h1 className="mt-3 text-5xl leading-[1.05]">Ambil nomor</h1>
        <p className="mt-4 text-muted">Bayar QRIS, nomormu langsung masuk antrean</p>
      </header>
      <Suspense fallback={<p className="py-10 text-muted">Melihat antrean…</p>}>
        <Step searchParams={searchParams} />
      </Suspense>
      <Credits />
    </div>
  );
}

async function Step({ searchParams }: { searchParams: PageProps<"/antre">["searchParams"] }) {
  const { cabang } = await searchParams;
  const branches = await getBranches();
  const chosen = typeof cabang === "string" ? branches.find((b) => b.slug === cabang) : undefined;
  if (!chosen) {
    return (
      <>
        <Rule label="Pilih cabang" />
        <ul className="mt-4">
          {branches.map((b) => (
            <li key={b.id} className="border-b border-rule">
              <Link
                href={`/antre?cabang=${b.slug}`}
                className="group flex min-h-16 items-center justify-between py-3"
              >
                <span className="font-display text-xl group-hover:text-accent-ink">{b.name}</span>
                <span className="text-sm text-muted">{b.address}</span>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  await connection();
  const options = await bookingOptions(await getDb(), chosen.slug, new Date());
  if (!options) return null;

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between border-b border-rule pb-4">
        <p className="font-display text-2xl">{options.branch.name}</p>
        <Link href="/antre" className="label min-h-11 content-center hover:text-fg">
          Ganti cabang
        </Link>
      </div>
      {options.closedReason ? (
        <Notice title="Belum bisa ambil nomor">{options.closedReason}</Notice>
      ) : options.barbers.length === 0 ? (
        <p className="text-muted">Belum ada barber yang jaga hari ini.</p>
      ) : !options.online.ok && !isDemoDatabase() ? (
        <Notice title="Belum bisa ambil nomor">{options.online.reason}</Notice>
      ) : (
        <>
          {!options.online.ok ? (
            <div className="mb-8">
              <Notice title="Mode demo">Jam buka diabaikan supaya bisa dicoba kapan saja</Notice>
            </div>
          ) : null}
          <BookingForm options={options} demo={paymentProvider().testMode} />
        </>
      )}
    </>
  );
}
