import type { Viewport } from "next";
import { brand } from "@/config/brand";

export const viewport: Viewport = { themeColor: brand.palette.paper };

/** Cashier and admin share the light "paper" theme, easier on the eyes over a ten-hour shift. */
export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="paper" className="min-h-dvh bg-bg text-fg">
      {children}
    </div>
  );
}
