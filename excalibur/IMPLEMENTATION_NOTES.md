# Implementation Notes

## Target

- Folder: `excalibur`
- Library/Engine: Excalibur.js
- Language: JavaScript
- Build tool: Vite
- Implementation order: 2

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`

## What Works

- Player movement: implemented with Excalibur keyboard state
- Aiming: implemented with Excalibur pointer world positions
- Shooting: left click and `Space`
- Enemy spawning: seeded edge spawns
- Enemy chasing: direct normalized movement
- Bullet/enemy collision: manual circle/circle
- Enemy/player damage: manual circle/circle with cooldown
- Obstacles: manual circle/AABB
- HUD: Excalibur graphics context text
- Game over/restart: `R` resets the scene state

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |
| Actor model | Excalibur actors may be used | Plain state objects rendered in one Scene | This isolates Excalibur's loop/input/drawing fit without adding Actor lifecycle overhead. |

## Carryover From Previous Implementations

- Reused concepts: Phaser baseline state machine, constants, update order, collision helpers
- Reused constants: all shared gameplay constants
- Reused code patterns: manual bullets/enemies arrays and seeded spawn logic
- Things deliberately not reused: Phaser-specific `Graphics` and `Text` objects

## Library Fit

### Easy

The `Engine` and `Scene` lifecycle map cleanly to the same game loop as Phaser. Keyboard state and pointer world positions are direct enough.

### Hard

Direct drawing through `ExcaliburGraphicsContext` required more API-specific care than Phaser's `Graphics`. Text drawing is more verbose.

### Surprising

For this simple graphics-heavy prototype, Excalibur's Actor system was not obviously necessary. The engine can still host a manual state implementation.

## AI Implementation Notes

- Setup friction: low
- API friction: moderate around direct drawing calls
- Collision/physics friction: avoided by manual collision
- Debugging friction: low for state, moderate for graphics signatures
- Code organization: one custom Scene is acceptable
- Risk of outdated knowledge: moderate; Excalibur graphics APIs have evolved

## Known Issues

- Actor/collider integration is intentionally not used, so this is not a full test of Excalibur's collision system.
- Enemy obstacle handling remains the same simple baseline.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: no page errors; Chrome reported WebGL context lost warnings on shutdown

## 2. excalibur

### Baseline Impression

Excalibur feels structured and engine-like, but direct custom drawing is less terse than Phaser.

### What Carried Over

The Phaser baseline's game state, timers, collision helpers, and spawn rules carried over almost directly.

### What Did Not Carry Over

Phaser's immediate `Graphics` API and text objects did not carry over. Excalibur's graphics context needed its own draw method signatures.

### Library-Specific Friction

The main friction was choosing between the Actor/Collider model and a manual Scene renderer. Manual rendering was faster for parity, but less representative of full Excalibur style.

### Bugs or Detours

The initial text drawing used an outdated `ex.Font.from` pattern. Current Excalibur did not expose that helper, so HUD rendering moved to DOM while the game world remains in Excalibur's canvas.

### Next Implementation Notes

For KAPLAY, try leaning more into the library's component-style API instead of carrying over a single manual renderer too strongly.
