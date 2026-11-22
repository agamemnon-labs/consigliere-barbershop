import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { formatShort } from "@/domain/money";
import { barberWeek, type DayPlan, daysOff, shortDate } from "@/domain/schedule";
import { type Barber, type Branch, getBarbers, getBranches, getRotation, getToday } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Para barber",
  description: "Level, harga potong, cabang hari ini, dan jadwal libur setiap barber.",
};

export default async function BarbersPage() {
  const today = await getToday();
  const [barbers, branches, { shifts, closures }] = await Promise.all([
    getBarbers(),
    getBranches(),
    getRotation(today, 7),
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  // Group by level, highest first (getBarbers is already sorted that way).
  const groups: { level: Barber["level"]; barbers: Barber[] }[] = [];
  for (const b of barbers) {
    const last = groups.at(-1);
    if (last?.level.id === b.level.id) last.barbers.push(b);
    else groups.push({ level: b.level, barbers: [b] });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/">Beranda</BackLink>

      <header className="pt-10 pb-12">
        <h1 className="text-5xl">Para barber</h1>
        <p className="mt-4 text-muted">Ketuk nama untuk melihat jadwalnya minggu ini</p>
      </header>

      <div className="flex flex-col gap-12">
        {groups.map((g) => (
          <section key={g.level.id} aria-labelledby={`lvl-${g.level.slug}`}>
            <header className="mb-2 flex items-baseline justify-between">
              <h2 id={`lvl-${g.level.slug}`} className="text-2xl">
                {g.level.name}
              </h2>
              <p className="num text-muted">Potong {formatShort(g.level.haircutPrice)}</p>
            </header>
            <ul className="border-t border-rule">
              {g.barbers.map((b) => (
                <li key={b.id} className="border-b border-rule">
                  <BarberRow
                    barber={b}
                    week={barberWeek(b.id, shifts, closures, today, 7)}
                    branchName={branchName}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Credits />
    </div>
  );
}

function BarberRow({
  barber,
  week,
  branchName,
}: {
  barber: Barber;
  week: DayPlan[];
  branchName: Map<Branch["id"], string>;
}) {
  const first = week[0];
  const off = daysOff(week);
  return (
    <details className="row">
      <summary className="flex min-h-16 items-baseline py-4">
        <span className="font-display text-2xl">{barber.name}</span>
        <span className="leader" aria-hidden />
        <span className="text-[0.9375rem]">
          {first ? <TodayLabel day={first} branchName={branchName} /> : "—"}
        </span>
        <span aria-hidden className="row-mark ml-4 inline-block w-3 text-center text-muted">
          +
        </span>
      </summary>
      <div id={barber.slug} className="scroll-mt-6 pr-7 pb-6">
        {barber.bio ? <p className="font-display text-lg">{barber.bio}</p> : null}
        {off.length > 0 ? <p className="label mt-4">Libur rutin · {off.join(", ")}</p> : null}
        <ol className="mt-4 grid gap-y-2 text-[0.9375rem]">
          {week.map((d) => (
            <li key={d.date} className="flex items-baseline">
              <span className="num text-sm text-muted">{shortDate(d.date)}</span>
              <span className="leader" aria-hidden />
              <DayLabel day={d} branchName={branchName} />
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

function TodayLabel({ day, branchName }: { day: DayPlan; branchName: Map<string, string> }) {
  switch (day.kind) {
    case "working":
      return <>{branchName.get(day.branchId)}</>;
    case "off":
      return <span className="text-muted">Libur</span>;
    case "closed":
      return <span className="text-accent-ink">Tutup</span>;
    case "unknown":
      return <span className="text-muted">—</span>;
  }
}

function DayLabel({ day, branchName }: { day: DayPlan; branchName: Map<string, string> }) {
  switch (day.kind) {
    case "working":
      return <span>{branchName.get(day.branchId)}</span>;
    case "off":
      return <span className="text-muted">Libur</span>;
    case "closed":
      return <span className="text-accent-ink">Tutup · {day.reason}</span>;
    case "unknown":
      return <span className="text-faint">Belum dijadwalkan</span>;
  }
}
