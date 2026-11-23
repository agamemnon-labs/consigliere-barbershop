"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { parseScore } from "@/domain/rating";
import { rateVisit } from "@/server/rating";

/** One tap on the ticket page: saves the customer's 1–5 for their finished visit. */
export async function rate(bookingId: string, value: number): Promise<{ error?: string }> {
  const score = parseScore(value);
  if (!score || !z.uuid().safeParse(bookingId).success) return { error: "Nilainya belum tersimpan." };
  const result = await rateVisit(await getDb(), bookingId, score);
  if (result === "not_done") return { error: "Nilai bisa diberikan setelah selesai cukur." };
  if (result === "missing") return { error: "Tiket tidak ditemukan." };
  return {};
}
