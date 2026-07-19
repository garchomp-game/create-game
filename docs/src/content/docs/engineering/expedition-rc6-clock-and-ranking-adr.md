---
title: 最終遠征RC6の時計と記録規則
description: Encounter Directorの時計、Commanderの期限、Expedition記録の比較scope、ruleset分離を固定するADR。
---

最終更新日: 2026-07-20

## 状態

設計決定およびゲームルール候補として採用。`PH-V07-010`の時計とCommanderライフサイクル、`PH-V07-011`の記録規則とRC6 rulesetは2026-07-19に実装しました。フォローアップ監査で見つかったボス遭遇終端、390秒境界、profile別PB、ランキング表示、probe分岐もRC6安定化差分へ取り込みました。提出物再レビューのrelease contract追補と自動証跡の再取得はcode commit `c908450a7101`で完了しています。`PH-V07-012`の2400 HP有限回復候補は棄却し、通常UIのPulse 2本・Spread 1本で中央周回と回復循環を再確認したうえでRC6 controlを採用しました。production trafficはリポジトリ統合と配布SHA固定までv0.6.8を維持します。

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
| `difficultyElapsed` | Worldから導出 | Expeditionのwave、通常敵成長、遠距離攻撃、回復drop減衰 | `actElapsed`と同じ。Endlessでは`runElapsed`と同値 |

HUDはEncounter Directorが公開する現在Actと残り状態を描画するだけとし、`runElapsed`からActを独自計算しません。Act遷移判定もEncounter Directorだけが所有します。

Expeditionの戦闘難度は`runElapsed`から直接計算しません。Director更新前の1 step分だけ表示とsimulationが遅れないよう、未反映のrun差分をAct時計が動作中だけ加えた値を`difficultyElapsed`として導出します。

`difficultyElapsed = actElapsed + (actClockBlocked ? 0 : max(0, runElapsed - director.runElapsed))`

`actElapsed`の内部累積値はstepごとに丸めません。丸めは比較または出力時に一度だけ行い、30 / 60 / 120 / 144fpsでAct境界が変わらないことをfixtureで保証します。この値を通常wave、通常敵のHP・damage、射撃間隔・弾速、heal drop減衰、HUD、run exportへ共通利用します。総クリア時間、Commanderの配置期限と120秒、ボス固有攻撃、Pickup寿命は`runElapsed`のままです。これによりCommanderを解決している間だけ次Act相当の通常圧力が先行せず、ボス開始後は再び難度が進みます。

通常の時間制Encounterは`blocksActClock: false`、Actをまたいで存在させない構造化Encounterは`true`を明示します。RC6ではこの宣言がAct時計と難度時計の両方を止めます。将来、Actだけを止めて難度を進めるEncounterが必要になった場合は別フラグを追加し、`blocksActClock`の意味を暗黙に変更しません。RC6のCommander cardは`true`です。選択時にAct時計を止め、撃破または撤退signalでactiveを解決した時点に再開します。4.5秒のrecovery表示中は時計を進めます。これにより、Commanderが名目上のAct境界へ到達しても次Actは開始せず、解決後に決定論的に遷移します。

HUDが参照する`expedition.actId`、`actTitleKey`、`objective`は、`ExpeditionController`がDirector eventから同一stepで更新するpresentation read modelです。時間からActを再計算する別の正本ではありません。Commander固有objectiveはcard active中だけ表示し、撃破、active timeout、deployment timeoutで現在Actの通常objectiveへ戻します。phaseと時計の正本は`expedition.director`に置き、read modelとの同期をfixtureで保証します。

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

signal完了条件とtimeoutは別契約です。Commanderだけが明示的な120秒timeoutを持ち、最終ボスはtimeoutを持たず`boss-defeated`またはラン敗北を待ちます。勝利時は同stepでボスcardを`completed`、敗北時はtelegraph / deploying / active / recovery中のcardを`interrupted`へ一度だけ確定します。終端後はAct時計block、spawn override、Commander、ボス、HUDのcard read modelを残しません。プレイヤーとボスが同stepで致死になる場合はプレイヤー敗北を優先します。

構造化spawnは期限時刻以上の成功報告を受理しません。fallback geometryも既に予告した方向を変更せず、別方向が必要なら一度deferして新しい予告を行います。配置安全半径にはCommanderやChargerを含む実際の最大半径を使います。

実装上の予告phase名は既存eventとの互換性のため`telegraph`を維持しますが、ライフサイクル上の意味は本ADRの`telegraphing`です。HUDは`expedition.director.actId`とphaseを表示し、run時間からActを再計算しません。

### 3. Expeditionの主記録

Expeditionの主ランキングは**勝利ランの総クリア時間**です。保存時に`Math.max(0, Math.round(elapsed * 100))`で非負の整数centisecondへ量子化し、その整数値を比較、時間メダル、精密表示、PB差分、PB同値判定の唯一のperformance表現として使います。同じcentisecondでは戦術点を使います。終了時刻とrun IDは表示順を安定させるだけで、PB更新判定には使いません。raw浮動小数同士の差分は画面へ表示しません。

- 敗北は履歴と到達Actの比較へ残すが、勝利PBを上書きしない。
- 戦術点は撃破、危険処理、被害など時間以外の成果を表す。クリア時間から導く速攻点は含めない。
- 速攻成果はランキング点ではなく、stageごとの時間メダルとして表示する。
- 既存のRC5速攻点はRC5履歴の表示値として保持し、RC6の戦術点へ移行しない。

RC6の戦術点は完遂bonusを加える直前のscoreです。完遂15,000点は互換性のある総得点表示へ残しますが、主順位と同時間時の戦術点比較を混ぜません。時間メダルはStage 10固有の総クリア時間から、金9分以内、銀10分以内、銅12分以内で導出します。時間による加点は常に0です。

### 4. 比較scope

`weaponId`をすべての比較キーへ常時追加せず、ランキングや自己記録の問い合わせへ`comparisonScope`を渡します。

| scope | 比較対象 |
| --- | --- |
| `overall` | 同じprofile、mode、stage、ruleset、seed区分の全武器 |
| `weapon` | `overall`の条件に加え、同じ`weaponId` |

1件のRunRecordから総合PBと武器別PBの両方を導出し、同じランが両方の更新候補になれます。片方を保存したことで、もう片方を失わない構造にします。保存groupにも`profileId`を含め、ゲストID再生成後のPBは旧profileと分離します。

seed区分は次のように扱います。

- random runは`random`同士で比較する。
- fixed runは実際のseed値まで一致するランだけを比較する。
- fixed runを通常のrandomランキングへ混ぜない。

### 5. ruleset分離

最終遠征RC6のルール版は`phaser-v0.7.0-final-expedition-rc6`とします。RC5以前の履歴は削除しませんが、RC6のランキング、PB、メダルへ混在させません。戦闘ルールを変更していないEndlessは`phaser-v0.6.8-pulse-boundary-ricochet`を維持し、RC6採用だけを理由に既存PBを見かけ上リセットしません。

保存schemaの変更が必要な場合だけschema versionを上げます。今回の`comparisonScope`は問い合わせ時に導出し、追加した戦術点とメダルは既存nested schemaのdefaultで旧記録を読めるため、RunRecordとstoreはversion 2を維持します。保存ランキングはprofileごとにoverall上位と各weapon上位の和集合を保持し、片方のPBが履歴上限とともに失われないようにします。任意fixed seedで永続領域が無制限に増えないよう、保存中のranked recordの最新時刻を基準に比較groupを最大16件保持します。非PB runによる再訪まで永続化する厳密なLRUではありません。ランキング消去後に履歴を削除しても、消去済みboardを履歴から復元しません。

### 6. ボス回復は独立実験にする

ボス戦の有限回復予算は有望ですが、時計・ランキング修正と同時に採否しません。別Issueで候補値を比較し、RC6基礎版との差を確認してから取り込みます。

Wave 3では2400 HP・補充なしをcandidate Aとして比較しました。controlの勝利3本をすべて敗北へ反転させ、戦闘非劣性を満たさなかったため採用しません。計測契約と切替可能な定義は保持しますが、既定controlへ有限予算を設定しません。

ボス区間の回復相殺率は次で統一します。

`ボス中の実HP回復量 / ボス中の総被ダメージ`

総被ダメージが0の場合は`0%`ではなく「算出不能」とします。drop数や表示回復値ではなく、HP上限を反映した実回復量を分子に使います。

## 必須の自動保証

RC6 probeは、既存の集計値だけでなく次を明示的にassertします。

1. 3 fixed seed x Pulse / Spreadの全6構成がCommanderを撃破し、Act 5と全ボス攻撃種へ到達する。
2. boss phase 2の遷移と固有挙動を専用fixtureで保証し、自然runではPulseとSpreadが各1本以上phase 2へ到達する。
3. 自然勝利がRC6修正前の3/6以上で、PulseとSpreadが各1勝以上ある。
4. ボス出現時の`difficultyElapsed`が390秒から400秒に収まり、Commander時間で通常圧力が先行しない。
5. 専用fixtureでCommanderが名目上のAct境界へ達してもActが進まず、解決後に1回だけ境界を越える。
6. spawn defer後の再試行時刻、候補順、結果が同一seedで一致する。
7. 敗北ランが既存の勝利PBを上書きしない。
8. fixed seedの実値ごとに記録とPBが分離する。
9. `overall`と`weapon`のPBが同じ履歴上で両立する。

同一seed / inputのevent hashとworld hash、Endlessの既存順位規則、旧履歴の読込も回帰対象です。run JSON、debug snapshot、CSV / TSVには`elapsed`と`difficultyElapsed`、その差分を残します。

CSV / TSVの`difficulty_delay_seconds`は`elapsed - difficultyElapsed`です。負値は正常値として丸め込まず、時計契約違反またはデバッグ操作の異常を検出するためそのまま残します。ランキング計算には使いません。開発APIの汎用`setElapsed`はExpeditionではrun時計とDirectorのrun基準だけを移動し、Act進行を捏造しません。特定Actやボス状態の確認には専用fixtureを使います。

## 影響

- Encounterの時間契約をHUDから切り離し、Act追加時の表示ずれを防げる。
- Commander解決時間を総記録へ含めながら、後続Actの通常敵成長へ二重加算しない。
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
- 観戦AIが6/6勝つまでゲーム数値またはAIを調整する: 機構到達性と高難度Stageの戦闘性能を混同するため不採用。

検証手順は[RC6 QA・採否計画](../../playtest/v07-rc6-qa-plan/)、RC5の基準証跡は[v0.7 RC5統合QAレポート](../../playtest/v07-qa-report/)、RC6の現行証跡は[RC6統合QAレポート](../../playtest/v07-rc6-integration-report/)を参照してください。
