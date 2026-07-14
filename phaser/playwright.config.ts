import { defineConfig, devices } from "@playwright/test";

const port = 5174;
const isLongSoak = process.env.ARENA_LONG_SOAK === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  webServer: {
    command: `VITE_ARENA_FIXED_SEED=1 VITE_ARENA_RUN_ORIGIN=test npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    trace: isLongSoak ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: isLongSoak ? "off" : "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/google-chrome",
    },
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 960, height: 540 },
      },
    },
  ],
});
