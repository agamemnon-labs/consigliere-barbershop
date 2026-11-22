import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { Notice } from "@/components/notice";
import { shortDate } from "@/domain/schedule";
import { shopClock, shopDate } from "@/domain/time";
import { getBranches } from "@/server/catalog";
import { type BarberQueue, getBranchQueue, type LiveEntry } from "@/server/queue";
import { requireStaff } from "@/server/session";
import { QueueButton, WalkInForm } from "./queue-controls";

type Props = { searchParams: PageProps<"/kasir">["searchParams"] };

/** One column per barber on duty. Every action is one tap. */
export async function CashierBoard({ searchParams }: Props) {
  const staff = await requireStaff();
  const [{ cabang }, branches] = await Promise.all([searchParams, getBranches()]);
  const home = branches.find((b) => b.id === staff.branchId);
  const chosen =
    staff.role === "cashier" ? home : (branches.find((b) => b.slug === cabang) ?? home ?? branches[0]);
  if (!chosen) return <p className="p-6 text-muted">Belum ada cabang.</p>;

  const now = new Date();
  const date = shopDate(now);
  const queue = await getBranchQueue(chosen.slug, date, now);
  if (!queue) return null;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-4">
        <p className="font-display text-2xl">
          {queue.branch.name} <span className="text-muted italic">· {shortDate(date)}</span>
        </p>
        <div className="flex items-center gap-6">
          {staff.role !== "cashier" ? (
            <nav className="flex gap-4" aria-label="Pilih cabang">
              {branches.map((b) => (
                <Link
                  key={b.id}
                  href={`/kasir?cabang=${b.slug}`}
                  className={`label min-h-11 content-center ${b.id === chosen.id ? "text-fg underline underline-offset-4" : "hover:text-fg"}`}
                >
                  {b.name}
                </Link>
              ))}
            </nav>
          ) : null}
          <LiveRefresh branchId={queue.branch.id} />
        </div>
      </div>

      {queue.closedReason ? (
        <Notice title="Cabang tutup hari ini">{queue.closedReason}</Notice>
      ) : queue.barbers.length === 0 ? (
        <p className="py-16 text-center text-muted italic">Belum ada barber yang dijadwalkan hari ini.</p>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
          {queue.barbers.map((b) => (
            <Column key={b.barber.id} queue={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ queue }: { queue: BarberQueue }) {
  const chair = queue.entries.find((e) => e.status === "in_service");
  const line = queue.entries.filter((e) => e.status !== "in_service");
  const someoneCalled = line.some((e) => e.status === "called");
  return (
    <section
      className="flex flex-col rounded-sm border border-rule bg-surface"
      aria-label={`Antrean ${queue.barber.name}`}
    >
      <header className="flex items-baseline justify-between border-b border-rule px-4 py-3">
        <h2 className="text-2xl">{queue.barber.name}</h2>
        <p className="label">{queue.barber.level}</p>
      </header>

      <div className="border-b border-rule px-4 py-3">
        <p className="label">Di kursi</p>
        {chair ? (
          <>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <p>
                <span className="num mr-2 text-accent-ink">{chair.ticket}</span>
                {nameOf(chair)}
              </p>
              {chair.startedAt ? (
                <p className="num text-sm text-muted">sejak {shopClock(chair.startedAt)}</p>
              ) : null}
            </div>
            <div className="mt-3">
              <QueueButton op="finish" entryId={chair.id} label="Selesai" block />
            </div>
          </>
        ) : (
          <p className="mt-2 text-muted italic">Kursi kosong</p>
        )}
      </div>

      <ol className="flex-1 px-4 py-1">
        {line.length === 0 ? <li className="py-4 text-sm text-muted">Belum ada yang menunggu.</li> : null}
        {line.map((e, i) => (
          <li key={e.id} className="border-b border-rule py-3 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p>
                  <span className="num mr-2">{e.ticket}</span>
                  {nameOf(e)}
                </p>
                <p className="label mt-1">
                  {e.source === "online" ? "Online · lunas" : "Walk-in"}
                  {e.lateMoves > 0 ? " · sudah mundur 1" : ""}
                  {e.status === "waiting" ? ` · ± ${e.waitMin} mnt` : ""}
                </p>
                {e.status === "called" && e.calledAt ? (
                  <p className="mt-1 text-sm text-accent-ink">
                    Dipanggil {shopClock(e.calledAt)}
                    {e.graceUntil ? `, tunggu sampai ${shopClock(e.graceUntil)}` : ""}
                  </p>
                ) : null}
              </div>
              {e.status === "waiting" && i === 0 && !someoneCalled ? (
                <QueueButton op="call" entryId={e.id} label="Panggil" variant="accent" />
              ) : e.status === "waiting" ? (
                <QueueButton op="cancel" entryId={e.id} label="Batal" variant="text" />
              ) : null}
            </div>
            {e.status === "called" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {chair ? (
                  <p className="col-span-1 content-center text-sm text-muted">Tunggu kursi kosong</p>
                ) : (
                  <QueueButton op="start" entryId={e.id} label="Duduk" block />
                )}
                <QueueButton
                  op="late"
                  entryId={e.id}
                  label={e.lateMoves > 0 ? "Tidak datang" : "Telat"}
                  variant="quiet"
                  enableAt={e.graceUntil?.toISOString() ?? null}
                  block
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <WalkInForm barberId={queue.barber.id} barberName={queue.barber.name} />
    </section>
  );
}

function nameOf(e: LiveEntry) {
  return (
    e.displayName ?? <span className="text-muted italic">{e.source === "walkin" ? "Walk-in" : "Online"}</span>
  );
}
