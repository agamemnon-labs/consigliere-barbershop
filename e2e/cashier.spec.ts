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

/** Takes payment for whoever is in the chair: haircut only, EDC QRIS. */
async function payForChair(column: Locator) {
  await column.getByText("Selesai & bayar").click();
  await column.getByText("QRIS", { exact: true }).click();
  await column.getByRole("button", { name: "Lunas", exact: true }).click();
}

/** Seat, finish (and pay) or cancel whoever is there so the column starts empty. */
async function clearColumn(column: Locator) {
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
    if (!clicked) return;
  }
}

test("the cashier adds a walk-in, calls, seats, takes payment and prints a receipt", async ({ page }) => {
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

  // Haircut is already on the bill; add a coloring and type its price.
  await column.getByText("Selesai & bayar").click();
  await column.getByLabel("Tambah layanan").selectOption({ label: "Coloring Fashion" });
  await column.getByRole("textbox", { name: "Harga" }).fill("350000");
  await column.getByText("Kartu", { exact: true }).click();
  await column.getByRole("button", { name: "Lunas", exact: true }).click();

  await expect(column.getByText("Kursi kosong")).toBeVisible();
  await expect(column.getByText(name)).toBeHidden();

  const takings = page.getByRole("region", { name: "Pemasukan hari ini" });
  await expect(takings).toContainText("EDC · kartu");
  await takings.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/kasir\/struk\//);
  const receipt = page.locator("article.receipt");
  await expect(receipt).toContainText("Coloring Fashion");
  await expect(receipt).toContainText("Rp350.000");
  await expect(receipt).toContainText("EDC · kartu");
  await expect(page.getByRole("button", { name: "Cetak" })).toBeVisible();
});

test("a cashier only sees their own branch", async ({ page }) => {
  await signInAsJuandaCashier(page);
  await expect(page.getByRole("navigation", { name: "Pilih cabang" })).toHaveCount(0);
  await page.goto("/kasir?cabang=tepian");
  await expect(page.getByText(/^Juanda/)).toBeVisible();
});
