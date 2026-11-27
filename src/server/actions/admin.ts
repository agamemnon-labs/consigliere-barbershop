"use server";

import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { AdminError, type Cell } from "@/domain/report";
import { shopDate } from "@/domain/time";
import * as bo from "@/server/backoffice";
import { connectWebhook, TelegramError } from "@/server/chat/telegram";
import { requireStaff } from "@/server/session";

export type AdminState = { error?: string; ok?: number; message?: string };

const int = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d-]/g, ""));
const str = (v: FormDataEntryValue | null) => String(v ?? "");

/** Runs a back-office change as admin or owner, turning rule errors into a message. */
async function run(path: string, fn: (actor: { id: string }) => Promise<string | undefined | unknown>) {
  const staff = await requireStaff(["admin", "owner"]);
  try {
    const out = await fn({ id: staff.id });
    revalidatePath(path);
    return { ok: Date.now(), ...(typeof out === "string" ? { message: out } : {}) };
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }
}

export async function saveRotationAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/rotasi", async (actor) => {
    const cells: Cell[] = [];
    for (const [key, value] of data.entries()) {
      const m = /^cell:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/.exec(key);
      if (m?.[1] && m[2]) cells.push({ barberId: m[1], date: m[2], value: str(value) });
    }
    const n = await bo.saveRotation(await getDb(), cells, actor);
    updateTag("rotation");
    return n === 0 ? "Tidak ada yang berubah" : `${n} hari diubah`;
  });
}

export async function copyWeekAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/rotasi", async (actor) => {
    const n = await bo.copyLastWeek(await getDb(), str(data.get("monday")), actor);
    updateTag("rotation");
    return n === 0 ? "Sudah sama dengan minggu lalu" : `${n} hari disalin`;
  });
}

export async function updateServiceAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/harga", async (actor) => {
    const variants = [...data.keys()]
      .filter((k) => k.startsWith("variant:"))
      .map((k) => ({ id: k.slice(8), price: int(data.get(k)) }));
    await bo.updateService(
      await getDb(),
      {
        id: str(data.get("id")),
        ...(data.has("price") ? { price: int(data.get("price")) } : {}),
        ...(data.has("priceFrom") ? { priceFrom: int(data.get("priceFrom")) } : {}),
        durationMin: int(data.get("durationMin")),
        isActive: data.get("isActive") === "on",
        variants,
      },
      actor,
    );
    updateTag("catalog");
  });
}

export async function updateLevelAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/harga", async (actor) => {
    await bo.updateLevel(
      await getDb(),
      {
        id: str(data.get("id")),
        haircutPrice: int(data.get("haircutPrice")),
        commissionPercent: Number(str(data.get("commission")).replace(",", ".")),
      },
      actor,
    );
    updateTag("catalog");
  });
}

export async function changeLevelAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/barber", async (actor) => {
    const today = shopDate();
    const from = str(data.get("from")) || today;
    await bo.changeLevel(
      await getDb(),
      { barberId: str(data.get("barberId")), levelId: str(data.get("levelId")), from },
      today,
      actor,
    );
    updateTag("catalog");
    return from === today ? "Berlaku hari ini" : `Berlaku mulai ${from}`;
  });
}

export async function setBarberActiveAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/barber", async (actor) => {
    const active = data.get("active") === "1";
    await bo.setBarberActive(await getDb(), str(data.get("barberId")), active, actor);
    updateTag("catalog");
    return active ? "Aktif lagi" : "Dinonaktifkan";
  });
}

export async function updateMemberAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/member", async (actor) => {
    await bo.updateMember(
      await getDb(),
      {
        id: str(data.get("id")),
        name: str(data.get("name")),
        memberNo: str(data.get("memberNo")),
        status: data.get("status") === "suspended" ? "suspended" : "active",
      },
      actor,
    );
  });
}

export async function adjustMemberAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/member", async (actor) => {
    await bo.adjustMember(
      await getDb(),
      {
        id: str(data.get("id")),
        kind: data.get("kind") === "points" ? "points" : "balance",
        delta: int(data.get("delta")),
        reason: str(data.get("reason")),
      },
      new Date(),
      actor,
    );
  });
}

export async function saveRulesAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/aturan", async (actor) => {
    await bo.saveRules(
      await getDb(),
      {
        membershipFee: int(data.get("membershipFee")),
        points: {
          earnPer: int(data.get("earnPer")),
          redeemPoints: int(data.get("redeemPoints")),
          redeemValue: int(data.get("redeemValue")),
        },
        birthday: {
          percent: int(data.get("birthdayPercent")),
          categories: data.getAll("birthdayCategory").map(String),
          stacksWithPoints: data.get("stacksWithPoints") === "on",
        },
        graceMinutes: int(data.get("graceMinutes")),
        creditDays: int(data.get("creditDays")),
        pendingMinutes: int(data.get("pendingMinutes")),
        onlineClosesBefore: int(data.get("onlineClosesBefore")),
        commissionPercent: Number(str(data.get("commissionPercent")).replace(",", ".")),
      },
      actor,
    );
  });
}

export async function savePackageAction(_p: AdminState, data: FormData): Promise<AdminState> {
  return run("/admin/aturan", async (actor) => {
    const id = str(data.get("id"));
    await bo.savePackage(
      await getDb(),
      {
        ...(id ? { id } : {}),
        pay: int(data.get("pay")),
        get: int(data.get("get")),
        isActive: id ? data.get("isActive") === "on" : true,
      },
      actor,
    );
  });
}

/** Points the Telegram bot at this deployment. Telegram refuses anything but https. */
export async function connectTelegramAction(_p: AdminState, _data: FormData): Promise<AdminState> {
  await requireStaff(["admin", "owner"]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  try {
    const url = await connectWebhook(`${proto}://${host}`);
    revalidatePath("/admin/chat");
    return { ok: Date.now(), message: `Tersambung ke ${url}` };
  } catch (error) {
    if (error instanceof TelegramError) return { error: error.message };
    throw error;
  }
}
