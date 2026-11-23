import { Archivo } from "next/font/google";

/**
 * One family for everything. Archivo is a grotesque cut from 19th-century American poster and
 * shop-sign type, and its width axis does the expressive work: wide for the wordmark and
 * headlines (signage), normal for reading, condensed for ticket numbers (take-a-number stubs).
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
