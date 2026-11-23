import { expect, test } from "@playwright/test";

test("home shows today's queue per branch, and the pricelist comes from the database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Antrean sekarang" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Juanda/ })).toContainText("barber jaga");

  // No horizontal scrolling on a phone.
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(homeOverflow).toBeLessThanOrEqual(0);

  await page.getByRole("link", { name: "Semua harga" }).click();
  await expect(page).toHaveURL(/\/harga$/);
  const haircut = page.locator("details.row", { hasText: "Haircut" });
  await haircut.locator("summary").click();
  await expect(haircut.getByText("Barber Executive")).toBeVisible();
  await expect(haircut.getByText(/sampo dan kondisioner/)).toBeVisible();

  // No horizontal scrolling on a phone.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a branch lists the barbers on duty today", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Pramuka/ }).click();
  await expect(page).toHaveURL(/\/cabang\/pramuka$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pramuka" })).toBeVisible();
  await expect(page.getByText(/Barber hari ini/)).toBeVisible();
  // The live line streams in under each barber: who is in the chair, or an empty chair.
  await expect(page.getByText(/Mencukur|antre|Kursi kosong, langsung duduk/).first()).toBeVisible();
});

test("every barber shows a week of rotation and their day off", async ({ page }) => {
  await page.goto("/barber");
  const vito = page.locator("details.row", { hasText: "Vito" });
  await vito.locator("summary").click();
  await expect(vito.getByText(/Libur rutin: Senin/)).toBeVisible();
  await expect(vito.locator("ol li")).toHaveCount(7);
});

test("the style sheet shows the palette and the ticket", async ({ page }) => {
  await page.goto("/gaya");
  await expect(page.getByRole("heading", { name: "Barbershop lama, di siang hari" })).toBeVisible();
  await expect(page.getByRole("figure", { name: /^Nomor antrean J 021/ })).toBeVisible();
});
