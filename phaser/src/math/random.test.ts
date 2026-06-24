import { describe, expect, it } from "vitest";
import { createRandom } from "./random";

describe("createRandom", () => {
  it("is deterministic for the same seed", () => {
    const a = createRandom(20260619);
    const b = createRandom(20260619);

    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });
});
