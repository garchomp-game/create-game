---
title: v0.8 観測可能性の事前監査
description: 技能ledgerと選択テンポ計測について、既存event、追加計装、責務境界を実装前に整理する。
---

最終更新日: 2026-07-23

## 目的

[#77 技能shadow ledger](https://github.com/garchomp-game/create-game/issues/77)と
[#78 選択テンポ計測](https://github.com/garchomp-game/create-game/issues/78)へ着手する前に、既存コードから取得できる事実と、追加計装が必要な事実を分けます。

この監査は実装前の棚卸しです。ゲーム数値、candidate固有の合格閾値、表示文言は変更しません。[#83 緊張・緩和と難易度支援の設計契約](https://github.com/garchomp-game/create-game/issues/83)は判断済みであり、本ページは最新の責務表へ同期します。

2026-07-23のEX Protocol candidateは、この共通監査を使いながら、Protocol固有factとRunRecord v3をfeature限定で実装しました。productionの共通ledger採用とは分け、候補OFFではv1 / v2保存と既存event経路を維持します。

## 結論

- Pulseの集束成果、反射後命中、Spreadの掃射、Charger回避は、既存の決定論的eventと集約値から一部をすぐ再利用できます。
- 予告単位の回避、安全回収、被弾後の立て直し、near-missは、現行の集約値だけでは因果と時間窓を復元できません。
- 強化候補の提示中はsimulation時計が停止します。既存の`upgrade.offered`と`upgrade.selected`の時刻差は、実際の思考時間を表しません。
- 選択時間はブラウザの単調増加時計、選択後1秒はsimulation時計で測り、同じ値として扱いません。
- UI計装はsimulation event、乱数、`RunRecord`、ランキング適格性へ影響させず、まず開発用run exportだけへ出します。
- 共通経路は`Simulation facts → pure ledger aggregation → Presenter`とし、#77はcandidate固有の意味や合格値を所有しません。

## 現在のデータ経路

| 層 | 現在の所有物 | 永続性 |
| --- | --- | --- |
| Simulation | `GameEvent`、`RunStats`、`world.state.elapsed` | `RunRecord`へ要約、一部は開発run exportへ詳細出力 |
| Application | `RunLifecycleController`、run context、保存調停 | ローカル履歴とランキング |
| DOM / Phaser adapter | pointer、keyboard、選択DOM、描画フレーム | 現在は選択操作の入力元と実時間を保存しない |
| Telemetry adapter | `ArenaRunExport`、CSV要約、直近20 event | 開発環境のローカル出力。オンライン送信なし |

`stepWorld()`は`upgradeSelect`と`contractSelect`で`dt = 0`として返します。そのため、選択画面を10秒表示しても`world.state.elapsed`は進みません。
これは戦闘ルールとして正しく、UI滞在時間の時計としては使えない、という二つの性質を分けます。

## #77 技能ledgerの材料

### 既存集約をそのまま使える候補

| 技能候補 | 算出元 | 現在言えること | 制約 |
| --- | --- | --- | --- |
| Pulse集束成果 | `pulse.focus.hit`、`weaponIdentityMetrics.pulseFocus` | 強化命中数、追加damage、最大stack、敵種別撃破 | 集束を維持した実時間は未計測 |
| Pulse反射活用 | `bullet.ricocheted`、`enemy.hit`、`capstoneMetrics` | 障害物・外周別の反射数、反射後命中・撃破 | 「狙って作った経路」か偶発命中かは判別しない |
| Spread掃射 | `spread.sweep.triggered/consumed`、`weaponIdentityMetrics.spreadSweep` | 発動、消費、最大同時標的数 | 斉射ごとの分布はローカル`RunRecord`に残らない |
| 異なる敵への命中 | `enemy.hit.volleyId`、`weaponComparisonMetrics` | 開発run exportでは斉射あたりの異なる敵数を集約済み | 現行`RunRecord`はこの集約を保存しない |
| Charger回避 | `enemy.charger.charge.ended`、`encounterMetrics.charger` | 回避、障害物停止、外周停止、被弾を区別 | Charger以外の予告回避へ一般化しない |
| ボス攻撃対処 | `boss.command-pulse.resolved`、boss攻撃別被弾集約 | command-pulseの遮蔽・範囲外・被弾を区別 | 他の攻撃は「予告を見て避けた」結果を直接持たない |

### 追加計装が必要な候補

| 技能候補 | 足りない情報 | 実装判断 |
| --- | --- | --- |
| 集束維持時間 | target継続区間とsimulation時刻 | 集束状態の開始・切断理由を決定論的に集約する |
| 予告回避 | 予告ごとの対象、危険範囲、終了時結果 | hazardごとの結果eventを定義する。全hazard共通化は#76後に判断する |
| 被弾後の立て直し | 被弾、回復、生存を結ぶ時間窓 | #94が時間窓と「立て直し」の成立条件を所有し、#77で純粋集約する |
| 安全回収 | 取得時の危険度、直後被弾、回収経路 | 危険度の正本を先に決める。単なる取得数を成功扱いしない |
| near-miss | ボス残HP、到達phase、直前成功、敗北理由の統一契約 | #94が再計算可能な成立・非成立条件を所有する。距離だけのnear-miss eventは追加しない |
| 危険反転 | 予告、回避、敵巻き込み、脅威減少の結果 | #76が決定論的eventを所有し、ledgerは結果を読むだけにする |

ledgerはevent producerになりません。Simulationが事実を生成し、純粋な集約器が要約し、Presenterが最大3件の成果と1件の目標へ変換します。
武器に成立しない指標は分母から外し、失敗として数えません。

### 指標の所有者

| Issue | 所有する意味 | #77が提供するもの |
| --- | --- | --- |
| [#76](https://github.com/garchomp-game/create-game/issues/76) | Charger attempt、排他的outcome、affected count、反転後window | episode ID、scope、共通summary境界 |
| [#93](https://github.com/garchomp-game/create-game/issues/93) | `warningResponseRate`、`punishConversion`、`repairOffsetRate`、`centralOrbitShare`、exposure別被弾 | 攻撃episodeを集約できる共通fact |
| [#94](https://github.com/garchomp-game/create-game/issues/94) | 主敗因、factual near-miss、`causeMatch`、`retryLatencyMs`、次の一手 | 決定論的集約とinvalid-state |
| [#78](https://github.com/garchomp-game/create-game/issues/78) | 選択wall-clock、再開window、入力元 | run / choice scope。wall-clock値は共通simulation factへ入れない |
| [#79](https://github.com/garchomp-game/create-game/issues/79) | Pulse / Spread Doctrine固有指標 | weapon / ruleset / seedを保持する共通scope |

EX Protocol candidateでは、#79の後継比較物としてProtocol route、special、固有effect、damage帰属を別の`exProtocolMetrics`へ集約します。共通ledgerへcandidateの採否閾値を持ち込まず、catalog IDと上限付きcounterだけを保存します。

[#95](https://github.com/garchomp-game/create-game/issues/95)は`division`、modifier、比較eligibility、migrationを所有します。#77はそのscopeを保持しますが、Standard / Assist / Practice / Overloadの比較規則を独自に決めません。

## #78 選択テンポの時計

### 現行値の意味

- `progressionMetrics.offers/selections`はsimulation時刻です。
- 通常強化とEX強化の候補ID、rank、levelは既に識別できます。
- 契約の提示・選択時刻もsimulation時刻で、選択中には進みません。
- DOMの数字キーは最終的に`button.click()`へ合流するため、現状はkeyboardとpointerを区別できません。
- 選択後の移動、照準、射撃、被弾を1秒間まとめるsessionはありません。

### 二つの時計

| 観測 | 時計 | 理由 |
| --- | --- | --- |
| 選択画面の実表示時間 | 注入した`performance.now()`相当の単調増加時計 | プレイヤーが実際に考えた時間を測る |
| 選択後1秒の戦闘復帰 | `world.state.elapsed` | タブ停止や長い描画フレームを戦闘時間へ混ぜない |
| 候補間隔とラン段階 | `world.state.elapsed` | ゲーム進行とXP曲線を比較する |

`Date.now()`を直接呼びません。試験用fake clockを注入できる小さいportを使い、wall-clock値を`GameEvent`へ入れません。

## 推奨する責務境界

### #77 Phase 0 fact kernel

Phase 0は候補固有の意味、永続化、表示を持たない純粋な事実境界です。`GameEvent`自体へ時刻やIDを追加せず、観測側が次のenvelopeを作ります。

```ts
type ObservedGameEvent = {
  sequence: number;
  elapsed: number;
  event: GameEvent;
};
```

`sequence`は同一simulation時刻内のtie-break、`elapsed`は観測時のsimulation timeです。集約器は`elapsed → sequence → event.type`でコピーを正規化し、入力配列とevent payloadを変更しません。

#### scopeとepisode

`RunContext`から次をコピーしてread modelへ保持します。

- run / anonymous profile ID
- mode / stage / difficulty
- weapon / ruleset / seed / seed category
- modifier IDs / app version / build commit
- run origin / ranking eligibility

episode IDは`run ID + kind + subject ID + occurrence`から決定論的に生成します。Phase 0で使うkindは`run / encounter / opportunity`だけです。#76や#94は同じ規則を利用できますが、opportunityの成功条件を#77で決めません。

#### 4状態

| 状態 | 意味 | 例 |
| --- | --- | --- |
| `available` | 事実を入力から確定できる | 通常runのdamage合計、Expedition終端 |
| `not-reached` | 有効なrunだが対象状態へまだ到達していない | `game.started`後、終端event前 |
| `unavailable` | 事実は存在しても対象の比較scopeへ入れない | debug / test / ranking不適格runのStandard熟練履歴 |
| `invalid` | 入力契約が壊れ、成功・失敗を判定できない | start欠落、重複sequence、負時刻、矛盾終端 |

未到達、対象外、壊れた入力を失敗件数へ変換しません。divisionは[#95](https://github.com/garchomp-game/create-game/issues/95)の所有物であり、現段階では`modifierIds`と`rankEligibility`を保持するだけです。

#### 現在集約するfact

- damage timeline、総damage、hit数、contact / projectile / collapse / unknown別damage、最終damage。
- REPAIR取得timeline、表示回復量、実回復量。
- kill timeline、敵種別kill、付与score / XP。
- Endlessの`game.over`、Expeditionのcompleted / failed終端。Expedition終端と同時の`game.over`は重複失敗にしません。

これらはin-memory read modelであり、`RunRecord` schema、ランキング比較、ローカル保存、開発run exportへまだ接続しません。runtimeからもimportしないため、score、drop、RNG、event / world hashを変更しません。

#### 後続へ残す不足fact

| 利用Issue | Phase 0で利用可能 | まだ不足している事実 |
| --- | --- | --- |
| #94 | simulation時刻付きdamage / heal / kill、終端、同条件scope | ボス残HP snapshot、Commander / 護衛の生存状態、主因3〜5秒窓のruntime capture |
| #76 | 共通episode ID、scope、既存Charger eventを包めるenvelope | 意図的誘導、巻き込んだ敵数、反転後windowの結果event |
| #93 | encounter / opportunity episode ID、damage / heal timeline | exposure ID、攻撃別終了結果、中央周回の位置sample |
| #79 | weapon / ruleset / seed scope | Doctrine固有の成立条件と比較閾値 |

不足factは所有Issueが意味を定義してから、simulationの結果を確定するsystemが追加します。#77は推測した成功eventを生成しません。

### Simulation facts

gameplay結果を確定したsystemが、安定したepisode ID、simulation時刻、対象ID、結果を生成します。wall-clock、表示文言、採否閾値を含めません。candidate無効時は既存event / world hashへ戻せる境界を持ちます。

### Pure ledger

#77の純粋集約器は、event欠落、`not-reached`、対象weaponでは不可能、invalid runを区別し、weapon / ruleset / seed / divisionを保持します。詳細eventを無制限保存せず、同じ入力から同じsummaryを返します。

### Presentation

`ArenaChoicePresenter`は、表示phase、候補ID、候補数、安定したsignatureを返します。計測用の時計や保存処理は持ちません。

### DOM adapter

`ArenaChoiceOverlay`は選択入力へ`keyboard | pointer`の入力元を付けます。keyboard操作が`button.click()`を経由しても、発火前に入力元を保持します。

### Application

新しい`ChoiceInteractionMonitor`を純粋に近いsession集約器として置きます。

- 選択表示開始、候補変更、選択、閉じる、run resetを受け取る。
- wall-clock表示時間とsimulation時刻を別フィールドに持つ。
- 選択直後の基準値として位置、照準、射撃数、被ダメージをsnapshotする。
- simulation時間が1秒進んだ時点で、移動距離、照準入力、射撃再開、追加被ダメージを確定する。
- `runOrigin`とauto/debug状態を持ち、人間の通常ランと混ぜない。

Phaser SceneはDOM input、解決済み`InputSnapshot`、step結果をmonitorへ橋渡しするだけにします。判定式と集計はSceneへ書きません。

主敗因・near-miss・同条件再挑戦のViewModelは#94、divisionと比較eligibilityは#95が所有します。`RunLifecycleController`へcandidate固有の判定を集約しません。

### Telemetry

最初の縦切りでは`choiceInteractionMetrics`を開発run exportへ追加し、ローカル`RunRecord` schemaは変更しません。
採用するKPIが固定され、リザルト表示や履歴比較に必要だと分かった要約だけを、将来のschema migrationで保存します。

### EX Protocol candidateの記録境界

EX Protocolを有効にしたrunは、候補rulesetだけで`RunRecord v3`とRNG schema v2を使います。

- `exProtocol`へoffered IDs、選択Protocol、E1、E2、Mastery、各到達時刻、上限付きcounterを保存する。
- `ArenaRunExport`へfeature flag、catalog version、Protocol集計を出す。
- TSV / CSVへroute、damage share、special成立率、主要counterを正規化して出す。
- debug snapshotへ進行state、charge、cooldown、Protocol gaugeを出す。
- v1 / v2はdecode後に候補collectionへreconcileするが、旧localStorage keyを自動更新しない。
- 通常保存、migration、ranking再構築で旧collectionを破壊しない。
- 明示削除だけをjournal化し、失敗時にretryできる形で対応legacy履歴へ同期する。

候補のeffect eventはsimulation elapsed、stable entity ID、activation / volley ID、Protocol IDを持ちます。player向け表示文言、wall-clock、生pointer座標をeventへ入れません。Aegisのglobal collision arbitrationは候補ONかつ選択中だけ有効で、候補OFFの既存collision順へ混ぜません。

### EX Protocol candidateのperformance gauge

長時間負荷を説明するため、次の瞬間値をdebug / soakへ出します。

- `ex.protocol.activation_trackers`
- `ex.aegis.collision_candidates`
- `ex.aegis.interception_candidates`
- `ex.aegis.collision_resolved`

Tidal activation trackerは所属projectile消滅後に0へ戻ること、Aegis候補数と1 frameのcollision event上限を超えないことを検査します。通常runの永続recordへframe単位の生値を保存しません。

## 最小データ契約案

実装時に名前は再確認しますが、必要な意味は次です。

```ts
type ChoiceInteractionSample = {
  phase: "upgrade" | "extra" | "contract";
  candidateCount: number;
  selectedId: string;
  selectedIndex: number;
  inputMethod: "keyboard" | "pointer";
  openedAtSimulationSeconds: number;
  selectedAtSimulationSeconds: number;
  visibleDurationMs: number;
  resumeWindow: {
    completed: boolean;
    movementDistance: number;
    aimInputFrames: number;
    shotsFired: number;
    damageTaken: number;
  };
};
```

生のwall-clock時刻、pointer座標、個人識別情報は保存しません。表示時間はdurationだけを残します。

## 自動保証

1. fake clockで通常、EX、契約の表示時間を決定論的に検査する。
2. keyboardとpointerが同じ候補を選び、入力元だけが異なることを検査する。
3. monitor有効・無効で同一seed / inputのsimulation event列と終了worldが一致することを検査する。
4. 選択後1秒の移動、照準、射撃、被ダメージを個別fixtureで検査する。
5. run reset、titleへ戻る、再選択、対象消滅で未完了sampleを漏らさない。
6. debug / auto / test originを通常プレイ集計から除外する。
7. 960 x 540と390 x 844でkeyboard / pointer双方のE2Eを行う。

## 実装順と凍結範囲

1. #77: 共通fact / episode / invalid-state schemaと、既存eventだけの純粋fixtureを作る。
2. #93 / #94: 固有指標の定義と不足factを、runtime candidateなしで整理する。
3. #95: division / modifier / eligibility / migrationの契約を別branchで保証する。
4. #70採用後の#78: 採用した`ArenaChoicePresenter`とDOM境界へ入力元を追加し、monitor、fake clock試験、開発run exportを実装する。
5. #76: 最小factを追加し、共通ledgerへ排他的outcomeを接続する。candidate固有の閾値は#76が所有する。
6. #81: baselineと各単独candidateへ同じ観察手順を再利用し、表示文言と次回目標を採否する。

次はまだ行いません。

- PR #91のdocs同期中の`RunRecord` schema変更。
- オンラインtelemetry送信。
- 選択中の無敵、候補数、XP曲線、武器数値の変更。
- #76、#93、#94、#79のcandidate固有合格値を#77で決定すること。
- debug / auto runを人間の熟練履歴へ混在させること。

この順序なら、計装がゲーム結果を変えず、#83の設計判断を後から正確な指標へ落とせます。
