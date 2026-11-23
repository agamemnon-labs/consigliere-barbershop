import { expect, test } from "@playwright/test";

test("the counter tablet shows ticket numbers and never names", async ({ page }) => {
  await page.goto("/tablet/pulau-kalimantan");
  await expect(page.getByText("Jl. Pulau Kalimantan", { exact: true })).toBeVisible();
  await expect(page.getByText(/^J \d{3}$/).first()).toBeVisible();
  // Seeded demo customers have names; none may appear on a public screen.
  for (const name of ["Bram", "Rizal", "Andi", "Yoga", "Fajar", "Dimas"]) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
});

test("an unknown branch tablet shows the not-found page", async ({ page }) => {
  await page.goto("/tablet/nowhere");
  await expect(page.getByRole("heading", { name: "Halaman ini tidak ada" })).toBeVisible();
});
