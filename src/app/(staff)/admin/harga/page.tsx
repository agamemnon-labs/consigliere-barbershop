import type { Metadata } from "next";
import { Suspense } from "react";
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
      <Suspense fallback={<p className="text-muted">Memuat…</p>}>
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
        <ul className="mt-3 border-t border-rule">
          {levels.map((l) => (
            <li key={l.id} className="border-b border-rule py-4">
              <AdminForm
                action={updateLevelAction}
                submit="Simpan"
                variant="quiet"
                label={`Level ${l.name}`}
                className="sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end"
              >
                <input type="hidden" name="id" value={l.id} />
                <p className="text-lg sm:pb-2">{l.name}</p>
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

      <section aria-label="Layanan" className="mt-12">
        <h2 className="text-xl">Layanan</h2>
        <ul className="mt-3 border-t border-rule">
          {services.map((svc) => (
            <li key={svc.id} className="border-b border-rule">
              <details className="row">
                <summary className="flex min-h-14 items-center justify-between gap-4 py-3">
                  <span className={svc.isActive ? "" : "text-muted line-through"}>{svc.name}</span>
                  <span className="num text-muted">{summaryPrice(svc)}</span>
                </summary>
                <AdminForm action={updateServiceAction} submit="Simpan" className="pb-5" label={svc.name}>
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
                    <p className="text-sm text-muted">Harganya ikut level barber, atur di atas.</p>
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
