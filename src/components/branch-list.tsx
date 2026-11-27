import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { closureFor, onDuty } from "@/domain/schedule";
import { shopDate } from "@/domain/time";
import { type Branch, getBranches, getRotation, getToday } from "@/server/catalog";
import { getBranchQueue } from "@/server/queue";
import { ChevronRightIcon, UsersIcon } from "./icons";

type Row = { branch: Branch; closed: string | null; onDuty: number };
type Live = { waitMin: number; waiting: number };
type Target = "branch" | "book";

/**
 * The three branches with today's shortest wait, quietest one marked. The static shell lists
 * them at once; the live numbers stream in. `target` picks where a tap goes.
 */
export async function BranchList({ target }: { target: Target }) {
  const today = await getToday();
  const [branches, { shifts, closures }] = await Promise.all([getBranches(), getRotation(today, 1)]);
  const rows = branches.map((b) => ({
    branch: b,
    closed: closureFor(closures, b.id, today)?.reason ?? null,
    onDuty: onDuty(shifts, closures, b.id, today).length,
  }));
  return (
    <Suspense fallback={<Rows rows={rows} target={target} />}>
      <LiveRows rows={rows} target={target} />
    </Suspense>
  );
}

async function LiveRows({ rows, target }: { rows: Row[]; target: Target }) {
  await connection();
  const now = new Date();
  const date = shopDate(now);
  const queues = await Promise.all(rows.map((r) => getBranchQueue(r.branch.slug, date, now)));
  const live = new Map<string, Live>();
  for (const q of queues) {
    if (!q || q.barbers.length === 0) continue;
    live.set(q.branch.slug, {
      waitMin: Math.min(...q.barbers.map((b) => b.waitMin)),
      waiting: q.barbers.reduce((n, b) => n + b.entries.length, 0),
    });
  }
  const open = [...live.entries()].filter(([slug]) => !rows.find((r) => r.branch.slug === slug)?.closed);
  const quietest = open.length > 1 ? open.reduce((a, b) => (b[1].waitMin < a[1].waitMin ? b : a))[0] : null;
  return <Rows rows={rows} live={live} quietest={quietest} target={target} />;
}

function Rows({
  rows,
  live,
  quietest,
  target,
}: {
  rows: Row[];
  live?: Map<string, Live>;
  quietest?: string | null;
  target: Target;
}) {
  return (
    <ul className="divide-y divide-rule rounded-2xl bg-surface">
      {rows.map(({ branch, closed, onDuty: count }) => {
        const q = live?.get(branch.slug);
        const href = target === "book" ? `/antre?cabang=${branch.slug}` : `/cabang/${branch.slug}`;
        return (
          <li key={branch.id}>
            <Link
              href={href as "/"}
              className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-bg/70"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-lg leading-snug font-semibold">{branch.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-faint">
                  <span className="inline-flex items-center gap-1.5">
                    <UsersIcon size={16} />
                    {closed ? "Tutup hari ini" : `${count} barber jaga`}
                  </span>
                  {quietest === branch.slug ? (
                    <span className="rounded-md bg-mint px-1.5 py-0.5 text-xs font-semibold text-mint-ink">
                      Paling sepi
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {closed ? (
                  <span className="text-sm font-semibold text-muted">Tutup</span>
                ) : q ? (
                  q.waitMin === 0 ? (
                    <span className="block text-[0.9375rem] font-semibold text-mint-ink">Langsung duduk</span>
                  ) : (
                    <>
                      <span className="num block text-xl font-semibold leading-tight">± {q.waitMin} mnt</span>
                      <span className="block text-xs text-faint">{q.waiting} orang antre</span>
                    </>
                  )
                ) : (
                  <span className="block h-7 w-16 rounded-lg bg-sunk" />
                )}
              </span>
              <ChevronRightIcon className="shrink-0 text-faint" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
