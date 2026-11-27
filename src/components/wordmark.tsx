import { brand } from "@/config/brand";
import { Mark } from "./mark";

type Props = { size?: "sm" | "lg"; className?: string };

/** The shop sign: the comb-C mark and the name in sign-painter slab, both suit green. Rebrands from `brand.ts`. */
export function Wordmark({ size = "sm", className = "" }: Props) {
  const lg = size === "lg";
  return (
    <span className={`inline-flex items-center text-suit ${lg ? "gap-2.5" : "gap-2"} ${className}`}>
      <Mark className={lg ? "h-[2.375rem]" : "h-[1.625rem]"} />
      <span className={`slab leading-none ${lg ? "text-[2.125rem]" : "text-[1.375rem]"}`}>{brand.name}</span>
    </span>
  );
}
