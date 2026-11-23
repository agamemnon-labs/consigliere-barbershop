import Link from "next/link";
import { demoMode } from "@/server/env";

/** One butter-yellow line on top of every screen while the public demo runs. */
export function DemoRibbon() {
  if (!demoMode()) return null;
  return (
    <div className="bg-butter pt-[env(safe-area-inset-top)] text-[0.8125rem] text-butter-ink">
      <div className="mx-auto flex min-h-9 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <span className="truncate">Demo, tanpa uang sungguhan</span>
        <Link href="/demo" className="shrink-0 font-semibold underline underline-offset-4">
          Coba sebagai
        </Link>
      </div>
    </div>
  );
}
