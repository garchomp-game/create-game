---
title: 危険反転の実装前比較
description: 既存eventと戦闘境界から、最初の危険反転candidateと副作用を実装前に整理する。
---

最終更新日: 2026-07-20

## 目的

[#76 Charger衝突妨害による危険反転](https://github.com/garchomp-game/create-game/issues/76)で、最初から危険全体を作り直さず、Arena Coreらしい1件を比較可能な形へ絞ります。

第一candidateはCharger衝突妨害へ決定済みです。ただし採用済み機能ではありません。半径、持続、対象上限、対象enemy kind、観察windowはbaseline観測後、コード変更前に[#76](https://github.com/garchomp-game/create-game/issues/76)へ事前登録します。世界観上の名称と最終表現は[#66](https://github.com/garchomp-game/create-game/issues/66)で決めます。

## 現行実装の事実

### Endless危険イベント

`rangedSurge`、`swarmRush`、`bruteSiege`は、warning、active、recoveryの時計と、敵構成、出現間隔、予算の一時上書きを持ちます。

- active中に独立した危険領域や攻撃主体は生成しない。
- `recovery`は専用spawn上書きを外すだけで、通常waveと残敵を止めない。
- 既存eventは開始、終了、区間別移動、被ダメージ、撃破を集約する。
- 「何体を危険へ巻き込んだか」「反転で何が起きたか」は記録しない。

この3件へ敵damageを直接足すと、危険の見た目、当たり判定、kill attribution、XP、score、dropまで一度に新設する必要があります。

### Charger

Chargerは既に次の決定論的境界を持ちます。

- 画面内、最大300px、前方84px以上の安全経路がある場合だけ予告する。
- 0.6秒予告、0.3秒準備、方向固定の0.65秒突進、1.05秒停止。
- 同時予約は最大2体。
- 終了理由を`timeout | obstacle | arenaBoundary`で記録する。
- プレイヤー被弾、回避、障害物停止、外周停止、回復、武器別撃破を集約する。

プレイヤーは既に「進路を外す」という基本成功を学べます。ここへ「衝突地点へ敵を寄せる」という熟練成功を足せるため、新しい危険物をゼロから教える必要がありません。

### ボスと崩壊

- `command-pulse`は半径、予告、遮蔽、範囲外、被弾結果を持つが、Stage 10終盤だけです。
- アリーナ崩壊は領域外のプレイヤーへdamageを与えるが、600秒以降だけです。

どちらも反転の見た目は作りやすい一方、初回学習と短いpaired比較には到達が遅すぎます。

## 候補比較

| 候補 | 読める基本成功 | 熟練成功 | 実装差分 | 主なリスク | 判断 |
| --- | --- | --- | --- | --- | --- |
| A Charger衝突妨害 | 予告線から外れる | 障害物か外周へ誘導し、衝突周辺の敵を短時間止める | 既存Charger終了eventへ敵妨害結果を追加 | 密集時の停止が強すぎる、再発動farm | 第一候補 |
| B 敵弾friendly fire | 射線から外れる | 敵を射線へ誘導する | 敵弾対敵の連続衝突とkill処理を追加 | 画面密度で偶発成功が増え、射撃体自身が有利になる | 保留 |
| C Boss command-pulse | 範囲外か遮蔽へ逃げる | 雑魚をpulseへ誘導する | 既存半径判定を敵へ拡張 | Stage 10終盤だけで学習が遅い | #58以降の拡張候補 |
| D 崩壊領域 | 安全領域へ戻る | 敵を外側へ残す | 崩壊damage対象を敵へ拡張 | 10分以降だけ、安定終了圧力を弱め得る | 不採用 |

Bは射線判断に合いますが、遠距離弾が多いほど自動的に敵同士を削り、プレイヤーの意図を説明しにくくなります。Cはボス固有の見せ場には適しますが、v0.8の最初の学習対象として遅すぎます。DはEndlessの有限終了契約と衝突します。

## 第一候補: Charger衝突妨害

仮称は`Charger Impact Disruption`とします。世界観上の名称と表示文は#66後に決めます。

### 行動ループ

1. Chargerがプレイヤー位置へ方向を固定し、進路を予告する。
2. プレイヤーは進路から外れるだけで基本成功になる。
3. 熟練者はCharger、障害物または外周、敵群の位置関係を見て退避方向を選ぶ。
4. `obstacle`または`arenaBoundary`で突進が止まると、短い妨害pulseを表示する。
5. pulse内の通常敵だけを短時間停止または減速し、反撃・回収経路を作る。
6. `timeout`ではpulseを出さず、壁へ誘導した結果と自然終了を分ける。

最初のcandidateは**enemy damageを与えません**。score、XP、drop、武器別kill attributionを変えず、脅威を一時的に下げる戦術価値だけを検証します。damage化は、この行動が理解されても手応えが不足した場合の別candidateです。

### 結果分類

| 結果 | プレイヤー被弾 | 妨害対象 | 意味 |
| --- | --- | ---: | --- |
| `avoided` | なし | 0体 | 通常回避、または対象なしの誘導衝突 |
| `reversed` | なし | 1体以上 | `obstacle` / `arenaBoundary`衝突で回避と敵妨害を両立 |
| `traded` | あり | 1体以上 | 誘導衝突とplayer hitが同じattemptで成立 |
| `hit` | あり | 0体 | player hitだけが成立 |
| `expired` | なし | 0体 | timeoutで衝突・hitなしに終了 |

各attemptはこの5件の正確に1つへ分類します。`reversed`は`obstacle`または`arenaBoundary`かつ対象可能な通常敵が1体以上の場合だけ成立します。対象0体の誘導衝突はimpact事実を残しても`reversed`にせず、`timeout`は必ず`expired`で妨害を発生させません。全Chargerで反転を必須にせず、通常回避だけでもランを継続できます。

## 責務境界

| 責務 | 所有者 |
| --- | --- |
| candidate有効化、半径、持続、対象種、対象上限 | content definition |
| Chargerの予告、突進、衝突理由 | 既存`chargerEnemySystem` |
| 衝突地点から対象IDを決定する純粋計算 | 新しいhazard reversal system |
| 敵の一時妨害状態と解除 | enemy simulation system |
| attempt、排他的outcome、affected count | #76 Simulation facts |
| episode ID、共通集約scope、invalid-state | #77 pure ledger |
| ring、停止表現、警告優先順位 | Phaser World / feedback View |
| 成果文言と次回目標 | #77 ledger / Presenter |

`chargerEnemySystem`へ描画、score、文言、RunRecord保存処理を入れません。既存`enemy.killed`は`weaponType`とbullet IDを必須にするため、最初のcandidateで流用しません。

## eventと集約の最小案

```ts
type HazardReversalOutcome =
  | "avoided"
  | "reversed"
  | "traded"
  | "hit"
  | "expired";

type HazardReversalResolved = {
  type: "hazard.reversal.resolved";
  hazardId: "charger-impact-disruption";
  sourceEnemyId: string;
  impactReason: "obstacle" | "arenaBoundary" | "timeout";
  position: Vec2;
  affectedEnemyIds: string[];
  playerHit: boolean;
  outcome: HazardReversalOutcome;
  elapsed: number;
};
```

集約はattempts、5 outcome別件数、affected合計・最大、反転可能対象の有無、妨害window内のplayer damage、最初の反撃、最初の回収を候補にします。outcome合計はattempt総数と常に一致させます。詳細ID列は開発run exportへ残し、最初からローカル履歴へ無制限保存しません。

## Pulse / Spreadの公平性

反転の成立条件は移動と位置だけにし、特定武器の弾を鍵にしません。

- Pulse: Chargerを早く倒し切らず、進路上の優先標的と衝突後の列を狙う余地がある。
- Spread: 敵群を近距離で捌きながら、妨害pulse後の複数標的を処理する余地がある。

武器ごとの専用damage倍率やscore倍率は入れません。両武器で`avoided`と`reversed`を固定fixture化し、反転後の撃破差は観測だけに留めます。

## fixture

最低限、次を決定論的な短時間fixtureにします。

1. 四辺それぞれで通常回避し、対象0体の`avoided`になる。
2. 四つの障害物それぞれへ誘導し、対象1体以上の`reversed`になる。
3. 外周衝突でも予告方向とimpact位置が一致する。
4. Chargerがプレイヤーへ当たった場合、`traded`または`hit`へ分かれる。
5. timeoutでは妨害せず`expired`になる。
6. Boss、Commander、別Charger、自分自身を対象外にする。
7. 同一attemptで二重分類、二重発動、解除漏れ、次Encounterへの効果残留がない。
8. 対象選択、適用順、解除時刻が同一seed / input / 30、60、120、144Hzで一致する。
9. Pulse / Spread双方で通常回避と反転成功が成立する。
10. score、XP、drop、kill attributionがbaselineから変わらない。
11. candidate無効時にRC6のevent / world hashが一致する。
12. 最大密度とportraitで予告線、プレイヤー、敵弾、pulse ringが重なっても識別できる。

対象IDはworld配列順ではなく安定した距離とID順へ正規化し、描画フレームレートで結果を変えません。

## 採否前に決める値

- `effectRadius`、`durationMs`、`maxTargets`。
- 対象となる通常enemy kindと、一時妨害の内容。
- obstacle / arena boundaryの衝突判定。
- 反転後の反撃・回収・位置改善を観測するwindow。
- baseline SHA、candidate branch / ruleset、seed、weapon、rollback。
- #81で使う分母付きraw-count基準とstop condition。

値はbaselineのfixed fixtureを確認した後、candidateコード変更前にIssueへ事前登録します。実ラン結果を見てから同じcandidateの値、有利なseed、閾値を変更しません。変更する場合は別candidateとして登録します。

## 対象外

- 敵弾friendly fire、Boss pulse、崩壊damageの同時実装。
- hazard killによるscore、XP、drop。
- 危険イベント3種の置換。
- 新しい物理・steering library。
- 観戦AIをcandidate成功条件へ最適化すること。
- production trafficとRC6記録の上書き。

runtime実装は、PR #89の境界修正がmainへ統合されてCIがgreen、#77の最小schema、#80のwarning / impact最低fixture、#81のbaseline手順が利用可能になった後に進めます。
