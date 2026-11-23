import { Alfa_Slab_One, Archivo } from "next/font/google";

/**
 * Two faces, one job each.
 *
 * Alfa Slab One is the sign painter: a heavy slab like the lettering on an old barbershop window,
 * a tonic label or a fight poster. It sets the name, page titles and every ticket number, and
 * nothing small. Archivo, a grotesque cut from 19th-century American shop type, does the reading:
 * labels, lists, prices and buttons, with its width axis for small signage and dense figures.
 */
export const slab = Alfa_Slab_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-slab",
  display: "swap",
});

export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
