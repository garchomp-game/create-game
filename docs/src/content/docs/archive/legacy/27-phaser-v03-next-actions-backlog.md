---
title: "Legacy: Phaser v0.3 Next Actions and Backlog"
description: "Migrated from docs/27-phaser-v03-next-actions-backlog.md."
---

> Source: `docs/27-phaser-v03-next-actions-backlog.md`

# Phaser v0.3 Next Actions and Backlog

## 1. Current State

基準日: 2026-06-25

直近の状態:

- `PH-V03-001 Healing Pickup Foundation` は実装済み。
- 品質監査でdebug E2Eの入力raceを1件修正済み。
- `main` は `origin/main` より4 commits ahead。
- 自動検証は通過済み。

検証済みコマンド:

- `npm run typecheck`
- `npm test -- --run`
- `npm run test:e2e`
- `npm run test:e2e -- tests/e2e/arena.spec.ts -g "can enter upgrade selection" --repeat-each=10`
- `npm run build`

既知の注意点:

- `npm run build` はPhaser bundle size warningを出すが、現時点では既知警告として扱う。
- heal pickup導入後の手動プレイ評価は未実施。
- balanceProbeはAI入力モデルの回帰検知であり、人間プレイの快適性判定ではない。
- 2026-06-29時点の会話上のplaytest所感では、v0.3の方向性は一旦問題なさそう。正式な3 run表は `docs/30-phaser-v03-playtest-report.md` に残す。
- v0.3まとめと次フェーズhandoffは `docs/34-phaser-v03-summary-and-handoff.md` に記録した。

## 2. PM Direction

次の目的は、新要素を増やす前に `回復pickupがゲームテンポを壊していないか` を確認し、その上でitem systemへ広げること。

優先順:

1. v0.3 healing foundationの手動プレイ検証
2. 回復pickupの微調整
3. item systemの設計
4. 小さなitemを1種類だけ追加
5. アイテム表示、stats、balanceProbeを拡張

今は大型機能を一気に増やさない。

理由:

- 回復は生存時間、難易度、低HP時判断に直接効く。
- healが強すぎる状態で別itemを足すと、調整原因を分解しにくくなる。
- pickup systemは今回拡張されたばかりなので、まず運用上の摩擦を見る。

## 3. Ticket Status Summary

| Ticket | Title | Priority | Effort | Status | Parallel |
| --- | --- | --- | ---: | --- | --- |
| PH-V03-001 | Healing Pickup Foundation | P0 | 5 EP | Done | no |
| PH-V03-002 | v0.3 Playtest and Balance Review | P0 | 3 EP | Session note recorded | no |
| PH-V03-003 | Heal Pickup Tuning Pass | P0 | 2 EP | No tuning | no |
| PH-V03-004 | Item System Requirements and Data Model | P0 | 3 EP | Ready | yes |
| PH-V03-005 | Temporary Buff Item Prototype | P1 | 5 EP | Blocked by PH-V03-004 | no |
| PH-V03-006 | Pickup Presentation and Feedback Pass | P1 | 3 EP | Ready | yes |
| PH-V03-007 | BalanceProbe Item KPI Extension | P1 | 2 EP | Blocked by PH-V03-004 | yes |
| PH-V03-008 | Manual Playtest Report v0.3 | P1 | 2 EP | Blocked by PH-V03-002 | yes |
| PH-V03-009 | Bundle Size / Build Warning Triage | P2 | 2 EP | Later | yes |
| PH-V03-010 | v0.3 Stabilization Candidate | P0 | 2 EP | Candidate ready | no |
| PH-V03-011 | Offscreen Enemy Direction Indicator | P1 | 2 EP | Done | yes |

## 4. Recommended Execution Order

```text
PH-V03-002 Playtest Review        [###]
PH-V03-004 Item Requirements      [###]
PH-V03-006 Presentation Pass      [###]
PH-V03-003 Heal Tuning               [##]
PH-V03-007 Item KPI Extension           [##]
PH-V03-005 Buff Item Prototype             [#####]
PH-V03-008 Playtest Report                   [##]
PH-V03-010 Stabilization Candidate              [##]
PH-V03-009 Build Warning Triage          [..]
```

並列化方針:

- `PH-V03-002` と `PH-V03-004` は並列可。
- `PH-V03-006` はvisual中心なので並列可。
- `PH-V03-003` は手動プレイ結果を見てから実施する。
- `PH-V03-005` はitem data modelが決まるまで着手しない。

v0.4へ送る候補:

- `PH-V04-001 Auto-Fire With Mouse Aim Prototype`
- `PH-V04-002 Defensive Dash Binding Spike`
- `PH-V04-003 Right-Click Active Skill Input Split`
- `PH-V04-004 Space Defensive Action Design`
- `PH-V04-005 Obstacle Layout and Projectile Interaction Review`

## 5. Tickets

### PH-V03-002 v0.3 Playtest and Balance Review

Priority: P0  
Effort: 3 EP  
Status: Session note recorded
Owner type: main  
Dependencies: PH-V03-001

目的:

heal pickupが「立て直し導線」として機能しているか、ゲームを簡単にしすぎていないかを確認する。

Scope:

- 手動プレイ3 runs以上
- debug run export
- `docs/22-phaser-v02-playtest-template.md` のv0.3流用
- balanceProbe結果との比較

Requirements:

- seed、config version、run exportを残す。
- 低HP時にhealへ向かう判断が発生したか記録する。
- heal pickupの視認性、回収しやすさ、寿命、頻度を記録する。
- Wave 3/Wave 4で難しさが残っているか確認する。
- `docs/30-phaser-v03-playtest-report.md` の自動baselineと比較する。ただし、balanceProbeが通っていても人間プレイの早死にや入力負荷を無視しない。

Acceptance Criteria:

- 3 runs分の所感とKPIが揃う。
- healが強すぎる、弱すぎる、見づらい、不要のいずれかを判断できる。
- `PH-V03-003` に渡す調整仮説が1-3個に絞られる。

失敗条件:

- 手動所感だけで調整する。
- debug exportなしで記録する。
- 1 runだけで結論を出す。

Result:

- `docs/30-phaser-v03-playtest-report.md` に2026-06-29のセッション所感を記録した。
- 正式な3 run exportは未入力だが、v0.3 candidateへ進む判断材料としては十分とした。
- 壁/障害物、操作負荷、active skill候補はv0.4へ送る。

### PH-V03-003 Heal Pickup Tuning Pass

Priority: P0  
Effort: 2 EP  
Status: No tuning
Owner type: main  
Dependencies: PH-V03-002

目的:

playtest結果に基づき、heal dropと回復量を最小変更で調整する。

Scope:

- `phaser/src/config/gameConfig.ts`
- `phaser/src/simulation/balance.test.ts`
- 必要なら `docs/26-phaser-v03-healing-pickup-design.md`

Requirements:

- 調整対象は原則 `healDropChance`, `healDropPityThreshold`, `healDropPityBonus`, `healDropMaxChance`, `healRatio`, `healLifetime` のいずれか。
- 複数パラメータを同時に大きく動かさない。
- v0.3 baselineを更新する場合は理由を残す。

Acceptance Criteria:

- `npm test -- --run` が通る。
- `npm run test:e2e` が通る。
- balanceProbeの主要値が説明可能。
- 手動プレイ所感とprobe値が矛盾していない。

失敗条件:

- 生存時間だけを見て調整する。
- healを強くしすぎて低HP時の緊張が消える。
- healを弱くしすぎて存在意義がなくなる。

Result:

- `No tuning` 判断。
- v0.3 candidateではheal pickup数値を据え置く。
- pickup kind別magnetやheal feedback強化は、必要が出た場合に別チケットで扱う。

### PH-V03-004 Item System Requirements and Data Model

Priority: P0  
Effort: 3 EP  
Status: Ready  
Owner type: main / review sub-agent  
Dependencies: PH-V03-001

目的:

今後のitem追加を、pickup処理の場当たり拡張にしないため、item定義と効果適用の境界を決める。

Scope:

- item種類の候補整理
- `Pickup.kind` と `ItemDefinition` の関係設計
- temporary effect / instant effect / run modifierの扱い
- stats/debug export設計
- test strategy

Requirements:

- まず候補は3種類以内に絞る。
- 最初の実装対象は1種類だけにする。
- simulation層にPhaser依存を入れない。
- effectの開始、継続、終了をテスト可能にする。

Item候補:

- `haste`: 一定時間移動速度を上げる。
- `magnetPulse`: 一定時間または一瞬だけpickup吸引範囲を広げる。
- `barrier`: 1回だけ被弾を軽減または無効化する。

推奨初回実装:

- `haste`

理由:

- effectの開始/終了が分かりやすい。
- statsとdebugで観測しやすい。
- healと役割が重なりにくい。
- 攻撃力を直接上げないため、バランス破壊が比較的小さい。

Acceptance Criteria:

- item data modelの設計書ができる。
- 最初に実装するitemが1つに決まる。
- 受け入れ条件とテスト観点が実装前に揃う。
- review/QAへ渡せる作業票がある。

失敗条件:

- 3種類以上を同時実装する。
- pickup systemにitem固有分岐が増えすぎる。
- 一時効果の解除漏れを検出できない設計になる。

### PH-V03-005 Temporary Buff Item Prototype

Priority: P1  
Effort: 5 EP  
Status: Blocked by PH-V03-004  
Owner type: main / worker  
Dependencies: PH-V03-004

目的:

item systemの最小実装として、一時buff itemを1種類だけ入れる。

想定対象:

- `haste`

Scope:

- domain types
- config/schema
- effect runtime
- pickup spawn/collect
- stats/result/debug export
- renderer/HUD minimal feedback
- unit/E2E/visual tests

Requirements:

- effect durationを持つ。
- 同じitemを再取得した時の挙動を定義する。
- game over / title / restartで効果が残らない。
- upgrade効果と合成しても速度が破綻しない。

Acceptance Criteria:

- 一時効果が開始し、duration後に終了する。
- debug snapshotでactive effectsが見える。
- unit testで効果開始、延長または上書き、終了、restart resetを確認する。
- E2Eでfixture回収とdebug exportを確認する。

失敗条件:

- buffが永続化する。
- player speed計算が複数箇所に散る。
- visual feedbackなしで効果中か分からない。

### PH-V03-006 Pickup Presentation and Feedback Pass

Priority: P1  
Effort: 3 EP  
Status: Ready  
Owner type: worker / QA  
Dependencies: PH-V03-001

目的:

pickup追加に伴う視認性、音、feedbackを整理する。

Scope:

- heal pickup visual
- pickup collection feedback
- audio cue分離の要否
- visual snapshot

Requirements:

- heal, XP, enemy projectile, enemyが混同しない。
- pickup取得時に最低限のfeedbackがある。
- 音を分ける場合、過剰にうるさくしない。

Acceptance Criteria:

- visual fixtureでpickup識別が確認できる。
- 必要なら `pickup.collected` のkindごとにfeedback色を変える。
- E2E/visual snapshotが通る。

失敗条件:

- red系表現が敵弾と混ざる。
- effectが派手すぎて敵弾視認を邪魔する。

### PH-V03-007 BalanceProbe Item KPI Extension

Priority: P1  
Effort: 2 EP  
Status: Blocked by PH-V03-004  
Owner type: worker  
Dependencies: PH-V03-004

目的:

item追加後の影響をprobeで観測できるようにする。

Scope:

- `phaser/src/simulation/balanceProbe.ts`
- `phaser/src/simulation/balance.test.ts`

Requirements:

- item collected count
- active effect uptime
- first item collected time
- optional: item kind別count

Acceptance Criteria:

- itemなし時とitemあり時の比較ができる。
- KPIが過剰で通常testの読みにくさを増やさない。

失敗条件:

- probeの実行時間が伸びすぎる。
- item KPIがResult/Debugと不整合になる。

### PH-V03-011 Offscreen Enemy Direction Indicator

Priority: P1
Effort: 2 EP
Status: Done
Owner type: main
Dependencies: PH-V03-001

目的:

画面外から来る敵の方向が分かりにくい問題を、小さな境界矢印で改善する。

Scope:

- Phaser rendererでoffscreen enemy indicatorを描く。
- debug fixtureを追加する。
- visual snapshotを追加する。

Requirements:

- simulation/domainにPhaser依存を入れない。
- enemy spawnやwave数値は変えない。
- 表示は最大8体程度に抑える。
- HUDやpickup、敵弾の視認性を邪魔しない。

Acceptance Criteria:

- 画面外の敵方向がアリーナ端で分かる。
- visual snapshotがある。
- `npm run test:e2e` が通る。

失敗条件:

- 画面端が矢印でうるさくなる。
- HUDや敵弾視認を邪魔する。
- 敵接近が分かりすぎて緊張感が大きく落ちる。

### PH-V03-008 Manual Playtest Report v0.3

Priority: P1  
Effort: 2 EP  
Status: Blocked by PH-V03-002  
Owner type: main  
Dependencies: PH-V03-002

目的:

v0.3の実プレイ評価を次の調整判断に使える形で残す。

Scope:

- `docs/22-phaser-v02-playtest-template.md` の流用またはv0.3版作成
- run export添付
- 調整判断メモ

Acceptance Criteria:

- 3 runs分の比較表がある。
- healの頻度、拾うリスク、低HP立て直し、死亡原因が記録されている。
- 次に調整する数値が明記される。

### PH-V03-009 Bundle Size / Build Warning Triage

Priority: P2  
Effort: 2 EP  
Status: Later  
Owner type: worker  
Dependencies: none

目的:

build時のbundle size warningを、既知リスクとして管理するか、chunk分割で解消するか判断する。

Scope:

- Vite build output
- Phaser dependency chunk
- manualChunksの要否

Acceptance Criteria:

- warningを放置する場合は理由がdocsに残る。
- 対応する場合はbuild outputが安定する。

失敗条件:

- gameplay作業より先にbundle調整へ深入りする。
- chunk分割でdev serverやE2Eが不安定になる。

### PH-V03-010 v0.3 Stabilization Candidate

Priority: P0  
Effort: 2 EP  
Status: Candidate ready
Owner type: main  
Dependencies: PH-V03-002, PH-V03-003

目的:

v0.3を一度candidateとして固め、push/タグ/次phaseへ進める判断をする。

Requirements:

- `npm run typecheck`
- `npm test -- --run`
- `npm run test:e2e`
- `npm run build`
- manual playtest report
- open risks整理

Acceptance Criteria:

- v0.3 candidateとしてpush可能。
- 残す課題がP1/P2へ明確に分かれている。
- 次にitem systemへ進むか、heal tuningを続けるか判断できる。

Result:

- `docs/30-phaser-v03-playtest-report.md` に簡易playtest noteを記録した。
- `PH-V03-003` は `No tuning` 判断。
- `docs/35-phaser-v03-stabilization-candidate.md` にcandidate判定と残リスクを記録した。

## 6. Sub-Agent Usage Plan

使いどころ:

- `PH-V03-004`: item候補の設計レビュー、過剰設計チェック。
- `PH-V03-006`: visual/QA観点のレビュー。
- `PH-V03-007`: balance KPIの過不足チェック。
- `PH-V03-010`: release candidate監査。

使わない方がよいところ:

- `PH-V03-003` の最終バランス判断。
- 手動プレイの感触判断。
- 複数チケットにまたがる方針決定。

理由:

- バランス判断は連続文脈とプレイ所感が重要。
- サブエージェントは抜け漏れ検出、レビュー、QAに向く。

## 7. Immediate Next Actions

次に実行するなら以下の順。

1. `PH-V03-002` を開始し、v0.3 healing foundationを3 runs以上手動確認する。
2. 同時に `PH-V03-004` のitem system設計を作る。
3. `PH-V03-006` を軽く走らせ、heal pickup feedbackの不足がないか確認する。
4. playtest結果を見て `PH-V03-003` の数値調整を行う。
5. 調整後に `PH-V03-010` でv0.3 candidate化する。

最短で進める場合:

- `PH-V03-002`
- `PH-V03-003`
- `PH-V03-010`

item追加まで進める場合:

- `PH-V03-002`
- `PH-V03-004`
- `PH-V03-003`
- `PH-V03-005`
- `PH-V03-007`
- `PH-V03-010`

## 8. Decision Points

### 8.1 Heal Tuning

判断材料:

- 回復pickupを拾いに行く判断が発生したか。
- 回復pickupが多すぎて緊張感が落ちたか。
- HP満タン時に拾われる挙動が自然か。
- Wave4で生存時間が伸びすぎていないか。

### 8.2 First Item

推奨:

- `haste`

保留:

- `magnetPulse`
- `barrier`

理由:

- `magnetPulse` はpickup回収体験を大きく変えるため、heal評価が終わるまで待つ。
- `barrier` はHP/被弾/回復の評価と絡みやすく、heal調整直後には入れにくい。

### 8.3 v0.3 Candidate

candidate条件:

- healing foundationに致命的なflakyがない。
- 手動プレイで明らかな不快感がない。
- 回復量と頻度が説明可能。
- 次phaseのitem system設計がある。
