---
title: v0.8 戦闘オブジェクト意味分類 Phase A
description: runtime visualを変える前に、撃つ・避ける・取るのbaselineを固定するcapture fixture。
---

最終整理日: 2026-07-24

## 目的

敵本体、敵弾、自機弾、XP、REPAIRの現行visualを、低密度・同一scale・
同一背景で比較できる基準へ固定する。これは[#98](https://github.com/garchomp-game/create-game/issues/98)
のPhase Aであり、runtime visual candidateの採用ではない。

## Fixture

debug/test専用scenario `object-semantics-control`を追加する。

| 配置 | 座標 | 観測対象 |
|---|---|---|
| 単体列 | y=120 | 敵本体、敵弾、自機弾、XP、REPAIRを個別表示 |
| hazard / XP重なり | 300, 250 | 敵弾とXPが同位置にある場合 |
| hazard / REPAIR重なり | 660, 250 | 敵弾とREPAIRが同位置にある場合 |
| 5種重なり | 480, 250 | 描画順で何が消えるか |
| magnet anchor | playerから110 / 92 / 52 / 22px | 範囲外、境界、吸引中、取得直前 |

playerは`480, 390`へ固定し、障害物は低密度分類へ混ぜない。
magnet anchorは位置契約であり、Pickup速度やmagnet規則を変更しない。

## Capture matrix

- 960 x 540 desktop。
- 390 x 844 portrait。
- 1365 x 600 landscape-wide。
- 各viewportでcolorとCSS grayscale相当を保存する。
- WebGL非背景pixel、layer count、描画時間、audio routing整合も既存harnessで確認する。

grayscaleは製品表示へ適用せず、色を失った場合のshape差を監査する
test-only後処理である。

## 固定境界

- `PhaserArenaWorldView`、`ViewConfig`、asset、音源を変更しない。
- enemy projectile、Pickup、magnet、hitbox、damage、drop、XPを変更しない。
- simulation RNGを消費しない。
- RunRecord、Profile、ruleset、production trafficを変更しない。
- scenario loaderはdebug hookがないproduction buildから利用できない。

## 自動受け入れ

- 同じseedから同じWorld配置を作る。
- 単体、2種重なり、5種重なりの個数と座標をunitで固定する。
- magnet anchor 4距離をunitで固定する。
- 3 viewport x color / grayscaleの6画像を保存する。
- RC6 control captureの既存3画像と構造assertを維持する。

## 残る人間作業

Phase A画像は分類票へ使用できるが、5秒clipと実戦中の逆方向行動は別証拠である。
T1で誤認が残った場合だけ、次の順で追加する。

1. magnet anchorを順に見せる5秒clipを凍結SHAから収録する。
2. `撃つ / 避ける / 取る / 不明`の自由回答を取得する。
3. color静止画、grayscale静止画、clip、Training transferを別々に記録する。
4. 誤認した対象だけをPhase Bの単一visual candidateへ進める。

このfixtureの自動greenだけを理由に、敵弾tail、Pickup halo、色、shapeを変更しない。
