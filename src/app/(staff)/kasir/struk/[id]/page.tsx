import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StaffShell } from "@/components/staff-shell";
import { brand } from "@/config/brand";
import { getDb } from "@/db";
import { phoneLabel } from "@/domain/booking";
import { METHOD_LABEL } from "@/domain/checkout";
import { formatRupiah } from "@/domain/money";
import { shortDate } from "@/domain/schedule";
import { shopClock, shopDate } from "@/domain/time";
import { getReceipt } from "@/server/checkout";
import { requireStaff } from "@/server/session";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Struk", robots: { index: false } };

/** A receipt sized for a 58 mm thermal printer; the browser's print dialog does the rest. */
export default function ReceiptPage({ params }: PageProps<"/kasir/struk/[id]">) {
  return (
    <StaffShell title="Struk" allow={["cashier", "admin", "owner"]}>
      <Suspense fallback={<p className="p-6 text-muted">Membuka struk…</p>}>
        <Receipt params={params} />
      </Suspense>
    </StaffShell>
  );
}

async function Receipt({ params }: { params: PageProps<"/kasir/struk/[id]">["params"] }) {
  const staff = await requireStaff(["cashier", "admin", "owner"]);
  const { id } = await params;
  const receipt = await getReceipt(await getDb(), id);
  if (!receipt) notFound();
  if (staff.role === "cashier" && staff.branchId !== receipt.tx.branchId) notFound();
  const { tx, branch } = receipt;
  const no = tx.id.slice(0, 8).toUpperCase();
  const edc = tx.total - receipt.creditUsed - receipt.balanceUsed;

  return (
    <div className="px-6 py-8">
      <div className="mx-auto mb-6 flex max-w-[22rem] items-center justify-between print:hidden">
        <Link href="/kasir" className="label min-h-11 content-center hover:text-fg">
          ← Kembali ke antrean
        </Link>
        <PrintButton />
      </div>

      <article className="receipt mx-auto max-w-[22rem] border border-rule bg-surface px-6 py-7 text-[0.8125rem] print:border-0 print:p-0">
        <div className="text-center">
          <p className="font-display text-xl uppercase tracking-[0.2em]">{brand.name}</p>
          <p className="mt-1">Cabang {branch.name}</p>
          <p className="text-muted">{branch.address}</p>
        </div>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 border-y border-dashed border-rule-strong py-3">
          <dt className="text-muted">No.</dt>
          <dd className="num text-right">{no}</dd>
          <dt className="text-muted">Waktu</dt>
          <dd className="num text-right">
            {shortDate(shopDate(tx.createdAt))}, {shopClock(tx.createdAt)}
          </dd>
          <dt className="text-muted">Barber</dt>
          <dd className="text-right">{receipt.barber ?? "—"}</dd>
          <dt className="text-muted">Kasir</dt>
          <dd className="text-right">{receipt.cashier ?? "—"}</dd>
        </dl>

        <ul className="mt-3 grid gap-1">
          {tx.items.map((i) => (
            <li key={`${i.serviceId}-${i.name}`} className="flex items-baseline">
              <span>{i.name}</span>
              <span className="leader" aria-hidden />
              <span className="num">{formatRupiah(i.price)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-0.5 border-t border-dashed border-rule-strong pt-3">
          {tx.discounts > 0 ? (
            <>
              <dt>
                {receipt.pointsRedeemed > 0 ? `Diskon (tukar ${receipt.pointsRedeemed} poin)` : "Diskon"}
              </dt>
              <dd className="num">−{formatRupiah(tx.discounts)}</dd>
            </>
          ) : null}
          <dt className="font-medium">Total</dt>
          <dd className="num text-base font-medium">{formatRupiah(tx.total)}</dd>
          {receipt.creditUsed > 0 ? (
            <>
              <dt className="text-muted">Kredit</dt>
              <dd className="num">{formatRupiah(receipt.creditUsed)}</dd>
            </>
          ) : null}
          {receipt.balanceUsed > 0 ? (
            <>
              <dt className="text-muted">Saldo member</dt>
              <dd className="num">{formatRupiah(receipt.balanceUsed)}</dd>
            </>
          ) : null}
          {edc > 0 ? (
            <>
              <dt className="text-muted">
                {receipt.creditUsed || receipt.balanceUsed ? "Sisa di EDC" : "Dibayar"}
              </dt>
              <dd className="text-right">
                {receipt.creditUsed || receipt.balanceUsed ? (
                  <span className="num">{formatRupiah(edc)}</span>
                ) : (
                  METHOD_LABEL[tx.method]
                )}
              </dd>
            </>
          ) : null}
        </dl>

        {receipt.member ? (
          <p className="mt-3 border-t border-dashed border-rule-strong pt-3 text-center">
            Member <span className="num">{receipt.member.memberNo}</span> · {receipt.member.name}
            {receipt.pointsEarned > 0 ? (
              <>
                <br />+{receipt.pointsEarned} poin dari kunjungan ini
              </>
            ) : null}
          </p>
        ) : null}

        <footer className="mt-6 text-center text-muted">
          <p>Terima kasih. Sampai jumpa lagi.</p>
          <p className="mt-1">Keluhan &amp; saran: WhatsApp {phoneLabel(brand.whatsappComplaints)}</p>
        </footer>
      </article>
    </div>
  );
}
