import type { Viewport } from "next";
import { DemoRibbon } from "@/components/demo-ribbon";
import { brand } from "@/config/brand";

export const viewport: Viewport = { themeColor: brand.palette.page };

/** Cashier and admin: the same daylight palette as the customer app, denser layouts. */
export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <DemoRibbon />
      {children}
    </div>
  );
}
