/**
 * The only place that knows who this barbershop is.
 * Swap these values to rebrand the whole system. Colours live as CSS tokens in
 * `src/app/globals.css`; the palette below documents them and feeds metadata.
 */
export const brand = {
  name: "Consigliere",
  legalName: "Consigliere Barbershop",
  tagline: "Rambut rapi, urusan beres",
  city: "Samarinda",
  established: 2026,
  /** Shown on the complaints line and in the footer. E.164 without the plus. */
  whatsappComplaints: "6281200000000",
  builtBy: { name: "Agamemnon", url: "https://github.com/agamemnon-labs" },
  timezone: "Asia/Makassar",
  locale: "id-ID",
  currency: "IDR",
  palette: {
    ink: "#15110e",
    bone: "#ebe3d4",
    oxblood: "#6e1d1b",
    paper: "#f3ecdf",
  },
} as const;

export type Brand = typeof brand;
