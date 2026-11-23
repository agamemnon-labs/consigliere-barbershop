import { expect, test } from "@playwright/test";

test("the demo ribbon leads to one-tap logins", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Coba sebagai", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Coba sebagai" })).toBeVisible();
  await page.getByRole("button", { name: /Member/ }).click();
  await expect(page).toHaveURL(/\/kartu$/);
  await expect(page.getByRole("heading", { name: "Rizal Hakim" })).toBeVisible();

  await page.goto("/demo");
  await page.getByRole("button", { name: /Pemilik/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
