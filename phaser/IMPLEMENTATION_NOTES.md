# Implementation Notes

## Target

- Folder: `phaser`
- Library/Engine: Phaser
- Language: TypeScript
- Build tool: Vite
- Implementation order: 1

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`
- Test: `npm run test`
- Typecheck: `npm run typecheck`
- E2E: `npm run test:e2e`

## What Works

- Player movement: implemented with Phaser keyboard state
- Aiming: implemented with Phaser pointer position, custom cursor, and an aim guide line
- Shooting: automatic fire by default, plus left click and `Space`, with shared cooldown
- Enemy spawning: deterministic seeded spawns from arena edges
- Enemy chasing: direct normalized movement toward player
- Bullet/enemy collision: manual circle/circle
- Enemy/player damage: manual circle/circle with shared damage cooldown
- Obstacles: manual circle/AABB blocking
- HUD: fixed HP/XP and score/time/danger panels using Phaser `Text`
- Game over/restart: two-column result, history, restart, and title flow
- Pause/resume: `P` or `Esc` freezes simulation time and shows a pause overlay
- Run stats: shots fired, enemies killed, hits taken, damage taken, pickups collected, upgrades chosen
- Result summary: Game Over overlay and debug snapshot derive from `WorldState`
- Debug overlay: `F3` toggles frame/enemy/bullet metrics
- Enemy variety: chaser, brute, fast, and ranged
- Enemy projectiles: ranged enemies fire timed projectiles
- Weapon types: pulse, spread, and pierce
- XP pickups: enemies drop XP pickups on kill and nearby pickups magnetize toward the player
- Level up flow: XP threshold opens upgrade selection
- Upgrades: weighted, ranked upgrades modify runtime combat/player values
- Wave director: time-based enemy mix, spawn budget, speed, and max population bands
- Presentation feedback: hit rings, kill bursts, damage flash, and camera shake
- Audio: separate BGM controller and SFX router with local generated assets
- Refined HUD: HP/LV/XP on the left, score/time/danger/enemy/weapon on the right
- Title screen: endless start, local ranking, run history, and settings
- Pause menu: resume, restart, and title return
- Result screen: score, time, level, kills, cause, build, seed, eligibility, best difference
- Run records: versioned local history, rankings, eligibility, and exactly-once finalization
- Profile/settings: persistent guest profile, audio, flash, shake, and auto-fire settings

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |
| Physics | Any approach allowed | Manual collision, no Arcade Physics bodies | Phaser's Graphics-based manual loop produced a clearer baseline for comparison. |

## Carryover From Previous Implementations

- Reused concepts: none; this is the baseline implementation
- Reused constants: shared design constants from `docs/03-detailed-design.md`
- Reused code patterns: none
- Things deliberately not reused: none

## Library Fit

### Easy

Phaser made the core loop, keyboard input, pointer input, canvas scaling, and text rendering straightforward. `Scene.update` is a natural fit for this game shape.

### Hard

Using Phaser's physics systems would add engine-specific setup and object lifecycle choices. For this comparison baseline, manual collision was simpler and easier to reason about.

### Surprising

The Graphics API was enough to produce a complete prototype without creating textures or sprites.

## AI Implementation Notes

- Setup friction: low; Vite plus Phaser works directly
- API friction: low for Scene/Input/Graphics/Text
- Collision/physics friction: avoided by using manual collision
- Debugging friction: low; most state is plain JavaScript objects
- Code organization: simulation, run records, storage, profile, and audio boundaries are separated; screen/debug extraction remains a follow-up
- Risk of outdated knowledge: moderate around optional Phaser physics APIs, low for core Scene usage

## Known Issues

- Enemy obstacle avoidance is intentionally simple and may cause brief clustering near obstacles.
- Pointer aiming follows Phaser's scaled pointer coordinate behavior; verified at the fixed logical canvas size.
- The production bundle is about 1.37 MB and still triggers Vite's 500 KB warning.
- `ArenaScene` and `PhaserArenaRenderer` remain large; split screen components and the debug bridge before adding several new screens.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: none in smoke test

## Refactor Log

### 2026-06-19 TypeScript and Simulation Split

- Converted the Phaser project from `src/main.js` to TypeScript.
- Split Phaser boot into `src/main.ts` and `src/adapters/phaser/createPhaserGame.ts`.
- Moved the Phaser Scene to `src/adapters/phaser/ArenaScene.ts`.
- Extracted Phaser input mapping to `PhaserInputAdapter`.
- Extracted drawing and HUD rendering to `PhaserArenaRenderer`.
- Introduced `WorldState`, `InputSnapshot`, `GameEvent`, and `GameMetric` domain types.
- Moved constants to `src/config/gameConfig.ts`.
- Moved pure helpers to `src/math` and `src/format`.
- Moved core simulation to `src/simulation/stepWorld.ts`.
- Split update logic into systems under `src/simulation/systems`.
- Added `LoggerPort` and `MetricsPort` with console/in-memory adapters.
- Added `F3` debug overlay for dt, p95 dt, enemy count, and bullet count.
- Added Vitest coverage for geometry, vector normalization, random determinism, time formatting, difficulty bands, and core simulation behavior.
- Added a dev-only `window.__ARENA_DEBUG__` hook for E2E state snapshots, forced game over, and restart.
- Added Playwright E2E coverage for Canvas rendering, initial aim preservation, movement, shooting, forced game over, and `R` restart.
- Fixed pointer aiming so the initial `{ x: 1, y: 0 }` aim is not overwritten until the pointer is moved or pressed.
- Routed game-over restart intent through `stepWorld` via a `game.restart.requested` event before the Scene resets the world and random seed.

Verification after refactor:

- `npm run test`: 6 files, 22 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 2 Playwright tests passed
- Chrome headless smoke test: Canvas rendered, non-background pixels detected, movement/shooting input accepted, no console/page errors

### 2026-06-19 Config, Telemetry, and Visual Regression Pass

- Split `GameConfig` into `SimulationConfig` and `ViewConfig`.
- Removed rendering colors from the simulation config boundary.
- Injected simulation/view config into Phaser Scene and Renderer.
- Added Zod schemas for simulation and view config validation.
- Added config schema tests for accepted defaults and rejected invalid values.
- Added `frame.raw_dt_ms` metrics while keeping simulation dt clamped to `50 ms`.
- Added `FrameSpikeReporter` to emit `performance.frame_spike` through `LoggerPort`.
- Added fixed-state Playwright screenshot comparisons for initial, shooting, and game-over frames.
- Extended the dev-only debug hook with pause and deterministic step controls.

Verification after this pass:

- `npm run test`: 7 files, 25 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 5 Playwright tests passed, including 3 visual comparisons

### 2026-06-20 Phase 1 Game Flow Foundation

- Added `paused` to `GameStatus`.
- Added `pausePressed` to `InputSnapshot`.
- Wired `P` and `Esc` through the Phaser input adapter.
- Updated `stepWorld` so pause/resume toggles are domain events and paused worlds do not advance elapsed time, movement, shooting, bullets, enemies, spawns, or cooldowns.
- Added a paused overlay to the Phaser renderer.
- Added `RunStats` to `WorldState` for shots fired, enemies killed, hits taken, damage taken, pickups collected, and upgrades chosen.
- Added `statsSystem` so run stats are derived from emitted `GameEvent`s without mixing telemetry metrics into game state.
- Added `createRunResultSummary(world)` as a pure summary function used by the Game Over renderer and debug snapshot.
- Expanded the Game Over overlay with kills, shots, and hits taken.
- Kept debug frame freeze separate from game pause, while allowing restart/pause control intents to pass through as zero-second debug steps.
- Routed debug `forceDamage` and `forceGameOver` through `GameEvent` recording so debug snapshots keep `lastEvents` and stats meaningful.
- Added simulation coverage for frozen paused state, stats updates, and result summary derivation.
- Added Playwright coverage for keyboard pause/resume.
- Added a visual regression target for the paused frame.
- Updated the Game Over visual regression target for the expanded result summary.

Verification after this pass:

- `npm run test`: 8 files, 27 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 8 Playwright tests passed, including 4 visual comparisons

### 2026-06-20 Phase 2 Enemy Variety

- Replaced the single enemy config with typed enemy definitions for `chaser`, `brute`, `fast`, and `ranged`.
- Added `EnemyTypeId`, typed enemy instances, type-specific score and contact damage, XP value, and spawn cost.
- Kept `chaser` as the existing baseline behavior.
- Added `brute` as a slower high-HP, higher-score enemy.
- Added `fast` as a low-HP, high-speed enemy unlocked later in the run.
- Added `ranged` behavior with distance management and timed enemy projectile attacks.
- Added `EnemyProjectile` state and a dedicated `enemyProjectileSystem`.
- Kept enemy projectile collision in `combatSystem`, emitting the existing `player.damaged` event for stats/result integration.
- Added type-specific enemy colors and enemy projectile rendering.
- Extended the debug snapshot with `enemyTypeCounts` and `enemyProjectileCount`.
- Added `xpValue` to enemy definitions and `xpAwarded` to enemy kill events for Phase 4 pickup/XP integration.
- Added fallback ranged projectile direction for zero-distance ranged attacks.
- Added config schema coverage for required enemy type definitions and ranged projectile config.
- Added simulation tests for enemy type selection, chaser migration, brute multi-hit kills, fast movement values, ranged projectile firing, enemy projectile damage, enemy projectile cleanup, and ranged zero-distance fallback.

Verification after this pass:

- `npm run test`: 8 files, 43 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 8 Playwright tests passed, including 4 visual comparisons

### 2026-06-20 Phase 3 Weapons and Combat Growth

- Replaced the single player bullet config with typed weapon definitions for `pulse`, `spread`, and `pierce`.
- Added `WeaponTypeId`, `defaultWeapon`, and `GameState.weaponType`.
- Kept `pulse` as the existing baseline shooting behavior.
- Added `spread` weapon support through multiple projectile directions in `shootingSystem`.
- Added `pierce` weapon support through `Bullet.pierceRemaining` and `Bullet.hitEnemyIds` in `combatSystem`.
- Added `enemy.hit` events and weapon attribution to `shot.fired` and `enemy.killed`.
- Added `RunStats.weaponMetrics` for weapon-specific shots, hits, and kills.
- Split weapon shots from projectile count so spread counts as one shot and three projectiles.
- Deep-copied nested weapon metrics in the debug snapshot.
- Kept enemy projectiles separate from player bullets.
- Added config schema coverage for required weapon definitions and invalid projectile counts.
- Added simulation tests for pulse regression, spread projectile angles, piercing multi-hit behavior, weapon attribution, and weapon metrics.

Verification after this pass:

- `npm run test`: 8 files, 43 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 8 Playwright tests passed, including 4 visual comparisons

### 2026-06-20 Phase 4 Pickups and Upgrades

- Added `upgradeSelect` as a dedicated game status.
- Added XP `Pickup` entities and pickup rendering.
- Generated XP pickups from `enemy.killed` events and applied XP only through `pickup.collected`.
- Added progression state for level, XP, XP threshold, and pending upgrade choices.
- Added upgrade definitions and Zod validation for upgrade config.
- Added `maxRank`, `weight`, and `upgradeRanks` so maxed upgrades are excluded from future choices.
- Added runtime modifiers for player speed, fire interval, projectile speed, max HP, projectile count, and pierce count.
- Applied upgrades to runtime modifiers without mutating static config.
- Emitted `upgrade.offered` and `upgrade.selected` events and derived upgrade stats from `upgrade.selected`.
- Added `1/2/3` keyboard selection while `upgradeSelect` is active.
- Added Canvas-based upgrade selection overlay with rank display.
- Hardened pickup placement with local search plus arena-wide fallback.
- Added debug hooks for `grantXp` and `forceUpgradeSelect`.
- Added simulation tests for pickup spawn/collect, obstacle-safe pickup placement, level up, upgradeSelect freeze, and upgrade application.
- Added E2E coverage for upgrade selection and a visual regression snapshot for the upgrade-select screen.

Verification after this pass:

- `npm run test`: 10 files, 54 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 10 Playwright tests passed, including 5 visual comparisons

### 2026-06-20 Phase 5 Wave Director and Balance

- Added `WaveBand` config for time-based spawn interval, speed multiplier, max enemies, spawn budget, and enemy weights.
- Added `waveDirector.ts` for selecting the current wave, exposing difficulty values, and selecting enemy types by wave weight and remaining budget.
- Updated `spawnSystem` to use the current wave and spend one spawn budget pool per spawn tick.
- Moved spawn weighting and unlock timing out of enemy definitions; enemy config now keeps static combat values plus `spawnCost`.
- Converted `difficulty.ts` into a compatibility wrapper around `getWaveDifficulty(config, elapsed)`.
- Added schema validation for first wave start, wave ordering, non-empty wave weights, and weighted enemies that cannot fit in the wave budget.
- Added wave metrics and debug snapshot wave data for balance inspection.
- Added balance simulation coverage that runs past 60 seconds and verifies late-wave population/projectile/spawn limits.
- Updated the upgrade-select visual snapshot after adding rank display.

Verification after this pass:

- `npm run test`: 10 files, 54 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 10 Playwright tests passed, including 5 visual comparisons

### 2026-06-20 Phase 6 Presentation and UX

- Added `PhaserFeedbackLayer` for adapter-side hit feedback.
- Rendered impact rings from `enemy.hit`, kill burst particles from `enemy.killed`, and damage flash/camera shake from `player.damaged`.
- Added `PhaserAudioEventRouter` for event-to-cue routing.
- Mapped shot, hit, kill, pickup, level up, upgrade, damage, and game over events to cue names.
- Kept audio hooks no-op when no audio asset is loaded, so headless E2E and builds work without sound files.
- Added feedback and audio cue snapshots to the dev-only debug API.
- Refined the HUD into compact lines for HP/LV/XP, Score/Time/Wave, and Weapon/Enemies.
- Updated Playwright E2E checks for audio cue routing and damage feedback.
- Updated visual regression snapshots for the HUD changes.

Verification after this pass:

- `npm run test`: 10 files, 54 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 10 Playwright tests passed, including 5 visual comparisons

### 2026-06-20 Phase 7 Screens and Release Shape

- Added `title` to `GameStatus`.
- Added `startPressed` and `quitToTitlePressed` to `InputSnapshot`.
- App startup now enters the title screen, while the debug `restart()` helper still enters a fresh playing run for deterministic tests.
- Added title start handling through Enter, Space, or click.
- Expanded the pause overlay into a menu state with resume, restart, and title actions.
- Updated the game-over overlay into a result screen with score, time, level, kills, shots, restart, and title affordances.
- Added `game.started` and `game.title.requested` events.
- Added simulation tests for title start, paused restart, and paused quit-to-title requests.
- Added E2E coverage for title start, pause restart, pause quit-to-title, and result restart.
- Added a title visual regression snapshot and updated pause/result snapshots.

Verification after this pass:

- `npm run test`: 10 files, 56 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 11 Playwright tests passed, including 6 visual comparisons

### 2026-06-20 Screen UX Follow-up

- Made the title screen fully opaque so the arena stage is not visible behind it.
- Added shared Phaser menu hit areas for title, pause, result, and upgrade selection screens.
- Rendered menu and upgrade choices as visible button rectangles instead of plain centered text.
- Added mouse/touch-style click handling for pause resume, pause restart, pause title, result restart, result title, title start, and upgrade selection.
- Increased menu overlay opacity so background arena elements do not compete with selectable buttons.
- Updated E2E coverage to verify click selection paths, including pause menu and upgrade selection.
- Updated visual regression snapshots for title, pause, result, and upgrade selection.

Verification after this pass:

- `npm run test`: 10 files, 56 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 11 Playwright tests passed, including 6 visual comparisons

### 2026-06-20 Balance and Aim Follow-up

- Added pickup magnet tuning to `SimulationConfig.pickup` with `magnetRadius` and `magnetSpeed`.
- Updated `pickupSystem` so nearby XP pickups move toward the player before collection checks.
- Kept pickup attraction in the simulation layer and exposed only numeric balance values through config/schema.
- Hid the browser cursor inside the Phaser canvas and rendered a custom reticle cursor.
- Replaced the short player-facing tick with an aim guide line from the player toward the current pointer position.
- Derived the rendered aim direction from pointer position when available, so paused/debug-fixed frames still show the true target direction.
- Added simulation coverage for pickup magnet movement and distance cutoff behavior.
- Added visual regression coverage for the mouse aiming cursor frame.

Verification after this pass:

- `npm run test`: 10 files, 57 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e`: 12 Playwright tests passed, including 7 visual comparisons

### 2026-06-24 v0.2 Batch A: KPI, Death Cause, and HUD

- Started v0.2 under the `Playtest & Balance Foundation` theme.
- Added `PlayerDamageSource` for contact and enemy-projectile damage.
- Added source data to simulation-origin `player.damaged` events.
- Added `damageTakenBySource` and `lastDamageSource` to run stats and result summary.
- Kept debug `forceDamage` source-less so it remains a generic debug helper.
- Added result-screen cause text when a real damage source is available.
- Split HUD rendering into `PhaserHud`.
- Replaced the dense HUD text block with HP/XP bars, wave/time/score/enemy count, and compact weapon stat labels.
- Added dev-only `setElapsed()` to the debug API for deterministic visual checks by wave band.
- Added Wave 2 and Wave 3 HUD visual regression snapshots.
- Added `balanceProbe` for deterministic balance regression tests across fixed seeds and input models.
- Added three probe input models: `noInput`, `fixedAimShoot`, and `kiteCollect`.
- The probe records survival seconds, score/min, kills/min, first damage, first upgrade, wave reached, max enemies, max bullets, max pickups, damage by source, and last damage source.
- Recorded v0.1/v0.2 Batch A baseline p50 values in `balance.test.ts` with a 20% regression window for key KPIs.
- Current `kiteCollect` baseline across 5 seeds: survival p50 101.87s, kills/min p50 164.33, score/min p50 2212.89, first damage p50 75.43s, first upgrade p50 7.13s.
- Added view-only enemy visual metadata to `ViewConfig`, keeping shape and marker choices out of simulation config.
- Drew enemies with non-color identifiers: chaser circle/ring, brute square/cross, fast diamond/slash, ranged hex/dot.
- Drew enemy projectiles as stroked diamonds with a bright core so they do not read as player bullets or XP pickups.
- Added a dev-only enemy visual fixture for deterministic Wave 2 and Wave 3 visual regression frames.
- Added `SIMULATION_CONFIG_VERSION` for playtest report traceability.
- Added dev-only `getRunExport()` and `getRunExportJson()` to capture run metadata, result summary, stats, entity counts, runtime, upgrade ranks, and recent events.
- Added `docs/22-phaser-v02-playtest-template.md` for single-run recording, timeline notes, friction ratings, and 3-run comparison.
- Added E2E coverage for debug run export metadata and KPI fields.
- Split wave pressure into four bands: 0s learning, 30s fast/brute priority, 60s ranged introduction, and 90s endurance pressure.
- Tuned Wave 2 to `spawnInterval 0.78`, `speedMultiplier 1.14`, `maxEnemies 42`.
- Tuned Wave 3 to `spawnInterval 0.68`, `speedMultiplier 1.22`, `maxEnemies 50`, with lower ranged weight.
- Kept Wave 4 as the high-pressure all-enemy band at 90s.
- Added wave-boundary damage tracking to `balanceProbe`.
- Added a Wave 4 visual regression frame for the new endurance band.
- Updated balance baseline after wave review: `kiteCollect` survival p50 119.40s, kills/min p50 161.84, score/min p50 2245.73, first damage p50 73.53s, wave reached p50 90s.
- Added `docs/23-phaser-v02-wave-curve-review.md` for the curve rationale and boundary damage review.
- Changed `circleRect` so tangent contact is not treated as obstacle overlap, allowing wall-adjacent sliding while still blocking real overlap.
- Added simulation coverage for vertical and diagonal sliding along obstacle faces.
- Added dev-only `setObstacleFrictionFixture()` for deterministic obstacle friction checks.
- Added `obstacleContacts` to debug snapshot and run export so playtest notes can identify actual obstacle overlap.
- Added E2E coverage for sliding along an obstacle edge through the debug fixture.
- Added `docs/24-phaser-v02-obstacle-friction-audit.md` with findings and residual risks.
- Added `upgradePreview` to compute current-vs-after values for every upgrade effect.
- Updated upgrade buttons to show compact comparison text such as `Move speed: 240 -> 269`.
- Increased upgrade choice button height so 3 candidates fit with title, description, and preview line.
- Added unit coverage for upgrade previews and updated upgrade visual regression.

Verification after this pass:

- `npm run test`: 11 files, 67 tests passed
- `npm run test -- src/simulation/balance.test.ts src/simulation/waveDirector.test.ts src/simulation/difficulty.test.ts`: 10 files, 59 tests passed
- `npm run test -- src/math/geometry.test.ts src/simulation/stepWorld.test.ts`: 10 files, 62 tests passed
- `npm run test -- src/simulation/upgradePreview.test.ts`: 11 files, 67 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed, with the existing Phaser bundle size warning
- `npm run test:e2e -- tests/e2e/arena.spec.ts`: 7 Playwright tests passed
- `npm run test:e2e -- tests/e2e/arena-visual.spec.ts --update-snapshots=all`: 10 Playwright tests passed
- `npm run test:e2e`: 17 Playwright tests passed

### 2026-06-24 v0.3 Healing Pickup Foundation

- Added heal pickups alongside existing XP pickups.
- Extended pickup config with heal radius, drop chance, pity threshold/bonus/cap, max-HP-based heal amount, lifetime, and enemy-type multipliers.
- Implemented deterministic heal drop rolls from `seed`, `enemyId`, `enemyType`, and `healDropRollIndex`, without consuming the main `RandomSource`.
- Added runtime `healDropMissCount` and `healDropRollIndex`.
- Kept drop/spawn/lifetime/collection logic inside `pickupSystem`; combat only emits kill events.
- Added existing-pickup overlap checks to pickup placement so same-kill XP+heal drops do not stack.
- Added heal lifetime expiration through `pickup.expired`; XP remains long-lived.
- Added the fatal-frame guard: if HP is already 0 after combat, pickup collection does not run that frame.
- Added run stats and result/debug export fields: `hpRecovered`, `healPickupsCollected`, and `effectiveHealPickupsCollected`.
- Added heal KPIs to `balanceProbe` and updated the v0.3 balance baseline.
- Drew heal pickups as white medkit-style items with a red cross, distinct from green XP and pink enemy projectiles.
- Added dev-only `setHealPickupFixture()` for damaged, full-HP, fatal-frame, and visual-regression scenarios.
- Updated the result screen with recovered HP and heal pickup counts.
- Updated `appVersion` to `0.3` and `SIMULATION_CONFIG_VERSION` to `phaser-v0.3-healing-pickup-foundation`.

Balance probe after this pass:

- `kiteCollect` survival p50: 110.8s
- `kiteCollect` kills/min p50: 153.25
- `kiteCollect` score/min p50: 2082.13
- `kiteCollect` first damage p50: 79.87s
- `kiteCollect` hp recovered p50: 60
- `kiteCollect` heal pickups collected p50: 18
- `kiteCollect` effective heal pickups collected p50: 5
- No probe violations.

Verification after this pass:

- `npm run typecheck`: passed
- `npm test -- --run`: 11 files, 78 tests passed
- `npm run test:e2e -- tests/e2e/arena-visual.spec.ts --update-snapshots=all`: 11 Playwright tests passed and regenerated intended visual snapshots
- `npm run test:e2e`: 21 Playwright tests passed
- `npm run build`: passed, with the existing Phaser bundle size warning

### 2026-07-10 v0.5 Endless Polish and Run Records

- Added versioned `RunRecord`, `RunContext`, comparison keys, rank eligibility, and Zod validation.
- Added Phaser-independent record generation, ranking, personal-best selection, and exact-once finalization.
- Added separate local history and ranking retention so an old best survives after leaving the newest 50 runs.
- Added guest profile and settings stores under separate versioned browser keys.
- Added result, history, local ranking, settings, and revised title screens.
- Added keyboard focus, Escape navigation, pointer cursor affordances, and left-button-only menu/shoot actions.
- Split the HUD into fixed left and right panels and removed low-priority projectile details from constant display.
- Added configurable feedback limits, recovery/level effects, fatal-flash cleanup, and personal-best celebration.
- Added one generated 32-second, four-section loop BGM and 15 generated SFX files across eight cue types, with deterministic regeneration and a repository asset ledger.
- Added round-robin sound variants and small detune changes for frequent shot, hit, kill, pickup, and damage cues after manual feedback found the first pass too repetitive.
- Added a dedicated music controller with title/play/pause/game-over transitions and browser audio-lock handling.
- Split dev exports into `logs/runs`, `logs/debug`, and `logs/tests`, with validation, a 2 MiB limit, and per-origin retention.
- Added automated storage corruption/quota checks, individual clears, mobile fit checks, and 18 visual regression states.
- Added a 900-second accelerated soak covering 27,000 simulation frames and bounded entity counts.
- Updated package version to `0.5.0`; gameplay ruleset remains `phaser-v0.4-endless-pressure`.

Verification:

- Unit tests: 18 files and 121 tests passed.
- Typecheck and production build passed, with the known bundle-size warning.
- Playwright: 25 functional tests and 18 visual tests passed (43 regular tests); the optional 15.1-minute browser soak also passed.
- Starlight: 70 pages built successfully.
- Legacy v0.4 manual logs cover 63s, 132s, 146s, 377s, and 882s runs, but do not contain the v0.5 ruleset key and are not migrated into the new ranking history.
- Three v0.5 manual runs cover 98s / 3211 points, 178s / 8196 points, and 272s / 14172 points. Browser history, rankings, and dev logs contain the same three eligible records.
- Five legacy sub-second logs were moved from `logs/runs` to `logs/debug`.
- The known Phaser bundle-size warning remains.
- PH-V05-011 is complete after the manual runs, UI/control review, audio revision, and final regression pass.

## 1. phaser

### Baseline Impression

Phaser is a strong baseline for this comparison. The engine structure maps directly to the required game loop.

### What Carried Over

Nothing; this is the first implementation.

### What Did Not Carry Over

Nothing.

### Library-Specific Friction

The main choice was whether to use Arcade Physics. Manual collision made the implementation more portable for later comparisons.

### Bugs or Detours

No major detours during initial implementation.

### Next Implementation Notes

For Excalibur, compare whether Actor/Collider abstractions make the same game clearer or heavier than Phaser's simple Scene + Graphics baseline.
