# Arena Core - Three.js + Rapier

Three.js + Rapier版の `Arena Core` です。

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Controls

- Move: `WASD` or arrow keys
- Aim: mouse
- Shoot: left click or `Space`
- Restart: `R`

## Notes

2D仕様の `x` を3Dの `x`、2D仕様の `y` を3Dの `z` に対応させています。Three.jsは描画、Rapierはプレイヤー/敵/障害物の物理Bodyに使っています。

