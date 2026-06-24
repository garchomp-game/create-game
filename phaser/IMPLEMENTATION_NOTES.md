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
- Shooting: left click and `Space`, with shared cooldown
- Enemy spawning: deterministic seeded spawns from arena edges
- Enemy chasing: direct normalized movement toward player
- Bullet/enemy collision: manual circle/circle
- Enemy/player damage: manual circle/circle with shared damage cooldown
- Obstacles: manual circle/AABB blocking
- HUD: Phaser `Text`
- Game over/restart: `GAME OVER` overlay and `R` reset
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
- Audio hooks: adapter-side cue routing with no-op behavior when assets are absent
- Refined HUD: HP/LV/XP, score/time/wave, weapon/enemy count
- Title screen: app startup begins at title and starts with one action
- Pause menu: resume, restart, and title return
- Result screen: score, time, level, kills, shots, restart/title flow

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
- Code organization: one Scene file is readable at this scope
- Risk of outdated knowledge: moderate around optional Phaser physics APIs, low for core Scene usage

## Known Issues

- Enemy obstacle avoidance is intentionally simple and may cause brief clustering near obstacles.
- Pointer aiming follows Phaser's scaled pointer coordinate behavior; verified at the fixed logical canvas size.

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
