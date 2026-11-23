import type { Viewport } from "next";
import { brand } from "@/config/brand";

export const viewport: Viewport = { themeColor: brand.palette.page };

/** Counter tablet and TV: the same palette on pure white, for reading across the room. Display only. */
export default function DisplayLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="display" className="min-h-dvh bg-bg text-fg">
      {children}
    </div>
  );
}
