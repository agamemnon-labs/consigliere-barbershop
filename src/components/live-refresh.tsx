"use client";

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LiveDot } from "./live-dot";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Poll this often when there is no live socket (demo mode, or the socket dropped). */
const POLL_MS = 15_000;
/** Even with a live socket, refresh now and then so wait estimates keep ticking down. */
const TICK_MS = 60_000;

type Props = { branchId: string; className?: string };

/**
 * Keeps a queue screen current. Listens to the branch's Supabase broadcast
 * channel and re-renders the server data on every change; falls back to polling.
 * Renders a small status label next to a dot that breathes while the socket is live.
 */
export function LiveRefresh({ branchId, className = "" }: Props) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    let channel: RealtimeChannel | undefined;
    const client = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : undefined;
    if (client) {
      channel = client
        .channel(`queue:${branchId}`)
        .on("broadcast", { event: "changed" }, refresh)
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    }

    return () => {
      clearTimeout(timer);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [branchId, router]);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), live ? TICK_MS : POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, router]);

  return (
    <span className={`label inline-flex items-center gap-2 ${className}`} aria-live="polite">
      <LiveDot live={live} className={live ? "text-mint-ink" : "text-faint"} />
      {live ? "Langsung" : "Diperbarui tiap 15 detik"}
    </span>
  );
}
