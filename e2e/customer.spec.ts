import { expect, test } from "@playwright/test";

test("home shows branches and the pricelist, rows open downward", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Consigliere").first()).toBeVisible();
  await expect(page.getByText("Juanda").first()).toBeVisible();

  const haircut = page.locator("details.row", { hasText: "Haircut" });
  await haircut.locator("summary").click();
  await expect(haircut.getByText("Barber Executive")).toBeVisible();

  // No horizontal scrolling on a phone.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("style sheet renders all three themes", async ({ page }) => {
  await page.goto("/gaya");
  for (const theme of ["night", "paper", "display"]) {
    await expect(page.locator(`[data-theme="${theme}"]`).first()).toBeVisible();
  }
});
