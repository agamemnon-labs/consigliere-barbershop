import Link from "next/link";
import type { ComponentProps } from "react";

/** Small-caps link back up the hierarchy. */
export function BackLink({
  href,
  children,
}: {
  href: ComponentProps<typeof Link>["href"];
  children: string;
}) {
  return (
    <Link href={href} className="label inline-flex min-h-12 items-center gap-2 hover:text-fg">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}
