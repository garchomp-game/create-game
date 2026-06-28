---
title: "Legacy: Phaser Long-Term Replayability Requirements"
description: "Migrated from docs/36-phaser-long-term-replayability-requirements.md."
---

> Source: `docs/36-phaser-long-term-replayability-requirements.md`

# Phaser Long-Term Replayability Requirements

作成日: 2026-06-29

## 1. Purpose

このドキュメントは、v0.5以降で検討するやりこみ要素、ステージ化、装備、アップグレード、ランダム性の要件メモである。

詳細設計や実装指示ではなく、今後のPM判断、チケット分解、サブエージェント指示の前段として使う。

現在の優先度は、v0.4で操作性と障害物体験を整えることにある。その後に長期やりこみ要素へ広げる。

## 2. Product Direction

基本方針:

- 課金なしのFree-to-Playとして成立させる。
- やりこみは、課金導線ではなくプレイ継続、上達、選択肢の解放で作る。
- 1 runの実力要素は残しつつ、毎回同じにならない変化を持たせる。
- 恒久強化だけで難易度を潰さず、装備や解放要素はプレイスタイルの幅を増やす方向に寄せる。
- 詳細なcontent量産より先に、stage / equipment / random modifierをデータ化できる土台を作る。

## 3. Non Goals

この段階では以下を扱わない。

- 課金、ガチャ、広告、ログイン、バックエンド。
- オンラインランキング、クラウドセーブ、対人要素。
- 複数ステージ、装備、meta progressionを一括実装すること。
- 大量の武器、敵、アイテム、スキンを先に量産すること。
- 恒久ステータス上昇だけで進行を作ること。

## 4. Replayability Pillars

### 4.1 Run Variety

1 runごとの変化を作る柱。

候補:

- upgrade抽選とsynergy。
- pickup / itemの出現差。
- stageごとのwave curve、障害物、敵構成。
- run modifierによる小さなルール変化。
- seed共有やdebug exportによる再現性。

要件:

- ランダム性はプレイヤーの判断を増やすために使う。
- 理不尽な初期配置や詰み状況を作らない。
- 重要な乱数はseedとdebug exportで追跡できる。

### 4.2 Stage Structure

現在の1 arenaを、将来的に複数stageへ広げる。

候補:

- Stage 1: 標準arena。現在の基準。
- Stage 2: 障害物が少なく、操作練習に向くarena。
- Stage 3: 障害物や敵弾を活用するarena。
- Challenge stage: 固定seed、固定装備、特殊modifierつきの短い挑戦。

要件:

- stageは `StageDefinition` としてdata化する。
- stageはarena size、obstacles、wave config、enemy pool、reward/unlock条件を持つ。
- stage選択は最初は最小UIでよい。
- stage追加がsimulation/domainへPhaser依存を持ち込まない。

### 4.3 Equipment

run開始前に選ぶ装備で、プレイスタイルを変える。

候補:

- Weapon: 初期武器または射撃方式。
- Core: HP、移動、pickup、skill cooldownなどの方向性。
- Module: 小さな補助効果。

要件:

- 最初は1 slotだけでよい。
- 装備は単純な上位互換ではなく、強みと弱みを持つ。
- 装備効果はrun中upgradeと重なっても説明できる。
- 装備はlocal saveに保存できる前提で設計する。

### 4.4 In-Run Upgrades

run中の成長を作る柱。

候補:

- 既存upgradeのpool整理。
- upgrade tagによるsynergy。
- rarityまたはweight。
- reroll / banish / lock。
- weaponごとの専用upgrade。

要件:

- まず既存upgradeをdataとして整理する。
- rarityを入れる場合も、強さではなく期待感と選択幅の管理に使う。
- reroll / banish / lockは、upgrade poolが十分増えてから扱う。
- upgrade抽選はseedで再現可能にする。

### 4.5 Meta Progression

runをまたいだやりこみ。

候補:

- stage clearによるstage unlock。
- achievementによる装備 unlock。
- challenge clearによるcosmetic / title / rule unlock。
- profile statsとcollection。

要件:

- 最初はlocalStorage保存でよい。
- save schema versionとreset導線を持つ。
- unlockはプレイスタイルの選択肢を増やす方向を優先する。
- 恒久攻撃力や恒久HPだけで進める設計は後回しにする。

## 5. Randomness Policy

ランダム性の方針:

- run seedを明示的に持つ。
- stage、upgrade、spawn、drop、modifierの乱数streamを分けられる設計にする。
- 新しいrandom dropが既存のspawnやupgrade choiceを変えないようにする。
- rare eventには必要に応じてpityまたは上限を持たせる。
- result/debug exportにseed、stage id、equipment id、run modifierを含める。

初期に扱う候補:

- Dailyではなく、localで再現可能な `Run Modifier`。
- 例: `healingScarce`, `denseXp`, `fastChasers`, `openArena`, `ricochetTrial`。

避けること:

- 完全ランダムな障害物で詰み配置を作る。
- 報酬だけランダムで、プレイヤー判断が増えない。
- balanceProbeで再現できない乱数設計にする。

## 6. Candidate Roadmap

### v0.4 Control and Arena Feel

目的:

- 操作負荷、障害物、弾と壁の関係を整える。

主な既存候補:

- `PH-V04-005 Obstacle Layout and Projectile Interaction Review`
- `PH-V04-001 Auto-Fire With Mouse Aim Prototype`
- `PH-V04-002 Defensive Dash Binding Spike`
- `PH-V04-003 Right-Click Active Skill Input Split`
- `PH-V04-004 Space Defensive Action Design`

### v0.5 Stage Foundation

目的:

- 複数stageへ広げるためのdata modelを作る。

候補チケット:

- `PH-V05-001 Stage Definition Requirements`
- `PH-V05-002 Minimal Stage Select`
- `PH-V05-003 Stage-Specific Wave and Obstacle Config`
- `PH-V05-004 Run Seed and Modifier Export`

### v0.6 Equipment Foundation

目的:

- run開始前の選択肢を作る。

候補チケット:

- `PH-V06-001 Equipment Slot Requirements`
- `PH-V06-002 First Equipment Prototype`
- `PH-V06-003 Equipment Stats and Debug Export`
- `PH-V06-004 Equipment and Upgrade Interaction Review`

### v0.7 Meta Progression

目的:

- unlock、achievement、collectionで継続目標を作る。

候補チケット:

- `PH-V07-001 Local Save Schema Requirements`
- `PH-V07-002 Unlock Condition Requirements`
- `PH-V07-003 Achievement and Challenge Requirements`
- `PH-V07-004 Profile Stats Screen`

### v0.8 Content Expansion

目的:

- 土台の上に、stage、equipment、item、upgradeを少しずつ増やす。

候補:

- 新stage 1-2個。
- 新equipment 2-3個。
- item pool拡張。
- upgrade synergy追加。
- challenge stage追加。

## 7. First Requirement Candidates

### PH-V05-001 Stage Definition Requirements

目的:

stageをデータとして扱える境界を決める。

Requirements:

- `StageDefinition` は `id`, `title`, `arena`, `obstacles`, `waves`, `enemyPool`, `unlock` を持つ。
- 既存stageを `default` として表現できる。
- config schemaでstage不整合を検出できる。
- stage idをdebug exportとresultに含める。

Acceptance Criteria:

- stage data modelの設計書がある。
- 既存挙動を変えずにdefault stageへ移行できる見通しがある。

### PH-V05-002 Minimal Stage Select

目的:

複数stageへ進むための最小UIを作る。

Requirements:

- titleまたはpre-run画面からstageを選べる。
- 未unlock stageは表示だけできるか、初期段階では出さない。
- E2Eでstage選択からrun開始まで確認できる。

Acceptance Criteria:

- default stageを選んで現在と同じrunを開始できる。
- stage idがdebug exportに残る。

### PH-V05-003 Run Modifier Requirements

目的:

ランダム性をstageや装備と混ぜず、小さなルール差分として扱う。

Requirements:

- `RunModifierDefinition` を作る。
- modifierはseedで決まるか、明示選択できる。
- modifierはresult/debug exportに残る。
- 最初は1 modifierだけでよい。

Acceptance Criteria:

- modifierあり/なしの差分がテスト可能。
- balanceProbeでmodifier runを指定できる。

### PH-V06-001 Equipment Slot Requirements

目的:

run開始前の装備選択の最小要件を決める。

Requirements:

- 最初のslotは1つだけにする。
- equipment id、表示名、効果、unlock状態をdata化する。
- equipment効果はsimulation helperで合成する。
- upgrade、item、temporary effectと競合しない。

Acceptance Criteria:

- first equipment候補が1つに決まる。
- save/debug/resultでequipment idを追跡できる。

### PH-V07-001 Local Save Schema Requirements

目的:

やりこみ要素の保存方式を決める。

Requirements:

- localStorage保存を前提にする。
- schema versionを持つ。
- unlock、profile stats、settingsを分ける。
- reset導線を持つ。

Acceptance Criteria:

- save schema案がある。
- migrationまたは破棄可能なversion policyが決まる。

## 8. PM Recommendation

次の大きな順序:

1. v0.4で操作性と障害物体験を固める。
2. v0.5でstage data modelとstage selectを作る。
3. v0.5後半でrun seed / modifierを整理する。
4. v0.6でequipmentを1 slotだけ導入する。
5. v0.7でlocal saveとunlockを入れる。
6. その後にcontent量を増やす。

理由:

- 操作感が不安定なまま装備やmeta progressionを入れると、調整原因が分からなくなる。
- stageは障害物、wave、敵構成を束ねるため、装備より先に土台化する価値が高い。
- equipmentとunlockはsaveが絡むため、最初から大量実装しない。
- F2Pで課金しない場合、継続動機は「強制的な作業」ではなく「新しい選択肢と挑戦」で作る方がよい。

## 9. Open Questions

- 1 runの目標時間を今後も3分前後にするか、stageごとに伸ばすか。
- stage clear条件を survival time にするか、wave clear にするか、score threshold にするか。
- equipmentは初期武器から始めるか、core/moduleから始めるか。
- meta progressionで恒久statをどこまで許容するか。
- challenge stageを固定seedにするか、modifierだけ固定してseedは変えるか。
