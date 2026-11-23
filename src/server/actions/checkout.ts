"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { normalizePhone } from "@/domain/booking";
import { CheckoutError } from "@/domain/checkout";
import { MemberError } from "@/domain/membership";
import { creditFor, payAndFinish } from "@/server/checkout";
import { birthdayRule, findMember, pointsRule } from "@/server/membership";
import { alertNearTurnsLater } from "@/server/notify-after";
import { requireStaff } from "@/server/session";

export type PayState = { error?: string; ok?: number };

const form = z.object({
  entryId: z.uuid(),
  edc: z.enum(["edc_card", "edc_qris"], { error: "Pilih cara bayar di mesin EDC." }),
  services: z.array(z.uuid()).min(1, "Pilih minimal satu layanan.").max(10),
  phone: z.string().trim().optional(),
  useCredit: z.coerce.number().int().min(0).optional(),
  memberId: z.uuid().optional(),
  birthday: z.literal("1").optional(),
  redeemUnits: z.coerce.number().int().min(0).max(100).optional(),
  balance: z.coerce.number().int().min(0).optional(),
  pin: z.string().trim().optional(),
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
    memberId: data.get("memberId") || undefined,
    birthday: data.get("birthday") || undefined,
    redeemUnits: data.get("redeemUnits") || undefined,
    balance: data.get("balance") || undefined,
    pin: data.get("pin") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { entryId, edc, services, phone, useCredit, memberId, birthday, redeemUnits, balance, pin } =
    parsed.data;

  const db = await getDb();
  try {
    await payAndFinish(
      db,
      {
        entryId,
        edc,
        phone,
        useCredit,
        ...(memberId
          ? { member: { id: memberId, birthday: birthday === "1", redeemUnits, balance, pin } }
          : {}),
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
    if (error instanceof CheckoutError || error instanceof MemberError) return { error: error.message };
    throw error;
  }
  // The chair is free, so everyone behind moved up one.
  const [line] = await db
    .select({ barberId: s.queueEntries.barberId, date: s.queueEntries.date })
    .from(s.queueEntries)
    .where(eq(s.queueEntries.id, entryId));
  if (line) alertNearTurnsLater(line.barberId, line.date);
  revalidatePath("/kasir");
  return { ok: Date.now() };
}

export type PayerInfo = {
  error?: string;
  credit?: number;
  phone?: string;
  member?: {
    id: string;
    memberNo: string;
    name: string;
    points: number;
    balance: number;
    birthday: boolean;
  };
  rules?: {
    points: { earnPer: number; redeemPoints: number; redeemValue: number };
    birthday: { percent: number; categories: string[]; stacksWithPoints: boolean };
  };
};

/** "Cek": a member card number (scanned or typed) or a WhatsApp number. Shows credit and member perks. */
export async function lookupPayer(query: string): Promise<PayerInfo> {
  await requireStaff();
  const db = await getDb();
  const now = new Date();
  const member = await findMember(db, query, now);
  if (member && member.status !== "active")
    return { error: `Member ${member.memberNo} sedang dinonaktifkan.` };
  const phone = member?.phone || normalizePhone(query);
  if (!phone) return { error: "Nomor member atau WhatsApp belum benar." };
  const credit = await creditFor(db, phone, now);
  if (!member) return { phone, credit };
  const [points, birthday] = await Promise.all([pointsRule(db), birthdayRule(db)]);
  return {
    phone,
    credit,
    member: {
      id: member.id,
      memberNo: member.memberNo,
      name: member.name,
      points: member.points,
      balance: member.balance,
      birthday: member.birthday,
    },
    rules: { points, birthday },
  };
}
