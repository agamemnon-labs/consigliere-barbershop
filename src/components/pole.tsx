/**
 * The barber pole. `turning` while what it labels is live (an open shop, a queue that updates
 * itself, someone in the chair); `off` greys it out (closed, connection lost).
 */
export function Pole({
  turning = false,
  off = false,
  className = "",
}: {
  turning?: boolean;
  off?: boolean;
  className?: string;
}) {
  return <span aria-hidden className={`pole ${className}`} data-live={turning} data-off={off} />;
}
