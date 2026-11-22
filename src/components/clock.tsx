"use client";

import { useEffect, useState } from "react";
import { shopClock } from "@/domain/time";

/** Wall clock in WITA. Renders nothing until mounted, so server and client never disagree. */
export function Clock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time className={`num ${className}`} suppressHydrationWarning>
      {now ? shopClock(now) : " "}
    </time>
  );
}
