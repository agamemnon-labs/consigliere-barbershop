import type { Metadata } from "next";
import { Avatar } from "@/components/avatar";
import { ChevronDownIcon } from "@/components/icons";
import { Screen } from "@/components/screen";
import { formatShort } from "@/domain/money";
import { barberWeek, type DayPlan, daysOff, shortDate } from "@/domain/schedule";
import { type Barber, type Branch, getBarbers, getBranches, getRotation, getToday } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Keluarga kami",
  description: "Level, harga potong, cabang hari ini, dan jadwal libur setiap barber.",
};

/** Every barber by level: where they cut today, and their week behind one tap. */
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
    <Screen back={{ href: "/", label: "Beranda" }}>
      <h1 className="text-[2rem]">Keluarga kami</h1>
      <p className="mt-2 text-muted">Harga potong ikut level barbernya. Ketuk nama untuk jadwal seminggu</p>

      <div className="mt-6 flex flex-col gap-8">
        {groups.map((g) => (
          <section key={g.level.id} aria-labelledby={`lvl-${g.level.slug}`}>
            <header className="mb-3 flex items-baseline justify-between">
              <h2 id={`lvl-${g.level.slug}`} className="text-xl">
                {g.level.name}
              </h2>
              <p className="num font-semibold">{formatShort(g.level.haircutPrice)}</p>
            </header>
            <ul className="divide-y divide-rule rounded-2xl bg-surface">
              {g.barbers.map((b) => (
                <li key={b.id}>
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
    </Screen>
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
    <details className="row" id={barber.slug}>
      <summary className="flex min-h-18 items-center gap-3 px-4 py-3">
        <Avatar name={barber.name} />
        <span className="flex-1">
          <span className="block text-lg font-semibold">{barber.name}</span>
          <span className="block text-sm text-muted">
            {first ? <TodayLabel day={first} branchName={branchName} /> : "—"}
          </span>
        </span>
        <ChevronDownIcon size={18} className="row-mark shrink-0 text-faint" />
      </summary>
      <div className="scroll-mt-20 px-4 pb-4">
        {barber.bio ? <p className="text-[0.9375rem] text-muted">{barber.bio}</p> : null}
        <ol className="mt-3 grid gap-px overflow-hidden rounded-xl bg-rule">
          {week.map((d) => (
            <li key={d.date} className="flex items-center justify-between bg-bg px-3 py-2 text-[0.9375rem]">
              <span className="num text-muted">{shortDate(d.date)}</span>
              <DayLabel day={d} branchName={branchName} />
            </li>
          ))}
        </ol>
        {off.length > 0 ? <p className="mt-2 text-sm text-faint">Libur rutin: {off.join(", ")}</p> : null}
      </div>
    </details>
  );
}

function TodayLabel({ day, branchName }: { day: DayPlan; branchName: Map<string, string> }) {
  switch (day.kind) {
    case "working":
      return <>Hari ini di {branchName.get(day.branchId)}</>;
    case "off":
      return <>Hari ini libur</>;
    case "closed":
      return <span className="font-medium text-muted">Hari ini tutup</span>;
    case "unknown":
      return <>Belum dijadwalkan</>;
  }
}

function DayLabel({ day, branchName }: { day: DayPlan; branchName: Map<string, string> }) {
  switch (day.kind) {
    case "working":
      return <span className="font-medium">{branchName.get(day.branchId)}</span>;
    case "off":
      return <span className="text-faint">Libur</span>;
    case "closed":
      return <span className="font-medium text-muted">Tutup, {day.reason}</span>;
    case "unknown":
      return <span className="text-faint">Belum dijadwalkan</span>;
  }
}
