import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ButtonLink } from "@/components/button";
import { CheckIcon } from "@/components/icons";
import { Notice } from "@/components/notice";
import { SimulatePay } from "@/components/pay-controls";
import { PollRefresh } from "@/components/poll-refresh";
import { QrisPanel } from "@/components/qris-panel";
import { Screen } from "@/components/screen";
import { getDb } from "@/db";
import { formatRupiah } from "@/domain/money";
import { simulateTopup } from "@/server/actions/topup";
import { paymentProvider } from "@/server/payments";
import { requireMemberUserId } from "@/server/session";
import { getTopupOrder } from "@/server/topup";

export const metadata: Metadata = { title: "Bayar top-up", robots: { index: false } };

/** Pay one top-up by QRIS, then see the balance it added. */
export default function TopupPayPage({ params }: PageProps<"/kartu/isi/[id]">) {
  return (
    <Screen back={{ href: "/kartu", label: "Kartu member" }}>
      <Suspense fallback={<div aria-busy className="h-96 rounded-3xl bg-sunk" />}>
        <Pay params={params} />
      </Suspense>
    </Screen>
  );
}

async function Pay({ params }: { params: PageProps<"/kartu/isi/[id]">["params"] }) {
  const { id } = await params;
  const userId = await requireMemberUserId();
  await connection();
  const order = /^[0-9a-f-]{36}$/i.test(id)
    ? await getTopupOrder(await getDb(), id, userId, new Date())
    : null;
  if (!order) notFound();
  const demo = paymentProvider().testMode;

  if (order.status === "paid") {
    return (
      <section className="step-in">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-mint text-mint-ink">
          <CheckIcon size={26} strokeWidth={2.5} />
        </span>
        <h1 className="mt-4 text-[1.75rem]">Saldo bertambah {formatRupiah(order.get)}</h1>
        <p className="mt-2 text-muted">Langsung bisa dipakai bayar di kasir semua cabang.</p>
        <ButtonLink href="/kartu" className="mt-6" block>
          Lihat kartu
        </ButtonLink>
      </section>
    );
  }
  if (order.status !== "pending") {
    return (
      <section className="step-in">
        <h1 className="text-[1.75rem]">Waktu bayar habis</h1>
        <p className="mt-2 text-muted">Belum ada uang yang masuk. Silakan ulangi.</p>
        <ButtonLink href="/kartu/isi" className="mt-6" block>
          Isi saldo lagi
        </ButtonLink>
      </section>
    );
  }
  return (
    <section className="step-in">
      <p className="label">Top-up kartu {order.memberNo}</p>
      <h1 className="mt-1 text-[1.75rem]">Bayar dengan QRIS</h1>
      <div className="mt-5">
        <QrisPanel qrString={order.qrString} amount={order.pay} expiresAt={order.expiresAt} />
      </div>
      <p className="mt-4 text-[0.9375rem] text-muted">
        Saldo bertambah {formatRupiah(order.get)} begitu pembayaran berhasil.
      </p>
      {demo ? (
        <div className="mt-5 grid gap-3">
          <Notice tone="info" title="Mode demo">
            QR ini tidak bisa dibayar sungguhan. Pakai tombol ini untuk pura-pura bayar.
          </Notice>
          <SimulatePay id={order.id} simulate={simulateTopup} />
        </div>
      ) : null}
      <PollRefresh />
    </section>
  );
}
