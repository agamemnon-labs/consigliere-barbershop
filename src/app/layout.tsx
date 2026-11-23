import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import { archivo, slab } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${brand.legalName}, ${brand.city}`,
    template: `%s · ${brand.name}`,
  },
  description: `Lihat antrean, harga, dan barber ${brand.name} di ${brand.city}. Ambil nomor dan bayar dari ponsel.`,
  applicationName: brand.name,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: brand.palette.page,
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${archivo.variable} ${slab.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
