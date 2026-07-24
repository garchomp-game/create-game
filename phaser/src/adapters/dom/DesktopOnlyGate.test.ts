import { describe, expect, it } from "vitest";
import {
  shouldBlockGameDevice,
  type DesktopDeviceSignals,
} from "./DesktopOnlyGate";

const desktopSignals: DesktopDeviceSignals = {
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36",
  mobileHint: false,
  platform: "Linux x86_64",
  maxTouchPoints: 0,
  coarsePrimaryPointer: false,
  primaryPointerCanHover: true,
  finePointerAvailable: true,
};

describe("shouldBlockGameDevice", () => {
  it("blocks smartphones identified by their user agent", () => {
    expect(
      shouldBlockGameDevice({
        ...desktopSignals,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        platform: "iPhone",
        maxTouchPoints: 5,
        coarsePrimaryPointer: true,
        primaryPointerCanHover: false,
        finePointerAvailable: false,
      }),
    ).toBe(true);
  });

  it("blocks tablets and browser-provided mobile hints", () => {
    expect(
      shouldBlockGameDevice({
        ...desktopSignals,
        userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel Tablet)",
        platform: "Linux armv8l",
        maxTouchPoints: 10,
      }),
    ).toBe(true);
    expect(shouldBlockGameDevice({ ...desktopSignals, mobileHint: true })).toBe(true);
  });

  it("blocks iPad desktop mode and otherwise unknown touch-only devices", () => {
    expect(
      shouldBlockGameDevice({
        ...desktopSignals,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      shouldBlockGameDevice({
        ...desktopSignals,
        userAgent: "Unknown browser",
        platform: "Unknown",
        maxTouchPoints: 5,
        coarsePrimaryPointer: true,
        primaryPointerCanHover: false,
        finePointerAvailable: false,
      }),
    ).toBe(true);
  });

  it("allows narrow desktop windows and touch-enabled computers with a fine pointer", () => {
    expect(shouldBlockGameDevice(desktopSignals)).toBe(false);
    expect(
      shouldBlockGameDevice({
        ...desktopSignals,
        maxTouchPoints: 10,
        coarsePrimaryPointer: true,
        finePointerAvailable: true,
      }),
    ).toBe(false);
  });
});
