import { formatRupiah } from "@/domain/money";
import { ClockIcon } from "./icons";
import { PayCountdown } from "./pay-controls";
import { QrCode } from "./qr-code";

/** The QRIS to scan, the amount and the time left, on one white card. */
export function QrisPanel({
  qrString,
  amount,
  expiresAt,
}: {
  qrString: string | null;
  amount: number;
  expiresAt: Date;
}) {
  return (
    <div className="rounded-3xl border border-rule bg-surface p-5">
      <div className="mx-auto w-full max-w-60">
        {qrString ? (
          <QrCode value={qrString} label={`QRIS untuk membayar ${formatRupiah(amount)}`} />
        ) : (
          <p className="py-20 text-center text-muted">Menyiapkan QRIS…</p>
        )}
      </div>
      <div className="mt-5 flex items-end justify-between border-t border-rule pt-4">
        <div>
          <p className="label">Total</p>
          <p className="num text-[1.75rem] leading-tight font-semibold">{formatRupiah(amount)}</p>
        </div>
        <p className="flex items-center gap-1.5 pb-1 text-[0.9375rem] text-muted">
          <ClockIcon size={16} />
          Sisa <PayCountdown until={expiresAt.toISOString()} />
        </p>
      </div>
    </div>
  );
}
