import type { Metadata } from "next";
import { Suspense } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { getDb } from "@/db";
import { formatRupiah } from "@/domain/money";
import { updateLevelAction, updateServiceAction } from "@/server/actions/admin";
import { priceBook } from "@/server/backoffice";
import { Check, Input } from "../_ui/fields";
import { AdminForm } from "../_ui/form";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Harga", robots: { index: false } };

export default function PricesPage() {
  return (
    <AdminShell title="Harga dan layanan">
      <Suspense fallback={<div aria-busy className="h-40 rounded-2xl bg-sunk" />}>
        <Prices />
      </Suspense>
    </AdminShell>
  );
}

const rp = (n: number | null) => (n === null ? "" : n.toLocaleString("id-ID"));

async function Prices() {
  const { services, levels } = await priceBook(await getDb());
  return (
    <>
      <section aria-label="Haircut per level">
        <h2 className="text-xl">Haircut per level barber</h2>
        <ul className="mt-3 overflow-hidden rounded-2xl border border-rule bg-surface">
          {levels.map((l) => (
            <li key={l.id} className="border-b border-rule px-4 py-4 last:border-b-0">
              <AdminForm
                action={updateLevelAction}
                submit="Simpan"
                variant="quiet"
                label={`Level ${l.name}`}
                className="sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end"
              >
                <input type="hidden" name="id" value={l.id} />
                <p className="text-lg font-semibold [font-stretch:110%] sm:pb-2">{l.name}</p>
                <Input
                  label="Harga haircut"
                  name="haircutPrice"
                  inputMode="numeric"
                  defaultValue={rp(l.haircutPrice)}
                  required
                />
                <Input
                  label="Komisi barber (%)"
                  name="commission"
                  inputMode="decimal"
                  defaultValue={String(l.commissionBps / 100)}
                  required
                />
              </AdminForm>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Layanan" className="mt-8">
        <h2 className="text-xl">Layanan</h2>
        <ul className="mt-3 overflow-hidden rounded-2xl border border-rule bg-surface">
          {services.map((svc) => (
            <li key={svc.id} className="border-b border-rule last:border-b-0">
              <details className="row">
                <summary className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 hover:bg-bg">
                  <span className={`flex-1 ${svc.isActive ? "font-medium" : "text-muted line-through"}`}>
                    {svc.name}
                  </span>
                  <span className="num text-muted">{summaryPrice(svc)}</span>
                  <ChevronDownIcon size={18} className="row-mark text-faint" />
                </summary>
                <AdminForm
                  action={updateServiceAction}
                  submit="Simpan"
                  className="px-4 pb-5"
                  label={svc.name}
                >
                  <input type="hidden" name="id" value={svc.id} />
                  <div className="grid gap-4 sm:grid-cols-3">
                    {svc.priceType === "fixed" ? (
                      <Input
                        label="Harga"
                        name="price"
                        inputMode="numeric"
                        defaultValue={rp(svc.price)}
                        required
                      />
                    ) : null}
                    {svc.priceType === "from" ? (
                      <Input
                        label="Harga mulai dari"
                        name="priceFrom"
                        inputMode="numeric"
                        defaultValue={rp(svc.priceFrom)}
                        required
                      />
                    ) : null}
                    {svc.variants.map((v) => (
                      <Input
                        key={v.id}
                        label={`Harga ${v.name}`}
                        name={`variant:${v.id}`}
                        inputMode="numeric"
                        defaultValue={rp(v.price)}
                        required
                      />
                    ))}
                    <Input
                      label="Durasi (menit)"
                      name="durationMin"
                      inputMode="numeric"
                      defaultValue={String(svc.durationMin)}
                      required
                    />
                  </div>
                  {svc.priceType === "by_level" ? (
                    <p className="text-sm text-muted">Harganya ikut level barber, atur di atas</p>
                  ) : null}
                  <Check label="Tampil dan bisa dipesan" name="isActive" defaultChecked={svc.isActive} />
                </AdminForm>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function summaryPrice(svc: Awaited<ReturnType<typeof priceBook>>["services"][number]) {
  if (svc.priceType === "fixed" && svc.price !== null) return formatRupiah(svc.price);
  if (svc.priceType === "from" && svc.priceFrom !== null) return `mulai ${formatRupiah(svc.priceFrom)}`;
  if (svc.priceType === "variant" && svc.variants[0])
    return `mulai ${formatRupiah(Math.min(...svc.variants.map((v) => v.price)))}`;
  return "ikut level";
}
