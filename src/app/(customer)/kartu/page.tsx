import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { QrCode } from "@/components/qr-code";
import { Rule } from "@/components/rule";
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
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/">Beranda</BackLink>
      <Suspense fallback={<p className="py-16 text-muted italic">Membuka kartu…</p>}>
        <Card />
      </Suspense>
      <Credits />
    </div>
  );
}

async function Card() {
  const userId = await requireMemberUserId();
  const now = new Date();
  const card = await memberCard(await getDb(), userId, now);
  if (!card) {
    return <p className="py-16 text-muted">Kartu belum ditemukan. Tanyakan ke kasir, ya.</p>;
  }
  const { rule } = card;
  const toNext = rule.redeemPoints - (card.points % rule.redeemPoints);
  const vouchers = Math.floor(card.points / rule.redeemPoints);

  return (
    <>
      <section className="pt-10">
        <p className="label">Kartu member</p>
        <h1 className="mt-3 text-4xl leading-tight">{card.name}</h1>
      </section>

      <figure className="stub mt-8 rounded-xs px-6 py-6" aria-label={`Kartu member ${card.memberNo}`}>
        <div className="flex items-baseline justify-between">
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.2em] opacity-60">Member</span>
          <span className="num text-xl text-accent">{card.memberNo}</span>
        </div>
        <div className="mx-auto mt-5 w-full max-w-56">
          <QrCode value={card.memberNo} label={`QR kartu member ${card.memberNo}`} />
        </div>
        <figcaption className="mt-4 text-center text-sm opacity-70">
          Tunjukkan ke kasir sebelum bayar.
        </figcaption>
      </figure>

      {card.status !== "active" ? (
        <p className="mt-6 text-accent-ink">Kartu ini sedang dinonaktifkan. Hubungi kami lewat WhatsApp.</p>
      ) : null}

      <dl className="mt-10 grid grid-cols-2 gap-x-6 border-y border-rule py-5">
        <div>
          <dt className="label">Poin</dt>
          <dd className="num mt-1 text-3xl">{card.points}</dd>
        </div>
        <div className="text-right">
          <dt className="label">Saldo</dt>
          <dd className="num mt-1 text-3xl">{formatRupiah(card.balance)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-[0.9375rem] text-muted">
        {vouchers > 0 ? `Bisa ditukar ${vouchers} × ${formatRupiah(rule.redeemValue)} di kasir. ` : ""}
        {toNext} poin lagi ke potongan {formatRupiah(rule.redeemValue)} berikutnya. Satu poin tiap{" "}
        {formatRupiah(rule.earnPer)} yang dibayar.
      </p>
      {card.birthday ? (
        <p className="mt-4 border-l-2 border-accent pl-4">
          Selamat ulang tahun. Sepanjang bulan ini haircut-mu diskon setengah harga, tinggal bilang ke kasir.
        </p>
      ) : null}

      <Rule label="Kunjungan terakhir" className="mt-12" />
      {card.visits.length === 0 ? (
        <p className="mt-5 text-muted italic">Belum ada kunjungan.</p>
      ) : (
        <ul className="mt-3">
          {card.visits.map((v) => (
            <li key={v.id} className="border-b border-rule py-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="num text-sm text-muted">{shortDate(shopDate(v.createdAt))}</span>
                <span className="num">{formatRupiah(v.total)}</span>
              </div>
              <p className="mt-0.5 text-[0.9375rem]">
                {v.items.map((i) => i.name).join(", ")}
                <span className="text-muted"> · {v.branch}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <form action={signOutMember} className="mt-10 text-center">
        <button type="submit" className="label min-h-12 hover:text-fg">
          Keluar dari kartu
        </button>
      </form>
    </>
  );
}
