---
title: 記録軸と比較条件の契約
description: Standard、Assist、Practiceを序列化せず、mode、modifier、保存方針、比較可否を分離するADR。
---

最終更新日: 2026-07-25

## 状態

`PH-V08-024` Milestone 6の設計決定。pure contractとfixtureを先行し、
Assist gameplay、永続schema変更、結果画面への接続は後続Issueへ送ります。

## 文脈

Standardへ支援runを混ぜず、PracticeからPBや報酬を更新しない境界が必要です。
一方、Standard、Assist、Practiceを強さ順の`division`へ押し込むと、
次の異なる責務が一つの値へ集約されます。

- 何を遊んだか: mode、stage、difficulty。
- simulationを何が変えたか: version付きmodifier。
- 履歴を保存するか: record policy。
- どの条件と比較できるか: comparison policy。
- プレイヤーへ何と表示するか: Standard、Assist、Practice。

既存のRunRecord v2 / v3は`modifierIds`、ruleset、seed区分、実seed、
weapon、`rankEligibility`を既に持ちます。現行Standardの比較キーへ
modifierを後付けすると、公開済みPBの見かけ上の分断を起こします。

## 決定

### 1. 軸を分ける

記録契約では次の軸を独立させます。

| 軸 | 値 | 意味 |
| --- | --- | --- |
| 保存方針 | `record / none` | RunRecordを作るか |
| 比較方針 | `standard / condition-scoped / none` | Standard PB、同条件比較、比較なし |
| modifier impact | `neutral / simulation` | 比較条件へ影響するか |
| run origin | `manual / debug / test` | 人間の通常runか |

表示上のStandard、Assist、Practiceはこれらの軸から導出する名称であり、
大小関係を持つ単一の永続`division`ではありません。

- Standard: `record + standard`。simulation modifierを持たない。
- Assist: `record + condition-scoped`。同じ正規化済みsimulation modifierだけで比較する。
- Practice: `none + none`。PB、比較履歴、報酬を更新しない。
- TrainingとStory onboarding: `none + none`だがPractice表示へ自動分類しない。

simulation-neutralな色覚、字幕、音量、キー割当は比較条件へ入れず、
Standard eligibilityを失わせません。

### 2. modifierを正規化する

新しいmodifierは構造化された`id`、`version`、`impact`で定義します。

- `id`: 小文字英数字を基本とするdot / hyphen区切り。
  例: `assist.damage-taken`。
- `version`: 1以上の整数。意味または数値が変わる場合は増やす。
- canonical key: `<id>@v<version>`。
  例: `assist.damage-taken@v1`。
- 並び順: canonical keyの昇順。
- 同じID・version・impactの重複: 1件へ畳む。
- 同じIDに異なるversion、または同じID・versionに異なるimpact:
  不正なrun構成として拒否する。

`neutral`は表示・監査用に保持できますが、比較partitionへ入れません。
`simulation`だけをAssistの同条件キーへ入れます。

既存の`auto-fire:on / off`と`contract:standard`は公開済みStandardを
維持するためのlegacy互換allowlistとして解釈します。これは新しい
modifier命名規則の前例にはせず、新規modifierはversion付き形式だけを使います。

### 3. comparison policyはfail-closedにする

- `standard`要求にsimulation modifierが含まれる場合は比較対象外にする。
- `condition-scoped`要求にsimulation modifierが1件もない場合は比較対象外にする。
- `debug / test`はStandardにもAssist同条件比較にも入れない。
- 保存方針`none`は比較方針も必ず`none`にする。
- 未知のpolicy、modifier、旧rulesetをStandardへ推測昇格しない。

Assistの比較partitionは、現行のmode、stage、difficulty、ruleset、
random / fixed、実fixed seed、overall / weapon scopeに、
正規化済みsimulation modifier列を追加したものです。

### 4. 現行Standardの比較を変えない

Milestone 6では`RunComparisonQuery`、RunRecord v2 / v3、
LocalStorage envelope、ランキング保存groupを変更しません。

Standardの問い合わせは既存`createRunComparisonQuery()`をそのまま使い、
次を維持します。

- randomとfixedを分離し、fixedは実seedまで一致させる。
- overallとweapon別PBを両立させる。
- rulesetVersionの異なる記録を混ぜない。
- Expedition敗北で勝利PBを上書きしない。

新しいcondition-scoped partitionはpure contractとして定義しますが、
Assist runtime候補が事前登録されるまで保存・ランキングへ接続しません。

### 5. 旧記録は読み取り時に解釈する

Milestone 6では既存bytesを書き換えません。v2 / v3記録を次の順で解釈します。

1. mode、stage、rulesetVersionに一致する既知profileを特定する。
2. profileが`standard`で、manualかつrank eligibleであることを確認する。
3. modifierが空、またはlegacy Standard allowlist内だけであることを確認する。
4. 条件を満たす記録だけを既存Standardとして解釈する。

`legacy-unknown`、未知profile、非Standard ruleset、未知modifier、
rank ineligibleは保存履歴を削除せず、Standard比較から隔離します。
既存のv2からv3へのcopy-on-read migrationと旧store同期は変更しません。

## 実装境界

今回実装するもの:

- version付きmodifierの正規化。
- 保存方針と比較方針を解決するpure function。
- Standard / condition-scoped / noneの比較partition。
- 既存v2 / v3をStandardまたは隔離へ分類するpure function。
- candidate-off Standardの比較結果が既存実装と同一であるfixture。

今回実装しないもの:

- Assistのdamage、telegraph、continueなどのgameplay。
- 新しいPractice target、報酬、unlock。
- RunRecord schema v4や既存LocalStorage bytesの書換え。
- 開始画面・結果画面・履歴へのAssist表示。
- 失敗履歴に基づく隠れたDDA。
- 旧Overloadを新しい比較divisionとして復活させること。

## rollback

pure contractは現行ranking経路へ接続しないため、rollbackは新規moduleと
参照docsの削除だけで完了します。RunRecord、LocalStorage、ruleset、
runtime挙動へmigration rollbackは発生しません。

## 検証

最低限、次をfixtureで固定します。

1. neutral設定を持つmanual runはStandardを維持する。
2. simulation modifierをStandardへ混ぜようとするとfail-closedになる。
3. Assist条件は順序に依存せず、同じmodifier集合だけが同じpartitionになる。
4. Practice / Training相当の`record: none`は比較partitionを作らない。
5. candidate-off Standardのquery、PB、ランキング順が現行関数と一致する。
6. 既知v2 / v3 Standardを失わず解釈できる。
7. 未知ruleset、非Standard ruleset、未知legacy modifierをStandardへ混ぜない。

## 後続

最初のAssist runtime候補は別Issue・別rulesetで1件だけ事前登録します。
そのIssueでschema、保存partition、開始・結果表示、同条件再挑戦を接続し、
Standardへ戻す導線とcandidate-off回帰を改めて検証します。

