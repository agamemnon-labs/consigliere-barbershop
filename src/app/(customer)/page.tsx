import Link from "next/link";
import { ButtonLink } from "@/components/button";
import { Credits } from "@/components/credits";
import { Notice } from "@/components/notice";
import { PriceList } from "@/components/price-list";
import { Rule } from "@/components/rule";
import { Wordmark } from "@/components/wordmark";
import { brand } from "@/config/brand";
import { closureFor, onDuty, shortDate } from "@/domain/schedule";
import { clockLabel } from "@/domain/time";
import { getBranches, getRotation, getToday } from "@/server/catalog";

export default async function Home() {
  const today = await getToday();
  const [branches, { shifts, closures }] = await Promise.all([getBranches(), getRotation(today, 1)]);
  const closedToday = branches
    .map((b) => ({ branch: b, closure: closureFor(closures, b.id, today) }))
    .filter((x) => x.closure);

  return (
    <div className="mx-auto flex max-w-md flex-col px-6">
      <header className="flex flex-col items-center pt-[calc(4.5rem+env(safe-area-inset-top))] pb-16 text-center">
        <Wordmark size="lg" />
        <p className="mt-14 font-display text-[1.9rem] leading-tight">{brand.tagline}</p>
        <p className="mt-5 text-muted">Tiga cabang di {brand.city}</p>
        <ButtonLink href="/antre" className="mt-10" block>
          Ambil nomor antrean
        </ButtonLink>
      </header>

      {closedToday.length > 0 ? (
        <div className="mb-10 grid gap-4">
          {closedToday.map(({ branch, closure }) => (
            <Notice key={branch.id} title={`${branch.name} tutup hari ini`}>
              {closure?.reason}
            </Notice>
          ))}
        </div>
      ) : null}

      <Rule label={`Hari ini · ${shortDate(today)}`} />
      <ul className="mt-6 mb-16">
        {branches.map((b) => {
          const closed = closureFor(closures, b.id, today);
          const count = onDuty(shifts, closures, b.id, today).length;
          const hours = b.openHours.mon;
          return (
            <li key={b.id} className="border-b border-rule">
              <Link
                href={`/cabang/${b.slug}`}
                className="group flex min-h-20 items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-display text-xl group-hover:text-accent-ink">{b.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{b.address}</p>
                </div>
                <div className="shrink-0 text-right">
                  {closed ? (
                    <p className="label text-accent-ink">Tutup</p>
                  ) : (
                    <>
                      <p className="num text-sm">
                        {hours ? `${clockLabel(hours[0])}–${clockLabel(hours[1])}` : "—"}
                      </p>
                      <p className="label mt-1">{count} barber jaga</p>
                    </>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <Rule label="Daftar harga" className="mb-8" />
      <PriceList folded />

      <div className="mt-12">
        <ButtonLink href="/barber" variant="quiet" block>
          Kenali para barber
        </ButtonLink>
      </div>

      <Rule label="Kartu member" className="mt-16" />
      <p className="mt-5 text-muted">Poin, saldo bonus, dan diskon ulang tahun. Daftar di kasir</p>
      <div className="mt-6">
        <ButtonLink href="/masuk" variant="quiet" block>
          Buka kartu member
        </ButtonLink>
      </div>

      <Credits />
    </div>
  );
}
