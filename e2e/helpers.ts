import { expect, type Locator, type Page } from "@playwright/test";

export async function signInAsCashier(page: Page, branch: "juanda" | "pramuka" | "tepian") {
  await page.goto("/staf/masuk");
  await page.getByLabel("Email").fill(`kasir.${branch}@consigliere.test`);
  await page.getByLabel("Kata sandi").fill("consigliere-demo");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/kasir$/);
}

/** Takes payment for whoever is in the chair: haircut only, EDC QRIS. */
export async function payForChair(column: Locator) {
  await column.getByText("Selesai & bayar").click();
  await column.getByText("QRIS", { exact: true }).click();
  await column.getByRole("button", { name: "Lunas", exact: true }).click();
}

/** Seat, finish (and pay) or cancel whoever is there so the column starts empty. */
export async function clearColumn(column: Locator) {
  for (let i = 0; i < 15; i++) {
    let clicked = false;
    if (await column.getByText("Selesai & bayar").isVisible()) {
      await payForChair(column);
      await expect(column.getByText("Kursi kosong")).toBeVisible();
      continue;
    }
    for (const name of ["Selesai", "Duduk", "Panggil", "Batal"]) {
      const button = column.getByRole("button", { name, exact: true }).first();
      if (await button.isVisible()) {
        const before = await column.textContent();
        await button.click();
        await expect.poll(() => column.textContent()).not.toBe(before);
        // Wait for the action to settle before looking for the next button.
        await expect(column.getByRole("button", { name: "…" })).toHaveCount(0);
        clicked = true;
        break;
      }
    }
    // A prepaid online entry asks who cancels first.
    const prepaid = column.locator("summary", { hasText: "Batal" }).first();
    if (!clicked && (await prepaid.isVisible())) {
      const before = await column.textContent();
      await prepaid.click();
      await column.getByRole("button", { name: "Pelanggan, uang jadi kredit" }).first().click();
      await expect.poll(() => column.textContent()).not.toBe(before);
      continue;
    }
    if (!clicked) return;
  }
}
