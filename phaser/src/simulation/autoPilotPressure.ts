import type {
  AutoPilotFrame,
  AutoPilotNavigationPort,
  AutoPilotPosture,
} from "./autoPilotContracts";
import { ROT_AUTO_PILOT_NAVIGATION } from "./autoPilotNavigation";
import { assessAutoPilotThreat } from "./autoPilotThreat";

export type AutoPilotPressure = {
  posture: AutoPilotPosture;
  hpRatio: number;
  approachingProjectiles: number;
  immediateEnemies: number;
  nearbyEnemies: number;
  riskScore: number;
  minimumTtc: number | null;
};

export function assessAutoPilotPressure(
  frame: AutoPilotFrame,
  navigation: AutoPilotNavigationPort = ROT_AUTO_PILOT_NAVIGATION,
): AutoPilotPressure {
  const { world, config } = frame;
  const maximumHp = config.player.maxHp + world.runtime.maxHpBonus;
  const hpRatio = maximumHp > 0 ? world.state.hp / maximumHp : 1;
  const playerSpeed = config.player.speed * world.runtime.playerSpeedMultiplier;
  const threat = assessAutoPilotThreat(
    frame,
    navigation,
    {
      x: frame.previousMove.x * playerSpeed,
      y: frame.previousMove.y * playerSpeed,
    },
  );
  const approachingProjectiles = threat.projectiles.dangerousProjectiles;
  const immediateEnemies = threat.enemies.immediateEnemies;
  const nearbyEnemies = threat.enemies.nearbyEnemies;

  const posture: AutoPilotPosture =
    hpRatio < 0.48 || threat.riskScore >= 0.55
      ? "defensive"
      : hpRatio >= 0.72 &&
          threat.riskScore <= 0.12 &&
          nearbyEnemies <= 3
        ? "opportunistic"
        : "balanced";

  return {
    posture,
    hpRatio,
    approachingProjectiles,
    immediateEnemies,
    nearbyEnemies,
    riskScore: threat.riskScore,
    minimumTtc: Number.isFinite(threat.minimumTtc) ? threat.minimumTtc : null,
  };
}
