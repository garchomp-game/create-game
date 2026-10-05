---
title: v0.8 タイトル主CTA候補
description: Issue #138のStory主CTA候補、比較条件、後続Issueへの契約、残る人間確認。
---

最終更新日: 2026-10-05

:::caution[候補であり未採用]
本ページは[#138](https://github.com/garchomp-game/create-game/issues/138)の実装候補を記録します。
旧レイアウトの固定画像と、入力補修のunit・build・独立コード監査は確認済みです。
`fcb156a`の[Quality CI](https://github.com/garchomp-game/create-game/actions/runs/37267315505)は
4 job成功、タイトル対象E2E 15件と既存release smoke 9件が通過しました。
旧testの連打間隔が300msを超えていたため、runtimeを変えずにnative入力生成を補修しました。
**自動確認済みの候補であり、初見1秒理解と自宅PCでの人間確認・採否は未完了**です。
下記の手順で確認へ回せますが、人間gateが済むまで採用済みとは扱いません。
:::

## 候補の識別

| 項目 | 値 |
| --- | --- |
| Issue | `#138 [PH-V08-037] 初回タイトルの行動導線を1秒で理解できる階層へする` |
| base SHA | `01ea914a0d24a65b136cf3804d453298fb57ef4e` |
| runtime candidate SHA | `4ab2133eafa5d699dcf4ecefb5c8b00899744fdc` |
| 自動確認済みCI候補SHA（2026-10-05） | [`fcb156a5f5437fd8bb198e5d7d21312397d16d7c`](https://github.com/garchomp-game/create-game/commit/fcb156a5f5437fd8bb198e5d7d21312397d16d7c)。入力補修後のtest / docs候補。runtimeは上記SHAのまま |
| 状態 | 対象E2E 15 passed、release 9 passed、独立監査pass。人間確認・採否待ちで未採用 |
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
| 独立コード監査 | runtimeと後続test候補`fcb156a`の監査はpass、修正必須の指摘なし |
| Chrome対象E2E | `fcb156a`のCIで15 passed。旧`19da7b7`の13 passed / 2 failedは下記の調査履歴 |
| 既存release smoke | 同CIで9 passed（Chrome desktop / portrait、Firefox） |
| 初見人間gate | 未実施、未採用のまま |

build commitの自動取得はこの実行環境で`unknown`になり、最初のartifact検査は失敗しました。
Gitで読み取った実際の候補SHAを既存の`VITE_GIT_COMMIT`へ明示したbuildで再確認しています。
ソースの版識別処理や検査条件は緩めていません。既存の大きいchunk警告は残ります。

当初のローカルPlaywrightは開発サーバーの起動前に停止しました。直接起動でも
`listen EPERM: operation not permitted 0.0.0.0:5174`を確認し、テスト本体へ到達していません。
パッケージ追加や権限・ネットワーク設定の変更は行っていません。
次は当時記録した再開コマンドの履歴です（`phaser/`から実行）。現在の対象E2Eは後続CIで
通過済みのため、このEPERMを現在のblockerとはしません。新規の人間確認は下記の自宅PC手順を使います。

```sh
VITE_GIT_COMMIT=4ab2133eafa5 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e -- tests/e2e/arena.spec.ts tests/e2e/arena-tutorial.spec.ts tests/e2e/arena-visual.spec.ts tests/e2e/release-smoke.spec.ts --project=chrome --workers=1 --grep 'reaches .* from the title|returns from Story|ignores a title click burst|ignores an Enter burst|supports keyboard entry|supports keyboard navigation and Escape|changes and resets settings|runs the final expedition|can pause and resume|shows the Expedition Act, ingress|exposes the release identity|publishes privacy|starts, advances, and exits Training'
```

このコマンドは対象smokeであり、全E2Eの合格を意味しません。旧候補の固定画像は
レイアウトの証拠であり、新しい連打境界のブラウザ確認を代替しません。
コード監査へは回せますが、E2Eと下記の初見人間gateが済むまで採用完了とはしません。
このローカルQAを取得した時点では、push、GitHub Issue更新、公開反映は未実施でした。
以後の証跡のみのdocs / CI commitではruntimeを変えず、上記SHAのQAへ紐付けます。

### 2026-10-05: GitHub同期と対象E2EのCI接続

既存6コミットをmainへpushし、証拠HEAD `65c62e2`をGitHubで確認しました。
[#138](https://github.com/garchomp-game/create-game/issues/138)と
[#135](https://github.com/garchomp-game/create-game/issues/135)へ進捗・残gateを同期済みです。
[このHEADのQuality run](https://github.com/garchomp-game/create-game/actions/runs/37258569139)は
Phaser quality、Starlight build、Browser release smoke、EX Protocol candidateの4 jobが成功しました。
ただし、これは**入力補修の対象15件を追加する前のCI**であり、その合格証拠ではありません。

既存`Browser release smoke` jobへ、release smoke後のChrome対象15件を追加しました。
タイトル6入口、Storyの戻る、click / Enter連打、keyboard操作、設定、最終遠征、
pause / resume、Expedition HUDを対象とし、release smokeにある3件は重複追加しません。
既存EX jobと同じ日本語fixture font、Xvfb、software rendering、単一workerを使い、
失敗成果物は`phaser/test-results/title-input/`へ分離します。
この追加を含む候補`19da7b7`をpushし、以下のCI結果を取得しました。
ローカルの`EPERM`は過去の起動失敗として残します。全E2Eや人間gateの代替にはしません。

新方針は[#146（D01）](https://github.com/garchomp-game/create-game/issues/146)としてqueuedです。
起票は採用ではなく、CTA文言と現行順序を変更しません。productionへのdeployも行っていません。

### 2026-10-05: 追加対象E2Eの失敗と当時の再開点（履歴）

[Quality run 37259047042](https://github.com/garchomp-game/create-game/actions/runs/37259047042)は
CI候補`19da7b74dcb4e8866d4e5773aad349f96b6bd114`で実行し、全体はfailureでした。
Phaser quality、Starlight build、EX Protocol candidateの3 jobは成功、
Browser release smoke job内の既存release stepは9 passedです。
追加したChromeのタイトル入力対象15件は**13 passed / 2 failed**でした。
runtimeは`4ab2133`から変更していません。

| 失敗test（`tests/e2e/arena.spec.ts`） | CIが記録した不一致 |
| --- | --- |
| line 168: `ignores a title click burst and accepts deliberate keyboard selection and pause resume` | line 182で`title`を期待、実際は`weaponSelect` |
| line 205: `ignores an Enter burst while allowing Escape and immediate pointer selection` | line 216で`title`を期待、実際は`trainingBriefing` |

[失敗artifact](https://github.com/garchomp-game/create-game/actions/runs/37259047042/artifacts/11323179063)は
7日間保存です。取得先のローカル名前解決制限により展開できず、**traceの内容は未確認**です。
この時点では、複数のブラウザ操作RPCと待機の間に300ms以上が経過した可能性や、
入力event時刻とAdapterの読取frame時刻の差は、未確定の調査仮説でした。
後述のnativeイベント計測で旧testの間隔超過を確認しました。traceを解析済みとは扱いません。

当時のNEXTはtraceを取得できる環境で、pointer / key event間隔と処理frame時刻を照合することでした。
確認した原因だけを限定修正し、testのskipや許容条件の緩和では通過扱いにしません。
失敗2件を再現・再確認した上で、影響する対象回帰と独立監査を行い、新しいSHA / CIを記録します。
対象E2E通過と初見人間gateが揃うまで#138をcloseせず、採用・production反映へ進みません。

### 2026-10-05: native入力の実測とテスト補修（履歴）

診断候補`92eea35`の[CI run 37262096074](https://github.com/garchomp-game/create-game/actions/runs/37262096074)
で、最初と次のnative down間隔を実測しました。mousedownの`event.timeStamp`は
3091.4 → 3697.5ms（606.1ms、listenerの`performance.now()`差は604.1ms）、
Enterは3017.5 → 3565.1ms（547.6ms、listener時刻差は550.1ms）でした。
イベントはtrusted、Enterのrepeatはfalseで、最初のrAF標本はStory、次は
それぞれweaponSelect / trainingBriefingでした。旧testは300ms未満の連打を作れておらず、
この失敗をruntimeの300ms抑止違反の証拠にはできません。

テスト補修候補はpointer座標を事前計算して5回のnative clickを一つのAPIで送り、
Enterはnative pressを5回連続で送ります。途中のpoll / evaluate / 待機RPCを除き、
5 down・trusted・Enter非repeat・各実間隔300ms未満・全体300ms超をtest自身で検査します。
各down後の2回目rAFでtitle / Story / tutorialなしを確認し、標本が次のdownより前で
別frameに属することも要求します。不正な間隔や未観測はskipせず失敗とします。
最後の標本後は既存の入力方式切替、Escape、pause / resume経路を確認します。

この補修候補を作成した時点ではCI再検証前でした。runtime、300msの閾値、時計、
CI設定、依存、snapshot画像は変更していません。過去の2件失敗を合格へ読み替えず、
以下の別SHAの独立監査・CIを最新証拠とします。初見人間gateと製品採用は未完了です。

### 最新の自動確認: `fcb156a`（2026-10-05）

[Quality run 37267315505](https://github.com/garchomp-game/create-game/actions/runs/37267315505)は
Phaser quality、Starlight build、Browser release smoke、EX Protocol candidateの4 job成功です。
[Phaser job](https://github.com/garchomp-game/create-game/actions/runs/37267315505/job/111626747367)で
typecheck、120ファイルのunit 747 passed / 2 skipped、study contract、配布build / artifact検査が成功しました。
[Browser job](https://github.com/garchomp-game/create-game/actions/runs/37267315505/job/111626747423)は
既存release 9 passedとタイトル対象15 passedです。独立監査もpass、修正必須の指摘はありません。

| 5回のnative down | event間隔 / 全体 | listener観測間隔 / 全体 |
| --- | --- | --- |
| pointer | 131.5〜169.3ms / 612.8ms | 130.2〜158.9ms / 585.4ms |
| Enter | 208.5〜233.4ms / 874.8ms | 213〜227.9ms / 875.5ms |

全イベントがtrusted、Enterは非repeat、欠落0件でした。各2回目rAF標本は次のdownより前で、
title / Story / tutorialなしを維持しました。実間隔300ms未満、全体300ms超、別frame、
各標本の状態をtest内の有効なassertionで検査しています。listener / rAFの時刻は
Phaser内部の正確な処理時刻ではありません。後続の入力方式切替・Escape・pause / resumeは
経路確認であり、「300ms未満の即時切替」の境界証明はunit側と区別します。
これは対象自動gateの成功であり、全E2E、初見理解、製品採用、production deployの成功ではありません。

固定画像は次のrepo pathで管理します。

- `phaser/tests/e2e/arena-visual.spec.ts-snapshots/arena-title-chrome-linux.png`
- `phaser/tests/e2e/arena-visual.spec.ts-snapshots/arena-title-portrait-chrome-linux.png`
- `phaser/tests/e2e/arena-visual.spec.ts-snapshots/ui-catalog-title-cta-comparison-chrome-linux.png`

## 自宅PCでの確認開始点

対象はmainの`fcb156a5f5437fd8bb198e5d7d21312397d16d7c`、またはそこからdocsだけが変わった後続です。
**productionと旧固定Previewには今回の変更をdeployしていません**。通常のローカルUIで確認します。
説明を既に読んだ本人・開発者はUIと機能を確認できますが、下記の「事前説明なしの初見」には数えません。

Node 24と既存npm依存が準備済みの開発環境で、repository rootから次を確認します。
最初の`git status --short`に変更が出た場合や、fast-forwardできない場合は先へ進めず、
手元の変更を保護してください。resetや記録削除は不要です。

```sh
git status --short
git fetch origin
git switch main
git pull --ff-only
git rev-parse HEAD
git merge-base --is-ancestor fcb156a5f5437fd8bb198e5d7d21312397d16d7c HEAD
git diff --name-only fcb156a5f5437fd8bb198e5d7d21312397d16d7c HEAD
```

ancestor検査が成功し、最後の差分が空または`docs/`だけなら、その実際のHEADを記録します。
runtime / tests / CI等の後続差分があれば、この固定候補と混同せずPMへ確認します。
`phaser/package.json`のdevが使う既存Viteを、外部公開しないloopback指定で起動します。
依存の追加installは行いません。既存依存がない場合は起動せず、開発環境の準備を別途確認します。

```sh
cd phaser
./node_modules/.bin/vite --host 127.0.0.1 --port 5174 --strictPort
```

別ブラウザprofileまたはprivate windowで`http://127.0.0.1:5174/`を開きます。
既存profileの保存・PB・履歴を消さず、debug URL、autopilot、fixtureは使いません。
port使用中なら別portへ自動移動せず停止します。旧serverの画面と取り違えないでください。
開始前にGitの実SHAと、画面のbuild表示が一致することを確認します。不一致や`unknown`なら確認を中断します。
依存の警告は[残タスク](../../project-management/issue-resolution-queue/)へ分離し、ここで自動更新しません。

1. 960 x 540の表示領域と普段使うPCサイズで、主CTAの強弱、文字切れ、重なり、focusを確認する。
2. keyboardとpointerでStory / Endless / Practiceへ入り、Escapeと可視の戻るで復帰する。
3. タイトルの同位置click / Enterを短く連打し、意図せず武器選択や初期作戦まで二重遷移しないか確認する。
   手動所感を300ms境界の精密測定とは扱わず、意図して次を選ぶ操作も試す。
4. 初期作戦の案内からpause / resumeし、入力方式を切り替えて操作を継続できるか確認する。
5. 設定変更・設定初期化、ランキング・履歴・情報への往復を確認する。保存データ全削除は実行しない。

確認結果は次の短い形で#138の採否材料へ渡します。未確認の項目は未確認と記録します。

```text
実SHA / 画面build:
OS・ブラウザ版 / 表示領域・倍率:
入力方式 / 確認した経路:
期待 / 実際の結果:
再現手順・頻度 / 画像や短い動画（任意）:
事前説明の有無 / 未確認項目:
```

## 残る人間gate

以下の手順は観察担当者向けです。初見参加者へ本ページや正解を先に見せず、
最初の自由回答を記録してから追加質問・操作課題へ進みます。
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
