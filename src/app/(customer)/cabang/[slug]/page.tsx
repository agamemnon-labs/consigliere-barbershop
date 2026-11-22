import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { Notice } from "@/components/notice";
import { Rule } from "@/components/rule";
import { brand } from "@/config/brand";
import { formatShort } from "@/domain/money";
import { closureFor, onDuty, shortDate } from "@/domain/schedule";
import { getBarbers, getBranches, getRotation, getToday } from "@/server/catalog";

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
          <dd className="num">{hours ? `Setiap hari, ${hours[0]}–${hours[1]}` : "—"}</dd>
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
        <ul className="mt-4">
          {onDutyToday.map((b) => (
            <li key={b.id} className="border-b border-rule">
              <Link href={`/barber#${b.slug}`} className="group flex min-h-16 items-baseline py-4">
                <span className="font-display text-xl group-hover:text-accent-ink">{b.name}</span>
                <span className="label ml-3">{b.level.name}</span>
                <span className="leader" aria-hidden />
                <span className="num">{formatShort(b.level.haircutPrice)}</span>
              </Link>
            </li>
          ))}
        </ul>
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
