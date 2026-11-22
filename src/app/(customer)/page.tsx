import { Credits } from "@/components/credits";
import { PriceList } from "@/components/price-list";
import { Rule } from "@/components/rule";
import { Wordmark } from "@/components/wordmark";
import { brand } from "@/config/brand";
import { branchSeed } from "@/db/seed/data";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-6">
      <header className="flex flex-col items-center pt-[calc(4.5rem+env(safe-area-inset-top))] pb-16 text-center">
        <Wordmark size="lg" />
        <p className="mt-14 font-display text-[1.9rem] italic leading-tight">{brand.tagline}</p>
        <p className="mt-5 max-w-[30ch] text-muted">
          Tiga cabang di {brand.city}. Lihat harga dan barber tanpa perlu bertanya, lalu datang saat giliran
          Anda.
        </p>
      </header>

      <Rule label="Cabang" />
      <ul className="mt-6 mb-16">
        {branchSeed.map((b) => (
          <li key={b.slug} className="flex items-baseline justify-between gap-4 border-b border-rule py-4">
            <div>
              <p className="font-display text-xl">{b.name}</p>
              <p className="mt-0.5 text-sm text-muted">{b.address}</p>
            </div>
            <p className="num shrink-0 text-sm text-muted">
              {b.openHours.mon?.[0]}–{b.openHours.mon?.[1]}
            </p>
          </li>
        ))}
      </ul>

      <Rule label="Daftar harga" className="mb-8" />
      <PriceList />

      <p className="label mt-16 text-center leading-relaxed">
        Segera hadir
        <br />
        <span className="text-fg">Antrean langsung · Ambil nomor · Kartu member</span>
      </p>

      <Credits />
    </div>
  );
}
