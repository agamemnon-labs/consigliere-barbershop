"use client";

import { ErrorScreen } from "@/components/error-screen";
import { archivo, slab } from "./fonts";
import "./globals.css";

/** Replaces the root layout when the layout itself crashes, so it brings its own document. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="id" className={`${archivo.variable} ${slab.variable}`}>
      <body className="min-h-dvh">
        <title>Ada yang macet</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
