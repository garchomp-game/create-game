import { defineConfig, devices } from "@playwright/test";

const port = 4175;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}/`,
    browserName: "chromium",
    locale: "ja-JP",
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: "/usr/bin/google-chrome",
      args: ["--disable-features=Translate,TranslateUI", "--disable-translate"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chrome" }],
});
