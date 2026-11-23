import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowLeftIcon } from "./icons";

/** Round back button with a visible word, so it reads where it goes. */
export function BackLink({
  href,
  children,
}: {
  href: ComponentProps<typeof Link>["href"];
  children: string;
}) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[0.9375rem] font-medium hover:bg-sunk"
    >
      <ArrowLeftIcon />
      {children}
    </Link>
  );
}
