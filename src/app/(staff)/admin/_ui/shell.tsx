import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff-shell";
import { AdminNav } from "./nav";

/** Back office frame: the staff header, one row of section links, then the page. */
export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <StaffShell title="Back office" allow={["admin", "owner"]}>
      <AdminNav />
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6">
        <h1 className="text-3xl">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </StaffShell>
  );
}
