import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { StaffShell } from "@/components/staff-shell";

export const metadata: Metadata = { title: "Kasir", robots: { index: false } };

export default function CashierPage() {
  return (
    <StaffShell title="Kasir" allow={["cashier", "admin", "owner"]}>
      <Placeholder phase="3" what="Kolom antrean per barber, panggil, selesai, walk-in, dan scan member." />
    </StaffShell>
  );
}
