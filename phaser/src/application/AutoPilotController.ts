import type {
  InputSnapshot,
  SimulationConfig,
  WorldState,
} from "../domain/types";
import {
  createAutoPilotAgent,
  type AutoPilotAgent,
  type AutoPilotMode,
  type AutoPilotOverrideReason,
  type AutoPilotPatrolStrategy,
} from "../simulation/autoPilot";

export type AutoPilotControllerSnapshot = {
  enabled: boolean;
  mode: AutoPilotMode | null;
  intentMode: AutoPilotMode | null;
  overrideReason: AutoPilotOverrideReason | null;
  riskScore: number;
  targetId: string | null;
};

export class AutoPilotController {
  private enabledState = false;
  private decisionState: Omit<AutoPilotControllerSnapshot, "enabled"> =
    createEmptyDecisionState();
  private readonly agent: AutoPilotAgent;

  constructor(
    readonly patrolStrategy: AutoPilotPatrolStrategy,
    agent?: AutoPilotAgent,
  ) {
    this.agent =
      agent ?? createAutoPilotAgent(undefined, { patrolStrategy });
  }

  get enabled(): boolean {
    return this.enabledState;
  }

  start(): void {
    this.enabledState = true;
    this.resetDecision();
  }

  setEnabled(enabled: boolean): boolean {
    if (enabled === this.enabledState) return false;
    this.enabledState = enabled;
    this.resetDecision();
    return true;
  }

  resetForRun(status: WorldState["state"]["status"]): void {
    if (status === "title") this.enabledState = false;
    this.resetDecision();
  }

  resolveInput(
    manualInput: InputSnapshot,
    world: WorldState,
    config: SimulationConfig,
  ): InputSnapshot {
    if (!this.enabledState) return manualInput;

    const decision = this.agent.decide(world, config);
    this.decisionState = {
      mode: decision.mode,
      intentMode: decision.intentMode,
      overrideReason: decision.overrideReason,
      riskScore: decision.riskScore,
      targetId: decision.targetId,
    };
    return {
      ...decision.input,
      startPressed: manualInput.startPressed,
      restartPressed: manualInput.restartPressed,
      pausePressed: manualInput.pausePressed,
      quitToTitlePressed: manualInput.quitToTitlePressed,
      upgradeChoicePressed:
        manualInput.upgradeChoicePressed ??
        decision.input.upgradeChoicePressed,
      contractChoicePressed:
        manualInput.contractChoicePressed ??
        decision.input.contractChoicePressed,
    };
  }

  getSnapshot(): AutoPilotControllerSnapshot {
    return { enabled: this.enabledState, ...this.decisionState };
  }

  private resetDecision(): void {
    this.agent.reset();
    this.decisionState = createEmptyDecisionState();
  }
}

function createEmptyDecisionState(): Omit<
  AutoPilotControllerSnapshot,
  "enabled"
> {
  return {
    mode: null,
    intentMode: null,
    overrideReason: null,
    riskScore: 0,
    targetId: null,
  };
}
