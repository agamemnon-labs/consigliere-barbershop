import { expect, type Page, test } from "@playwright/test";

// One owner session walks the back office; edits are small and leave demo data usable.
test.describe.configure({ mode: "serial" });

async function signInAsOwner(page: Page) {
  await page.goto("/staf/masuk");
  await page.getByLabel("Email").fill("owner@consigliere.test");
  await page.getByLabel("Kata sandi").fill("consigliere-demo");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("the owner sees today and a report with CSV export", async ({ page }) => {
  await signInAsOwner(page);
  await expect(page.getByText("Uang masuk di semua cabang")).toBeVisible();
  await expect(page.getByText("Juanda", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Buka papan antrean" }).first()).toBeVisible();

  await page.getByRole("navigation", { name: "Back office" }).getByRole("link", { name: "Laporan" }).click();
  await page.getByRole("link", { name: "7 hari" }).click();
  await expect(page.getByRole("region", { name: "Komisi barber" })).toBeVisible();
  const href = await page.getByRole("link", { name: "Unduh CSV" }).first().getAttribute("href");
  const res = await page.request.get(href ?? "");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toContain("barber,layanan,penjualan,komisi");
});

test("a price change shows on the public pricelist", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/harga");
  await page.getByText("Classic Shaving").click();
  const form = page.getByRole("form", { name: "Classic Shaving" });
  await form.getByLabel("Harga", { exact: true }).fill("75000");
  await form.getByRole("button", { name: "Simpan" }).click();
  await expect(form.getByRole("status")).toHaveText("Tersimpan");

  await page.goto("/harga");
  await expect(page.locator("details.row", { hasText: "Classic Shaving" }).locator("summary")).toContainText(
    "75K",
  );
});

test("rotation saves a changed day", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/rotasi");
  await page.getByRole("link", { name: "Minggu depan" }).click();
  await expect(page).toHaveURL(/minggu=/);
  // The grid is a controlled form: let it hydrate before changing a cell.
  await page.waitForLoadState("networkidle");
  const cell = page.getByRole("combobox").first();
  const now = await cell.inputValue();
  await cell.selectOption(now === "off" ? { label: "Juanda" } : "off");
  await expect(cell).not.toHaveValue(now);
  await page.getByRole("button", { name: "Simpan rotasi" }).click();
  await expect(page.getByRole("status")).toHaveText("1 hari diubah");
});

test("members can be corrected with a reason, and rules save", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/member?q=rizal");
  await page.getByRole("link", { name: /Rizal Hakim/ }).click();
  await page.getByText("Koreksi poin atau saldo").click();
  const form = page.getByRole("form", { name: "Koreksi" });
  await form.getByLabel("Yang dikoreksi").selectOption("points");
  await form.getByLabel(/^Jumlah/).fill("2");
  await form.getByLabel("Alasan").fill("Uji koreksi");
  await form.getByRole("button", { name: "Simpan koreksi" }).click();
  await expect(form.getByRole("status")).toHaveText("Tersimpan");
  await expect(page.getByRole("region", { name: "Riwayat" })).toContainText("adjust: Uji koreksi");

  await page.goto("/admin/aturan");
  const rules = page.getByRole("form", { name: "Aturan" });
  await rules.getByRole("button", { name: "Simpan aturan" }).click();
  await expect(rules.getByRole("status")).toHaveText("Tersimpan");
});

test("a cashier can't open the back office", async ({ page }) => {
  await page.goto("/staf/masuk");
  await page.getByLabel("Email").fill("kasir.tepian@consigliere.test");
  await page.getByLabel("Kata sandi").fill("consigliere-demo");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/kasir$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/staf\/masuk/);
});
