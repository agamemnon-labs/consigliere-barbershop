/**
 * The Consigliere mark: a C that is also a comb. The round back of the C is the comb's spine, its
 * two arms are the thick outer teeth and five fine teeth sit inside. One path on a 120-unit grid
 * (ink box 88 x 96). It takes the text colour: suit green on cream, cream on the pinstripe card.
 * Master files, avatar and app icons: `brand/`.
 */
export const MARK_PATH =
  "M62 12H94C99.52 12 104 16.48 104 22V32H50C46.23 32 42.95 34.09 41.24 37.17H81.5C82.88 37.17 84 38.29 84 39.67C84 41.05 82.88 42.17 81.5 42.17H40V47.33H81.5C82.88 47.33 84 48.45 84 49.83C84 51.21 82.88 52.33 81.5 52.33H40V57.5H81.5C82.88 57.5 84 58.62 84 60C84 61.38 82.88 62.5 81.5 62.5H40V67.67H81.5C82.88 67.67 84 68.79 84 70.17C84 71.55 82.88 72.67 81.5 72.67H40V77.83H81.5C82.88 77.83 84 78.95 84 80.33C84 81.71 82.88 82.83 81.5 82.83H41.24C42.95 85.91 46.23 88 50 88H104V98C104 103.52 99.52 108 94 108H62C36.59 108 16 87.41 16 62V58C16 32.59 36.59 12 62 12Z";

type Props = {
  /** Set the height (`h-6`); the width follows. */
  className?: string;
  /** Only when the mark stands alone; next to the name it is decoration. */
  title?: string;
};

export function Mark({ className = "", title }: Props) {
  return (
    <svg
      viewBox="16 12 88 96"
      fill="currentColor"
      className={`aspect-[11/12] w-auto shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d={MARK_PATH} />
    </svg>
  );
}
