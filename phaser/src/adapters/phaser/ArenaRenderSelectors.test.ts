import { describe, expect, it } from "vitest";
import { selectNearestOffscreen } from "./ArenaRenderSelectors";

describe("selectNearestOffscreen", () => {
  const arena = { width: 960, height: 540 };
  const player = { x: 480, y: 270 };

  it("returns only the nearest offscreen items in stable distance order", () => {
    const items = [
      { id: "onscreen", position: { x: 10, y: 10 } },
      { id: "far", position: { x: 1_400, y: 270 } },
      { id: "near-a", position: { x: 970, y: 270 } },
      { id: "near-b", position: { x: -10, y: 270 } },
      { id: "middle", position: { x: 1_100, y: 270 } },
    ];

    expect(
      selectNearestOffscreen(items, player, arena, 3).map(({ id }) => id),
    ).toEqual(["near-a", "near-b", "middle"]);
  });

  it("returns an empty selection when the limit is disabled", () => {
    expect(
      selectNearestOffscreen(
        [{ id: "outside", position: { x: -1, y: 0 } }],
        player,
        arena,
        0,
      ),
    ).toEqual([]);
  });
});
