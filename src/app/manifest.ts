import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/** Add to home screen: the comb-C tile, cream splash. Icons are drawn from `brand/` (see brand/README.md). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.legalName,
    short_name: brand.name,
    description: `Ambil nomor dan bayar dari ponsel di ${brand.name}, ${brand.city}.`,
    lang: "id",
    start_url: "/",
    display: "standalone",
    background_color: brand.palette.page,
    theme_color: brand.palette.page,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
