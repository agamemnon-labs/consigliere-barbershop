"use client";

import { buttonClass } from "@/components/button";

export function PrintButton() {
  return (
    <button type="button" className={`${buttonClass("quiet")} min-h-11`} onClick={() => window.print()}>
      Cetak
    </button>
  );
}
