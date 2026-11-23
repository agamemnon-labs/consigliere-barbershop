"use client";

import { buttonClass } from "@/components/button";
import { PrinterIcon } from "@/components/icons";

export function PrintButton() {
  return (
    <button type="button" className={`${buttonClass("quiet")} min-h-11`} onClick={() => window.print()}>
      <PrinterIcon size={18} />
      Cetak
    </button>
  );
}
