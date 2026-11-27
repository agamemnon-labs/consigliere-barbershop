/**
 * The only place that knows who this barbershop is.
 * Swap these values to rebrand the whole system. Colours live as CSS tokens in
 * `src/app/globals.css`; the palette below documents them and feeds metadata.
 */
export const brand = {
  name: "Consigliere",
  legalName: "Consigliere Barbershop",
  tagline: "Duduk tenang, giliranmu kami atur",
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
    page: "#f4ebdc",
    ink: "#2b1f17",
    /** The one action colour: bottle green. */
    accent: "#1d5c46",
    /** Errors and destructive actions only. */
    danger: "#b42318",
    /** Selected, focus and links. */
    blue: "#284b9e",
    chairMint: "#d9eddf",
    /** The comb-C mark and the name (`brand/`, `components/mark.tsx`). */
    suit: "#1f3a2e",
  },
} as const;

export type Brand = typeof brand;
