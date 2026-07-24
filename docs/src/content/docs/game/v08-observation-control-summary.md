---
title: v0.8 control観測build サマリ
description: RC6のゲームルールを維持したまま、次のゲームデザイン判断に必要な事実を1つのbuildへ集約した版の概要。
---

最終更新日: 2026-07-24

## 一言でいうと

今回の版は、**ゲームバランスを変更するv0.8ではなく、採用済みv0.7 RC6を正しく観察するためのcontrol build**です。

Charger、強化選択、危険イベント後、Boss戦、ラン終了理由を同じランから確認できるようにしました。ここで得た事実を基準に、危険反転、選択UI、Boss調整、イベント後の緩和を今後1件ずつ比較します。

## バージョン識別

| 項目 | 値 |
| --- | --- |
| 開発フェーズ | v0.8 設計検証 |
| アプリ版 | `0.7.0` |
| 配布区分 | 技術プレビュー |
| Endlessルール | `phaser-v0.6.8-pulse-boundary-ricochet` |
| 最終遠征ルール | `phaser-v0.7.0-final-expedition-rc6` |
| 基点 | `main` / `565d401a92f6` |
| 結合候補 | [Draft PR #113](https://github.com/garchomp-game/create-game/pull/113)の修復候補 |
| ローカル修復branch | `agent/v08-observation-control-repair` |
| runtime merge | `b35e42e4388a` |
| tested HEAD | `f35cb1227d3bd2d1257b081306695dbefcca1b0f` |
| production | v0.6.8を継続。今回の版は未配布 |

アプリ版やrulesetを更新していないのは、敵数値、武器、出現、回復、スコア比較規則を変えていないためです。今回の計装ランを既存RC6 controlと別ルールの記録として扱いません。

## 遊べる内容

- Endless: Pulse / Spread、通常強化、循環EX、3種の危険イベント、後半契約、アリーナ崩壊。
- 最終遠征: 5 Act、Commander、Charger、3攻撃・2段階の指揮艦Boss、時間メダル、総合 / 武器別ランキング。
- 9課題Trainingは最新`main`の機能として保持する。ただし初心者T1は[#81](https://github.com/garchomp-game/create-game/issues/81)の固定buildで別に測り、control runと混ぜない。
- ローカル記録: 履歴、比較条件別ランキング、設定、ゲストプロフィール。

プレイヤーに見える変更は、遠征の旧「戦術点」を実態に合わせて「撃破点」へ改め、リザルトとランキングに順位規則を明記したことです。

- Endless: 撃破点が高い順。同点は生存時間。
- 最終遠征: 作戦完遂後、総クリア時間が短い順。同タイムは撃破点。

## 今回追加した観測

| 観測対象 | 分かること | 主な出力 |
| --- | --- | --- |
| Charger | 予告、突進、硬直、攻撃機会が現行controlで成立しているか | `stats.encounterMetrics.charger` |
| 強化選択 | 表示から決定までの実時間、入力方法、決定後1秒の戦闘復帰 | `choiceInteraction` |
| 危険イベント | 終了後5秒でHP、敵数、回収、被弾が立て直せたか | `encounterRelief` |
| Boss戦 | 攻撃別の被弾、回復、反撃窓、中央滞在、通常敵撃破 | `bossShadow` |
| ラン終了 | 主な敗因、到達進捗、比較可能な差分 | `runOutcomeInsight` |

Run Outcome ViewModelは将来のリザルト改善に使う事実層です。standard runのevent列から生成し、debug snapshotとrun exportへ接続しました。未登録の閾値で「あと少し」と煽る表示や、新しい助言UIは今回追加していません。

## 変更していないもの

- 武器ダメージ、連射、弾速、強化候補とEX成長。
- 敵HP、速度、出現数、危険イベントの内容と間隔。
- Boss攻撃、回復drop、中央周回対策。
- Chargerの衝突妨害や危険反転。
- 選択画面のレイアウトや視覚candidate。
- RNG、ruleset、`RunRecord`、ランキング比較キー。
- production trafficとCloudflare公開版。

この境界により、人間の所感がゲーム数値変更ではなく、現行controlそのものへの評価として残ります。

## 品質確認

| ゲート | 結果 |
| --- | --- |
| Unit | 74 files / 506 passed / 2 skipped |
| TypeScript | pass |
| Phaser production build / 配布検査 | pass / 27 files |
| 観測用build | pass。debug moduleを専用chunkへ分離 |
| Playwright E2E | 90 passed / 1 skipped、WebGL worker 2 |
| 観測artifact smoke | marker一致、game over JSON、`runOutcomeInsight: available`、console error 0 |
| Starlight | 111 pages build pass |
| GitHub Actions | 新しいcanonical PR作成後に再取得 |
| `main`との結合 | 9課題Trainingを保持してローカル統合済み |

旧PRのQA値は現在HEADの合格証拠へ流用しません。15分soakは明示opt-inのためskipです。Cloudflare Version Preview、GitHub Actions、人間control観測を完了するまでDraftのままです。自動greenは計装と既存導線の回帰を保証しますが、面白さ、緊張と緩和、攻撃の学習性は保証しません。

## 残る人間観測

1. EndlessのPulse / Spreadを各1本、最初の危険イベントの回復窓までプレイする。
2. 最終遠征のPulse / Spreadを各1本、Boss第2段階またはラン終了までプレイする。
3. 必須ラン後、説明なしで5分だけ自由に選んで遊ぶ。
4. 初心者T1は#81の固定Previewで事前教材を見せず、Training後のEndlessを死亡または90秒まで観察する。このcontrol buildのランと混ぜない。

開発サーバーでは1秒以上の手動ランが終了すると、JSONを`phaser/logs/runs/`へ自動保存します。観測用Workers Previewではconsoleから`window.__ARENA_DEBUG__.downloadRunExport()`を実行して同じJSONを保存します。質問、停止条件、JSON pathの正本は[v0.8 control観測build 実施手順](../../playtest/v08-observation-control-runbook/)です。

## 次の判断

同じ問題が複数ランで再現した場合だけ、所有Issueへ変更値、比較seed、合格条件を事前登録します。以後も1つの比較buildへ入れるgameplay candidateは1件に限定します。

- Charger controlが成立してから、危険反転を別rulesetで比較する。
- 選択時間と復帰事故を確認してから、UI候補を現行表示と比較する。
- Boss攻撃別の事実を確認してから、攻撃密度や回復を調整する。
- イベント後5秒の立て直し不成立を確認してから、spawn抑制などを比較する。

したがって、今回の版はv0.8の完成版ではなく、**次の変更を勘ではなく比較で選ぶための基準版**です。
