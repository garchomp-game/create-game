# Implementation Notes

## Target

- Folder: `pixijs-matter`
- Library/Engine: PixiJS + Matter.js
- Language: JavaScript
- Build tool: Vite
- Implementation order: 6

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`

## What Works

- Player movement: keyboard state drives Matter player velocity
- Aiming: pointer converted to logical canvas coordinates
- Shooting: Matter sensor bullets rendered by Pixi
- Enemy spawning: seeded edge spawns
- Enemy chasing: Matter enemy velocity toward player
- Bullet/enemy collision: Matter collision events
- Enemy/player damage: manual distance check with Matter body positions
- Obstacles: Matter static rectangles rendered by Pixi
- HUD: DOM overlay
- Game over/restart: DOM overlay and `R` reset

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |
| Collision | Either library or manual | Mixed Matter events and manual player contact check | Matter events are used for bullet/obstacle/enemy collisions; player damage cooldown is clearer as a distance check. |

## Carryover From Previous Implementations

- Reused concepts: state machine, constants, difficulty, seeded spawns, HUD format
- Reused constants: all shared gameplay constants
- Reused code patterns: input state and draw loop structure
- Things deliberately not reused: manual obstacle collision for player/enemies, replaced with Matter bodies

## Library Fit

### Easy

Pixi's Graphics API is concise for primitive rendering. Matter static obstacles and dynamic circles mapped well to the prototype.

### Hard

The main cost is keeping Matter bodies, gameplay metadata, and Pixi rendering synchronized.

### Surprising

Matter is useful for obstacle blocking, but the arcade-style damage and bullet removal still needed explicit gameplay rules.

## AI Implementation Notes

- Setup friction: low
- API friction: moderate; Pixi v8 graphics chaining and Matter body metadata both need care
- Collision/physics friction: moderate
- Debugging friction: moderate due to two systems
- Code organization: one file is workable but denser than Kontra/melonJS
- Risk of outdated knowledge: moderate for Pixi v8 API changes

## Known Issues

- Player/enemy contact damage is manual rather than a Matter collision event.
- Enemy pathing can still push into obstacles because it is not pathfinding.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: no page errors; Chrome reported WebGL GPU stall warnings during screenshot readback

## 6. pixijs-matter

### Baseline Impression

Pixi + Matter is more flexible than the engine-style implementations but requires explicit synchronization.

### What Carried Over

The game constants, state machine, spawn logic, and HUD structure carried over.

### What Did Not Carry Over

Manual obstacle blocking was replaced with Matter bodies and engine stepping.

### Library-Specific Friction

The main friction is syncing physics state, gameplay metadata, and rendering.

### Bugs or Detours

The first version treated Matter velocity as pixels per second, which made enemies reach the player almost immediately. Velocities are now converted to a fixed 1/60 simulation step and `Engine.update` uses a fixed 16.67ms step.

### Next Implementation Notes

Three.js + Rapier should feel similar in split responsibility, but with the additional 2D-to-3D coordinate mapping burden.
