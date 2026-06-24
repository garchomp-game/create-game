# Implementation Notes

## Target

- Folder: `melonjs`
- Library/Engine: melonJS
- Language: JavaScript
- Build tool: Vite
- Implementation order: 5

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`

## What Works

- Player movement: melonJS input bindings
- Aiming: melonJS pointer coordinates
- Shooting: `Space` and left pointer mapped to the shoot action
- Enemy spawning: seeded edge spawns
- Enemy chasing: direct normalized movement
- Bullet/enemy collision: manual circle/circle
- Enemy/player damage: manual circle/circle with cooldown
- Obstacles: melonJS renderer rectangles with manual circle/AABB blocking
- HUD: Canvas text through melonJS CanvasRenderer context
- Game over/restart: Canvas overlay and `R` reset

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |

## Carryover From Previous Implementations

- Reused concepts: shared state object, manual collision helpers, seeded spawns
- Reused constants: all shared gameplay constants
- Reused code patterns: Kontra-style direct Canvas drawing concept, adapted to melonJS renderer
- Things deliberately not reused: direct manual loop outside an engine lifecycle

## Library Fit

### Easy

The `Application` + `Stage` + `Renderable` flow provides a clear engine lifecycle once the current API is identified.

### Hard

melonJS has more framework surface than Kontra/KAPLAY. The modern `Application` API and legacy `video.init` API coexist, so choosing the current path requires care.

### Surprising

The renderer API is close enough to Canvas that the Kontra drawing code translated well.

## AI Implementation Notes

- Setup friction: moderate
- API friction: moderate; current and legacy examples coexist
- Collision/physics friction: low with manual collision, untested for melonJS physics
- Debugging friction: moderate; engine lifecycle adds more moving parts
- Code organization: one Renderable inside one Stage keeps the prototype contained
- Risk of outdated knowledge: high enough to verify against installed types

## Known Issues

- This implementation does not exercise melonJS tilemap or physics systems.
- Enemy obstacle handling remains simple.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: none in smoke test

## 5. melonjs

### Baseline Impression

melonJS feels more engine-like than Kontra but heavier to orient initially.

### What Carried Over

The manual logic, renderer-style drawing, and input-state flow carried over from Kontra.

### What Did Not Carry Over

Kontra's direct loop did not carry over; melonJS wanted an Application/Stage/Renderable lifecycle.

### Library-Specific Friction

The main friction was identifying the modern Application entry point and fitting the prototype into the Stage lifecycle.

### Bugs or Detours

No runtime detours after aligning to `Application`; build and smoke test passed.

### Next Implementation Notes

PixiJS + Matter.js should be compared against melonJS on the cost of combining rendering and collision/physics responsibilities.
