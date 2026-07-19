---
title: 最終遠征RC6の時計と記録規則
description: Encounter Directorの時計、Commanderの期限、Expedition記録の比較scope、ruleset分離を固定するADR。
---

最終更新日: 2026-07-19

## 状態

採用。`PH-V07-010`の時計とCommanderライフサイクル、`PH-V07-011`の記録規則とRC6 rulesetは2026-07-19に実装済みです。`PH-V07-012`では2400 HPの有限回復候補を棄却し、RC6 controlを維持しました。統合QAとproduction採否は未完了です。

## 文脈

RC5は第10最終遠征の到達性、制圧衝撃波、回復drop制限、決定論を確認できました。一方、外部レビューと既存実装の照合から、production候補にする前に次の契約を直す必要があると判断しました。

- HUD上のAct表示だけを固定しても、Encounter Directorが時間だけで次Actへ進めば戦闘状態と表示が一致しない。
- Commanderの120秒制限をカード選択時から数えると、出現延期中の時間まで戦闘時間として消費する。
- 出現上限などでCommanderを配置できない場合、無期限の再試行またはカード消失のどちらも起こり得る。
- Expeditionの主記録を総クリア時間にする一方、速攻点を戦術点へ加えると同じ技能を二重評価する。
- 総合自己記録と武器別自己記録、random seedとfixed seed、RC5とRC6の比較境界が明文化されていない。

RC5は技術的な基準証跡として保持しますが、ランキング意味論を変更するRC6とは混在させません。

## 決定

### 1. 時計の所有者

ゲーム内の経過時間を次の責務へ分けます。ブラウザの実時間ではなく、simulation stepで進む決定論的な時間だけを使います。

| 時計 | 所有者 | 用途 | 停止条件 |
| --- | --- | --- | --- |
| `runElapsed` | Run Lifecycle / World | 総クリア時間、履歴、ランキング、配置再試行の期限 | 一時停止、強化選択、非プレイ画面などsimulation停止中 |
| `actElapsed` | Encounter Director | Act開始条件、Act内のカード進行 | simulation停止中、またはactive cardが`blocksActClock`を宣言中 |
| `activeElapsed` | 実行中Encounter | Commanderやボスなど、配置成功後の有効時間 | 未配置、完了、失敗、simulation停止中 |

HUDはEncounter Directorが公開する現在Actと残り状態を描画するだけとし、`runElapsed`からActを独自計算しません。Act遷移判定もEncounter Directorだけが所有します。

通常の時間制Encounterは`blocksActClock: false`、Actをまたいで存在させない構造化Encounterは`true`を明示します。RC6のCommander cardは`true`です。選択時にAct時計を止め、完了または失敗時に再開します。これにより、Commanderが名目上のAct境界へ到達しても次Actは開始せず、解決後に決定論的に遷移します。

### 2. Commanderの状態と120秒

Commander cardは少なくとも次の状態を持ちます。

`telegraphing -> deploying -> active -> resolved | failed`

- `telegraphing`: 予告中。Act時計は停止し、120秒はまだ数えない。
- `deploying`: 構造化出現を試行中。失敗時は同じseedと状態から同じ時刻・候補順で再試行する。
- `active`: spawn成功イベントを受けた時点で開始し、`activeElapsed = 0`とする。
- `resolved`: Commander撃破など、成功条件を満たした状態。
- `failed`: 配置期限切れ、対象消失、明示中断など、理由を持って終了した状態。

Commanderの120秒はspawn成功後の`activeElapsed`だけで数えます。120秒以内に撃破できなければ`timeout`としてcardを失敗させ、Commanderを撤退させてAct時計を再開します。RC6では失敗してもラン自体は継続し、ボス強化などの追加罰は入れません。

spawn deferは無制限にしません。再試行間隔と配置期限はEncounter定義の設定値とし、`runElapsed`を基準に判定します。期限切れ時は`deployment-timeout`を記録し、cardを失敗させてAct時計を必ず解放します。初期値は実装Issueで固定し、fixtureで境界値を保証します。

RC6の初期値は再試行間隔2秒、配置期限10秒です。初回を含めて最大5回試行し、期限と同時のstepでは新たなspawnを試さず`deployment-timeout`にします。Commander cardのcooldownは600秒とし、Act時計停止によって同じAct内で再選択されないようにします。

simulation stepの更新順は次で固定します。

1. Worldが進めた`runElapsed`をDirectorへ渡す。
2. step開始時のcard状態がAct時計をblockしていなければ、前回との差分だけ`actElapsed`を進める。
3. `actElapsed`からAct遷移を1回だけ判定し、その後にcard選択と状態遷移を処理する。
4. `deploying`のspawn結果を同じstep内でDirectorへ返し、成功時刻を`activeStartedAt`、`activeElapsed = 0`として記録する。
5. 撃破、`timeout`、`deployment-timeout`でcardを終了し、次stepからAct時計を再開する。

実装上の予告phase名は既存eventとの互換性のため`telegraph`を維持しますが、ライフサイクル上の意味は本ADRの`telegraphing`です。HUDは`expedition.director.actId`とphaseを表示し、run時間からActを再計算しません。

### 3. Expeditionの主記録

Expeditionの主ランキングは**勝利ランの総クリア時間**です。短い順に並べ、同時間では戦術点、終了時刻、run IDの順で安定化します。

- 敗北は履歴と到達Actの比較へ残すが、勝利PBを上書きしない。
- 戦術点は撃破、危険処理、被害など時間以外の成果を表す。クリア時間から導く速攻点は含めない。
- 速攻成果はランキング点ではなく、stageごとの時間メダルとして表示する。
- 既存のRC5速攻点はRC5履歴の表示値として保持し、RC6の戦術点へ移行しない。

RC6の戦術点は完遂bonusを加える直前のscoreです。完遂15,000点は互換性のある総得点表示へ残しますが、主順位と同時間時の戦術点比較を混ぜません。時間メダルはStage 10固有の総クリア時間から、金9分以内、銀10分以内、銅12分以内で導出します。時間による加点は常に0です。

### 4. 比較scope

`weaponId`をすべての比較キーへ常時追加せず、ランキングや自己記録の問い合わせへ`comparisonScope`を渡します。

| scope | 比較対象 |
| --- | --- |
| `overall` | 同じmode、stage、ruleset、seed区分の全武器 |
| `weapon` | `overall`の条件に加え、同じ`weaponId` |

1件のRunRecordから総合PBと武器別PBの両方を導出し、同じランが両方の更新候補になれます。片方を保存したことで、もう片方を失わない構造にします。

seed区分は次のように扱います。

- random runは`random`同士で比較する。
- fixed runは実際のseed値まで一致するランだけを比較する。
- fixed runを通常のrandomランキングへ混ぜない。

### 5. ruleset分離

RC6のルール版は`phaser-v0.7.0-final-expedition-rc6`とします。RC5以前の履歴は削除しませんが、RC6のランキング、PB、メダルへ混在させません。

保存schemaの変更が必要な場合だけschema versionを上げます。今回の`comparisonScope`は問い合わせ時に導出し、追加した戦術点とメダルは既存nested schemaのdefaultで旧記録を読めるため、RunRecordとstoreはversion 2を維持します。保存ランキングはoverall上位と各weapon上位の和集合を保持し、片方のPBが履歴上限とともに失われないようにします。

### 6. ボス回復は独立実験にする

ボス戦の有限回復予算は有望ですが、時計・ランキング修正と同時に採否しません。別Issueで候補値を比較し、RC6基礎版との差を確認してから取り込みます。

Wave 3では2400 HP・補充なしをcandidate Aとして比較しました。controlの勝利3本をすべて敗北へ反転させ、6構成完走条件を満たさなかったため採用しません。計測契約と切替可能な定義は保持しますが、既定controlへ有限予算を設定しません。

ボス区間の回復相殺率は次で統一します。

`ボス中の実HP回復量 / ボス中の総被ダメージ`

総被ダメージが0の場合は`0%`ではなく「算出不能」とします。drop数や表示回復値ではなく、HP上限を反映した実回復量を分子に使います。

## 必須の自動保証

RC6 probeは、既存の集計値だけでなく次を明示的にassertします。

1. 3 fixed seed x Pulse / Spreadの6構成がすべて勝利する。
2. Commanderが名目上のAct境界へ達してもActが進まず、解決後に境界を越える。
3. spawn defer後の再試行時刻、候補順、結果が同一seedで一致する。
4. 敗北ランが既存の勝利PBを上書きしない。
5. fixed seedの実値ごとに記録とPBが分離する。
6. `overall`と`weapon`のPBが同じ履歴上で両立する。

同一seed / inputのevent hashとworld hash、Endlessの既存順位規則、旧履歴の読込も回帰対象です。

## 影響

- Encounterの時間契約をHUDから切り離し、Act追加時の表示ずれを防げる。
- 出現延期とCommander戦闘時間を区別でき、120秒の意味がプレイヤーと実装で一致する。
- Expeditionでは速さを主記録、戦術点を補助成果として読み分けられる。
- 武器総合と武器別の両方を表示でき、将来の3つ目の武器にも比較キーを増殖させず対応できる。
- RC5の記録は履歴として残るが、RC6との直接ランキング比較はできない。

実装量は増えますが、HUDだけの補正、暗黙の時計、無制限再試行を残すより、後続のStage 1 / 5 / 10検証へ安全に展開できます。

## 採用しない案

- HUD表示だけを固定する: Directorの実状態と表示が分離するため不採用。
- `weaponId`を常に比較キーへ入れる: 総合PBを表せなくなるため不採用。
- 速攻点を戦術点へ残す: 主記録のクリア時間と二重評価になるため不採用。
- spawn成功前から120秒を数える: 配置都合をプレイヤーの戦闘成績へ含めるため不採用。
- 出現できるまで無期限に再試行する: Act停止のsoft lockを作るため不採用。

検証手順は[RC6 QA・採否計画](../../playtest/v07-rc6-qa-plan/)、履歴を含む現在の証跡は[v0.7 統合QAレポート](../../playtest/v07-qa-report/)を参照してください。
