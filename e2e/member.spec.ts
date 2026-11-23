import { expect, test } from "@playwright/test";

test("the member card asks for a login first", async ({ page }) => {
  await page.goto("/kartu");
  await expect(page).toHaveURL(/\/masuk/);
  await expect(page.getByRole("heading", { name: "Masuk", exact: true })).toBeVisible();
});

test("a member signs in with WhatsApp and PIN and sees their card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Buka kartu member" }).click();
  await page.getByLabel("Nomor WhatsApp").fill("0812-0000-0002");
  await page.getByLabel("PIN").fill("000001");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText("Nomor atau PIN salah.")).toBeVisible();

  await page.getByLabel("PIN").fill("482913");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/kartu$/);
  await expect(page.getByRole("heading", { name: "Rizal Hakim" })).toBeVisible();
  await expect(page.getByRole("img", { name: "QR kartu member C00002" })).toBeVisible();
  await expect(page.getByText("Rp330.000")).toBeVisible();

  // Top up from the phone: pick the 300K package, pay the demo QRIS, balance goes up by 330K.
  await page.getByRole("link", { name: "Isi saldo" }).click();
  await page.getByLabel(/Rp300\.000/).check();
  await page.getByRole("button", { name: "Bayar Rp300.000 dengan QRIS" }).click();
  await expect(page.getByRole("heading", { name: "Bayar dengan QRIS" })).toBeVisible();
  await page.getByRole("button", { name: "Simulasikan pembayaran" }).click();
  await expect(page.getByRole("heading", { name: "Saldo bertambah Rp330.000" })).toBeVisible();
  await page.getByRole("link", { name: "Lihat kartu" }).click();
  await expect(page.getByText("Rp660.000")).toBeVisible();

  await page.getByRole("button", { name: "Keluar dari kartu" }).click();
  await expect(page).toHaveURL(/\/masuk$/);
});

test("a member who forgot their PIN sets a new one with the WhatsApp code", async ({ page }) => {
  await page.goto("/masuk/lupa-pin");
  await page.getByLabel("Nomor WhatsApp").fill("081200000001");
  await page.getByRole("button", { name: "Kirim kode" }).click();
  // Demo mode shows the code that would go to WhatsApp.
  const code = (await page.locator("aside .num").textContent())?.trim() ?? "";
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("Kode dari WhatsApp").fill(code);
  await page.getByLabel("PIN baru, 6 angka").fill("482913");
  await page.getByLabel("Ulangi PIN baru").fill("482913");
  await page.getByRole("button", { name: "Simpan PIN baru" }).click();
  await expect(page).toHaveURL(/\/masuk\?pin=baru$/);
  await expect(page.getByText("PIN sudah diganti")).toBeVisible();

  await page.getByLabel("Nomor WhatsApp").fill("081200000001");
  await page.getByLabel("PIN").fill("482913");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Bram Wicaksono" })).toBeVisible();
  await expect(page.getByText("Selamat ulang tahun.")).toBeVisible();
});
