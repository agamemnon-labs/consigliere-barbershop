import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { Notice } from "@/components/notice";
import { isDemoDatabase } from "@/db";
import { getMemberUserId } from "@/server/session";
import { MemberSignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Kartu member", robots: { index: false } };

/** Member login: WhatsApp number and PIN. Sign-up happens at the counter. */
export default function MemberSignInPage({ searchParams }: PageProps<"/masuk">) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/">Beranda</BackLink>
      <header className="pt-10 pb-8">
        <p className="label">Kartu member</p>
        <h1 className="mt-3 text-5xl leading-[1.05]">Masuk</h1>
        <p className="mt-4 text-muted">Pakai nomor WhatsApp dan PIN-mu</p>
      </header>
      <Suspense fallback={null}>
        <AlreadyIn searchParams={searchParams} />
      </Suspense>
      <MemberSignInForm />
      <p className="mt-6 text-center">
        <Link href="/masuk/lupa-pin" className="label min-h-12 content-center hover:text-fg">
          Lupa PIN?
        </Link>
      </p>
      {isDemoDatabase() ? (
        <div className="mt-8">
          <Notice title="Mode demo">
            Coba dengan 0812-0000-0001 (sedang ulang tahun) atau 0812-0000-0002, PIN 482913.
          </Notice>
        </div>
      ) : null}
      <p className="mt-12 text-center text-sm text-muted">Belum member? Daftar di kasir cabang mana saja</p>
      <Credits />
    </div>
  );
}

async function AlreadyIn({ searchParams }: { searchParams: PageProps<"/masuk">["searchParams"] }) {
  if (await getMemberUserId()) redirect("/kartu");
  const { pin } = await searchParams;
  return pin === "baru" ? (
    <div className="mb-8">
      <Notice title="PIN sudah diganti">Silakan masuk dengan PIN yang baru.</Notice>
    </div>
  ) : null;
}
