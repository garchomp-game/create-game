# Implementation Notes

## Target

- Folder: `playcanvas`
- Library/Engine: PlayCanvas
- Language: JavaScript
- Build tool: Vite
- Implementation order: 9

## Setup

- Install: `npm install`
- Run: `npm run dev`
- Build: `npm run build`

## What Works

- Player movement: manual movement synced to PlayCanvas entities
- Aiming: pointer mapped to x/z arena coordinates
- Shooting: PlayCanvas sphere bullets
- Enemy spawning: seeded edge spawns
- Enemy chasing: direct normalized movement
- Bullet/enemy collision: manual circle/circle
- Enemy/player damage: manual circle/circle with cooldown
- Obstacles: PlayCanvas box entities and manual circle/AABB blocking
- HUD: DOM overlay
- Game over/restart: DOM overlay and `R` reset

## Deviations From Shared Spec

| Spec | Expected | Actual | Reason |
| --- | --- | --- | --- |

## Carryover From Previous Implementations

- Reused concepts: Babylon x/z mapping, DOM HUD, manual collisions
- Reused constants: all shared gameplay constants
- Reused code patterns: manual 2D logic rendered as 3D meshes/entities
- Things deliberately not reused: Babylon-specific MeshBuilder and camera setup

## Library Fit

### Easy

The README example maps cleanly to a code-first setup. Entity creation and render components are straightforward.

### Hard

PlayCanvas is broad and editor-oriented, so code-first discovery takes more orientation than Babylon or Three.

### Surprising

The minimal code-first path works well enough without the editor, but bundle size and API surface are still substantial.

## AI Implementation Notes

- Setup friction: moderate
- API friction: moderate; the README was useful and current
- Collision/physics friction: low with manual collision, untested for built-in physics
- Debugging friction: moderate
- Code organization: similar to Babylon once Entity helper functions exist
- Risk of outdated knowledge: moderate

## Known Issues

- Built-in physics was not exercised.
- Enemy obstacle handling remains simple.

## Verification

- Browser: Google Chrome headless via Playwright Core
- Manual test duration: automated smoke test with movement and shooting input
- Console errors: no page errors; Chrome reported WebGL readback warnings during screenshot sampling

## 9. playcanvas

### Baseline Impression

PlayCanvas is viable code-first, but it feels more oriented around a full engine/editor workflow than this small prototype needs.

### What Carried Over

Babylon's x/z mapping, DOM HUD, manual collision, and helper functions carried over well.

### What Did Not Carry Over

Babylon's direct MeshBuilder API did not carry over; PlayCanvas wants Entity + render component setup.

### Library-Specific Friction

The main friction was orienting around PlayCanvas's larger API surface while staying code-first.

### Bugs or Detours

No runtime errors after implementation. Bundle size is large compared with 2D libraries.

### Next Implementation Notes

Use this implementation to close the sequential comparison and then produce an overall summary.
