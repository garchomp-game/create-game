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
  "performance_frame_samples",
  "performance_actual_fps",
  "performance_estimated_fps",
  "performance_average_raw_dt_ms",
  "performance_p95_raw_dt_ms",
  "performance_max_raw_dt_ms",
  "performance_frames_over_50_ms",
  "build_completed_seconds",
  "kills",
  "kills_per_minute",
  "shots_fired",
  "projectiles_fired",
  "projectile_hits",
  "projectile_hit_rate",
  "projectile_hits_per_kill",
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
  "pulse_focus_rank",
  "piercing_rounds_rank",
  "pulse_ricochet_rank",
  "spread_sweep_rank",
  "limit_power_rank",
  "limit_cycle_rank",
  "limit_drive_rank",
  "limit_core_rank",
  "capstone_acquired_seconds",
  "capstone_upgrade",
  "capstone_activations",
  "capstone_obstacle_ricochets",
  "capstone_boundary_ricochets",
  "capstone_boundary_left",
  "capstone_boundary_right",
  "capstone_boundary_top",
  "capstone_boundary_bottom",
  "capstone_follow_up_hits",
  "capstone_obstacle_follow_up_hits",
  "capstone_obstacle_follow_up_kills",
  "capstone_boundary_follow_up_hits",
  "capstone_boundary_follow_up_kills",
  "capstone_boundary_follow_up_left",
  "capstone_boundary_follow_up_right",
  "capstone_boundary_follow_up_top",
  "capstone_boundary_follow_up_bottom",
  "pulse_focus_enhanced_hits",
  "pulse_focus_bonus_damage",
  "pulse_focus_target_enhanced_hits",
  "pulse_focus_line_enhanced_hits",
  "pulse_focus_target_bonus_damage",
  "pulse_focus_line_bonus_damage",
  "pulse_focus_max_stacks",
  "spread_sweep_triggers",
  "spread_sweep_consumes",
  "spread_sweep_max_targets",
  "encounters_completed",
  "ranged_surges",
  "swarm_rushes",
  "brute_sieges",
  "expedition_outcome",
  "expedition_reached_act",
  "expedition_reached_acts",
  "expedition_completed_seconds",
  "expedition_cards_selected",
  "expedition_cards_completed",
  "expedition_cards_failed",
  "expedition_cards_interrupted",
  "expedition_cards_deferred",
  "expedition_structured_enemies_spawned",
  "expedition_structured_spawns_deferred",
  "expedition_longest_meaningful_gap_seconds",
  "expedition_score_before_bonus",
  "expedition_clear_score_bonus",
  "expedition_time_score_bonus",
  "expedition_boss_fight_seconds",
  "commander_spawned",
  "commander_killed",
  "commander_trait_activations",
  "commander_reinforcements_spawned",
  "commander_average_lifetime_seconds",
  "charger_spawned",
  "charger_killed",
  "charger_charges",
  "charger_player_hits",
  "charger_avoided",
  "boss_id",
  "boss_spawned_seconds",
  "boss_defeated_seconds",
  "boss_remaining_hp",
  "boss_maximum_hp",
  "boss_phase_reached",
  "boss_targeted_salvos",
  "boss_escort_pincers",
  "boss_command_pulses",
  "boss_targeted_salvo_player_hits",
  "boss_escort_pincer_player_hits",
  "boss_command_pulse_player_hits",
  "boss_targeted_salvo_damage",
  "boss_escort_pincer_damage",
  "boss_command_pulse_damage",
  "boss_escorts_spawned",
  "boss_kills_during_fight",
  "boss_heal_pickups_spawned",
  "boss_heal_drops_suppressed",
  "boss_heal_pickups_collected",
  "boss_hp_recovered",
  "boss_command_pulse_blocked",
  "boss_command_pulse_outside",
  "boss_command_pulse_invulnerable",
  "boss_defeated_by_weapon",
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
  const boundaryRicochetsBySide = recordAt(capstoneMetrics, "boundaryRicochetsBySide");
  const boundaryFollowUpHitsBySide = recordAt(capstoneMetrics, "boundaryFollowUpHitsBySide");
  const performance = recordAt(value, "performance");
  const weaponIdentityMetrics = recordAt(result, "weaponIdentityMetrics");
  const pulseFocusMetrics = recordAt(weaponIdentityMetrics, "pulseFocus");
  const spreadSweepMetrics = recordAt(weaponIdentityMetrics, "spreadSweep");
  const encounter = recordAt(value, "encounter");
  const contract = recordAt(encounter, "contract");
  const stats = recordAt(value, "stats");
  const encounterMetrics = recordAt(stats, "encounterMetrics");
  const progressionMetrics = recordAt(stats, "progressionMetrics");
  const navigationMetrics = recordAt(stats, "navigationMetrics");
  const eventCounts = recordAt(encounterMetrics, "eventCounts");
  const expeditionMetrics = recordAt(encounterMetrics, "expedition");
  const commanderMetrics = recordAt(encounterMetrics, "commander");
  const chargerMetrics = recordAt(encounterMetrics, "charger");
  const bossMetrics = recordAt(encounterMetrics, "boss");
  const bossAttacksExecuted = recordAt(bossMetrics, "attacksExecuted");
  const bossPlayerHitsByAttack = recordAt(bossMetrics, "playerHitsByAttack");
  const bossDamageTakenByAttack = recordAt(bossMetrics, "damageTakenByAttack");
  const bossCommandPulseResults = recordAt(bossMetrics, "commandPulseResults");
  const extraSelections = unknownArrayAt(progressionMetrics, "extraSelections");
  const automaticExtraSelections = extraSelections.filter(
    (selection) => isRecord(selection) && selection.automatic === true,
  ).length;
  const navigationDirect = numberAt(navigationMetrics, "directFrames") ?? 0;
  const navigationPath = numberAt(navigationMetrics, "pathFrames") ?? 0;
  const navigationFallback = numberAt(navigationMetrics, "fallbackFrames") ?? 0;
  const navigationFrames = navigationDirect + navigationPath + navigationFallback;
  const commandersKilled = numberAt(commanderMetrics, "killed") ?? 0;
  const commanderLifetimeTotal = numberAt(commanderMetrics, "lifetimeTotal") ?? 0;
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
    performance_frame_samples: numberAt(performance, "frameSamples") ?? 0,
    performance_actual_fps: roundedNumber(performance, "actualFps"),
    performance_estimated_fps: roundedNumber(performance, "estimatedFps"),
    performance_average_raw_dt_ms: roundedNumber(performance, "averageRawDtMs"),
    performance_p95_raw_dt_ms: roundedNumber(performance, "p95RawDtMs"),
    performance_max_raw_dt_ms: roundedNumber(performance, "maxRawDtMs"),
    performance_frames_over_50_ms: numberAt(performance, "framesOver50Ms") ?? 0,
    build_completed_seconds: nullableRoundedNumber(value, "buildCompletedAt"),
    kills,
    kills_per_minute: elapsed > 0 ? round((kills * 60) / elapsed, 3) : null,
    shots_fired: numberAt(result, "shotsFired"),
    projectiles_fired: projectilesFired,
    projectile_hits: projectileHits,
    projectile_hit_rate:
      projectilesFired > 0 ? round(projectileHits / projectilesFired, 4) : null,
    projectile_hits_per_kill: kills > 0 ? round(projectileHits / kills, 3) : null,
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
    pulse_focus_rank: numberAt(upgradeRanks, "pulseFocus") ?? 0,
    piercing_rounds_rank: numberAt(upgradeRanks, "piercingRounds"),
    pulse_ricochet_rank: numberAt(upgradeRanks, "pulseRicochet"),
    spread_sweep_rank: numberAt(upgradeRanks, "spreadSweep") ?? 0,
    limit_power_rank: numberAt(extraUpgradeRanks, "limitPower") ?? 0,
    limit_cycle_rank: numberAt(extraUpgradeRanks, "limitCycle") ?? 0,
    limit_drive_rank: numberAt(extraUpgradeRanks, "limitDrive") ?? 0,
    limit_core_rank: numberAt(extraUpgradeRanks, "limitCore") ?? 0,
    capstone_acquired_seconds: nullableRoundedNumber(capstoneMetrics, "acquiredAt"),
    capstone_upgrade: stringAt(capstoneMetrics, "upgradeId") ?? "",
    capstone_activations: numberAt(capstoneMetrics, "activations"),
    capstone_obstacle_ricochets: numberAt(capstoneMetrics, "obstacleRicochets") ?? 0,
    capstone_boundary_ricochets: numberAt(capstoneMetrics, "boundaryRicochets") ?? 0,
    capstone_boundary_left: numberAt(boundaryRicochetsBySide, "left") ?? 0,
    capstone_boundary_right: numberAt(boundaryRicochetsBySide, "right") ?? 0,
    capstone_boundary_top: numberAt(boundaryRicochetsBySide, "top") ?? 0,
    capstone_boundary_bottom: numberAt(boundaryRicochetsBySide, "bottom") ?? 0,
    capstone_follow_up_hits: numberAt(capstoneMetrics, "followUpHits"),
    capstone_obstacle_follow_up_hits: numberAt(capstoneMetrics, "obstacleFollowUpHits") ?? 0,
    capstone_obstacle_follow_up_kills: numberAt(capstoneMetrics, "obstacleFollowUpKills") ?? 0,
    capstone_boundary_follow_up_hits: numberAt(capstoneMetrics, "boundaryFollowUpHits") ?? 0,
    capstone_boundary_follow_up_kills: numberAt(capstoneMetrics, "boundaryFollowUpKills") ?? 0,
    capstone_boundary_follow_up_left: numberAt(boundaryFollowUpHitsBySide, "left") ?? 0,
    capstone_boundary_follow_up_right: numberAt(boundaryFollowUpHitsBySide, "right") ?? 0,
    capstone_boundary_follow_up_top: numberAt(boundaryFollowUpHitsBySide, "top") ?? 0,
    capstone_boundary_follow_up_bottom: numberAt(boundaryFollowUpHitsBySide, "bottom") ?? 0,
    pulse_focus_enhanced_hits: numberAt(pulseFocusMetrics, "enhancedHits") ?? 0,
    pulse_focus_bonus_damage: round(numberAt(pulseFocusMetrics, "bonusDamage") ?? 0, 3),
    pulse_focus_target_enhanced_hits:
      numberAt(pulseFocusMetrics, "targetEnhancedHits") ?? 0,
    pulse_focus_line_enhanced_hits:
      numberAt(pulseFocusMetrics, "lineEnhancedHits") ?? 0,
    pulse_focus_target_bonus_damage: round(
      numberAt(pulseFocusMetrics, "targetBonusDamage") ?? 0,
      3,
    ),
    pulse_focus_line_bonus_damage: round(
      numberAt(pulseFocusMetrics, "lineBonusDamage") ?? 0,
      3,
    ),
    pulse_focus_max_stacks: numberAt(pulseFocusMetrics, "maxStacks") ?? 0,
    spread_sweep_triggers: numberAt(spreadSweepMetrics, "triggers") ?? 0,
    spread_sweep_consumes: numberAt(spreadSweepMetrics, "consumes") ?? 0,
    spread_sweep_max_targets: numberAt(spreadSweepMetrics, "maxDistinctTargets") ?? 0,
    encounters_completed: numberAt(encounterMetrics, "eventsCompleted") ?? 0,
    ranged_surges: numberAt(eventCounts, "rangedSurge") ?? 0,
    swarm_rushes: numberAt(eventCounts, "swarmRush") ?? 0,
    brute_sieges: numberAt(eventCounts, "bruteSiege") ?? 0,
    expedition_outcome: stringAt(expeditionMetrics, "outcome") ?? "",
    expedition_reached_act: stringAt(expeditionMetrics, "reachedActId") ?? "",
    expedition_reached_acts: stringArrayAt(expeditionMetrics, "reachedActIds").join("|"),
    expedition_completed_seconds: nullableRoundedNumber(expeditionMetrics, "completedAt"),
    expedition_cards_selected: numberAt(expeditionMetrics, "cardsSelected") ?? 0,
    expedition_cards_completed: numberAt(expeditionMetrics, "cardsCompleted") ?? 0,
    expedition_cards_failed: numberAt(expeditionMetrics, "cardsFailed") ?? 0,
    expedition_cards_interrupted: numberAt(expeditionMetrics, "cardsInterrupted") ?? 0,
    expedition_cards_deferred: numberAt(expeditionMetrics, "cardsDeferred") ?? 0,
    expedition_structured_enemies_spawned:
      numberAt(expeditionMetrics, "structuredEnemiesSpawned") ?? 0,
    expedition_structured_spawns_deferred:
      numberAt(expeditionMetrics, "structuredSpawnsDeferred") ?? 0,
    expedition_longest_meaningful_gap_seconds:
      roundedNumber(expeditionMetrics, "longestMeaningfulGap"),
    expedition_score_before_bonus: numberAt(expeditionMetrics, "scoreBeforeBonus") ?? 0,
    expedition_clear_score_bonus: numberAt(expeditionMetrics, "clearScoreBonus") ?? 0,
    expedition_time_score_bonus: numberAt(expeditionMetrics, "timeScoreBonus") ?? 0,
    expedition_boss_fight_seconds:
      nullableRoundedNumber(expeditionMetrics, "bossFightDuration"),
    commander_spawned: numberAt(commanderMetrics, "spawned") ?? 0,
    commander_killed: commandersKilled,
    commander_trait_activations: numberAt(commanderMetrics, "traitActivations") ?? 0,
    commander_reinforcements_spawned:
      numberAt(commanderMetrics, "reinforcementsSpawned") ?? 0,
    commander_average_lifetime_seconds:
      commandersKilled > 0 ? round(commanderLifetimeTotal / commandersKilled, 3) : null,
    charger_spawned: numberAt(chargerMetrics, "spawned") ?? 0,
    charger_killed: numberAt(chargerMetrics, "killed") ?? 0,
    charger_charges: numberAt(chargerMetrics, "charges") ?? 0,
    charger_player_hits: numberAt(chargerMetrics, "playerHits") ?? 0,
    charger_avoided: numberAt(chargerMetrics, "avoided") ?? 0,
    boss_id: stringAt(bossMetrics, "bossId") ?? "",
    boss_spawned_seconds: nullableRoundedNumber(bossMetrics, "spawnedAt"),
    boss_defeated_seconds: nullableRoundedNumber(bossMetrics, "defeatedAt"),
    boss_remaining_hp: nullableRoundedNumber(bossMetrics, "remainingHp"),
    boss_maximum_hp: nullableRoundedNumber(bossMetrics, "maximumHp"),
    boss_phase_reached: numberAt(bossMetrics, "phaseReached") ?? 0,
    boss_targeted_salvos: numberAt(bossAttacksExecuted, "targeted-salvo") ?? 0,
    boss_escort_pincers: numberAt(bossAttacksExecuted, "escort-pincer") ?? 0,
    boss_command_pulses: numberAt(bossAttacksExecuted, "command-pulse") ?? 0,
    boss_targeted_salvo_player_hits:
      numberAt(bossPlayerHitsByAttack, "targeted-salvo") ?? 0,
    boss_escort_pincer_player_hits:
      numberAt(bossPlayerHitsByAttack, "escort-pincer") ?? 0,
    boss_command_pulse_player_hits:
      numberAt(bossPlayerHitsByAttack, "command-pulse") ?? 0,
    boss_targeted_salvo_damage:
      numberAt(bossDamageTakenByAttack, "targeted-salvo") ?? 0,
    boss_escort_pincer_damage:
      numberAt(bossDamageTakenByAttack, "escort-pincer") ?? 0,
    boss_command_pulse_damage:
      numberAt(bossDamageTakenByAttack, "command-pulse") ?? 0,
    boss_escorts_spawned: numberAt(bossMetrics, "escortsSpawned") ?? 0,
    boss_kills_during_fight: numberAt(bossMetrics, "killsDuringBoss") ?? 0,
    boss_heal_pickups_spawned: numberAt(bossMetrics, "healPickupsSpawned") ?? 0,
    boss_heal_drops_suppressed: numberAt(bossMetrics, "healDropsSuppressed") ?? 0,
    boss_heal_pickups_collected: numberAt(bossMetrics, "healPickupsCollected") ?? 0,
    boss_hp_recovered: numberAt(bossMetrics, "hpRecoveredDuringBoss") ?? 0,
    boss_command_pulse_blocked:
      numberAt(bossCommandPulseResults, "blocked") ?? 0,
    boss_command_pulse_outside:
      numberAt(bossCommandPulseResults, "outside") ?? 0,
    boss_command_pulse_invulnerable:
      numberAt(bossCommandPulseResults, "invulnerable") ?? 0,
    boss_defeated_by_weapon: stringAt(bossMetrics, "defeatedByWeapon") ?? "",
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

function roundedNumber(record: Record<string, unknown>, key: string): number {
  return round(numberAt(record, key) ?? 0, 3);
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
