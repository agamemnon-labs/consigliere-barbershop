import type { Viewport } from "next";

export const viewport: Viewport = { themeColor: "#0d0b09" };

/** Counter tablet and TV: the darkest, highest-contrast theme. Display only. */
export default function DisplayLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="display" className="min-h-dvh bg-bg text-fg">
      {children}
    </div>
  );
}
