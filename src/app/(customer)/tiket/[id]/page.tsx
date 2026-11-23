import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ButtonLink } from "@/components/button";
import { Credits } from "@/components/credits";
import { LiveRefresh } from "@/components/live-refresh";
import { Notice } from "@/components/notice";
import { PayCountdown, SimulatePay } from "@/components/pay-controls";
import { QrCode } from "@/components/qr-code";
import { Rule } from "@/components/rule";
import { TicketStub } from "@/components/ticket-stub";
import { getDb } from "@/db";
import { leaveHint } from "@/domain/booking";
import { formatRupiah } from "@/domain/money";
import { shopClock } from "@/domain/time";
import { simulatePayment } from "@/server/actions/booking";
import { getTicket, type Ticket } from "@/server/booking";
import { paymentProvider } from "@/server/payments";

export const metadata: Metadata = { title: "Tiket antrean", robots: { index: false } };

/** The customer's own page for one booking: pay, then watch their place in line. */
export default function TicketPage({ params }: PageProps<"/tiket/[id]">) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/">Beranda</BackLink>
      <Suspense fallback={<p className="py-16 text-muted">Membuka tiket…</p>}>
        <TicketView params={params} />
      </Suspense>
      <Credits />
    </div>
  );
}

async function TicketView({ params }: { params: PageProps<"/tiket/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const ticket = await getTicket(await getDb(), id, now);
  if (!ticket) notFound();
  const demo = paymentProvider().testMode;

  return (
    <>
      {ticket.status === "pending" ? (
        <Pending ticket={ticket} demo={demo} />
      ) : ticket.status === "paid" && ticket.place ? (
        <InLine ticket={ticket} now={now} />
      ) : ticket.status === "expired" ? (
        <Ended
          title="Waktu bayar habis"
          body="Pembayarannya tidak kami terima, jadi belum ada nomor. Silakan ambil nomor lagi."
          branch={ticket.branch.slug}
        />
      ) : ticket.status === "credited" ? (
        <Ended
          title="Pembayaran jadi kredit"
          body={`Pembayaran ${formatRupiah(ticket.amount)} masuk setelah waktunya habis, jadi kami simpan sebagai kredit di nomor WhatsApp-mu. Berlaku 30 hari di semua cabang.`}
          branch={ticket.branch.slug}
        />
      ) : (
        <Ended
          title="Booking ini sudah ditutup"
          body="Ada pertanyaan? Hubungi kami lewat WhatsApp."
          branch={ticket.branch.slug}
        />
      )}

      <Rule label="Rincian" className="mt-12" />
      <ul className="mt-5 grid gap-2 text-[0.9375rem]">
        {ticket.services.map((i) => (
          <li key={i.serviceId} className="flex items-baseline">
            <span>{i.name}</span>
            <span className="leader" aria-hidden />
            <span className="num">{formatRupiah(i.price)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-baseline justify-between border-t border-rule pt-3">
        <span className="label">
          {ticket.barber ? `${ticket.barber} · ` : ""}
          {ticket.branch.name}
        </span>
        <span className="num text-lg">{formatRupiah(ticket.amount)}</span>
      </p>
      {demo ? <p className="label mt-8 text-center">Mode demo · tanpa uang sungguhan</p> : null}
      <LiveRefresh branchId={ticket.branch.id} className="mt-6 justify-center" />
    </>
  );
}

function Pending({ ticket, demo }: { ticket: Ticket; demo: boolean }) {
  return (
    <section className="pt-10">
      <p className="label">Satu langkah lagi, {ticket.name}</p>
      <h1 className="mt-3 text-4xl leading-tight">Bayar dengan QRIS</h1>
      <p className="mt-4 text-muted">
        Pindai dengan aplikasi bank atau dompet digital mana pun. Nomormu masuk antrean begitu pembayaran
        berhasil.
      </p>
      <div className="mx-auto mt-8 w-full max-w-72">
        {ticket.qrString ? (
          <QrCode value={ticket.qrString} label={`QRIS untuk membayar ${formatRupiah(ticket.amount)}`} />
        ) : (
          <p className="text-muted">Menyiapkan QRIS…</p>
        )}
      </div>
      <p className="mt-6 flex items-baseline justify-between">
        <span className="num text-3xl text-accent-ink">{formatRupiah(ticket.amount)}</span>
        <span className="text-sm text-muted">
          Sisa waktu <PayCountdown until={ticket.expiresAt.toISOString()} />
        </span>
      </p>
      {demo ? (
        <div className="mt-8">
          <Notice title="Mode demo">
            QR ini tidak bisa dibayar sungguhan. Tekan tombol di bawah untuk pura-pura membayar.
          </Notice>
          <div className="mt-5">
            <SimulatePay id={ticket.id} simulate={simulatePayment} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InLine({ ticket, now }: { ticket: Ticket; now: Date }) {
  const place = ticket.place;
  if (!place) return null;
  const hint = leaveHint(place.waitMin, now);
  const barber = ticket.barber ?? "barber";
  return (
    <section className="pt-10">
      <p className="label">{headline(place.status)}</p>
      <h1 className="mt-3 text-4xl leading-tight">
        {place.status === "called"
          ? `Giliranmu, ${ticket.name}`
          : place.status === "in_service"
            ? "Selamat menikmati"
            : place.status === "done"
              ? "Terima kasih"
              : place.status === "waiting"
                ? `Kamu di antrean, ${ticket.name}`
                : "Nomor ini sudah lewat"}
      </h1>
      <TicketStub
        className="mt-8"
        prefix={place.prefix}
        number={place.number}
        barber={barber}
        branch={ticket.branch.name}
        waitMin={place.waitMin}
        around={place.status === "waiting" ? hint.turnAt : shopClock(now)}
      />
      <div className="mt-6 text-[0.9375rem]">
        {place.status === "waiting" ? (
          <>
            <p>
              {place.ahead === 0 ? "Tidak ada yang di depanmu." : `${place.ahead} orang di depanmu.`}{" "}
              {hint.leave}
            </p>
            <p className="mt-2 text-muted">Telat dipanggil? Kami tunggu 5 menit.</p>
          </>
        ) : place.status === "called" ? (
          <Notice title="Dipanggil">Silakan ke kursi {barber}. Kami tunggu 5 menit.</Notice>
        ) : place.status === "no_show" ? (
          <p className="text-muted">
            Kamu dua kali tidak ada saat dipanggil. Pembayaranmu jadi kredit di nomor ini.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function headline(status: string) {
  switch (status) {
    case "called":
      return "Dipanggil";
    case "in_service":
      return "Di kursi";
    case "done":
      return "Selesai";
    default:
      return "Lunas · nomor antrean";
  }
}

function Ended({ title, body, branch }: { title: string; body: string; branch: string }) {
  return (
    <section className="pt-10">
      <h1 className="text-4xl leading-tight">{title}</h1>
      <p className="mt-4 text-muted">{body}</p>
      <ButtonLink href={`/antre?cabang=${branch}`} className="mt-8" block>
        Ambil nomor lagi
      </ButtonLink>
    </section>
  );
}
