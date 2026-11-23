import type Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AppBar } from "./app-bar";
import { Credits } from "./credits";

type Props = {
  back?: { href: ComponentProps<typeof Link>["href"]; label: string };
  right?: ReactNode;
  /** A sticky bottom action bar (replaces the tab bar on flow screens). */
  bar?: ReactNode;
  credits?: boolean;
  children: ReactNode;
};

/** One customer screen: top bar, a phone-width column, and room for the bottom bar. */
export function Screen({ back, right, bar, credits = true, children }: Props) {
  return (
    <>
      <AppBar back={back} right={right} />
      <main className="mx-auto flex max-w-md flex-col px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        {children}
        {credits ? <Credits /> : null}
      </main>
      {bar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-md px-4 py-3">{bar}</div>
        </div>
      ) : null}
    </>
  );
}
