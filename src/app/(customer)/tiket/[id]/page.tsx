import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { ButtonLink } from "@/components/button";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { LiveRefresh } from "@/components/live-refresh";
import { Notice } from "@/components/notice";
import { SimulatePay } from "@/components/pay-controls";
import { Pole } from "@/components/pole";
import { PollRefresh } from "@/components/poll-refresh";
import { QrisPanel } from "@/components/qris-panel";
import { RateVisit } from "@/components/rate-visit";
import { RememberTicket } from "@/components/remember-ticket";
import { Screen } from "@/components/screen";
import { Ticket as TicketCard } from "@/components/ticket";
import { getDb } from "@/db";
import { leaveHint } from "@/domain/booking";
import { formatRupiah } from "@/domain/money";
import { shopClock, shopDate } from "@/domain/time";
import { simulatePayment } from "@/server/actions/booking";
import { rate } from "@/server/actions/rating";
import { getTicket, type Ticket } from "@/server/booking";
import { paymentProvider } from "@/server/payments";

export const metadata: Metadata = { title: "Tiket antrean", robots: { index: false } };

/** The customer's own page for one booking: pay, then watch their place in line. */
export default function TicketPage({ params }: PageProps<"/tiket/[id]">) {
  return (
    <Screen back={{ href: "/", label: "Beranda" }}>
      <Suspense fallback={<Loading />}>
        <TicketView params={params} />
      </Suspense>
    </Screen>
  );
}

function Loading() {
  return (
    <div aria-busy className="grid gap-4">
      <p className="text-muted">Membuka tiket…</p>
      <div className="h-80 rounded-[1.25rem] bg-sunk" />
    </div>
  );
}

/** Until the end of the shop's day: a ticket is only ever for today. */
function endOfShopDay(now: Date) {
  return new Date(`${shopDate(now)}T23:59:59+08:00`).toISOString();
}

async function TicketView({ params }: { params: PageProps<"/tiket/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const now = new Date();
  const ticket = await getTicket(await getDb(), id, now);
  if (!ticket) notFound();
  const demo = paymentProvider().testMode;

  const place = ticket.status === "paid" ? ticket.place : null;
  const open =
    ticket.status === "pending" ||
    (place !== null && ["waiting", "called", "in_service"].includes(place.status));

  return (
    <>
      <RememberTicket
        id={ticket.id}
        label={place ? `${place.prefix} ${String(place.number).padStart(3, "0")}` : ""}
        until={open ? endOfShopDay(now) : null}
      />
      {ticket.status === "pending" ? (
        <Pending ticket={ticket} demo={demo} />
      ) : place ? (
        <InLine ticket={ticket} place={place} now={now} />
      ) : ticket.status === "expired" ? (
        <Ended
          title="Waktu bayar habis"
          body="Pembayaran tidak masuk, jadi belum ada nomor. Ambil nomor lagi, ya."
          branch={ticket.branch.slug}
        />
      ) : ticket.status === "credited" ? (
        <Ended
          title="Pembayaranmu jadi kredit"
          body={`${formatRupiah(ticket.amount)} masuk setelah waktunya habis, jadi kami simpan sebagai kredit di nomor WhatsApp-mu. Berlaku 30 hari di semua cabang.`}
          branch={ticket.branch.slug}
        />
      ) : (
        <Ended
          title="Booking ini sudah ditutup"
          body="Ada pertanyaan? Hubungi kami lewat WhatsApp."
          branch={ticket.branch.slug}
        />
      )}

      <Details ticket={ticket} />
      {place ? <LiveRefresh branchId={ticket.branch.id} className="mt-5 justify-center" /> : null}
    </>
  );
}

function Pending({ ticket, demo }: { ticket: Ticket; demo: boolean }) {
  return (
    <section className="step-in">
      <p className="label">Satu langkah lagi, {ticket.name}</p>
      <h1 className="mt-1 text-[1.75rem]">Bayar dengan QRIS</h1>

      <div className="mt-5">
        <QrisPanel qrString={ticket.qrString} amount={ticket.amount} expiresAt={ticket.expiresAt} />
      </div>

      <p className="mt-4 text-[0.9375rem] text-muted">
        Pindai pakai aplikasi bank atau e-wallet apa saja. Nomormu keluar begitu bayar berhasil.
      </p>

      {demo ? (
        <div className="mt-5 grid gap-3">
          <Notice tone="info" title="Mode demo">
            QR ini tidak bisa dibayar sungguhan. Pakai tombol ini untuk pura-pura bayar.
          </Notice>
          <SimulatePay id={ticket.id} simulate={simulatePayment} />
        </div>
      ) : null}
      <PollRefresh />
    </section>
  );
}

type Place = NonNullable<Ticket["place"]>;

function InLine({ ticket, place, now }: { ticket: Ticket; place: Place; now: Date }) {
  const barber = ticket.barber ?? "barber";
  const hint = leaveHint(place.waitMin, now);
  const card = (around: string, label?: string) => (
    <TicketCard
      className="mt-5"
      prefix={place.prefix}
      number={place.number}
      barber={barber}
      branch={ticket.branch.name}
      waitMin={place.status === "waiting" ? place.waitMin : 0}
      around={around}
      aroundLabel={label}
    />
  );

  switch (place.status) {
    case "waiting":
      return (
        <section className="step-in">
          <Status tone="mint" icon={<CheckIcon size={14} strokeWidth={2.5} />}>
            Lunas, nomormu sudah masuk
          </Status>
          <h1 className="mt-2 text-[1.75rem]">Kamu di antrean, {ticket.name}</h1>
          {card(hint.turnAt)}
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Fact label="Di depanmu" value={place.ahead === 0 ? "Tidak ada" : `${place.ahead} orang`} />
            <Fact
              label="Berangkat"
              value={hint.leaveAt ?? "Sekarang"}
              note={hint.leaveAt ? "sekitar" : undefined}
            />
          </dl>
          <p className="mt-3 text-[0.9375rem] text-muted">Telat dipanggil? Kami tunggu 5 menit.</p>
        </section>
      );
    case "called":
      return (
        <section className="step-in">
          <Status tone="butter" icon={<Pole turning />}>
            Dipanggil sekarang
          </Status>
          <h1 className="mt-2 text-[1.75rem]">Giliranmu, {ticket.name}</h1>
          {card(shopClock(now), "Dipanggil jam")}
          <Notice tone="warn" title={`Silakan ke kursi ${barber}`} className="mt-3">
            Kami tunggu 5 menit.
          </Notice>
        </section>
      );
    case "in_service":
      return (
        <section className="step-in">
          <Status tone="mint" icon={<Pole turning />}>
            Di kursi
          </Status>
          <h1 className="mt-2 text-[1.75rem]">Selamat menikmati</h1>
          {card(shopClock(now), "Mulai jam")}
        </section>
      );
    case "done":
      return (
        <section className="step-in">
          <Status tone="mint" icon={<CheckIcon size={14} strokeWidth={2.5} />}>
            Selesai
          </Status>
          <h1 className="mt-2 text-[1.75rem]">Terima kasih, {ticket.name}</h1>
          <p className="mt-2 text-muted">Sampai ketemu lagi di {ticket.branch.name}.</p>
          <RateVisit bookingId={ticket.id} barber={ticket.barber} given={ticket.rating} rate={rate} />
          <ButtonLink href="/kartu" variant="quiet" block className="mt-5">
            Lihat kartu member
          </ButtonLink>
        </section>
      );
    default:
      return (
        <section className="step-in">
          <h1 className="text-[1.75rem]">Nomor ini sudah lewat</h1>
          <p className="mt-2 text-muted">
            Kamu dua kali tidak ada saat dipanggil. Pembayaranmu jadi kredit di nomor WhatsApp-mu.
          </p>
          <ButtonLink href={`/antre?cabang=${ticket.branch.slug}`} block className="mt-5">
            Ambil nomor lagi
          </ButtonLink>
        </section>
      );
  }
}

function Status({ tone, icon, children }: { tone: "mint" | "butter"; icon: ReactNode; children: ReactNode }) {
  const fill = tone === "mint" ? "bg-mint text-mint-ink" : "bg-butter text-butter-ink";
  return (
    <p
      className={`inline-flex min-h-8 items-center gap-2 rounded-lg px-2.5 text-[0.9375rem] font-medium ${fill}`}
    >
      {icon}
      {children}
    </p>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-surface px-4 py-3">
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 flex items-baseline gap-1.5">
        {note ? <span className="text-sm text-muted">{note}</span> : null}
        <span className="num text-2xl font-semibold">{value}</span>
      </dd>
    </div>
  );
}

function Details({ ticket }: { ticket: Ticket }) {
  return (
    <details className="row mt-5 rounded-2xl border border-rule bg-surface">
      <summary className="flex min-h-14 items-center gap-3 px-4">
        <span className="flex-1 font-medium">Rincian pesanan</span>
        <span className="num text-muted">{formatRupiah(ticket.amount)}</span>
        <ChevronDownIcon className="row-mark text-faint" />
      </summary>
      <div className="border-t border-rule px-4 pt-3 pb-4">
        <ul className="grid gap-2 text-[0.9375rem]">
          {ticket.services.map((i) => (
            <li key={i.serviceId} className="flex items-baseline">
              <span>{i.name}</span>
              <span className="leader" aria-hidden />
              <span className="num">{formatRupiah(i.price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          {ticket.barber ? `Dengan ${ticket.barber} di ${ticket.branch.name}` : ticket.branch.name}
        </p>
      </div>
    </details>
  );
}

function Ended({ title, body, branch }: { title: string; body: string; branch: string }) {
  return (
    <section className="step-in">
      <h1 className="text-[1.75rem]">{title}</h1>
      <p className="mt-2 text-muted">{body}</p>
      <ButtonLink href={`/antre?cabang=${branch}`} className="mt-6" block>
        Ambil nomor lagi
      </ButtonLink>
    </section>
  );
}
