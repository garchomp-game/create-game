# Implementation Notes

## Target

- Folder: `threejs-rapier`
- Library/Engine: Three.js + Rapier
- Language: JavaScript
- Build tool: Vite
- Implementation order: 7

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`

## What Works

- Player movement: Rapier dynamic body with Three mesh sync
- Aiming: pointer mapped to x/z arena coordinates
- Shooting: Three bullet meshes with manual movement
- Enemy spawning: seeded edge spawns
- Enemy chasing: Rapier dynamic bodies
- Bullet/enemy collision: manual sphere distance using Rapier body positions
- Enemy/player damage: manual sphere distance with cooldown
- Obstacles: Rapier fixed cuboids and Three box meshes
- HUD: DOM overlay
- Game over/restart: DOM overlay and `R` reset

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |
| Bullet physics | Physics engine can be used | Bullet movement is manual | Keeps projectile behavior close to previous implementations and avoids sensor event setup cost. |

## Carryover From Previous Implementations

- Reused concepts: Pixi+Matter split between rendering and physics state
- Reused constants: all shared gameplay constants
- Reused code patterns: DOM HUD, manual bullet combat, seeded spawns
- Things deliberately not reused: 2D canvas coordinate assumptions; `y` maps to 3D `z`

## Library Fit

### Easy

Three.js makes primitive 3D visualization straightforward once the camera mapping is fixed.

### Hard

The x/z mapping and mesh/body synchronization add more cognitive load than 2D libraries.

### Surprising

Rapier's velocity units fit the shared px/sec constants more naturally than Matter's step-based velocity behavior.

## AI Implementation Notes

- Setup friction: moderate due to async Rapier initialization
- API friction: moderate
- Collision/physics friction: moderate
- Debugging friction: moderate; body and mesh state must be checked together
- Code organization: denser than 2D implementations
- Risk of outdated knowledge: moderate for Rapier JS API details

## Known Issues

- Bullets are not Rapier bodies.
- Enemy pathing remains direct pursuit, so obstacles can cause clustering.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: no page errors; Chrome reported a non-fatal deprecated initialization warning and WebGL readback warnings

## 7. threejs-rapier

### Baseline Impression

Three.js + Rapier brings real 3D flexibility but the implementation burden is clearly higher than 2D engines.

### What Carried Over

The Pixi+Matter split responsibility model carried over conceptually.

### What Did Not Carry Over

2D rendering assumptions did not carry over. Camera setup and x/z mapping are new concerns.

### Library-Specific Friction

The main friction is keeping Three meshes and Rapier bodies synchronized while preserving the 2D game rules.

### Bugs or Detours

No runtime errors after implementation. The smoke test reports a non-fatal deprecated initialization warning from the WebGL/Rapier stack.

### Next Implementation Notes

Babylon.js should be compared on how much of this setup is handled by a more integrated 3D engine.
