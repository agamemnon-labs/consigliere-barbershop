type Props = {
  /** Ticket number for the day, e.g. 14 → "014". */
  number: number;
  /** Branch letter prefix, e.g. "J" for Juanda. */
  prefix: string;
  barber: string;
  branch: string;
  /** Estimated minutes until the customer's turn. */
  waitMin: number;
  /** Approximate turn time, e.g. "14.40". */
  around: string;
  className?: string;
};

/** The queue number, printed like a cloakroom ticket. */
export function TicketStub({ number, prefix, barber, branch, waitMin, around, className = "" }: Props) {
  const no = String(number).padStart(3, "0");
  return (
    <figure
      className={`stub grid grid-cols-[68%_1px_1fr] rounded-xs ${className}`}
      aria-label={`Nomor antrean ${prefix} ${no}, barber ${barber}, cabang ${branch}, sekitar ${waitMin} menit lagi`}
    >
      <div className="flex flex-col justify-between gap-5 px-5 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.2em] opacity-60">
            Nomor antrean
          </span>
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.2em] opacity-60">{branch}</span>
        </div>
        <p className="num flex items-baseline gap-2 leading-none">
          <span className="text-2xl opacity-50">{prefix}</span>
          <span className="text-[3.5rem] font-medium tracking-[-0.02em] text-accent">{no}</span>
        </p>
        <p className="font-display text-lg italic leading-none">dengan {barber}</p>
      </div>
      <div className="stub-tear my-3" aria-hidden />
      <div className="flex flex-col justify-between px-4 py-5 text-right">
        <span className="text-[0.625rem] font-medium uppercase tracking-[0.2em] opacity-60">Giliran</span>
        <span>
          <span className="num block text-2xl leading-none">{around}</span>
          <span className="num mt-1 block text-xs opacity-60">± {waitMin} mnt</span>
        </span>
      </div>
    </figure>
  );
}
