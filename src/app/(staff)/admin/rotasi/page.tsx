import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon } from "@/components/icons";
import { getDb } from "@/db";
import { mondayOf } from "@/domain/report";
import { DAY_NAMES, shortDate } from "@/domain/schedule";
import { addDays, shopDate, weekday } from "@/domain/time";
import { copyWeekAction, saveRotationAction } from "@/server/actions/admin";
import { rotationWeek } from "@/server/backoffice";
import { AdminForm } from "../_ui/form";
import { AdminShell } from "../_ui/shell";
import { Grid } from "./grid";

const STEP =
  "inline-flex size-11 items-center justify-center rounded-xl border border-rule-strong bg-surface hover:border-fg";

export const metadata: Metadata = { title: "Rotasi", robots: { index: false } };

export default function RotationPage({ searchParams }: PageProps<"/admin/rotasi">) {
  return (
    <AdminShell title="Rotasi barber">
      <Suspense fallback={<div aria-busy className="h-40 rounded-2xl bg-sunk" />}>
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
        <div className="flex items-center gap-2">
          <Link href={link(addDays(monday, -7))} aria-label="Minggu lalu" className={STEP}>
            <ArrowLeftIcon />
          </Link>
          <p className="num text-lg font-medium">
            {shortDate(monday)} sampai {shortDate(addDays(monday, 6))}
          </p>
          <Link href={link(addDays(monday, 7))} aria-label="Minggu depan" className={STEP}>
            <ArrowLeftIcon className="rotate-180" />
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
        className="mt-4"
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
      <p className="mt-4 text-sm text-muted">Kosong berarti belum dijadwalkan</p>
    </>
  );
}
