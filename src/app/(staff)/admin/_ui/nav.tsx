import { StaffTabs } from "@/components/staff-tabs";

const TABS = [
  { href: "/admin", label: "Hari ini", exact: true },
  { href: "/admin/laporan", label: "Laporan" },
  { href: "/admin/online", label: "Bayar online" },
  { href: "/admin/rotasi", label: "Rotasi" },
  { href: "/admin/harga", label: "Harga" },
  { href: "/admin/barber", label: "Barber" },
  { href: "/admin/member", label: "Member" },
  { href: "/admin/aturan", label: "Aturan" },
  { href: "/admin/pesan", label: "Pesan" },
] as const;

export function AdminNav() {
  return <StaffTabs tabs={TABS} label="Back office" />;
}
