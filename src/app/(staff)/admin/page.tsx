import type { Metadata } from "next";
import { Placeholder } from "@/components/placeholder";
import { StaffShell } from "@/components/staff-shell";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <StaffShell title="Back office" allow={["admin", "owner"]}>
      <Placeholder phase="7" what="Rotasi barber, harga, member, aturan, dan laporan pendapatan." />
    </StaffShell>
  );
}
