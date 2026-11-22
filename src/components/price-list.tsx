import { formatShort } from "@/domain/money";
import { priceLabel } from "@/domain/pricing";
import { getLevels, getServices, type Level, type Service } from "@/server/catalog";

const categories = [
  { key: "haircut", title: "Potong" },
  { key: "chemical", title: "Chemical" },
  { key: "refreshment", title: "Perawatan" },
  { key: "package", title: "Paket" },
] as const;

type Props = { only?: (typeof categories)[number]["key"][] };

/** The full pricelist, grouped by category. Rows expand downward for details. */
export async function PriceList({ only }: Props) {
  const [services, levels] = await Promise.all([getServices(), getLevels()]);
  const haircutPrices = levels.map((l) => l.haircutPrice);
  const shown = only ? categories.filter((c) => only.includes(c.key)) : categories;
  return (
    <div className="flex flex-col gap-12">
      {shown.map((cat) => {
        const items = services.filter((s) => s.category === cat.key);
        if (items.length === 0) return null;
        const n = categories.findIndex((c) => c.key === cat.key) + 1;
        return (
          <section key={cat.key} aria-labelledby={`cat-${cat.key}`}>
            <header className="mb-2 flex items-baseline gap-3">
              <span className="num text-xs text-faint">{String(n).padStart(2, "0")}</span>
              <h3 id={`cat-${cat.key}`} className="text-2xl">
                {cat.title}
              </h3>
            </header>
            <ul className="border-t border-rule">
              {items.map((s) => (
                <li key={s.id} className="border-b border-rule">
                  <PriceRow service={s} label={priceLabel(s, haircutPrices)} levels={levels} />
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

function PriceRow({ service: s, label, levels }: { service: Service; label: string; levels: Level[] }) {
  return (
    <details className="row group">
      <summary className="flex min-h-14 items-baseline py-4">
        <span className="text-[1.0625rem]">{s.name}</span>
        <span className="leader" aria-hidden />
        <span className="num text-[1.0625rem]">{label}</span>
        <span aria-hidden className="row-mark ml-4 inline-block w-3 text-center text-muted">
          +
        </span>
      </summary>
      <div className="pr-7 pb-5 text-[0.9375rem] text-muted">
        {s.description ? <p>{s.description}</p> : null}
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
          {s.priceType === "by_level" &&
            levels.map((l) => (
              <Line key={l.id} term={`Barber ${l.name}`} value={formatShort(l.haircutPrice)} />
            ))}
          {s.priceType === "variant" &&
            s.variants.map((v) => (
              <Line key={v.id} term={`${v.name}, ± ${v.durationMin} mnt`} value={formatShort(v.price)} />
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
