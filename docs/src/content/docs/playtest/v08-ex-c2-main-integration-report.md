---
title: EX Protocol C2 最新main統合レポート
description: EX Protocol C2をv0.8共通基盤へ再統合した範囲、自動証拠、残る人間ゲート。
---

実施日: 2026-07-24

:::caution[統合候補]
これは[#126](https://github.com/garchomp-game/create-game/issues/126)のDraft候補です。
production trafficは変更せず、通常buildではEX Protocolを無効のまま維持します。
6体系の人間操作と実GPU確認が終わるまで、v0.8採用版とは扱いません。
:::

## 統合対象

EX Protocol C2を、`origin/main`の`60ae8889390c`を基点として再統合しました。
基点には次が含まれます。

- RC6 control観測と採用済み選択UI。
- 敵接触を含む9課題Trainingとdesktop専用起動契約。
- WebGL起動失敗時の説明と再試行導線。
- 戦闘オブジェクト意味確認用Phase A fixture。
- T0 / T1 / O1向けの分離されたStudyLog契約。

C2からは6 Protocol、各2 x 2の進化経路、Mastery、EX Lv3以降の
Limit Break、右クリック / `E`入力、RunRecord v3非破壊移行、専用音、
決定論probeとsoakを統合しました。過負荷契約はC2で無効のままです。

## 競合解決

| 境界 | 採用した契約 |
| --- | --- |
| 選択画面 | C2旧専用DOMを戻さず、採用済み`ArenaChoicePresenter`へProtocol / Evolution / Limit Breakを接続 |
| Training | 9課題と記録非介入を維持し、Training中はEX入力と進行を無効化 |
| 記録 | productionのv1 / v2を維持し、候補profileだけv3へ保存。legacy bytesを変更しない |
| 観測 | choice、Boss、recovery、敗因の現行exportを残し、EX集計を追加 |
| 配布 | 通常buildはEX OFF、`build:deploy:ex-protocols`だけ候補profileをON |

共通Presenterへの移植時に欠けていた
`pendingChoice.kind === "limit-break"`の表示分岐を回帰テストで検出し、
`LIMIT BREAK CYCLE`表示へ修正しました。Training完走E2Eでは、
固定180ms入力が目標座標を往復するテスト側の量子化問題を検出し、
距離に応じて押下時間を短くする方式へ変更しました。ゲーム数値は変更していません。

## 自動証拠

| Gate | 結果 |
| --- | --- |
| TypeScript / 全unit | PASS。98 files、623 passed / 2 skipped |
| StudyLog | 4 session kind、O1両arm、22 negative mutation PASS |
| 24 route | 25 passed |
| replay / 決定論 | 9 passed |
| RunRecord v3 / migration | 19 passed |
| 短いbalance probe | 6 passed |
| 短い高圧soak | 8 variant、違反0 |
| Final Expedition露出smoke | Protocol、E1、E2 + Mastery、最初のLimit Break到達 |
| 通常 / 候補build | 両方ともTypeScript、Vite build、配布物検査PASS |
| EX browser | 13 passed。版、全選択段階、入力、Training無効化、保存、6体系代表戦闘 |
| 共通選択UI | 6 passed |
| Training | 公開入力で9課題完走、記録非介入PASS |
| release smoke | Chrome横、Chrome縦、Firefoxの9 passed |

通常buildの版と既存PBをC2へ混ぜません。候補buildは
`0.8.0-candidate.2`、Endlessは`phaser-v0.8-ex-protocols-c2`、
Final Expeditionは`phaser-v0.8-final-expedition-ex-protocols-c2`です。

## 残るゲート

自動試験は成立性、決定論、保存互換、画面崩れを保証しますが、
Protocolが実際に面白い判断を作るかは保証しません。

1. Pulse 3体系、Spread 3体系を人間操作で各1回確認する。
2. 選択後に照準、位置取り、標的優先、special timingのどれが変わったか記録する。
3. E1 / E2の選択理由、代償、発動条件を説明できるか確認する。
4. Aegis / Tidalを高密度の非SwiftShader実GPUで確認する。
5. scalar変更が必要なら、再現routeと停止条件を別candidateへ事前登録する。

これらが終わるまで#126とDraft PRを開いたままにし、production trafficを
v0.6.8から変更しません。

関連資料:

- [EX Protocol候補](../../design/ex-protocols/)
- [C2 可読性・成立条件](../v08-ex-protocol-c2-readability-report/)
- [EX Protocol candidate 自動QA](../v08-ex-protocol-candidate-report/)
- [品質戦略](../../engineering/quality-strategy/)
