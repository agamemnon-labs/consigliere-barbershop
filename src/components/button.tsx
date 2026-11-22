import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "accent" | "quiet";

const base =
  "inline-flex min-h-12 items-center justify-center gap-3 rounded-sm px-6 text-[0.9375rem] font-medium tracking-[0.02em] transition-[opacity,translate,background-color] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  /** Default action: the page's ink on the page's paper, inverted. */
  primary: "bg-fg text-bg hover:opacity-90",
  /** Reserved for money and the one action that matters (Bayar, Panggil). */
  accent: "bg-accent text-accent-fg hover:opacity-90",
  quiet: "border border-rule-strong text-fg hover:bg-surface",
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
