import { expect, test } from "@playwright/test";

test("the counter tablet shows ticket numbers and never names", async ({ page }) => {
  await page.goto("/tablet/pulau-kalimantan");
  await expect(page.getByText("Jl. Pulau Kalimantan", { exact: true })).toBeVisible();
  await expect(page.getByText(/^P \d{3}$/).first()).toBeVisible();
  // Seeded demo customers have names; none may appear on a public screen. Whole words only:
  // the header reads "…KalimantanDiperbarui…" as one string, which hides an "andi".
  for (const name of ["Bram", "Rizal", "Andi", "Yoga", "Fajar", "Dimas"]) {
    await expect(page.getByText(new RegExp(`\\b${name}\\b`))).toHaveCount(0);
  }
});

test("an unknown branch tablet shows the not-found page", async ({ page }) => {
  await page.goto("/tablet/nowhere");
  await expect(page.getByRole("heading", { name: "Halaman ini hilang tanpa jejak" })).toBeVisible();
});
