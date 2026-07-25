import type { WorldState } from "../domain/types";
import { TEXT } from "../lang";

export type ProgressionHudViewModel = {
  levelLabel: string;
  experienceLabel: string;
  experienceRatio: number;
  upgradeWaitSeconds: number | null;
};

export function createProgressionHudViewModel(
  world: WorldState,
): ProgressionHudViewModel {
  const xpToNext = Math.max(1, world.progression.xpToNext);
  const displayedXp = Math.min(world.progression.xp, xpToNext);
  const buildComplete = world.progression.buildCompletedAt !== null;
  const upgradeWaitSeconds = buildComplete
    ? null
    : Math.max(
        0,
        Math.ceil(
          world.progression.nextUpgradeOfferAt - world.state.elapsed,
        ),
      );

  return {
    levelLabel: buildComplete
      ? TEXT.hud.extraLevelLabel(
          world.progression.extraLevel,
          world.progression.extraCycle,
        )
      : TEXT.hud.levelLabel(world.progression.level),
    experienceLabel:
      upgradeWaitSeconds !== null && upgradeWaitSeconds > 0
        ? TEXT.hud.experienceWaiting(
            displayedXp,
            xpToNext,
            upgradeWaitSeconds,
          )
        : TEXT.hud.experienceValue(displayedXp, xpToNext),
    experienceRatio: Math.min(1, displayedXp / xpToNext),
    upgradeWaitSeconds:
      upgradeWaitSeconds !== null && upgradeWaitSeconds > 0
        ? upgradeWaitSeconds
        : null,
  };
}
