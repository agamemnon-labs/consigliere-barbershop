import { expect, test } from "@playwright/test";

test("home shows today's branches and the pricelist from the database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Hari ini ·/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Juanda/ })).toContainText("barber jaga");

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
});

test("every barber shows a week of rotation and their day off", async ({ page }) => {
  await page.goto("/barber");
  const vito = page.locator("details.row", { hasText: "Vito" });
  await vito.locator("summary").click();
  await expect(vito.getByText(/Libur rutin · Senin/)).toBeVisible();
  await expect(vito.locator("ol li")).toHaveCount(7);
});

test("style sheet renders all three themes", async ({ page }) => {
  await page.goto("/gaya");
  for (const theme of ["night", "paper", "display"]) {
    await expect(page.locator(`[data-theme="${theme}"]`).first()).toBeVisible();
  }
});
