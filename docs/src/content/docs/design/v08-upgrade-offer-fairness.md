---
title: 通常強化の提示公平性
description: 通常強化の候補偏りを測り、カテゴリ最低保証候補を比較するための固定条件。
---

## 目的

通常強化の取得順によるラン内の変化は残しながら、基礎カテゴリが長期間まったく提示されない外れ値だけを抑えます。

本検証は[#92](https://github.com/garchomp-game/create-game/issues/92)が所有します。強化倍率、XP曲線、敵能力、武器教義、EX進行は同時に変更しません。

## Control

基準commitは`b5cdaaff97a6106335e1ac48e47fd782d6e9bd17`です。通常強化は、利用可能な候補から重みに従って最大3件を独立抽選します。最大済み候補を除外し、解放済み最終強化は先頭へ固定します。

次の固定条件でcontrolを取得しました。

- seed: `20260725`から連続64件
- 武器: Pulse / Spread
- 選択方針: observer優先順 / 常に先頭
- 1組あたり: 通常25ランクを取得するまで
- 比較単位: 同一seed、同一武器、同一選択方針
- 再実行: offer列を含む全結果の完全一致

### Control結果

PulseとSpreadは、対応する武器固有強化以外の分布が一致しました。

| 指標 | observer優先順 | 常に先頭 |
| --- | ---: | ---: |
| 武器カテゴリ初回提示level 最大 | 3 | 3 |
| 機動カテゴリ初回提示level 最大 | 7 | 7 |
| 生存カテゴリ初回提示level 最大 | 7 | 6 |
| 補助カテゴリ初回提示level 最大 | 8 | 8 |
| カテゴリ最大未提示gap 最大 | 10 | 7 |
| `rapidFire`初回提示level 最大 | 11 | 11 |
| 単一強化の最大未提示gap 最大 | 12 | 11 |
| 最終強化の初回提示offer p95 / 最大 | 16 / 16 | 19 / 20 |

中央値では各基礎カテゴリがlevel 2から3で提示されます。一方、外れ値では機動・生存がlevel 7、補助がlevel 8まで初回提示されず、利用可能な単一強化が最大12回続けて候補外になります。

この結果は「平均的なrunが破綻している」ことを示しません。抑える対象は、取得順の違いではなく、基礎カテゴリを判断する機会そのものが長く来ない外れ値です。

## Candidate C1: category floor

実装前に次の条件を固定しました。

| 項目 | 固定値 |
| --- | --- |
| 対象 | 武器、機動、生存、補助の基礎4カテゴリ |
| 発動候補 | 現在利用可能なカテゴリが、直前4回のeligible offerで一度も提示されていない |
| 実介入 | 通常の重み付き3択が今回も対象カテゴリを含まない場合だけ |
| 対象選択 | 対象カテゴリ内の利用可能候補を既存weightで1件抽選 |
| 置換位置 | 最後の非capstone枠 |
| 優先順位 | 未提示gapが長いカテゴリ。tieはカタログ順 |
| 上限 | 1 offerにつき1件、1 runにつき最大4回 |
| 終了 | 通常25ランク完成時。EXへ持ち越さない |

最終強化は置換せず、ロック中・最大済みの強化は分母へ含めません。特定の`rapidFire`は保証しません。カテゴリ保証後も`rapidFire`だけが必須に見える場合は、抽選規則ではなく強化・敵圧力のバランス課題として扱います。

## C1自動比較結果

controlとC1を、同じ64 seed、2武器、2選択方針でpaired比較しました。各条件を再実行し、offer列を含む結果hashの完全一致も確認しています。

| 指標 | Control | C1 |
| --- | ---: | ---: |
| 基礎カテゴリ最大未提示gap | 10 | 4 |
| 武器カテゴリ初回提示level 最大 | 3 | 3 |
| 機動カテゴリ初回提示level 最大 | 7 | 6 |
| 生存カテゴリ初回提示level 最大 | 7 | 6 |
| 補助カテゴリ初回提示level 最大 | 8 | 6 |
| 介入回数 p95 / 最大 | 0 / 0 | 2 / 3 |
| `rapidFire`初回提示level 最大 | 11 | 11 |
| 単一強化の最大未提示gap 最大 | 12 | 12 |
| 最終強化offer p95 / 最大（observer） | 16 / 16 | 16 / 16 |
| 最終強化offer p95 / 最大（先頭選択） | 19 / 20 | 18 / 20 |
| 結果hash | `d14ba124` | `9227055b` |

C1は基礎カテゴリの外れ値だけを上限4へ抑え、1 runの介入は最大3回でした。`rapidFire`や単一強化の提示順は均しておらず、取得順のランダム性は残っています。最終強化の最大提示位置も遅延していません。

既存の序盤カーブprobeを12 seed x 2武器で再実行した結果、全runが通常25ランクを完成してEXへ移行しました。

| 武器 | 通常完成 p50 | 通常完成 min / max | EX開始 p50 |
| --- | ---: | ---: | ---: |
| Pulse | 276.45秒 | 272.55 / 281.90秒 | 297.95秒 |
| Spread | 277.10秒 | 272.35 / 282.15秒 | 296.95秒 |

最初の通常強化は8.05秒、level 5は32.05秒で、[#128](https://github.com/garchomp-game/create-game/issues/128)のcadenceを維持しました。通常完成は約4分36秒で、4分から6分の目標内です。

## 採用ゲート

- 64 seed x 2武器 x 2選択方針で、対象カテゴリの最大未提示gapが4以下。
- 同一条件の再実行でoffer列、event、world hashが完全一致する。
- candidate無効時はcontrolのoffer列、event、world hashが変わらない。
- 1 runの介入回数が4以下で、capstoneを置換・遅延しない。
- 通常25ランク、最大済み除外、capstone解放を維持する。
- 既存のEndless早期カーブprobeで、通常ビルド完成が4分から6分に収まる。
- 武器教義fixtureは通常ビルドを直接完成させ、候補運を比較へ混ぜない。

最大未提示gapを満たしても、人間が毎run同じ取得順に感じる場合は採用しません。採用しない場合はcandidate flagを無効化し、controlの独立重み付き抽選へ戻します。

## 現在の判定

自動ゲートは通過しました。C1は`0.8.0-candidate.3`、Endless ruleset `phaser-v0.8-upgrade-category-floor-c1`として本番記録から分離し、人間比較へ送れる状態です。

production採用は未決定です。Pulse / Spreadで実際に選択し、「基礎カテゴリを待たされる不快感が減るか」「毎run同じ取得順に見えないか」を確認するまで[#92](https://github.com/garchomp-game/create-game/issues/92)を開いたまま維持します。

## QA証跡

- `npm test`: 674 passed / 2 skipped
- `npm run probe:v08:upgrade-fairness:release`: 512 paired runs、control / C1 hash一致
- `npm run probe:v08:upgrade-fairness:gameplay`: 12 seed x 2武器、全runで通常完成とEX開始
- 候補flag付き`npm run test:e2e`: 118 passed / 7 skipped
- production固有E2E再確認: 10 passed
- Chromium / portrait Chromium / Firefox release smoke: 9 passed
- `npm run build:deploy:upgrade-floor`: 34 files、2.95 MiB、deployment verification成功
- Starlight build: 126 pages

候補版でskipするのは、C2で廃止した旧Endless契約、非ランキングcandidateでは成立しないproductionランキングfixture、opt-in soakです。EX Protocol、V3保存、V2移行、固有スキル入力、両武器の代表描画は候補版で実行しています。
