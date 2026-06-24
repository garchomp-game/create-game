# Implementation Notes

## Target

- Folder: `babylonjs`
- Library/Engine: Babylon.js
- Language: JavaScript
- Build tool: Vite
- Implementation order: 8

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`

## What Works

- Player movement: manual movement with Babylon mesh sync
- Aiming: pointer mapped to x/z arena coordinates
- Shooting: Babylon sphere bullets
- Enemy spawning: seeded edge spawns
- Enemy chasing: direct normalized movement
- Bullet/enemy collision: manual circle/circle
- Enemy/player damage: manual circle/circle with cooldown
- Obstacles: Babylon box meshes and manual circle/AABB blocking
- HUD: DOM overlay
- Game over/restart: DOM overlay and `R` reset

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |
| Physics | Optional | Manual collision, no physics plugin | Keeps Babylon setup focused and comparable to the manual 3D rendering path. |

## Carryover From Previous Implementations

- Reused concepts: Three.js x/z mapping, DOM HUD, manual bullets, seeded spawns
- Reused constants: all shared gameplay constants
- Reused code patterns: manual 2D logic rendered as 3D meshes
- Things deliberately not reused: Rapier body/mesh synchronization

## Library Fit

### Easy

Babylon's Engine/Scene/MeshBuilder path makes a complete 3D scene quick to assemble.

### Hard

Camera orientation and orthographic top-down mapping still require care.

### Surprising

Without physics, Babylon feels simpler than Three + Rapier for this exact arcade-style prototype.

## AI Implementation Notes

- Setup friction: low to moderate
- API friction: moderate around camera constants and mesh rotation
- Collision/physics friction: low with manual collision
- Debugging friction: moderate
- Code organization: comparable to Three but without physics state
- Risk of outdated knowledge: moderate because Babylon camera/engine APIs are broad

## Known Issues

- Physics plugin is not exercised.
- Enemy obstacle handling remains simple.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: no page errors; Chrome reported WebGL readback warnings during screenshot sampling

## 8. babylonjs

### Baseline Impression

Babylon gives more integrated scene setup than raw Three.js, but the game logic is still custom.

### What Carried Over

The 3D x/z mapping and DOM HUD approach carried over from Three.js + Rapier.

### What Did Not Carry Over

Rapier physics did not carry over. Movement and collision returned to the manual baseline.

### Library-Specific Friction

The main friction is camera orientation and keeping the top-down projection readable.

### Bugs or Detours

No runtime errors after implementation. Bundle size is notably large with the direct `@babylonjs/core` import path.

### Next Implementation Notes

PlayCanvas should be compared on code-first ergonomics against Babylon's direct scene construction.
