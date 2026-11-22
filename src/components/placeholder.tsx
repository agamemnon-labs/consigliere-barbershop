/** Honest stand-in for a screen that arrives in a later phase. */
export function Placeholder({ phase, what }: { phase: string; what: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <p className="label">Menyusul di fase {phase}</p>
      <p className="mt-4 font-display text-3xl italic">Kursi sudah siap.</p>
      <p className="mt-4 text-muted">{what}</p>
    </div>
  );
}
