import { Bodoni_Moda, IBM_Plex_Mono, Libre_Franklin } from "next/font/google";

/** Display serif. Bodoni came out of Parma; it suits a brand called Consigliere. Optical sizes on. */
export const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-bodoni",
  display: "swap",
});

/** Plain, sturdy American grotesque for everything people actually read. */
export const franklin = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-franklin",
  display: "swap",
});

/** Ticket numbers, prices, clocks: tabular and calm. */
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
