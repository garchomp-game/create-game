# Implementation Notes

## Target

- Folder: `kaplay`
- Library/Engine: KAPLAY
- Language: JavaScript
- Build tool: Vite
- Implementation order: 3

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`

## What Works

- Player movement: KAPLAY key state with manual movement
- Aiming: KAPLAY mouse position
- Shooting: left click and `Space`
- Enemy spawning: seeded edge spawns
- Enemy chasing: direct normalized movement
- Bullet/enemy collision: manual circle/circle
- Enemy/player damage: manual circle/circle with cooldown
- Obstacles: KAPLAY rect objects plus manual circle/AABB blocking
- HUD: KAPLAY `text`
- Game over/restart: KAPLAY `text` overlay and `R` reset

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |
| Collision | Library or manual collision allowed | Manual collision with KAPLAY visual objects | Manual checks preserved parity with Phaser and avoided component-specific collision lifecycle complexity. |

## Carryover From Previous Implementations

- Reused concepts: Phaser/Excalibur update order, state object, seeded spawns, collision helpers
- Reused constants: all shared gameplay constants
- Reused code patterns: manual arrays, object sync from state to visual objects
- Things deliberately not reused: Excalibur DOM HUD detour; KAPLAY text objects are sufficient

## Library Fit

### Easy

Adding visual game objects is concise. `onUpdate`, `text`, `circle`, `rect`, and input helpers are direct for a small prototype.

### Hard

Keeping custom state objects synchronized with KAPLAY objects adds a small amount of glue. A deeper KAPLAY component approach might reduce this but would diverge from the baseline.

### Surprising

KAPLAY's API makes the first playable version compact, but precise parity still benefits from manual logic.

## AI Implementation Notes

- Setup friction: low
- API friction: moderate; KAPLAY naming is simple, but exact current option names need verification
- Collision/physics friction: low with manual collision
- Debugging friction: low
- Code organization: one file is still manageable
- Risk of outdated knowledge: moderate because KAPLAY evolved from Kaboom-style APIs

## Known Issues

- The implementation does not lean fully into KAPLAY collision components.
- Enemy obstacle handling remains simple.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: no page errors; Chrome reported WebGL GPU stall warnings during screenshot readback

## 3. kaplay

### Baseline Impression

KAPLAY should be faster to sketch than Phaser or Excalibur, especially for primitive objects and text.

### What Carried Over

Most of the game-state logic and constants carried over.

### What Did Not Carry Over

Scene class structure did not carry over. KAPLAY uses a flat function-oriented setup.

### Library-Specific Friction

KAPLAY object creation is concise, but reliable embedding was clearer when an existing `<canvas>` was passed with the `canvas` option instead of relying on root insertion.

### Bugs or Detours

The first version used `root` only; headless screenshots showed a background-only page. Passing an explicit canvas fixed the display.

### Next Implementation Notes

Kontra will likely require even more manual drawing and collision, so compare whether KAPLAY's object helpers materially reduce code.
