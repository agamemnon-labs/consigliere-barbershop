import { expect, type Locator, type Page, test } from "@playwright/test";

// These tests change the shared demo queue, so they run one after another.
test.describe.configure({ mode: "serial" });

async function signInAsJuandaCashier(page: Page) {
  await page.goto("/staf/masuk");
  await page.getByLabel("Email").fill("kasir.juanda@consigliere.test");
  await page.getByLabel("Kata sandi").fill("consigliere-demo");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/kasir$/);
}

/** Seat, finish or cancel whoever is there so the column starts empty. */
async function clearColumn(column: Locator) {
  for (let i = 0; i < 15; i++) {
    let clicked = false;
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
    if (!clicked) return;
  }
}

test("the cashier adds a walk-in, calls, seats and finishes them", async ({ page }) => {
  await signInAsJuandaCashier(page);
  const column = page.getByRole("region", { name: /^Antrean / }).last();
  await expect(column).toBeVisible();
  await clearColumn(column);

  const name = `Uji ${Date.now() % 10_000}`;
  await column.getByText("+ Walk-in").click();
  await column.getByLabel("Nama (boleh kosong)").fill(name);
  await column.getByRole("button", { name: /^Tambah ke antrean/ }).click();
  const row = column.getByRole("listitem").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Walk-in");

  await row.getByRole("button", { name: "Panggil" }).click();
  await expect(row).toContainText("Dipanggil");
  // The late button waits out the grace period before it can be pressed.
  await expect(row.getByRole("button", { name: /^Telat/ })).toBeDisabled();

  await row.getByRole("button", { name: "Duduk" }).click();
  await expect(column.getByText("Di kursi").locator("..")).toContainText(name);

  await column.getByRole("button", { name: "Selesai" }).click();
  await expect(column.getByText("Kursi kosong")).toBeVisible();
  await expect(column.getByText(name)).toBeHidden();
});

test("a cashier only sees their own branch", async ({ page }) => {
  await signInAsJuandaCashier(page);
  await expect(page.getByRole("navigation", { name: "Pilih cabang" })).toHaveCount(0);
  await page.goto("/kasir?cabang=tepian");
  await expect(page.getByText(/^Juanda/)).toBeVisible();
});
