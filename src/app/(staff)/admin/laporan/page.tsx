import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { buttonClass } from "@/components/button";
import { CalendarIcon } from "@/components/icons";
import { Notice } from "@/components/notice";
import { getDb } from "@/db";
import { METHOD_LABEL } from "@/domain/checkout";
import { formatRupiah } from "@/domain/money";
import { checkRange } from "@/domain/report";
import { shortDate } from "@/domain/schedule";
import { addDays, shopDate } from "@/domain/time";
import { buildReport, type Report } from "@/server/admin";
import { inputClass } from "../_ui/fields";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Laporan", robots: { index: false } };

export default function ReportPage({ searchParams }: PageProps<"/admin/laporan">) {
  return (
    <AdminShell title="Laporan">
      <Suspense fallback={<div aria-busy className="h-28 rounded-2xl bg-sunk" />}>
        <ReportView searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}

async function ReportView({ searchParams }: { searchParams: PageProps<"/admin/laporan">["searchParams"] }) {
  const params = await searchParams;
  const today = shopDate();
  const from = typeof params.dari === "string" ? params.dari : `${today.slice(0, 8)}01`;
  const to = typeof params.sampai === "string" ? params.sampai : today;
  const problem = checkRange(from, to);
  const presets = [
    ["Hari ini", today, today],
    ["7 hari", addDays(today, -6), today],
    ["Bulan ini", `${today.slice(0, 8)}01`, today],
  ] as const;

  const custom = !presets.some(([, a, b]) => a === from && b === to);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Rentang cepat" className="flex rounded-xl bg-sunk p-1">
          {presets.map(([text, a, b]) => (
            <Link
              key={text}
              href={`/admin/laporan?dari=${a}&sampai=${b}`}
              aria-current={a === from && b === to ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                a === from && b === to ? "bg-surface text-fg ring-1 ring-rule" : "text-muted hover:text-fg"
              }`}
            >
              {text}
            </Link>
          ))}
        </nav>
        <details className="row" open={custom}>
          <summary className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-blue hover:bg-blue-soft/50">
            <CalendarIcon size={18} />
            {custom ? `${shortDate(from)} sampai ${shortDate(to)}` : "Pilih tanggal"}
          </summary>
          <form className="mt-2 flex flex-wrap items-end gap-3" action="/admin/laporan">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Dari</span>
              <input type="date" name="dari" defaultValue={from} className={inputClass} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Sampai</span>
              <input type="date" name="sampai" defaultValue={to} className={inputClass} />
            </label>
            <button type="submit" className={`${buttonClass("dark")} min-h-11`}>
              Tampilkan
            </button>
          </form>
        </details>
      </div>
      {problem ? (
        <Notice tone="alert" title="Rentang tanggal belum pas" className="mt-5">
          {problem}
        </Notice>
      ) : (
        <Body report={await buildReport(await getDb(), from, to)} />
      )}
    </>
  );
}

function Body({ report: r }: { report: Report }) {
  const csv = (kind: string) => `/admin/laporan/csv?jenis=${kind}&dari=${r.from}&sampai=${r.to}`;
  const commissionTotal = r.commission.reduce((sum, c) => sum + c.commission, 0);
  return (
    <>
      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-navy p-4 text-navy-fg">
          <dt className="text-sm text-navy-muted">Uang masuk</dt>
          <dd className="num mt-0.5 text-[1.75rem] leading-tight font-semibold">
            {formatRupiah(r.cash.total)}
          </dd>
        </div>
        <Tile label="Penjualan layanan" value={formatRupiah(r.sales)} />
        <Tile label="Pelanggan selesai" value={r.visits.toLocaleString("id-ID")} />
      </dl>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <Panel
            title="Komisi barber"
            note={r.commission.length ? `Total ${formatRupiah(commissionTotal)}` : undefined}
            csv={csv("komisi")}
          >
            {r.commission.length === 0 ? (
              <Empty />
            ) : (
              <Bars
                unit="komisi"
                rows={r.commission.map((c) => ({
                  key: c.name,
                  label: c.name,
                  value: c.commission,
                  shown: formatRupiah(c.commission),
                  detail: `${c.services} layanan, penjualan ${formatRupiah(c.sales)}`,
                }))}
              />
            )}
          </Panel>
          <Panel title="Layanan terlaris" csv={csv("penjualan")}>
            {r.byService.length === 0 ? (
              <Empty />
            ) : (
              <Bars
                unit="penjualan"
                rows={r.byService.slice(0, 8).map((x) => ({
                  key: x.key,
                  label: x.key,
                  value: x.amount,
                  shown: formatRupiah(x.amount),
                  detail: `${x.count} kali`,
                }))}
              />
            )}
          </Panel>
        </div>
        <div className="grid gap-4">
          <Panel title="Per cabang">
            {r.byBranch.length === 0 ? (
              <Empty />
            ) : (
              <Bars
                unit="penjualan"
                rows={r.byBranch.map((b) => ({
                  key: b.name,
                  label: b.name,
                  value: b.amount,
                  shown: formatRupiah(b.amount),
                  detail: `${b.count} layanan`,
                }))}
              />
            )}
          </Panel>
          <Panel title="Cara bayar">
            {r.cash.byMethod.length + r.cash.prepaid.balance + r.cash.prepaid.credit === 0 ? (
              <Empty />
            ) : (
              <Lines
                rows={[
                  ...r.cash.byMethod.map(
                    (m) =>
                      [
                        METHOD_LABEL[m.key as keyof typeof METHOD_LABEL] ?? m.key,
                        formatRupiah(m.amount),
                      ] as const,
                  ),
                  ...(r.cash.prepaid.balance
                    ? [
                        [
                          "Dari saldo member (masuk saat top-up)",
                          formatRupiah(r.cash.prepaid.balance),
                        ] as const,
                      ]
                    : []),
                  ...(r.cash.prepaid.credit
                    ? [["Dari kredit", formatRupiah(r.cash.prepaid.credit)] as const]
                    : []),
                ]}
              />
            )}
          </Panel>
          <Panel title="Member dan saldo">
            <Lines
              rows={[
                ["Biaya daftar member", formatRupiah(r.fees)],
                ["Uang top-up", formatRupiah(r.topups)],
                ["Bonus top-up diberikan", formatRupiah(r.liabilities.bonusGiven)],
                ["Saldo member tersimpan (semua)", formatRupiah(r.liabilities.balance)],
                ["Kredit belum dipakai (semua)", formatRupiah(r.liabilities.credit)],
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num mt-0.5 text-[1.75rem] leading-tight font-semibold">{value}</dd>
    </div>
  );
}

function Panel({
  title,
  note,
  csv,
  children,
}: {
  title: string;
  note?: string;
  csv?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-rule bg-surface p-4" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg">{title}</h2>
          {note ? <p className="num text-sm text-muted">{note}</p> : null}
        </div>
        {csv ? (
          <a
            href={csv}
            className="inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-medium text-blue hover:bg-blue-soft/50"
          >
            Unduh CSV
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-2 text-muted">Belum ada data di rentang ini</p>;
}

type Bar = { key: string; label: string; value: number; shown: string; detail: string };

/**
 * Ranked bars, one series in one colour: the label and figure on a line, a thin bar under it
 * scaled to the largest row, and the detail on hover and for screen readers.
 */
function Bars({ rows, unit }: { rows: Bar[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="grid gap-3">
      {rows.map((r) => (
        <li key={r.key} title={r.detail}>
          <p className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
            <span className="truncate">{r.label}</span>
            <span className="num shrink-0 font-semibold">{r.shown}</span>
          </p>
          <span
            className="mt-1 block h-2 rounded-r-sm bg-sunk"
            role="img"
            aria-label={`${r.label}: ${r.detail}`}
          >
            <span
              className="block h-full rounded-r-sm bg-blue"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </span>
        </li>
      ))}
      <li className="sr-only">Panjang batang menunjukkan {unit}</li>
    </ol>
  );
}

function Lines({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="text-[0.9375rem]">
      {rows.map(([term, value]) => (
        <div
          key={term}
          className="flex items-baseline justify-between gap-4 border-t border-rule py-2.5 first:border-t-0 first:pt-0"
        >
          <dt className="text-muted">{term}</dt>
          <dd className="num font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
