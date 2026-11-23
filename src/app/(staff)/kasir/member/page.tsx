import type { Metadata } from "next";
import { Suspense } from "react";
import { buttonClass } from "@/components/button";
import { inputClass } from "@/components/field";
import { SearchIcon } from "@/components/icons";
import { Notice } from "@/components/notice";
import { StaffShell } from "@/components/staff-shell";
import { getDb } from "@/db";
import { normalizePhone, phoneLabel } from "@/domain/booking";
import { formatRupiah } from "@/domain/money";
import { findMember, memberDesk } from "@/server/membership";
import { requireStaff } from "@/server/session";
import { CashierTabs } from "../tabs";
import { SignUpForm, TopUpForm } from "./forms";

export const metadata: Metadata = { title: "Member", robots: { index: false } };

/** The counter's member desk: find a card, top it up, or sign someone up. */
export default function MemberDeskPage({ searchParams }: PageProps<"/kasir/member">) {
  return (
    <StaffShell title="Kasir" allow={["cashier", "admin", "owner"]} tabs={<CashierTabs />}>
      <Suspense fallback={<p className="p-6 text-muted">Memuat…</p>}>
        <Desk searchParams={searchParams} />
      </Suspense>
    </StaffShell>
  );
}

async function Desk({ searchParams }: { searchParams: PageProps<"/kasir/member">["searchParams"] }) {
  await requireStaff();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const moved = typeof params.baru === "string" ? Number(params.baru) : null;
  const db = await getDb();
  const [member, desk] = await Promise.all([q ? findMember(db, q, new Date()) : null, memberDesk(db)]);
  const phone = q && !member ? normalizePhone(q) : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[1.75rem] leading-tight">Member</h1>
        <p className="text-[0.9375rem] text-muted">
          Scan kartu atau ketik nomor untuk top-up, atau daftarkan member baru
        </p>
      </div>
      <form className="flex gap-2" action="/kasir/member">
        <label htmlFor="q" className="sr-only">
          Nomor kartu atau WhatsApp
        </label>
        <span className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="C00012 atau 0812…"
            autoComplete="off"
            className={`${inputClass} pl-11`}
          />
        </span>
        <button type="submit" className={`${buttonClass("dark")} px-6`}>
          Cari
        </button>
      </form>

      {moved !== null && member ? (
        <Notice tone="ok" title={`Member ${member.memberNo} terdaftar`}>
          Kartunya bisa dibuka di HP lewat menu Masuk, pakai nomor WhatsApp dan PIN tadi.
          {moved > 0 ? ` Kredit ${formatRupiah(moved)} sudah dipindah ke saldo.` : ""}
        </Notice>
      ) : null}

      {member ? (
        <section aria-label="Member" className="grid items-start gap-4 sm:grid-cols-2">
          <div className="pinstripe rounded-2xl p-5 text-suit-fg">
            <p className="condensed num text-lg text-suit-muted">{member.memberNo}</p>
            <p className="mt-1 text-2xl font-semibold">{member.name}</p>
            <p className="num text-suit-muted">{phoneLabel(member.phone)}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-sm text-suit-muted">Poin</dt>
                <dd className="num text-xl font-semibold">{member.points}</dd>
              </div>
              <div>
                <dt className="text-sm text-suit-muted">Saldo</dt>
                <dd className="num text-xl font-semibold">{formatRupiah(member.balance)}</dd>
              </div>
            </dl>
            {member.birthday ? (
              <p className="mt-4 rounded-lg bg-butter px-3 py-2 text-sm font-medium text-butter-ink">
                Bulan ini ulang tahunnya
              </p>
            ) : null}
            {member.status !== "active" ? (
              <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent-ink">
                Kartu dinonaktifkan
              </p>
            ) : null}
          </div>
          {member.status === "active" ? <TopUpForm memberId={member.id} packages={desk.packages} /> : null}
        </section>
      ) : q ? (
        <Notice tone="info" title={phone ? "Belum jadi member" : "Member tidak ditemukan"}>
          {phone ? "Nomor ini belum terdaftar. Daftarkan di bawah." : `Tidak ada member dengan nomor “${q}”.`}
        </Notice>
      ) : null}

      {!member ? <SignUpForm fee={desk.fee} phone={phone ? phoneLabel(phone) : ""} /> : null}
    </div>
  );
}
