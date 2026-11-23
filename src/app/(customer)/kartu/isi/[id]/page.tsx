import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ButtonLink } from "@/components/button";
import { Credits } from "@/components/credits";
import { Notice } from "@/components/notice";
import { PayCountdown, SimulatePay } from "@/components/pay-controls";
import { PollRefresh } from "@/components/poll-refresh";
import { QrCode } from "@/components/qr-code";
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
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/kartu">Kartu member</BackLink>
      <Suspense fallback={<p className="py-16 text-muted">Membuka pembayaran…</p>}>
        <Pay params={params} />
      </Suspense>
      <Credits />
    </div>
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
      <section className="pt-10">
        <p className="label">Top-up berhasil</p>
        <h1 className="mt-3 text-4xl leading-tight">Saldo bertambah {formatRupiah(order.get)}</h1>
        <ButtonLink href="/kartu" className="mt-10" block>
          Lihat kartu
        </ButtonLink>
      </section>
    );
  }
  if (order.status !== "pending") {
    return (
      <section className="pt-10">
        <h1 className="text-4xl leading-tight">Waktu bayar habis</h1>
        <p className="mt-4 text-muted">Belum ada uang yang masuk. Silakan ulangi.</p>
        <ButtonLink href="/kartu/isi" className="mt-10" block>
          Isi saldo lagi
        </ButtonLink>
      </section>
    );
  }
  return (
    <section className="pt-10">
      <p className="label">Top-up · {order.memberNo}</p>
      <h1 className="mt-3 text-4xl leading-tight">Bayar dengan QRIS</h1>
      <p className="mt-4 text-muted">Saldo masuk {formatRupiah(order.get)} begitu pembayaran berhasil</p>
      <div className="mx-auto mt-8 w-full max-w-72">
        {order.qrString ? (
          <QrCode value={order.qrString} label={`QRIS untuk membayar ${formatRupiah(order.pay)}`} />
        ) : (
          <p className="text-muted">Menyiapkan QRIS…</p>
        )}
      </div>
      <p className="mt-6 flex items-baseline justify-between">
        <span className="num text-3xl text-accent-ink">{formatRupiah(order.pay)}</span>
        <span className="text-sm text-muted">
          Sisa waktu <PayCountdown until={order.expiresAt.toISOString()} />
        </span>
      </p>
      {demo ? (
        <div className="mt-8">
          <Notice title="Mode demo">QR ini tidak bisa dibayar sungguhan. Tekan tombol di bawah</Notice>
          <div className="mt-5">
            <SimulatePay id={order.id} simulate={simulateTopup} />
          </div>
        </div>
      ) : null}
      <PollRefresh />
    </section>
  );
}
