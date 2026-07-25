---
title: UI素材台帳
description: 外部UI素材の出典、ライセンス、加工内容、採用範囲を追跡する台帳。
---

最終更新日: 2026-07-25

## 運用規則

- asset pageと同梱licenseの両方を確認する。
- pack一式ではなく、比較または採用するファイルだけを取り込む。
- 出典、pack版、取得日、元ファイル、加工、使用画面、production可否を記録する。
- 開発カタログの候補は、比較を通過するまでproduction UIから参照しない。
- 提供元のlogoや商標をゲームのbrand素材として使用しない。

## Kenney Input Prompts

| 項目 | 内容 |
| --- | --- |
| 状態 | 開発カタログだけで比較中 |
| Pack | Input Prompts 1.5A |
| 公式ページ | [Kenney Input Prompts](https://kenney.nl/assets/input-prompts) |
| 取得日 | 2026-07-25 |
| Pack作成日 | 2026-07-11 |
| License | [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| 同梱license | `phaser/ui-catalog-assets/kenney-input-prompts-1.5/LICENSE.txt` |
| 加工 | path dataは原本のまま。リポジトリ規約に合わせ末尾改行だけを正規化 |
| 比較画面 | Training briefing、Training active、Help |
| Production | 未採用。production build inputから除外 |

### 取り込んだファイル

| 格納ファイル | Pack内の元ファイル | 用途 |
| --- | --- | --- |
| `keyboard_w_outline.svg` | `Keyboard & Mouse/Vector/keyboard_w_outline.svg` | 上移動 |
| `keyboard_a_outline.svg` | `Keyboard & Mouse/Vector/keyboard_a_outline.svg` | 左移動 |
| `keyboard_s_outline.svg` | `Keyboard & Mouse/Vector/keyboard_s_outline.svg` | 下移動 |
| `keyboard_d_outline.svg` | `Keyboard & Mouse/Vector/keyboard_d_outline.svg` | 右移動 |
| `mouse_move.svg` | `Keyboard & Mouse/Vector/mouse_move.svg` | 照準 |
| `mouse_left.svg` | `Keyboard & Mouse/Vector/mouse_left.svg` | 手動射撃 |

採否は現行CSS keycapと並べ、960 x 540での瞬間認識、最大密度時のコントラスト、説明文を読まない初心者の理解を比較して決めます。採用する場合も必要なSVGだけをproduction assetへ移し、この台帳の状態と使用画面を更新します。
