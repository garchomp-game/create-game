---
title: Onboarding StudyLog 契約
description: 初回体験の観測を製品記録と分離するローカル検証基盤。
---

最終更新: 2026-07-24

## 位置づけ

OnboardingとTrainingの候補比較には、最初の正しい入力、進展、誤操作、
ヒント段階、完了・中断を同じ意味で記録する必要がある。一方で、この観測を
正式runの`RunRecord`、Profile、ランキングへ混ぜると、候補試験が製品状態を
書き換えてしまう。

`phaser/study/`は、この問題だけを扱う開発用契約である。製品runtimeから
importせず、PreviewまたはローカルでexportしたJSON / JSONLをオフライン検査する。

## 契約

- session kindは`o1`、`full-training`、`context-prompt`、`retention`の4種。
- eventは共通build identity、候補cell、assignment、active elapsedを持つ。
- pause、blur、loading、choice中はactive elapsedへ加えない。
- 1 sessionは最大256 event。連続座標や全入力を保存しない。
- 氏名、メール、自由記述、login IDを保存しない。
- `completed`、`skipped`、`abandoned`を混同しない。
- StudyLogからProfile上の完了状態を復元しない。
- 外部送信は行わない。

現行のfull Training定義は、製品の9課題
`move / navigate / contactDamage / aimAndKill / collectXp / chooseUpgrade /
dodgeProjectile / collectRepair / transferDrill`
と同順序で固定する。Vitestが製品側の`TUTORIAL_STEP_IDS`との乖離を検出する。

## 検証

```sh
cd phaser
npm run study:contract
npm run study:digest -- study/templates/STUDY_DEFINITION_FULL_TRAINING.example.json
npm run study:validate -- path/to/session.json path/to/candidate-manifest.json
```

contract self-testは4 session kind、O1の両入口arm、順序・identity・privacy・
hint・終端条件に対するnegative mutationを検査する。GitHub Actionsの
`Phaser quality`でも実行する。

## 未接続境界

この段階ではschema、validator、fixtureだけを導入する。次は採用候補の凍結SHAと
human protocolを確定してから、候補専用adapterを一つ追加する。

- ゲームruntimeからの自動記録
- Dev serverへの保存endpoint
- Cloudflareへの送信
- RunRecord / Profile schema変更
- O1入口や内容の採用

これらは本契約のgreenだけでは開始しない。
