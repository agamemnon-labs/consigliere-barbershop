import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon, ChevronDownIcon } from "@/components/icons";
import { getDb } from "@/db";
import { phoneLabel } from "@/domain/booking";
import { formatRupiah } from "@/domain/money";
import { shortDate } from "@/domain/schedule";
import { shopDate } from "@/domain/time";
import { adjustMemberAction, updateMemberAction } from "@/server/actions/admin";
import { memberDetail } from "@/server/backoffice";
import { Input, inputClass } from "../../_ui/fields";
import { AdminForm } from "../../_ui/form";
import { AdminShell } from "../../_ui/shell";

export const metadata: Metadata = { title: "Member", robots: { index: false } };

export default function MemberPage({ params }: PageProps<"/admin/member/[id]">) {
  return (
    <AdminShell title="Member">
      <Suspense fallback={<div aria-busy className="h-40 rounded-2xl bg-sunk" />}>
        <Detail params={params} />
      </Suspense>
    </AdminShell>
  );
}

const REASON: Record<string, string> = {
  earn: "Kunjungan",
  redeem: "Tukar poin",
  topup: "Top-up",
  bonus: "Bonus top-up",
  spend: "Bayar",
  refund: "Refund",
  adjust: "Koreksi",
};

async function Detail({ params }: { params: PageProps<"/admin/member/[id]">["params"] }) {
  const { id } = await params;
  const m = await memberDetail(await getDb(), id, new Date());
  if (!m) notFound();
  const rows = [
    ...m.history.points.map((p) => ({
      id: p.id,
      at: p.createdAt,
      what: p.reason,
      value: `${p.delta > 0 ? "+" : ""}${p.delta} poin`,
    })),
    ...m.history.balance.map((b) => ({
      id: b.id,
      at: b.createdAt,
      what: b.ref && b.reason === "adjust" ? `adjust: ${b.ref}` : b.reason,
      value: formatRupiah(b.delta),
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <Link
        href="/admin/member"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[0.9375rem] font-medium hover:bg-sunk"
      >
        <ArrowLeftIcon />
        Semua member
      </Link>
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
        <div>
          <div className="pinstripe rounded-2xl p-5 text-suit-fg">
            <p className="condensed num text-lg text-suit-muted">{m.memberNo}</p>
            <p className="mt-1 text-2xl font-semibold">{m.name}</p>
            <p className="num text-suit-muted">{m.phone ? phoneLabel(m.phone) : ""}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-sm text-suit-muted">Poin</dt>
                <dd className="num text-xl font-semibold">{m.points}</dd>
              </div>
              <div>
                <dt className="text-sm text-suit-muted">Saldo</dt>
                <dd className="num text-xl font-semibold">{formatRupiah(m.balance)}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-rule bg-surface">
            <details className="row border-b border-rule">
              <summary className="flex min-h-14 items-center justify-between gap-4 px-4 font-medium hover:bg-bg">
                Ubah data
                <ChevronDownIcon className="row-mark text-faint" />
              </summary>
              <AdminForm
                action={updateMemberAction}
                submit="Simpan"
                className="px-4 pb-5"
                label="Ubah data member"
              >
                <input type="hidden" name="id" value={m.id} />
                <Input label="Nama" name="name" defaultValue={m.name} required />
                <Input label="Nomor member" name="memberNo" defaultValue={m.memberNo} required />
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium">Status</span>
                  <select name="status" defaultValue={m.status} className={inputClass}>
                    <option value="active">Aktif</option>
                    <option value="suspended">Nonaktif</option>
                  </select>
                </label>
              </AdminForm>
            </details>
            <details className="row">
              <summary className="flex min-h-14 items-center justify-between gap-4 px-4 font-medium hover:bg-bg">
                Koreksi poin atau saldo
                <ChevronDownIcon className="row-mark text-faint" />
              </summary>
              <AdminForm
                action={adjustMemberAction}
                submit="Simpan koreksi"
                className="px-4 pb-5"
                label="Koreksi"
              >
                <input type="hidden" name="id" value={m.id} />
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium">Yang dikoreksi</span>
                  <select name="kind" className={inputClass}>
                    <option value="balance">Saldo (rupiah)</option>
                    <option value="points">Poin</option>
                  </select>
                </label>
                <Input
                  label="Jumlah (pakai minus untuk mengurangi)"
                  name="delta"
                  inputMode="numeric"
                  required
                />
                <Input label="Alasan" name="reason" required />
              </AdminForm>
            </details>
          </div>
        </div>

        <section aria-label="Riwayat">
          <h2 className="text-xl">Riwayat</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-muted">Belum ada</p>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-2xl border border-rule bg-surface">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline gap-4 border-b border-rule px-4 py-2.5 text-[0.9375rem] last:border-b-0"
                >
                  <span className="num w-16 text-sm text-muted">
                    {shortDate(shopDate(r.at)).replace(/^\w+, /, "")}
                  </span>
                  <span className="flex-1">{REASON[r.what] ?? r.what}</span>
                  <span className="num">{r.value}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
