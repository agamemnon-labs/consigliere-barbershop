"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/button";
import { Choice } from "@/components/choice";
import { Field } from "@/components/field";
import { ArrowLeftIcon, ChevronDownIcon, ScissorsIcon } from "@/components/icons";
import { Mark } from "@/components/mark";
import { Notice } from "@/components/notice";
import { Steps } from "@/components/steps";
import { type LineItem, priceItem, shortestWait, totals } from "@/domain/booking";
import { formatRupiah, formatShort } from "@/domain/money";
import { type BookState, book } from "@/server/actions/booking";
import type { BookingOptions } from "@/server/booking";

type Options = NonNullable<BookingOptions>;
type Service = Options["services"][number];

const EXTRAS: { key: string; label: string }[] = [
  { key: "refreshment", label: "Perawatan" },
  { key: "chemical", label: "Chemical" },
  { key: "package", label: "Paket" },
];

/** Steps 2 to 4 of taking a number, one job per screen. The branch was step 1. */
export function BookingFlow({
  options,
  demo,
  demoHours,
}: {
  options: Options;
  demo: boolean;
  demoHours: boolean;
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(book, {});
  const [step, setStep] = useState<2 | 3 | 4>(2);
  const fastest = shortestWait(options.barbers);
  const [barberId, setBarberId] = useState<string>("any");
  const haircut = options.services.find((x) => x.priceType === "by_level");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(haircut ? [haircut.id] : []));
  const [variants, setVariants] = useState<Record<string, string>>({});
  const top = useRef<HTMLDivElement>(null);

  // A server error is always about the last step (name, number, or the queue moved).
  useEffect(() => {
    if (state.error) setStep(4);
  }, [state.error]);

  const barber = barberId === "any" ? fastest : options.barbers.find((b) => b.id === barberId);
  const items: LineItem[] = [];
  for (const svc of options.services) {
    if (!picked.has(svc.id)) continue;
    const variantId = variants[svc.id] ?? svc.variants[0]?.id;
    items.push(priceItem(svc, barber?.haircutPrice ?? 0, variantId));
  }
  const { amount, durationMin } = totals(items);

  function go(next: 2 | 3 | 4) {
    setStep(next);
    top.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  }

  function toggle(id: string, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function priceOf(svc: Service) {
    if (svc.priceType === "by_level") return barber?.haircutPrice ?? 0;
    if (svc.priceType === "variant")
      return svc.variants.find((v) => v.id === (variants[svc.id] ?? svc.variants[0]?.id))?.price ?? 0;
    return svc.price ?? 0;
  }

  const back =
    step === 2 ? (
      <Link
        href="/antre"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[0.9375rem] font-medium hover:bg-sunk"
      >
        <ArrowLeftIcon />
        Ganti cabang
      </Link>
    ) : (
      <button
        type="button"
        onClick={() => go((step - 1) as 2 | 3)}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[0.9375rem] font-medium hover:bg-sunk"
      >
        <ArrowLeftIcon />
        Kembali
      </button>
    );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-rule bg-bg">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-4 px-4">
          {back}
          <span className="text-[0.9375rem] font-semibold">{options.branch.name}</span>
        </div>
      </header>

      <form
        action={action}
        className="mx-auto flex max-w-md flex-col px-4 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]"
      >
        <div ref={top} className="scroll-mt-20" />
        <input type="hidden" name="branch" value={options.branch.slug} />
        <Steps at={step} of={4} />

        {/* Step 2: barber */}
        <div hidden={step !== 2} className="step-in mt-6">
          <h1 className="text-[2rem] leading-tight">Mau dicukur siapa?</h1>
          <p className="mt-2 text-muted">Harga potong ikut level barbernya</p>
          {demoHours ? (
            <Notice title="Mode demo" tone="info" className="mt-4">
              Jam buka diabaikan supaya bisa dicoba kapan saja
            </Notice>
          ) : null}
          <fieldset className="mt-5 grid gap-2.5">
            <legend className="sr-only">Barber</legend>
            {fastest ? (
              <Choice
                type="radio"
                name="barber"
                value="any"
                checked={barberId === "any"}
                onChange={() => setBarberId("any")}
                lead={
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sunk">
                    <Mark className="h-6 text-suit" />
                  </span>
                }
                title="Siapa saja, paling cepat"
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
                lead={<Avatar name={b.name} />}
                title={b.name}
                tag={b.level}
                detail={b.waiting > 0 ? `${b.waiting} antre, ± ${b.waitMin} mnt` : "Kursi kosong"}
                detailTone={b.waiting > 0 ? "muted" : "ok"}
                aside={formatShort(b.haircutPrice)}
              />
            ))}
          </fieldset>
        </div>

        {/* Step 3: services */}
        <div hidden={step !== 3} className="step-in mt-6">
          <h1 className="text-[2rem] leading-tight">Mau layanan apa?</h1>
          <p className="mt-2 text-muted">Haircut sudah termasuk cuci, pijat dan styling</p>
          <fieldset className="mt-5 grid gap-2.5">
            <legend className="sr-only">Layanan</legend>
            {options.services
              .filter((s) => s.category === "haircut")
              .map((svc) => (
                <ServiceChoice
                  key={svc.id}
                  svc={svc}
                  on={picked.has(svc.id)}
                  price={priceOf(svc)}
                  onToggle={toggle}
                  variant={variants[svc.id]}
                  onVariant={(v) => setVariants((m) => ({ ...m, [svc.id]: v }))}
                />
              ))}
          </fieldset>
          <h2 className="mt-8 text-lg">Tambah layanan lain</h2>
          <div className="mt-3 grid gap-2.5">
            {EXTRAS.map(({ key, label }) => {
              const list = options.services.filter((s) => s.category === key);
              if (list.length === 0) return null;
              const count = list.filter((s) => picked.has(s.id)).length;
              return (
                <details key={key} className="row rounded-2xl bg-surface" open={count > 0}>
                  <summary className="flex min-h-14 items-center gap-3 px-4">
                    <span className="flex-1 font-medium">{label}</span>
                    {count > 0 ? (
                      <span className="num rounded-md bg-blue-soft px-1.5 py-0.5 text-xs font-semibold text-blue">
                        {count} dipilih
                      </span>
                    ) : (
                      <span className="text-sm text-faint">{list.length} pilihan</span>
                    )}
                    <ChevronDownIcon size={18} className="row-mark text-faint" />
                  </summary>
                  <fieldset className="grid gap-2 px-2 pb-2">
                    <legend className="sr-only">{label}</legend>
                    {list.map((svc) => (
                      <ServiceChoice
                        key={svc.id}
                        svc={svc}
                        on={picked.has(svc.id)}
                        price={priceOf(svc)}
                        onToggle={toggle}
                        variant={variants[svc.id]}
                        onVariant={(v) => setVariants((m) => ({ ...m, [svc.id]: v }))}
                        inset
                      />
                    ))}
                  </fieldset>
                </details>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-faint">Coloring dibayar di kasir, harganya tergantung rambut</p>
        </div>

        {/* Step 4: name, number, pay */}
        <div hidden={step !== 4} className="step-in mt-6">
          <h1 className="text-[2rem] leading-tight">Atas nama siapa?</h1>
          <p className="mt-2 text-muted">Layar di toko cuma menampilkan nomor, bukan nama</p>
          <div className="mt-5 grid gap-5">
            <Field
              label="Nama panggilan"
              name="name"
              autoComplete="given-name"
              maxLength={60}
              required
              enterKeyHint="next"
              defaultValue={state.values?.name}
            />
            <Field
              label="Nomor WhatsApp"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              enterKeyHint="done"
              defaultValue={state.values?.phone}
              hint="Kami kabari kalau giliranmu sudah dekat"
            />
          </div>

          <section className="mt-6 rounded-2xl bg-surface p-4" aria-label="Ringkasan">
            <div className="flex items-center gap-3 border-b border-rule pb-3">
              {barber ? <Avatar name={barber.name} size="sm" /> : null}
              <p className="flex-1">
                <span className="block font-semibold">{barber?.name ?? "Barber"}</span>
                <span className="block text-sm text-muted">
                  {barberId === "any" ? "Yang paling cepat" : "Pilihanmu"}, {options.branch.name}
                </span>
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-muted">
                <ScissorsIcon size={16} />
                <span className="num">{durationMin} mnt</span>
              </span>
            </div>
            <ul className="grid gap-1.5 pt-3 text-[0.9375rem]">
              {items.map((i) => (
                <li key={i.serviceId} className="flex items-baseline">
                  <span>{i.name}</span>
                  <span className="leader" aria-hidden />
                  <span className="num">{formatRupiah(i.price)}</span>
                </li>
              ))}
            </ul>
          </section>
          <p className="mt-3 text-sm text-faint">
            Bayar dalam 15 menit lewat QRIS{demo ? ", pakai uang demo" : ""}. Nomormu langsung masuk antrean
          </p>
          {state.error ? (
            <Notice title="Belum bisa lanjut" tone="alert" className="mt-4">
              <span role="alert">{state.error}</span>
            </Notice>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-md items-center gap-4 px-4 py-3">
            <p className="shrink-0">
              <span className="block text-xs text-faint">Total</span>
              <span className="num block text-lg font-semibold leading-tight">{formatRupiah(amount)}</span>
            </p>
            {step < 4 ? (
              <button
                type="button"
                className={`${buttonClass("dark")} flex-1`}
                disabled={items.length === 0}
                onClick={() => go((step + 1) as 3 | 4)}
              >
                Lanjut
              </button>
            ) : (
              <button
                type="submit"
                className={`${buttonClass("primary")} flex-1`}
                disabled={pending || items.length === 0}
              >
                {pending ? "Menyiapkan QRIS…" : `Bayar ${formatShort(amount)} pakai QRIS`}
              </button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}

function ServiceChoice({
  svc,
  on,
  price,
  onToggle,
  variant,
  onVariant,
  inset = false,
}: {
  svc: Service;
  on: boolean;
  price: number;
  onToggle: (id: string, on: boolean) => void;
  variant: string | undefined;
  onVariant: (id: string) => void;
  inset?: boolean;
}) {
  return (
    <div>
      <Choice
        type="checkbox"
        name="service"
        value={svc.id}
        checked={on}
        onChange={(e) => onToggle(svc.id, e.currentTarget.checked)}
        title={svc.name}
        detail={`± ${svc.durationMin} mnt`}
        aside={formatShort(price)}
        inset={inset}
      />
      {on && svc.variants.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2 px-2">
          {svc.variants.map((v) => (
            <label
              key={v.id}
              className="relative flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-xl bg-surface px-3 ring-1 ring-rule-strong has-checked:ring-2 has-checked:ring-blue"
            >
              <input
                type="radio"
                name={`variant-${svc.id}`}
                value={v.id}
                checked={(variant ?? svc.variants[0]?.id) === v.id}
                onChange={() => onVariant(v.id)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{v.name}</span>
              <span className="num text-sm text-muted">{formatShort(v.price)}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
