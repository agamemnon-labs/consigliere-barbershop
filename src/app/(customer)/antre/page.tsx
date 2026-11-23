import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BranchList } from "@/components/branch-list";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { Steps } from "@/components/steps";
import { getDb, isDemoDatabase } from "@/db";
import { bookingOptions } from "@/server/booking";
import { getBranches } from "@/server/catalog";
import { paymentProvider } from "@/server/payments";
import { BookingFlow } from "./booking-form";

export const metadata: Metadata = {
  title: "Ambil nomor antrean",
  description: "Pilih cabang, barber dan layanan, bayar dengan QRIS, lalu datang saat giliranmu.",
};

/** Online queue in four steps: branch, barber, services, name and pay. */
export default function BookPage({ searchParams }: PageProps<"/antre">) {
  return (
    <Suspense fallback={<ChooseBranch />}>
      <Step searchParams={searchParams} />
    </Suspense>
  );
}

function ChooseBranch() {
  return (
    <Screen back={{ href: "/", label: "Beranda" }} credits={false}>
      <Steps at={1} of={4} />
      <h1 className="mt-6 text-[2rem]">Mau cukur di mana?</h1>
      <p className="mt-2 text-muted">Pilih cabang. Yang paling sepi kami tandai</p>
      <div className="mt-6">
        <BranchList target="book" />
      </div>
    </Screen>
  );
}

async function Step({ searchParams }: { searchParams: PageProps<"/antre">["searchParams"] }) {
  const { cabang } = await searchParams;
  const branches = await getBranches();
  const chosen = typeof cabang === "string" ? branches.find((b) => b.slug === cabang) : undefined;
  if (!chosen) return <ChooseBranch />;

  await connection();
  const options = await bookingOptions(await getDb(), chosen.slug, new Date());
  if (!options) return <ChooseBranch />;

  const blocked = options.closedReason
    ? options.closedReason
    : options.barbers.length === 0
      ? "Belum ada barber yang jaga hari ini."
      : !options.online.ok && !isDemoDatabase()
        ? options.online.reason
        : null;
  if (blocked) {
    return (
      <Screen back={{ href: "/antre", label: "Ganti cabang" }} credits={false}>
        <h1 className="text-[2rem]">{options.branch.name}</h1>
        <Notice title="Belum bisa ambil nomor" tone="alert" className="mt-6">
          {blocked}
        </Notice>
      </Screen>
    );
  }

  return <BookingFlow options={options} demo={paymentProvider().testMode} demoHours={!options.online.ok} />;
}
