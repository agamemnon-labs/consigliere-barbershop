import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/button";
import { ChevronRightIcon } from "@/components/icons";
import { getDb } from "@/db";
import { phoneLabel } from "@/domain/booking";
import { memberList } from "@/server/backoffice";
import { inputClass } from "../_ui/fields";
import { AdminShell } from "../_ui/shell";

export const metadata: Metadata = { title: "Member", robots: { index: false } };

export default function MembersPage({ searchParams }: PageProps<"/admin/member">) {
  return (
    <AdminShell title="Member">
      <Suspense fallback={<div aria-busy className="h-40 rounded-2xl bg-sunk" />}>
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
        <button type="submit" className={`${buttonClass("dark")} min-h-11`}>
          Cari
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="mt-5 text-muted">Tidak ada member yang cocok</p>
      ) : (
        <ul className="mt-5 overflow-hidden rounded-2xl border border-rule bg-surface">
          {rows.map((m) => (
            <li key={m.id} className="border-b border-rule last:border-b-0">
              <Link
                href={`/admin/member/${m.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-bg"
              >
                <Avatar name={m.name} size="sm" />
                <span className="flex-1">
                  <span className="block font-medium">{m.name}</span>
                  <span className="num block text-sm text-muted">{m.memberNo}</span>
                </span>
                <span className="num hidden text-sm text-muted sm:inline">
                  {m.phone ? phoneLabel(m.phone) : ""}
                </span>
                {m.status !== "active" ? (
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">
                    Nonaktif
                  </span>
                ) : null}
                <ChevronRightIcon size={18} className="text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
