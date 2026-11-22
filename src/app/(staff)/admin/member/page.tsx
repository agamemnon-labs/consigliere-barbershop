import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db";
import { phoneLabel } from "@/domain/booking";
import { memberList } from "@/server/backoffice";
import { inputClass } from "../_ui/fields";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Member", robots: { index: false } };

export default function MembersPage({ searchParams }: PageProps<"/admin/member">) {
  return (
    <AdminShell title="Member">
      <Suspense fallback={<p className="text-muted">Memuat…</p>}>
        <Members searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}

async function Members({ searchParams }: { searchParams: PageProps<"/admin/member">["searchParams"] }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await memberList(await getDb(), query);
  return (
    <>
      <form action="/admin/member" className="flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">
          Cari member
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Nama, nomor member, atau WhatsApp"
          className={inputClass}
        />
        <button type="submit" className="min-h-11 rounded-sm border border-rule-strong px-4 hover:bg-surface">
          Cari
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="mt-6 text-muted">Tidak ada member yang cocok</p>
      ) : (
        <ul className="mt-6 border-t border-rule">
          {rows.map((m) => (
            <li key={m.id} className="border-b border-rule">
              <Link
                href={`/admin/member/${m.id}`}
                className="flex min-h-14 items-center gap-4 py-3 hover:text-accent-ink"
              >
                <span className="num w-20 text-muted">{m.memberNo}</span>
                <span className="flex-1">{m.name}</span>
                <span className="num hidden text-sm text-muted sm:inline">
                  {m.phone ? phoneLabel(m.phone) : ""}
                </span>
                {m.status !== "active" ? <span className="text-sm text-accent-ink">Nonaktif</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
