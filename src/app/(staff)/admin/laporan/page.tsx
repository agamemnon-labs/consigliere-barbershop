import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db";
import { METHOD_LABEL } from "@/domain/checkout";
import { formatRupiah } from "@/domain/money";
import { checkRange } from "@/domain/report";
import { addDays, shopDate } from "@/domain/time";
import { buildReport, type Report } from "@/server/admin";
import { inputClass } from "../_ui/fields";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Laporan", robots: { index: false } };

export default function ReportPage({ searchParams }: PageProps<"/admin/laporan">) {
  return (
    <AdminShell title="Laporan">
      <Suspense fallback={<p className="text-muted">Menghitung…</p>}>
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

  return (
    <>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <form className="flex flex-wrap items-end gap-3" action="/admin/laporan">
          <label className="grid gap-1.5">
            <span className="label">Dari</span>
            <input type="date" name="dari" defaultValue={from} className={inputClass} />
          </label>
          <label className="grid gap-1.5">
            <span className="label">Sampai</span>
            <input type="date" name="sampai" defaultValue={to} className={inputClass} />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-sm border border-rule-strong px-4 hover:bg-surface"
          >
            Tampilkan
          </button>
        </form>
        <nav aria-label="Rentang cepat" className="flex gap-4">
          {presets.map(([text, a, b]) => (
            <Link
              key={text}
              href={`/admin/laporan?dari=${a}&sampai=${b}`}
              className={`min-h-11 content-center text-[0.9375rem] ${a === from && b === to ? "text-fg underline underline-offset-4" : "text-muted hover:text-fg"}`}
            >
              {text}
            </Link>
          ))}
        </nav>
      </div>
      {problem ? (
        <p className="mt-6 text-accent-ink">{problem}</p>
      ) : (
        <Body report={await buildReport(await getDb(), from, to)} />
      )}
    </>
  );
}

function Body({ report: r }: { report: Report }) {
  const csv = (kind: string) => `/admin/laporan/csv?jenis=${kind}&dari=${r.from}&sampai=${r.to}`;
  return (
    <>
      <dl className="mt-10 grid gap-6 border-y border-rule py-6 sm:grid-cols-3">
        <div>
          <dt className="label">Uang masuk</dt>
          <dd className="num mt-1 text-4xl">{formatRupiah(r.cash.total)}</dd>
        </div>
        <div>
          <dt className="label">Penjualan layanan</dt>
          <dd className="num mt-1 text-2xl">{formatRupiah(r.sales)}</dd>
        </div>
        <div>
          <dt className="label">Pelanggan selesai</dt>
          <dd className="num mt-1 text-2xl">{r.visits}</dd>
        </div>
      </dl>

      <Section title="Komisi barber" csv={csv("komisi")}>
        {r.commission.length === 0 ? (
          <Empty />
        ) : (
          <Table
            head={["Barber", "Layanan", "Penjualan", "Komisi"]}
            rows={r.commission.map((c) => [
              c.name,
              c.services,
              formatRupiah(c.sales),
              formatRupiah(c.commission),
            ])}
          />
        )}
      </Section>

      <Section title="Per cabang">
        {r.byBranch.length === 0 ? (
          <Empty />
        ) : (
          <Table
            head={["Cabang", "Layanan", "Penjualan"]}
            rows={r.byBranch.map((b) => [b.name, b.count, formatRupiah(b.amount)])}
          />
        )}
      </Section>

      <Section title="Layanan terlaris" csv={csv("penjualan")}>
        {r.byService.length === 0 ? (
          <Empty />
        ) : (
          <Table
            head={["Layanan", "Kali", "Penjualan"]}
            rows={r.byService.slice(0, 10).map((s) => [s.key, s.count, formatRupiah(s.amount)])}
          />
        )}
      </Section>

      <Section title="Cara bayar">
        {r.cash.byMethod.length + r.cash.prepaid.balance + r.cash.prepaid.credit === 0 ? (
          <Empty />
        ) : (
          <Table
            head={["Cara", "Jumlah"]}
            rows={[
              ...r.cash.byMethod.map((m) => [
                METHOD_LABEL[m.key as keyof typeof METHOD_LABEL] ?? m.key,
                formatRupiah(m.amount),
              ]),
              ...(r.cash.prepaid.balance
                ? [["Dari saldo member (sudah masuk saat top-up)", formatRupiah(r.cash.prepaid.balance)]]
                : []),
              ...(r.cash.prepaid.credit ? [["Dari kredit", formatRupiah(r.cash.prepaid.credit)]] : []),
            ]}
          />
        )}
      </Section>

      <Section title="Member dan saldo">
        <Table
          head={["", ""]}
          rows={[
            ["Biaya daftar member", formatRupiah(r.fees)],
            ["Uang top-up", formatRupiah(r.topups)],
            ["Bonus top-up diberikan", formatRupiah(r.liabilities.bonusGiven)],
            ["Saldo member tersimpan (semua)", formatRupiah(r.liabilities.balance)],
            ["Kredit belum dipakai (semua)", formatRupiah(r.liabilities.credit)],
          ]}
        />
      </Section>
    </>
  );
}

function Section({ title, csv, children }: { title: string; csv?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12" aria-label={title}>
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 className="text-xl">{title}</h2>
        {csv ? (
          <a href={csv} className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
            Unduh CSV
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-4 text-muted">Belum ada data di rentang ini</p>;
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-[0.9375rem]">
      <thead className={head.every((h, i) => i === 0 || !h) && !head[0] ? "sr-only" : ""}>
        <tr>
          {head.map((h, i) => (
            <th
              key={h || "label"}
              scope="col"
              className={`label py-2 font-medium ${i > 0 ? "text-right" : "text-left"}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])} className="border-t border-rule">
            {r.map((c, i) => (
              <td key={`${String(r[0])}-${head[i]}`} className={`py-2.5 ${i > 0 ? "num text-right" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
