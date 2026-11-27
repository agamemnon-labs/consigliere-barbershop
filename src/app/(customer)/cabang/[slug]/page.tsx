import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { ButtonLink } from "@/components/button";
import { ClockIcon, MapPinIcon } from "@/components/icons";
import { LiveDot } from "@/components/live-dot";
import { LiveRefresh } from "@/components/live-refresh";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { SectionTitle } from "@/components/section-title";
import { brand } from "@/config/brand";
import { formatShort } from "@/domain/money";
import { closureFor, onDuty } from "@/domain/schedule";
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

/** One branch today: who is cutting, how long the line is per barber, and one button to join. */
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
  const canBook = onDutyToday.length > 0 && !closed;

  return (
    <Screen
      back={{ href: "/", label: "Beranda" }}
      bar={
        canBook ? (
          <ButtonLink href={`/antre?cabang=${branch.slug}`} block>
            Ambil nomor di {branch.name}
          </ButtonLink>
        ) : undefined
      }
    >
      <header>
        <h1 className="text-[2.5rem] leading-[1.02]">{branch.name}</h1>
        <ul className="mt-4 grid gap-2 text-[0.9375rem] text-muted">
          <li className="flex items-center gap-2.5">
            <MapPinIcon size={18} className="shrink-0 text-faint" />
            <a href={maps} className="underline decoration-rule-strong underline-offset-4 hover:text-fg">
              {branch.address}
            </a>
          </li>
          <li className="flex items-center gap-2.5">
            <ClockIcon size={18} className="shrink-0 text-faint" />
            <span>
              Setiap hari{" "}
              <span className="num">{hours ? `${clockLabel(hours[0])}–${clockLabel(hours[1])}` : "—"}</span>
            </span>
          </li>
        </ul>
      </header>

      {closed ? (
        <Notice title="Tutup hari ini" tone="alert" className="mt-6">
          {closed.reason}
        </Notice>
      ) : null}

      <section className="mt-8" aria-labelledby="barber-hari-ini">
        <SectionTitle id="barber-hari-ini">Barber hari ini</SectionTitle>
        {onDutyToday.length > 0 ? (
          <Suspense fallback={<BarberRows barbers={onDutyToday} />}>
            <LiveBarberRows slug={branch.slug} branchId={branch.id} barbers={onDutyToday} />
          </Suspense>
        ) : (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-muted">
            {closed ? "Sampai jumpa besok" : "Jadwal hari ini belum diisi"}
          </p>
        )}
      </section>

      <p className="mt-6 text-[0.9375rem] text-muted">
        Barber pindah-pindah cabang.{" "}
        <Link href="/barber" className="font-medium text-blue hover:underline">
          Lihat jadwal seminggu
        </Link>
      </p>
    </Screen>
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
    <ul className="divide-y divide-rule rounded-2xl bg-surface">
      {barbers.map((b) => {
        const q = live?.get(b.slug);
        return (
          <li key={b.id} className="flex min-h-20 items-center gap-3 px-4 py-3">
            <Avatar name={b.name} />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className="text-lg font-semibold">{b.name}</span>
                <span className="text-sm text-faint">{b.level.name}</span>
              </p>
              <p className="mt-0.5 min-h-5 text-sm text-muted">{q ? <Chair q={q} /> : " "}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num font-semibold">{formatShort(b.level.haircutPrice)}</p>
              <p className="num min-h-4 text-xs text-faint">
                {q ? (q.waitMin > 0 ? `± ${q.waitMin} mnt` : "") : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Chair({ q }: { q: Live }) {
  if (!q.chair && q.waiting === 0)
    return <span className="font-medium text-mint-ink">Kursi kosong, langsung duduk</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {q.chair ? (
        <>
          <LiveDot live className="text-butter-ink" />
          <span>
            Mencukur <span className="num font-medium text-fg">{q.chair}</span>
          </span>
          <span aria-hidden className="text-faint">
            /
          </span>
        </>
      ) : null}
      <span>{q.waiting > 0 ? `${q.waiting} antre` : "belum ada yang antre"}</span>
    </span>
  );
}
