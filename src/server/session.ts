import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, STAFF_ROLES, type StaffRole } from "@/server/auth";
import { hasDatabase } from "@/server/env";

export type Staff = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  branchId: string | null;
};

/** The signed-in staff member, or null. Reads the request, so call it inside a Suspense boundary. */
export async function getStaff(): Promise<Staff | null> {
  if (!hasDatabase()) return null;
  const session = await auth().api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user?.isActive) return null;
  const role = user.role as string;
  if (!isStaffRole(role)) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    branchId: user.branchId ?? null,
  };
}

/** Use at the top of a staff-only page section. Sends anyone else to the staff login. */
export async function requireStaff(allowed: readonly StaffRole[] = STAFF_ROLES): Promise<Staff> {
  const staff = await getStaff();
  if (staff && allowed.includes(staff.role)) return staff;
  redirect("/staf/masuk");
}

function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** Where each role lands after signing in. */
export function homeFor(role: StaffRole): "/kasir" | "/admin" {
  return role === "cashier" ? "/kasir" : "/admin";
}
