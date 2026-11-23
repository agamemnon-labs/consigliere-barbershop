import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  CardIcon,
  ChartIcon,
  ChevronRightIcon,
  MonitorIcon,
  TicketIcon,
  WalletIcon,
} from "@/components/icons";
import { Screen } from "@/components/screen";
import { demoSignIn } from "@/server/actions/demo";
import { demoMode } from "@/server/env";

export const metadata: Metadata = { title: "Coba demo", robots: { index: false } };

type Icon = ComponentType<{ size?: number }>;

const roles = [
  {
    as: "member",
    title: "Member",
    detail: "Kartu, poin, isi saldo dari HP",
    icon: CardIcon,
    tile: "bg-navy text-navy-fg",
  },
  {
    as: "cashier",
    title: "Kasir Pulau Kalimantan",
    detail: "Papan antrean, panggil, bayar",
    icon: WalletIcon,
    tile: "bg-butter text-butter-ink",
  },
  {
    as: "owner",
    title: "Pemilik",
    detail: "Laporan, komisi, rotasi, harga",
    icon: ChartIcon,
    tile: "bg-blue-soft text-blue",
  },
] as const;

/** The guided demo: one tap to see the app from each side of the counter. */
export default function DemoPage() {
  if (!demoMode()) notFound();
  return (
    <Screen back={{ href: "/", label: "Beranda" }}>
      <h1 className="text-[2rem] leading-tight">Coba sebagai siapa?</h1>
      <p className="mt-2 text-muted">Satu ketuk, langsung masuk. Data direset tiap malam</p>

      <h2 className="mt-7 mb-2 text-[0.9375rem] font-medium text-muted">Tanpa login</h2>
      <ul className="overflow-hidden rounded-2xl border border-rule bg-surface">
        <Row
          as={(c) => (
            <Link href="/antre" className={c}>
              <Inner
                icon={TicketIcon}
                tile="bg-accent text-accent-fg"
                title="Pelanggan"
                detail="Ambil nomor dan bayar QRIS"
              />
            </Link>
          )}
        />
        <Row
          as={(c) => (
            <Link href="/tablet/pulau-kalimantan" className={c}>
              <Inner
                icon={MonitorIcon}
                tile="bg-mint text-mint-ink"
                title="Layar tablet"
                detail="Nomor yang dipanggil di toko"
              />
            </Link>
          )}
        />
      </ul>

      <h2 className="mt-6 mb-2 text-[0.9375rem] font-medium text-muted">Masuk sebagai</h2>
      <ul className="overflow-hidden rounded-2xl border border-rule bg-surface">
        {roles.map((r) => (
          <Row
            key={r.as}
            as={(c) => (
              <form action={demoSignIn.bind(null, r.as)}>
                <button type="submit" className={`${c} w-full text-left`}>
                  <Inner icon={r.icon} tile={r.tile} title={r.title} detail={r.detail} />
                </button>
              </form>
            )}
          />
        ))}
      </ul>
    </Screen>
  );
}

function Row({ as }: { as: (className: string) => ReactNode }) {
  return (
    <li className="border-b border-rule last:border-b-0">
      {as("flex min-h-18 items-center gap-3 px-4 py-3 transition-colors hover:bg-bg")}
    </li>
  );
}

function Inner({
  icon: I,
  tile,
  title,
  detail,
}: {
  icon: Icon;
  tile: string;
  title: string;
  detail: string;
}) {
  return (
    <>
      <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${tile}`}>
        <I size={22} />
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
      <ChevronRightIcon className="text-faint" />
    </>
  );
}
