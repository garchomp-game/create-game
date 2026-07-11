import { describe, expect, it } from "vitest";
import { resolveRunOrigin, resolveSeedCategory } from "./runEnvironment";

describe("run environment", () => {
  it("always marks browser automation as test and otherwise accepts explicit debug origins", () => {
    expect(resolveRunOrigin("", false)).toBe("manual");
    expect(resolveRunOrigin("?runOrigin=debug", false)).toBe("debug");
    expect(resolveRunOrigin("?runOrigin=test", false)).toBe("test");
    expect(resolveRunOrigin("", true)).toBe("test");
    expect(resolveRunOrigin("?runOrigin=debug", true)).toBe("test");
    expect(resolveRunOrigin("?runOrigin=manual", true)).toBe("test");
  });

  it("separates random and fixed seed rankings", () => {
    expect(resolveSeedCategory(null)).toBe("random");
    expect(resolveSeedCategory(0)).toBe("fixed");
    expect(resolveSeedCategory(42)).toBe("fixed");
  });
});
