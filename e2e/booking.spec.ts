import { expect, test } from "@playwright/test";

test("a customer takes a number, pays by (demo) QRIS and lands in the queue", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ambil nomor antrean" }).click();
  await expect(page.getByRole("heading", { name: "Ambil nomor." })).toBeVisible();
  await page.getByRole("link", { name: /Tepian/ }).click();
  await expect(page).toHaveURL(/\/antre\?cabang=tepian$/);

  await expect(page.getByLabel("Haircut")).toBeChecked();
  await page.getByText("Tambah layanan lain").click();
  await page.getByLabel("Classic Shaving").check();
  await expect(page.getByRole("button", { name: /^Bayar Rp/ })).toBeVisible();

  await page.getByLabel("Nama panggilan").fill("Bima");
  await page.getByLabel("Nomor WhatsApp").fill("0812 9999 0001");
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();

  await expect(page).toHaveURL(/\/tiket\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Bayar dengan QRIS." })).toBeVisible();
  await expect(page.getByRole("img", { name: /^QRIS untuk membayar/ })).toBeVisible();

  await page.getByRole("button", { name: "Simulasikan pembayaran" }).click();
  await expect(page.getByRole("heading", { name: "Kamu di antrean, Bima." })).toBeVisible();
  await expect(page.getByRole("figure", { name: /^Nomor antrean T \d{3}/ })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Classic Shaving", visible: true }),
  ).toBeVisible();
});

test("a wrong WhatsApp number gets a plain error and keeps what was typed", async ({ page }) => {
  await page.goto("/antre?cabang=juanda");
  await page.getByLabel("Nama panggilan").fill("Raka");
  await page.getByLabel("Nomor WhatsApp").fill("12345");
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Nomor WhatsApp" })).toContainText("belum benar");
  await expect(page.getByLabel("Nama panggilan")).toHaveValue("Raka");
});

test("the payment webhook refuses calls without the gateway's token", async ({ request }) => {
  const res = await request.post("/api/pembayaran/xendit", { data: { event: "payment.capture" } });
  expect([401, 503]).toContain(res.status());
});
