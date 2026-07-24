---
title: 最大密度の可読性・警告音 事前監査
description: 現行fixture、描画順、音声routeを棚卸しし、最大密度で守る情報と最小実装単位を定義する。
---

最終更新日: 2026-07-21

## 目的

[#80 最大密度の視覚fixtureと警告音分離](https://github.com/garchomp-game/create-game/issues/80)へ着手する前に、現行の証拠で保証できることと、まだ保証できないことを分けます。

このページは実装前の監査です。viewport、layer slot、audio channel、snapshot harness、RC6 baseline fixtureの骨格は先行できます。色、音色、最終asset、警告文は[#66](https://github.com/garchomp-game/create-game/issues/66)と各candidateの意味が決まってから固定します。危険反転candidateのringは[#76](https://github.com/garchomp-game/create-game/issues/76)の単独buildだけへ追加します。

## 共通capture skeleton

2026-07-21時点の最初の実装単位は、最大密度4状態ではなく`rc6-control` 1件です。これはcapture harness自体のcontrolであり、RC6実ランの最大密度や採用候補を表しません。

### 決定論的scenario loader

debug / test専用の共通loaderが、既存のBoss phase 2 fixtureへ固定entityを追加します。乱数を消費せず、同じExpedition初期worldから同じID、配列順、位置、layer countを生成します。

| layer | `rc6-control` |
| --- | ---: |
| player | 1 |
| obstacle | 4 |
| Bossを含むenemy | 9 |
| player projectile | 4 |
| enemy projectile | 6 |
| XP / REPAIR | 4 / 2 |
| Boss telegraph | 1 |

`ArenaDebugSnapshot.captureScenario`はscenario IDと現在のlayer countを返します。これは描画対象modelが存在することを確認する観測口であり、各spriteが人間に識別できるという合格判定ではありません。

### capture matrix

共通harnessは同じscenarioを次の3 viewportへloadし、ページ全体を比較します。

- desktop: 960 x 540
- portrait: 390 x 844
- landscape wide: 1365 x 600

各captureで、layer count、Boss phase / attack、frame sample、raw frame p95、render layer時間、static background draw count、WebGL非背景pixel、page errorを確認します。portraitは現行PC向けCanvasを縮小したcontrolであり、このPRだけでmobile可読性を合格にしません。

### audio routing観測

既存cue、asset、volume、cooldown、再生順は変更せず、debug / testでだけ有効になる直近40 requestのbounded snapshotを追加します。通常production pathではrouting用objectを生成しません。

- `requested`: event type、cue、scene時刻。
- `played`: 実際に渡したasset、volume、detune。
- `suppressed`: victory terminal重複、mute、音量0、cooldown、asset未読込の理由。

すべてのrequestは`played`または`suppressed`の片方へ一度だけ解決されます。semantic priorityや同時発音上限はまだ導入せず、最終の音優先度を先回りしません。

### 非介入境界

- scenario builderはdebug moduleからだけloadし、production gameplayへ接続しない。
- 既存の小規模visual fixtureと画像を置換しない。
- simulation event、RNG、score、drop、hitbox、RunRecord、rulesetを変更しない。
- 色、音色、最終asset、候補固有の成功意味を決めない。

### 自動証拠

- unit: 66 files、431 passed、2 skipped。
- browser E2E: 76 passed、15分hardware soak 1件はopt-in skip。
- production build: 203 modules。
- Starlight: 100 pages。
- Standard deterministic fixture: event hash `0e5c664a`、world hash `47a80192`を維持。
- 3 viewportすべてでWebGL非背景pixel、page error 0、layer manifest一致を確認。

次の実装前に、RC6 fixed runの同時count分布を取得し、4つの最大密度fixture値をIssueへ登録します。

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

異なるcueは同一frameでもそれぞれ再生できます。重要度による排他、ducking、同時発音上限はなく、event配列順が体感へ影響します。`getLastCues()`は互換性のため従来どおり再生要求を返し、追加したrouting snapshotがmute、cache未読込、cooldownを分離します。

## 守る情報の優先順位

最大密度ではすべてを同じ強さで見せません。判断に必要な順を固定します。

| 優先 | 情報 | 最低限の手掛かり |
| --- | --- | --- |
| 1 | player位置、直近衝突、差し迫る敵弾 | 輪郭、core、進行方向 |
| 2 | Boss / Charger / 危険反転の予告 | 形、方向または安全境界、意味確定後の専用警告音 |
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
| `expedition-charger` | Charger prepare | 予告線、差し迫る敵弾、障害物、通常敵。#76単独buildだけ反転ringも追加 |
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

画像更新者本人だけで合格にせず、#81のpreflightと各candidate cellで別の観測者の結果を残します。少人数では割合を一般化せず、`該当人数 / 到達人数`と`not-observed / not-reached`を示します。

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

## 先行できるfixture骨格

1. RC6固定runから同時count分布を抽出し、4 fixtureの値をIssueへ事前登録する。
2. `ArenaDebugFixtures`へ最大密度builderを追加し、既存の小規模fixtureは残す。
3. desktop / portrait / 横長の構造assertと画像を追加する。
4. semantic cueのchannelと、同一frame arbitrationの純粋関数境界を作る。
5. RC6 baselineで実GPUの短時間render計測を行う。

ここまでは#76 / #93のruntime candidateを待ちません。fixture骨格はgameplay balance、色、音色、警告優先度を決めず、RC6のworld / eventを再現するだけにします。

## 意味確定後に行うこと

1. #76のimpact / 妨害状態と[#93](https://github.com/garchomp-game/create-game/issues/93)のBoss Attack Cardに、candidate固有の形、色、音を割り当てる。
2. 視覚fixtureと同じevent列で、requested / played / suppressedのaudio結果を検証する。
3. #66の視覚方向を反映し、色だけに依存しないことを確認する。
4. 実GPUで再計測し、必要な場合だけ装飾量を減らす。
5. #81の同一目視票をbaseline、各単独candidate、統合buildへ再利用する。

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

fixture骨格、candidate固有表現、最終assetを同じPRへまとめません。これにより#76 / #93と#80の循環依存を避けます。
