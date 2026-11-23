import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { BackLink } from "./back-link";
import { Wordmark } from "./wordmark";

type Props = {
  /** Where the back button goes. Without it the bar shows the wordmark (home). */
  back?: { href: ComponentProps<typeof Link>["href"]; label: string };
  right?: ReactNode;
};

/** Top bar of the customer app: the shop sign on home, a labelled back button elsewhere. */
export function AppBar({ back, right }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-bg">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-4 px-4">
        {back ? (
          <BackLink href={back.href}>{back.label}</BackLink>
        ) : (
          <Link href="/" aria-label="Consigliere, beranda" className="min-h-11 content-center">
            <Wordmark />
          </Link>
        )}
        {right}
      </div>
    </header>
  );
}
