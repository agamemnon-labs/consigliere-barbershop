import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db";
import { mondayOf } from "@/domain/report";
import { DAY_NAMES, shortDate } from "@/domain/schedule";
import { addDays, shopDate, weekday } from "@/domain/time";
import { copyWeekAction, saveRotationAction } from "@/server/actions/admin";
import { rotationWeek } from "@/server/backoffice";
import { AdminForm } from "../_ui/form";
import { AdminShell } from "../_ui/shell";
import { Grid } from "./grid";

export const metadata: Metadata = { title: "Rotasi", robots: { index: false } };

export default function RotationPage({ searchParams }: PageProps<"/admin/rotasi">) {
  return (
    <AdminShell title="Rotasi barber">
      <Suspense fallback={<p className="text-muted">Memuat…</p>}>
        <Week searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}

async function Week({ searchParams }: { searchParams: PageProps<"/admin/rotasi">["searchParams"] }) {
  const { minggu } = await searchParams;
  const today = shopDate();
  const monday = mondayOf(typeof minggu === "string" && /^\d{4}-\d{2}-\d{2}$/.test(minggu) ? minggu : today);
  const week = await rotationWeek(await getDb(), monday);
  const link = (d: string) => `/admin/rotasi?minggu=${d}` as const;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={link(addDays(monday, -7))} className="min-h-11 content-center text-muted hover:text-fg">
            ← Minggu lalu
          </Link>
          <p className="text-lg">
            {shortDate(monday)} – {shortDate(addDays(monday, 6))}
          </p>
          <Link href={link(addDays(monday, 7))} className="min-h-11 content-center text-muted hover:text-fg">
            Minggu depan →
          </Link>
        </div>
        <AdminForm
          action={copyWeekAction}
          submit="Salin dari minggu lalu"
          variant="quiet"
          label="Salin minggu lalu"
        >
          <input type="hidden" name="monday" value={monday} />
        </AdminForm>
      </div>

      <AdminForm
        action={saveRotationAction}
        submit="Simpan rotasi"
        className="mt-6"
        label="Rotasi minggu ini"
      >
        <Grid
          key={monday}
          dates={week.dates.map((d) => ({
            date: d,
            day: DAY_NAMES[weekday(d)]?.slice(0, 3) ?? "",
            today: d === today,
          }))}
          branches={week.branches}
          rows={week.rows}
        />
      </AdminForm>
      <p className="mt-4 text-sm text-muted">
        Kosong berarti belum dijadwalkan. Pelanggan langsung melihat perubahan di halaman barber dan cabang.
      </p>
    </>
  );
}
