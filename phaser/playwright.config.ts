import { defineConfig, devices } from "@playwright/test";

const port = 5174;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/google-chrome",
    },
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
  ],
});
