import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffShell } from "@/components/staff-shell";
import { CashierBoard } from "./board";

export const metadata: Metadata = { title: "Kasir", robots: { index: false } };

export default function CashierPage({ searchParams }: PageProps<"/kasir">) {
  return (
    <StaffShell title="Kasir" allow={["cashier", "admin", "owner"]}>
      <Suspense fallback={<p className="p-6 text-muted">Memuat antrean…</p>}>
        <CashierBoard searchParams={searchParams} />
      </Suspense>
    </StaffShell>
  );
}
