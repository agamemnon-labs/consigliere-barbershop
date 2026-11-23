"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads the server page every few seconds while the tab is visible, e.g. waiting for a payment. */
export function PollRefresh({ everyMs = 5_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [everyMs, router]);
  return null;
}
