import { expect, test } from "@playwright/test";

test("staff areas send signed-out visitors to the staff login", async ({ page }) => {
  await page.goto("/kasir");
  await expect(page).toHaveURL(/\/staf\/masuk\?lanjut=%2Fkasir/);
  await expect(page.getByRole("heading", { name: "Selamat bekerja" })).toBeVisible();
});

test("a cashier signs in, lands on the cashier screen, and signs out", async ({ page }) => {
  await page.goto("/staf/masuk");
  await page.getByLabel("Email").fill("kasir.juanda@consigliere.test");
  await page.getByLabel("Kata sandi").fill("consigliere-demo");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/kasir$/);
  await expect(page.getByText("Connie")).toBeVisible();
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/staf\/masuk/);
});

test("a wrong password gets a plain error", async ({ page }) => {
  await page.goto("/staf/masuk");
  await page.getByLabel("Email").fill("owner@consigliere.test");
  await page.getByLabel("Kata sandi").fill("not the password");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "salah" })).toHaveText(
    "Email atau kata sandi salah.",
  );
});
