---
title: "Legacy: Phaser Controls and Active Skill Discovery"
description: "Migrated from docs/32-phaser-controls-and-active-skill-discovery.md."
---

> Source: `docs/32-phaser-controls-and-active-skill-discovery.md`

# Phaser Controls and Active Skill Discovery

作成日: 2026-06-28

## 1. 目的

このドキュメントは、Phaser版 `Arena Core` の操作性とactive skill案を整理するための発見メモである。

現行の `WASD/arrow移動 + mouse aim + left click/Space shoot` は、PC向けトップダウンシューティングとして成立している。一方で、慣れていないプレイヤーには移動、照準、射撃、pickup routing、敵弾回避を同時に処理する負荷が高い。

v0.3ではheal pickupの評価を優先し、操作変更はまだ実装しない。ただし、手動playtestで操作負荷を記録し、v0.4以降の方向性を決める。

## 2. Current Controls

現行:

- Move: `WASD` or arrow keys
- Aim: mouse
- Shoot: left click or `Space`
- Upgrade choice: `1`, `2`, `3` or click
- Restart: `R`
- Pause: `P` / `Esc`
- Debug overlay: `F3`

実装上の注意:

- `Space` とmouse pressはどちらも `shootHeld` に入る。
- 現行の `InputSnapshot` は `shootHeld` しか持たないため、simulation側ではleft click、right click、`Space` を区別できない。
- `1`, `2`, `3` は現時点ではupgrade selection中の選択入力。
- right click専用actionはまだ定義されていない。
- dash、active skill、secondary fire、mouse button別入力はまだ存在しない。
- offscreen enemy arrowはrenderer-onlyのpresentationであり、入力やsimulation rulesには影響しない。

## 3. Product Concern

観察された懸念:

- `WASD` 移動とmouse aimを同時に使う操作が難しい。
- 現行は実力ゲー寄りで、早い段階で死ぬことが多い。
- まれに長く生き残れるため、skill ceilingは存在している。
- `Space` とmouse shootの役割が重なっている。
- PCゲームらしさを出すなら、数字キーや右クリックskillも候補になる。
- dashは一般的には `Ctrl` / `Shift` に割り当てられることが多く、`Space` はjumpに使われることが多い。ただし本作にはjump actionがないため、`Space` をdashやpanic actionへ使う余地がある。

PM判断:

- 現行操作は一旦残す。
- v0.3 healing評価中に入力方式まで変えると、死因と回復評価が混ざる。
- ただし、操作負荷はv0.3 playtest reportの主要観察項目に追加する。

## 4. Candidate Directions

### 4.1 Keep Current Skill-Based Control

内容:

- `WASD + mouse aim + manual shoot` を維持する。
- 高いskill ceilingを個性として扱う。

利点:

- 既存実装とテストを維持できる。
- プレイヤーの上達が結果に出やすい。
- PC向け操作として理解しやすい。

リスク:

- 初期離脱が強い。
- 回復やitemが「操作できる人だけ活かせる」要素になる。
- 低HP時の判断が、戦術ではなく入力負荷に潰される可能性がある。

### 4.2 Auto-Fire With Mouse Aim

内容:

- 射撃は常時自動。
- mouseは照準だけを担当する。
- `Space` を別actionへ空ける。

利点:

- 入力負荷を1つ減らせる。
- pickup routingと回避判断に集中しやすい。
- `Space` をdash、panic skill、pickup pulseなどへ回せる。

リスク:

- 射撃判断が薄くなり、ゲームが受け身になる。
- 現行balanceProbeやE2Eの前提が変わる。
- DPSが安定しすぎてwave pressure調整が必要になる。

### 4.3 Right-Click Active Skill

内容:

- left click / auto-fireは通常射撃。
- right clickをactive skillにする。
- cooldownとUI表示を持つ。

候補:

- short dash
- emergency knockback pulse
- brief barrier
- focus slow / aim assist
- pickup pulse

利点:

- 死亡直前の能動的な切り返しが生まれる。
- PC操作らしさが出る。
- 実力ゲーのままでも、学習可能な安全弁になる。

リスク:

- balance影響が大きい。
- cooldown UI、input state、debug export、result statsが必要。
- heal pickup、barrier item、future skillsと役割が被りやすい。

### 4.4 Space As Defensive Skill

内容:

- `Space` をshootから外し、防御/回避actionにする。

候補:

- dash
- panic pulse
- temporary invulnerability
- quick reload / overdrive
- pickup magnet pulse

利点:

- `Space` の役割が明確になる。
- keyboard handで緊急操作をしやすい。
- right clickより慣れていないプレイヤーにも押しやすい。

リスク:

- `Space` start / shootの既存挙動を変えるため、タイトル入力やE2Eも影響する。
- dash系は障害物、接触ダメージ、敵弾回避と強く絡む。
- invulnerability系はheal/barrierと役割が重なる。

### 4.5 Ctrl / Shift Dash

内容:

- `Ctrl` または `Shift` をdashにする。
- `Space` は別skill、または将来のpanic actionとして温存する。

利点:

- PCゲームの慣習に近い。
- `Space` をjump以外の大きめのactionへ使う違和感を避けられる。
- manual shootを残す場合でも、dashをkeyboard hand側に置ける。

リスク:

- `Shift` はブラウザ/OSやユーザー習慣によって押しっぱなし操作になりやすい。
- `Ctrl` はブラウザショートカット誤爆に注意が必要。
- `WASD` と同じ左手にさらに負荷が乗る。

### 4.6 Number Key Skills

内容:

- `1`, `2`, `3` をskill slotとして使う。
- upgrade selection中だけ同じ数字で選択するか、別UIにする。

利点:

- PCゲームらしさが強い。
- 将来的なbuild/skill選択に広げやすい。

リスク:

- 現行ではupgrade choice入力と衝突する。
- 初期実装としてはUI/UXの説明量が増える。
- 複数skillはitem複数実装と同じく、調整原因を分解しにくい。

## 5. Recommended Next Step

v0.3中:

- 操作は変えない。
- PH-V03-002で操作負荷を観察する。
- `Space` とright clickの役割重複感を記録する。
- 早死にが入力負荷によるものか、enemy pressureによるものかを分けてメモする。

v0.4候補:

1. `PH-V04-001 Auto-Fire With Mouse Aim Prototype`: shootingを常時化し、mouseをaim専用にする試験branchまたはtoggle。
2. `PH-V04-002 Defensive Dash Binding Spike`: `Space` / `Shift` / `Ctrl` のdash候補を比較する。ただし、dash自体はcollision、contact damage、projectile回避、cooldown UIへ影響する。
3. `PH-V04-003 Right-Click Active Skill Input Split`: left/right mouse buttonをinput model上で分離し、context menu抑制とdebug/exportの方針を決める。
4. `PH-V04-004 Space Defensive Action Design`: `Space` をshootから外し、panic actionまたはdefensive skillにするか設計する。
5. number key skill slotは、active skillが1つ成立してから検討する。現時点ではupgrade choiceと衝突する。

## 6. Playtest Questions

PH-V03-002で見る質問:

- Death was caused by input overload, enemy pressure, or bad routing?
- Was aiming while moving manageable?
- Did holding shoot make movement/aim harder?
- Did `Space` feel redundant with mouse shoot?
- Was there a moment where `Space` should have been dash/panic action?
- Would `Ctrl` or `Shift` feel more natural than `Space` for dash?
- Was there a moment where right click skill would have saved the run?
- Would auto-fire reduce frustration or remove too much agency?
- Did early death feel fair enough to retry?
- Did a long survival run feel like mastery or lucky pressure relief?

## 7. Decision Criteria

現行維持:

- 3 runsで操作負荷はあるが、死因理解と再挑戦意欲が残る。
- 長生存が「上達すれば再現できそう」と感じる。

入力補助を検討:

- 3 runsで早死にの主因が一貫して入力負荷。
- healやupgrade判断へ意識が回らない。
- mouse aimとshoot維持が忙しすぎる。

active skillを優先:

- Wave 3/4または死亡直前に、明確な切り返し手段が欲しい。
- 操作は難しいが、難しさ自体はゲームの魅力として残したい。

auto-fireを検討:

- 射撃ボタン維持が主な負荷で、照準と移動は楽しい。
- shooting decisionよりrouting/positioningをゲームの中心にしたい。
