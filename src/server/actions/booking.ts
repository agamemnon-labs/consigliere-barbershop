"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, isDemoDatabase, schema as s } from "@/db";
import { BookingError, normalizePhone } from "@/domain/booking";
import { createBooking, settlePayment } from "@/server/booking";
import { PaymentError, paymentProvider } from "@/server/payments";

export type BookState = { error?: string; values?: { name: string; phone: string } };

const input = z.object({
  branchSlug: z.string().min(1),
  barber: z.string().min(1, "Pilih barber dulu."),
  services: z
    .array(z.string())
    .min(1, "Pilih minimal satu layanan.")
    .max(6, "Paling banyak enam layanan sekali pesan."),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(60, "Nama terlalu panjang."),
  phone: z.string().trim().min(1, "Nomor WhatsApp wajib diisi."),
});

/** "Bayar dengan QRIS": prices, saves a pending booking, and opens its ticket page with the QR. */
export async function book(_prev: BookState, form: FormData): Promise<BookState> {
  const values = { name: String(form.get("name") ?? ""), phone: String(form.get("phone") ?? "") };
  const parsed = input.safeParse({
    branchSlug: form.get("branch"),
    barber: form.get("barber"),
    services: form.getAll("service"),
    name: form.get("name"),
    phone: form.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Nomor WhatsApp belum benar. Contoh: 0812 3456 7890.", values };

  let id: string;
  try {
    id = await createBooking(
      await getDb(),
      {
        branchSlug: parsed.data.branchSlug,
        barber: parsed.data.barber,
        services: parsed.data.services.map((serviceId) => {
          const variantId = form.get(`variant-${serviceId}`);
          return typeof variantId === "string" && variantId ? { serviceId, variantId } : { serviceId };
        }),
        name: parsed.data.name,
        phone,
      },
      new Date(),
      paymentProvider(),
      { enforceHours: !isDemoDatabase() },
    );
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message, values };
    if (error instanceof PaymentError) {
      console.error(error);
      return { error: "Pembayaran sedang bermasalah. Coba lagi sebentar, ya.", values };
    }
    throw error;
  }
  redirect(`/tiket/${id}`);
}

/**
 * Demo and test keys only: pay without a phone. With the demo provider the
 * booking settles right here; with Xendit test keys the webhook settles it.
 */
export async function simulatePayment(bookingId: string): Promise<{ error?: string }> {
  const payments = paymentProvider();
  if (!payments.testMode) return { error: "Simulasi hanya ada di mode demo." };
  if (!z.uuid().safeParse(bookingId).success) return { error: "Booking tidak ditemukan." };
  const db = await getDb();
  const [booking] = await db.select().from(s.bookings).where(eq(s.bookings.id, bookingId));
  if (!booking?.paymentId || booking.status !== "pending")
    return { error: "Booking ini tidak menunggu bayar." };

  const charge = { paymentId: booking.paymentId, reference: booking.id, amount: booking.amount };
  try {
    await payments.simulatePaid(charge);
  } catch (error) {
    if (error instanceof PaymentError) return { error: "Simulasi gagal. Coba lagi." };
    throw error;
  }
  if (payments.name === "demo") {
    await settlePayment(db, { ...charge, status: "paid", amount: booking.amount }, new Date());
  }
  return {};
}
