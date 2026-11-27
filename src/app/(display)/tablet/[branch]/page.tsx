import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { Clock } from "@/components/clock";
import { LiveRefresh } from "@/components/live-refresh";
import { Mark } from "@/components/mark";
import { QrCode } from "@/components/qr-code";
import { Wordmark } from "@/components/wordmark";
import { shopDate } from "@/domain/time";
import { getBranches } from "@/server/catalog";
import { getBranchQueue } from "@/server/queue";

export const metadata: Metadata = { title: "Antrean", robots: { index: false } };

export async function generateStaticParams() {
  return (await getBranches()).map((b) => ({ branch: b.slug }));
}

/**
 * Counter tablet. Faces customers, takes no input, shows ticket numbers only
 * (never names), readable from two metres.
 */
export default async function TabletPage({ params }: PageProps<"/tablet/[branch]">) {
  const { branch: slug } = await params;
  const branch = (await getBranches()).find((b) => b.slug === slug);
  if (!branch) notFound();

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-8 py-6 sm:px-12">
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Wordmark size="lg" />
          <span className="text-2xl text-muted">{branch.name}</span>
        </div>
        <div className="flex items-center gap-8">
          <LiveRefresh branchId={branch.id} />
          <Clock className="text-5xl font-semibold" />
        </div>
      </header>
      <Suspense fallback={<p className="py-20 text-center text-2xl text-muted">Memuat antrean…</p>}>
        <Board slug={slug} />
      </Suspense>
    </main>
  );
}

async function Board({ slug }: { slug: string }) {
  await connection();
  const now = new Date();
  const queue = await getBranchQueue(slug, shopDate(now), now);
  if (!queue) return null;
  if (queue.closedReason) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Mark className="h-24 text-suit" />
        <p className="mt-6 text-5xl font-semibold">Hari ini kami tutup</p>
        <p className="mt-3 text-2xl text-muted">{queue.closedReason}</p>
      </div>
    );
  }

  const called = queue.barbers.flatMap((b) =>
    b.entries.filter((e) => e.status === "called").map((e) => ({ ticket: e.ticket, barber: b.barber.name })),
  );
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const bookUrl = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}/antre?cabang=${slug}` : null;

  return (
    <>
      {called.length > 0 ? (
        <div className="grid gap-3">
          {called.map((c) => (
            <p
              key={c.ticket}
              role="status"
              className="flex items-center gap-8 rounded-3xl bg-accent px-8 py-4 text-accent-fg"
            >
              <span className="slab text-[5.5rem] leading-none">{c.ticket}</span>
              <span className="text-4xl leading-tight">
                Silakan ke kursi <span className="font-semibold">{c.barber}</span>
              </span>
            </p>
          ))}
        </div>
      ) : null}

      <ul className="grid flex-1 content-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        {queue.barbers.map((b) => {
          const chair = b.entries.find((e) => e.status === "in_service");
          const line = b.entries.filter((e) => e.status !== "in_service");
          const next = line[0];
          return (
            <li key={b.barber.id} className="flex flex-col rounded-3xl bg-surface p-5">
              <div className="flex items-center gap-3">
                <Avatar name={b.barber.name} size="lg" />
                <p className="text-3xl font-semibold [font-stretch:110%]">{b.barber.name}</p>
              </div>
              <div className="mt-5">
                <p className="text-lg text-muted">Di kursi</p>
                {chair ? (
                  <p className="slab text-6xl leading-none text-accent-ink">{chair.ticket}</p>
                ) : (
                  <p className="mt-1 inline-flex rounded-xl bg-mint px-3 py-1 text-3xl font-medium text-mint-ink">
                    Kosong
                  </p>
                )}
              </div>
              <div className="mt-auto flex items-end justify-between gap-4 border-t border-rule pt-4">
                <div>
                  <p className="text-lg text-muted">Berikutnya</p>
                  {next ? (
                    <p className="flex items-baseline gap-3">
                      <span className="slab text-[2rem] leading-none">{next.ticket}</span>
                      <span className="num text-lg text-muted">
                        {next.status === "called"
                          ? "dipanggil"
                          : next.waitMin > 0
                            ? `± ${next.waitMin} mnt`
                            : "sekarang"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-2xl font-medium text-mint-ink">Langsung duduk</p>
                  )}
                </div>
                <p className="text-right">
                  <span className="block text-lg text-muted">Antre</span>
                  <span className="num text-4xl font-semibold">{line.length}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between gap-6 rounded-3xl bg-suit px-6 py-4 text-suit-fg">
        <p className="text-3xl font-semibold [font-stretch:110%]">
          Nggak mau nunggu di sini?
          <span className="block text-xl font-normal text-suit-muted">
            Scan, ambil nomor dari HP, datang pas giliranmu
          </span>
        </p>
        {bookUrl ? (
          <div className="w-28 shrink-0 rounded-2xl bg-white p-1.5">
            <QrCode value={bookUrl} label="QR untuk ambil nomor dari HP" />
          </div>
        ) : null}
      </footer>
    </>
  );
}
