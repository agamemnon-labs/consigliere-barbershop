import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { LiveRefresh } from "@/components/live-refresh";
import { Notice } from "@/components/notice";
import { Rule } from "@/components/rule";
import { brand } from "@/config/brand";
import { formatShort } from "@/domain/money";
import { closureFor, onDuty, shortDate } from "@/domain/schedule";
import { clockLabel, shopDate } from "@/domain/time";
import { type Barber, getBarbers, getBranches, getRotation, getToday } from "@/server/catalog";
import { getBranchQueue } from "@/server/queue";

export async function generateStaticParams() {
  const branches = await getBranches();
  return branches.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps<"/cabang/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const branch = (await getBranches()).find((b) => b.slug === slug);
  return branch
    ? { title: `Cabang ${branch.name}`, description: `${brand.name} ${branch.name}, ${branch.address}.` }
    : {};
}

export default async function BranchPage({ params }: PageProps<"/cabang/[slug]">) {
  const { slug } = await params;
  const today = await getToday();
  const [branches, barbers, { shifts, closures }] = await Promise.all([
    getBranches(),
    getBarbers(),
    getRotation(today, 1),
  ]);
  const branch = branches.find((b) => b.slug === slug);
  if (!branch) notFound();

  const closed = closureFor(closures, branch.id, today);
  const dutyIds = new Set(onDuty(shifts, closures, branch.id, today));
  const onDutyToday = barbers.filter((b) => dutyIds.has(b.id));
  const hours = branch.openHours.mon;
  const maps =
    branch.mapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${branch.address}, ${brand.city}`)}`;

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/">Beranda</BackLink>

      <header className="pt-10 pb-12">
        <p className="label">Cabang</p>
        <h1 className="mt-3 text-5xl">{branch.name}</h1>
        <p className="mt-4 text-muted">{branch.address}</p>
        <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[0.9375rem]">
          <dt className="label self-center">Buka</dt>
          <dd className="num">
            {hours ? `Setiap hari, ${clockLabel(hours[0])}–${clockLabel(hours[1])}` : "—"}
          </dd>
          <dt className="label self-center">Peta</dt>
          <dd>
            <a
              href={maps}
              className="underline decoration-rule-strong underline-offset-4 hover:decoration-fg"
            >
              Buka di Google Maps
            </a>
          </dd>
        </dl>
      </header>

      {closed ? (
        <div className="mb-10">
          <Notice title="Tutup hari ini">{closed.reason}</Notice>
        </div>
      ) : null}

      <Rule label={`Barber hari ini · ${shortDate(today)}`} />
      {onDutyToday.length > 0 ? (
        <Suspense fallback={<BarberRows barbers={onDutyToday} />}>
          <LiveBarberRows slug={branch.slug} branchId={branch.id} barbers={onDutyToday} />
        </Suspense>
      ) : (
        <p className="mt-6 text-muted italic">
          {closed ? "Sampai jumpa besok." : "Jadwal hari ini belum diisi."}
        </p>
      )}
      <p className="mt-6 text-sm text-muted">
        Harga potong mengikuti level barber. Barber bergiliran antar cabang; cek jadwal seminggu di{" "}
        <Link
          href="/barber"
          className="underline decoration-rule-strong underline-offset-4 hover:decoration-fg"
        >
          halaman barber
        </Link>
        .
      </p>

      <Credits />
    </div>
  );
}

/** Keyed by barber slug: ids can differ between the prerendered shell and the demo database. */
type Live = { chair: string | null; waiting: number; waitMin: number };

/** Streams in after the static shell: who is in each chair, how many wait, how long. */
async function LiveBarberRows({
  slug,
  branchId,
  barbers,
}: {
  slug: string;
  branchId: string;
  barbers: Barber[];
}) {
  await connection();
  const now = new Date();
  const queue = await getBranchQueue(slug, shopDate(now), now);
  const live = new Map<string, Live>(
    (queue?.barbers ?? []).map((b) => [
      b.barber.slug,
      {
        chair: b.entries.find((e) => e.status === "in_service")?.ticket ?? null,
        waiting: b.entries.filter((e) => e.status !== "in_service").length,
        waitMin: b.waitMin,
      },
    ]),
  );
  return (
    <>
      <BarberRows barbers={barbers} live={live} />
      <div className="mt-3 flex justify-end">
        <LiveRefresh branchId={queue?.branch.id ?? branchId} />
      </div>
    </>
  );
}

function BarberRows({ barbers, live }: { barbers: Barber[]; live?: Map<string, Live> }) {
  return (
    <ul className="mt-4">
      {barbers.map((b) => {
        const q = live?.get(b.slug);
        return (
          <li key={b.id} className="border-b border-rule">
            <Link href={`/barber#${b.slug}`} className="group block py-4">
              <span className="flex items-baseline">
                <span className="font-display text-xl group-hover:text-accent-ink">{b.name}</span>
                <span className="label ml-3">{b.level.name}</span>
                <span className="leader" aria-hidden />
                <span className="num">{formatShort(b.level.haircutPrice)}</span>
              </span>
              <span className="mt-1 block min-h-5 text-sm text-muted">
                {q ? <LiveLine q={q} /> : "\u00a0"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function LiveLine({ q }: { q: Live }) {
  if (!q.chair && q.waiting === 0) return <span className="text-fg">Kursi kosong, bisa langsung duduk</span>;
  return (
    <>
      {q.chair ? (
        <>
          Di kursi <span className="num text-fg">{q.chair}</span> ·{" "}
        </>
      ) : null}
      {q.waiting} menunggu · giliran baru <span className="num text-fg">± {q.waitMin} mnt</span>
    </>
  );
}
