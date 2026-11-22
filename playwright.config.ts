import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
    // Lets sandboxes with a preinstalled Chromium skip `playwright install`.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    // The customer web is phone-first, so the phone is the default device.
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /staff\..*/ },
  ],
  webServer: {
    command: `pnpm start -p ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
