import { encode } from "uqr";

/** A QR code as one SVG path, ink on white, so any phone camera reads it. */
export function QrCode({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { data, size } = encode(value, { ecc: "M", border: 2 });
  let d = "";
  data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={`block aspect-square w-full bg-surface text-fg ${className}`}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
