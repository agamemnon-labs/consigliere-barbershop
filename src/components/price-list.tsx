import { levelSeed, serviceSeed } from "@/db/seed/data";
import { formatShort } from "@/domain/money";

/*
 * Phase 1 renders the pricelist from seed data so the look can be judged
 * before the database is live. Phase 2 swaps the source for the services table.
 */

const categories = [
  { key: "haircut", title: "Potong" },
  { key: "chemical", title: "Chemical" },
  { key: "refreshment", title: "Perawatan" },
  { key: "package", title: "Paket" },
] as const;

type Service = (typeof serviceSeed)[number];

function priceLabel(s: Service): string {
  switch (s.priceType) {
    case "by_level": {
      const prices = levelSeed.map((l) => l.haircutPrice);
      return `${formatShort(Math.min(...prices))}–${formatShort(Math.max(...prices))}`;
    }
    case "from":
      return `${formatShort(s.priceFrom)}+`;
    case "variant":
      return `${formatShort(Math.min(...s.variants.map((v) => v.price)))}+`;
    case "fixed":
      return formatShort(s.price);
  }
}

type Props = { only?: (typeof categories)[number]["key"][] };

export function PriceList({ only }: Props) {
  const shown = only ? categories.filter((c) => only.includes(c.key)) : categories;
  return (
    <div className="flex flex-col gap-12">
      {shown.map((cat, i) => {
        const items = serviceSeed.filter((s) => s.category === cat.key);
        return (
          <section key={cat.key} aria-labelledby={`cat-${cat.key}`}>
            <header className="mb-2 flex items-baseline gap-3">
              <span className="num text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
              <h3 id={`cat-${cat.key}`} className="text-2xl">
                {cat.title}
              </h3>
            </header>
            <ul className="border-t border-rule">
              {items.map((s) => (
                <li key={s.slug} className="border-b border-rule">
                  <PriceRow service={s} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-sm text-muted">
        K berarti ribu rupiah. Tanda <span className="num">+</span> berarti harga mulai dari. Pembayaran
        non-tunai.
      </p>
    </div>
  );
}

function PriceRow({ service: s }: { service: Service }) {
  return (
    <details className="row group">
      <summary className="flex min-h-14 items-baseline py-4">
        <span className="text-[1.0625rem]">{s.name}</span>
        <span className="leader" aria-hidden />
        <span className="num text-[1.0625rem]">{priceLabel(s)}</span>
        <span aria-hidden className="row-mark ml-4 inline-block w-3 text-center text-muted">
          +
        </span>
      </summary>
      <div className="pb-5 pr-7 text-[0.9375rem] text-muted">
        <p>{s.description}</p>
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
          {s.priceType === "by_level" &&
            levelSeed.map((l) => (
              <Line key={l.slug} term={`Barber ${l.name}`} value={formatShort(l.haircutPrice)} />
            ))}
          {s.priceType === "variant" &&
            s.variants.map((v) => (
              <Line key={v.name} term={`${v.name}, ± ${v.durationMin} mnt`} value={formatShort(v.price)} />
            ))}
          {s.priceType !== "variant" && <Line term="Durasi" value={`± ${s.durationMin} mnt`} />}
        </dl>
      </div>
    </details>
  );
}

function Line({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt>{term}</dt>
      <dd className="num text-fg">{value}</dd>
    </>
  );
}
