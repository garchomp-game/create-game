---
title: 最大密度の可読性・警告音 事前監査
description: 現行fixture、描画順、音声routeを棚卸しし、最大密度で守る情報と最小実装単位を定義する。
---

最終更新日: 2026-07-20

## 目的

[#80 最大密度の視覚fixtureと警告音分離](https://github.com/garchomp-game/create-game/issues/80)へ着手する前に、現行の証拠で保証できることと、まだ保証できないことを分けます。

このページは実装前の監査です。色、音色、最終asset、警告文は[#66](https://github.com/garchomp-game/create-game/issues/66)の採用後に固定します。危険反転candidateのringは[#76](https://github.com/garchomp-game/create-game/issues/76)の採用時だけ追加します。

## 現行証拠

### 画像fixture

`arena-visual.spec.ts`には33枚のLinux / Chrome基準画像があります。次の状態は既に個別に固定されています。

- Endlessの通常wave、危険予告、崩壊、15分相当HUD。
- XP、回復、通常敵弾、敵4種、画面外indicator。
- ExpeditionのCommander、Charger予告、Boss phase 2のsalvoとcommand-pulse。
- Commanderのportrait、Bossのportrait、選択画面のdesktop / portrait。
- Pulse外周反射、Spread分裂、照準cursor。

ただし、Expeditionの固定worldは1体から4体程度で、通常敵弾も多くて1発です。現在の基準画像は**部品と画面構成の回帰**を保証しますが、最大密度での識別を保証しません。

### 長時間負荷

15分hardware soakは敵、player bullet、enemy projectile、Pickupの最大数、FPS、frame p95、heap、WebGL非空を測ります。上限は現在、敵96体、敵弾256発、Pickup 2,000個です。

各最大値はsample期間中の別フレームでも成立するため、その数値だけから「最も混雑した同一フレーム」を再構築できません。また、soak終了時の画像は最大密度到達時とは限りません。

### 描画順

worldの現在の描画順は次です。後にあるものほど前面へ描かれます。

1. 崩壊領域、Pulse外周、Expedition予告。
2. 障害物。
3. Pickup。
4. player bullet。
5. enemy projectile。
6. enemyと画面外indicator。
7. 照準guide、player。

playerはworld内で最後に描かれるため輪郭を失いにくい一方、Pickupと危険領域は敵や敵弾の下へ隠れます。feedback layerはworldとHUDより前面のdepth 14にあり、被弾flashもHUDを含む画面全体へ重なります。

### 警告音

現行routerは9種類のcueから15個の生成SE assetを使います。別に2本のBGMがあり、高頻度SEにはvariantとcue別cooldownがあります。

一方で、次の意味が同じ音へ集約されています。

- 危険event開始、Boss攻撃実行、Charger突進開始、player被弾が`damage`。
- 危険予告、Boss攻撃予告、Charger予告、level upが`levelUp`。
- Act変更、Boss出現、Commander出現、強化選択が`upgrade`。

異なるcueは同一frameでもそれぞれ再生できます。重要度による排他、ducking、同時発音上限はなく、event配列順が体感へ影響します。`getLastCues()`は再生要求を記録するため、mute、cache未読込、cooldownで実際に鳴らなかったcueも含みます。

## 守る情報の優先順位

最大密度ではすべてを同じ強さで見せません。判断に必要な順を固定します。

| 優先 | 情報 | 最低限の手掛かり |
| --- | --- | --- |
| 1 | player位置、直近衝突、差し迫る敵弾 | 輪郭、core、進行方向 |
| 2 | Boss / Charger / 危険反転の予告 | 形、方向または安全境界、専用警告音 |
| 3 | 回復と退避経路 | 色以外の十字形、障害物境界 |
| 4 | 優先標的 | silhouette、固有mark、Commander / Bossの外周mark |
| 5 | XP、player bullet、通常hit演出 | 密度に応じて抑制してよい |

XPや通常hit演出を薄くすることは許しますが、simulation上の当たり判定、Pickup位置、敵弾位置は変えません。

## 固定fixtureの最小構成

実ランの観測値から密度を凍結し、次の4状態を同じbuilderで作ります。個体数を画面の見栄えから後付けせず、RC6 fixed runの同時count分布とhard capを記録してから値を決めます。

| ID | 状態 | 必須の重なり |
| --- | --- | --- |
| `endless-pressure` | Endless終盤 | player、四方の通常敵、敵弾、XP、回復、障害物、外周反射 |
| `expedition-commander` | Commander active | Commander、護衛、通常wave、回復経路、HUD objective |
| `expedition-charger` | Charger prepare | 予告線、差し迫る敵弾、障害物、通常敵。#76採用時だけ反転ringも追加 |
| `expedition-boss-phase2` | command-pulseまたはsalvo予告 | Boss、通常wave、Boss弾、回復、遮蔽、Boss HUD |

各fixtureはworld状態、event列、表示用wall-clockを分けます。乱数で配置せず、entity IDと配列順を固定します。

## 画像比較

各状態を次のviewportで確認します。

- 960 x 540: 基準desktop。
- 390 x 844: portrait。CanvasだけでなくDOM overlayを含む`#game`を撮る。
- 1365 x 600: 横長。左右余白とHUD占有を確認する。

画像差分だけで可読性を自動判定しません。構造assertと目視票を組み合わせます。

### 構造assert

- fixtureのentity countと重要entity IDが一致する。
- player、回復、Boss / Commander、差し迫る敵弾がarena内に存在する。
- 予告線または安全境界が対象攻撃と同じ方向・半径を使う。
- HUD、warning、choice overlayの表示stateが意図どおりである。
- WebGL canvasが非空で、simulation / event hashが表示変更前と一致する。

### 目視票

1. 1秒以内にplayer位置を指せる。
2. 次に避ける敵弾または予告方向を指せる。
3. 回復とXPを色名を使わず説明できる。
4. Boss / Commander / Chargerを通常敵から識別できる。
5. HP、目的、危険表示を読み間違えない。

画像更新者本人だけで合格にせず、#81で少なくとも別の観測者1名の結果を残します。

## 警告音の最小契約

asset名と意味を分離し、semantic cueへ優先度を持たせます。

| 優先 | semantic cue | 例 |
| --- | --- | --- |
| 4 | terminal | 勝利、敗北 |
| 3 | imminent hazard | Boss予告、Charger予告、危険event予告、崩壊開始 |
| 2 | player state | 被弾、回復、level up、選択確定 |
| 1 | combat texture | shot、hit、kill、XP取得 |

同一frameでは最上位を必ず1件通し、下位の同時発音数へ上限を持たせます。危険予告をshot / hit / pickupのcooldownと共有しません。勝利時に敗北音を重ねない既存契約は維持します。

最初から音響libraryや動的mixing engineは導入しません。現在のrouterへ、純粋な`selectAudioCues(events)`と再生結果telemetryを足せば検証できます。

telemetryは少なくとも次を分けます。

- `requested`: eventから要求されたsemantic cue。
- `played`: 実際に再生APIへ渡したcueとasset。
- `suppressed`: priority、cooldown、mute、asset unavailableの理由。

## 実装単位

1. RC6固定runから同時count分布を抽出し、4 fixtureの値をIssueへ事前登録する。
2. `ArenaDebugFixtures`へ最大密度builderを追加し、既存の小規模fixtureは残す。
3. desktop / portrait / 横長の構造assertと画像を追加する。
4. semantic cueと同一frame arbitrationを純粋関数で追加する。
5. 警告音を視覚fixtureと同じevent列で検証する。
6. 実GPUで短時間render計測を行い、必要な場合だけ装飾量を減らす。
7. #81の目視票で採用、再調整、棄却を決める。

## 採否基準

- 最大密度でも優先1から3を別の観測者が識別できる。
- command-pulse、Charger予告、通常敵弾を取り違えない。
- 警告音がcombat SEで抑制されず、同時発音が増え続けない。
- gameplay、score、spawn、RunRecord比較scopeを変えない。
- 表示candidate無効時のsimulation / event hashがRC6と一致する。
- frame p95、個体上限、音声例外が既存品質予算内に収まる。

## 対象外

- 全敵のbitmap化、shader追加、particle engine置換。
- BGMの全面差し替え。
- 危険反転、武器数値、敵密度の同時調整。
- screenshotのpixel差だけによる自動採用。
- production trafficの更新。
