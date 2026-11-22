"use client";

import { useActionState, useState, useTransition } from "react";
import { buttonClass } from "@/components/button";
import { applyBirthday, applyVoucher, redeemableUnits } from "@/domain/membership";
import { formatRupiah } from "@/domain/money";
import { lookupPayer, type PayerInfo, type PayState, payAction } from "@/server/actions/checkout";

export type CatalogService = {
  id: string;
  name: string;
  priceType: "fixed" | "from" | "by_level" | "variant";
  price: number | null;
  priceFrom: number | null;
  category: string;
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
  const [query, setQuery] = useState("");
  const [payer, setPayer] = useState<PayerInfo>({});
  const [useCredit, setUseCredit] = useState(false);
  const [birthday, setBirthday] = useState(false);
  const [units, setUnits] = useState(0);
  const [useBalance, setUseBalance] = useState(false);
  const [checking, startCheck] = useTransition();
  const member = payer.member;
  const rules = payer.rules;

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
  // The same rules the server applies, so the cashier sees the real amount before "Lunas".
  let items = priced.map((l) => ({
    serviceId: l.serviceId,
    name: l.svc?.name ?? "",
    price: l.price,
    discount: 0,
    category: l.svc?.category ?? "",
  }));
  const birthdayOn = Boolean(member?.birthday && birthday && rules);
  if (birthdayOn && rules) items = applyBirthday(items, rules.birthday);
  const afterBirthday = items.reduce((s, i) => s + i.price - i.discount, 0);
  const pointsBlocked = birthdayOn && !rules?.birthday.stacksWithPoints;
  const maxUnits =
    member && rules && !pointsBlocked ? redeemableUnits(member.points, afterBirthday, rules.points) : 0;
  const unitsUsed = Math.min(units, maxUnits);
  if (unitsUsed > 0 && rules) items = applyVoucher(items, unitsUsed * rules.points.redeemValue);
  const total = items.reduce((s, i) => s + i.price - i.discount, 0);
  const discounts = items.reduce((s, i) => s + i.discount, 0);
  const creditUsed = useCredit && payer.credit ? Math.min(payer.credit, total) : 0;
  const balanceUsed = useBalance && member ? Math.min(member.balance, total - creditUsed) : 0;
  const due = total - creditUsed - balanceUsed;
  const paidOther = creditUsed + balanceUsed;
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
          <label htmlFor={`payer-${entryId}`} className="label">
            Kartu member atau WhatsApp
          </label>
          <div className="flex gap-2">
            <input
              id={`payer-${entryId}`}
              type="text"
              autoComplete="off"
              placeholder="C00012 atau 0812…"
              value={query}
              onChange={(e) => {
                setQuery(e.currentTarget.value);
                setPayer({});
                setUseCredit(false);
                setBirthday(false);
                setUnits(0);
                setUseBalance(false);
              }}
              onKeyDown={(e) => {
                // A QR scanner types the card number and presses Enter: look it up instead of submitting.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (query) startCheck(async () => setPayer(await lookupPayer(query)));
                }
              }}
              className="min-h-10 flex-1 border-0 border-b border-rule-strong bg-transparent outline-none focus:border-fg"
            />
            <button
              type="button"
              disabled={!query || checking}
              className="label min-h-10 px-2 hover:text-fg disabled:opacity-40"
              onClick={() => startCheck(async () => setPayer(await lookupPayer(query)))}
            >
              {checking ? "…" : "Cek"}
            </button>
          </div>
          {payer.error ? <p className="text-accent-ink">{payer.error}</p> : null}
          {payer.phone ? <input type="hidden" name="phone" value={payer.phone} /> : null}

          {member && rules ? (
            <div className="grid gap-1 border-l-2 border-fg pl-3">
              <input type="hidden" name="memberId" value={member.id} />
              <p>
                {member.name} <span className="num text-muted">{member.memberNo}</span>
              </p>
              <p className="label">
                {member.points} poin · saldo <span className="num">{formatRupiah(member.balance)}</span>
              </p>
              {member.birthday ? (
                <label className="flex min-h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    name="birthday"
                    value="1"
                    checked={birthday}
                    onChange={(e) => setBirthday(e.currentTarget.checked)}
                    className="size-4 accent-fg"
                  />
                  Bulan ulang tahun: diskon {rules.birthday.percent}% haircut
                </label>
              ) : null}
              {member.points >= rules.points.redeemPoints ? (
                <label className="flex min-h-10 items-center gap-2">
                  <span className="flex-1">
                    Tukar poin{" "}
                    <span className="text-muted">
                      ({rules.points.redeemPoints} poin = {formatRupiah(rules.points.redeemValue)})
                    </span>
                  </span>
                  <select
                    name="redeemUnits"
                    value={unitsUsed}
                    disabled={maxUnits === 0}
                    onChange={(e) => setUnits(Number(e.currentTarget.value))}
                    className="min-h-10 border border-rule-strong bg-transparent px-2 disabled:opacity-40"
                  >
                    {[...Array(maxUnits + 1).keys()].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "Tidak" : `${n * rules.points.redeemPoints} poin`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {pointsBlocked && member.points >= rules.points.redeemPoints ? (
                <p className="text-muted">Diskon ulang tahun tidak bisa digabung dengan tukar poin.</p>
              ) : null}
              {member.balance > 0 ? (
                <label className="flex min-h-10 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useBalance}
                    onChange={(e) => setUseBalance(e.currentTarget.checked)}
                    className="size-4 accent-fg"
                  />
                  Bayar pakai saldo
                </label>
              ) : null}
              {balanceUsed > 0 ? (
                <>
                  <input type="hidden" name="balance" value={balanceUsed} />
                  <label className="flex items-center gap-2">
                    <span className="label flex-1">PIN, diketik member</span>
                    <input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      required
                      className="num min-h-10 w-28 border-0 border-b border-rule-strong bg-transparent text-center tracking-[0.4em] outline-none focus:border-fg"
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}

          {payer.credit !== undefined ? (
            payer.credit > 0 ? (
              <label className="flex min-h-10 items-center gap-2">
                <input
                  type="checkbox"
                  checked={useCredit}
                  onChange={(e) => setUseCredit(e.currentTarget.checked)}
                  className="size-4 accent-fg"
                />
                Pakai kredit <span className="num">{formatRupiah(payer.credit)}</span>
              </label>
            ) : !member ? (
              <p className="text-muted">Bukan member, dan tidak ada kredit di nomor ini.</p>
            ) : null
          ) : null}
          {creditUsed > 0 ? <input type="hidden" name="useCredit" value={creditUsed} /> : null}
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
        {due === 0 && lines.length > 0 ? <input type="hidden" name="edc" value="edc_card" /> : null}

        <dl className="grid gap-0.5 border-t border-rule-strong pt-2">
          {discounts > 0 ? <Row term="Diskon" value={discounts} /> : null}
          {creditUsed > 0 ? <Row term="Kredit" value={creditUsed} /> : null}
          {balanceUsed > 0 ? <Row term="Saldo" value={balanceUsed} /> : null}
          <div className="flex items-baseline justify-between">
            <dt className="label">Tagih di EDC</dt>
            <dd className="num text-xl text-accent-ink">{formatRupiah(due)}</dd>
          </div>
        </dl>
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
          {pending ? "Menyimpan…" : due === 0 && paidOther > 0 ? "Lunas tanpa EDC" : "Lunas"}
        </button>
      </form>
    </details>
  );
}

function Row({ term, value }: { term: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between text-muted">
      <dt>{term}</dt>
      <dd className="num">−{formatRupiah(value)}</dd>
    </div>
  );
}
