import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ChartIcon, ChevronRightIcon } from "@/components/icons";
import { LiveRefresh } from "@/components/live-refresh";
import { Notice } from "@/components/notice";
import { Pole } from "@/components/pole";
import { getDb } from "@/db";
import { METHOD_LABEL } from "@/domain/checkout";
import { formatRupiah } from "@/domain/money";
import { shortDate } from "@/domain/schedule";
import { shopClock, shopDate } from "@/domain/time";
import { getBranches } from "@/server/catalog";
import { counterCatalog, recentTransactions, todayTakings } from "@/server/checkout";
import { type BarberQueue, getBranchQueue, type LiveEntry } from "@/server/queue";
import { requireStaff } from "@/server/session";
import { type CatalogService, CheckoutPanel } from "./checkout-panel";
import { CancelPrepaid, QueueButton, WalkInForm } from "./queue-controls";

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
  const db = await getDb();
  const [catalog, takings, recent] = await Promise.all([
    counterCatalog(db),
    todayTakings(db, queue.branch.id, date),
    recentTransactions(db, queue.branch.id, date),
  ]);
  const waiting = queue.barbers.reduce(
    (n, b) => n + b.entries.filter((e) => e.status !== "in_service").length,
    0,
  );

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-[1.75rem] leading-tight">{queue.branch.name}</h1>
          <p className="text-[0.9375rem] text-muted">
            <span className="num">{shortDate(date)}</span>,{" "}
            {waiting === 0 ? "belum ada yang antre" : `${waiting} antre`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {staff.role !== "cashier" ? (
            <>
              <nav aria-label="Pilih cabang" className="flex rounded-xl bg-sunk p-1">
                {branches.map((b) => (
                  <Link
                    key={b.id}
                    href={`/kasir?cabang=${b.slug}`}
                    aria-current={b.id === chosen.id ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                      b.id === chosen.id ? "bg-surface text-fg ring-1 ring-rule" : "text-muted hover:text-fg"
                    }`}
                  >
                    {b.name}
                  </Link>
                ))}
              </nav>
              <Link
                href="/admin"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted hover:bg-sunk hover:text-fg"
              >
                <ChartIcon size={18} />
                Back office
              </Link>
            </>
          ) : null}
          <LiveRefresh branchId={queue.branch.id} />
        </div>
      </div>

      {queue.closedReason ? (
        <Notice title="Cabang tutup hari ini">{queue.closedReason}</Notice>
      ) : queue.barbers.length === 0 ? (
        <Notice title="Belum ada barber hari ini">Atur jadwalnya di Back office, Rotasi.</Notice>
      ) : (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {queue.barbers.map((b) => (
            <Column key={b.barber.id} queue={b} catalog={catalog} />
          ))}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-rule bg-surface" aria-label="Pemasukan hari ini">
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            <h2 className="text-[0.9375rem] font-medium text-muted">Pemasukan hari ini</h2>
            <p className="num text-[1.75rem] leading-tight font-semibold">{formatRupiah(takings.total)}</p>
          </div>
          <dl className="flex flex-wrap gap-2 text-sm">
            <div className="flex gap-1.5 rounded-lg bg-sunk px-2.5 py-1">
              <dt className="text-muted">Transaksi</dt>
              <dd className="num font-medium">{takings.count}</dd>
            </div>
            {Object.entries(takings.byMethod).map(([method, amount]) => (
              <div key={method} className="flex gap-1.5 rounded-lg bg-sunk px-2.5 py-1">
                <dt className="text-muted">{METHOD_LABEL[method as keyof typeof METHOD_LABEL] ?? method}</dt>
                <dd className="num font-medium">{formatRupiah(amount ?? 0)}</dd>
              </div>
            ))}
          </dl>
        </div>
        {takings.prepaid.balance + takings.prepaid.credit > 0 ? (
          <p className="px-5 pb-3 text-sm text-muted">
            Juga dibayar dari uang yang masuk sebelumnya:
            {takings.prepaid.balance > 0 ? ` saldo member ${formatRupiah(takings.prepaid.balance)}` : ""}
            {takings.prepaid.balance > 0 && takings.prepaid.credit > 0 ? "," : ""}
            {takings.prepaid.credit > 0 ? ` kredit ${formatRupiah(takings.prepaid.credit)}` : ""}
          </p>
        ) : null}
        {recent.length > 0 ? (
          <ul className="grid border-t border-rule sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/kasir/struk/${t.id}`}
                  className="flex min-h-12 items-center gap-3 px-5 text-sm hover:bg-bg"
                >
                  <span className="num text-muted">{shopClock(t.createdAt)}</span>
                  <span className="flex-1">{t.barber ?? "Tanpa barber"}</span>
                  <span className="num font-medium">{formatRupiah(t.total)}</span>
                  <span className="sr-only">Lihat struk</span>
                  <ChevronRightIcon size={16} className="text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function Column({ queue, catalog }: { queue: BarberQueue; catalog: CatalogService[] }) {
  const haircut = catalog.find((c) => c.priceType === "by_level");
  const chair = queue.entries.find((e) => e.status === "in_service");
  const line = queue.entries.filter((e) => e.status !== "in_service");
  const someoneCalled = line.some((e) => e.status === "called");
  return (
    <section
      className="flex flex-col rounded-2xl border border-rule bg-surface"
      aria-label={`Antrean ${queue.barber.name}`}
    >
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar name={queue.barber.name} />
        <div className="flex-1">
          <h2 className="text-xl leading-tight">{queue.barber.name}</h2>
          <p className="text-sm text-muted">{queue.barber.level}</p>
        </div>
        <p className="num text-sm text-muted">{line.length} antre</p>
      </header>

      <div className="px-3 pb-3">
        {chair ? (
          <div className="rounded-xl bg-butter px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-butter-ink">
              <Pole turning className="h-3.5! w-1.5!" />
              Di kursi
              {chair.startedAt ? (
                <span className="num ml-auto font-normal">sejak {shopClock(chair.startedAt)}</span>
              ) : null}
            </div>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="slab text-[1.375rem] leading-none text-accent-ink">{chair.ticket}</span>
              <span className="font-medium">{nameOf(chair)}</span>
            </p>
            {chair.source === "walkin" ? (
              <CheckoutPanel
                entryId={chair.id}
                haircutPrice={queue.barber.haircutPrice}
                catalog={catalog}
                preset={haircut ? [haircut.id] : []}
                label="Selesai & bayar"
              />
            ) : (
              <>
                <p className="text-sm text-butter-ink">Sudah lunas online</p>
                <div className="mt-3">
                  <QueueButton op="finish" entryId={chair.id} label="Selesai" block />
                </div>
                <CheckoutPanel
                  entryId={chair.id}
                  haircutPrice={queue.barber.haircutPrice}
                  catalog={catalog}
                  preset={[]}
                  label="Selesai + tagih tambahan"
                  variant="quiet"
                />
              </>
            )}
          </div>
        ) : (
          <p className="flex min-h-12 items-center rounded-xl bg-mint px-3 font-medium text-mint-ink">
            Kursi kosong
          </p>
        )}
      </div>

      <ol className="flex-1 border-t border-rule">
        {line.length === 0 ? <li className="px-4 py-4 text-sm text-muted">Belum ada yang menunggu</li> : null}
        {line.map((e, i) => (
          <li
            key={e.id}
            className={`border-b border-rule px-4 py-3 last:border-b-0 ${e.status === "called" ? "bg-butter/50" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="slab w-16 shrink-0 text-lg leading-none">{e.ticket}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{nameOf(e)}</p>
                <p className="text-sm text-muted">
                  {e.source === "online" ? "Online, lunas" : "Walk-in"}
                  {e.lateMoves > 0 ? ", sudah mundur 1" : ""}
                  {e.status === "waiting"
                    ? e.waitMin > 0
                      ? `, ±\u00a0${e.waitMin}\u00a0mnt`
                      : ", berikutnya"
                    : ""}
                </p>
              </div>
              {e.status === "waiting" && i === 0 && !someoneCalled ? (
                <QueueButton op="call" entryId={e.id} label="Panggil" variant="primary" />
              ) : e.status === "waiting" && e.source === "online" ? (
                <CancelPrepaid entryId={e.id} />
              ) : e.status === "waiting" ? (
                <QueueButton op="cancel" entryId={e.id} label="Batal" variant="text" />
              ) : null}
            </div>
            {e.status === "called" ? (
              <>
                {e.calledAt ? (
                  <p className="mt-2 text-sm font-medium text-butter-ink">
                    Dipanggil {shopClock(e.calledAt)}
                    {e.graceUntil ? `, tunggu sampai ${shopClock(e.graceUntil)}` : ""}
                  </p>
                ) : null}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {chair ? (
                    <p className="content-center text-sm text-muted">Tunggu kursi kosong</p>
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
              </>
            ) : null}
          </li>
        ))}
      </ol>

      <WalkInForm barberId={queue.barber.id} barberName={queue.barber.name} />
    </section>
  );
}

function nameOf(e: LiveEntry) {
  return e.displayName ?? <span className="text-muted">{e.source === "walkin" ? "Walk-in" : "Online"}</span>;
}
