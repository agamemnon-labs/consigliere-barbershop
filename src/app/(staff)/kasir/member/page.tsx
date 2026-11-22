import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Notice } from "@/components/notice";
import { StaffShell } from "@/components/staff-shell";
import { getDb } from "@/db";
import { normalizePhone, phoneLabel } from "@/domain/booking";
import { formatRupiah } from "@/domain/money";
import { findMember, memberDesk } from "@/server/membership";
import { requireStaff } from "@/server/session";
import { SignUpForm, TopUpForm } from "./forms";

export const metadata: Metadata = { title: "Member", robots: { index: false } };

/** The counter's member desk: find a card, top it up, or sign someone up. */
export default function MemberDeskPage({ searchParams }: PageProps<"/kasir/member">) {
  return (
    <StaffShell title="Member" allow={["cashier", "admin", "owner"]}>
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
    <div className="mx-auto grid max-w-3xl gap-8 px-4 py-6 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <Link href="/kasir" className="label min-h-11 content-center hover:text-fg">
          ← Antrean
        </Link>
        <form className="flex flex-1 justify-end gap-2" action="/kasir/member">
          <label htmlFor="q" className="sr-only">
            Nomor kartu atau WhatsApp
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Scan kartu, atau ketik C00012 / 0812…"
            autoComplete="off"
            className="min-h-11 w-full max-w-sm border-0 border-b border-rule-strong bg-transparent outline-none focus:border-fg"
          />
          <button type="submit" className="label min-h-11 px-2 hover:text-fg">
            Cari
          </button>
        </form>
      </div>

      {moved !== null && member ? (
        <Notice title={`Member ${member.memberNo} terdaftar`}>
          Kartunya bisa dibuka di HP lewat menu Masuk, pakai nomor WhatsApp dan PIN tadi.
          {moved > 0 ? ` Kredit ${formatRupiah(moved)} sudah dipindah ke saldo.` : ""}
        </Notice>
      ) : null}

      {member ? (
        <section aria-label="Member" className="grid gap-6 sm:grid-cols-2">
          <div className="border border-rule bg-surface p-5">
            <p className="num text-accent-ink">{member.memberNo}</p>
            <p className="mt-1 font-display text-3xl">{member.name}</p>
            <p className="mt-1 text-muted">{phoneLabel(member.phone)}</p>
            <dl className="mt-5 grid grid-cols-2 gap-y-2">
              <dt className="label">Poin</dt>
              <dd className="num text-right text-xl">{member.points}</dd>
              <dt className="label">Saldo</dt>
              <dd className="num text-right text-xl">{formatRupiah(member.balance)}</dd>
            </dl>
            {member.birthday ? <p className="mt-4 text-accent-ink">Bulan ini ulang tahunnya.</p> : null}
            {member.status !== "active" ? <p className="mt-4 text-accent-ink">Kartu dinonaktifkan.</p> : null}
          </div>
          {member.status === "active" ? <TopUpForm memberId={member.id} packages={desk.packages} /> : null}
        </section>
      ) : q ? (
        <p className="text-muted">
          {phone
            ? "Nomor ini belum jadi member. Daftarkan di bawah."
            : `Tidak ada member dengan nomor “${q}”.`}
        </p>
      ) : null}

      {!member ? <SignUpForm fee={desk.fee} phone={phone ? phoneLabel(phone) : ""} /> : null}
    </div>
  );
}
