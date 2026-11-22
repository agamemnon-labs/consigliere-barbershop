import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
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
      <Suspense fallback={<p className="text-muted">Memuat…</p>}>
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
      <Link href="/admin/member" className="text-muted hover:text-fg">
        ← Semua member
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <p className="num text-accent-ink">{m.memberNo}</p>
          <p className="mt-1 font-display text-4xl">{m.name}</p>
          <p className="num mt-1 text-muted">{m.phone ? phoneLabel(m.phone) : ""}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-rule py-4">
            <div>
              <dt className="label">Poin</dt>
              <dd className="num mt-1 text-2xl">{m.points}</dd>
            </div>
            <div>
              <dt className="label">Saldo</dt>
              <dd className="num mt-1 text-2xl">{formatRupiah(m.balance)}</dd>
            </div>
          </dl>

          <details className="row mt-6 border-b border-rule">
            <summary className="flex min-h-12 items-center">Ubah data</summary>
            <AdminForm action={updateMemberAction} submit="Simpan" className="pb-5" label="Ubah data member">
              <input type="hidden" name="id" value={m.id} />
              <Input label="Nama" name="name" defaultValue={m.name} required />
              <Input label="Nomor member" name="memberNo" defaultValue={m.memberNo} required />
              <label className="grid gap-1.5">
                <span className="label">Status</span>
                <select name="status" defaultValue={m.status} className={inputClass}>
                  <option value="active">Aktif</option>
                  <option value="suspended">Nonaktif</option>
                </select>
              </label>
            </AdminForm>
          </details>
          <details className="row border-b border-rule">
            <summary className="flex min-h-12 items-center">Koreksi poin atau saldo</summary>
            <AdminForm action={adjustMemberAction} submit="Simpan koreksi" className="pb-5" label="Koreksi">
              <input type="hidden" name="id" value={m.id} />
              <label className="grid gap-1.5">
                <span className="label">Yang dikoreksi</span>
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

        <section aria-label="Riwayat">
          <h2 className="text-xl">Riwayat</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-muted">Belum ada</p>
          ) : (
            <ul className="mt-3 border-t border-rule">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline gap-4 border-b border-rule py-2.5 text-[0.9375rem]"
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
