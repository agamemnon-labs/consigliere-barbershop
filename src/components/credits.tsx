import { brand } from "@/config/brand";

/** Closing credits. Every surface ends the same way. */
export function Credits({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`flex flex-col items-center gap-8 px-6 pt-16 pb-[calc(3rem+env(safe-area-inset-bottom))] text-center ${className}`}
    >
      <span aria-hidden className="h-10 w-px bg-rule-strong" />
      <dl className="grid gap-6">
        <div>
          <dt className="label">Sebuah tempat cukur di</dt>
          <dd className="mt-1 font-display text-xl">{brand.city}</dd>
        </div>
        <div>
          <dt className="label">Keluhan &amp; saran</dt>
          <dd className="mt-1">
            <a
              href={`https://wa.me/${brand.whatsappComplaints}`}
              className="num text-sm underline decoration-rule-strong underline-offset-4 hover:decoration-fg"
            >
              WhatsApp
            </a>
          </dd>
        </div>
        <div>
          <dt className="label">Dibuat oleh</dt>
          <dd className="mt-1">
            <a
              href={brand.builtBy.url}
              className="font-display text-xl uppercase tracking-[0.16em] hover:text-accent-ink"
            >
              {brand.builtBy.name}
            </a>
          </dd>
        </div>
      </dl>
      <p className="label text-faint">
        © {brand.established} {brand.legalName}
      </p>
    </footer>
  );
}
