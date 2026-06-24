import { Application, Graphics } from "pixi.js";
import Matter from "matter-js";

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
const MATTER_STEP = 1 / 60;
const OBSTACLES = [
  { id: "block-a", x: 220, y: 150, width: 120, height: 32 },
  { id: "block-b", x: 620, y: 150, width: 120, height: 32 },
  { id: "block-c", x: 220, y: 360, width: 120, height: 32 },
  { id: "block-d", x: 620, y: 360, width: 120, height: 32 },
  { id: "block-e", x: 444, y: 220, width: 72, height: 32 },
];

const Body = Matter.Body;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Engine = Matter.Engine;
const Events = Matter.Events;

const app = new Application();
await app.init({
  width: ARENA.width,
  height: ARENA.height,
  background: "#111318",
  antialias: true,
});
document.querySelector("#game").prepend(app.canvas);

const graphics = new Graphics();
app.stage.addChild(graphics);

const hud = document.querySelector("#hud");
const gameOver = document.querySelector("#game-over");

const keys = new Set();
let pointer = { x: PLAYER.x + 1, y: PLAYER.y, down: false };

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
app.canvas.addEventListener("pointermove", (event) => {
  const rect = app.canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * ARENA.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * ARENA.height;
});
app.canvas.addEventListener("pointerdown", () => {
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

function formatTime(elapsed) {
  return `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${Math.floor(
    elapsed % 60,
  )
    .toString()
    .padStart(2, "0")}`;
}

let engine;
let random;
let state;
let player;
let bullets = [];
let enemies = [];
let obstacles = [];
let pendingRemovals = new Set();

function makeBody(type, body, data = {}) {
  body.gameType = type;
  body.gameData = data;
  return body;
}

function resetGame() {
  engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;
  random = createRandom(20260619);
  pendingRemovals = new Set();

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

  player = makeBody(
    "player",
    Bodies.circle(PLAYER.x, PLAYER.y, PLAYER.radius, {
      frictionAir: 0.2,
      inertia: Infinity,
      restitution: 0,
    }),
  );

  bullets = [];
  enemies = [];
  obstacles = OBSTACLES.map((obstacle) =>
    makeBody(
      "obstacle",
      Bodies.rectangle(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height / 2,
        obstacle.width,
        obstacle.height,
        { isStatic: true },
      ),
      obstacle,
    ),
  );

  Composite.add(engine.world, [player, ...obstacles]);
  Events.on(engine, "collisionStart", handleCollisionPairs);
  Events.on(engine, "collisionActive", handleCollisionPairs);
  gameOver.style.display = "none";
}

function handleCollisionPairs(event) {
  if (state.status !== "playing") return;
  for (const pair of event.pairs) {
    const a = pair.bodyA;
    const b = pair.bodyB;
    const types = [a.gameType, b.gameType];

    if (types.includes("bullet") && types.includes("enemy")) {
      const bullet = a.gameType === "bullet" ? a : b;
      const enemy = a.gameType === "enemy" ? a : b;
      if (!pendingRemovals.has(bullet)) {
        enemy.gameData.hp -= bullet.gameData.damage;
        pendingRemovals.add(bullet);
        if (enemy.gameData.hp <= 0) {
          pendingRemovals.add(enemy);
          state.score += ENEMY.score;
        }
      }
    }

    if (types.includes("bullet") && types.includes("obstacle")) {
      pendingRemovals.add(a.gameType === "bullet" ? a : b);
    }
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

  const enemy = makeBody(
    "enemy",
    Bodies.circle(x, y, ENEMY.radius, {
      frictionAir: 0.15,
      inertia: Infinity,
      restitution: 0,
    }),
    { hp: ENEMY.hp, speed: ENEMY.speed * difficulty.speedMultiplier, enteredArena: false },
  );
  enemies.push(enemy);
  Composite.add(engine.world, enemy);
}

function shoot() {
  if (state.shotTimer > 0) return;
  const aim = state.lastAim;
  const offset = PLAYER.radius + BULLET.radius + 2;
  const bullet = makeBody(
    "bullet",
    Bodies.circle(
      player.position.x + aim.x * offset,
      player.position.y + aim.y * offset,
      BULLET.radius,
      { isSensor: true, frictionAir: 0, inertia: Infinity },
    ),
    { lifetime: BULLET.lifetime, damage: BULLET.damage },
  );
  Body.setVelocity(bullet, {
    x: aim.x * BULLET.speed * MATTER_STEP,
    y: aim.y * BULLET.speed * MATTER_STEP,
  });
  bullets.push(bullet);
  Composite.add(engine.world, bullet);
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

  const aim = normalize(pointer.x - player.position.x, pointer.y - player.position.y);
  if (aim.x !== 0 || aim.y !== 0) state.lastAim = aim;

  let dx = 0;
  let dy = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
  const move = normalize(dx, dy);
  Body.setVelocity(player, {
    x: move.x * PLAYER.speed * MATTER_STEP,
    y: move.y * PLAYER.speed * MATTER_STEP,
  });

  if (keys.has("Space") || pointer.down) shoot();

  const difficulty = getDifficulty(state.elapsed);
  state.spawnTimer -= dt;
  let spawned = 0;
  while (state.spawnTimer <= 0 && enemies.length < difficulty.maxEnemies && spawned < 2) {
    spawnEnemy(difficulty);
    state.spawnTimer += difficulty.spawnInterval;
    spawned += 1;
  }

  for (const enemy of enemies) {
    const dir = normalize(player.position.x - enemy.position.x, player.position.y - enemy.position.y);
    Body.setVelocity(enemy, {
      x: dir.x * enemy.gameData.speed * MATTER_STEP,
      y: dir.y * enemy.gameData.speed * MATTER_STEP,
    });
  }

  Engine.update(engine, 1000 / 60);
  clampBody(player, PLAYER.radius);
  for (const enemy of enemies) {
    if (
      enemy.position.x >= ENEMY.radius &&
      enemy.position.x <= ARENA.width - ENEMY.radius &&
      enemy.position.y >= ENEMY.radius &&
      enemy.position.y <= ARENA.height - ENEMY.radius
    ) {
      enemy.gameData.enteredArena = true;
    }
    if (enemy.gameData.enteredArena) clampBody(enemy, ENEMY.radius);
  }

  for (const bullet of bullets) {
    bullet.gameData.lifetime -= dt;
    if (
      bullet.gameData.lifetime <= 0 ||
      bullet.position.x < 0 ||
      bullet.position.x > ARENA.width ||
      bullet.position.y < 0 ||
      bullet.position.y > ARENA.height
    ) {
      pendingRemovals.add(bullet);
    }
  }

  if (state.damageCooldown <= 0) {
    const touchingPlayer = enemies.some((enemy) => {
      const dx = enemy.position.x - player.position.x;
      const dy = enemy.position.y - player.position.y;
      const rr = ENEMY.radius + PLAYER.radius;
      return dx * dx + dy * dy <= rr * rr;
    });
    if (touchingPlayer) {
      state.hp -= ENEMY.damage;
      state.damageCooldown = PLAYER.damageCooldown;
    }
  }

  removePendingBodies();

  if (state.hp <= 0) {
    state.hp = 0;
    state.status = "gameOver";
    gameOver.style.display = "grid";
    gameOver.innerHTML = `<div><strong>GAME OVER</strong>Score: ${state.score}<br>Time: ${formatTime(
      state.elapsed,
    )}<br>Press R to Restart</div>`;
  }
}

function clampBody(body, radius) {
  const x = clamp(body.position.x, radius, ARENA.width - radius);
  const y = clamp(body.position.y, radius, ARENA.height - radius);
  if (x !== body.position.x || y !== body.position.y) {
    Body.setPosition(body, { x, y });
    Body.setVelocity(body, { x: 0, y: 0 });
  }
}

function removePendingBodies() {
  if (pendingRemovals.size === 0) return;
  for (const body of pendingRemovals) {
    Composite.remove(engine.world, body);
  }
  bullets = bullets.filter((bullet) => !pendingRemovals.has(bullet));
  enemies = enemies.filter((enemy) => !pendingRemovals.has(enemy));
  pendingRemovals.clear();
}

function drawGame() {
  graphics.clear();
  graphics.rect(0, 0, ARENA.width, ARENA.height).fill(0x111318);
  graphics.rect(1.5, 1.5, ARENA.width - 3, ARENA.height - 3).stroke({ color: 0x6b7280, width: 3 });

  for (const obstacle of OBSTACLES) {
    graphics.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height).fill(0x475569);
    graphics.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height).stroke({ color: 0x94a3b8, width: 2 });
  }

  for (const bullet of bullets) {
    graphics.circle(bullet.position.x, bullet.position.y, BULLET.radius).fill(0xfacc15);
  }

  for (const enemy of enemies) {
    graphics.circle(enemy.position.x, enemy.position.y, ENEMY.radius).fill(0xfb7185);
    graphics.circle(enemy.position.x, enemy.position.y, ENEMY.radius).stroke({ color: 0x7f1d1d, width: 2 });
  }

  graphics
    .moveTo(player.position.x, player.position.y)
    .lineTo(player.position.x + state.lastAim.x * 30, player.position.y + state.lastAim.y * 30)
    .stroke({ color: 0xe0f2fe, width: 4 });
  graphics.circle(player.position.x, player.position.y, PLAYER.radius).fill(0x38bdf8);
  graphics.circle(player.position.x, player.position.y, PLAYER.radius).stroke({ color: 0x075985, width: 2 });

  hud.textContent = `HP: ${Math.ceil(state.hp)}\nScore: ${state.score}\nTime: ${formatTime(
    state.elapsed,
  )}\nEnemies: ${enemies.length}`;
}

resetGame();
app.ticker.add((ticker) => {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  updateGame(dt);
  drawGame();
});
