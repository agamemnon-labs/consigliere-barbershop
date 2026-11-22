import { brand } from "@/config/brand";

type Props = { size?: "sm" | "lg"; className?: string };

/** Type-only wordmark. No logo file to go stale; it rebrands from `brand.ts`. */
export function Wordmark({ size = "sm", className = "" }: Props) {
  const lg = size === "lg";
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <span
        className={`font-display font-medium uppercase leading-none ${
          lg ? "text-[2.6rem] tracking-[0.14em] sm:text-6xl" : "text-xl tracking-[0.18em]"
        }`}
      >
        {brand.name}
      </span>
      <span className={`label mt-2 flex items-center gap-3 ${lg ? "" : "hidden"}`}>
        <span aria-hidden className="h-px w-6 bg-rule-strong" />
        Barbershop · {brand.city}
        <span aria-hidden className="h-px w-6 bg-rule-strong" />
      </span>
    </div>
  );
}
