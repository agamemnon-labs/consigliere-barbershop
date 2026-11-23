import { brand } from "@/config/brand";
import { Pole } from "./pole";

type Props = { size?: "sm" | "lg"; className?: string };

/** Shop-sign wordmark: the name set wide, next to a barber pole. Rebrands from `brand.ts`. */
export function Wordmark({ size = "sm", className = "" }: Props) {
  const lg = size === "lg";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Pole className={lg ? "h-7! w-3.5!" : ""} />
      <span
        className={`wide font-semibold uppercase leading-none tracking-[0.04em] ${lg ? "text-3xl" : "text-[1.0625rem]"}`}
      >
        {brand.name}
      </span>
    </span>
  );
}
