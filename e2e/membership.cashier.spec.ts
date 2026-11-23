import { expect, test } from "@playwright/test";
import { clearColumn, signInAsCashier } from "./helpers";

// Uses the Pramuka counter so it never races the Juanda cashier test.
test("the counter signs up a member, tops up, and the member pays from balance with their PIN", async ({
  page,
}) => {
  await signInAsCashier(page, "pramuka");
  await page.getByRole("link", { name: "Member", exact: true }).click();
  await expect(page).toHaveURL(/\/kasir\/member$/);

  const phone = `0813${String(Date.now()).slice(-8)}`;
  await page.getByLabel("Nomor kartu atau WhatsApp").fill(phone);
  await page.getByRole("button", { name: "Cari" }).click();
  await expect(page.getByText("Belum jadi member")).toBeVisible();

  const signUp = page.getByRole("region", { name: "Daftar member baru" });
  await signUp.getByLabel("Nama").fill("Uji Member");
  await signUp.getByLabel("Tanggal lahir").fill("1996-04-09");
  await signUp.getByLabel("PIN 6 angka (diketik member)").fill("582914");
  await signUp.getByLabel("Ulangi PIN").fill("582914");
  await signUp.getByText("QRIS", { exact: true }).click();
  await signUp.getByRole("button", { name: /^Daftar & lunas/ }).click();

  await expect(page).toHaveURL(/\/kasir\/member\?q=C\d{5}/);
  const memberNo = new URL(page.url()).searchParams.get("q") ?? "";
  await expect(page.getByText(`Member ${memberNo} terdaftar`)).toBeVisible();

  const topUp = page.getByRole("form", { name: "Top-up saldo" });
  await topUp.getByText("Rp300.000", { exact: true }).click();
  await topUp.getByText("Kartu", { exact: true }).click();
  await topUp.getByRole("button", { name: "Lunas, tambah saldo" }).click();
  await expect(page).toHaveURL(/\/kasir\/struk\//);
  await expect(page.locator("article.receipt")).toContainText("Top-up saldo");
  await expect(page.locator("article.receipt")).toContainText(memberNo);

  await page.goto("/kasir");
  const column = page.getByRole("region", { name: /^Antrean / }).first();
  await expect(column).toBeVisible();
  await clearColumn(column);
  await column.locator("summary", { hasText: "Walk-in" }).click();
  await column.getByLabel("Nama (boleh kosong)").fill("Uji Member");
  await column.getByRole("button", { name: /^Tambah ke antrean/ }).click();
  await column.getByRole("button", { name: "Panggil" }).click();
  await column.getByRole("button", { name: "Duduk" }).click();

  await column.getByText("Selesai & bayar").click();
  await column.getByLabel("Kartu member atau WhatsApp").fill(memberNo);
  await column.getByRole("button", { name: "Cek", exact: true }).click();
  await expect(column.getByText(memberNo, { exact: true })).toBeVisible();
  await column.getByText("Bayar pakai saldo").click();
  await column.getByLabel("PIN, diketik member").fill("582914");
  await expect(column.getByText("Tagih di EDC").locator("..")).toContainText("Rp0");
  await column.getByRole("button", { name: "Lunas tanpa EDC" }).click();
  await expect(column.getByText("Kursi kosong")).toBeVisible();

  const takings = page.getByRole("region", { name: "Pemasukan hari ini" });
  await expect(takings).toContainText("saldo member");
  await takings.getByRole("link").first().click();
  const receipt = page.locator("article.receipt");
  await expect(receipt).toContainText("Saldo member");
  await expect(receipt).toContainText(memberNo);
});

test("a birthday member gets half off the haircut at the counter", async ({ page }) => {
  await signInAsCashier(page, "pramuka");
  const column = page.getByRole("region", { name: /^Antrean / }).nth(1);
  await expect(column).toBeVisible();
  await clearColumn(column);
  await column.locator("summary", { hasText: "Walk-in" }).click();
  await column.getByRole("button", { name: /^Tambah ke antrean/ }).click();
  await column.getByRole("button", { name: "Panggil" }).click();
  await column.getByRole("button", { name: "Duduk" }).click();

  await column.getByText("Selesai & bayar").click();
  await column.getByLabel("Kartu member atau WhatsApp").fill("C00001");
  await column.getByLabel("Kartu member atau WhatsApp").press("Enter");
  await expect(column.getByText("Bram Wicaksono")).toBeVisible();
  await column.getByText(/^Bulan ulang tahun/).click();
  await expect(column.getByText("Diskon", { exact: true })).toBeVisible();
  await expect(column.getByText("Diskon ulang tahun tidak bisa digabung")).toBeVisible();
});
