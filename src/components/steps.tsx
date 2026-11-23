/** "Langkah 2 dari 4" over a segmented bar. The flow is a sequence, so it is numbered. */
export function Steps({ at, of, className = "" }: { at: number; of: number; className?: string }) {
  return (
    <div className={className}>
      <p className="num text-sm font-medium text-faint">
        Langkah {at} dari {of}
      </p>
      <div
        className="mt-2 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${of}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={of}
        aria-valuenow={at}
        aria-label="Langkah ambil nomor"
      >
        {Array.from({ length: of }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, never reordered
            key={i}
            className={`h-1.5 rounded-full transition-colors duration-300 ${i < at ? "bg-accent" : "bg-sunk"}`}
          />
        ))}
      </div>
    </div>
  );
}
