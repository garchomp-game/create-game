# Implementation Notes

## Target

- Folder: `kontra`
- Library/Engine: Kontra.js
- Language: JavaScript
- Build tool: Vite
- Implementation order: 4

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`

## What Works

- Player movement: Kontra keyboard helper
- Aiming: Kontra pointer helper
- Shooting: pointer and `Space`
- Enemy spawning: seeded edge spawns
- Enemy chasing: direct normalized movement
- Bullet/enemy collision: manual circle/circle
- Enemy/player damage: manual circle/circle with cooldown
- Obstacles: manual Canvas rectangles and circle/AABB collision
- HUD: Canvas text
- Game over/restart: Canvas overlay and `R`

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |
| Entity abstraction | Library objects may be used | Plain objects plus Kontra loop/input | Kontra is intentionally lightweight, so manual state was the clearest fit. |

## Carryover From Previous Implementations

- Reused concepts: shared state object, manual collisions, seeded spawning, update order
- Reused constants: all shared gameplay constants
- Reused code patterns: most manual logic from Phaser/KAPLAY
- Things deliberately not reused: KAPLAY display objects and text components

## Library Fit

### Easy

Kontra made initialization, loop timing, keyboard, and pointer access simple.

### Hard

Everything beyond the loop and input is essentially custom Canvas game code.

### Surprising

The result is very transparent and debuggable, but it does not feel like a full game engine.

## AI Implementation Notes

- Setup friction: low
- API friction: low
- Collision/physics friction: manual, but predictable
- Debugging friction: low
- Code organization: plain Canvas code grows quickly
- Risk of outdated knowledge: low to moderate; API surface is small

## Known Issues

- No Kontra Sprite abstraction is used for entities.
- Enemy obstacle handling remains simple.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: none in smoke test

## 4. kontra

### Baseline Impression

Kontra is the lightest so far. It is good for direct control but provides less game-specific structure.

### What Carried Over

Almost all manual game logic from previous implementations carried over.

### What Did Not Carry Over

KAPLAY's object/component helpers did not carry over. Canvas drawing is explicit.

### Library-Specific Friction

The game becomes custom Canvas code quickly. Kontra provides the loop and input helpers, but almost all gameplay structure is manual.

### Bugs or Detours

The first version incorrectly called `pointer.pressed("left")`; current Kontra exposes this as the module function `pointerPressed("left")`.

### Next Implementation Notes

melonJS should be compared against Kontra as a more engine-like HTML5 option with more built-in structure.
