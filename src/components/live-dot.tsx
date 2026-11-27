/**
 * Live status: a small dot in the text colour. While what it labels is live (an open shop, a queue
 * that updates itself, someone in the chair) a ring breathes out of it; `off` fades it (closed,
 * connection lost).
 */
export function LiveDot({
  live = false,
  off = false,
  className = "",
}: {
  live?: boolean;
  off?: boolean;
  className?: string;
}) {
  return <span aria-hidden className={`live-dot ${className}`} data-live={live} data-off={off} />;
}
