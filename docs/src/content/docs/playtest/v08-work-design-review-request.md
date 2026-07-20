---
title: v0.8 Work再レビュー依頼
description: RC6を固定した状態で、緊張と緩和、攻略メタ、難易度支援、v0.8着手順を独立レビューしてもらうための依頼文。
---

最終更新日: 2026-07-20

## 状態

レビュー依頼可能。対象baselineはmain merge `0e07347424a8`、Expedition ruleset `phaser-v0.7.0-final-expedition-rc6`です。RC6のゲームルールは採用済みですが、production trafficはv0.6.8を維持しています。選択画面の改善はDraft PR #84と別Previewで評価中です。

## 依頼の目的

実装案を大量に増やすことではなく、Arena Coreの現在の面白さを言語化し、v0.8で一度に検証する仮説を絞ります。ゲーム業界経験者から得た助言を、競技公平性、既存アーキテクチャ、計測可能性を保った設計契約へ変換できるかを確認します。

主な論点は次です。

- EndlessとExpeditionの緊張、反撃、立て直し、再加速。
- HP以外で作るボスの強さと、学習可能な攻略メタ。
- near-missと再挑戦理由の見せ方。
- Stage進行とEasyからHellの難度軸の分離。
- 明示的なCampaign Assistとランキング公平性。
- 危険反転、技能ledger、選択テンポ、武器教義、最大密度の実装順。

## レビュー対象

最低限、次の資料を同じsnapshotで渡します。

- `docs/src/content/docs/design/external-game-design-advice.md`
- `docs/src/content/docs/design/core-promise-validation.md`
- `docs/src/content/docs/design/narrative-and-match-drama.md`
- `docs/src/content/docs/design/expedition-campaign.md`
- `docs/src/content/docs/design/weapon-identities.md`
- `docs/src/content/docs/game/current-state.md`
- `docs/src/content/docs/playtest/v07-rc6-integration-report.md`
- `docs/src/content/docs/playtest/v08-ui-candidate-playtest.md`
- `docs/src/content/docs/project-management/next-phase-plan.md`
- `docs/src/content/docs/project-management/tickets.md`
- `docs/src/content/docs/project-management/decision-log.md`
- `docs/src/content/docs/project-management/risk-log.md`
- `phaser/src/content/expeditionEncounterCards.ts`
- `phaser/src/content/bossCatalog.ts`
- `phaser/src/simulation/EncounterDirector.ts`
- `phaser/src/simulation/ExpeditionController.ts`
- `phaser/src/content/upgradeCatalog.ts`
- `phaser/src/content/extraUpgradeCatalog.ts`

リポジトリ全体を渡す場合も、`.git`、`node_modules`、`dist`、ローカルrun log、秘密情報は除外します。UI candidateは比較対象に含めますが、RC6ゲームルールと同じ採否へ混ぜません。選択UIの短時間比較手順は可読性と入力復帰の参考資料であり、#81のv0.8統合プレイテスト人数へ算入しません。

## 依頼時の事実

- RC6自動probeは3 fixed seed x 2武器で3/6勝利し、全6でCommander撃破、Act 5、3攻撃種へ到達しました。
- 通常UIではPulseが430.66秒で1敗、578.93秒で1勝、Spreadが584.49秒で1勝しました。
- 勝利ランの回復相殺率は99.96%と98.21%ですが、位置、標的、回復経路を変えない中央周回へ固定できませんでした。
- 道中は最終面として学習可能、ボスは高密度で、範囲外退避、遮蔽、通常敵撃破、回復、再接近を要求するという手動所感です。
- 2400 HP有限回復candidateは0/6勝利となり棄却しました。
- 10ステージ一括実装はStage 1 / 5 / 10の3作戦検証へ再スコープ済みです。
- Endless、fixed seed、ランキング対象ランには履歴依存の隠れた難度補正を入れません。

## Workへ渡すプロンプト

```text
あなたは、アーケード系サバイバルシューター、ステージ制ゲーム、ゲームバランス、UXリサーチ、テレメトリ設計を横断してレビューするシニアゲームデザイナーです。

添付したArena CoreのリポジトリsnapshotとStarlight資料を読み、実装作業は行わず、v0.8の設計判断を独立監査してください。既存案への同意を前提にせず、事実、推論、仮説を分けてください。リポジトリにない仕様を実装済みとして扱わないでください。

製品の核は「避け、狙い、戦況を読み替える技能が、次の瞬間と次のランの両方へ返ってくること」です。Endlessは同一ruleset下の競技的な無限生存、Expeditionは有限の戦況突破です。RC6は最終面baselineとして採用済みであり、今回の目的はRC6を再調整することではなく、その次に検証する仮説を絞ることです。

必ず次を検討してください。

1. 現在のコアループで既に強い点、弱い点、習熟が面白さへ変わる点。
2. EndlessとExpeditionを分けた緊張・ピーク・緩和・反撃・再加速の理想曲線。
3. 現RC6ボスをHP増加だけに頼らず、学習可能かつArena Coreらしく強くする原則。
4. 初見失敗後に学べる攻略メタを、通常強化、ボス前準備、武器教義、EXのどこへ置くべきか。
5. Stage 1 / 5 / 10とEasy / Normal / Hard / Hellをどう分け、何を共通化すべきか。
6. near-missと再挑戦意欲を、結果を偽装せず何で計測・表示すべきか。
7. Campaign Assistを導入する場合の最小仕様、表示、記録、ランキング分離。隠れたDDAは提案しないでください。
8. PulseとSpreadが異なる判断を要求し続けるための教義、攻略メタ、成果指標。
9. #83、#66、#76から#81、#62、#64、#65の依存順、重複、不足、延期候補。
10. UI candidateの選択画面、最大密度の可読性、警告音について、ゲームルールと分けて測るべき点。

次の制約を守ってください。

- Ranked / Endlessへ履歴依存の隠れた数値補正を入れない。
- 10ステージや大量assetを先に量産しない。
- 一度のcandidateで複数のゲームプレイ仮説を同時に変えない。
- 単一高得点、観戦AI、開発者本人の所感だけで採否しない。
- 新しいframeworkや大型libraryは、具体的な不足と導入効果が示せる場合だけ提案する。
- RC6 baselineを変える提案は、production blocker級の根拠がある場合だけ別枠にする。

回答は次の順序で構成してください。

1. エグゼクティブ判定
2. 現状の強みと重大度順のリスク
3. Endless / Expeditionの感情曲線と戦闘曲線
4. 採用、再設計、延期、棄却の機能マトリクス
5. 既存Issueの依存グラフと推奨実装順
6. 最小candidateごとの仮説、control、KPI、停止条件
7. Campaign Assistと競技公平性の契約案
8. Pulse / Spreadの教義と計測案
9. 初心者 / 経験者プレイテストの質問とサンプル規模
10. 不確実性、追加で必要なログ、追加で確認したい質問

各推奨には、期待するプレイヤー行動、失敗時の見え方、必要なテレメトリ、既存Issueとの対応を付けてください。数値は確定値ではなく初期仮説として示し、感度分析または棄却条件も添えてください。
```

## 期待する採否単位

レビュー後も、全提案をまとめて実装しません。

1. 回答の事実誤認をリポジトリと照合する。
2. #83へ採用、再設計、延期、棄却を転記する。
3. decision logへ公平性と優先順を記録する。
4. 最初のcandidateを1仮説へ絞る。
5. RC6 baselineとのpaired比較を事前登録する。
6. #81の構造化プレイテストで初心者と経験者を分ける。

RC6を動かす必要が見つからない限り、最初の実装候補は危険反転または選択テンポのどちらか一方です。世界観、視覚asset、武器branchを同じcandidateへ混ぜません。

関連する判断は[外部ゲームデザイン助言メモ](../../design/external-game-design-advice/)と[v0.8 面白さの核の検証](../../design/core-promise-validation/)を正本とします。
