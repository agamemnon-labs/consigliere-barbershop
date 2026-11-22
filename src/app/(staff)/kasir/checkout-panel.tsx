"use client";

import { useActionState, useState, useTransition } from "react";
import { buttonClass } from "@/components/button";
import { formatRupiah } from "@/domain/money";
import { lookupCredit, type PayState, payAction } from "@/server/actions/checkout";

export type CatalogService = {
  id: string;
  name: string;
  priceType: "fixed" | "from" | "by_level" | "variant";
  price: number | null;
  priceFrom: number | null;
  variants: { id: string; name: string; price: number }[];
};

type Line = { key: number; serviceId: string; variantId?: string; price?: number };

type Props = {
  entryId: string;
  haircutPrice: number;
  catalog: CatalogService[];
  /** Services already on the bill when the panel opens (haircut for a walk-in, nothing for prepaid online). */
  preset: string[];
  label: string;
};

/**
 * Opens under the chair: what was done, who pays, how. One tap on "Lunas"
 * records the payment and frees the chair. The EDC machine takes the money.
 */
export function CheckoutPanel({ entryId, haircutPrice, catalog, preset, label }: Props) {
  const [state, action, pending] = useActionState<PayState, FormData>(payAction, {});
  const [lines, setLines] = useState<Line[]>(() => preset.map((serviceId, key) => ({ key, serviceId })));
  const [nextKey, setNextKey] = useState(preset.length);
  const [phone, setPhone] = useState("");
  const [credit, setCredit] = useState<{ amount?: number; error?: string }>({});
  const [useCredit, setUseCredit] = useState(false);
  const [checking, startCheck] = useTransition();

  const byId = new Map(catalog.map((c) => [c.id, c]));
  const priced = lines.map((l) => {
    const svc = byId.get(l.serviceId);
    const price = !svc
      ? 0
      : svc.priceType === "by_level"
        ? haircutPrice
        : svc.priceType === "variant"
          ? (svc.variants.find((v) => v.id === l.variantId)?.price ?? 0)
          : svc.priceType === "from"
            ? (l.price ?? 0)
            : (svc.price ?? 0);
    return { ...l, svc, price };
  });
  const total = priced.reduce((s, l) => s + l.price, 0);
  const creditUsed = useCredit && credit.amount ? Math.min(credit.amount, total) : 0;
  const due = total - creditUsed;
  // The same service twice would need two hidden inputs with one name; keep it simple and allow one each.
  const available = catalog.filter((c) => !lines.some((l) => l.serviceId === c.id));

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  return (
    <details className="row mt-3">
      <summary className={`${buttonClass("primary", true)} min-h-11 cursor-pointer list-none`}>
        {label}
      </summary>
      <form action={action} className="mt-3 grid gap-3 text-sm">
        <input type="hidden" name="entryId" value={entryId} />
        {priced.map((l) => (
          <div key={l.key} className="grid gap-1.5 border-b border-rule pb-2">
            <input type="hidden" name="service" value={l.serviceId} />
            <div className="flex items-baseline gap-2">
              <span className="flex-1">{l.svc?.name}</span>
              <span className="num">{l.price ? formatRupiah(l.price) : "—"}</span>
              <button
                type="button"
                aria-label={`Hapus ${l.svc?.name}`}
                className="label min-h-8 px-1 hover:text-fg"
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
              >
                ✕
              </button>
            </div>
            {l.svc?.priceType === "variant" ? (
              <select
                name={`variant-${l.serviceId}`}
                required
                value={l.variantId ?? ""}
                onChange={(e) => update(l.key, { variantId: e.currentTarget.value })}
                className="min-h-10 border border-rule-strong bg-transparent px-2"
              >
                <option value="" disabled>
                  Pilih ukuran
                </option>
                {l.svc.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {formatRupiah(v.price)}
                  </option>
                ))}
              </select>
            ) : null}
            {l.svc?.priceType === "from" ? (
              <label className="flex items-center gap-2">
                <span className="label">Harga</span>
                <input
                  name={`price-${l.serviceId}`}
                  inputMode="numeric"
                  required
                  placeholder={`min. ${formatRupiah(l.svc.priceFrom ?? 0)}`}
                  value={l.price ? l.price.toLocaleString("id-ID") : ""}
                  onChange={(e) =>
                    update(l.key, { price: Number(e.currentTarget.value.replace(/\D/g, "")) || 0 })
                  }
                  className="num min-h-10 flex-1 border-0 border-b border-rule-strong bg-transparent text-right outline-none focus:border-fg"
                />
              </label>
            ) : null}
          </div>
        ))}

        {available.length > 0 ? (
          <select
            aria-label="Tambah layanan"
            value=""
            onChange={(e) => {
              const id = e.currentTarget.value;
              if (!id) return;
              setLines((ls) => [...ls, { key: nextKey, serviceId: id }]);
              setNextKey((k) => k + 1);
            }}
            className="min-h-10 border border-dashed border-rule-strong bg-transparent px-2 text-muted"
          >
            <option value="">+ Tambah layanan</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}

        <div className="grid gap-1.5">
          <label htmlFor={`phone-${entryId}`} className="label">
            WhatsApp (kalau punya kredit)
          </label>
          <div className="flex gap-2">
            <input
              id={`phone-${entryId}`}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => {
                setPhone(e.currentTarget.value);
                setCredit({});
                setUseCredit(false);
              }}
              className="min-h-10 flex-1 border-0 border-b border-rule-strong bg-transparent outline-none focus:border-fg"
            />
            <button
              type="button"
              disabled={!phone || checking}
              className="label min-h-10 px-2 hover:text-fg disabled:opacity-40"
              onClick={() => startCheck(async () => setCredit(await lookupCredit(phone)))}
            >
              {checking ? "…" : "Cek kredit"}
            </button>
          </div>
          {credit.error ? <p className="text-accent-ink">{credit.error}</p> : null}
          {credit.amount !== undefined ? (
            credit.amount > 0 ? (
              <label className="flex min-h-10 items-center gap-2">
                <input
                  type="checkbox"
                  checked={useCredit}
                  onChange={(e) => setUseCredit(e.currentTarget.checked)}
                  className="size-4 accent-fg"
                />
                Pakai kredit <span className="num">{formatRupiah(credit.amount)}</span>
              </label>
            ) : (
              <p className="text-muted">Tidak ada kredit di nomor ini.</p>
            )
          ) : null}
          {useCredit ? <input type="hidden" name="useCredit" value={creditUsed} /> : null}
        </div>

        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="label mb-1.5">Bayar di EDC</legend>
          {(
            [
              ["edc_qris", "QRIS"],
              ["edc_card", "Kartu"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-rule-strong has-checked:border-fg has-checked:bg-fg has-checked:text-bg"
            >
              <input
                type="radio"
                name="edc"
                value={value}
                required
                className="sr-only"
                disabled={due === 0 && lines.length > 0}
              />
              {text}
            </label>
          ))}
        </fieldset>
        {due === 0 && total > 0 ? <input type="hidden" name="edc" value="edc_card" /> : null}

        <p className="flex items-baseline justify-between border-t border-rule-strong pt-2">
          <span className="label">
            {creditUsed > 0 ? `Kredit −${formatRupiah(creditUsed)} · tagih` : "Tagih"}
          </span>
          <span className="num text-xl text-accent-ink">{formatRupiah(due)}</span>
        </p>
        {state.error ? (
          <p role="alert" className="text-accent-ink">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          className={`${buttonClass("accent", true)} min-h-11`}
          disabled={pending || lines.length === 0}
        >
          {pending ? "Menyimpan…" : due === 0 && total > 0 ? "Lunas dengan kredit" : "Lunas"}
        </button>
      </form>
    </details>
  );
}
