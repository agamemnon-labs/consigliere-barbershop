import { formatShort } from "@/domain/money";
import { priceLabel } from "@/domain/pricing";
import { getLevels, getServices, type Level, type Service } from "@/server/catalog";
import { ChevronDownIcon } from "./icons";

const categories = [
  { key: "haircut", title: "Potong" },
  { key: "refreshment", title: "Perawatan" },
  { key: "chemical", title: "Chemical" },
  { key: "package", title: "Paket" },
] as const;

/** The full pricelist, grouped by category. Rows expand downward for details. */
export async function PriceList() {
  const [services, levels] = await Promise.all([getServices(), getLevels()]);
  const haircutPrices = levels.map((l) => l.haircutPrice);
  return (
    <div className="flex flex-col gap-8">
      {categories.map((cat) => {
        const items = services.filter((s) => s.category === cat.key);
        if (items.length === 0) return null;
        return (
          <section key={cat.key} aria-labelledby={`cat-${cat.key}`}>
            <h2 id={`cat-${cat.key}`} className="mb-3 text-xl">
              {cat.title}
            </h2>
            <ul className="divide-y divide-rule rounded-2xl bg-surface">
              {items.map((s) => (
                <li key={s.id}>
                  <PriceRow service={s} label={priceLabel(s, haircutPrices)} levels={levels} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-sm text-faint">K = ribu rupiah. Tanda + berarti mulai dari. Bayar non-tunai</p>
    </div>
  );
}

function PriceRow({ service: s, label, levels }: { service: Service; label: string; levels: Level[] }) {
  return (
    <details className="row">
      <summary className="flex min-h-14 items-center gap-3 px-4 py-3">
        <span className="flex-1 font-medium">{s.name}</span>
        <span className="num font-semibold">{label}</span>
        <ChevronDownIcon size={18} className="row-mark shrink-0 text-faint" />
      </summary>
      <div className="px-4 pb-4 text-[0.9375rem] text-muted">
        {s.description ? <p>{s.description}</p> : null}
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-xl bg-bg px-3 py-2.5">
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
      <dd className="num text-right text-fg">{value}</dd>
    </>
  );
}
