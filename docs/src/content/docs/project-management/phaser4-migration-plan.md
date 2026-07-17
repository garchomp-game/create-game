---
title: Phaser 4移行計画
description: Phaser 3.90から4.2.1へゲームルールを変えずに移行し、WebGL描画を再認証する計画と実施記録。
---

最終整理日: 2026-07-15

## 結論

Phaserを`3.90.0`から`4.2.1`へ更新し、既定rendererをWebGLへ移します。当初はCanvas互換を先に通す計画でしたが、4.2.1のCanvas試験では標準`Text`を残して主要`Graphics`が描画されない実不具合を確認しました。公式でもCanvasは非推奨のため、公開ベータ経路には使わず、`VITE_PHASER_RENDERER=canvas`は診断用だけに残します。

- アプリ版は`0.6.7`へ進める。
- ルール版は`phaser-v0.6.6-pulse-precision-tuning`を維持する。
- `RunRecord`、シード、ランキング比較条件は変更しない。
- v0.7のステージ実装前にランタイム移行を閉じ、描画差とゲームルール差を混ぜない。
- v3互換の座標丸めを保つため`roundPixels: true`を明示する。
- WebGL画面読取を安定させる`preserveDrawingBuffer`は`?webglReadback=1`を付けた画像比較E2Eだけで有効にし、通常E2E・耐久・本番では無効にする。

Phaser 4は2026年4月に正式公開され、2026年7月9日時点の最新安定版は`4.2.1`です。公式移行ガイドは、標準のSprite、Text、Graphics、入力APIだけを使うゲームでは移行量が比較的小さい一方、描画基盤は全面的に置き換わっているため、画面回帰を必須としています。

## 現行利用面の監査

| 公式の主要差分 | 現行利用 | 対応 |
| --- | --- | --- |
| 独自WebGL Pipeline / Render Node | なし | 対応不要 |
| FX、Mask、Tint Fill | なし | 対応不要 |
| Shader、DynamicTexture、RenderTexture | なし | 対応不要 |
| Camera行列の直接操作 | なし | 対応不要 |
| `Geom.Point`、`Math.TAU`、`Struct.Set / Map` | なし | 対応不要 |
| Mesh、Plane、Spine、圧縮Texture | なし | 対応不要 |
| 標準`Graphics`、`Text`、Scene、Input、Scale | あり | 型・画像・操作回帰で確認 |
| ESM default import | 11ファイル | `import * as Phaser`へ統一 |
| `roundPixels`既定値 | v3とv4で異なる | 初回移行では明示して互換維持 |
| Canvas renderer | v3で明示固定 | 4.2.1試験で`Graphics`欠落。診断用に限定 |
| WebGL renderer | 未使用 | 4.2.1の既定経路として画像・入力・耐久を再認証 |

シミュレーション、保存、計測、DOM選択UIはPhaserアダプター外にあります。移行の主対象は`src/adapters/phaser`と起動設定であり、ゲームルール側の変更は不要です。

## 実行段階

### 0. 長時間HUDの基準固定

[`PH-BETA-002` #37](https://github.com/garchomp-game/create-game/issues/37)で、HPとEXの桁増加時に文字がバーへ重なる問題を先に直します。

- HP / XPをラベル行と全幅バーへ分ける。
- `HP 204`、`EX Lv12 / C3`、`92,728点`を844 x 390で固定する。
- 遭遇バナーと画面外敵表示の回避領域も同じ寸法へ揃える。

### 1. 互換監査

[`PH-P4-001` #38](https://github.com/garchomp-game/create-game/issues/38)で、公式移行項目と利用面を照合します。

- 更新前の型検査、単体試験、E2E、画像、バンドルサイズを基準として残す。
- import、renderer、`roundPixels`、版管理、ロールバック条件を確定する。
- Phaser固有参照がアダプター境界から漏れていないことを確認する。

### 2. 4.2.1への置換

[`PH-P4-002` #39](https://github.com/garchomp-game/create-game/issues/39)で、依存と互換コードを更新します。

1. `phaser`を`4.2.1`へ更新する。
2. 実行時・型専用importをnamespace importへ統一する。
3. WebGLとピクセル丸めを起動設定へ明示し、Canvasは環境変数による診断経路へ下げる。
4. TypeScript、全単体試験、本番ビルドを通す。
5. タイトル、入力、音声、DOM選択、HUD、保存、デバッグAPIをE2Eで通す。
6. 全画像を確認し、意図しない差分がない場合だけ基準を更新する。

### 3. WebGL公開ベータ再認証

[`PH-P4-003` #40](https://github.com/garchomp-game/create-game/issues/40)で、WebGL経路を公開ベータ候補として再認証します。

- 開発時にCanvas / WebGLを切り替えられる診断口を維持する。
- 960 x 540、844 x 390、390 x 844、DPR 2でWebGL画面の非空、位置、文字、DOM重ね合わせを比較する。
- 最適化済み耐久専用ビルドを`vite preview`で配信し、実GPUの15分耐久でp95 34ms以下、50ms超過率1%未満、Phaser実測FPS 15超を再確認する。
- WebGL固有の視覚差、コンテキスト復旧、GPU依存障害を分類する。
- 不合格ならPhaser 4の公開を止め、依存とアダプターimportを`3.90.0`へ戻す。

## 受け入れゲート

```bash
cd phaser
npm run typecheck
npm test -- --run
npm run build
npm run test:e2e
```

追加確認:

- WebGLコンテキストが生成され、`readPixels`で非背景画素を取得できる。
- メニューでは通常カーソル、プレイ中では照準カーソルになる。
- DOM選択UIがゲーム画面と同じ論理座標へ重なる。
- BGM / SEロード失敗とブラウザコンソールエラーがない。
- 同じ固定シードでシミュレーション結果が変わらない。
- 本番バンドル増加が説明できる範囲に収まる。
- 本番設定では`preserveDrawingBuffer`を有効にしない。

## 実施結果

- アプリ版を`0.6.7`、Phaserを`4.2.1`へ更新し、ルール版`phaser-v0.6.6-pulse-precision-tuning`と保存形式を維持した。
- Phaser 4 Canvasでは標準`Text`を残して主要`Graphics`が欠け、全59件中14件の画像試験が実不具合で失敗したため、公開経路から外した。
- WebGLでは単体試験47ファイル・276件、通常E2E 57件、画像比較25件、本番ビルドが成功した。通常E2Eの2件は15分耐久と無効化中の外周反射画像で意図的にスキップする。
- 長時間HUDは`HP 204 / 204`、`EX Lv12 / C3`、`経験値 49 / 72`、`92728点`の844 x 390画像で重なりがないことを確認した。
- Intel UHD Graphicsを使う最適化済みproduction耐久は、実時間900秒、シミュレーション892.84秒、58583フレームを完走した。平均15.42ms、p95 29ms、50ms超過4件、Phaser実測32.35fps、終端外部FPS31.56だった。
- 最大敵86、全弾257、ピックアップ980、最大JSヒープ155.8MB、WebGL非空サンプル1791、コンソールエラー0件で全ゲートを通過した。
- 同じIntel GPUのdev耐久は平均15.84ms、p95 34ms、50ms超過9件、終端FPS31.69だった。productionは終端負荷を変えず中間フレームの揺れを減らした。
- headless ChromeはSwiftShaderを使うため性能認証には使わない。hardware-soakは開始時にrenderer名を検査し、SwiftShaderなら15分待たず失敗させる。

## ロールバック

依存更新、import変更、起動設定を1つの移行単位として扱います。シミュレーションや保存スキーマへ変更を混ぜないため、重大な描画・入力・音声不具合が見つかった場合は、Phaser依存とアダプターimportだけを3.90系へ戻せます。4.2.1のCanvasは既知の描画欠落があるため、公開版の代替rendererにはしません。

## 公式資料

- [Phaser 4.2.1 release](https://github.com/phaserjs/phaser/releases/tag/v4.2.1)
- [Phaser v3 to v4 Migration Guide](https://github.com/phaserjs/phaser/blob/v4.0.0/changelog/v4/4.0/MIGRATION-GUIDE.md)
- [Phaser 4 releases](https://phaser.io/download/phaser4)
- [ESM importの更新案内](https://phaser.io/news/2026/06/how-to-update-phaser-4-to-the-latest-version-without-breaking-your-project)
