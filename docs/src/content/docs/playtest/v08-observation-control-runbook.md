---
title: v0.8 control観測build 実施手順
description: 批判的レビューで要求されたshadow事実を、ゲームルールを変えない単一buildから取得する手順。
---

最終更新日: 2026-07-23

## 目的

[#112](https://github.com/garchomp-game/create-game/issues/112)のcontrol観測buildは、次の独立PRを同じ現行runtimeへ結合します。

- [#105](https://github.com/garchomp-game/create-game/pull/105): 検証ゲート、T0 / T1、モードと記録の契約。
- [#106](https://github.com/garchomp-game/create-game/pull/106): 現行Chargerの成立性。
- [#107](https://github.com/garchomp-game/create-game/pull/107): 敗因、進捗、near-missの事実ViewModel。
- [#108](https://github.com/garchomp-game/create-game/pull/108): 選択wall-clockと戦闘復帰。
- [#109](https://github.com/garchomp-game/create-game/pull/109): Boss攻撃、回復、反撃窓。
- [#111](https://github.com/garchomp-game/create-game/pull/111): 危険イベント後5秒の立て直し。

Charger危険反転、選択UI変更、Boss調整、イベント後のspawn抑制は含みません。比較するゲームルールはRC6 controlのままであり、複数candidateを混ぜたbuildではありません。

## 取得方法

開発サーバーで手動runが1秒以上続いて終了すると、JSONは`phaser/logs/runs/`へ自動保存されます。途中で確認する場合はブラウザconsoleから次を使います。

```js
window.__ARENA_DEBUG__.getSnapshot()
window.__ARENA_DEBUG__.getRunExport()
window.__ARENA_DEBUG__.saveRunExport()
```

同じexportで次を参照します。

| 観測 | JSON path |
| --- | --- |
| 選択停止と復帰 | `choiceInteraction` |
| イベント後5秒 | `encounterRelief` |
| Boss攻撃・回復・中央滞在 | `bossShadow` |
| Charger集約 | `stats.encounterMetrics.charger` |
| 死因・進捗の材料 | `resultSummary`、`stats`、`lastEvents` |

## 必須run

### Endless control

PulseとSpreadを各1本実施します。最低でも最初の危険イベントのrecovery完了まで続け、可能ならChargerの予告、突進、硬直も1回以上観測します。

記録する口頭回答:

1. 最初の危険イベントが終わったと感じた時点はどこか。
2. 直後に立て直せたか。何を根拠にそう感じたか。
3. 強化選択後、戦闘へ戻るときに入力や状況判断が止まった感覚があったか。
4. Chargerを見て行動を変えたか。予告前に倒して存在を認識しなかったか。

「recovery」「緩和」「Charger」という期待語は回答前に教えません。

### Final Expedition control

PulseとSpreadを各1本、Boss第2段階またはrun終了まで実施します。勝利は必須にしません。

記録する口頭回答:

1. 初見と反復で避け方を変えたBoss攻撃は何か。
2. 攻撃後にBossへ反撃できたと感じた窓はどこか。
3. 回復は戦術的な立て直しか、過密を耐える補填か。
4. 中央周回へ固定できたか。位置、標的、回復経路を変える必要があったか。

### 自由選択

必須run後に5分だけ、説明なしで遊ぶ内容を選んでもらいます。選んだモード、武器、開始したか、選択理由を記録します。感想だけでなく実際の選択を事実とします。

## 判定境界

- 自動greenは計装と回帰が壊れていない証拠であり、面白さや緩和成立の証拠ではありません。
- 未到達、`partial`、対象攻撃なしは失敗へ変換しません。
- 1人1runの印象だけでゲーム数値を変えません。同じ問題が複数runで再現した後に、所有Issueへ単一candidateを事前登録します。
- gameplay candidateを試す場合、このcontrol観測buildへ直接追加せず、RC6 controlとのpaired比較へ分岐します。

## 統合順

実装上の競合は`ArenaScene`、`ArenaDebugController`、`ArenaDebugBridge`、`ArenaRunExport`周辺の観測フィールドだけです。ゲームロジック同士の競合はありませんでした。

mainへ採用する場合は`#105 -> #106 -> #107 -> #108 -> #109 -> #111`の順を基準とし、後半3件は先行PRの観測フィールドを保持してrebaseします。control観測build自体を先にproductionへ出しません。
