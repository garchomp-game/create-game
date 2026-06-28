---
title: "Legacy: Arena Core"
description: "Migrated from README.md."
---

> Source: `README.md`

# Arena Core

Browser game library comparison workspace.

This repository compares browser-friendly game libraries and engines by building the same small arena survival game, `Arena Core`, in each project folder.

## Current Version

- `v0.1`: Phaser implementation refined into the current playable baseline.

## Projects

| Folder | Library / Engine |
| --- | --- |
| `phaser` | Phaser |
| `excalibur` | Excalibur.js |
| `kaplay` | KAPLAY |
| `kontra` | Kontra.js |
| `melonjs` | melonJS |
| `pixijs-matter` | PixiJS + Matter.js |
| `threejs-rapier` | Three.js + Rapier |
| `babylonjs` | Babylon.js |
| `playcanvas` | PlayCanvas |

## Phaser v0.1

```bash
cd phaser
npm install
npm run dev
```

Quality checks:

```bash
cd phaser
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

Design notes and comparison criteria are in [`docs/README.md`](docs/README.md).

## Restarting A New Session

If a new AI session needs to continue game development, start with:

- [`AGENTS.md`](AGENTS.md)
- [`docs/28-session-restart-guide.md`](docs/28-session-restart-guide.md)

The unrelated `ikiiki-project` work has been moved out of this repository context.
