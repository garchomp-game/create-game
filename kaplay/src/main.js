import kaplay from "kaplay";

const k = kaplay({
  width: 960,
  height: 540,
  letterbox: true,
  global: false,
  canvas: document.querySelector("#game-canvas"),
  background: [17, 19, 24],
});

const {
  add,
  anchor,
  area,
  circle,
  color,
  destroy,
  drawLine,
  fixed,
  hsl2rgb,
  isKeyDown,
  isMouseDown,
  onKeyPress,
  onUpdate,
  pos,
  rect,
  rgb,
  text,
  vec2,
  wait,
  width,
  height,
} = k;

const ARENA = { width: 960, height: 540 };
const PLAYER = { x: 480, y: 270, radius: 16, speed: 240, maxHp: 100, damageCooldown: 0.25 };
const BULLET = { radius: 4, speed: 520, lifetime: 1.1, interval: 0.16, damage: 1 };
const ENEMY = { radius: 14, hp: 1, damage: 12, speed: 85, score: 10 };
const OBSTACLES = [
  { id: "block-a", x: 220, y: 150, width: 120, height: 32 },
  { id: "block-b", x: 620, y: 150, width: 120, height: 32 },
  { id: "block-c", x: 220, y: 360, width: 120, height: 32 },
  { id: "block-d", x: 620, y: 360, width: 120, height: 32 },
  { id: "block-e", x: 444, y: 220, width: 72, height: 32 },
];

function createRandom(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDifficulty(elapsed) {
  if (elapsed >= 60) return { spawnInterval: 0.55, speedMultiplier: 1.35, maxEnemies: 60 };
  if (elapsed >= 30) return { spawnInterval: 0.75, speedMultiplier: 1.18, maxEnemies: 45 };
  return { spawnInterval: 1, speedMultiplier: 1, maxEnemies: 30 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length < 0.0001) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

function circleCircle(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.radius + b.radius;
  return dx * dx + dy * dy <= rr * rr;
}

function circleRect(circle, obstacle) {
  const closestX = clamp(circle.x, obstacle.x, obstacle.x + obstacle.width);
  const closestY = clamp(circle.y, obstacle.y, obstacle.y + obstacle.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function formatTime(elapsed) {
  return `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${Math.floor(
    elapsed % 60,
  )
    .toString()
    .padStart(2, "0")}`;
}

function makeHudLine(value, y) {
  return add([text(value, { size: 18 }), pos(18, y), color(rgb(248, 250, 252)), fixed()]);
}

let random;
let state;
let player;
let aimLine;
let bullets;
let enemies;
let hud;
let gameOverText;

const obstacleObjects = OBSTACLES.map((obstacle) =>
  add([
    rect(obstacle.width, obstacle.height),
    pos(obstacle.x, obstacle.y),
    color(rgb(71, 85, 105)),
    area(),
    "obstacle",
  ]),
);

add([rect(ARENA.width, 3), pos(0, 0), color(rgb(107, 114, 128)), fixed()]);
add([rect(ARENA.width, 3), pos(0, ARENA.height - 3), color(rgb(107, 114, 128)), fixed()]);
add([rect(3, ARENA.height), pos(0, 0), color(rgb(107, 114, 128)), fixed()]);
add([rect(3, ARENA.height), pos(ARENA.width - 3, 0), color(rgb(107, 114, 128)), fixed()]);
add([text("Library: KAPLAY", { size: 18 }), pos(790, 16), color(rgb(203, 213, 225)), fixed()]);

function resetGame() {
  random = createRandom(20260619);
  state = {
    status: "playing",
    elapsed: 0,
    score: 0,
    hp: PLAYER.maxHp,
    spawnTimer: 0.25,
    shotTimer: 0,
    damageCooldown: 0,
    lastAim: { x: 1, y: 0 },
  };

  if (player) destroy(player);
  for (const bullet of bullets ?? []) destroy(bullet.obj);
  for (const enemy of enemies ?? []) destroy(enemy.obj);
  if (aimLine) destroy(aimLine);
  if (gameOverText) destroy(gameOverText);
  for (const line of hud ?? []) destroy(line);

  bullets = [];
  enemies = [];
  hud = [
    makeHudLine("HP: 100", 16),
    makeHudLine("Score: 0", 46),
    makeHudLine("Time: 00:00", 76),
    makeHudLine("Enemies: 0", 106),
  ];

  player = add([
    circle(PLAYER.radius),
    pos(PLAYER.x, PLAYER.y),
    anchor("center"),
    color(rgb(56, 189, 248)),
    area(),
    "player",
  ]);

  aimLine = add([
    {
      draw() {
        drawLine({
          p1: vec2(player.pos.x, player.pos.y),
          p2: vec2(player.pos.x + state.lastAim.x * 30, player.pos.y + state.lastAim.y * 30),
          width: 4,
          color: rgb(224, 242, 254),
        });
      },
    },
  ]);
}

function moveCircle(entity, dx, dy) {
  if (!dx && !dy) return;
  const oldX = entity.x;
  const oldY = entity.y;
  entity.x += dx;
  entity.y += dy;
  if (OBSTACLES.some((obstacle) => circleRect(entity, obstacle))) {
    entity.x = oldX;
    entity.y = oldY;
  }
}

function syncObj(entity) {
  entity.obj.pos.x = entity.x;
  entity.obj.pos.y = entity.y;
}

function spawnEnemy(difficulty) {
  const margin = 32;
  const side = Math.floor(random() * 4);
  let x = 0;
  let y = 0;
  if (side === 0) {
    x = random() * ARENA.width;
    y = -margin;
  } else if (side === 1) {
    x = ARENA.width + margin;
    y = random() * ARENA.height;
  } else if (side === 2) {
    x = random() * ARENA.width;
    y = ARENA.height + margin;
  } else {
    x = -margin;
    y = random() * ARENA.height;
  }

  const obj = add([
    circle(ENEMY.radius),
    pos(x, y),
    anchor("center"),
    color(rgb(251, 113, 133)),
    area(),
    "enemy",
  ]);
  enemies.push({
    x,
    y,
    radius: ENEMY.radius,
    hp: ENEMY.hp,
    speed: ENEMY.speed * difficulty.speedMultiplier,
    enteredArena: false,
    obj,
  });
}

function shoot() {
  if (state.shotTimer > 0) return;
  const aim = state.lastAim;
  const offset = PLAYER.radius + BULLET.radius + 2;
  const x = player.pos.x + aim.x * offset;
  const y = player.pos.y + aim.y * offset;
  const obj = add([
    circle(BULLET.radius),
    pos(x, y),
    anchor("center"),
    color(rgb(250, 204, 21)),
    area(),
    "bullet",
  ]);
  bullets.push({
    x,
    y,
    vx: aim.x * BULLET.speed,
    vy: aim.y * BULLET.speed,
    radius: BULLET.radius,
    lifetime: BULLET.lifetime,
    damage: BULLET.damage,
    obj,
  });
  state.shotTimer = BULLET.interval;
}

function updateHud() {
  hud[0].text = `HP: ${Math.ceil(state.hp)}`;
  hud[1].text = `Score: ${state.score}`;
  hud[2].text = `Time: ${formatTime(state.elapsed)}`;
  hud[3].text = `Enemies: ${enemies.length}`;
}

onKeyPress("r", () => {
  if (state.status === "gameOver") resetGame();
});

resetGame();

onUpdate(() => {
  const dt = Math.min(k.dt(), 0.05);

  if (state.status === "gameOver") {
    updateHud();
    return;
  }

  state.elapsed += dt;
  state.shotTimer -= dt;
  state.damageCooldown = Math.max(0, state.damageCooldown - dt);

  const mouse = k.mousePos();
  const aim = normalize(mouse.x - player.pos.x, mouse.y - player.pos.y);
  if (aim.x !== 0 || aim.y !== 0) state.lastAim = aim;

  let dx = 0;
  let dy = 0;
  if (isKeyDown("a") || isKeyDown("left")) dx -= 1;
  if (isKeyDown("d") || isKeyDown("right")) dx += 1;
  if (isKeyDown("w") || isKeyDown("up")) dy -= 1;
  if (isKeyDown("s") || isKeyDown("down")) dy += 1;
  const move = normalize(dx, dy);

  const playerState = { x: player.pos.x, y: player.pos.y, radius: PLAYER.radius };
  moveCircle(playerState, move.x * PLAYER.speed * dt, 0);
  moveCircle(playerState, 0, move.y * PLAYER.speed * dt);
  player.pos.x = clamp(playerState.x, PLAYER.radius, ARENA.width - PLAYER.radius);
  player.pos.y = clamp(playerState.y, PLAYER.radius, ARENA.height - PLAYER.radius);

  if (isKeyDown("space") || isMouseDown()) shoot();

  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.lifetime -= dt;
    syncObj(bullet);
  }

  bullets = bullets.filter((bullet) => {
    const keep =
      bullet.lifetime > 0 &&
      bullet.x >= 0 &&
      bullet.x <= ARENA.width &&
      bullet.y >= 0 &&
      bullet.y <= ARENA.height &&
      !OBSTACLES.some((obstacle) => circleRect(bullet, obstacle));
    if (!keep) destroy(bullet.obj);
    return keep;
  });

  const difficulty = getDifficulty(state.elapsed);
  state.spawnTimer -= dt;
  let spawned = 0;
  while (state.spawnTimer <= 0 && enemies.length < difficulty.maxEnemies && spawned < 2) {
    spawnEnemy(difficulty);
    state.spawnTimer += difficulty.spawnInterval;
    spawned += 1;
  }

  for (const enemy of enemies) {
    const dir = normalize(player.pos.x - enemy.x, player.pos.y - enemy.y);
    moveCircle(enemy, dir.x * enemy.speed * dt, 0);
    moveCircle(enemy, 0, dir.y * enemy.speed * dt);
    if (
      enemy.x >= enemy.radius &&
      enemy.x <= ARENA.width - enemy.radius &&
      enemy.y >= enemy.radius &&
      enemy.y <= ARENA.height - enemy.radius
    ) {
      enemy.enteredArena = true;
    }
    if (enemy.enteredArena) {
      enemy.x = clamp(enemy.x, enemy.radius, ARENA.width - enemy.radius);
      enemy.y = clamp(enemy.y, enemy.radius, ARENA.height - enemy.radius);
    }
    syncObj(enemy);
  }

  const remainingBullets = [];
  const deadEnemies = new Set();
  for (const bullet of bullets) {
    let hit = false;
    for (const enemy of enemies) {
      if (deadEnemies.has(enemy) || !circleCircle(bullet, enemy)) continue;
      enemy.hp -= bullet.damage;
      hit = true;
      if (enemy.hp <= 0) {
        deadEnemies.add(enemy);
        state.score += ENEMY.score;
      }
      break;
    }
    if (hit) destroy(bullet.obj);
    else remainingBullets.push(bullet);
  }
  bullets = remainingBullets;
  enemies = enemies.filter((enemy) => {
    const keep = !deadEnemies.has(enemy);
    if (!keep) destroy(enemy.obj);
    return keep;
  });

  if (state.damageCooldown <= 0) {
    const playerCircle = { x: player.pos.x, y: player.pos.y, radius: PLAYER.radius };
    if (enemies.some((enemy) => circleCircle(enemy, playerCircle))) {
      state.hp -= ENEMY.damage;
      state.damageCooldown = PLAYER.damageCooldown;
    }
  }

  if (state.hp <= 0) {
    state.hp = 0;
    state.status = "gameOver";
    gameOverText = add([
      text(`GAME OVER\nScore: ${state.score}\nTime: ${formatTime(state.elapsed)}\nPress R to Restart`, {
        size: 34,
        align: "center",
      }),
      pos(width() / 2, height() / 2),
      anchor("center"),
      color(rgb(248, 250, 252)),
      fixed(),
    ]);
  }

  updateHud();
});
