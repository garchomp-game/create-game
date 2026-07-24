---
title: v0.8 Training H0 即時操作ガイド候補
description: 説明を読まない初見ユーザー向けに、開始前とactive直後から操作と対象を視覚対応させる候補。
---

最終整理日: 2026-07-24

## 仮説

初見ユーザーはbriefingを1秒程度で斜め読みするか、そのまま閉じる可能性がある。
その場合に5秒間停止してからWASDを提示しても、「操作不能」と判断して離脱する
時間を先に作ってしまう。

文章を増やすのではなく、開始前とactive直後からキー、方向、対象を同時に見せれば、
説明を読まなくても最初の正しい入力へ移れる。停滞時のH1 / H2は削除せず、
同じ情報の強調と具体化へ役割を変更する。

## Candidate

| 段階 | 発火 | 表示 |
|---|---|---|
| H0 briefing | 課題説明を開いた時点 | 文章とは別に方向付きkey cap、mouse、操作停止、数字keyを表示 |
| H0 active | 課題開始直後 | 下部課題panel直上の固定mini panelへ、今必要なkeyだけを表示。対象名、ring、進行方向も表示 |
| H1 | 5秒間meaningful progressなし | key枠と対象pulseを強調。文章は増やさない |
| H2 | さらに5秒間meaningful progressなし | H1に短い具体文と全経路guideを追加 |

移動keyは`W ↑ / A ← / S ↓ / D →`を個別key capとして示す。
`WASD`という慣習を知らない人にも方向が伝わることを目的とする。
矢印キーでも同じ移動ができることはinstructionへ残す。

## 課題別表示

| 課題 | H0操作 | 対象表示 |
|---|---|---|
| move | briefingは4方向。activeは`D`、到達後に`A` | `右の光`から`左の光`へ切り替える |
| navigate | waypointへ必要なkeyだけ強調 | `移動先`、短い方向矢印。H2だけ全折れ線 |
| contactDamage | `この課題は見るだけ` | `接触でダメージ` |
| aimAndKill | mouseとcrosshair | `静止標的`撃破後、離れた`移動標的`へ切り替える |
| collectXp | 対象方向のkeyを強調 | `XP` |
| chooseUpgrade | `1 / 2 / 3` | 既存choice UIが選択を所有 |
| dodgeProjectile | 安全方向の`W / S`を強調 | 敵弾とREADY表示は既存rendererを使用 |
| collectRepair | 対象方向のkeyを強調 | `REPAIR`。回避終了位置に依存せず、自機から吸引半径外へ固定配置 |
| transferDrill | 追加なし | 既習内容の案内なし転移を維持 |

## 実装境界

- `ArenaTutorialPresenter`は課題からsemantic cueと短いlabelを作る。
- `TutorialCueLayout`は現在位置、対象、waypointから強調keyをpureに決める。
- `PhaserTutorialCueRenderer`はkey cap、対象ring / label、方向矢印だけを描く。
- `PhaserTutorialLayer`は下部課題panel、総合演習checklist、retry noticeを所有する。
- `ArenaTutorialDialog`は同じsemantic cueを開始前のDOMへ描き、screen reader用labelを持つ。

9課題という外側の順序は維持し、`move`と`aimAndKill`だけを内部二段階にする。
接触実演は待ち時間を減らすためTraining専用敵の開始距離を短縮する。最初の射撃標的は
速度0・XP0、次の標的だけ通常の追跡速度とXPを持つ。Endless / Expeditionの敵定義、
simulation、RNG、score、ruleset、Profile、RunRecord、ランキングには変更を加えない。

## 自動受け入れ

- briefingに4方向keyと矢印が開始前から存在する。
- activeのH0でも必要keyだけの固定glyphが存在し、H1は強調だけを増やす。
- moveは右の光へ到達後に左の光へ切り替わり、両方で完了する。
- aimAndKillは静止標的から移動標的へ切り替わり、2体撃破で完了する。
- navigateは現在waypointを使い、壁を横切る方向へ誘導しない。
- XP / REPAIRはlive位置から必要keyを更新する。
- contact、aim、dodgeにも課題固有のH0表示がある。
- transferDrillへ新しい操作promptを追加しない。
- 9課題の公開入力完走、中断、restart、reload、記録非介入を維持する。
- landscape / portrait visual fixtureを固定時刻で再現し、0.1%差分閾値を通す。
- typecheck、対象unit、production buildがgreenである。

## 人間採否

従来の「H1で初めてkeyを表示する」候補と初見参加者を分け、次をraw countで残す。

- briefingを閉じてから最初の正しい入力までの秒数。
- 最初の5秒間に移動入力を一度も行わなかった人数。
- A / Dと左右、W / Sと上下を逆に操作した人数。
- H1 / H2へ到達した人数と、到達後に行動を変えた人数。
- 操作panelが自機、敵弾、対象、障害物を見づらくした人数。
- Training後のEndless 30秒probeで移動、照準、回避、回収へ転移した人数。

開始不能が減っても、操作panelを読み続けないと課題を完了できない場合や、
総合演習で自力判断へ転移しない場合はそのまま採用しない。panelの大きさ、
表示位置、H1時刻を同じ結果の後付けで調整せず、次candidateとして分ける。
