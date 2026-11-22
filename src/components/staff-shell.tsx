import type { ReactNode } from "react";
import { Suspense } from "react";
import { brand } from "@/config/brand";
import { signOut } from "@/server/actions/auth";
import type { StaffRole } from "@/server/auth";
import { requireStaff } from "@/server/session";

const roleName: Record<StaffRole, string> = { cashier: "Kasir", admin: "Admin", owner: "Pemilik" };

type Props = { title: string; allow: readonly StaffRole[]; children: ReactNode };

/** Header bar and session gate for staff screens. The session read streams in behind Suspense. */
export function StaffShell({ title, allow, children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-rule px-6 py-4">
        <p className="font-display text-lg uppercase tracking-[0.18em]">{brand.name}</p>
        <p className="label">{title}</p>
        <Suspense fallback={<span className="label">…</span>}>
          <Who allow={allow} />
        </Suspense>
      </header>
      <Suspense fallback={<p className="p-6 text-muted">Memuat…</p>}>
        <Gate allow={allow}>{children}</Gate>
      </Suspense>
    </div>
  );
}

async function Who({ allow }: { allow: readonly StaffRole[] }) {
  const staff = await requireStaff(allow);
  return (
    <form action={signOut} className="flex items-center gap-4">
      <span className="text-sm">
        {staff.name} <span className="text-muted">· {roleName[staff.role]}</span>
      </span>
      <button type="submit" className="label underline-offset-4 hover:text-fg hover:underline">
        Keluar
      </button>
    </form>
  );
}

async function Gate({ allow, children }: { allow: readonly StaffRole[]; children: ReactNode }) {
  await requireStaff(allow);
  return <main className="flex-1">{children}</main>;
}
