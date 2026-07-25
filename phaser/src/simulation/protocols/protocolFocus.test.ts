import { describe, expect, it } from "vitest";
import { getProtocolFocusTriggerStacks } from "./protocolFocus";

describe("getProtocolFocusTriggerStacks", () => {
  it("allows EX focus skills one stack before the normal maximum", () => {
    expect(getProtocolFocusTriggerStacks(4, 1)).toBe(3);
    expect(getProtocolFocusTriggerStacks(3, 1)).toBe(2);
  });

  it("keeps enabled focus triggers positive", () => {
    expect(getProtocolFocusTriggerStacks(1, 1)).toBe(1);
    expect(getProtocolFocusTriggerStacks(0, 1)).toBe(0);
  });
});
