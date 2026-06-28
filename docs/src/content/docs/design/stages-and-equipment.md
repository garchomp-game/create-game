---
title: Stages and Equipment
description: v0.5以降のstage、equipment、meta progressionの整理。
---

## Stage

stageは `StageDefinition` としてdata化します。

想定field:

- `id`
- `title`
- `arena`
- `obstacles`
- `waves`
- `enemyPool`
- `unlock`

最初の目標は、既存arenaを `default` stageとして表現することです。

## Equipment

run開始前に選ぶ要素です。

最初は1 slotだけで始めます。

候補:

- 初期武器
- core module
- movement module
- pickup module

装備は単純な上位互換ではなく、強みと弱みを持たせます。

## Meta Progression

最初はlocalStorage保存でよいです。

保存対象候補:

- unlock state
- profile stats
- settings
- selected stage
- selected equipment

save schemaにはversionとreset導線を持たせます。
