# Arena Core - Phaser

Phaser + TypeScript版の `Arena Core` です。

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm run test
npm run typecheck
npm run test:e2e
```

`npm run test:e2e` にはCanvas表示、入力、Game Over/restart、固定状態のスクリーンショット比較が含まれます。

## Controls

- Move: `WASD` or arrow keys
- Aim: mouse
- Shoot: left click or `Space`
- Restart: `R`
- Debug overlay: `F3`

## Notes

PhaserはScene、Input、Graphics、Text、スケール管理の外周に限定し、ゲーム状態と更新処理は `src/simulation` に切り出しています。

主な構成:

- `src/adapters/phaser`: Phaser Scene、入力、描画、Debug Overlay
- `src/simulation`: World更新とsystems
- `src/domain`: 型定義
- `src/config`: ゲーム設定
- `src/math`, `src/format`: Phaser非依存の純粋関数
- `src/ports`, `src/adapters/telemetry`: ログとメトリクスの境界

設定は `simulation` と `view` に分離し、Zodで起動時に検証しています。
