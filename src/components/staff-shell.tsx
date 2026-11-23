import type { ReactNode } from "react";
import { Suspense } from "react";
import { signOut } from "@/server/actions/auth";
import type { StaffRole } from "@/server/auth";
import { requireStaff } from "@/server/session";
import { Avatar } from "./avatar";
import { LogOutIcon } from "./icons";
import { Wordmark } from "./wordmark";

const roleName: Record<StaffRole, string> = { cashier: "Kasir", admin: "Admin", owner: "Pemilik" };

type Props = {
  title: string;
  allow: readonly StaffRole[];
  /** Section tabs shown under the header bar. */
  tabs?: ReactNode;
  children: ReactNode;
};

/** Header bar and session gate for staff screens. The session read streams in behind Suspense. */
export function StaffShell({ title, allow, tabs, children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-surface">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Wordmark />
          <span className="hidden rounded-md bg-sunk px-2 py-0.5 text-sm font-medium text-muted sm:inline">
            {title}
          </span>
          <span className="flex-1" />
          <Suspense fallback={<span className="h-8 w-28 rounded-lg bg-sunk" />}>
            <Who allow={allow} />
          </Suspense>
        </div>
        {tabs ? <Suspense fallback={<div className="h-12" />}>{tabs}</Suspense> : null}
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
    <form action={signOut} className="flex items-center gap-3">
      <span className="flex items-center gap-2">
        <Avatar name={staff.name} size="sm" />
        <span className="leading-tight">
          <span className="block text-sm font-medium">{staff.name}</span>
          <span className="hidden text-xs text-muted sm:block">{roleName[staff.role]}</span>
        </span>
      </span>
      <button
        type="submit"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-muted hover:bg-sunk hover:text-fg"
      >
        <LogOutIcon size={18} />
        <span className="sr-only sm:not-sr-only">Keluar</span>
      </button>
    </form>
  );
}

async function Gate({ allow, children }: { allow: readonly StaffRole[]; children: ReactNode }) {
  await requireStaff(allow);
  return <main className="flex-1">{children}</main>;
}
