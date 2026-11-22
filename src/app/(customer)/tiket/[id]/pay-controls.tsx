"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buttonClass } from "@/components/button";
import { simulatePayment } from "@/server/actions/booking";

/** Minutes and seconds left to pay; refreshes the page when time runs out. */
export function PayCountdown({ until }: { until: string }) {
  const router = useRouter();
  const end = new Date(until).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= end + 1000) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [end, router]);
  const s = Math.max(0, Math.ceil((end - now) / 1000));
  return (
    <span className="num" suppressHydrationWarning>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

/** Demo only: pay without a banking app. */
export function SimulatePay({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button
        type="button"
        className={buttonClass("quiet", true)}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await simulatePayment(bookingId);
            setError(result.error);
            router.refresh();
          })
        }
      >
        {pending ? "Memproses…" : "Simulasikan pembayaran"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-accent-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
