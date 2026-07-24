import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digestStudyDefinition } from "./study-definition-digest.mjs";

const packRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = path.join(packRoot, "scripts", "validate-study-log.mjs");
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "arena-core-study-contract-")
);

const baseManifest = JSON.parse(
  fs.readFileSync(
    path.join(packRoot, "templates", "CANDIDATE_BUILD_MANIFEST.example.json"),
    "utf8"
  )
);

const definitionFiles = {
  o1: "STUDY_DEFINITION.example.json",
  "full-training": "STUDY_DEFINITION_FULL_TRAINING.example.json",
  "context-prompt": "STUDY_DEFINITION_CONTEXT_PROMPT.example.json",
  retention: "STUDY_DEFINITION_RETENTION.example.json"
};

const sessionIds = {
  o1: "11111111-1111-4111-8111-111111111111",
  "full-training": "22222222-2222-4222-8222-222222222222",
  "context-prompt": "33333333-3333-4333-8333-333333333333",
  retention: "44444444-4444-4444-8444-444444444444"
};

function clone(value) {
  return structuredClone(value);
}

function loadDefinition(sessionKind) {
  return JSON.parse(
    fs.readFileSync(
      path.join(packRoot, "templates", definitionFiles[sessionKind]),
      "utf8"
    )
  );
}

function makeManifest(sessionKind, definition) {
  const manifest = clone(baseManifest);
  const identity = {
    o1: ["O1-A", "A"],
    "full-training": ["T1.1", "baseline"],
    "context-prompt": ["C1-R", "candidate"],
    retention: ["T2-S1", "candidate"]
  }[sessionKind];
  manifest.studyId = `arena-contract-${sessionKind}`;
  manifest.hypothesisId = `contract-${sessionKind}`;
  manifest.cellId = identity[0];
  manifest.arm = identity[1];
  manifest.sessionKind = sessionKind;
  manifest.studyDefinitionPath = "study-definition.json";
  manifest.studyDefinitionDigest = digestStudyDefinition(definition);
  manifest.expectedStepIds = clone(definition.expectedStepIds);
  return manifest;
}

function makeEventFactory(sessionKind, definition, manifest) {
  let sequence = 0;
  const baseContext = {
    onboardingVersion: definition.definitionVersion,
    stepId: null,
    attempt: 0,
    hintLevel: 0,
    selectedMode: "endless",
    autoFire: true,
    inputPreset: "keyboard-mouse",
    fullscreen: false,
    viewport: "1280x720",
    uiScale: 100,
    highContrast: false
  };
  return (eventName, activeElapsedMs, payload, context = {}) => {
    sequence += 1;
    const hex = sequence.toString(16).padStart(8, "0");
    return {
      schemaVersion: "onboarding-study-log.v1",
      eventId: `${hex}-0000-4000-8000-${hex.padStart(12, "0")}`,
      sequence,
      sessionId: sessionIds[sessionKind],
      assignmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      occurredAt: "2026-07-24T00:00:00.000Z",
      activeElapsedMs,
      eventName,
      study: {
        studyId: manifest.studyId,
        protocolVersion: manifest.studyLogProtocolVersion,
        hypothesisId: manifest.hypothesisId,
        cellId: manifest.cellId,
        arm: manifest.arm,
        sessionKind,
        definitionDigest: manifest.studyDefinitionDigest
      },
      build: clone(manifest.candidate),
      context: {
        ...baseContext,
        ...context
      },
      payload
    };
  };
}

function makeO1Scenario() {
  const definition = loadDefinition("o1");
  const manifest = makeManifest("o1", definition);
  const event = makeEventFactory("o1", definition, manifest);
  const events = [
    event("onboarding_variant_assigned", 0, {
      allocationMethod: manifest.assignmentRule.method,
      eligibility: "eligible",
      arm: "A"
    }),
    event("onboarding_offer_shown", 0, {
      primaryCtaId: definition.entryPolicy.primaryCtaId,
      skipVisible: definition.entryPolicy.skipVisible,
      selectedMode: "endless"
    }),
    event("onboarding_started", 0, {
      startSource: "primary-cta"
    }),
    event(
      "onboarding_step_started",
      0,
      {
        stepId: "move-to-beacon",
        attempt: 1
      },
      {
        stepId: "move-to-beacon",
        attempt: 1
      }
    ),
    event(
      "first_relevant_input",
      100,
      {
        actionId: "move",
        accepted: true,
        elapsedMs: 100
      },
      {
        stepId: "move-to-beacon",
        attempt: 1
      }
    ),
    event(
      "first_meaningful_progress",
      500,
      {
        criterion: "distance-to-beacon-reduced",
        value: 1
      },
      {
        stepId: "move-to-beacon",
        attempt: 1
      }
    ),
    event(
      "wrong_action",
      1000,
      {
        reason: "wrong-binding",
        count: 2
      },
      {
        stepId: "move-to-beacon",
        attempt: 1
      }
    ),
    event(
      "onboarding_hint_escalated",
      5500,
      {
        fromHint: 0,
        toHint: 1,
        reason: "active-time-stall",
        wrongActionCountAtTransition: 2
      },
      {
        stepId: "move-to-beacon",
        attempt: 1,
        hintLevel: 1
      }
    ),
    event(
      "meaningful_progress",
      6000,
      {
        criterion: "distance-to-beacon-reduced",
        value: 2
      },
      {
        stepId: "move-to-beacon",
        attempt: 1,
        hintLevel: 1
      }
    ),
    event(
      "wrong_action",
      6500,
      {
        reason: "wrong-binding",
        count: 4
      },
      {
        stepId: "move-to-beacon",
        attempt: 1,
        hintLevel: 1
      }
    ),
    event(
      "onboarding_hint_escalated",
      6500,
      {
        fromHint: 1,
        toHint: 2,
        reason: "repeated-wrong-action",
        wrongActionCountAtTransition: 4
      },
      {
        stepId: "move-to-beacon",
        attempt: 1,
        hintLevel: 2
      }
    ),
    event(
      "onboarding_step_succeeded",
      7000,
      {
        evidenceType: "destination-entered",
        sourceEventId: "domain-o1-success-1",
        fixtureEntityId: "o1-beacon-1"
      },
      {
        stepId: "move-to-beacon",
        attempt: 1,
        hintLevel: 2
      }
    ),
    event("onboarding_completed", 7000, {
      totalActiveElapsedMs: 7000,
      maxHint: 2
    }),
    event("study_session_ended", 7000, {
      terminalStatus: "completed"
    })
  ];
  return { definition, manifest, events };
}

function makeFullTrainingScenario() {
  const definition = loadDefinition("full-training");
  const manifest = makeManifest("full-training", definition);
  const event = makeEventFactory("full-training", definition, manifest);
  const events = [
    event("full_training_started", 0, {
      trainingVersion: definition.definitionVersion,
      taskCount: 9
    })
  ];
  definition.steps.forEach((step, index) => {
    const startedAt = index * 1000 + 100;
    const context = {
      stepId: step.stepId,
      attempt: 1
    };
    events.push(
      event(
        "onboarding_step_started",
        startedAt,
        {
          stepId: step.stepId,
          attempt: 1
        },
        context
      )
    );
    events.push(
      event(
        "onboarding_step_succeeded",
        startedAt + 500,
        {
          evidenceType: step.successEvidenceTypes[0],
          sourceEventId: `domain-training-success-${index + 1}`,
          fixtureEntityId: step.fixtureId
        },
        context
      )
    );
  });
  events.push(
    event("full_training_completed", 9000, {
      trainingVersion: definition.definitionVersion,
      taskCount: 9,
      maxHint: 0
    }),
    event("study_session_ended", 9000, {
      terminalStatus: "full-training-complete"
    })
  );
  return { definition, manifest, events };
}

function makeO1BScenario() {
  const scenario = makeO1Scenario();
  scenario.definition.entryPolicy = {
    enabled: true,
    mode: "default-start",
    primaryCtaId: null,
    skipVisible: true,
    allowedStartSources: ["default-start"]
  };
  scenario.manifest.cellId = "O1-B";
  scenario.manifest.arm = "B";
  for (const event of scenario.events) {
    event.study.cellId = "O1-B";
    event.study.arm = "B";
  }
  scenario.events.find(
    (item) => item.eventName === "onboarding_variant_assigned"
  ).payload.arm = "B";
  scenario.events.find(
    (item) => item.eventName === "onboarding_offer_shown"
  ).payload.primaryCtaId = null;
  scenario.events.find(
    (item) => item.eventName === "onboarding_started"
  ).payload.startSource = "default-start";
  synchronizeDefinition(scenario);
  return scenario;
}

function makeO1Threshold3Scenario() {
  const scenario = makeO1Scenario();
  scenario.definition.hintPolicy.repeatedWrongActionThreshold = 3;
  const snapshots = scenario.events.filter(
    (item) => item.eventName === "wrong_action"
  );
  snapshots[0].payload.count = 3;
  snapshots[1].payload.count = 6;
  const hints = scenario.events.filter(
    (item) => item.eventName === "onboarding_hint_escalated"
  );
  hints[0].payload.wrongActionCountAtTransition = 3;
  hints[1].payload.wrongActionCountAtTransition = 6;
  synchronizeDefinition(scenario);
  return scenario;
}

function makeO1SparseWrongSnapshotsScenario() {
  const scenario = makeO1Scenario();
  const firstWrongIndex = scenario.events.findIndex(
    (item) => item.eventName === "wrong_action"
  );
  scenario.events.splice(firstWrongIndex, 1);
  return scenario;
}

function makeO1ApprovedRepairFifthScenario() {
  const scenario = makeO1Scenario();
  const sourceStep = scenario.definition.steps[0];
  for (let index = 2; index <= 5; index += 1) {
    const sceneId = `o1-scene-${index}`;
    const stepId = `o1-step-${index}`;
    scenario.definition.scenes.push({
      sceneId,
      purpose: index === 5 ? "repair" : `candidate-${index}`
    });
    scenario.definition.expectedStepIds.push(stepId);
    scenario.definition.steps.push({
      ...clone(sourceStep),
      stepId,
      sceneId,
      fixtureId: `o1-fixture-${index}`
    });
  }
  scenario.definition.o1ScopePolicy = {
    conditionalRepairFifthEnabled: true,
    approvalDecisionId: "decision-repair-fifth-001",
    maximumStepsPerScene: 2
  };
  const disposition = scenario.events.at(-2);
  disposition.eventName = "onboarding_abandoned";
  disposition.payload = {
    reason: "facilitator-stop"
  };
  scenario.events.at(-1).payload.terminalStatus = "abandoned";
  synchronizeDefinition(scenario);
  return scenario;
}

function makeContextPromptScenario() {
  const definition = loadDefinition("context-prompt");
  const manifest = makeManifest("context-prompt", definition);
  const event = makeEventFactory("context-prompt", definition, manifest);
  const prompt = definition.contextPromptPolicy.prompts[0];
  const events = [
    event("context_prompt_shown", 0, {
      promptId: prompt.promptId,
      triggerId: prompt.triggerIds[0]
    }),
    event("context_prompt_succeeded", 100, {
      promptId: prompt.promptId,
      evidenceType: prompt.successEvidenceTypes[0],
      sourceEventId: "domain-context-success-1"
    }),
    event("study_session_ended", 100, {
      terminalStatus: "context-complete"
    })
  ];
  return { definition, manifest, events };
}

function makeRetentionScenario() {
  const definition = loadDefinition("retention");
  const manifest = makeManifest("retention", definition);
  const event = makeEventFactory("retention", definition, manifest);
  const events = [
    event("retention_probe_started", 0, {
      mode: "endless",
      seedId: "retention-fixture-seed"
    }),
    event("retention_probe_checkpoint", 30000, {
      checkpointSeconds: 30,
      survived: true,
      damageTaken: 0,
      stalled: false
    }),
    event("retention_probe_checkpoint", 60000, {
      checkpointSeconds: 60,
      survived: true,
      damageTaken: 0,
      stalled: false
    }),
    event("retention_probe_checkpoint", 90000, {
      checkpointSeconds: 90,
      survived: true,
      damageTaken: 0,
      stalled: false
    }),
    event("retention_probe_succeeded", 90001, {
      behaviors: [
        "move",
        "avoid-enemy-projectile"
      ]
    }),
    event("study_session_ended", 90001, {
      terminalStatus: "retention-complete"
    })
  ];
  return { definition, manifest, events };
}

function synchronizeDefinition(scenario) {
  scenario.manifest.studyDefinitionDigest = digestStudyDefinition(
    scenario.definition
  );
  scenario.manifest.expectedStepIds = clone(scenario.definition.expectedStepIds);
  for (const event of scenario.events) {
    event.study.definitionDigest = scenario.manifest.studyDefinitionDigest;
  }
}

function runCase(name, scenario, shouldPass) {
  const caseDirectory = path.join(
    temporaryRoot,
    name.replace(/[^A-Za-z0-9._-]+/g, "-")
  );
  fs.mkdirSync(caseDirectory, { recursive: true });
  const definitionPath = path.join(caseDirectory, "study-definition.json");
  const manifestPath = path.join(caseDirectory, "candidate-manifest.json");
  const sessionPath = path.join(caseDirectory, "session.json");
  fs.writeFileSync(definitionPath, `${JSON.stringify(scenario.definition, null, 2)}\n`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(scenario.manifest, null, 2)}\n`);
  fs.writeFileSync(sessionPath, `${JSON.stringify(scenario.events, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [validatorPath, sessionPath, manifestPath],
    {
      encoding: "utf8"
    }
  );
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      `${name}: expected ${shouldPass ? "pass" : "reject"}, got ${
        passed ? "pass" : "reject"
      }\n${detail}`
    );
  }
}

const positiveFactories = [
  ["o1-a-positive", makeO1Scenario],
  ["o1-b-positive", makeO1BScenario],
  ["o1-threshold-3-positive", makeO1Threshold3Scenario],
  ["o1-sparse-wrong-snapshots-positive", makeO1SparseWrongSnapshotsScenario],
  ["o1-approved-repair-fifth-positive", makeO1ApprovedRepairFifthScenario],
  ["full-training-positive", makeFullTrainingScenario],
  ["context-prompt-positive", makeContextPromptScenario],
  ["retention-positive", makeRetentionScenario]
];

const negativeCases = [
  [
    "o1-hint-count-lower-than-snapshot",
    () => {
      const scenario = makeO1Scenario();
      const h1 = scenario.events.find(
        (item) =>
          item.eventName === "onboarding_hint_escalated" &&
          item.payload.toHint === 1
      );
      h1.payload.wrongActionCountAtTransition = 1;
      return scenario;
    }
  ],
  [
    "o1-wrong-action-cannot-trigger-h1",
    () => {
      const scenario = makeO1Scenario();
      const h1 = scenario.events.find(
        (item) =>
          item.eventName === "onboarding_hint_escalated" &&
          item.payload.toHint === 1
      );
      h1.payload.reason = "repeated-wrong-action";
      return scenario;
    }
  ],
  [
    "o1-h1-before-five-seconds",
    () => {
      const scenario = makeO1Scenario();
      const h1 = scenario.events.find(
        (item) =>
          item.eventName === "onboarding_hint_escalated" &&
          item.payload.toHint === 1
      );
      h1.activeElapsedMs = 1000;
      return scenario;
    }
  ],
  [
    "o1-fifth-scene-without-approval",
    () => {
      const scenario = makeO1ApprovedRepairFifthScenario();
      scenario.definition.o1ScopePolicy.conditionalRepairFifthEnabled = false;
      scenario.definition.o1ScopePolicy.approvalDecisionId = null;
      synchronizeDefinition(scenario);
      return scenario;
    }
  ],
  [
    "o1-first-scene-not-move",
    () => {
      const scenario = makeO1Scenario();
      scenario.definition.scenes[0].purpose = "repair";
      synchronizeDefinition(scenario);
      return scenario;
    }
  ],
  [
    "o1-approved-fifth-not-repair",
    () => {
      const scenario = makeO1ApprovedRepairFifthScenario();
      scenario.definition.scenes[4].purpose = "xp";
      synchronizeDefinition(scenario);
      return scenario;
    }
  ],
  [
    "o1-entry-treatment-mismatch",
    () => {
      const scenario = makeO1Scenario();
      scenario.definition.entryPolicy = {
        enabled: true,
        mode: "default-start",
        primaryCtaId: null,
        skipVisible: true,
        allowedStartSources: ["default-start"]
      };
      synchronizeDefinition(scenario);
      return scenario;
    }
  ],
  [
    "o1-threshold-definition-not-met",
    () => {
      const scenario = makeO1Scenario();
      scenario.definition.hintPolicy.repeatedWrongActionThreshold = 3;
      synchronizeDefinition(scenario);
      return scenario;
    }
  ],
  [
    "o1-input-context-drift",
    () => {
      const scenario = makeO1Scenario();
      scenario.events[1].context.inputPreset = "unregistered-preset";
      return scenario;
    }
  ],
  [
    "o1-required-off-violated",
    () => {
      const scenario = makeO1Scenario();
      scenario.definition.inputPolicy.autoFirePolicy = "required-off";
      synchronizeDefinition(scenario);
      return scenario;
    }
  ],
  [
    "o1-input-action-unregistered",
    () => {
      const scenario = makeO1Scenario();
      const input = scenario.events.find(
        (item) => item.eventName === "first_relevant_input"
      );
      input.payload.actionId = "totally-wrong-action";
      return scenario;
    }
  ],
  [
    "o1-input-elapsed-mismatch",
    () => {
      const scenario = makeO1Scenario();
      const input = scenario.events.find(
        (item) => item.eventName === "first_relevant_input"
      );
      input.payload.elapsedMs = 999999;
      return scenario;
    }
  ],
  [
    "o1-progress-criterion-unregistered",
    () => {
      const scenario = makeO1Scenario();
      const progress = scenario.events.find(
        (item) => item.eventName === "meaningful_progress"
      );
      progress.payload.criterion = "unregistered-progress";
      return scenario;
    }
  ],
  [
    "o1-wrong-action-not-increasing",
    () => {
      const scenario = makeO1Scenario();
      const snapshots = scenario.events.filter(
        (item) => item.eventName === "wrong_action"
      );
      snapshots[1].payload.count = 2;
      return scenario;
    }
  ],
  [
    "context-prompt-unregistered",
    () => {
      const scenario = makeContextPromptScenario();
      scenario.events[0].payload.promptId = "unregistered-prompt";
      scenario.events[1].payload.promptId = "unregistered-prompt";
      return scenario;
    }
  ],
  [
    "context-multiple-prompts",
    () => {
      const scenario = makeContextPromptScenario();
      scenario.definition.contextPromptPolicy.prompts.push({
        promptId: "second-prompt",
        triggerIds: ["second-trigger"],
        successEvidenceTypes: ["second-evidence"]
      });
      synchronizeDefinition(scenario);
      return scenario;
    }
  ],
  [
    "context-trigger-unregistered",
    () => {
      const scenario = makeContextPromptScenario();
      scenario.events[0].payload.triggerId = "unregistered-trigger";
      return scenario;
    }
  ],
  [
    "context-evidence-unregistered",
    () => {
      const scenario = makeContextPromptScenario();
      scenario.events[1].payload.evidenceType = "unregistered-evidence";
      return scenario;
    }
  ],
  [
    "retention-mode-mismatch",
    () => {
      const scenario = makeRetentionScenario();
      scenario.events[0].payload.mode = "wrong-mode";
      return scenario;
    }
  ],
  [
    "retention-checkpoint-too-early",
    () => {
      const scenario = makeRetentionScenario();
      scenario.events[1].activeElapsedMs = 1;
      return scenario;
    }
  ],
  [
    "retention-behavior-missing",
    () => {
      const scenario = makeRetentionScenario();
      const success = scenario.events.find(
        (item) => item.eventName === "retention_probe_succeeded"
      );
      success.payload.behaviors = ["move"];
      return scenario;
    }
  ],
  [
    "retention-disabled",
    () => {
      const scenario = makeRetentionScenario();
      scenario.definition.retentionPolicy.enabled = false;
      scenario.definition.retentionPolicy.requiredCheckpointSeconds = [];
      scenario.definition.retentionPolicy.requiredBehaviors = [];
      synchronizeDefinition(scenario);
      return scenario;
    }
  ]
];

try {
  for (const [name, factory] of positiveFactories) {
    runCase(name, factory(), true);
  }
  for (const [name, factory] of negativeCases) {
    runCase(name, factory(), false);
  }
  console.log(
    `Study contract self-test passed: 4 session kinds, both O1 arms, and ${negativeCases.length} negative mutations.`
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
