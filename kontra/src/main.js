import {
  GameLoop,
  getPointer,
  init,
  initKeys,
  initPointer,
  keyPressed,
  pointerPressed,
} from "kontra";

const { canvas, context } = init("game-canvas");
initKeys();
initPointer();

const ARENA = { width: 960, height: 540 };
const PLAYER = {
  x: 480,
  y: 270,
  radius: 16,
  speed: 240,
  maxHp: 100,
  damageCooldown: 0.25,
};
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

let random;
let state;
let player;
let bullets;
let enemies;

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
  player = { x: PLAYER.x, y: PLAYER.y, radius: PLAYER.radius };
  bullets = [];
  enemies = [];
}

function moveCircleWithObstacles(circle, dx, dy) {
  if (!dx && !dy) return;
  const oldX = circle.x;
  const oldY = circle.y;
  circle.x += dx;
  circle.y += dy;
  if (OBSTACLES.some((obstacle) => circleRect(circle, obstacle))) {
    circle.x = oldX;
    circle.y = oldY;
  }
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
  enemies.push({
    x,
    y,
    radius: ENEMY.radius,
    hp: ENEMY.hp,
    speed: ENEMY.speed * difficulty.speedMultiplier,
    enteredArena: false,
  });
}

function shoot() {
  if (state.shotTimer > 0) return;
  const aim = state.lastAim;
  const offset = PLAYER.radius + BULLET.radius + 2;
  bullets.push({
    x: player.x + aim.x * offset,
    y: player.y + aim.y * offset,
    vx: aim.x * BULLET.speed,
    vy: aim.y * BULLET.speed,
    radius: BULLET.radius,
    lifetime: BULLET.lifetime,
    damage: BULLET.damage,
  });
  state.shotTimer = BULLET.interval;
}

function updateGame(dt) {
  if (state.status === "gameOver") {
    if (keyPressed("r")) resetGame();
    return;
  }

  state.elapsed += dt;
  state.shotTimer -= dt;
  state.damageCooldown = Math.max(0, state.damageCooldown - dt);

  const pointer = getPointer();
  const aim = normalize(pointer.x - player.x, pointer.y - player.y);
  if (aim.x !== 0 || aim.y !== 0) state.lastAim = aim;

  let dx = 0;
  let dy = 0;
  if (keyPressed("a") || keyPressed("arrowleft")) dx -= 1;
  if (keyPressed("d") || keyPressed("arrowright")) dx += 1;
  if (keyPressed("w") || keyPressed("arrowup")) dy -= 1;
  if (keyPressed("s") || keyPressed("arrowdown")) dy += 1;
  const move = normalize(dx, dy);

  moveCircleWithObstacles(player, move.x * PLAYER.speed * dt, 0);
  moveCircleWithObstacles(player, 0, move.y * PLAYER.speed * dt);
  player.x = clamp(player.x, PLAYER.radius, ARENA.width - PLAYER.radius);
  player.y = clamp(player.y, PLAYER.radius, ARENA.height - PLAYER.radius);

  if (keyPressed("space") || pointerPressed("left")) shoot();

  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.lifetime -= dt;
  }
  bullets = bullets.filter(
    (bullet) =>
      bullet.lifetime > 0 &&
      bullet.x >= 0 &&
      bullet.x <= ARENA.width &&
      bullet.y >= 0 &&
      bullet.y <= ARENA.height &&
      !OBSTACLES.some((obstacle) => circleRect(bullet, obstacle)),
  );

  const difficulty = getDifficulty(state.elapsed);
  state.spawnTimer -= dt;
  let spawned = 0;
  while (state.spawnTimer <= 0 && enemies.length < difficulty.maxEnemies && spawned < 2) {
    spawnEnemy(difficulty);
    state.spawnTimer += difficulty.spawnInterval;
    spawned += 1;
  }

  for (const enemy of enemies) {
    const dir = normalize(player.x - enemy.x, player.y - enemy.y);
    moveCircleWithObstacles(enemy, dir.x * enemy.speed * dt, 0);
    moveCircleWithObstacles(enemy, 0, dir.y * enemy.speed * dt);
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
    if (!hit) remainingBullets.push(bullet);
  }
  bullets = remainingBullets;
  enemies = enemies.filter((enemy) => !deadEnemies.has(enemy));

  if (state.damageCooldown <= 0) {
    if (enemies.some((enemy) => circleCircle(enemy, player))) {
      state.hp -= ENEMY.damage;
      state.damageCooldown = PLAYER.damageCooldown;
    }
  }

  if (state.hp <= 0) {
    state.hp = 0;
    state.status = "gameOver";
  }
}

function drawCircle(x, y, radius, fill, stroke) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.lineWidth = 2;
    context.strokeStyle = stroke;
    context.stroke();
  }
}

function renderGame() {
  context.fillStyle = "#111318";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#6b7280";
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, ARENA.width - 3, ARENA.height - 3);

  for (const obstacle of OBSTACLES) {
    context.fillStyle = "#475569";
    context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    context.strokeStyle = "#94a3b8";
    context.lineWidth = 2;
    context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  }

  for (const bullet of bullets) drawCircle(bullet.x, bullet.y, bullet.radius, "#facc15");
  for (const enemy of enemies) drawCircle(enemy.x, enemy.y, enemy.radius, "#fb7185", "#7f1d1d");

  context.strokeStyle = "#e0f2fe";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(player.x, player.y);
  context.lineTo(player.x + state.lastAim.x * 30, player.y + state.lastAim.y * 30);
  context.stroke();
  drawCircle(player.x, player.y, PLAYER.radius, "#38bdf8", "#075985");

  context.fillStyle = "#f8fafc";
  context.font = "18px Arial, sans-serif";
  context.fillText(`HP: ${Math.ceil(state.hp)}`, 18, 34);
  context.fillText(`Score: ${state.score}`, 18, 64);
  context.fillText(`Time: ${formatTime(state.elapsed)}`, 18, 94);
  context.fillText(`Enemies: ${enemies.length}`, 18, 124);
  context.fillStyle = "#cbd5e1";
  context.fillText("Library: Kontra", 790, 34);

  if (state.status === "gameOver") {
    context.fillStyle = "rgb(2 6 23 / 72%)";
    context.fillRect(0, 0, ARENA.width, ARENA.height);
    context.fillStyle = "#f8fafc";
    context.textAlign = "center";
    context.font = "42px Arial, sans-serif";
    context.fillText("GAME OVER", ARENA.width / 2, 220);
    context.font = "24px Arial, sans-serif";
    context.fillText(`Score: ${state.score}`, ARENA.width / 2, 280);
    context.fillText(`Time: ${formatTime(state.elapsed)}`, ARENA.width / 2, 316);
    context.fillText("Press R to Restart", ARENA.width / 2, 358);
    context.textAlign = "left";
  }
}

resetGame();

const loop = GameLoop({
  update(dt) {
    updateGame(Math.min(dt, 0.05));
  },
  render() {
    renderGame();
  },
});

loop.start();
