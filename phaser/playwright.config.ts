import { defineConfig, devices } from "@playwright/test";

const port = 5174;
const isLongSoak = process.env.ARENA_LONG_SOAK === "1";
const isHardwareSoak = isLongSoak && process.env.ARENA_HARDWARE_SOAK === "1";
const useHeadedFirefox = process.env.ARENA_FIREFOX_HEADED === "1";
const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  // Keep public-input WebGL scenarios from losing Phaser frames under CPU contention.
  workers: 2,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  webServer: {
    command: isHardwareSoak
      ? `npm run preview:e2e -- --port ${port}`
      : `VITE_ARENA_FIXED_SEED=1 VITE_ARENA_RUN_ORIGIN=test VITE_PHASER_PRESERVE_DRAWING_BUFFER=1 npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    headless: !isHardwareSoak,
    trace: isLongSoak ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: isLongSoak ? "off" : "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        locale: "ja-JP",
        viewport: { width: 960, height: 540 },
        launchOptions: {
          ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
          args: ["--disable-features=Translate,TranslateUI", "--disable-translate"],
        },
      },
    },
    {
      name: "chrome-portrait-release",
      testMatch: /release-smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        locale: "ja-JP",
        viewport: { width: 390, height: 844 },
        launchOptions: {
          ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
          args: ["--disable-features=Translate,TranslateUI", "--disable-translate"],
        },
      },
    },
    {
      name: "firefox-release",
      testMatch: /release-smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        browserName: "firefox",
        headless: useHeadedFirefox ? false : !isHardwareSoak,
        locale: "ja-JP",
        viewport: { width: 960, height: 540 },
      },
    },
  ],
});
