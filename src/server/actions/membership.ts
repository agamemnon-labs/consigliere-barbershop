"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, isDemoDatabase } from "@/db";
import { normalizePhone } from "@/domain/booking";
import { MemberError } from "@/domain/membership";
import { auth } from "@/server/auth";
import { createMember, requestPinReset, resetPin, topUp } from "@/server/membership";
import { requireStaff } from "@/server/session";

export type FormState = { error?: string; values?: Record<string, string> };

const edc = z.enum(["edc_card", "edc_qris"], { error: "Pilih cara bayar di mesin EDC." });

const signUpForm = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(60),
  phone: z.string().trim().min(8, "Nomor WhatsApp belum benar."),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal lahir."),
  pin: z.string().trim(),
  pin2: z.string().trim(),
  edc,
});

/** Counter sign-up: fee through the EDC, the member types their own PIN twice. */
export async function signUpMember(_prev: FormState, data: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const raw = Object.fromEntries(
    ["name", "phone", "dob", "pin", "pin2", "edc"].map((k) => [k, String(data.get(k) ?? "")]),
  );
  const values = { name: raw.name ?? "", phone: raw.phone ?? "", dob: raw.dob ?? "" };
  const parsed = signUpForm.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };
  if (parsed.data.pin !== parsed.data.pin2) return { error: "Kedua PIN tidak sama.", values };

  let memberNo: string;
  let creditMoved: number;
  try {
    ({ memberNo, creditMoved } = await createMember(
      await getDb(),
      parsed.data,
      { id: staff.id, role: staff.role, branchId: staff.branchId },
      new Date(),
    ));
  } catch (error) {
    if (error instanceof MemberError) return { error: error.message, values };
    throw error;
  }
  revalidatePath("/kasir");
  redirect(`/kasir/member?q=${memberNo}&baru=${creditMoved}`);
}

const topUpForm = z.object({ memberId: z.uuid(), packageId: z.uuid({ error: "Pilih paket top-up." }), edc });

export async function topUpMember(_prev: FormState, data: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = topUpForm.safeParse({
    memberId: data.get("memberId"),
    packageId: data.get("packageId"),
    edc: data.get("edc"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  let id: string;
  try {
    id = await topUp(
      await getDb(),
      parsed.data,
      { id: staff.id, role: staff.role, branchId: staff.branchId },
      new Date(),
    );
  } catch (error) {
    if (error instanceof MemberError) return { error: error.message };
    throw error;
  }
  revalidatePath("/kasir");
  redirect(`/kasir/struk/${id}`);
}

const WRONG = "Nomor atau PIN salah.";

/** Member login: WhatsApp number and 6-digit PIN. */
export async function signInMember(_prev: FormState, data: FormData): Promise<FormState> {
  const phoneInput = String(data.get("phone") ?? "");
  const pin = String(data.get("pin") ?? "").trim();
  const values = { phone: phoneInput };
  const phone = normalizePhone(phoneInput);
  if (!phone) return { error: "Nomor WhatsApp belum benar.", values };
  if (!/^\d{6}$/.test(pin)) return { error: "PIN 6 angka.", values };
  try {
    await (await auth()).api.signInPhoneNumber({
      body: { phoneNumber: phone, password: pin },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error:
          error.status === "TOO_MANY_REQUESTS" ? "Terlalu banyak percobaan. Coba lagi 15 menit lagi." : WRONG,
        values,
      };
    }
    throw error;
  }
  redirect("/kartu");
}

export async function signOutMember() {
  await (await auth()).api.signOut({ headers: await headers() });
  redirect("/masuk");
}

export type ResetState = FormState & { sent?: boolean; demoCode?: string };

/**
 * Step one sends a code to WhatsApp; step two sets the new PIN. The answer is
 * the same whether or not the number is a member, so it can't be used to probe.
 */
export async function forgotPin(prev: ResetState, data: FormData): Promise<ResetState> {
  const db = await getDb();
  const now = new Date();
  const phone = String(data.get("phone") ?? "");
  const values = { phone };
  if (!normalizePhone(phone)) return { error: "Nomor WhatsApp belum benar.", values };

  if (!prev.sent || data.get("step") === "send") {
    const code = await requestPinReset(db, phone, now);
    return { sent: true, values, ...(code && isDemoDatabase() ? { demoCode: code } : {}) };
  }

  const pin = String(data.get("pin") ?? "").trim();
  if (pin !== String(data.get("pin2") ?? "").trim()) return { ...prev, error: "Kedua PIN tidak sama." };
  try {
    await resetPin(db, phone, String(data.get("code") ?? ""), pin, now);
  } catch (error) {
    if (error instanceof MemberError) return { ...prev, error: error.message };
    throw error;
  }
  redirect("/masuk?pin=baru");
}
