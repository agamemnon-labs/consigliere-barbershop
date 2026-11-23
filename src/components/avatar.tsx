/*
 * A barber's colour tile: their initial on one of four chair-and-pole tints. There are no
 * staff photos in a portfolio demo, so the tile says who it is without pretending to be a face.
 */

const tints = [
  "bg-mint text-mint-ink",
  "bg-blue-soft text-blue",
  "bg-butter text-butter-ink",
  "bg-accent-soft text-accent-ink",
] as const;

function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tints[h % tints.length];
}

const sizes = {
  sm: "size-10 rounded-xl text-lg",
  md: "size-12 rounded-2xl text-xl",
  lg: "size-16 rounded-2xl text-3xl",
} as const;

export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`condensed inline-flex shrink-0 items-center justify-center font-semibold ${sizes[size]} ${tintFor(name)} ${className}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
