import { StaffTabs } from "@/components/staff-tabs";

const TABS = [
  { href: "/kasir", label: "Antrean", exact: true },
  { href: "/kasir/member", label: "Member" },
] as const;

export function CashierTabs() {
  return <StaffTabs tabs={TABS} label="Kasir" />;
}
