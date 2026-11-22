import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Clock } from "@/components/clock";
import { LiveRefresh } from "@/components/live-refresh";
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
    <main className="flex min-h-dvh flex-col px-8 py-8 sm:px-14">
      <header className="flex items-baseline justify-between border-b border-rule-strong pb-5">
        <p className="font-display text-3xl uppercase tracking-[0.16em]">{branch.name}</p>
        <div className="flex items-baseline gap-8">
          <LiveRefresh branchId={branch.id} />
          <Clock className="text-4xl" />
        </div>
      </header>
      <Suspense fallback={<p className="py-20 text-center text-2xl text-muted">Memuat antrean…</p>}>
        <Board slug={slug} />
      </Suspense>
      <footer className="mt-auto pt-10 text-center">
        <p className="label">Ambil nomor dari ponsel · consigliere</p>
      </footer>
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
      <div className="py-24 text-center">
        <p className="font-display text-5xl italic">Hari ini kami tutup.</p>
        <p className="mt-4 text-2xl text-muted">{queue.closedReason}</p>
      </div>
    );
  }

  const called = queue.barbers.flatMap((b) =>
    b.entries.filter((e) => e.status === "called").map((e) => ({ ticket: e.ticket, barber: b.barber.name })),
  );

  return (
    <>
      {called.length > 0 ? (
        <div className="mt-8 grid gap-3">
          {called.map((c) => (
            <p key={c.ticket} className="border-l-4 border-accent py-2 pl-5 text-3xl" role="status">
              <span className="num text-accent-ink">{c.ticket}</span>, silakan ke kursi{" "}
              <span className="font-display italic">{c.barber}</span>
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-8 sm:gap-x-14">
        <p className="label py-3">Barber</p>
        <p className="label py-3 text-right">Di kursi</p>
        <p className="label py-3 text-right">Berikutnya</p>
        <p className="label py-3 text-right">Menunggu</p>
        {queue.barbers.map((b) => {
          const chair = b.entries.find((e) => e.status === "in_service");
          const next = b.entries.find((e) => e.status !== "in_service");
          const waiting = b.entries.filter((e) => e.status !== "in_service").length;
          return (
            <div key={b.barber.id} className="contents">
              <p className="border-t border-rule py-6 font-display text-4xl sm:text-5xl">{b.barber.name}</p>
              <p className="num border-t border-rule py-6 text-right text-4xl text-accent-ink sm:text-5xl">
                {chair?.ticket ?? "—"}
              </p>
              <div className="border-t border-rule py-6 text-right">
                {next ? (
                  <>
                    <p className="num text-4xl sm:text-5xl">{next.ticket}</p>
                    <p className="num mt-1 text-lg text-muted">± {next.waitMin} mnt</p>
                  </>
                ) : (
                  <p className="text-2xl text-muted italic">Langsung duduk</p>
                )}
              </div>
              <p className="num border-t border-rule py-6 text-right text-4xl sm:text-5xl">{waiting}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
