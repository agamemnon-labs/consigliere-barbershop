import type { Metadata } from "next";
import { Suspense } from "react";
import { PlusIcon } from "@/components/icons";
import { getDb } from "@/db";
import { savePackageAction, saveRulesAction } from "@/server/actions/admin";
import { rules } from "@/server/backoffice";
import { Check, Input } from "../_ui/fields";
import { AdminForm } from "../_ui/form";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Aturan", robots: { index: false } };

export default function RulesPage() {
  return (
    <AdminShell title="Aturan">
      <Suspense fallback={<div aria-busy className="h-40 rounded-2xl bg-sunk" />}>
        <Rules />
      </Suspense>
    </AdminShell>
  );
}

const rp = (n: number) => n.toLocaleString("id-ID");
const CATEGORY = [
  ["haircut", "Haircut"],
  ["chemical", "Chemical"],
  ["refreshment", "Refreshment"],
  ["package", "Paket"],
] as const;

async function Rules() {
  const r = await rules(await getDb());
  return (
    <>
      <AdminForm action={saveRulesAction} submit="Simpan aturan" label="Aturan">
        <Group title="Member">
          <Input
            label="Biaya daftar (Rp)"
            name="membershipFee"
            inputMode="numeric"
            defaultValue={rp(r.membershipFee)}
            required
          />
          <Input
            label="Belanja per 1 poin (Rp)"
            name="earnPer"
            inputMode="numeric"
            defaultValue={rp(r.points.earnPer)}
            required
          />
          <Input
            label="Poin untuk 1 potongan"
            name="redeemPoints"
            inputMode="numeric"
            defaultValue={String(r.points.redeemPoints)}
            required
          />
          <Input
            label="Nilai 1 potongan (Rp)"
            name="redeemValue"
            inputMode="numeric"
            defaultValue={rp(r.points.redeemValue)}
            required
          />
        </Group>
        <Group title="Ulang tahun">
          <Input
            label="Diskon (%)"
            name="birthdayPercent"
            inputMode="numeric"
            defaultValue={String(r.birthday.percent)}
            required
          />
          <fieldset className="grid gap-1 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">Berlaku untuk</legend>
            <div className="flex flex-wrap gap-x-6">
              {CATEGORY.map(([value, text]) => (
                <Check
                  key={value}
                  label={text}
                  name="birthdayCategory"
                  value={value}
                  defaultChecked={r.birthday.categories.includes(value)}
                />
              ))}
            </div>
          </fieldset>
          <Check
            label="Boleh digabung dengan tukar poin"
            name="stacksWithPoints"
            defaultChecked={r.birthday.stacksWithPoints}
          />
        </Group>
        <Group title="Antrean dan kredit">
          <Input
            label="Waktu datang setelah dipanggil (menit)"
            name="graceMinutes"
            inputMode="numeric"
            defaultValue={String(r.graceMinutes)}
            required
          />
          <Input
            label="Batas bayar booking online (menit)"
            name="pendingMinutes"
            inputMode="numeric"
            defaultValue={String(r.pendingMinutes)}
            required
          />
          <Input
            label="Antrean online tutup sebelum jam tutup (menit)"
            name="onlineClosesBefore"
            inputMode="numeric"
            defaultValue={String(r.onlineClosesBefore)}
            required
          />
          <Input
            label="Kredit berlaku (hari)"
            name="creditDays"
            inputMode="numeric"
            defaultValue={String(r.creditDays)}
            required
          />
        </Group>
        <Group title="Komisi">
          <Input
            label="Komisi layanan selain haircut (%)"
            name="commissionPercent"
            inputMode="decimal"
            defaultValue={String(r.commissionPercent)}
            required
          />
          <p className="text-sm text-muted sm:col-span-2 sm:self-end sm:pb-3">
            Komisi haircut diatur per level di Harga
          </p>
        </Group>
      </AdminForm>

      <section aria-label="Paket top-up" className="mt-8">
        <h2 className="text-xl">Paket top-up</h2>
        <ul className="mt-3 overflow-hidden rounded-2xl border border-rule bg-surface">
          {r.packages.map((p) => (
            <li key={p.id} className="border-b border-rule px-4 py-4 last:border-b-0">
              <AdminForm
                action={savePackageAction}
                submit="Simpan"
                variant="quiet"
                label={`Paket ${rp(p.pay)}`}
                className="sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <input type="hidden" name="id" value={p.id} />
                <Input label="Bayar (Rp)" name="pay" inputMode="numeric" defaultValue={rp(p.pay)} required />
                <Input
                  label="Dapat saldo (Rp)"
                  name="get"
                  inputMode="numeric"
                  defaultValue={rp(p.get)}
                  required
                />
                <Check label="Aktif" name="isActive" defaultChecked={p.isActive} />
              </AdminForm>
            </li>
          ))}
        </ul>
        <details className="row mt-3 rounded-2xl border border-dashed border-rule-strong">
          <summary className="flex min-h-12 items-center gap-1.5 px-4 font-medium text-blue">
            <PlusIcon size={18} />
            Paket baru
          </summary>
          <AdminForm
            action={savePackageAction}
            submit="Tambah paket"
            label="Paket baru"
            className="px-4 pb-5 sm:grid-cols-2"
          >
            <Input label="Bayar (Rp)" name="pay" inputMode="numeric" required />
            <Input label="Dapat saldo (Rp)" name="get" inputMode="numeric" required />
          </AdminForm>
        </details>
      </section>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-2xl border border-rule bg-surface p-4 sm:grid-cols-2">
      <legend className="float-left mb-1 w-full text-lg font-semibold [font-stretch:110%]">{title}</legend>
      {children}
    </fieldset>
  );
}
