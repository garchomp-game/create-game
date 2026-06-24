import { Application, CANVAS, Renderable, Stage, input, state } from "melonjs";

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

class ArenaRenderable extends Renderable {
  constructor() {
    super(0, 0, ARENA.width, ARENA.height);
    this.alwaysUpdate = true;
    this.floating = true;
    this.resetGame();
  }

  resetGame() {
    this.random = createRandom(20260619);
    this.state = {
      status: "playing",
      elapsed: 0,
      score: 0,
      hp: PLAYER.maxHp,
      spawnTimer: 0.25,
      shotTimer: 0,
      damageCooldown: 0,
      lastAim: { x: 1, y: 0 },
    };
    this.player = { x: PLAYER.x, y: PLAYER.y, radius: PLAYER.radius };
    this.bullets = [];
    this.enemies = [];
  }

  update(dtMs) {
    const dt = Math.min(dtMs / 1000, 0.05);

    if (this.state.status === "gameOver") {
      if (input.isKeyPressed("restart")) this.resetGame();
      return true;
    }

    this.state.elapsed += dt;
    this.state.shotTimer -= dt;
    this.state.damageCooldown = Math.max(0, this.state.damageCooldown - dt);

    this.updateAim();
    this.updatePlayer(dt);
    this.updateShooting();
    this.updateBullets(dt);
    this.updateSpawner(dt);
    this.updateEnemies(dt);
    this.resolveCombat();

    if (this.state.hp <= 0) {
      this.state.hp = 0;
      this.state.status = "gameOver";
    }

    return true;
  }

  updateAim() {
    const pointer = input.pointer;
    const aim = normalize(pointer.x - this.player.x, pointer.y - this.player.y);
    if (aim.x !== 0 || aim.y !== 0) this.state.lastAim = aim;
  }

  updatePlayer(dt) {
    let dx = 0;
    let dy = 0;
    if (input.isKeyPressed("left")) dx -= 1;
    if (input.isKeyPressed("right")) dx += 1;
    if (input.isKeyPressed("up")) dy -= 1;
    if (input.isKeyPressed("down")) dy += 1;

    const move = normalize(dx, dy);
    this.moveCircleWithObstacles(this.player, move.x * PLAYER.speed * dt, 0);
    this.moveCircleWithObstacles(this.player, 0, move.y * PLAYER.speed * dt);
    this.player.x = clamp(this.player.x, PLAYER.radius, ARENA.width - PLAYER.radius);
    this.player.y = clamp(this.player.y, PLAYER.radius, ARENA.height - PLAYER.radius);
  }

  updateShooting() {
    if (!input.isKeyPressed("shoot") || this.state.shotTimer > 0) return;

    const aim = this.state.lastAim;
    const offset = PLAYER.radius + BULLET.radius + 2;
    this.bullets.push({
      x: this.player.x + aim.x * offset,
      y: this.player.y + aim.y * offset,
      vx: aim.x * BULLET.speed,
      vy: aim.y * BULLET.speed,
      radius: BULLET.radius,
      lifetime: BULLET.lifetime,
      damage: BULLET.damage,
    });
    this.state.shotTimer = BULLET.interval;
  }

  updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.lifetime -= dt;
    }
    this.bullets = this.bullets.filter(
      (bullet) =>
        bullet.lifetime > 0 &&
        bullet.x >= 0 &&
        bullet.x <= ARENA.width &&
        bullet.y >= 0 &&
        bullet.y <= ARENA.height &&
        !OBSTACLES.some((obstacle) => circleRect(bullet, obstacle)),
    );
  }

  updateSpawner(dt) {
    const difficulty = getDifficulty(this.state.elapsed);
    if (this.enemies.length >= difficulty.maxEnemies) return;
    this.state.spawnTimer -= dt;
    let spawned = 0;
    while (this.state.spawnTimer <= 0 && this.enemies.length < difficulty.maxEnemies && spawned < 2) {
      this.spawnEnemy(difficulty);
      this.state.spawnTimer += difficulty.spawnInterval;
      spawned += 1;
    }
  }

  spawnEnemy(difficulty) {
    const margin = 32;
    const side = Math.floor(this.random() * 4);
    let x = 0;
    let y = 0;
    if (side === 0) {
      x = this.random() * ARENA.width;
      y = -margin;
    } else if (side === 1) {
      x = ARENA.width + margin;
      y = this.random() * ARENA.height;
    } else if (side === 2) {
      x = this.random() * ARENA.width;
      y = ARENA.height + margin;
    } else {
      x = -margin;
      y = this.random() * ARENA.height;
    }
    this.enemies.push({
      x,
      y,
      radius: ENEMY.radius,
      hp: ENEMY.hp,
      speed: ENEMY.speed * difficulty.speedMultiplier,
      enteredArena: false,
    });
  }

  updateEnemies(dt) {
    for (const enemy of this.enemies) {
      const dir = normalize(this.player.x - enemy.x, this.player.y - enemy.y);
      this.moveCircleWithObstacles(enemy, dir.x * enemy.speed * dt, 0);
      this.moveCircleWithObstacles(enemy, 0, dir.y * enemy.speed * dt);

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
  }

  moveCircleWithObstacles(circle, dx, dy) {
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

  resolveCombat() {
    const remainingBullets = [];
    const deadEnemies = new Set();

    for (const bullet of this.bullets) {
      let hit = false;
      for (const enemy of this.enemies) {
        if (deadEnemies.has(enemy) || !circleCircle(bullet, enemy)) continue;
        enemy.hp -= bullet.damage;
        hit = true;
        if (enemy.hp <= 0) {
          deadEnemies.add(enemy);
          this.state.score += ENEMY.score;
        }
        break;
      }
      if (!hit) remainingBullets.push(bullet);
    }

    this.bullets = remainingBullets;
    this.enemies = this.enemies.filter((enemy) => !deadEnemies.has(enemy));

    if (this.state.damageCooldown <= 0) {
      if (this.enemies.some((enemy) => circleCircle(enemy, this.player))) {
        this.state.hp -= ENEMY.damage;
        this.state.damageCooldown = PLAYER.damageCooldown;
      }
    }
  }

  draw(renderer) {
    renderer.setColor("#111318");
    renderer.fillRect(0, 0, ARENA.width, ARENA.height);
    renderer.setColor("#6b7280");
    renderer.strokeRect(1.5, 1.5, ARENA.width - 3, ARENA.height - 3);

    for (const obstacle of OBSTACLES) {
      renderer.setColor("#475569");
      renderer.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      renderer.setColor("#94a3b8");
      renderer.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    for (const bullet of this.bullets) this.drawCircle(renderer, bullet.x, bullet.y, bullet.radius, "#facc15");
    for (const enemy of this.enemies) {
      this.drawCircle(renderer, enemy.x, enemy.y, enemy.radius, "#fb7185", "#7f1d1d");
    }

    renderer.setColor("#e0f2fe");
    renderer.strokeLine(
      this.player.x,
      this.player.y,
      this.player.x + this.state.lastAim.x * 30,
      this.player.y + this.state.lastAim.y * 30,
    );
    this.drawCircle(renderer, this.player.x, this.player.y, PLAYER.radius, "#38bdf8", "#075985");

    const ctx = renderer.getContext();
    ctx.save();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText(`HP: ${Math.ceil(this.state.hp)}`, 18, 34);
    ctx.fillText(`Score: ${this.state.score}`, 18, 64);
    ctx.fillText(`Time: ${formatTime(this.state.elapsed)}`, 18, 94);
    ctx.fillText(`Enemies: ${this.enemies.length}`, 18, 124);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("Library: melonJS", 790, 34);

    if (this.state.status === "gameOver") {
      ctx.fillStyle = "rgb(2 6 23 / 72%)";
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "center";
      ctx.font = "42px Arial, sans-serif";
      ctx.fillText("GAME OVER", ARENA.width / 2, 220);
      ctx.font = "24px Arial, sans-serif";
      ctx.fillText(`Score: ${this.state.score}`, ARENA.width / 2, 280);
      ctx.fillText(`Time: ${formatTime(this.state.elapsed)}`, ARENA.width / 2, 316);
      ctx.fillText("Press R to Restart", ARENA.width / 2, 358);
    }
    ctx.restore();
  }

  drawCircle(renderer, x, y, radius, fill, stroke) {
    renderer.setColor(fill);
    renderer.fillArc(x, y, radius, 0, Math.PI * 2);
    if (stroke) {
      renderer.setColor(stroke);
      renderer.strokeArc(x, y, radius, 0, Math.PI * 2);
    }
  }
}

class PlayStage extends Stage {
  onResetEvent(app) {
    this.arena = new ArenaRenderable();
    app.world.addChild(this.arena, 1);
  }

  onDestroyEvent(app) {
    if (this.arena) {
      app.world.removeChild(this.arena);
      this.arena = undefined;
    }
  }
}

new Application(ARENA.width, ARENA.height, {
  parent: "screen",
  renderer: CANVAS,
  scale: 1,
  scaleMethod: "fit",
  backgroundColor: "#111318",
});

input.bindKey(input.KEY.W, "up", false, true);
input.bindKey(input.KEY.UP, "up", false, true);
input.bindKey(input.KEY.S, "down", false, true);
input.bindKey(input.KEY.DOWN, "down", false, true);
input.bindKey(input.KEY.A, "left", false, true);
input.bindKey(input.KEY.LEFT, "left", false, true);
input.bindKey(input.KEY.D, "right", false, true);
input.bindKey(input.KEY.RIGHT, "right", false, true);
input.bindKey(input.KEY.SPACE, "shoot", false, true);
input.bindKey(input.KEY.R, "restart", true, true);
input.bindPointer(input.pointer.LEFT, input.KEY.SPACE);

state.set(state.PLAY, new PlayStage(), true);
