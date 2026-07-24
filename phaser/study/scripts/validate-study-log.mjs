import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { digestStudyDefinition } from "./study-definition-digest.mjs";

const inputPath = process.argv[2];
const manifestPath = process.argv[3];
if (!inputPath || !manifestPath) {
  console.error(
    "Usage: node scripts/validate-study-log.mjs <session.json|session.jsonl> <candidate-manifest.json>"
  );
  process.exit(2);
}

const errors = [];
const fail = (message) => errors.push(message);

function readEvents(filePath) {
  const source = fs.readFileSync(filePath, "utf8").trim();
  if (!source) throw new Error("input is empty");
  if (source.startsWith("[")) {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) throw new Error("JSON input must be an event array");
    return parsed;
  }
  return source
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

let events;
let candidateManifest;
let studyDefinition;
try {
  events = readEvents(inputPath);
  candidateManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const manifestDirectory = path.dirname(path.resolve(manifestPath));
  const definitionPath = path.resolve(
    manifestDirectory,
    candidateManifest.studyDefinitionPath
  );
  const relativeDefinitionPath = path.relative(manifestDirectory, definitionPath);
  if (
    relativeDefinitionPath.startsWith("..") ||
    path.isAbsolute(relativeDefinitionPath)
  ) {
    throw new Error("studyDefinitionPath escapes the candidate manifest directory");
  }
  studyDefinition = JSON.parse(fs.readFileSync(definitionPath, "utf8"));
} catch (error) {
  console.error(`StudyLog validation failed: ${error.message}`);
  process.exit(1);
}

if (events.length === 0) fail("session must contain at least one event");
if (events.length > 256) fail("session must contain at most 256 bounded events");

const requiredEnvelope = [
  "schemaVersion",
  "eventId",
  "sequence",
  "sessionId",
  "assignmentId",
  "occurredAt",
  "activeElapsedMs",
  "eventName",
  "study",
  "build",
  "context",
  "payload"
];

const payloadContract = new Map([
  ["onboarding_variant_assigned", ["allocationMethod", "eligibility", "arm"]],
  ["onboarding_offer_shown", ["primaryCtaId", "skipVisible", "selectedMode"]],
  ["onboarding_started", ["startSource"]],
  ["onboarding_skipped", ["phase", "destination"]],
  ["onboarding_step_started", ["stepId", "attempt"]],
  ["first_relevant_input", ["actionId", "accepted", "elapsedMs"]],
  ["first_meaningful_progress", ["criterion", "value"]],
  ["meaningful_progress", ["criterion", "value"]],
  ["wrong_action", ["reason", "count"]],
  [
    "onboarding_hint_escalated",
    ["fromHint", "toHint", "reason", "wrongActionCountAtTransition"]
  ],
  ["onboarding_step_succeeded", ["evidenceType", "sourceEventId", "fixtureEntityId"]],
  ["onboarding_abandoned", ["reason"]],
  ["onboarding_completed", ["totalActiveElapsedMs", "maxHint"]],
  ["context_prompt_shown", ["promptId", "triggerId"]],
  ["context_prompt_succeeded", ["promptId", "evidenceType", "sourceEventId"]],
  ["full_training_started", ["trainingVersion", "taskCount"]],
  ["full_training_completed", ["trainingVersion", "taskCount", "maxHint"]],
  ["retention_probe_started", ["mode", "seedId"]],
  ["retention_probe_checkpoint", ["checkpointSeconds", "survived", "damageTaken", "stalled"]],
  ["retention_probe_succeeded", ["behaviors"]],
  ["study_session_ended", ["terminalStatus"]]
]);

const allowedPayload = new Map([
  ...[...payloadContract.entries()].map(([eventName, required]) => [eventName, new Set(required)])
]);
allowedPayload.get("first_meaningful_progress").add("value");

const learningStepEvents = [
  "onboarding_step_started",
  "first_relevant_input",
  "first_meaningful_progress",
  "meaningful_progress",
  "wrong_action",
  "onboarding_hint_escalated",
  "onboarding_step_succeeded"
];
const allowedEventsByKind = {
  o1: new Set([
    "onboarding_variant_assigned",
    "onboarding_offer_shown",
    "onboarding_started",
    "onboarding_skipped",
    ...learningStepEvents,
    "onboarding_abandoned",
    "onboarding_completed",
    "context_prompt_shown",
    "context_prompt_succeeded",
    "retention_probe_started",
    "retention_probe_checkpoint",
    "retention_probe_succeeded",
    "study_session_ended"
  ]),
  "full-training": new Set([
    ...learningStepEvents,
    "full_training_started",
    "full_training_completed",
    "retention_probe_started",
    "retention_probe_checkpoint",
    "retention_probe_succeeded",
    "study_session_ended"
  ]),
  "context-prompt": new Set([
    "context_prompt_shown",
    "context_prompt_succeeded",
    "study_session_ended"
  ]),
  retention: new Set([
    "retention_probe_started",
    "retention_probe_checkpoint",
    "retention_probe_succeeded",
    "study_session_ended"
  ])
};

const forbiddenKeys = /^(email|e-mail|free[-_]?text|name|full[-_]?name|user[-_]?id|all[-_]?keys|key[-_]?log|raw[-_]?input|coordinates?|positions?|trajectory|pointer[-_]?path|movement[-_]?path)$/i;
const obviousEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function inspectPrivacy(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPrivacy(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.test(key)) fail(`${location}.${key}: forbidden privacy field`);
      inspectPrivacy(child, `${location}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && obviousEmail.test(value)) {
    fail(`${location}: value resembles an email address`);
  }
}

const first = events[0] ?? {};
const sessionId = first.sessionId;
const assignmentId = first.assignmentId;
const arm = first.study?.arm;
const studyId = first.study?.studyId;
const protocolVersion = first.study?.protocolVersion;
const hypothesisId = first.study?.hypothesisId;
const cellId = first.study?.cellId;
const sessionKind = first.study?.sessionKind;
const definitionDigest = first.study?.definitionDigest;
const headSha = first.build?.headSha;
const buildMarker = first.build?.buildMarker;
const artifactDigest = first.build?.artifactDigest;
const appVersion = first.build?.appVersion;
const rulesetVersion = first.build?.rulesetVersion;
const onboardingVersion = first.context?.onboardingVersion;
const selectedMode = first.context?.selectedMode;
const stableContextFields = [
  "selectedMode",
  "autoFire",
  "inputPreset",
  "fullscreen",
  "viewport",
  "uiScale",
  "highContrast"
];
const stableContext = Object.fromEntries(
  stableContextFields.map((field) => [field, first.context?.[field]])
);
const eventIds = new Set();
const stepStarts = new Set();
const stepSuccesses = new Set();
const consumedSourceEventIds = new Set();
const stepState = new Map();
const lastAttemptByStep = new Map();
const succeededStepIds = new Set();
const firstInputByAttempt = new Set();
const firstProgressByAttempt = new Set();
const wrongActionSnapshotByBucket = new Map();
const wrongActionEventCountByAttempt = new Map();
const wrongActionCountByAttempt = new Map();
const wrongActionBaselineAtH1ByAttempt = new Map();
const wrongActionCountAtLastHintByAttempt = new Map();
const contextPromptsShown = new Set();
const contextPromptsSucceeded = new Set();
const eventIndexes = new Map();
const retentionCheckpoints = [];
let retentionStartEvent = null;
const expectedStepIds = Array.isArray(candidateManifest?.expectedStepIds)
  ? candidateManifest.expectedStepIds
  : [];
const expectedStepSet = new Set(expectedStepIds);
const stepDefinitionById = new Map(
  (studyDefinition?.steps ?? []).map((step) => [step.stepId, step])
);
const sceneDefinitions = studyDefinition?.scenes ?? [];
const sceneDefinitionById = new Map(
  sceneDefinitions.map((scene) => [scene.sceneId, scene])
);
const contextPromptDefinitions = studyDefinition?.contextPromptPolicy?.prompts ?? [];
const contextPromptDefinitionById = new Map(
  contextPromptDefinitions.map((prompt) => [prompt.promptId, prompt])
);
const entryPolicy = studyDefinition?.entryPolicy;
const inputPolicy = studyDefinition?.inputPolicy;
const retentionPolicy = studyDefinition?.retentionPolicy;
let nextExpectedStepIndex = 0;
let activeStepId = null;
let priorSequence = -1;
let priorActiveElapsed = -1;
let assignmentIndex = -1;
let offerIndex = -1;
let endedIndex = -1;
let maximumHint = 0;

if (!Object.hasOwn(allowedEventsByKind, sessionKind)) {
  fail(`unsupported or missing sessionKind ${String(sessionKind)}`);
}
if (cellId === "O1-A" && arm !== "A") fail("O1-A session must use arm A");
if (cellId === "O1-B" && arm !== "B") fail("O1-B session must use arm B");

const manifestStudy = {
  studyId: candidateManifest?.studyId,
  protocolVersion: candidateManifest?.studyLogProtocolVersion,
  hypothesisId: candidateManifest?.hypothesisId,
  cellId: candidateManifest?.cellId,
  arm: candidateManifest?.arm,
  sessionKind: candidateManifest?.sessionKind,
  definitionDigest: candidateManifest?.studyDefinitionDigest
};
for (const [key, expected] of Object.entries(manifestStudy)) {
  if (first.study?.[key] !== expected) fail(`session study.${key} differs from candidate manifest`);
}
for (const key of [
  "headSha",
  "buildMarker",
  "artifactDigest",
  "appVersion",
  "rulesetVersion"
]) {
  if (first.build?.[key] !== candidateManifest?.candidate?.[key]) {
    fail(`session build.${key} differs from candidate manifest`);
  }
}
if (new Set(expectedStepIds).size !== expectedStepIds.length) {
  fail("candidate manifest expectedStepIds must be unique");
}
const computedDefinitionDigest = digestStudyDefinition(studyDefinition);
if (computedDefinitionDigest !== candidateManifest?.studyDefinitionDigest) {
  fail("candidate manifest studyDefinitionDigest does not match canonical definition bytes");
}
if (studyDefinition?.sessionKind !== candidateManifest?.sessionKind) {
  fail("study definition sessionKind differs from candidate manifest");
}
if (
  JSON.stringify(studyDefinition?.expectedStepIds) !==
  JSON.stringify(expectedStepIds)
) {
  fail("study definition expectedStepIds differ from candidate manifest");
}
if (
  JSON.stringify(studyDefinition?.steps?.map((step) => step.stepId)) !==
  JSON.stringify(expectedStepIds)
) {
  fail("study definition step order differs from expectedStepIds");
}
if (onboardingVersion !== studyDefinition?.definitionVersion) {
  fail("context onboardingVersion differs from study definitionVersion");
}
if (["o1", "full-training"].includes(sessionKind) && expectedStepIds.length === 0) {
  fail(`${sessionKind} session requires preregistered expectedStepIds`);
}
if (sessionKind === "full-training" && expectedStepIds.length !== 9) {
  fail("full-training session requires exactly nine preregistered step IDs");
}
if (["context-prompt", "retention"].includes(sessionKind) && expectedStepIds.length !== 0) {
  fail(`${sessionKind} session must not preregister learning step IDs`);
}
if (contextPromptDefinitionById.size !== contextPromptDefinitions.length) {
  fail("study definition context prompt IDs must be unique");
}
if (sceneDefinitionById.size !== sceneDefinitions.length) {
  fail("study definition scene IDs must be unique");
}
const derivedSceneIds = [];
const seenDerivedSceneIds = new Set();
const stepCountByScene = new Map();
for (const step of studyDefinition?.steps ?? []) {
  if (!sceneDefinitionById.has(step.sceneId)) {
    fail(`step ${step.stepId} references an unregistered scene ${step.sceneId}`);
  }
  const previousSceneId = derivedSceneIds.at(-1);
  if (step.sceneId !== previousSceneId) {
    if (seenDerivedSceneIds.has(step.sceneId)) {
      fail(`scene ${step.sceneId} recurs non-contiguously in step order`);
    }
    derivedSceneIds.push(step.sceneId);
    seenDerivedSceneIds.add(step.sceneId);
  }
  stepCountByScene.set(
    step.sceneId,
    (stepCountByScene.get(step.sceneId) ?? 0) + 1
  );
}
if (
  JSON.stringify(derivedSceneIds) !==
  JSON.stringify(sceneDefinitions.map((scene) => scene.sceneId))
) {
  fail("study definition scene order differs from the step-derived scene order");
}
if (sessionKind === "context-prompt" && studyDefinition?.contextPromptPolicy?.enabled !== true) {
  fail("context-prompt session requires an enabled contextPromptPolicy");
}
if (sessionKind === "context-prompt" && contextPromptDefinitions.length !== 1) {
  fail("context-prompt session requires exactly one preregistered prompt");
}
if (sessionKind === "retention" && retentionPolicy?.enabled !== true) {
  fail("retention session requires an enabled retentionPolicy");
}
if (sessionKind === "o1") {
  if (entryPolicy?.enabled !== true) fail("o1 session requires an enabled entryPolicy");
  if (entryPolicy?.skipVisible !== true) {
    fail("o1 entryPolicy must keep skip visible");
  }
  if (typeof selectedMode !== "string" || selectedMode.length === 0) {
    fail("o1 session requires a selected mode");
  }
  if (cellId === "O1-A" && entryPolicy?.mode !== "recommended-offer") {
    fail("O1-A requires entryPolicy.mode recommended-offer");
  }
  if (cellId === "O1-B" && entryPolicy?.mode !== "default-start") {
    fail("O1-B requires entryPolicy.mode default-start");
  }
  if (sceneDefinitions.length < 1 || sceneDefinitions.length > 5) {
    fail("o1 session requires one through five preregistered scenes");
  }
  if (sceneDefinitions[0]?.purpose !== "move") {
    fail("the first o1 scene must have purpose move");
  }
  const repairSceneIndexes = sceneDefinitions
    .map((scene, index) => (scene.purpose === "repair" ? index : -1))
    .filter((index) => index !== -1);
  if (
    repairSceneIndexes.length > 0 &&
    !(
      sceneDefinitions.length === 5 &&
      repairSceneIndexes.length === 1 &&
      repairSceneIndexes[0] === 4
    )
  ) {
    fail("REPAIR may appear only as the approved fifth o1 scene");
  }
  const o1ScopePolicy = studyDefinition?.o1ScopePolicy;
  const maximumStepsPerScene = o1ScopePolicy?.maximumStepsPerScene;
  if (maximumStepsPerScene !== 2) {
    fail("o1 maximumStepsPerScene must remain fixed at two");
  }
  for (const [sceneId, stepCount] of stepCountByScene.entries()) {
    if (stepCount > (maximumStepsPerScene ?? 0)) {
      fail(`o1 scene ${sceneId} exceeds maximumStepsPerScene`);
    }
  }
  if (sceneDefinitions.length <= 4 && o1ScopePolicy?.conditionalRepairFifthEnabled !== false) {
    fail("one-through-four-scene o1 candidates must disable the conditional fifth scene");
  }
  if (sceneDefinitions.length === 5) {
    if (o1ScopePolicy?.conditionalRepairFifthEnabled !== true) {
      fail("a fifth o1 scene requires the conditional REPAIR gate");
    }
    if (
      typeof o1ScopePolicy?.approvalDecisionId !== "string" ||
      o1ScopePolicy.approvalDecisionId.length === 0
    ) {
      fail("a fifth o1 scene requires an approval decision ID");
    }
    if (sceneDefinitions[4]?.purpose !== "repair") {
      fail("the conditional fifth o1 scene must have purpose repair");
    }
  }
  if (
    entryPolicy?.mode === "recommended-offer" &&
    (
      typeof entryPolicy.primaryCtaId !== "string" ||
      JSON.stringify(entryPolicy.allowedStartSources) !==
        JSON.stringify(["primary-cta"])
    )
  ) {
    fail("recommended-offer requires a primary CTA and only primary-cta start");
  }
  if (
    entryPolicy?.mode === "default-start" &&
    (
      entryPolicy.primaryCtaId !== null ||
      JSON.stringify(entryPolicy.allowedStartSources) !==
        JSON.stringify(["default-start"])
    )
  ) {
    fail("default-start requires no primary CTA and only default-start");
  }
} else if (entryPolicy?.enabled !== false) {
  fail(`${sessionKind} session must disable entryPolicy`);
}
if (
  sessionKind !== "o1" &&
  studyDefinition?.o1ScopePolicy?.conditionalRepairFifthEnabled !== false
) {
  fail(`${sessionKind} session must disable the conditional o1 fifth scene`);
}
if (sessionKind === "full-training" && sceneDefinitions.length !== 9) {
  fail("full-training session requires exactly nine preregistered scenes");
}
if (!inputPolicy?.allowedInputPresets?.includes(first.context?.inputPreset)) {
  fail("context inputPreset is not allowed by the frozen inputPolicy");
}
if (inputPolicy?.bindingSource !== "runtime-binding-snapshot") {
  fail("inputPolicy bindingSource must be runtime-binding-snapshot");
}
if (!["supported", "required-off"].includes(inputPolicy?.autoFirePolicy)) {
  fail("inputPolicy has an unsupported autoFirePolicy");
}
if (studyDefinition?.hintPolicy?.h1ActiveNoProgressMs !== 5000) {
  fail("H1 active no-progress window must remain fixed at 5000ms");
}
const repeatedWrongActionThreshold =
  studyDefinition?.hintPolicy?.repeatedWrongActionThreshold;
if (
  !Number.isInteger(repeatedWrongActionThreshold) ||
  repeatedWrongActionThreshold < 2 ||
  repeatedWrongActionThreshold > 10
) {
  fail("repeatedWrongActionThreshold must be an integer from 2 through 10");
}
if (inputPolicy?.autoFirePolicy === "required-off" && first.context?.autoFire !== false) {
  fail("autoFire must be false when inputPolicy requires it off");
}
const requiredRetentionCheckpoints =
  retentionPolicy?.requiredCheckpointSeconds ?? [];
for (let index = 1; index < requiredRetentionCheckpoints.length; index += 1) {
  if (requiredRetentionCheckpoints[index] <= requiredRetentionCheckpoints[index - 1]) {
    fail("retentionPolicy checkpoints must be unique and strictly increasing");
  }
}

for (const [index, event] of events.entries()) {
  const label = `event[${index}]`;
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail(`${label}: event must be an object`);
    continue;
  }
  for (const key of requiredEnvelope) {
    if (!Object.hasOwn(event, key)) fail(`${label}: missing ${key}`);
  }
  if (event.schemaVersion !== "onboarding-study-log.v1") {
    fail(`${label}: unsupported schemaVersion`);
  }
  if (!Number.isInteger(event.sequence) || event.sequence <= priorSequence) {
    fail(`${label}: sequence must be a strictly increasing integer`);
  }
  priorSequence = event.sequence;
  if (!Number.isInteger(event.activeElapsedMs) || event.activeElapsedMs < priorActiveElapsed) {
    fail(`${label}: activeElapsedMs must be a nondecreasing integer`);
  }
  priorActiveElapsed = event.activeElapsedMs;
  if (eventIds.has(event.eventId)) fail(`${label}: duplicate eventId ${event.eventId}`);
  eventIds.add(event.eventId);

  if (event.sessionId !== sessionId) fail(`${label}: sessionId changed within session`);
  if (event.assignmentId !== assignmentId) fail(`${label}: assignmentId changed within session`);
  if (event.study?.studyId !== studyId) fail(`${label}: studyId changed within session`);
  if (event.study?.protocolVersion !== protocolVersion) {
    fail(`${label}: protocolVersion changed within session`);
  }
  if (event.study?.hypothesisId !== hypothesisId) {
    fail(`${label}: hypothesisId changed within session`);
  }
  if (event.study?.cellId !== cellId) fail(`${label}: cellId changed within session`);
  if (event.study?.arm !== arm) fail(`${label}: arm changed within session`);
  if (event.study?.sessionKind !== sessionKind) fail(`${label}: sessionKind changed within session`);
  if (event.study?.definitionDigest !== definitionDigest) {
    fail(`${label}: definitionDigest changed within session`);
  }
  if (event.context?.onboardingVersion !== onboardingVersion) {
    fail(`${label}: onboardingVersion changed within session`);
  }
  for (const field of stableContextFields) {
    if (event.context?.[field] !== stableContext[field]) {
      fail(`${label}: context.${field} changed within session`);
    }
  }
  if (
    event.build?.headSha !== headSha ||
    event.build?.buildMarker !== buildMarker ||
    event.build?.artifactDigest !== artifactDigest ||
    event.build?.appVersion !== appVersion ||
    event.build?.rulesetVersion !== rulesetVersion
  ) {
    fail(`${label}: frozen build identity changed within session`);
  }

  if (!payloadContract.has(event.eventName)) {
    fail(`${label}: unknown eventName ${String(event.eventName)}`);
  } else {
    if (allowedEventsByKind[sessionKind] && !allowedEventsByKind[sessionKind].has(event.eventName)) {
      fail(`${label}: ${event.eventName} is not allowed in ${sessionKind} session`);
    }
    if (!eventIndexes.has(event.eventName)) eventIndexes.set(event.eventName, []);
    eventIndexes.get(event.eventName).push(index);
    if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
      fail(`${label}: payload must be an object`);
    } else {
      for (const key of payloadContract.get(event.eventName)) {
        if (!Object.hasOwn(event.payload, key)) {
          fail(`${label}: ${event.eventName} payload missing ${key}`);
        }
      }
      for (const key of Object.keys(event.payload)) {
        if (!allowedPayload.get(event.eventName).has(key)) {
          fail(`${label}: ${event.eventName} payload has undeclared field ${key}`);
        }
      }
    }
  }

  inspectPrivacy(event, label);
  if ((event.context?.hintLevel ?? 0) > 2) fail(`${label}: hintLevel exceeds H2`);
  if (
    !learningStepEvents.includes(event.eventName) &&
    (
      event.context?.stepId !== null ||
      event.context?.attempt !== 0 ||
      event.context?.hintLevel !== 0
    )
  ) {
    fail(`${label}: non-learning event must use null step, attempt 0, and H0`);
  }

  if (event.eventName === "onboarding_variant_assigned") {
    if (assignmentIndex !== -1) fail(`${label}: assignment must occur exactly once`);
    assignmentIndex = index;
    if (event.payload?.arm !== arm) fail(`${label}: payload arm differs from study arm`);
    if (event.payload?.allocationMethod !== candidateManifest?.assignmentRule?.method) {
      fail(`${label}: allocationMethod differs from candidate assignment rule`);
    }
  }
  if (event.eventName === "onboarding_offer_shown") {
    if (offerIndex !== -1) fail(`${label}: offer must occur exactly once`);
    offerIndex = index;
    if (event.payload?.selectedMode !== event.context?.selectedMode) {
      fail(`${label}: offered selectedMode differs from preserved context mode`);
    }
    if (event.payload?.primaryCtaId !== entryPolicy?.primaryCtaId) {
      fail(`${label}: primaryCtaId differs from frozen entryPolicy`);
    }
    if (event.payload?.skipVisible !== entryPolicy?.skipVisible) {
      fail(`${label}: skipVisible differs from frozen entryPolicy`);
    }
  }
  if (event.eventName === "onboarding_started") {
    if (!entryPolicy?.allowedStartSources?.includes(event.payload?.startSource)) {
      fail(`${label}: startSource is not allowed by the frozen entryPolicy`);
    }
  }
  if (event.eventName === "onboarding_step_started") {
    const key = `${event.payload?.stepId}:${event.payload?.attempt}`;
    const stepId = event.payload?.stepId;
    const attempt = event.payload?.attempt;
    if (stepStarts.has(key)) fail(`${label}: duplicate step start ${key}`);
    const previousAttempt = lastAttemptByStep.get(stepId) ?? 0;
    if (!expectedStepSet.has(stepId)) {
      fail(`${label}: unregistered stepId ${stepId}`);
    }
    if (previousAttempt === 0) {
      if (activeStepId !== null) {
        fail(`${label}: cannot start ${stepId} before active step ${activeStepId} succeeds`);
      }
      const expectedStepId = expectedStepIds[nextExpectedStepIndex];
      if (stepId !== expectedStepId) {
        fail(`${label}: expected first attempt of ${expectedStepId}, got ${stepId}`);
      } else {
        nextExpectedStepIndex += 1;
      }
      activeStepId = stepId;
    } else if (activeStepId !== stepId) {
      fail(`${label}: retry must target the active step ${activeStepId}`);
    }
    if (attempt !== previousAttempt + 1) {
      fail(`${label}: attempt for ${stepId} must advance from ${previousAttempt} to ${previousAttempt + 1}`);
    }
    if (succeededStepIds.has(stepId)) {
      fail(`${label}: a new attempt cannot start after ${stepId} succeeded`);
    }
    lastAttemptByStep.set(stepId, attempt);
    stepStarts.add(key);
    stepState.set(key, {
      startedAtMs: event.activeElapsedMs,
      currentHint: 0,
      lastProgressMs: event.activeElapsedMs,
      lastHintMs: event.activeElapsedMs,
      succeeded: false
    });
    if (event.context?.stepId !== event.payload?.stepId || event.context?.attempt !== event.payload?.attempt) {
      fail(`${label}: step payload and context differ`);
    }
    if (event.context?.hintLevel !== 0) fail(`${label}: a new step attempt must start at H0`);
  }
  if (
    learningStepEvents.includes(event.eventName) &&
    event.eventName !== "onboarding_step_started"
  ) {
    const key = `${event.context?.stepId}:${event.context?.attempt}`;
    const state = stepState.get(key);
    if (!state) {
      fail(`${label}: ${event.eventName} has no matching prior step start ${key}`);
    } else if (event.context?.stepId !== activeStepId) {
      fail(`${label}: ${event.eventName} does not target active step ${activeStepId}`);
    } else if (event.context?.attempt !== lastAttemptByStep.get(event.context?.stepId)) {
      fail(`${label}: ${event.eventName} targets a stale attempt ${key}`);
    } else if (state.succeeded) {
      fail(`${label}: ${event.eventName} occurs after success for ${key}`);
    } else if (
      event.eventName !== "onboarding_hint_escalated" &&
      event.context?.hintLevel !== state.currentHint
    ) {
      fail(`${label}: context hintLevel differs from current hint for ${key}`);
    }
  }
  if (event.eventName === "first_meaningful_progress") {
    const key = `${event.context?.stepId}:${event.context?.attempt}`;
    const state = stepState.get(key);
    const stepDefinition = stepDefinitionById.get(event.context?.stepId);
    if (firstProgressByAttempt.has(key)) {
      fail(`${label}: first_meaningful_progress may occur only once for ${key}`);
    }
    if (
      !stepDefinition?.meaningfulProgressCriteria?.includes(event.payload?.criterion)
    ) {
      fail(`${label}: criterion is not registered for ${event.context?.stepId}`);
    }
    firstProgressByAttempt.add(key);
    if (state) {
      state.progressEventCount = 1;
      state.lastProgressMs = event.activeElapsedMs;
    }
  }
  if (event.eventName === "meaningful_progress") {
    const key = `${event.context?.stepId}:${event.context?.attempt}`;
    const state = stepState.get(key);
    const stepDefinition = stepDefinitionById.get(event.context?.stepId);
    if (!firstProgressByAttempt.has(key)) {
      fail(`${label}: meaningful_progress requires a prior first_meaningful_progress for ${key}`);
    }
    if (
      !stepDefinition?.meaningfulProgressCriteria?.includes(event.payload?.criterion)
    ) {
      fail(`${label}: criterion is not registered for ${event.context?.stepId}`);
    }
    const progressCount = (state?.progressEventCount ?? 0) + 1;
    if (progressCount > 16) {
      fail(`${label}: meaningful progress events exceed the bounded limit for ${key}`);
    }
    if (state) {
      state.progressEventCount = progressCount;
      state.lastProgressMs = event.activeElapsedMs;
    }
  }
  if (event.eventName === "first_relevant_input") {
    const key = `${event.context?.stepId}:${event.context?.attempt}`;
    const state = stepState.get(key);
    const stepDefinition = stepDefinitionById.get(event.context?.stepId);
    if (firstInputByAttempt.has(key)) {
      fail(`${label}: first_relevant_input may occur only once for ${key}`);
    }
    if (!stepDefinition?.relevantActionIds?.includes(event.payload?.actionId)) {
      fail(`${label}: actionId is not registered for ${event.context?.stepId}`);
    }
    if (
      state &&
      event.payload?.elapsedMs !== event.activeElapsedMs - state.startedAtMs
    ) {
      fail(`${label}: elapsedMs must equal active time since the current step attempt started`);
    }
    firstInputByAttempt.add(key);
  }
  if (event.eventName === "wrong_action") {
    const attemptKey = `${event.context?.stepId}:${event.context?.attempt}`;
    const bucketKey = `${attemptKey}:${event.payload?.reason}`;
    const stepDefinition = stepDefinitionById.get(event.context?.stepId);
    if (!stepDefinition?.wrongActionReasons?.includes(event.payload?.reason)) {
      fail(`${label}: wrong_action reason is not registered for ${event.context?.stepId}`);
    }
    const previousCount = wrongActionSnapshotByBucket.get(bucketKey) ?? 0;
    const currentCount = event.payload?.count;
    if (!Number.isInteger(currentCount) || currentCount <= previousCount) {
      fail(`${label}: wrong_action count must be a strictly increasing cumulative snapshot for ${bucketKey}`);
    }
    wrongActionSnapshotByBucket.set(bucketKey, currentCount);
    const eventCount = (wrongActionEventCountByAttempt.get(attemptKey) ?? 0) + 1;
    wrongActionEventCountByAttempt.set(attemptKey, eventCount);
    if (eventCount > 16) {
      fail(`${label}: wrong_action snapshots exceed the bounded limit for ${attemptKey}`);
    }
    wrongActionCountByAttempt.set(
      attemptKey,
      (wrongActionCountByAttempt.get(attemptKey) ?? 0) +
        (Number.isInteger(currentCount) ? currentCount - previousCount : 0)
    );
  }
  if (event.eventName === "onboarding_step_succeeded") {
    const key = `${event.context?.stepId}:${event.context?.attempt}`;
    if (stepSuccesses.has(key)) fail(`${label}: duplicate step success ${key}`);
    stepSuccesses.add(key);
    if (!stepStarts.has(key)) fail(`${label}: step success has no matching prior start ${key}`);
    if (consumedSourceEventIds.has(event.payload?.sourceEventId)) {
      fail(`${label}: sourceEventId was already consumed by another success`);
    }
    consumedSourceEventIds.add(event.payload?.sourceEventId);
    const stepDefinition = stepDefinitionById.get(event.context?.stepId);
    if (!stepDefinition?.successEvidenceTypes?.includes(event.payload?.evidenceType)) {
      fail(`${label}: evidenceType is not registered for ${event.context?.stepId}`);
    }
    if (event.payload?.fixtureEntityId !== stepDefinition?.fixtureId) {
      fail(`${label}: fixtureEntityId differs from frozen definition`);
    }
    const state = stepState.get(key);
    if (state) state.succeeded = true;
    succeededStepIds.add(event.context?.stepId);
    if (activeStepId === event.context?.stepId) activeStepId = null;
  }
  if (event.eventName === "onboarding_hint_escalated") {
    const key = `${event.context?.stepId}:${event.context?.attempt}`;
    const state = stepState.get(key);
    const from = event.payload?.fromHint;
    const to = event.payload?.toHint;
    const wrongActionCountAtTransition =
      event.payload?.wrongActionCountAtTransition;
    const observedWrongActionCount = wrongActionCountByAttempt.get(key) ?? 0;
    const priorHintWrongActionCount =
      wrongActionCountAtLastHintByAttempt.get(key) ?? 0;
    if (!Number.isInteger(from) || !Number.isInteger(to) || to !== from + 1 || to > 2) {
      fail(`${label}: hint escalation must advance exactly one level and stop at H2`);
    }
    if (state && from !== state.currentHint) {
      fail(`${label}: fromHint must equal current hint ${state.currentHint} for ${key}`);
    }
    if (
      !Number.isInteger(wrongActionCountAtTransition) ||
      wrongActionCountAtTransition < observedWrongActionCount ||
      wrongActionCountAtTransition < priorHintWrongActionCount
    ) {
      fail(
        `${label}: wrongActionCountAtTransition must be a nondecreasing cumulative count no lower than logged snapshots`
      );
    }
    if (to === 1 && event.payload?.reason !== "active-time-stall") {
      fail(`${label}: H0 to H1 is allowed only after the fixed active-time stall`);
    }
    if (
      to === 1 &&
      state &&
      event.activeElapsedMs - state.lastProgressMs <
        studyDefinition?.hintPolicy?.h1ActiveNoProgressMs
    ) {
      fail(`${label}: H1 requires 5000ms of active no-progress time`);
    }
    if (
      state &&
      to === 2 &&
      event.payload?.reason === "active-time-stall" &&
      event.activeElapsedMs - Math.max(state.lastProgressMs, state.lastHintMs) <
        studyDefinition?.hintPolicy?.h2ActiveNoProgressMs
    ) {
      fail(`${label}: active-time-stall hint violates the frozen independent no-progress window`);
    }
    if (
      event.payload?.reason === "repeated-wrong-action"
    ) {
      if (to !== 2) {
        fail(`${label}: repeated-wrong-action may accelerate only H1 to H2`);
      }
      const baseline = wrongActionBaselineAtH1ByAttempt.get(key);
      if (
        !Number.isInteger(baseline) ||
        wrongActionCountAtTransition - baseline < repeatedWrongActionThreshold
      ) {
        fail(
          `${label}: repeated-wrong-action hint requires ${repeatedWrongActionThreshold} new aggregated wrong actions`
        );
      }
    }
    if (event.context?.hintLevel !== to) fail(`${label}: context hintLevel must equal toHint`);
    if (state) {
      if (to === 1) {
        wrongActionBaselineAtH1ByAttempt.set(
          key,
          wrongActionCountAtTransition
        );
      }
      wrongActionCountAtLastHintByAttempt.set(
        key,
        wrongActionCountAtTransition
      );
      state.currentHint = to;
      state.lastHintMs = event.activeElapsedMs;
    }
    maximumHint = Math.max(maximumHint, to);
  }
  if (event.eventName === "context_prompt_shown") {
    if (studyDefinition?.contextPromptPolicy?.enabled !== true) {
      fail(`${label}: context prompt emitted while contextPromptPolicy is disabled`);
    }
    const promptDefinition = contextPromptDefinitionById.get(event.payload?.promptId);
    if (!promptDefinition) {
      fail(`${label}: unregistered context prompt ${String(event.payload?.promptId)}`);
    } else if (!promptDefinition.triggerIds?.includes(event.payload?.triggerId)) {
      fail(`${label}: triggerId is not registered for ${event.payload?.promptId}`);
    }
    contextPromptsShown.add(event.payload?.promptId);
  }
  if (
    event.eventName === "context_prompt_succeeded"
  ) {
    if (!contextPromptsShown.has(event.payload?.promptId)) {
      fail(`${label}: context prompt success has no matching prior shown event`);
    }
    if (contextPromptsSucceeded.has(event.payload?.promptId)) {
      fail(`${label}: context prompt may succeed only once`);
    }
    const promptDefinition = contextPromptDefinitionById.get(event.payload?.promptId);
    if (!promptDefinition) {
      fail(`${label}: unregistered context prompt ${String(event.payload?.promptId)}`);
    } else if (!promptDefinition.successEvidenceTypes?.includes(event.payload?.evidenceType)) {
      fail(`${label}: evidenceType is not registered for ${event.payload?.promptId}`);
    }
    if (consumedSourceEventIds.has(event.payload?.sourceEventId)) {
      fail(`${label}: sourceEventId was already consumed by another success`);
    }
    consumedSourceEventIds.add(event.payload?.sourceEventId);
    contextPromptsSucceeded.add(event.payload?.promptId);
  }
  if (event.eventName === "retention_probe_started" && retentionStartEvent === null) {
    retentionStartEvent = event;
  }
  if (event.eventName === "retention_probe_checkpoint") {
    retentionCheckpoints.push({
      seconds: event.payload?.checkpointSeconds,
      activeElapsedMs: event.activeElapsedMs
    });
  }
  if (
    event.eventName === "onboarding_completed" &&
    event.payload?.totalActiveElapsedMs !== event.activeElapsedMs
  ) {
    fail(`${label}: totalActiveElapsedMs must equal event activeElapsedMs`);
  }
  if (event.eventName === "study_session_ended") {
    if (endedIndex !== -1) fail(`${label}: study_session_ended must occur once`);
    endedIndex = index;
  } else if (endedIndex !== -1) {
    fail(`${label}: no events may follow study_session_ended`);
  }
}

if (endedIndex === -1) fail("session is missing study_session_ended");
if (endedIndex !== events.length - 1) fail("study_session_ended must be the last event");

const terminalStatus = events.at(-1)?.payload?.terminalStatus;
const count = (eventName) => eventIndexes.get(eventName)?.length ?? 0;
const firstIndex = (eventName) => eventIndexes.get(eventName)?.[0] ?? -1;

const retentionEventCount =
  count("retention_probe_started") +
  count("retention_probe_checkpoint") +
  count("retention_probe_succeeded");
if (retentionEventCount > 0) {
  if (retentionPolicy?.enabled !== true) {
    fail("retention events are forbidden while retentionPolicy is disabled");
  }
  if (count("retention_probe_started") !== 1) {
    fail("retention events require exactly one retention_probe_started");
  }
  if (count("retention_probe_succeeded") > 1) {
    fail("retention_probe_succeeded may occur only once");
  }
  for (const eventName of ["retention_probe_checkpoint", "retention_probe_succeeded"]) {
    for (const index of eventIndexes.get(eventName) ?? []) {
      if (index <= firstIndex("retention_probe_started")) {
        fail(`${eventName} must follow retention_probe_started`);
      }
    }
  }
  if (count("retention_probe_succeeded") === 1) {
    const succeededIndex = firstIndex("retention_probe_succeeded");
    for (const checkpointIndex of eventIndexes.get("retention_probe_checkpoint") ?? []) {
      if (checkpointIndex >= succeededIndex) {
        fail("retention checkpoints must occur before retention_probe_succeeded");
      }
    }
  }
  if (retentionStartEvent) {
    const expectedMode =
      retentionPolicy?.modeSource === "selected-mode"
        ? selectedMode
        : retentionPolicy?.fixedMode;
    if (retentionStartEvent.payload?.mode !== expectedMode) {
      fail("retention probe mode differs from the frozen retentionPolicy");
    }
  }
  let previousCheckpoint = 0;
  const seenCheckpoints = new Set();
  for (const checkpoint of retentionCheckpoints) {
    if (
      seenCheckpoints.has(checkpoint.seconds) ||
      checkpoint.seconds <= previousCheckpoint
    ) {
      fail("retention checkpoints must be unique and ordered 30 → 60 → 90");
    }
    if (!retentionPolicy?.requiredCheckpointSeconds?.includes(checkpoint.seconds)) {
      fail(`retention checkpoint ${checkpoint.seconds} is not registered in retentionPolicy`);
    }
    if (
      retentionStartEvent &&
      checkpoint.activeElapsedMs - retentionStartEvent.activeElapsedMs <
        checkpoint.seconds * 1000
    ) {
      fail(`retention checkpoint ${checkpoint.seconds} occurred before its active-time threshold`);
    }
    seenCheckpoints.add(checkpoint.seconds);
    previousCheckpoint = checkpoint.seconds;
  }
  if (count("retention_probe_succeeded") === 1) {
    for (const requiredCheckpoint of retentionPolicy?.requiredCheckpointSeconds ?? []) {
      if (!seenCheckpoints.has(requiredCheckpoint)) {
        fail(`retention success is missing required checkpoint ${requiredCheckpoint}`);
      }
    }
    const success =
      events[(eventIndexes.get("retention_probe_succeeded") ?? [])[0]];
    for (const requiredBehavior of retentionPolicy?.requiredBehaviors ?? []) {
      if (!success?.payload?.behaviors?.includes(requiredBehavior)) {
        fail(`retention success is missing required behavior ${requiredBehavior}`);
      }
    }
  }
}
if (terminalStatus === "retention-complete" && count("retention_probe_succeeded") !== 1) {
  fail("retention-complete requires exactly one retention_probe_succeeded");
}
if (count("retention_probe_succeeded") === 1 && terminalStatus !== "retention-complete") {
  fail("retention_probe_succeeded requires retention-complete terminalStatus");
}
if (
  retentionEventCount > 0 &&
  count("retention_probe_succeeded") === 0 &&
  !["retention-not-met", "abandoned", "technical-invalid"].includes(terminalStatus)
) {
  fail("started retention probe without success must end retention-not-met, abandoned, or technical-invalid");
}
if (
  terminalStatus === "retention-not-met" &&
  (count("retention_probe_started") !== 1 || count("retention_probe_succeeded") !== 0)
) {
  fail("retention-not-met requires a started probe with no success");
}

if (sessionKind === "o1") {
  if (assignmentIndex === -1) fail("o1 session is missing onboarding_variant_assigned");
  if (offerIndex === -1) fail("o1 session is missing onboarding_offer_shown");
  if (assignmentIndex !== 0) fail("onboarding_variant_assigned must be the first o1 event");
  if (assignmentIndex >= offerIndex && offerIndex !== -1) {
    fail("assignment must occur before offer");
  }
  const dispositions = [
    "onboarding_completed",
    "onboarding_skipped",
    "onboarding_abandoned"
  ].filter((eventName) => count(eventName) > 0);
  if (dispositions.length !== 1) {
    fail(`o1 session requires exactly one disposition; found ${dispositions.join(", ") || "none"}`);
  }
  if (dispositions.some((eventName) => count(eventName) > 1)) {
    fail("o1 disposition may occur only once");
  }
  if (count("onboarding_started") > 1) fail("onboarding_started may occur only once");
  const dispositionIndex = firstIndex(dispositions[0]);
  const startedIndex = firstIndex("onboarding_started");
  if (startedIndex !== -1 && startedIndex <= offerIndex) {
    fail("onboarding_started must follow onboarding_offer_shown");
  }
  if (dispositions[0] === "onboarding_completed") {
    if (count("onboarding_started") !== 1) {
      fail("completed o1 session requires exactly one onboarding_started");
    }
    if (startedIndex >= dispositionIndex) {
      fail("onboarding_completed must follow onboarding_started");
    }
  }
  if (dispositions[0] === "onboarding_skipped") {
    const skip = events[dispositionIndex];
    if (skip?.payload?.phase === "offer" && startedIndex !== -1) {
      fail("offer-phase skip must not follow onboarding_started");
    }
    if (skip?.payload?.phase === "in-progress" && startedIndex === -1) {
      fail("in-progress skip requires onboarding_started");
    }
  }
  for (const eventName of learningStepEvents) {
    for (const index of eventIndexes.get(eventName) ?? []) {
      if (startedIndex === -1 || index <= startedIndex || index >= dispositionIndex) {
        fail(`${eventName} must occur after onboarding_started and before disposition`);
      }
    }
  }
  for (const eventName of [
    "context_prompt_shown",
    "context_prompt_succeeded",
    "retention_probe_started",
    "retention_probe_checkpoint",
    "retention_probe_succeeded"
  ]) {
    for (const index of eventIndexes.get(eventName) ?? []) {
      if (index <= dispositionIndex) {
        fail(`${eventName} must follow the o1 disposition`);
      }
    }
  }
  const allowedAfterDisposition =
    dispositions[0] === "onboarding_abandoned"
      ? new Set(["study_session_ended"])
      : new Set([
          "context_prompt_shown",
          "context_prompt_succeeded",
          "retention_probe_started",
          "retention_probe_checkpoint",
          "retention_probe_succeeded",
          "study_session_ended"
        ]);
  for (let index = dispositionIndex + 1; index < events.length; index += 1) {
    if (!allowedAfterDisposition.has(events[index]?.eventName)) {
      fail(`event[${index}]: ${events[index]?.eventName} is not allowed after o1 disposition`);
    }
  }
  if (
    dispositions[0] === "onboarding_completed" &&
    !(
      retentionEventCount === 0
        ? terminalStatus === "completed"
        : ["retention-complete", "retention-not-met", "abandoned", "technical-invalid"].includes(
            terminalStatus
          )
    )
  ) {
    fail("terminalStatus must match completed disposition and any embedded retention probe");
  }
  if (
    dispositions[0] === "onboarding_skipped" &&
    (
      retentionEventCount === 0
        ? terminalStatus !== "skipped"
        : !["retention-complete", "retention-not-met", "abandoned", "technical-invalid"].includes(
            terminalStatus
          )
    )
  ) {
    fail("terminalStatus must match skipped disposition and any post-skip retention probe");
  }
  if (
    dispositions[0] === "onboarding_abandoned" &&
    !["abandoned", "technical-invalid"].includes(terminalStatus)
  ) {
    fail("terminalStatus must match abandoned disposition");
  }
  const completion = events.find((event) => event.eventName === "onboarding_completed");
  if (completion && stepStarts.size === 0) {
    fail("completed o1 session requires at least one learning step");
  }
  if (completion) {
    if (nextExpectedStepIndex !== expectedStepIds.length) {
      fail(
        `completed o1 session reached ${nextExpectedStepIndex}/${expectedStepIds.length} preregistered steps`
      );
    }
    for (const stepId of expectedStepIds) {
      const latestAttempt = lastAttemptByStep.get(stepId);
      if (!stepSuccesses.has(`${stepId}:${latestAttempt}`)) {
        fail(`completed o1 session lacks success for latest attempt of ${stepId}`);
      }
    }
  }
  if (completion && completion.payload?.maxHint !== maximumHint) {
    fail("onboarding_completed.maxHint must equal the maximum observed hint level");
  }
}

if (sessionKind === "full-training") {
  if (count("full_training_started") !== 1) {
    fail("full-training session requires exactly one full_training_started");
  }
  if (count("full_training_completed") > 1) {
    fail("full_training_completed may occur only once");
  }
  if (
    count("full_training_completed") === 1 &&
    firstIndex("full_training_completed") <= firstIndex("full_training_started")
  ) {
    fail("full_training_completed must follow full_training_started");
  }
  const trainingStarted = events[firstIndex("full_training_started")];
  const trainingCompleted =
    count("full_training_completed") === 1
      ? events[firstIndex("full_training_completed")]
      : null;
  if (
    trainingCompleted &&
    trainingCompleted.payload?.trainingVersion !==
      trainingStarted?.payload?.trainingVersion
  ) {
    fail("full training version changed between start and completion");
  }
  if (
    trainingStarted?.payload?.trainingVersion !==
    studyDefinition?.definitionVersion
  ) {
    fail("full training version differs from frozen study definitionVersion");
  }
  if (
    count("full_training_completed") === 1 &&
    !(
      retentionEventCount === 0
        ? terminalStatus === "full-training-complete"
        : ["retention-complete", "retention-not-met", "abandoned", "technical-invalid"].includes(
            terminalStatus
          )
    )
  ) {
    fail("completed full-training session has a mismatched terminalStatus or retention outcome");
  }
  if (
    count("full_training_completed") === 0 &&
    !["abandoned", "technical-invalid"].includes(terminalStatus)
  ) {
    fail("incomplete full-training session must end abandoned or technical-invalid");
  }
  const trainingEnd =
    count("full_training_completed") === 1
      ? firstIndex("full_training_completed")
      : endedIndex;
  for (const eventName of learningStepEvents) {
    for (const index of eventIndexes.get(eventName) ?? []) {
      if (index <= firstIndex("full_training_started") || index >= trainingEnd) {
        fail(`${eventName} must occur during the full-training interval`);
      }
    }
  }
  if (
    count("retention_probe_started") > 0 &&
    (
      count("full_training_completed") === 0 ||
      firstIndex("retention_probe_started") <= firstIndex("full_training_completed")
    )
  ) {
    fail("retention probe must follow completed full training");
  }
  const completion = events.find((event) => event.eventName === "full_training_completed");
  if (completion) {
    if (nextExpectedStepIndex !== 9) {
      fail(`completed full-training session reached ${nextExpectedStepIndex}/9 preregistered tasks`);
    }
    for (const stepId of expectedStepIds) {
      const latestAttempt = lastAttemptByStep.get(stepId);
      if (!stepSuccesses.has(`${stepId}:${latestAttempt}`)) {
        fail(`completed full-training session lacks success for latest attempt of ${stepId}`);
      }
    }
  }
  if (completion && completion.payload?.maxHint !== maximumHint) {
    fail("full_training_completed.maxHint must equal the maximum observed hint level");
  }
}

if (sessionKind === "context-prompt") {
  if (count("context_prompt_shown") < 1) {
    fail("context-prompt session requires at least one context_prompt_shown");
  }
  if (count("context_prompt_succeeded") > 0 && terminalStatus !== "context-complete") {
    fail("context prompt success requires context-complete terminalStatus");
  }
  if (
    count("context_prompt_succeeded") === 0 &&
    !["context-not-met", "abandoned", "technical-invalid"].includes(terminalStatus)
  ) {
    fail("context-prompt session without success must end context-not-met, abandoned, or technical-invalid");
  }
}

if (sessionKind === "retention") {
  if (count("retention_probe_started") !== 1) {
    fail("retention session requires exactly one retention_probe_started");
  }
  if (!["retention-complete", "retention-not-met", "abandoned", "technical-invalid"].includes(terminalStatus)) {
    fail("retention session has a mismatched terminalStatus");
  }
}

if (errors.length > 0) {
  console.error(`StudyLog validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `StudyLog invariant validation passed: ${events.length} events, ${sessionKind} session ${sessionId}.`
);
