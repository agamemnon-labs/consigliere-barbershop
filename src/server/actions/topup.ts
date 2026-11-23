"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { MemberError } from "@/domain/membership";
import { PaymentError, paymentProvider } from "@/server/payments";
import { requireMemberUserId } from "@/server/session";
import { createTopupOrder, settleTopup } from "@/server/topup";

export type TopupState = { error?: string };

/** The member picks a package on their phone; we make the QRIS and open its pay page. */
export async function startTopup(_prev: TopupState, data: FormData): Promise<TopupState> {
  const userId = await requireMemberUserId();
  const packageId = z.uuid().safeParse(data.get("package"));
  if (!packageId.success) return { error: "Pilih paket dulu." };
  let id: string;
  try {
    id = await createTopupOrder(
      await getDb(),
      { userId, packageId: packageId.data },
      new Date(),
      paymentProvider(),
    );
  } catch (error) {
    if (error instanceof MemberError) return { error: error.message };
    if (error instanceof PaymentError)
      return { error: "Pembayaran sedang bermasalah. Coba lagi sebentar, ya." };
    throw error;
  }
  redirect(`/kartu/isi/${id}`);
}

/** Demo and test keys only: pay a top-up without a banking app. */
export async function simulateTopup(orderId: string): Promise<{ error?: string }> {
  const userId = await requireMemberUserId();
  const payments = paymentProvider();
  if (!payments.testMode) return { error: "Simulasi hanya ada di mode demo." };
  if (!z.uuid().safeParse(orderId).success) return { error: "Top-up tidak ditemukan." };
  const db = await getDb();
  const [row] = await db
    .select({ order: s.topupOrders, userId: s.members.userId })
    .from(s.topupOrders)
    .innerJoin(s.members, eq(s.members.id, s.topupOrders.memberId))
    .where(eq(s.topupOrders.id, orderId));
  if (!row || row.userId !== userId || !row.order.paymentId || row.order.status !== "pending")
    return { error: "Top-up ini tidak menunggu bayar." };

  const charge = { paymentId: row.order.paymentId, reference: row.order.id, amount: row.order.pay };
  try {
    await payments.simulatePaid(charge);
  } catch (error) {
    if (error instanceof PaymentError) return { error: "Simulasi gagal. Coba lagi." };
    throw error;
  }
  if (payments.name === "demo") {
    await settleTopup(db, { ...charge, status: "paid", amount: row.order.pay }, new Date());
  }
  return {};
}
