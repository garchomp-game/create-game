---
title: "Legacy: Arena Core Session Context"
description: "Migrated from .CLAUDE.md."
---

> Source: `.CLAUDE.md`

# Arena Core Session Context

This file is a short handoff for tools that look for a project-local Claude-style context file.

## What This Project Is

`create-game` is for browser game library comparison and the playable Phaser version of `Arena Core`.

It is not for the `ikiiki-project` work. That project now lives at:

```text
/home/garchomp-game/workspace/available/projects/ikiiki-project
```

## Start Here

Read:

1. `docs/28-session-restart-guide.md`
2. `docs/27-phaser-v03-next-actions-backlog.md`
3. `phaser/README.md`

Then inspect:

```bash
git status -sb
git log --oneline --decorate -12
```

## Active Work

Active focus is Phaser v0.3:

- healing pickup foundation is already implemented
- next task is manual playtest and balance review
- item system design should come after healing pickup review

Avoid starting Starlight docs or unrelated project cleanup unless explicitly asked.

## Useful Commands

```bash
cd phaser
npm run dev
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
```
