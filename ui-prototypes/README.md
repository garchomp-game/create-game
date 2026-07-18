# Arena Core UI Prototypes

`PH-V08-012`の比較専用workspaceです。Phaser production buildとは依存、entry、成果物を共有しません。

```bash
npm install
npm run dev
npm run build
npm run test:e2e
```

- 3案は`src/data.ts`の同一データを使います。
- `concept`、`screen`、`viewport` queryで比較状態を固定できます。
- `capture=1`は960 x 540 / 390 x 844の画像回帰専用表示です。
- `public/assets`は既存のPlaywright画像を比較用に複製したもので、外部素材ではありません。
- production採用はこのworkspaceでは行いません。

比較結果はA「戦術管制」を本番の基礎、B「回収航路」を進行表現、C「精密アーケード」を成果表現へ限定採用しました。productionの採否と再検討条件は`docs/src/content/docs/engineering/ui-library-and-visual-direction-adr.md`を正本とします。
