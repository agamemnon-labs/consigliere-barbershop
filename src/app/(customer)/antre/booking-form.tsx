"use client";

import { useActionState, useState } from "react";
import { buttonClass } from "@/components/button";
import { Field } from "@/components/field";
import { Rule } from "@/components/rule";
import { type LineItem, priceItem, shortestWait, totals } from "@/domain/booking";
import { formatRupiah, formatShort } from "@/domain/money";
import { type BookState, book } from "@/server/actions/booking";
import type { BookingOptions } from "@/server/booking";

type Options = NonNullable<BookingOptions>;

const CATEGORY: Record<string, string> = {
  haircut: "Potong",
  chemical: "Kimia",
  refreshment: "Perawatan",
  package: "Paket",
};

export function BookingForm({ options, demo }: { options: Options; demo: boolean }) {
  const [state, action, pending] = useActionState<BookState, FormData>(book, {});
  const fastest = shortestWait(options.barbers);
  const [barberId, setBarberId] = useState<string>("any");
  const haircut = options.services.find((x) => x.priceType === "by_level");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(haircut ? [haircut.id] : []));
  const [variants, setVariants] = useState<Record<string, string>>({});

  const barber = barberId === "any" ? fastest : options.barbers.find((b) => b.id === barberId);
  const items: LineItem[] = [];
  for (const svc of options.services) {
    if (!picked.has(svc.id)) continue;
    const variantId = variants[svc.id] ?? svc.variants[0]?.id;
    items.push(priceItem(svc, barber?.haircutPrice ?? 0, variantId));
  }
  const { amount, durationMin } = totals(items);

  function toggle(id: string, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const groups = Object.entries(CATEGORY)
    .map(([key, label]) => ({ label, services: options.services.filter((x) => x.category === key) }))
    .filter((g) => g.services.length > 0);

  const extrasPicked = groups.slice(1).some((g) => g.services.some((x) => picked.has(x.id)));

  function renderGroup(g: (typeof groups)[number]) {
    return (
      <fieldset key={g.label} className="mt-5">
        <legend className="label mb-1">{g.label}</legend>
        {g.services.map((svc) => {
          const on = picked.has(svc.id);
          const price =
            svc.priceType === "by_level"
              ? (barber?.haircutPrice ?? 0)
              : svc.priceType === "variant"
                ? (svc.variants.find((v) => v.id === (variants[svc.id] ?? svc.variants[0]?.id))?.price ?? 0)
                : (svc.price ?? 0);
          return (
            <div key={svc.id}>
              <Choice
                type="checkbox"
                name="service"
                value={svc.id}
                checked={on}
                onChange={(e) => toggle(svc.id, e.currentTarget.checked)}
                title={svc.name}
                detail={`± ${svc.durationMin} mnt`}
                aside={formatShort(price)}
              />
              {on && svc.variants.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 pb-3 pl-9">
                  {svc.variants.map((v) => (
                    <label
                      key={v.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 border border-rule px-3 has-checked:border-fg"
                    >
                      <input
                        type="radio"
                        name={`variant-${svc.id}`}
                        value={v.id}
                        checked={(variants[svc.id] ?? svc.variants[0]?.id) === v.id}
                        onChange={() => setVariants((m) => ({ ...m, [svc.id]: v.id }))}
                        className="size-4 accent-fg"
                      />
                      <span className="text-sm">
                        {v.name} <span className="num text-muted">{formatShort(v.price)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </fieldset>
    );
  }

  return (
    <form action={action} className="flex flex-col">
      <input type="hidden" name="branch" value={options.branch.slug} />

      <Rule label="1 · Barber" />
      <fieldset className="mt-3">
        <legend className="sr-only">Pilih barber</legend>
        {fastest ? (
          <Choice
            type="radio"
            name="barber"
            value="any"
            checked={barberId === "any"}
            onChange={() => setBarberId("any")}
            title="Siapa saja yang paling cepat"
            detail={`Sekarang ${fastest.name}, ${fastest.waitMin > 0 ? `± ${fastest.waitMin} mnt` : "langsung duduk"}`}
            aside={formatShort(fastest.haircutPrice)}
          />
        ) : null}
        {options.barbers.map((b) => (
          <Choice
            key={b.id}
            type="radio"
            name="barber"
            value={b.id}
            checked={barberId === b.id}
            onChange={() => setBarberId(b.id)}
            title={b.name}
            titleClass="font-display text-xl"
            detail={`${b.level} · ${b.waiting > 0 ? `${b.waiting} menunggu, ± ${b.waitMin} mnt` : "kursi kosong"}`}
            aside={formatShort(b.haircutPrice)}
          />
        ))}
      </fieldset>

      <Rule label="2 · Layanan" className="mt-10" />
      {groups.slice(0, 1).map(renderGroup)}
      {groups.length > 1 ? (
        <details className="row mt-4 border-y border-rule" open={extrasPicked}>
          <summary className="flex min-h-12 cursor-pointer items-center justify-between text-[0.9375rem]">
            <span>Tambah layanan lain</span>
            <span className="label">Kimia · perawatan · paket</span>
          </summary>
          <div className="pb-4">
            {groups.slice(1).map(renderGroup)}
            <p className="mt-4 text-sm text-muted">Coloring dibayar di kasir, harganya tergantung rambut</p>
          </div>
        </details>
      ) : null}

      <Rule label="3 · Atas nama" className="mt-10" />
      <div className="mt-6 grid gap-6">
        <Field
          label="Nama panggilan"
          name="name"
          autoComplete="given-name"
          maxLength={60}
          required
          defaultValue={state.values?.name}
          hint="Layar di toko hanya menampilkan nomor"
        />
        <Field
          label="Nomor WhatsApp"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={state.values?.phone}
          hint="Kami kabari saat giliranmu dekat"
        />
      </div>

      <div className="mt-10 border-t border-rule-strong pt-5">
        <ul className="grid gap-2 text-[0.9375rem]">
          {items.map((i) => (
            <li key={i.serviceId} className="flex items-baseline">
              <span>{i.name}</span>
              <span className="leader" aria-hidden />
              <span className="num">{formatRupiah(i.price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-baseline justify-between">
          <span className="label">Total · ± {durationMin} mnt</span>
          <span className="num text-2xl">{formatRupiah(amount)}</span>
        </p>
        {state.error ? (
          <p role="alert" className="mt-4 text-sm text-accent-ink">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          className={`${buttonClass("accent", true)} mt-6`}
          disabled={pending || items.length === 0}
        >
          {pending ? "Menyiapkan QRIS…" : `Bayar ${formatRupiah(amount)} dengan QRIS`}
        </button>
        <p className="mt-3 text-center text-sm text-muted">
          Batas bayar 15 menit{demo ? " · uang demo" : ""}
        </p>
      </div>
    </form>
  );
}

type ChoiceProps = {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  title: string;
  titleClass?: string;
  detail: string;
  aside: string;
};

/** One tappable row: control, name and detail, price on the right. */
function Choice({
  type,
  name,
  value,
  checked,
  onChange,
  title,
  titleClass = "",
  detail,
  aside,
}: ChoiceProps) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center gap-4 border-b border-rule py-3">
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="size-5 shrink-0 accent-fg"
      />
      <span className="flex-1">
        <span className={`block ${titleClass}`}>{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{detail}</span>
      </span>
      <span className="num shrink-0">{aside}</span>
    </label>
  );
}
