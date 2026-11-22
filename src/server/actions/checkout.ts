"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { normalizePhone } from "@/domain/booking";
import { CheckoutError } from "@/domain/checkout";
import { creditFor, payAndFinish } from "@/server/checkout";
import { requireStaff } from "@/server/session";

export type PayState = { error?: string; ok?: number };

const form = z.object({
  entryId: z.uuid(),
  edc: z.enum(["edc_card", "edc_qris"], { error: "Pilih cara bayar di mesin EDC." }),
  services: z.array(z.uuid()).min(1, "Pilih minimal satu layanan.").max(10),
  phone: z.string().trim().optional(),
  useCredit: z.coerce.number().int().min(0).optional(),
});

/** "Lunas": the EDC took the money; record it and free the chair. */
export async function payAction(_prev: PayState, data: FormData): Promise<PayState> {
  const staff = await requireStaff();
  const parsed = form.safeParse({
    entryId: data.get("entryId"),
    edc: data.get("edc"),
    services: data.getAll("service"),
    phone: data.get("phone") || undefined,
    useCredit: data.get("useCredit") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { entryId, edc, services, phone, useCredit } = parsed.data;

  try {
    await payAndFinish(
      await getDb(),
      {
        entryId,
        edc,
        phone,
        useCredit,
        items: services.map((serviceId) => {
          const variantId = data.get(`variant-${serviceId}`);
          const price = Number(String(data.get(`price-${serviceId}`) ?? "").replace(/\D/g, ""));
          return {
            serviceId,
            ...(typeof variantId === "string" && variantId ? { variantId } : {}),
            ...(price > 0 ? { price } : {}),
          };
        }),
      },
      { id: staff.id, role: staff.role, branchId: staff.branchId },
      new Date(),
    );
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message };
    throw error;
  }
  revalidatePath("/kasir");
  return { ok: Date.now() };
}

/** "Cek kredit": how much credit a WhatsApp number can spend. */
export async function lookupCredit(phone: string): Promise<{ error?: string; amount?: number }> {
  await requireStaff();
  const normal = normalizePhone(phone);
  if (!normal) return { error: "Nomor WhatsApp belum benar." };
  return { amount: await creditFor(await getDb(), normal, new Date()) };
}
