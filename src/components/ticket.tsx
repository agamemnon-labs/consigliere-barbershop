type Props = {
  /** Ticket number for the day, e.g. 14 → "014". */
  number: number;
  /** Branch letter prefix, e.g. "P" for Jl. Pulau Kalimantan. */
  prefix: string;
  barber: string;
  branch: string;
  /** Estimated minutes until the customer's turn. */
  waitMin: number;
  /** Approximate turn time, e.g. "14.40". */
  around: string;
  /** What the lower half says above the clock. */
  aroundLabel?: string;
  className?: string;
};

/**
 * The queue number as a take-a-number ticket: pole red, a huge slab number, a perforated
 * tear with punched notches, and the turn time under it.
 */
export function Ticket({
  number,
  prefix,
  barber,
  branch,
  waitMin,
  around,
  aroundLabel = "Giliranmu sekitar",
  className = "",
}: Props) {
  const no = String(number).padStart(3, "0");
  return (
    <figure
      className={`ticket [--tear:12.5rem] ${className}`}
      aria-label={`Nomor antrean ${prefix} ${no}, barber ${barber}, cabang ${branch}, sekitar ${waitMin} menit lagi`}
    >
      <div className="flex h-50 flex-col px-6 pt-5">
        <div className="flex items-baseline justify-between text-[0.9375rem] text-white/90">
          <span>{branch}</span>
          <span>Nomor antrean</span>
        </div>
        <p className="slab mt-2 flex items-baseline gap-2.5 leading-none">
          <span className="text-4xl text-white/85">{prefix}</span>
          <span className="text-[5.75rem]">{no}</span>
        </p>
        <p className="mt-auto pb-4 text-lg">dengan {barber}</p>
      </div>
      <div className="ticket-tear mx-6" aria-hidden />
      <div className="flex items-end justify-between px-6 pt-4 pb-5">
        <div>
          <p className="text-[0.9375rem] text-white/90">{aroundLabel}</p>
          <p className="num mt-0.5 text-4xl leading-none font-semibold">{around}</p>
        </div>
        <p className="num text-[0.9375rem] text-white/90">
          {waitMin > 0 ? `± ${waitMin} mnt lagi` : "Sekarang"}
        </p>
      </div>
    </figure>
  );
}
