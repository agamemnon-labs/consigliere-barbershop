import { brand } from "@/config/brand";
import { Pole } from "./pole";

type Props = { size?: "sm" | "lg"; className?: string };

/** The shop sign: the name in sign-painter slab next to a barber pole. Rebrands from `brand.ts`. */
export function Wordmark({ size = "sm", className = "" }: Props) {
  const lg = size === "lg";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Pole className={lg ? "h-8! w-4!" : "h-5! w-2.5!"} />
      <span className={`slab leading-none ${lg ? "text-[2.125rem]" : "text-[1.375rem]"}`}>{brand.name}</span>
    </span>
  );
}
