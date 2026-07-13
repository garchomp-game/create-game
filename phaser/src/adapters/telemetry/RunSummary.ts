export const RUN_SUMMARY_COLUMNS = [
  "captured_at",
  "app_version",
  "ruleset_version",
  "build_commit",
  "run_id",
  "run_origin",
  "mode",
  "stage",
  "difficulty",
  "seed",
  "seed_category",
  "weapon",
  "contract",
  "rank_eligible",
  "rank_ineligible_reasons",
  "status",
  "elapsed_seconds",
  "score",
  "score_per_minute",
  "level",
  "extra_level",
  "extra_cycle",
  "threat_tier",
  "collapse_stage",
  "build_completed_seconds",
  "kills",
  "kills_per_minute",
  "shots_fired",
  "projectiles_fired",
  "projectile_hits",
  "projectile_hit_rate",
  "hits_taken",
  "damage_taken",
  "contact_damage",
  "projectile_damage",
  "collapse_damage",
  "hp_recovered",
  "heal_pickups",
  "effective_heal_pickups",
  "upgrades_chosen",
  "extra_upgrades_chosen",
  "extra_automatic_upgrades",
  "rapid_fire_rank",
  "swift_step_rank",
  "vital_core_rank",
  "overdrive_rounds_rank",
  "split_shot_rank",
  "piercing_rounds_rank",
  "pulse_ricochet_rank",
  "limit_power_rank",
  "limit_cycle_rank",
  "limit_drive_rank",
  "limit_core_rank",
  "capstone_acquired_seconds",
  "capstone_activations",
  "capstone_follow_up_hits",
  "encounters_completed",
  "ranged_surges",
  "swarm_rushes",
  "brute_sieges",
  "navigation_direct_frames",
  "navigation_path_frames",
  "navigation_fallback_frames",
  "navigation_field_builds",
  "navigation_path_ratio",
  "last_damage_kind",
  "last_damage_enemy_type",
] as const;

export type RunSummaryColumn = (typeof RUN_SUMMARY_COLUMNS)[number];
export type RunSummaryCell = string | number | boolean | null;
export type RunSummaryRow = Record<RunSummaryColumn, RunSummaryCell>;
export type RunSummaryFormat = "csv" | "tsv";

export function createRunSummaryRow(value: unknown): RunSummaryRow | null {
  if (!isRecord(value)) return null;
  const result = recordAt(value, "resultSummary");
  const elapsed = numberAt(result, "elapsed") ?? numberAt(value, "elapsed");
  const score = numberAt(result, "score");
  if (elapsed === null || score === null) return null;

  const weaponMetrics = recordAt(result, "weaponMetrics");
  const buildComposition = recordAt(value, "buildComposition");
  const rankEligibility = recordAt(value, "rankEligibility");
  const upgradeRanks = recordAt(value, "upgradeRanks");
  const extraUpgradeRanks = recordAt(value, "extraUpgradeRanks");
  const damageBySource = recordAt(result, "damageTakenBySource");
  const lastDamageSource = recordAt(result, "lastDamageSource");
  const capstoneMetrics = recordAt(result, "capstoneMetrics");
  const encounter = recordAt(value, "encounter");
  const contract = recordAt(encounter, "contract");
  const stats = recordAt(value, "stats");
  const encounterMetrics = recordAt(stats, "encounterMetrics");
  const progressionMetrics = recordAt(stats, "progressionMetrics");
  const navigationMetrics = recordAt(stats, "navigationMetrics");
  const eventCounts = recordAt(encounterMetrics, "eventCounts");
  const extraSelections = unknownArrayAt(progressionMetrics, "extraSelections");
  const automaticExtraSelections = extraSelections.filter(
    (selection) => isRecord(selection) && selection.automatic === true,
  ).length;
  const navigationDirect = numberAt(navigationMetrics, "directFrames") ?? 0;
  const navigationPath = numberAt(navigationMetrics, "pathFrames") ?? 0;
  const navigationFallback = numberAt(navigationMetrics, "fallbackFrames") ?? 0;
  const navigationFrames = navigationDirect + navigationPath + navigationFallback;
  const projectilesFired = sumWeaponMetric(weaponMetrics, "projectilesFired");
  const projectileHits = sumWeaponMetric(weaponMetrics, "hits");
  const kills = numberAt(result, "enemiesKilled") ?? 0;

  return {
    captured_at: stringAt(value, "capturedAt") ?? "",
    app_version: stringAt(value, "appVersion") ?? "",
    ruleset_version:
      stringAt(value, "rulesetVersion") ?? stringAt(value, "configVersion") ?? "",
    build_commit: stringAt(value, "buildCommit") ?? "",
    run_id: stringAt(value, "runId") ?? "",
    run_origin: stringAt(value, "runOrigin") ?? "manual",
    mode: stringAt(value, "modeId") ?? "",
    stage: stringAt(value, "stageId") ?? "",
    difficulty: stringAt(value, "difficultyId") ?? "",
    seed: numberAt(value, "seed"),
    seed_category: stringAt(value, "seedCategory") ?? "",
    weapon:
      stringAt(buildComposition, "weaponType") ?? inferWeaponFromMetrics(weaponMetrics) ?? "",
    contract: stringAt(contract, "choice") ?? "",
    rank_eligible: booleanAt(rankEligibility, "eligible"),
    rank_ineligible_reasons: stringArrayAt(rankEligibility, "reasons").join("|"),
    status: stringAt(value, "status") ?? "",
    elapsed_seconds: round(elapsed, 3),
    score,
    score_per_minute: elapsed > 0 ? round((score * 60) / elapsed, 3) : null,
    level: numberAt(result, "level"),
    extra_level: numberAt(result, "extraLevel") ?? numberAt(value, "extraLevel") ?? 0,
    extra_cycle: numberAt(result, "extraCycle") ?? numberAt(value, "extraCycle") ?? 0,
    threat_tier: numberAt(result, "threatTier") ?? 0,
    collapse_stage: numberAt(result, "collapseStage") ?? 0,
    build_completed_seconds: nullableRoundedNumber(value, "buildCompletedAt"),
    kills,
    kills_per_minute: elapsed > 0 ? round((kills * 60) / elapsed, 3) : null,
    shots_fired: numberAt(result, "shotsFired"),
    projectiles_fired: projectilesFired,
    projectile_hits: projectileHits,
    projectile_hit_rate:
      projectilesFired > 0 ? round(projectileHits / projectilesFired, 4) : null,
    hits_taken: numberAt(result, "hitsTaken"),
    damage_taken: numberAt(result, "damageTaken"),
    contact_damage: numberAt(damageBySource, "contact"),
    projectile_damage: numberAt(damageBySource, "projectile"),
    collapse_damage: numberAt(damageBySource, "collapse") ?? 0,
    hp_recovered: numberAt(result, "hpRecovered"),
    heal_pickups: numberAt(result, "healPickupsCollected"),
    effective_heal_pickups: numberAt(result, "effectiveHealPickupsCollected"),
    upgrades_chosen: numberAt(result, "upgradesChosen"),
    extra_upgrades_chosen: numberAt(result, "extraUpgradesChosen") ?? 0,
    extra_automatic_upgrades: automaticExtraSelections,
    rapid_fire_rank: numberAt(upgradeRanks, "rapidFire"),
    swift_step_rank: numberAt(upgradeRanks, "swiftStep"),
    vital_core_rank: numberAt(upgradeRanks, "vitalCore"),
    overdrive_rounds_rank: numberAt(upgradeRanks, "overdriveRounds"),
    split_shot_rank: numberAt(upgradeRanks, "splitShot"),
    piercing_rounds_rank: numberAt(upgradeRanks, "piercingRounds"),
    pulse_ricochet_rank: numberAt(upgradeRanks, "pulseRicochet"),
    limit_power_rank: numberAt(extraUpgradeRanks, "limitPower") ?? 0,
    limit_cycle_rank: numberAt(extraUpgradeRanks, "limitCycle") ?? 0,
    limit_drive_rank: numberAt(extraUpgradeRanks, "limitDrive") ?? 0,
    limit_core_rank: numberAt(extraUpgradeRanks, "limitCore") ?? 0,
    capstone_acquired_seconds: nullableRoundedNumber(capstoneMetrics, "acquiredAt"),
    capstone_activations: numberAt(capstoneMetrics, "activations"),
    capstone_follow_up_hits: numberAt(capstoneMetrics, "followUpHits"),
    encounters_completed: numberAt(encounterMetrics, "eventsCompleted") ?? 0,
    ranged_surges: numberAt(eventCounts, "rangedSurge") ?? 0,
    swarm_rushes: numberAt(eventCounts, "swarmRush") ?? 0,
    brute_sieges: numberAt(eventCounts, "bruteSiege") ?? 0,
    navigation_direct_frames: navigationDirect,
    navigation_path_frames: navigationPath,
    navigation_fallback_frames: navigationFallback,
    navigation_field_builds: numberAt(navigationMetrics, "fieldBuilds") ?? 0,
    navigation_path_ratio:
      navigationFrames > 0 ? round(navigationPath / navigationFrames, 4) : null,
    last_damage_kind: stringAt(lastDamageSource, "kind") ?? "",
    last_damage_enemy_type: stringAt(lastDamageSource, "enemyType") ?? "",
  };
}

export function serializeRunSummary(
  rows: readonly RunSummaryRow[],
  format: RunSummaryFormat,
): string {
  const delimiter = format === "csv" ? "," : "\t";
  const lines = [
    RUN_SUMMARY_COLUMNS.join(delimiter),
    ...rows.map((row) =>
      RUN_SUMMARY_COLUMNS.map((column) => formatCell(row[column], format)).join(delimiter),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function formatCell(value: RunSummaryCell, format: RunSummaryFormat): string {
  if (value === null) return "";
  const text = String(value);
  if (format === "tsv") return text.replace(/[\t\r\n]+/g, " ");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function inferWeaponFromMetrics(metrics: Record<string, unknown>): string | null {
  let selected: string | null = null;
  let mostShots = -1;
  for (const [weapon, rawMetrics] of Object.entries(metrics)) {
    const shots = numberAt(toRecord(rawMetrics), "shotsFired") ?? 0;
    if (shots > mostShots) {
      selected = weapon;
      mostShots = shots;
    }
  }
  return selected;
}

function sumWeaponMetric(metrics: Record<string, unknown>, key: string): number {
  return Object.values(metrics).reduce(
    (total: number, rawMetrics) => total + (numberAt(toRecord(rawMetrics), key) ?? 0),
    0,
  );
}

function nullableRoundedNumber(record: Record<string, unknown>, key: string): number | null {
  const value = numberAt(record, key);
  return value === null ? null : round(value, 3);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function recordAt(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return toRecord(record[key]);
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringAt(record: Record<string, unknown>, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function numberAt(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanAt(record: Record<string, unknown>, key: string): boolean | null {
  return typeof record[key] === "boolean" ? record[key] : null;
}

function stringArrayAt(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function unknownArrayAt(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
