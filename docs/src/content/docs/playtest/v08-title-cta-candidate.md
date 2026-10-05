---
title: v0.8 タイトル主CTA候補
description: Issue #138のStory主CTA候補、比較条件、後続Issueへの契約、残る人間確認。
---

最終更新日: 2026-10-05

:::caution[候補であり未採用]
本ページは[#138](https://github.com/garchomp-game/create-game/issues/138)の実装候補を記録します。
自動テストと固定画像は成立していますが、初見プレイヤーが1秒で主行動を理解するかは
未確認です。人間確認と独立監査が完了するまで採用済みとは扱いません。
:::

## 候補の識別

| 項目 | 値 |
| --- | --- |
| Issue | `#138 [PH-V08-037] 初回タイトルの行動導線を1秒で理解できる階層へする` |
| base SHA | `01ea914a0d24a65b136cf3804d453298fb57ef4e` |
| candidate SHA | 本ページを含むローカルcandidate commitとして固定し、レビュー報告で明示 |
| 状態 | 実装候補。未採用、人間gate待ち |
| 保存・戦闘ルール | 変更なし |

## 採用候補

タイトルを次の3 tierへ分けます。menu orderは
`story, start, practice, ranking, history, settings, betaInfo`のままです。

| tier | 行動 | 960 x 540論理座標 | 表現 |
| --- | --- | --- | --- |
| primary | `ストーリーを始める` | `x=290, y=278, 380 x 72` | 独立行、最大寸法、太字、太い外周線と上端マーカー |
| secondary | `エンドレス`, `練習場` | `y=374, 各220 x 50` | primaryの次行に2列 |
| utility | `ランキング`, `履歴`, `設定`, `情報` | `y=454, 各120 x 38` | 最下行の小型管理導線 |

初期focusは従来どおりStoryです。ただし主従は黄色いfocus色だけで作らず、
寸法、独立した行、文言、font weight、線幅、面の強さでも判別できる候補としました。
全actionのfocus表示、上下キー、Enter / Space、pointer、Story内のEscape / 戻るは維持します。

初回と再訪で文言を分けず、どちらも`ストーリーを始める`とします。
保存状態を導入した後の比較は[#139](https://github.com/garchomp-game/create-game/issues/139)で行います。

## 比較対象と不採用案

UI Catalogのtitle固定fixtureは、同じ`ArenaScreenViewModel`とStory focusを使って
次のbefore / afterを横並びにします。

- baseline: `ストーリー / エンドレス / 練習場`を同寸法・同一行に置く。
- candidate: Storyだけを独立したprimaryにし、Endless / Practiceをsecondaryへ下げる。

次の案は本候補では不採用です。

- 3モードを同格のまま維持する案: 最初の行動を1つに絞れません。
- Storyをfocus色だけで強調する案: 色覚と初期focusに依存し、focus移動後に階層が消えます。
- 初回だけ別ラベルへ変える案: 保存契約が未導入のため、#138へ状態分岐を持ち込みません。
- 11分目や未記録領域をタイトルへ出す案: 採用方向を実装済み機能に見せるため対象外です。

## #141へ渡すレイアウト契約

[#141](https://github.com/garchomp-game/create-game/issues/141)の最終アートは、次を崩さずに置換します。

1. tierは`primary 1 / secondary 2 / utility 4`の3段階とする。
2. primaryは独立行の中央かつ最大とする。
3. secondaryはprimaryの次行に2つ並べる。
4. utilityは最下行にまとめる。
5. 主従を色だけに依存させず、寸法、配置、文言、線、面のうち複数を使う。
6. 960 x 540論理画面と一般的なPC表示で切れ、重なり、hit targetのずれを作らない。

背景や最終アートは本Issueで決めません。この契約内で#141が視覚素材を適用します。

## 自動確認

- layout unit: 7 actionの順序、3 tier、寸法、論理画面内包、相互非重複、hit target。
- catalog unit: Story focusの固定ViewModel、旧文言baseline、candidate文言、tierとfocusの非色CSS契約。
- manifest unit: titleの`情報`は`beta-info`への1経路だけ。Helpは実装済みの戦闘、pause、Practice設定経路だけ。
- Playwright: Story / Endless / Practiceのkeyboard・pointer 6経路、StoryのEscape・戻る。
- 固定画像: title 960 x 540、portrait、UI Catalogのbefore / after。

### 2026-10-05: 画面を跨ぐ連打の補修候補

既存候補`f230816`では、タイトル主CTAを押した座標にStoryの最終遠征が重なり、
別frameの2回目のclickで最終遠征の武器選択へ進むことを実Adapter / Controllerの
隔離再現で確認しました。静止pointerによるfocus奪取対策だけでは、この入力を防げません。

本補修は`b4c34559b6d84097a56742cbd81bf1b8254b85e5`を基点に、#138の入力境界だけを変更します。
2026-10-05のD01草案にある`初期作戦を始める`への文言変更や方向の採用は含めません。
タイトル文言、レイアウト、routing、導入ヒント、保存、simulationは従来の候補のままです。

- 対象はtitle / pause状態のcanvas menu間で、同じ入力方式が続く選択だけ。
- 前のmenu activationから300ms未満で、別contextへ同位置のpointer選択が続く場合は抑止する。
  同位置の許容範囲は最初の選択座標から8論理px以内。抑止clickでfocusだけが移ることも防ぐ。
- Enter等のkeyboard menu選択も同じcontext間の連打規則に従う。押し続けたキーのnative repeatは
  Phaserの`JustDown`で再選択にしない。
- 抑止した同位置click / keyboard選択ごとに300ms窓を更新し、**最後の連打から300ms入力が途切れた後**に
  同位置・同方式での次の選択を許可する。hoverだけでは窓を延長しない。
- 8pxを超えるpointer移動、上下キーによるfocus移動、pointer / keyboardの切替、Escape / 戻るは即時に使える。
  pointerを一度8px超動かして元へ戻した場合も、明確な移動として扱う。
- 同じmenu内の設定連打、戦闘射撃、DOMの武器 / 強化 / contract選択は変更しない。
  run reset等でtransient inputをclearしたときは、この連打状態も破棄する。

Checkpointでは、旧実装でdouble-click / keyboard切替前の誤focus / Enter連打の3 regression unitが
失敗することを先に確認しました。修正後はinput 15件とlayout 10件の対象unit、typecheck、diff checkが通過しています。
E2Eには連続clickからkeyboardで初期作戦へ進む経路、pause / resume、Enter連打、Escape後の再選択を追加しました。
通常のStory選択testは「一覧を確認してから意図的に次を選ぶ」300ms超の待ちを明示します。

### 補修候補の固定QA（2026-10-05）

最終runtime candidateは`4ab2133eafa5d699dcf4ecefb5c8b00899744fdc`です。
初回監査の「近接したpointerの戻るまで抑止する」P2を修正し、履歴`(400, 488)`から
戻る`(400, 492)`への回帰unitを追加しました。再監査は修正必須の指摘なしです。

| 確認 | 結果 |
| --- | --- |
| 全unit（`npm test`） | 120ファイル、747 passed / 2 skipped |
| 型・対象unit | typecheck成功、input 15件 + layout 10件成功 |
| 配布build / artifact検査 | `VITE_GIT_COMMIT=4ab2133eafa5 npm run build:deploy`成功。42ファイル、2.99 MiB |
| Starlight | `ASTRO_TELEMETRY_DISABLED=1 npm run build`成功、141ページ |
| 独立コード監査 | 最終runtime SHAに修正必須の指摘なし |
| Chrome対象E2E | **未実施（環境起動制限）**。テスト本体の合否は未判定 |
| 初見人間gate | 未実施、未採用のまま |

build commitの自動取得はこの実行環境で`unknown`になり、最初のartifact検査は失敗しました。
Gitで読み取った実際の候補SHAを既存の`VITE_GIT_COMMIT`へ明示したbuildで再確認しています。
ソースの版識別処理や検査条件は緩めていません。既存の大きいchunk警告は残ります。

Playwrightは開発サーバーの起動前に停止しました。直接起動でも
`listen EPERM: operation not permitted 0.0.0.0:5174`を確認し、テスト本体へ到達していません。
パッケージ追加や権限・ネットワーク設定の変更は行っていません。待受を許可した環境で、
同じruntime SHAに対して次を実行するのが再開点です（`phaser/`から実行）。

```sh
VITE_GIT_COMMIT=4ab2133eafa5 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e -- tests/e2e/arena.spec.ts tests/e2e/arena-tutorial.spec.ts tests/e2e/arena-visual.spec.ts tests/e2e/release-smoke.spec.ts --project=chrome --workers=1 --grep 'reaches .* from the title|returns from Story|ignores a title click burst|ignores an Enter burst|supports keyboard entry|supports keyboard navigation and Escape|changes and resets settings|runs the final expedition|can pause and resume|shows the Expedition Act, ingress|exposes the release identity|publishes privacy|starts, advances, and exits Training'
```

このコマンドは対象smokeであり、全E2Eの合格を意味しません。旧候補の固定画像は
レイアウトの証拠であり、新しい連打境界のブラウザ確認を代替しません。
コード監査へは回せますが、E2Eと下記の初見人間gateが済むまで採用完了とはしません。
push、GitHub Issue更新、公開反映は行っていません。以後の証跡のみのdocs commitでは
runtimeを変えず、上記SHAのQAへ紐付けます。

固定画像は次のrepo pathで管理します。

- `phaser/tests/e2e/arena-visual.spec.ts-snapshots/arena-title-chrome-linux.png`
- `phaser/tests/e2e/arena-visual.spec.ts-snapshots/arena-title-portrait-chrome-linux.png`
- `phaser/tests/e2e/arena-visual.spec.ts-snapshots/ui-catalog-title-cta-comparison-chrome-linux.png`

## 残る人間gate

事前説明を読んでいない初見プレイヤーへタイトルを1秒だけ見せ、次を確認します。

1. 「最初に何を押す画面か」を一つ答えられるか。
2. 回答がStoryであり、根拠として位置、寸法、文言のいずれかを説明できるか。
3. EndlessとPracticeを、開始不能ではなく別目的の副導線として認識できるか。
4. keyboardとpointerの双方で意図した導線へ迷わず到達できるか。

自動テストは配置と操作契約を証明しますが、1秒理解を証明しません。このgateを通すまでは
「理解された」「採用完了」と記録しません。

## 非変更範囲

- Story保存、初回・再訪判定、解禁。
- 11分目、未記録領域、背景、最終アート。
- simulation、難易度、ruleset、`RunRecord`、PB、ランキング。
- production v0.6.8を対象とするsmoke script。
