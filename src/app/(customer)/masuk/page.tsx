import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { isDemoDatabase } from "@/db";
import { getMemberUserId } from "@/server/session";
import { MemberSignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Kartu member", robots: { index: false } };

/** Member login: WhatsApp number and PIN. Sign-up happens at the counter. */
export default function MemberSignInPage({ searchParams }: PageProps<"/masuk">) {
  return (
    <Screen back={{ href: "/", label: "Beranda" }}>
      <span className="pinstripe inline-flex h-12 w-18 items-end rounded-lg p-2" aria-hidden>
        <span className="h-1.5 w-6 rounded-full bg-navy-muted" />
      </span>
      <h1 className="mt-4 text-[2rem] leading-tight">Masuk kartu member</h1>
      <p className="mt-2 text-muted">Pakai nomor WhatsApp dan PIN-mu</p>
      <Suspense fallback={null}>
        <AlreadyIn searchParams={searchParams} />
      </Suspense>
      <div className="mt-6">
        <MemberSignInForm />
      </div>
      <p className="mt-3 text-center">
        <Link
          href="/masuk/lupa-pin"
          className="inline-flex min-h-12 items-center px-3 text-[0.9375rem] font-medium text-blue hover:underline"
        >
          Lupa PIN?
        </Link>
      </p>
      {isDemoDatabase() ? (
        <Notice tone="info" title="Mode demo" className="mt-4">
          Coba 0812-0000-0001 (sedang ulang tahun) atau 0812-0000-0002, PIN 482913.
        </Notice>
      ) : null}
      <p className="mt-6 text-center text-sm text-muted">Belum member? Daftar di kasir cabang mana saja</p>
    </Screen>
  );
}

async function AlreadyIn({ searchParams }: { searchParams: PageProps<"/masuk">["searchParams"] }) {
  if (await getMemberUserId()) redirect("/kartu");
  const { pin } = await searchParams;
  return pin === "baru" ? (
    <Notice tone="ok" title="PIN sudah diganti" className="mt-4">
      Silakan masuk dengan PIN yang baru.
    </Notice>
  ) : null;
}
