import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { Rule } from "@/components/rule";
import { demoSignIn } from "@/server/actions/demo";
import { demoMode } from "@/server/env";

export const metadata: Metadata = { title: "Coba demo", robots: { index: false } };

const roles = [
  { as: "member", title: "Member", detail: "Kartu, poin, isi saldo dari HP" },
  { as: "cashier", title: "Kasir Juanda", detail: "Papan antrean, panggil, bayar" },
  { as: "owner", title: "Pemilik", detail: "Laporan, komisi, rotasi, harga" },
] as const;

/** The guided demo: one tap to see the app from each side of the counter. */
export default function DemoPage() {
  if (!demoMode()) notFound();
  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/">Beranda</BackLink>
      <header className="pt-10 pb-10">
        <p className="label">Demo</p>
        <h1 className="mt-3 text-5xl leading-[1.05]">Coba sebagai</h1>
        <p className="mt-4 text-muted">Satu ketuk, langsung masuk. Data direset tiap malam</p>
      </header>

      <Rule label="Tanpa login" />
      <ul className="mt-2">
        <Row href="/antre" title="Pelanggan" detail="Ambil nomor dan bayar QRIS" />
        <Row href="/tablet/juanda" title="Layar tablet" detail="Nomor yang dipanggil di toko" />
      </ul>

      <Rule label="Masuk sebagai" className="mt-10" />
      <ul className="mt-2">
        {roles.map((r) => (
          <li key={r.as} className="border-b border-rule">
            <form action={demoSignIn.bind(null, r.as)}>
              <button
                type="submit"
                className="group flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left"
              >
                <span>
                  <span className="block font-display text-xl group-hover:text-accent-ink">{r.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{r.detail}</span>
                </span>
                <span aria-hidden className="text-muted">
                  →
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
      <Credits />
    </div>
  );
}

function Row({ href, title, detail }: { href: "/antre" | "/tablet/juanda"; title: string; detail: string }) {
  return (
    <li className="border-b border-rule">
      <Link href={href} className="group flex min-h-16 items-center justify-between gap-4 py-3">
        <span>
          <span className="block font-display text-xl group-hover:text-accent-ink">{title}</span>
          <span className="mt-0.5 block text-sm text-muted">{detail}</span>
        </span>
        <span aria-hidden className="text-muted">
          →
        </span>
      </Link>
    </li>
  );
}
