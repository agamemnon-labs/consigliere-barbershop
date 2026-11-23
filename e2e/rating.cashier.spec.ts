import { expect, test } from "@playwright/test";
import { clearColumn, signInAsCashier } from "./helpers";

// Uses the Citra Niaga counter, which no other cashier test drives.
test("after the cut the customer rates the barber with one tap", async ({ browser }) => {
  const counter = await (await browser.newContext()).newPage();
  await signInAsCashier(counter, "citraniaga");
  const column = counter.getByRole("region", { name: /^Antrean / }).first();
  const barber = ((await column.getAttribute("aria-label")) ?? "").replace(/^Antrean /, "");
  expect(barber).not.toBe("");
  await clearColumn(column);

  // The customer books that barber and pays by demo QRIS.
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const name = `Nilai${Date.now() % 10_000}`;
  await phone.goto("/antre?cabang=citra-niaga");
  await phone.locator("label", { hasText: barber }).first().click();
  await phone.getByRole("button", { name: "Lanjut" }).click();
  await phone.getByRole("button", { name: "Lanjut" }).click();
  await phone.getByLabel("Nama panggilan").fill(name);
  await phone.getByLabel("Nomor WhatsApp").fill(`0812 6000 ${String(Date.now() % 10_000).padStart(4, "0")}`);
  await phone.getByRole("button", { name: /^Bayar .+ pakai QRIS$/ }).click();
  await phone.getByRole("button", { name: "Simulasikan pembayaran" }).click();
  await expect(phone.getByRole("heading", { name: `Kamu di antrean, ${name}` })).toBeVisible();
  // No stars while still waiting.
  await expect(phone.getByRole("button", { name: "5 dari 5" })).toHaveCount(0);

  // The counter calls, seats and finishes them; it was paid online, so no bill.
  await counter.reload();
  const row = column.getByRole("listitem").filter({ hasText: name });
  await row.getByRole("button", { name: "Panggil" }).click();
  await row.getByRole("button", { name: "Duduk" }).click();
  await column.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(column.getByText("Kursi kosong")).toBeVisible();

  // One tap; the choice stays after a reload and can't be changed.
  await phone.reload();
  await expect(phone.getByRole("heading", { name: `Terima kasih, ${name}` })).toBeVisible();
  await expect(phone.getByRole("heading", { name: `Gimana cukuran ${barber}?` })).toBeVisible();
  await phone.getByRole("button", { name: "4 dari 5" }).click();
  await expect(phone.getByRole("heading", { name: "Makasih, nilaimu tercatat" })).toBeVisible();
  await phone.reload();
  await expect(phone.getByRole("heading", { name: "Makasih, nilaimu tercatat" })).toBeVisible();
  await expect(phone.getByRole("button", { name: "4 dari 5" })).toHaveAttribute("aria-pressed", "true");
  await expect(phone.getByRole("button", { name: "1 dari 5" })).toBeDisabled();
});
