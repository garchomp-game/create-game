# PH-V03-001 Healing Pickup Foundation

## 1. Ticket

Ticket ID: `PH-V03-001`  
Title: Healing Pickup Foundation  
Priority: P0  
Effort: 5 EP  
Status: Revised Design  
Owner type: main/worker  
Target: Phaser v0.3 candidate  
Dependencies:

- v0.2 debug run export
- v0.2 result summary and damage source metrics
- existing XP pickup placement, magnet, and obstacle avoidance

## 2. 背景

現在のPhaser版には、最大HPを増やす `Vital Core` がある。

`Vital Core` は最大HPを増やすだけでなく、現在HPも同量回復する。つまり「アップグレード選択時の即時回復」は存在する。

一方で、戦闘中に拾って回復するアイテム、敵撃破からの回復導線、低HP時の立て直し導線はない。

このため、HP最大値を伸ばしても以下の問題が残る。

- 被弾後の立て直し判断が少ない。
- 低HP時に「リスクを取って拾いに行く」意思決定がない。
- Wave4以降で一度崩れると、そのまま押し切られやすい。
- `damageTaken` は見えるが、`hpRecovered` がないため耐久ビルドの評価が薄い。

## 3. 目的

敵撃破後に低頻度で回復pickupを出し、戦闘中の立て直し導線を作る。

重要なのは、ゲームを簡単にすることではない。

回復pickupを「安全な救済」ではなく、「危険な位置へ拾いに行く価値のあるリソース」として設計する。

## 4. Non Goals

このチケットでは以下を実装しない。

- 自然回復
- HP吸収武器
- シールド
- 爆弾pickup
- magnet pickup
- 回復量を増やす新アップグレード
- UI上の詳細なbuff表示
- heal pickup専用の高度な演出
- 恒久メタ進行

理由:

- 回復pickup単体の影響を先に計測したい。
- 自然回復は逃げ回り最適化を生みやすい。
- shield/bomb/magnetは別の意思決定と視認性負荷を増やす。

## 5. Game Design

### 5.1 基本仕様

`Pickup.kind` を `"xp" | "heal"` に拡張する。

heal pickupは敵撃破時に低確率で出る。

取得時:

- 現在HPを回復する。
- 最大HPを超えて回復しない。
- 回復量をstatsへ記録する。
- `pickup.collected` eventにkindと回復量を含める。

### 5.2 初期数値案

| Parameter | Value | 理由 |
| --- | ---: | --- |
| base drop chance | 0.08 | 頻繁すぎないが、数分プレイで体感できる |
| pity kill threshold | 18 | 長時間出ない偏りを抑える |
| pity bonus per kill | 0.025 | 閾値後に徐々に出やすくする |
| max effective chance | 0.35 | 回復が連鎖しすぎない上限 |
| heal ratio | 0.12 max HP | max HPビルドと相性を持たせる |
| minimum heal | 8 | 序盤でも意味を持たせる |
| pickup radius | 7 | XPより少し大きく読ませる |
| magnet behavior | XPと同じ | 既存pickup導線を活用 |

計算:

```text
maxHp = config.player.maxHp + world.runtime.maxHpBonus
healAmount = max(minimumHeal, floor(maxHp * healRatio))
healed = min(healAmount, maxHp - currentHp)
```

HP満タン時:

- heal pickupは回収できる。
- 実回復量は0。
- statsの `healPickupsCollected` は増える。
- statsの `effectiveHealPickupsCollected` は増えない。
- `hpRecovered` は増えない。

判断:

- 満タン時に拾えない仕様は、画面上に不要物が残ってノイズになりやすい。
- 満タン時回収を許容し、0回復として記録する。
- Resultでは `Heals: effective/collected` の形で表示し、「拾った数」と「実回復した数」を混同させない。

### 5.3 Drop 対象

全敵種から出るが、敵種ごとに倍率を持たせる。

| Enemy | Drop Multiplier | 理由 |
| --- | ---: | --- |
| chaser | 0.75 | 数が多いため抑える |
| fast | 0.75 | 数が多く、拾いに行くリスクが低い場面も多い |
| brute | 1.4 | 倒す手間に報酬を持たせる |
| ranged | 1.2 | 敵弾圧への立て直し報酬 |

実効確率:

```text
pitySteps = max(0, healDropMissCount - pityKillThreshold + 1)
pityBonus = pitySteps * healDropPityBonus
chance = min(healDropMaxChance, (healDropChance + pityBonus) * enemyMultiplier)
```

Pity:

- `runtime.healDropMissCount` を追加する。
- `runtime.healDropRollIndex` を追加する。
- heal pickupがspawnしたら0へ戻す。
- heal pickupがspawnしなかったkillで+1。
- `healDropMissCount` は判定前の連続miss数として扱う。
- `healDropMissCount < pityKillThreshold` ではpity bonusは0。
- `healDropMissCount === pityKillThreshold` から1段階目のbonusを足す。
- `healDropMaxChance` で最終的にcapする。

乱数:

- heal dropは既存 `RandomSource` streamを消費しない。
- `config.seed`, `enemyId`, `enemyType`, `healDropRollIndex` から決定論的hash rollを作る。
- heal drop有無が、spawn順、upgrade choice、level up choiceなど既存random streamへ波及しないようにする。
- `healDropRollIndex` はkill eventを処理するたびに+1する。

### 5.4 Pickup 優先順位

XPとhealが同じ位置に出る場合:

- pickup placementを拡張し、障害物だけでなく既存pickupとの重なりも避ける。
- 同一killでXPとhealが同時に出る可能性は許可する。
- 配置はXPを先に置き、healは同じoriginから空き位置探索する。

理由:

- XPはゲーム進行の基本資源。
- healは追加報酬。
- 現行placementは障害物のみを避けるため、PH-V03-001でpickup同士の重なり回避を追加する。
- 同一killでXPとhealが重なると視認性と同時回収event順が曖昧になるため、重なりは許容しない。

### 5.5 Lifetime

heal pickupには寿命を持たせる。

| Parameter | Value | 理由 |
| --- | ---: | --- |
| heal lifetime | 18s | 画面ノイズを抑え、拾う判断に期限を作る |

XP pickupは現行通り消えない。

理由:

- XPは進行資源なので消えるとストレスになりやすい。
- healは立て直し資源なので、期限がある方が意思決定になる。
- HP満タン時に放置されたhealがWave4で画面ノイズになるのを避ける。

### 5.6 Fatal Frame Rule

同フレーム蘇生は許可しない。

定義:

- `resolveCombat` 後に `world.state.hp <= 0` の場合、そのframeではpickup collectionを行わない。
- kill eventからpickup spawnまでは行ってよい。
- HPが0になったframeにheal pickupと重なっていても、回復せず `gameOver` になる。

理由:

- 「死んだが同時に拾ったので生き残る」はルール説明が難しい。
- 死因分析とresult summaryが不安定になる。
- 回復pickupは立て直し手段であり、蘇生手段ではない。

## 6. Domain Design

### 6.1 Types

`Pickup`:

```ts
export type PickupKind = "xp" | "heal";

export type Pickup = CircleBody & {
  id: string;
  kind: PickupKind;
  xpValue: number;
  healValue: number;
  lifetime: number | null;
};
```

互換判断:

- `xpValue`, `healValue`, `lifetime` を持つ単純構造にする。
- kindごとのunionも可能だが、pickup処理の集計/表示で分岐が増える。
- この規模では両値保持のほうが低コスト。
- 不正状態はfactory/helperとinvariant testで防ぐ。

Factory:

```ts
createXpPickup(...): Pickup // kind xp, xpValue > 0, healValue 0, lifetime null
createHealPickup(...): Pickup // kind heal, xpValue 0, healValue > 0, lifetime healLifetime
```

Invariant:

- `kind === "xp"` なら `xpValue > 0`, `healValue === 0`, `lifetime === null`
- `kind === "heal"` なら `xpValue === 0`, `healValue > 0`, `lifetime !== null`

`PickupSimulationConfig`:

```ts
healRadius: number;
healDropChance: number;
healDropPityThreshold: number;
healDropPityBonus: number;
healDropMaxChance: number;
healRatio: number;
healMinimum: number;
healLifetime: number;
healEnemyMultipliers: Record<EnemyTypeId, number>;
```

Schema:

- chance/max chance: `0..1`
- pity threshold: non-negative integer
- pity bonus: non-negative number
- heal ratio/minimum/radius/lifetime: positive number
- enemy multipliers: all `EnemyTypeId` keys required and positive

`RuntimeModifiers`:

```ts
healDropMissCount: number;
healDropRollIndex: number;
```

`RunStats`:

```ts
hpRecovered: number;
healPickupsCollected: number;
effectiveHealPickupsCollected: number;
```

`RunResultSummary`:

- `hpRecovered`
- `healPickupsCollected`
- `effectiveHealPickupsCollected`

`GameEvent`:

```ts
| {
    type: "pickup.spawned";
    pickupId: string;
    kind: PickupKind;
    position: Vec2;
    xpValue: number;
    healValue: number;
    lifetime: number | null;
  }
| {
    type: "pickup.collected";
    pickupId: string;
    kind: PickupKind;
    xpValue: number;
    healValue: number;
    hpRecovered: number;
    hpAfter: number;
  }
| {
    type: "pickup.expired";
    pickupId: string;
    kind: PickupKind;
  }
```

互換判断:

- 既存eventを別名にせず拡張する。
- XP pickupでも `healValue: 0`, `hpRecovered: 0`, `lifetime: null` を入れる。
- 既存stats systemが1イベントでXP/回復を同時処理できる。

## 7. Simulation Design

### 7.1 pickupSystem

現在:

1. kill eventからXP pickup spawn
2. magnet移動
3. collect判定

変更後:

1. kill eventからXP pickup spawn
2. kill eventからheal drop判定
3. heal pickup spawn
4. heal pickup lifetime更新と期限切れ削除
5. magnet移動
6. collect判定

heal drop判定には決定論的rollが必要。

候補:

1. `updatePickups(world, config, events, dt)` にrandomを追加する。
2. heal dropだけ別systemにする。
3. enemy killed event生成時にheal判定もする。
4. pickupSystem内で `config.seed` とkill情報からhash rollを作る。

採用:

- 4を採用する。

理由:

- pickup spawn責務は `pickupSystem` に残す。
- combatSystemにdrop報酬を混ぜない。
- XPとhealの配置処理を共有できる。
- 既存random streamを消費せず、upgrade choiceやspawn順への副作用を避ける。

不採用理由:

- 1は既存random streamを消費し、後続のspawnやupgrade choiceへ副作用が出る。
- 2は配置処理が分散しやすい。
- 3はcombatSystemへ報酬drop責務が混ざる。

影響:

- `stepWorld` の `updatePickups(world, config, events, dt)` signatureは維持できる。
- pickupSystem内にhash roll helperを追加する。
- `RuntimeModifiers` に `healDropMissCount` と `healDropRollIndex` を追加する。
- 既存random streamのbaseline変化を避ける。

### 7.2 回復処理

collect時:

```text
if pickup.kind === "xp":
  world.progression.xp += pickup.xpValue
  hpRecovered = 0

if pickup.kind === "heal":
  if world.state.hp <= 0:
    skip collection
  maxHp = baseMaxHp + maxHpBonus
  hpBefore = world.state.hp
  world.state.hp = min(maxHp, hpBefore + pickup.healValue)
  hpRecovered = world.state.hp - hpBefore
```

`pickup.collected` event:

- XPでもhealでも出す。
- statsはeventから更新する。

heal量の決定:

- healValueはspawn時に決める。
- 既に落ちているheal pickupは、後から `Vital Core` を取ってもhealValueが変わらない。
- `Vital Core` 後に新しく落ちたheal pickupは、増えたmax HPを基準にhealValueが上がる。

理由:

- pickup objectとdebug exportが安定する。
- 見えているpickupの価値が後から変わると説明しづらい。
- max HPビルドとの相性は、新規dropで十分出る。

### 7.3 Balance Probe

`BalanceProbeRun` に以下を追加する。

- `hpRecovered`
- `healPickupsCollected`
- `effectiveHealPickupsCollected`

baseline:

- 初回導入時に `kiteCollect` p50の生存時間変動を見る。
- v0.2 baselineから20%以上伸びる場合はdrop chance/回復量を再調整する。
- v0.3候補として採用する値が固まったら、balance baseline定数をv0.3値に更新する。

仮想許容:

- survival p50: v0.2 baseline比で+0%から+20%まで
- first damage p50: 大きく変わらない
- kills/min: 大きく下がらない
- hpRecovered: 0より大きいrunが出る

## 8. Adapter / Visual Design

### 8.1 ViewConfig

`pickup` viewへheal色を追加する。

```ts
pickup: {
  xpColor: number;
  healFill: number;
  healStroke: number;
  healCross: number;
}
```

初期案:

- heal fill: `0xf8fafc`
- heal stroke: `0xdc2626`
- heal cross: `0xef4444`

### 8.2 Renderer

XP:

- 現行の緑円を維持。

Heal:

- 白い小型medkit風の角丸四角または太い円。
- 赤い十字を描く。
- XP、敵弾、player bulletと混同しない。
- 敵弾のpink diamond、chaserの赤円、XPの緑円と並べたfixtureで確認する。

十字はPhaser Graphicsで描く。

```text
horizontal line
vertical line
```

### 8.3 HUD / Result

HUD:

- v0.3初期では回復量を常時表示しない。
- HUDは既に情報密度がある。

Result:

- `Recovered: N`
- `Heals: effective/collected`

Debug export:

- `resultSummary.hpRecovered`
- `resultSummary.healPickupsCollected`
- `resultSummary.effectiveHealPickupsCollected`
- `pickupCount` は合計のまま。
- 必要なら将来 `pickupTypeCounts` を追加する。

## 9. Test Strategy

### 9.1 Unit / Simulation

追加テスト:

- enemy killからXP pickupは従来通り出る。
- pickup factoryがXP/healのinvariantを満たす。
- heal drop chance 100% configでheal pickupが出る。
- heal drop chance 0% configではheal pickupが出ない。
- fixed hash rollでspawn/no-spawnが決定論的に分かれる。
- heal pickup回収でHPが回復する。
- heal pickupはmax HPを超えて回復しない。
- HP満タン時にheal pickupを拾うと `hpRecovered` は0。
- HP満タン時にheal pickupを拾うと `healPickupsCollected` は増える。
- HP満タン時にheal pickupを拾っても `effectiveHealPickupsCollected` は増えない。
- `hpRecovered` は実回復量だけ増える。
- `Vital Core` 後のmax HPを基準にheal量が増える。
- 既に落ちているheal pickupは、後から `Vital Core` を取ってもhealValueが変わらない。
- heal pickupもmagnet対象になる。
- heal pickupも障害物配置回避を使う。
- heal pickupは既存pickupとの重なりを避ける。
- 同一killでXP+healが出ても、pickup同士が重ならない。
- 同一killでXP+healが同時回収されてもevent順とstatsが整合する。
- HPが0になった同フレームにheal pickupと重なっていても蘇生しない。
- heal lifetimeが0になるとheal pickupは消える。
- pity threshold後にdrop chanceが上がる。
- pity threshold境界のbonus stepが仕様通り。
- pity max chance capが効く。
- enemy multiplier適用後にmax chance capが効く。
- heal spawnでpity countがresetされる。
- 同一フレーム複数killで `healDropRollIndex` と `healDropMissCount` が安定して進む。
- heal drop判定が既存random streamを消費しない。
- config schemaがchance/radius/lifetime/multiplierの不正値を拒否する。

### 9.2 Balance

`balance.test.ts`:

- `kiteCollect` で `hpRecovered` が集計される。
- max enemies/bullets/pickups budgetが破綻しない。
- survival p50が現baselineから20%超で伸びたら検出する。

### 9.3 E2E / Visual

Visual:

- heal pickup fixtureをdev-only debug APIで作る。
- heal pickup snapshotを追加するか、既存initial frameへ固定fixtureを入れる。
- heal pickup、XP、enemy projectile、chaserを同一frameに置き、誤認しないか確認する。

E2E:

- debug fixtureでHPを減らす。
- heal pickupをプレイヤー位置へ置く。
- step後にHPが回復し、run exportへ反映される。
- HP満タン時にheal pickupを拾った場合、`healPickupsCollected` と `effectiveHealPickupsCollected` の差がexportで確認できる。
- 致死ダメージ同フレームではheal pickupで蘇生しない。

## 10. Acceptance Criteria

機能:

- `Pickup.kind` がXPとhealを区別できる。
- enemy killからheal pickupが設定確率でspawnする。
- heal dropは既存random streamを消費しない。
- heal dropのpity計算式、threshold、capが仕様通りに実装される。
- heal pickup取得でHPが回復する。
- max HPを超えて回復しない。
- HP満タン時の取得は許容され、実回復量0として記録される。
- HP満タン時の取得は `healPickupsCollected` には入るが `effectiveHealPickupsCollected` には入らない。
- HP0になった同フレームにheal pickupと重なっていても蘇生しない。
- heal pickupはXP pickupと同じmagnet/placementルールで動く。
- heal pickupは既存pickupと重ならない。
- heal pickupは寿命切れで消える。
- heal pickupはXP、敵弾、player bulletと見た目で混同しない。

計測:

- `RunStats` に `hpRecovered`, `healPickupsCollected`, `effectiveHealPickupsCollected` が入る。
- `RunResultSummary` とdebug exportで回復量を確認できる。
- `balanceProbe` で回復KPIが見られる。
- drop設定変更による生存時間の大幅変動を検出できる。
- v0.3実装時に `appVersion` と `SIMULATION_CONFIG_VERSION` を更新する。

品質:

- `npm run test` が通る。
- `npm run typecheck` が通る。
- `npm run build` が通る。
- `npm run test:e2e` が通る。
- visual regressionは意図したpickup表示変更だけ更新する。

設計境界:

- Phaser依存をsimulationへ入れない。
- combatSystemにdrop報酬判定を混ぜない。
- 回復pickup以外の新アイテムを同チケットへ混ぜない。

## 11. Failure Conditions

- 回復が多すぎてWave4の緊張感が消える。
- HP満タン時にpickupが残り続けて画面ノイズになる。
- heal pickupが敵弾やXPと混同される。
- stats上は回復しているのにresult/debug exportで見えない。
- random dropがflaky testを作る。
- heal dropが既存random streamを消費し、upgrade choiceやspawn順を変える。
- heal drop判定がcombatSystemに入り、責務境界が崩れる。
- pickup unionが過剰に複雑になり、XP処理まで読みにくくなる。
- 同フレーム致死ダメージをheal pickupが取り消す。
- XPとhealが重なり、見た目またはevent順が曖昧になる。

## 12. Implementation Tasks

1. Domain types拡張
2. Config/schema拡張
3. createWorld runtime/stats初期値追加
4. pickup factory/helper追加
5. deterministic heal drop roll追加
6. pickupSystemへheal spawn/drop/lifetime/collect追加
7. statsSystem/resultSummary更新
8. balanceProbe更新
9. Rendererでheal pickup描画
10. debug fixture追加
11. simulation/unit tests追加
12. E2E/visual tests追加
13. appVersion/configVersion更新
14. IMPLEMENTATION_NOTES更新
15. balance baseline確認

## 13. Open Questions

1. heal dropは全敵から出すか、brute/rangedだけに絞るか。
2. HP満タン時のheal pickup回収を許容するか。現設計では許容し、effective countと分ける。
3. 回復量はmax HP比率でよいか。固定値だけだとmax HPビルドと噛み合わない。
4. pity countはruntimeに置くかstatsに置くか。現設計ではruntime。
5. visual snapshotは専用fixtureにするか、既存frameへ混ぜるか。
6. heal lifetime 18sが実プレイ上短すぎないか。

## 14. Review Request

レビュー観点:

- simulation責務境界が崩れていないか。
- stats/result/debug exportで回復量が追えるか。
- random dropのテストがflakyにならないか。
- heal dropが既存random streamへ副作用を出さないか。
- balanceProbeに入れるKPIが過剰または不足していないか。
- `Pickup` 型をunionにしない判断が妥当か。

QA観点:

- プレイヤーにとって混乱しそうな挙動がないか。
- HP満タン時回収が不自然に見えないか。
- heal pickupが画面上で敵弾と見間違えないか。
- 低HP時に拾いに行くリスクが成立するか。
- 「回復できるから雑に被弾してよい」バランスにならないか。

## 15. Review / QA Findings Incorporated

### 15.1 Technical Review

Blocking findings:

- pickup同士の重なり回避が現行実装に存在しない。
- HP0同フレームでheal pickupを拾うと蘇生できる可能性がある。
- heal dropが既存random streamを消費すると、upgrade choicesやspawn順へ副作用が出る。

対応:

- pickup placementを既存pickupも見る仕様へ変更する。
- fatal frame ruleを追加し、同フレーム蘇生を禁止する。
- heal dropはhash rollで決定し、既存 `RandomSource` を消費しない。

### 15.2 QA Review

Blocking findings:

- pity式が曖昧。
- HP満タン時のheal countが誤読されやすい。
- 同一killのXP+heal同時spawnテストが不足。
- 赤系heal pickupは敵弾やchaserと混同し得る。
- 長時間残るheal pickupが画面ノイズになる可能性がある。

対応:

- pity式を明文化した。
- `healPickupsCollected` と `effectiveHealPickupsCollected` を分ける。
- 同時spawn/同時回収テストを追加する。
- heal visualを白medkit風 + 赤十字へ変更する。
- heal lifetimeを追加し、XPとは異なり期限切れで消す。

### 15.3 Readiness

レビュー反映後の判定:

- 実装着手可。

ただし、実装後にbalanceProbe結果を見てdrop chanceとheal量を再調整すること。

## 16. Implementation Result

実装日: 2026-06-24

実装概要:

- `Pickup.kind` を `xp | heal` に拡張した。
- heal dropは `config.seed`, `enemyId`, `enemyType`, `healDropRollIndex` からhash rollで決定し、既存 `RandomSource` は消費しない。
- `healDropMissCount` とpity式をruntimeへ追加した。
- XPとhealが同一killから出る場合はXPを先に置き、heal placementは既存pickupとの重なりを避ける。
- heal pickupはmagnet対象になり、寿命切れで `pickup.expired` を出す。
- HP0になった同フレームではpickup collectionをスキップし、healによる蘇生を禁止した。
- `hpRecovered`, `healPickupsCollected`, `effectiveHealPickupsCollected` をstats/result/debug export/balanceProbeへ追加した。
- heal pickupは白いmedkit風の描画にし、XP/敵弾/敵と識別しやすくした。
- dev-only `setHealPickupFixture()` を追加し、damaged/full/fatal/visualのE2E確認に使えるようにした。

バランス実測:

- `kiteCollect` survival p50: 110.8s
- `kiteCollect` hpRecovered p50: 60
- `kiteCollect` healPickupsCollected p50: 18
- `kiteCollect` effectiveHealPickupsCollected p50: 5
- v0.2 baseline比で20%以内の変動に収まったため、初期値は据え置きとした。

検証:

- `npm run typecheck`: passed
- `npm test -- --run`: 11 files, 78 tests passed
- `npm run test:e2e`: 21 Playwright tests passed
- `npm run build`: passed, existing Phaser bundle size warningのみ

更新したvisual regression:

- `arena-heal-pickup.png` を新規追加。
- `arena-game-over.png` は回復KPI表示追加に伴い更新。
