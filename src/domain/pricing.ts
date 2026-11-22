import { formatShort } from "./money.ts";

/** The shape the pricing rules need; matches the services table plus its variants. */
export type PricedService = {
  priceType: "fixed" | "from" | "by_level" | "variant";
  price: number | null;
  priceFrom: number | null;
  variants: { price: number }[];
};

/**
 * The short price shown on a pricelist row.
 * by_level: range across barber levels ("80K–125K"); from / variant: lowest with "+".
 */
export function priceLabel(service: PricedService, haircutPrices: number[]): string {
  switch (service.priceType) {
    case "by_level": {
      if (haircutPrices.length === 0) return "—";
      const lo = Math.min(...haircutPrices);
      const hi = Math.max(...haircutPrices);
      return lo === hi ? formatShort(lo) : `${formatShort(lo)}–${formatShort(hi)}`;
    }
    case "from":
      return `${formatShort(required(service.priceFrom, "priceFrom"))}+`;
    case "variant": {
      if (service.variants.length === 0) return "—";
      return `${formatShort(Math.min(...service.variants.map((v) => v.price)))}+`;
    }
    case "fixed":
      return formatShort(required(service.price, "price"));
  }
}

function required(value: number | null, field: string): number {
  if (value === null) throw new Error(`Service is missing ${field}`);
  return value;
}
