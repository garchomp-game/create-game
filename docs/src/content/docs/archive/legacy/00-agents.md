---
title: "Legacy: Arena Core Agent Guide"
description: "Migrated from AGENTS.md."
---

> Source: `AGENTS.md`

# Arena Core Agent Guide

This repository is the browser game comparison and Phaser game development workspace.

## Session Entry

When starting a new game-development session, read these files first:

1. `docs/28-session-restart-guide.md`
2. `docs/27-phaser-v03-next-actions-backlog.md`
3. `phaser/README.md`
4. `docs/26-phaser-v03-healing-pickup-design.md`

Do not continue from unrelated project context. The `ikiiki-project` work was moved to:

```text
/home/garchomp-game/workspace/available/projects/ikiiki-project
```

## Current Focus

The active game work is the Phaser implementation of `Arena Core`.

Current direction:

- Treat `v0.1` as the published baseline tag.
- Local `main` is ahead of `origin/main` with Phaser v0.2/v0.3 work.
- `PH-V03-001 Healing Pickup Foundation` is implemented.
- Next priority is playtest and balance review before adding more items.

## How To Run Phaser

```bash
cd phaser
npm run dev
```

Quality checks:

```bash
cd phaser
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
```

Known build note:

- `npm run build` may emit a Phaser/Vite bundle size warning. Treat it as a known warning unless the build fails.

## Engineering Rules

- Keep Phaser in `src/adapters/phaser`.
- Keep game state and rules in `src/simulation`, `src/domain`, `src/config`, `src/math`, and `src/format`.
- Do not add Phaser dependencies to simulation/domain code.
- Prefer small balance changes backed by tests or playtest notes.
- For UI/visual changes, use Playwright or screenshots where practical.
- Preserve existing docs and ticket numbering. Add the next doc number for new planning files.

## Current Product Rules

- Do not add multiple new item types at once.
- Do not tune heal pickup before recording v0.3 playtest evidence.
- Do not use balanceProbe as a substitute for human playtest comfort.
- Keep debug export and result metrics aligned with gameplay changes.

## Git Notes

- The repository may be ahead of `origin/main`.
- Do not rewrite history unless explicitly requested.
- Keep unrelated local documents out of the project root to avoid test/spellcheck noise.
