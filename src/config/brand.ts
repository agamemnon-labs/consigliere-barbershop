/**
 * The only place that knows who this barbershop is.
 * Swap these values to rebrand the whole system. Colours live as CSS tokens in
 * `src/app/globals.css`; the palette below documents them and feeds metadata.
 */
export const brand = {
  name: "Consigliere",
  legalName: "Consigliere Barbershop",
  tagline: "Cukur tanpa nunggu lama",
  city: "Samarinda",
  established: 2026,
  /** Shown on the complaints line and in the footer. E.164 without the plus. */
  whatsappComplaints: "6281200000000",
  builtBy: {
    name: "Agamemnon",
    url: "https://github.com/agamemnon-labs",
    repo: "https://github.com/agamemnon-labs/consigliere-barbershop",
  },
  timezone: "Asia/Makassar",
  locale: "id-ID",
  currency: "IDR",
  palette: {
    page: "#f3f5f8",
    ink: "#0e1630",
    poleRed: "#d22d23",
    poleBlue: "#2548c9",
    chairMint: "#ddf3e8",
    navy: "#14213d",
  },
} as const;

export type Brand = typeof brand;
