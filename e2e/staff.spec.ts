import { expect, test } from "@playwright/test";

test("staff areas send signed-out visitors to the staff login", async ({ page }) => {
  await page.goto("/kasir");
  await expect(page).toHaveURL(/\/staf\/masuk\?lanjut=%2Fkasir/);
  await expect(page.getByRole("heading", { name: "Selamat bekerja." })).toBeVisible();
});
