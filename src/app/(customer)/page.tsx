import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BranchList } from "@/components/branch-list";
import { ButtonLink } from "@/components/button";
import { ChevronRightIcon } from "@/components/icons";
import { LiveRefresh } from "@/components/live-refresh";
import { MyTicketBanner } from "@/components/my-ticket-banner";
import { Pole } from "@/components/pole";
import { Screen } from "@/components/screen";
import { SectionTitle } from "@/components/section-title";
import { brand } from "@/config/brand";
import { formatShort } from "@/domain/money";
import { priceLabel } from "@/domain/pricing";
import { clockLabel } from "@/domain/time";
import { getBarbers, getBranches, getLevels, getServices } from "@/server/catalog";

export default async function Home() {
  const [branches, barbers, services, levels] = await Promise.all([
    getBranches(),
    getBarbers(),
    getServices(),
    getLevels(),
  ]);
  const hours = branches[0]?.openHours.mon;
  const haircutPrices = levels.map((l) => l.haircutPrice);
  const haircut = services.find((s) => s.priceType === "by_level");
  const cheapest = (category: string) => {
    const prices = services
      .filter((s) => s.category === category)
      .flatMap((s) => [s.price, s.priceFrom, ...s.variants.map((v) => v.price)])
      .filter((p): p is number => typeof p === "number");
    return prices.length ? `mulai ${formatShort(Math.min(...prices))}` : null;
  };
  const priceRows = [
    {
      name: "Haircut",
      note: "Potong, cuci, pijat, styling",
      price: haircut ? priceLabel(haircut, haircutPrices) : "—",
    },
    { name: "Perawatan", note: "Masker, shaving, ear candle", price: cheapest("refreshment") },
    { name: "Chemical", note: "Toning, coloring, perm", price: cheapest("chemical") },
  ].filter((r) => r.price);

  return (
    <Screen
      right={
        hours ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <Pole turning className="h-3.5! w-1.5!" />
            Buka <span className="num">{`${clockLabel(hours[0])}–${clockLabel(hours[1])}`}</span>
          </span>
        ) : null
      }
    >
      <MyTicketBanner />

      <section className="overflow-hidden rounded-3xl bg-sunk">
        <div className="relative px-5 pt-6 pb-7">
          <HeroTicket />
          <h1 className="max-w-[11ch] pt-40 text-[2.375rem]">{brand.tagline}</h1>
          <p className="mt-3 max-w-[28ch] text-[1.0625rem] text-muted">
            Ambil nomor dari HP, bayar QRIS, datang pas giliranmu
          </p>
          <ButtonLink href="/antre" className="mt-6" block>
            Ambil nomor antrean
          </ButtonLink>
        </div>
        <div aria-hidden className="floor" />
      </section>

      <section className="mt-10" aria-labelledby="antrean">
        <SectionTitle id="antrean" action={<LiveSlot />}>
          Antrean sekarang
        </SectionTitle>
        <BranchList target="branch" />
      </section>

      <section className="mt-10" aria-labelledby="harga">
        <SectionTitle id="harga" action={<More href="/harga">Semua harga</More>}>
          Harga
        </SectionTitle>
        <ul className="divide-y divide-rule rounded-2xl bg-surface">
          {priceRows.map((r) => (
            <li key={r.name} className="flex items-center gap-4 px-4 py-3.5">
              <span className="flex-1">
                <span className="block font-medium">{r.name}</span>
                <span className="block text-sm text-faint">{r.note}</span>
              </span>
              <span className="num shrink-0 text-lg font-semibold">{r.price}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="barber">
        <SectionTitle id="barber" action={<More href="/barber">Jadwal barber</More>}>
          Keluarga kami
        </SectionTitle>
        <Link href="/barber" className="block rounded-2xl bg-surface p-4 hover:ring-1 hover:ring-rule-strong">
          <span className="flex flex-wrap gap-2">
            {barbers.slice(0, 5).map((b) => (
              <Avatar key={b.id} name={b.name} />
            ))}
            {barbers.length > 5 ? (
              <span className="num inline-flex size-12 items-center justify-center rounded-full bg-sunk font-semibold text-muted">
                +{barbers.length - 5}
              </span>
            ) : null}
          </span>
          <span className="mt-3 block text-[0.9375rem] text-muted">
            {barbers.length} barber pindah-pindah cabang. Cek siapa jaga di mana hari ini
          </span>
        </Link>
      </section>

      <section className="pinstripe mt-10 rounded-3xl px-5 py-6 text-suit-fg" aria-labelledby="member">
        <h2 id="member" className="slab text-[1.875rem] leading-tight">
          Jadi orang dalam
        </h2>
        <p className="mt-2 max-w-[30ch] text-suit-muted">
          Member dapat poin tiap kunjungan, saldo dengan bonus, dan potong setengah harga di bulan ulang tahun
        </p>
        <Link
          href="/kartu"
          className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-suit-fg px-5 font-medium text-suit transition-colors hover:bg-surface"
        >
          Buka kartu member
        </Link>
        <p className="mt-3 text-sm text-suit-muted">Belum member? Daftar di kasir</p>
      </section>
    </Screen>
  );
}

function More({ href, children }: { href: "/harga" | "/barber"; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-0.5 text-[0.9375rem] font-medium text-blue hover:underline"
    >
      {children}
      <ChevronRightIcon size={18} />
    </Link>
  );
}

/** A sample ticket on the hero: what the customer gets, tilted like paper on a counter. */
function HeroTicket() {
  return (
    <div
      aria-hidden
      className="ticket absolute top-6 right-5 w-56 rotate-[4deg] [--notch:0.5rem] [--tear:6.25rem]"
    >
      <div className="flex h-25 flex-col justify-between px-4 pt-3">
        <span className="text-sm text-white/90">Nomor antrean</span>
        <span className="slab pb-2.5 text-[3.25rem] leading-none">
          <span className="text-2xl text-white/85">P</span> 021
        </span>
      </div>
      <div className="ticket-tear mx-4" />
      <div className="flex items-baseline justify-between px-4 pt-2 pb-3 text-sm text-white/90">
        <span>Giliranmu sekitar</span>
        <span className="num text-base font-semibold text-white">14.40</span>
      </div>
    </div>
  );
}

/** The live label needs any branch id to listen on; the queue refresh covers all three. */
async function LiveSlot() {
  const [first] = await getBranches();
  return first ? (
    <Suspense fallback={null}>
      <LiveRefresh branchId={first.id} />
    </Suspense>
  ) : null;
}
