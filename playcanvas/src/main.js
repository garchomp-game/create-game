import {
  Application,
  Color,
  Entity,
  FILLMODE_NONE,
  PROJECTION_ORTHOGRAPHIC,
  RESOLUTION_FIXED,
  StandardMaterial,
} from "playcanvas";

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

const canvas = document.querySelector("#application-canvas");
const hud = document.querySelector("#hud");
const gameOver = document.querySelector("#game-over");

const app = new Application(canvas);
app.setCanvasFillMode(FILLMODE_NONE, ARENA.width, ARENA.height);
app.setCanvasResolution(RESOLUTION_FIXED, ARENA.width, ARENA.height);

function material(name, hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  const mat = new StandardMaterial();
  mat.name = name;
  mat.diffuse = new Color(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
  mat.specular = new Color(0, 0, 0);
  mat.update();
  return mat;
}

const mats = {
  floor: material("floor", "#111318"),
  border: material("border", "#6b7280"),
  obstacle: material("obstacle", "#475569"),
  player: material("player", "#38bdf8"),
  enemy: material("enemy", "#fb7185"),
  bullet: material("bullet", "#facc15"),
  aim: material("aim", "#e0f2fe"),
};

const camera = new Entity("camera");
camera.addComponent("camera", {
  projection: PROJECTION_ORTHOGRAPHIC,
  orthoHeight: ARENA.height,
  clearColor: new Color(0.067, 0.075, 0.094),
});
app.root.addChild(camera);
camera.setPosition(480, 800, 270);
camera.lookAt(480, 0, 270);

const light = new Entity("light");
light.addComponent("light", { type: "directional", intensity: 1.6 });
app.root.addChild(light);
light.setEulerAngles(45, 30, 0);

function addBox(name, x, y, z, sx, sy, sz, mat) {
  const entity = new Entity(name);
  entity.addComponent("render", { type: "box", material: mat });
  app.root.addChild(entity);
  entity.setPosition(x, y, z);
  entity.setLocalScale(sx, sy, sz);
  return entity;
}

function addSphere(name, x, y, z, radius, mat) {
  const entity = new Entity(name);
  entity.addComponent("render", { type: "sphere", material: mat });
  app.root.addChild(entity);
  entity.setPosition(x, y, z);
  entity.setLocalScale(radius * 2, radius * 2, radius * 2);
  return entity;
}

addBox("floor", ARENA.width / 2, -2, ARENA.height / 2, ARENA.width, 4, ARENA.height, mats.floor);
for (const spec of [
  { x: ARENA.width / 2, z: 1.5, w: ARENA.width, d: 3 },
  { x: ARENA.width / 2, z: ARENA.height - 1.5, w: ARENA.width, d: 3 },
  { x: 1.5, z: ARENA.height / 2, w: 3, d: ARENA.height },
  { x: ARENA.width - 1.5, z: ARENA.height / 2, w: 3, d: ARENA.height },
]) {
  addBox("border", spec.x, 2, spec.z, spec.w, 8, spec.d, mats.border);
}
for (const obstacle of OBSTACLES) {
  addBox(
    obstacle.id,
    obstacle.x + obstacle.width / 2,
    14,
    obstacle.y + obstacle.height / 2,
    obstacle.width,
    28,
    obstacle.height,
    mats.obstacle,
  );
}

const keys = new Set();
let pointer = { x: PLAYER.x + 1, y: PLAYER.y, down: false };
let random;
let state;
let player;
let bullets = [];
let enemies = [];
let aimBox;

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * ARENA.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * ARENA.height;
});
canvas.addEventListener("pointerdown", () => {
  pointer.down = true;
});
window.addEventListener("pointerup", () => {
  pointer.down = false;
});

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

function resetGame() {
  if (player?.entity) player.entity.destroy();
  if (aimBox) aimBox.destroy();
  for (const bullet of bullets) bullet.entity.destroy();
  for (const enemy of enemies) enemy.entity.destroy();

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

  player = {
    x: PLAYER.x,
    y: PLAYER.y,
    radius: PLAYER.radius,
    entity: addSphere("player", PLAYER.x, PLAYER.radius, PLAYER.y, PLAYER.radius, mats.player),
  };
  aimBox = addBox("aim", PLAYER.x + 15, PLAYER.radius + 2, PLAYER.y, 30, 4, 4, mats.aim);
  bullets = [];
  enemies = [];
  gameOver.style.display = "none";
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
    entity: addSphere("enemy", x, ENEMY.radius, y, ENEMY.radius, mats.enemy),
  });
}

function shoot() {
  if (state.shotTimer > 0) return;
  const aim = state.lastAim;
  const offset = PLAYER.radius + BULLET.radius + 2;
  const bullet = {
    x: player.x + aim.x * offset,
    y: player.y + aim.y * offset,
    vx: aim.x * BULLET.speed,
    vy: aim.y * BULLET.speed,
    radius: BULLET.radius,
    lifetime: BULLET.lifetime,
    damage: BULLET.damage,
    entity: addSphere("bullet", player.x + aim.x * offset, BULLET.radius, player.y + aim.y * offset, BULLET.radius, mats.bullet),
  };
  bullets.push(bullet);
  state.shotTimer = BULLET.interval;
}

function updateGame(dt) {
  if (state.status === "gameOver") {
    if (keys.has("KeyR")) resetGame();
    return;
  }

  state.elapsed += dt;
  state.shotTimer -= dt;
  state.damageCooldown = Math.max(0, state.damageCooldown - dt);

  const aim = normalize(pointer.x - player.x, pointer.y - player.y);
  if (aim.x !== 0 || aim.y !== 0) state.lastAim = aim;

  let dx = 0;
  let dy = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
  const move = normalize(dx, dy);
  moveCircleWithObstacles(player, move.x * PLAYER.speed * dt, 0);
  moveCircleWithObstacles(player, 0, move.y * PLAYER.speed * dt);
  player.x = clamp(player.x, PLAYER.radius, ARENA.width - PLAYER.radius);
  player.y = clamp(player.y, PLAYER.radius, ARENA.height - PLAYER.radius);

  if (keys.has("Space") || pointer.down) shoot();

  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.lifetime -= dt;
    bullet.entity.setPosition(bullet.x, BULLET.radius, bullet.y);
  }

  bullets = bullets.filter((bullet) => {
    const keep =
      bullet.lifetime > 0 &&
      bullet.x >= 0 &&
      bullet.x <= ARENA.width &&
      bullet.y >= 0 &&
      bullet.y <= ARENA.height &&
      !OBSTACLES.some((obstacle) => circleRect(bullet, obstacle));
    if (!keep) bullet.entity.destroy();
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
    enemy.entity.setPosition(enemy.x, ENEMY.radius, enemy.y);
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
    if (hit) bullet.entity.destroy();
    else remainingBullets.push(bullet);
  }
  bullets = remainingBullets;
  enemies = enemies.filter((enemy) => {
    const keep = !deadEnemies.has(enemy);
    if (!keep) enemy.entity.destroy();
    return keep;
  });

  if (state.damageCooldown <= 0) {
    if (enemies.some((enemy) => circleCircle(enemy, player))) {
      state.hp -= ENEMY.damage;
      state.damageCooldown = PLAYER.damageCooldown;
    }
  }

  player.entity.setPosition(player.x, PLAYER.radius, player.y);
  updateAimBox();
  hud.textContent = `HP: ${Math.ceil(state.hp)}\nScore: ${state.score}\nTime: ${formatTime(
    state.elapsed,
  )}\nEnemies: ${enemies.length}`;

  if (state.hp <= 0) {
    state.hp = 0;
    state.status = "gameOver";
    gameOver.style.display = "grid";
    gameOver.innerHTML = `<div><strong>GAME OVER</strong>Score: ${state.score}<br>Time: ${formatTime(
      state.elapsed,
    )}<br>Press R to Restart</div>`;
  }
}

function updateAimBox() {
  const aim = state.lastAim;
  const length = 30;
  aimBox.setPosition(player.x + aim.x * length / 2, PLAYER.radius + 2, player.y + aim.y * length / 2);
  aimBox.setEulerAngles(0, -Math.atan2(aim.y, aim.x) * 180 / Math.PI, 0);
}

app.on("update", (dt) => {
  updateGame(Math.min(dt, 0.05));
});

window.addEventListener("resize", () => app.resizeCanvas());

resetGame();
app.start();
