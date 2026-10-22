import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
// Locally a preinstalled Chromium can be used: PW_CHROMIUM_PATH=/path/to/chrome pnpm e2e
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "es-PY",
    timezoneId: "America/Asuncion",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 360, height: 780 },
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  // The app is built in mock mode: MSW in a service worker plays the API.
  webServer: {
    command: `pnpm build:mock && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
