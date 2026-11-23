import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "dark" | "quiet" | "soft";

const base =
  "inline-flex min-h-13 items-center justify-center gap-2 rounded-xl px-5 text-base font-medium transition-[background-color,border-color,color,scale] duration-150 ease-(--ease-out-quiet) active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  /** The one action of a screen: pole red. Taking a number, paying, calling the next customer. */
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  /** A strong action that isn't money: navy. */
  dark: "bg-navy text-navy-fg hover:bg-fg",
  /** Secondary action: white with a hairline. */
  quiet: "border border-rule-strong bg-surface text-fg hover:border-fg",
  /** Tertiary action inside a card: a sunk fill. */
  soft: "bg-sunk text-fg hover:bg-rule-strong/40",
};

export function buttonClass(variant: Variant = "primary", block = false) {
  return `${base} ${variants[variant]} ${block ? "w-full" : ""}`;
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  block?: boolean;
};

export function Button({ variant, block, className = "", ...props }: ButtonProps) {
  return <button className={`${buttonClass(variant, block)} ${className}`} {...props} />;
}

type LinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
};

export function ButtonLink({ variant, block, className = "", ...props }: LinkProps) {
  return <Link className={`${buttonClass(variant, block)} ${className}`} {...props} />;
}
