"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SCORES } from "@/domain/rating";
import { StarIcon } from "./icons";

type Props = {
  bookingId: string;
  barber: string | null;
  /** The score already given, if any: the row then shows it and stays put. */
  given: number | null;
  rate: (bookingId: string, score: number) => Promise<{ error?: string }>;
};

/** One tap after the cut: five stars, saved at once, no second step. */
export function RateVisit({ bookingId, barber, given, rate }: Props) {
  const router = useRouter();
  const [chosen, setChosen] = useState<number | null>(given);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const done = given !== null || (chosen !== null && !pending && !error);

  return (
    <section aria-labelledby="nilai" className="mt-5 rounded-2xl bg-surface p-4">
      <h2 id="nilai" className="text-lg">
        {done ? "Makasih, nilaimu tercatat" : `Gimana cukuran ${barber ?? "barbernya"}?`}
      </h2>
      <fieldset aria-label="Nilai dari 1 sampai 5" className="mt-3 grid grid-cols-5 gap-2">
        {SCORES.map((n) => {
          const on = chosen !== null && n <= chosen;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} dari 5`}
              aria-pressed={chosen === n}
              disabled={done || pending}
              onClick={() => {
                setChosen(n);
                setError(undefined);
                start(async () => {
                  const result = await rate(bookingId, n);
                  if (result.error) {
                    setChosen(null);
                    setError(result.error);
                  }
                  router.refresh();
                });
              }}
              className={`flex h-14 items-center justify-center rounded-xl transition-[background-color,color,scale] duration-150 ease-(--ease-out-quiet) active:scale-[0.96] disabled:cursor-default ${
                on ? "bg-sunk text-fg" : "bg-bg text-faint hover:bg-sunk hover:text-fg"
              }`}
            >
              <StarIcon size={28} fill={on ? "currentColor" : "none"} />
            </button>
          );
        })}
      </fieldset>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : done ? null : (
        <p className="mt-2 flex justify-between text-sm text-faint">
          <span>Kurang</span>
          <span>Mantap</span>
        </p>
      )}
    </section>
  );
}
