import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/button";
import { ChevronDownIcon, LogOutIcon, PlusIcon } from "@/components/icons";
import { Notice } from "@/components/notice";
import { Pole } from "@/components/pole";
import { QrCode } from "@/components/qr-code";
import { Screen } from "@/components/screen";
import { brand } from "@/config/brand";
import { getDb } from "@/db";
import { formatRupiah } from "@/domain/money";
import { shortDate } from "@/domain/schedule";
import { shopDate } from "@/domain/time";
import { signOutMember } from "@/server/actions/membership";
import { memberCard } from "@/server/membership";
import { requireMemberUserId } from "@/server/session";

export const metadata: Metadata = { title: "Kartu member", robots: { index: false } };

/** The member's card on their phone: the QR the cashier scans, points, balance, last visits. */
export default function MemberCardPage() {
  return (
    <Screen back={{ href: "/", label: "Beranda" }}>
      <Suspense fallback={<div aria-busy className="h-112 rounded-3xl bg-sunk" />}>
        <Card />
      </Suspense>
    </Screen>
  );
}

async function Card() {
  const userId = await requireMemberUserId();
  const now = new Date();
  const card = await memberCard(await getDb(), userId, now);
  if (!card) {
    return <Notice title="Kartu belum ditemukan">Tanyakan ke kasir, ya.</Notice>;
  }
  const { rule } = card;
  const progress = card.points % rule.redeemPoints;
  const vouchers = Math.floor(card.points / rule.redeemPoints);

  return (
    <>
      <h1 className="sr-only">Kartu member {card.name}</h1>
      <figure
        className="pinstripe step-in rounded-3xl p-5 text-navy-fg"
        aria-label={`Kartu member ${card.memberNo}`}
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Pole />
            <span className="wide text-sm font-semibold uppercase tracking-[0.04em]">{brand.name}</span>
          </span>
          <span className="text-sm text-navy-muted">Member</span>
        </div>
        <p className="mt-6 text-2xl font-semibold">{card.name}</p>
        <p className="condensed num text-lg text-navy-muted">{card.memberNo}</p>
        <div className="mx-auto mt-5 w-full max-w-52 rounded-2xl bg-surface p-2">
          <QrCode value={card.memberNo} label={`QR kartu member ${card.memberNo}`} />
        </div>
        <figcaption className="mt-3 text-center text-sm text-navy-muted">
          Tunjukkan ke kasir sebelum bayar
        </figcaption>
      </figure>

      {card.status !== "active" ? (
        <Notice tone="alert" title="Kartu sedang nonaktif" className="mt-4">
          Hubungi kami lewat WhatsApp.
        </Notice>
      ) : null}
      {card.birthday ? (
        <Notice tone="ok" title="Selamat ulang tahun" className="mt-4">
          Haircut bulan ini setengah harga.
        </Notice>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-rule bg-surface px-4 py-3">
          <dt className="label">Poin</dt>
          <dd className="num mt-0.5 text-2xl font-semibold">{card.points}</dd>
          <dd className="mt-2">
            <span className="block h-1.5 overflow-hidden rounded-full bg-sunk">
              <span
                className="block h-full rounded-full bg-blue"
                style={{ width: `${Math.round((progress / rule.redeemPoints) * 100)}%` }}
              />
            </span>
            <span className="mt-1.5 block text-xs text-muted">
              {vouchers > 0
                ? `Bisa tukar ${vouchers}× ${formatRupiah(rule.redeemValue)}`
                : `${rule.redeemPoints - progress} lagi ke potongan ${formatRupiah(rule.redeemValue)}`}
            </span>
          </dd>
        </div>
        <div className="flex flex-col rounded-2xl border border-rule bg-surface px-4 py-3">
          <dt className="label">Saldo</dt>
          <dd className="num mt-0.5 text-2xl font-semibold">{formatRupiah(card.balance)}</dd>
          <dd className="mt-auto pt-2">
            <ButtonLink href="/kartu/isi" variant="soft" className="min-h-11! w-full px-3 text-[0.9375rem]">
              <PlusIcon size={18} />
              Isi saldo
            </ButtonLink>
          </dd>
        </div>
      </dl>

      <details className="row mt-4 rounded-2xl border border-rule bg-surface">
        <summary className="flex min-h-14 items-center gap-3 px-4">
          <span className="flex-1 font-medium">Kunjungan terakhir</span>
          <span className="num text-muted">{card.visits.length}</span>
          <ChevronDownIcon className="row-mark text-faint" />
        </summary>
        {card.visits.length === 0 ? (
          <p className="border-t border-rule px-4 py-4 text-muted">Belum ada kunjungan.</p>
        ) : (
          <ul className="border-t border-rule">
            {card.visits.map((v) => (
              <li key={v.id} className="border-b border-rule px-4 py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{v.branch}</span>
                  <span className="num">{formatRupiah(v.total)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  <span className="num">{shortDate(shopDate(v.createdAt))}</span>,{" "}
                  {v.items.map((i) => i.name).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </details>

      <form action={signOutMember} className="mt-6 flex justify-center">
        <button
          type="submit"
          className="inline-flex min-h-12 items-center gap-2 px-3 text-[0.9375rem] text-muted hover:text-fg"
        >
          <LogOutIcon size={18} />
          Keluar dari kartu
        </button>
      </form>
    </>
  );
}
