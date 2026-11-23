import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { DemoRibbon } from "@/components/demo-ribbon";

/** The customer app: a phone-width column, the demo line on top, three tabs at the bottom. */
export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <DemoRibbon />
      {children}
      {/* The tabs read the path, which dynamic routes only know at request time. */}
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </>
  );
}
