---
title: "Legacy: 詳細設計"
description: "Migrated from docs/03-detailed-design.md."
---

> Source: `docs/03-detailed-design.md`

# 詳細設計

## 1. 共通定数

### 1.1 アリーナ

| 項目 | 値 |
| --- | ---: |
| 論理幅 | `960` |
| 論理高さ | `540` |
| 左端 | `0` |
| 右端 | `960` |
| 上端 | `0` |
| 下端 | `540` |
| 背景色 | `#111318` |
| 外周色 | `#6b7280` |

プレイヤーと敵は、半径分だけ内側に収まるようにする。

### 1.2 プレイヤー

| 項目 | 値 |
| --- | ---: |
| 初期位置X | `480` |
| 初期位置Y | `270` |
| 半径 | `16` |
| 移動速度 | `240 px/sec` |
| 最大HP | `100` |
| 接触後の無敵時間 | `0.25 sec` |
| 表示色 | `#38bdf8` |

### 1.3 射撃

| 項目 | 値 |
| --- | ---: |
| 弾半径 | `4` |
| 弾速度 | `520 px/sec` |
| 弾寿命 | `1.1 sec` |
| 射撃間隔 | `0.16 sec` |
| 弾ダメージ | `1` |
| 弾表示色 | `#facc15` |

射撃方向が未定の場合は、右方向を初期照準とする。

### 1.4 標準敵

| 項目 | 値 |
| --- | ---: |
| 半径 | `14` |
| HP | `1` |
| 接触ダメージ | `12` |
| 基本速度 | `85 px/sec` |
| スコア | `10` |
| 表示色 | `#fb7185` |

### 1.5 スポーン

| 時間帯 | スポーン間隔 | 敵速度倍率 | 最大同時敵数 |
| --- | ---: | ---: | ---: |
| `0 - 29.999 sec` | `1.00 sec` | `1.00` | `30` |
| `30 - 59.999 sec` | `0.75 sec` | `1.18` | `45` |
| `60 sec 以降` | `0.55 sec` | `1.35` | `60` |

スポーン地点はアリーナ外周から `32 px` 外側に置く。

### 1.6 障害物

障害物は以下の5つを標準配置とする。

| ID | X | Y | W | H |
| --- | ---: | ---: | ---: | ---: |
| `block-a` | `220` | `150` | `120` | `32` |
| `block-b` | `620` | `150` | `120` | `32` |
| `block-c` | `220` | `360` | `120` | `32` |
| `block-d` | `620` | `360` | `120` | `32` |
| `block-e` | `444` | `220` | `72` | `32` |

座標は長方形の左上を表す。

3D実装では、長方形を箱として表現する。高さは任意だが、視認しやすい高さにする。

### 1.7 UI

| 項目 | 位置 |
| --- | --- |
| HP | 左上 |
| Score | 左上、HPの下 |
| Time | 上中央または左上 |
| Enemies | 左上または右上 |
| 実装名 | 右上 |
| Game Over | 画面中央 |

## 2. データモデル

実装言語やライブラリに依存しない概念モデルを以下に示す。

```ts
type Vec2 = {
  x: number;
  y: number;
};

type GameStatus = "playing" | "gameOver";

type GameState = {
  status: GameStatus;
  elapsed: number;
  score: number;
  hp: number;
  spawnTimer: number;
  shotTimer: number;
  damageCooldown: number;
  lastAim: Vec2;
};

type Player = {
  position: Vec2;
  radius: number;
};

type Bullet = {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  lifetime: number;
  damage: number;
};

type Enemy = {
  position: Vec2;
  radius: number;
  hp: number;
  speed: number;
};

type Obstacle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
```

ライブラリのActor、Sprite、Body、Meshなどへマッピングしてよい。

## 3. 更新順序

1フレーム内の処理順序は以下を推奨する。

1. `deltaTime` を秒単位で計算する
2. ゲーム状態が `gameOver` ならリスタート入力だけ処理する
3. 入力状態を読む
4. 照準方向を更新する
5. プレイヤー移動を処理する
6. 射撃を処理する
7. 弾を移動する
8. 敵スポーンを処理する
9. 敵移動を処理する
10. 弾と障害物の衝突を処理する
11. 弾と敵の衝突を処理する
12. 敵とプレイヤーの衝突を処理する
13. 敵と障害物の衝突を処理する
14. アリーナ境界を処理する
15. 削除対象を取り除く
16. HUDを更新する
17. HPが0以下なら `gameOver` にする

物理エンジンを使う場合は、物理ステップの都合で順序が変わってよい。ただし、プレイ結果が大きく変わらないようにする。

## 4. 入力処理

### 4.1 移動ベクトル

入力から移動ベクトルを作る。

```ts
let dx = 0;
let dy = 0;

if (left) dx -= 1;
if (right) dx += 1;
if (up) dy -= 1;
if (down) dy += 1;

const length = Math.hypot(dx, dy);
if (length > 0) {
  dx /= length;
  dy /= length;
}
```

移動量は以下。

```ts
position.x += dx * PLAYER_SPEED * deltaTime;
position.y += dy * PLAYER_SPEED * deltaTime;
```

### 4.2 照準方向

マウス座標をワールド座標に変換し、プレイヤーからの方向を求める。

```ts
const aimX = pointerWorld.x - player.position.x;
const aimY = pointerWorld.y - player.position.y;
const length = Math.hypot(aimX, aimY);

if (length > 0.001) {
  lastAim.x = aimX / length;
  lastAim.y = aimY / length;
}
```

### 4.3 射撃

射撃入力が押されており、`shotTimer <= 0` の時に弾を生成する。

弾の初期位置はプレイヤー中心から照準方向へ `player.radius + bullet.radius + 2` だけずらす。

```ts
bullet.position.x = player.x + aim.x * (PLAYER_RADIUS + BULLET_RADIUS + 2);
bullet.position.y = player.y + aim.y * (PLAYER_RADIUS + BULLET_RADIUS + 2);
bullet.velocity.x = aim.x * BULLET_SPEED;
bullet.velocity.y = aim.y * BULLET_SPEED;
bullet.lifetime = BULLET_LIFETIME;
```

生成後、`shotTimer = 0.16` に戻す。

## 5. スポーン設計

### 5.1 難易度取得

経過時間から難易度設定を取得する。

```ts
function getDifficulty(elapsed: number) {
  if (elapsed >= 60) {
    return { spawnInterval: 0.55, speedMultiplier: 1.35, maxEnemies: 60 };
  }
  if (elapsed >= 30) {
    return { spawnInterval: 0.75, speedMultiplier: 1.18, maxEnemies: 45 };
  }
  return { spawnInterval: 1.0, speedMultiplier: 1.0, maxEnemies: 30 };
}
```

### 5.2 スポーンタイマー

`spawnTimer` を毎フレーム減らす。

```ts
spawnTimer -= deltaTime;

if (spawnTimer <= 0 && enemies.length < difficulty.maxEnemies) {
  spawnEnemy();
  spawnTimer += difficulty.spawnInterval;
}
```

フレーム落ちで `spawnTimer` が大きく負になった場合でも、1フレームで大量スポーンしすぎないよう、1フレームあたり最大2体までにする。

### 5.3 スポーン位置

外周の4辺からランダムに選ぶ。

```ts
const margin = 32;
const side = randomInt(0, 3);

switch (side) {
  case 0: // top
    x = randomRange(0, ARENA_WIDTH);
    y = -margin;
    break;
  case 1: // right
    x = ARENA_WIDTH + margin;
    y = randomRange(0, ARENA_HEIGHT);
    break;
  case 2: // bottom
    x = randomRange(0, ARENA_WIDTH);
    y = ARENA_HEIGHT + margin;
    break;
  case 3: // left
    x = -margin;
    y = randomRange(0, ARENA_HEIGHT);
    break;
}
```

敵がアリーナ内に入るまでは、境界外にいてもよい。

### 5.4 乱数

可能であれば、固定シードの乱数を使う。

推奨シード:

```text
20260619
```

簡易実装例:

```ts
function mulberry32(seed: number) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

## 6. 敵移動

敵はプレイヤー方向へ進む。

```ts
const dx = player.x - enemy.x;
const dy = player.y - enemy.y;
const length = Math.hypot(dx, dy);

if (length > 0.001) {
  enemy.x += (dx / length) * enemy.speed * deltaTime;
  enemy.y += (dy / length) * enemy.speed * deltaTime;
}
```

敵速度は以下で決める。

```ts
enemy.speed = ENEMY_BASE_SPEED * difficulty.speedMultiplier;
```

物理エンジンを使う場合は、速度ベクトルまたは力で近似してよい。

## 7. 衝突判定

### 7.1 円と円

プレイヤー、敵、弾の基本衝突は円と円で判定する。

```ts
function circleCircle(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.radius + b.radius;
  return dx * dx + dy * dy <= rr * rr;
}
```

### 7.2 円と長方形

障害物との衝突は円とAABBで判定する。

```ts
function circleRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}
```

### 7.3 プレイヤーと障害物

プレイヤーが障害物へめり込んだ場合、直前位置へ戻す方式でよい。

より自然にする場合は、円と長方形の最近点から押し戻す。

### 7.4 敵と障害物

敵が障害物へめり込んだ場合、直前位置へ戻す方式でよい。

敵が障害物に詰まりやすい場合は、以下の簡易回避を使ってよい。

- X方向だけ移動できるならX方向へ動かす
- Y方向だけ移動できるならY方向へ動かす
- どちらもだめなら直前位置へ戻す

高度なA*やナビゲーションメッシュは不要。

### 7.5 弾と障害物

弾が障害物に当たったら即座に消滅する。

### 7.6 境界

プレイヤーはアリーナ内に収める。

```ts
player.x = clamp(player.x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
player.y = clamp(player.y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
```

弾はアリーナ外に出たら消滅する。

敵はスポーン直後のみ境界外を許容する。アリーナ内に入った後は、できれば外へ戻らないようにする。

## 8. ダメージ処理

### 8.1 弾ダメージ

弾が敵に当たると、敵HPを `1` 減らす。

標準敵のHPは `1` なので、通常は1発で倒れる。

敵が倒れた場合:

```ts
score += 10;
remove(enemy);
```

弾は命中後に消滅する。

### 8.2 プレイヤーダメージ

敵とプレイヤーが接触し、`damageCooldown <= 0` の場合、HPを減らす。

```ts
hp -= 12;
damageCooldown = 0.25;
```

`damageCooldown` は毎フレーム減らす。

```ts
damageCooldown = Math.max(0, damageCooldown - deltaTime);
```

複数の敵が同時に接触しても、1回のクールダウン内では追加ダメージを受けない。

## 9. HUD設計

### 9.1 通常時表示

通常時は以下を表示する。

```text
HP: 100
Score: 0
Time: 00:00
Enemies: 0
Library: Phaser
```

HPは数値またはバーで表示する。可能であればバーと数値の両方を表示する。

### 9.2 時間表示

経過秒を `mm:ss` に変換する。

```ts
const minutes = Math.floor(elapsed / 60);
const seconds = Math.floor(elapsed % 60);
```

### 9.3 ゲームオーバー表示

画面中央に以下を表示する。

```text
GAME OVER
Score: 120
Time: 01:14
Press R to Restart
```

背景を半透明で暗くしてもよい。

## 10. リスタート

リスタート時は以下を初期化する。

- `status`
- `elapsed`
- `score`
- `hp`
- `spawnTimer`
- `shotTimer`
- `damageCooldown`
- `lastAim`
- プレイヤー位置
- 弾配列
- 敵配列

障害物は再作成してもよいし、固定のまま使い回してもよい。

乱数を固定シードにする場合、リスタート時に同じシードへ戻す。

## 11. ライブラリ別実装メモ

### 11.1 Phaser

- Sceneを1つ作り、`preload`、`create`、`update` を使う
- 図形はGraphicsまたはArcade Physics Spriteで表現する
- Arcade Physicsで円/矩形衝突を扱ってよい
- Matter.js統合を使ってもよいが、比較上はArcade Physicsで十分

### 11.2 PixiJS + Matter.js

- PixiJSは描画、Matter.jsは物理を担当する
- Matter bodyとPixi display objectの位置同期が必要
- UIはPixi TextまたはHTML DOMでよい
- 弾は物理Bodyでも手動移動でもよいが、衝突方針を実装メモへ書く

### 11.3 Excalibur.js

- Actor、Collider、Timer、Sceneを活用する
- TypeScript実装を推奨する
- 衝突イベントでダメージと削除を処理する

### 11.4 melonJS

- Entity、World、Collisionを使う
- タイルマップは必須ではない。障害物はコードで配置してよい
- UIはHUD系の仕組み、またはDOMでよい

### 11.5 KAPLAY

- `add`、`pos`、`area`、`body` などのコンポーネントを活用する
- シンプルなコード量で完成することを重視する
- 物理が過剰なら手動移動と当たり判定でよい

### 11.6 Kontra.js

- GameLoop、Sprite、keyboard、pointerを使う
- 衝突判定は手動実装になる可能性が高い
- 小規模実装としての読みやすさを重視する

### 11.7 Three.js + Rapier

- Three.jsは描画、Rapierは物理を担当する
- 上から見た3Dアリーナとして実装する
- 2D座標の `y` は3Dの `z` に対応させる
- カメラはOrthographicCameraを推奨する
- Rapierがセットアップ上重い場合は、手動衝突に切り替えて理由を記録してよい

### 11.8 Babylon.js

- Engine、Scene、Mesh、Camera、Materialを使う
- 上から見た3Dアリーナとして実装する
- 物理プラグインを使うか、手動衝突にするかは実装しやすさで選ぶ
- UIはBabylon GUIまたはHTML DOMでよい

### 11.9 PlayCanvas

- 可能であればコードファーストで構成する
- Entity、Script、Camera、Light、Collision/Rigidbodyを使う
- エディタ前提にせず、ローカルで再現できる形を優先する
- UIはPlayCanvas UIまたはHTML DOMでよい
