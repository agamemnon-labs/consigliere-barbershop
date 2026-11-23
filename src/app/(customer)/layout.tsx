import { connection } from "next/server";
import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { DemoRibbon } from "@/components/demo-ribbon";

/** The customer app: a phone-width column, the demo line on top, three tabs at the bottom. */
export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <DemoRibbon />
      {children}
      <Suspense fallback={null}>
        <Tabs />
      </Suspense>
    </>
  );
}

/**
 * The tabs mark the page you are on, so they render per request. A prerendered copy could be
 * built for another path (the live home once shipped with no tab marked) and then fail to
 * hydrate against the browser's path.
 */
async function Tabs() {
  await connection();
  return <BottomNav />;
}
