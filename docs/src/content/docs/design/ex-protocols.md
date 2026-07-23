---
title: EX Protocol候補
description: 通常ビルド完成後に武器固有の判断を追加する、6体系のEX Protocol候補と採否境界。
---

最終更新日: 2026-07-23

:::caution[候補の状態]
このページはbranch `feat/v08-ex-protocols-c1`のC2 candidate仕様です。production既定値はOFFで、PR、main統合、production traffic配分、採用判断は行っていません。C1 Previewと自動QAは比較履歴として残し、C2はownerの可読性・成立頻度フィードバックを受けた別rulesetです。
:::

## 目的

現行productionでは、通常25ランクの完成後に、攻撃力、連射、移動、最大HPを循環強化します。EX Protocol候補はこの数値成長を捨てず、その前へ武器固有の選択を置きます。

- Pulseは、集束対象、貫通列、反射経路、最大HPとの交換を判断する。
- Spreadは、扇全体、近距離制圧、前方防御、能動発動の時機を判断する。
- 取得前後で、照準、位置取り、標的優先、special timingの少なくとも1つが変わる。
- 武器の既存弱点を消す万能強化にしない。

## 成長順

| 段階 | 到達条件 | 選択 |
| --- | --- | --- |
| Normal Core | 武器別の通常25ランク | 既存の最大3択 |
| Signature | Core完成直後、`EX Lv0` | 武器互換のProtocol固定3択 |
| Evolution I | `EX Lv1` | 選択済みProtocol専用2択 |
| Evolution II | `EX Lv2` | 同じProtocol専用2択。選択時にMasteryを自動取得 |
| Limit Break | `EX Lv3`以降 | 既存4強化の一巡deck |

Core最後の選択後はsimulationを1 frameも進めず、`upgrade.selected -> build.completed -> ex.protocol.offered`の順にProtocolを表示します。保持済みXPは失いません。1 frame内で複数のblocking choiceを連続解決せず、次の`playing`更新で次段階を判定します。

既存Limit BreakのID、効果、一巡deck、上限到達候補の除外、残り1候補の自動取得は維持します。候補OFF時は従来どおりCore完成直後からこの循環へ入ります。

## 6つのProtocol

### Pulse

| Protocol | 種別 | 操作変化 | 残す弱点 |
| --- | --- | --- | --- |
| 交差導線 / Resonance Relay | Passive / Line Control | 集束MAXになった地点を1.5秒記録し、後続直撃との間にいる敵へ追加damage。撃破地点も記録する | 別volleyと障害物に遮られない射線が必要。横に散った群れへ自動対応しない |
| 反跳過給 / Rebound Overdrive | Active / Ricochet | `右クリック`または`E`で2秒以内の次弾を武装し、実際の反射後だけ貫通容量を再装填 | 反射面と経路がなければ不発。汎用DPS buttonにしない |
| 赤熱炉心 / Redline Core | Passive / High Risk | effective最大HPを70%へ予約し、集束MAXへ到達する直撃から強化 | 最大HP低下を恒久的に負い、集束途中や反射後hitは強化しない |

### Spread

| Protocol | 種別 | 操作変化 | 残す弱点 |
| --- | --- | --- | --- |
| 全幅潮汐掃討 / Full-span Tidal Sweep | Active / Sweep | 1回の通常Spread射撃を別々の3体へ当ててchargeし、9弾の広域斉射へ変換 | 単体へ9重hitせず、再使用には通常射撃での再chargeが必要 |
| 防波扇 / Breakwater Fan | Active / Front Control | 190px以内で1回の通常Spread射撃を別々の2体へ当ててchargeし、HPを支払って前方だけをdamageとpushで開く | 全周防御ではなく、HP 1未満になる発動と障害物越しを拒否 |
| 護壁扇 / Aegis Fan | Passive / Defense | 扇の外側2弾の対敵火力を下げ、反射前の正面標準敵弾を迎撃 | boss弾、接触、崩壊、背面を無効化しない。外側弾の火力を失う |

ProtocolとEvolutionの表示順は固定し、RNGを消費しません。IDとscalar値のruntime正本は`phaser/src/content/ex-protocols.v1.json`、意味と解決順は各Protocol systemとfixtureです。実測に合わせて数値を無断調整しません。

## モード適用

| モード | Candidate ON | 理由 |
| --- | --- | --- |
| Endless | `fixed-compatible` | 6体系とLimit Breakまでを比較する主経路 |
| Final Expedition | `fixed-compatible` | ボス第2段階までの到達と長い露出を検証 |
| Training | `disabled` | 基本操作の学習へ後半選択とspecialを混ぜない |
| 未対応stage / 旧ruleset | 起動時に拒否または旧profile維持 | 暗黙fallbackと記録混在を防ぐ |

候補profileはEndlessを`phaser-v0.8-ex-protocols-c2`、Final Expeditionを`phaser-v0.8-final-expedition-ex-protocols-c2`へ分けます。C1 profileは保存済みRunRecordの読取用に残し、production profileの`features.exProtocols`は`false`です。

## 操作契約

- Active Protocolは右クリックまたは`E`の新規押下で使う。
- 同一frameの右クリックと`E`は1回へまとめる。
- 右クリックはpointer位置へ照準を更新するが、通常射撃を発生させない。
- holdによる再発火、pauseやchoiceからの入力bufferは行わない。
- pause入力とspecial入力が同時ならpauseを優先する。
- Active未選択、候補OFF、Training、title、resultではlistener自体または効果を有効にしない。
- Active選択中の拒否理由は`already-armed`、`cooldown`、`not-charged`、`insufficient-hp`の優先順で1件だけ記録する。

## 過負荷契約の扱い

C2では240秒の過負荷契約を表示しません。通常Endlessだけでも脅威、危険イベント、アリーナ崩壊により手動・AutoPilotとも有限終了へ収束し、敵速度とスコア倍率を同時に変える追加選択は比較条件と選択停止を増やす方が大きいと判断しました。

legacy v0.6.8とC1のprofile、保存済み`contractChoice`は読取互換のため残します。過負荷UIとsimulation実装を破壊的に削除せず、C2 profileの`features.endlessContract: false`で到達不能にします。

## 表示とフィードバック

- Protocolは「自動 / 手動」と役割を先に示し、「発動条件」「効果」「制約」の平易な日本語で表示する。
- Evolutionは現在のSignatureと取得後の数値を表示する。
- HUDはProtocol名、状態、charge、cooldown、Redline予約HPを表示する。
- Active成功、拒否、charge、Mastery成立は、短い文字、形状、固有音を組み合わせ、色だけに依存しない。
- リザルトと詳細exportは`Protocol -> E1 -> E2 -> Mastery`のrouteを表示する。
- 内部enemy IDはプレイヤー向け通知へ出さない。

## 記録と移行

候補ONのrunだけ`RunRecord v3`とRNG schema v2を使い、Protocol route、到達時刻、special、固有effect、damage帰属を保存します。

- v1 / v2は読取時に破壊的変換せず、候補用collectionへreconcileする。
- 通常保存と自動migrationで旧keyを変更しない。
- 明示的な削除だけをjournal化し、対応するlegacy履歴へ同期する。
- 候補記録と旧rulesetのPB、ランキングを混ぜない。
- JSON、TSV、CSV、debug snapshotへcatalog versionとProtocol集計を出す。

## 自動検証

candidate branchで次を個別に用意しています。

| Gate | 現在の証拠 |
| --- | --- |
| 全経路 | 6 Protocol x E1 2択 x E2 2択の24 routeと、Signature、Mastery、最初のLimit Break、record / export |
| 決定論 | 型付きreplay tape、古いkind / ID / key / elapsedのfail-fast、同一seed hash |
| 保存 | v3 codec、v1 / v2非破壊移行、collection reconciliation、削除journal |
| バランス | 同一seedのbaseline / 3 Protocol、20 seed release matrix用probe、効果機会とdamage帰属 |
| 負荷 | 6 Protocolの高圧headless soak、entity上限、Aegis候補数、Tidal tracker解放、step p95 |
| Final Expedition | 両武器20 seed用のProtocol露出probe。smokeではPulseがE2、Mastery、最初のLimit Break、boss phase 2、勝利へ到達 |
| UI | 6 Protocolの代表戦闘fixtureとdesktop画像、選択、HUD、結果route |

C1では短いcandidate gateに加え、20 seed release matrix、90秒release soak、両武器40本のFinal Expedition露出までgreenです。実測値とreview triggerは[EX Protocol candidate 自動QA](../../playtest/v08-ex-protocol-candidate-report/)へ分離しました。

C2はC1の`opportunity=0`とowner feedbackを根拠に、発動条件と説明だけを改訂した比較候補です。対象micro fixture、全unit、型、短い2 seed probe、選択画面の横・縦browser fixtureを先に通しました。結果は[C2 可読性・成立条件レポート](../../playtest/v08-ex-protocol-c2-readability-report/)へ分離し、20 seed、soak、Final Expeditionは採用候補を固定するときにまとめて再実行します。

probe専用policyは固定Protocol routeとActive使用機会だけを補助し、製品AutoPilotの移動安全性や武器別生存方針を変更しません。probeのscore差だけで数値を自動調整しません。

## 採用前の人間ゲート

自動greenだけではproductionへ採用しません。Pulse / Spreadの各Protocolを人間操作で確認し、次を満たす必要があります。

- 選択後に照準、位置取り、標的優先、special timingのいずれかが変わる。
- 常に安全な万能選択がない。
- Activeがcooldownごとに押すだけの通常DPS buttonにならない。
- Pulseの横展開への弱さ、Spreadの単体集中への弱さが残る。
- 最大密度でもProtocol状態、敵弾、危険予告、回復を読み分けられる。
- E1 / E2の2択を状況に応じて説明できる。
- RedlineとBreakwaterの代償を、選択前と結果画面で理解できる。

不合格時はProtocol単位の値をその場で追従調整せず、再現条件、該当route、seed、ruleset、変更案を別candidateとして事前登録します。

## Rollback

productionへ戻す最小境界はcandidate profileと`VITE_ARENA_EX_PROTOCOL_CANDIDATE`です。OFFではEX用入力listener、Protocol progression、RunRecord v3の新規保存、Protocol描画と音を有効化せず、従来のCore -> Limit Break、旧ruleset、v1 / v2保存を維持します。

関連資料:

- [ビルドと成長](../build-and-progression/)
- [武器アイデンティティ](../weapon-identities/)
- [エンドレス後半の継続圧力](../endless-escalation/)
- [v0.8 面白さの核の検証](../core-promise-validation/)
- [品質戦略](../../engineering/quality-strategy/)
