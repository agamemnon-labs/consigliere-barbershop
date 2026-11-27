/*
 * A barber's monogram: their initial in sign-painter slab on a round tint, like a stamp on a
 * shop card. There are no staff photos in a portfolio demo, so it says who it is without
 * pretending to be a face.
 */

const tints = [
  "bg-mint text-mint-ink",
  "bg-blue-soft text-blue",
  "bg-butter text-butter-ink",
  "bg-sunk text-fg",
] as const;

function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tints[h % tints.length];
}

const sizes = {
  sm: "size-10 text-lg",
  md: "size-12 text-xl",
  lg: "size-16 text-[1.75rem]",
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
      className={`slab inline-flex shrink-0 items-center justify-center rounded-full leading-none ${sizes[size]} ${tintFor(name)} ${className}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
