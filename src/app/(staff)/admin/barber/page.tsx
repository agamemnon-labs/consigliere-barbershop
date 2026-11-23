import type { Metadata } from "next";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { ChevronDownIcon } from "@/components/icons";
import { getDb } from "@/db";
import { shopDate } from "@/domain/time";
import { changeLevelAction, setBarberActiveAction } from "@/server/actions/admin";
import { applyDueLevels, barberList } from "@/server/backoffice";
import { inputClass } from "../_ui/fields";
import { AdminForm } from "../_ui/form";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Barber", robots: { index: false } };

export default function BarbersPage() {
  return (
    <AdminShell title="Barber">
      <Suspense fallback={<div aria-busy className="h-40 rounded-2xl bg-sunk" />}>
        <Barbers />
      </Suspense>
    </AdminShell>
  );
}

async function Barbers() {
  const db = await getDb();
  const today = shopDate();
  await applyDueLevels(db, today);
  const { barbers, levels } = await barberList(db);
  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? "";
  return (
    <ul className="overflow-hidden rounded-2xl border border-rule bg-surface">
      {barbers.map((b) => (
        <li key={b.id} className="border-b border-rule last:border-b-0">
          <details className="row">
            <summary className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 hover:bg-bg">
              <span className="flex items-center gap-3">
                <Avatar name={b.name} size="sm" className={b.isActive ? "" : "opacity-50"} />
                <span>
                  <span className={`block font-semibold ${b.isActive ? "" : "text-muted line-through"}`}>
                    {b.name}
                  </span>
                  <span className="block text-sm text-muted">
                    {b.isActive ? levelName(b.levelId) : "Nonaktif"}
                  </span>
                </span>
              </span>
              <ChevronDownIcon className="row-mark text-faint" />
            </summary>
            <div className="grid gap-6 px-4 pb-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <AdminForm
                action={changeLevelAction}
                submit="Ubah level"
                variant="quiet"
                label={`Level ${b.name}`}
              >
                <input type="hidden" name="barberId" value={b.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Level</span>
                    <select name="levelId" defaultValue={b.levelId} className={inputClass}>
                      {levels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Mulai berlaku</span>
                    <input type="date" name="from" min={today} defaultValue={today} className={inputClass} />
                  </label>
                </div>
              </AdminForm>
              <AdminForm
                action={setBarberActiveAction}
                submit={b.isActive ? "Nonaktifkan" : "Aktifkan lagi"}
                variant="quiet"
                label={`Status ${b.name}`}
              >
                <input type="hidden" name="barberId" value={b.id} />
                <input type="hidden" name="active" value={b.isActive ? "0" : "1"} />
              </AdminForm>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
