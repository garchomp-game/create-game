import type { InputSnapshot, WorldState } from "../../domain/types";
import { normalize } from "../../math/vector";

export function updateAim(world: WorldState, input: InputSnapshot): void {
  if (!input.aimWorld) return;

  const dx = input.aimWorld.x - world.player.position.x;
  const dy = input.aimWorld.y - world.player.position.y;
  const aim = normalize(dx, dy);
  if (aim.x !== 0 || aim.y !== 0) {
    world.state.lastAim = aim;
  }
}
