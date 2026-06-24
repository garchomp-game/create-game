import * as ex from "excalibur";

ex.Flags.useCanvasGraphicsContext();

const ARENA = {
  width: 960,
  height: 540,
  background: ex.Color.fromHex("#111318"),
  border: ex.Color.fromHex("#6b7280"),
};

const PLAYER = {
  x: 480,
  y: 270,
  radius: 16,
  speed: 240,
  maxHp: 100,
  damageCooldown: 0.25,
  color: ex.Color.fromHex("#38bdf8"),
};

const BULLET = {
  radius: 4,
  speed: 520,
  lifetime: 1.1,
  interval: 0.16,
  damage: 1,
  color: ex.Color.fromHex("#facc15"),
};

const ENEMY = {
  radius: 14,
  hp: 1,
  damage: 12,
  speed: 85,
  score: 10,
  color: ex.Color.fromHex("#fb7185"),
};

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

function circleRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
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

class ArenaScene extends ex.Scene {
  onInitialize(engine) {
    this.engine = engine;
    this.hud = document.querySelector("#hud");
    this.gameOver = document.querySelector("#game-over");
    this.pointerWorld = { x: PLAYER.x + 1, y: PLAYER.y };
    engine.input.pointers.primary.on("move", (event) => {
      this.pointerWorld = { x: event.worldPos.x, y: event.worldPos.y };
    });
    engine.input.pointers.primary.on("down", (event) => {
      this.pointerWorld = { x: event.worldPos.x, y: event.worldPos.y };
    });
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
    this.gameOver.style.display = "none";
  }

  onPreUpdate(engine, elapsedMs) {
    const dt = Math.min(elapsedMs / 1000, 0.05);
    if (this.state.status === "gameOver") {
      if (engine.input.keyboard.wasPressed(ex.Keys.R)) this.resetGame();
      return;
    }

    this.state.elapsed += dt;
    this.state.shotTimer -= dt;
    this.state.damageCooldown = Math.max(0, this.state.damageCooldown - dt);

    this.updateAim();
    this.updatePlayer(engine, dt);
    this.updateShooting(engine);
    this.updateBullets(dt);
    this.updateSpawner(dt);
    this.updateEnemies(dt);
    this.resolveCombat();

    if (this.state.hp <= 0) {
      this.state.hp = 0;
      this.state.status = "gameOver";
    }
  }

  updateAim() {
    const dx = this.pointerWorld.x - this.player.x;
    const dy = this.pointerWorld.y - this.player.y;
    const aim = normalize(dx, dy);
    if (aim.x !== 0 || aim.y !== 0) this.state.lastAim = aim;
  }

  updatePlayer(engine, dt) {
    const keyboard = engine.input.keyboard;
    let dx = 0;
    let dy = 0;
    if (keyboard.isHeld(ex.Keys.A) || keyboard.isHeld(ex.Keys.Left)) dx -= 1;
    if (keyboard.isHeld(ex.Keys.D) || keyboard.isHeld(ex.Keys.Right)) dx += 1;
    if (keyboard.isHeld(ex.Keys.W) || keyboard.isHeld(ex.Keys.Up)) dy -= 1;
    if (keyboard.isHeld(ex.Keys.S) || keyboard.isHeld(ex.Keys.Down)) dy += 1;

    const move = normalize(dx, dy);
    this.moveCircleWithObstacles(this.player, move.x * PLAYER.speed * dt, 0);
    this.moveCircleWithObstacles(this.player, 0, move.y * PLAYER.speed * dt);
    this.player.x = clamp(this.player.x, PLAYER.radius, ARENA.width - PLAYER.radius);
    this.player.y = clamp(this.player.y, PLAYER.radius, ARENA.height - PLAYER.radius);
  }

  updateShooting(engine) {
    const wantsShoot =
      engine.input.keyboard.isHeld(ex.Keys.Space) || engine.input.pointers.primary.isDown;
    if (!wantsShoot || this.state.shotTimer > 0) return;

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
    this.bullets = this.bullets.filter((bullet) => {
      if (bullet.lifetime <= 0) return false;
      if (bullet.x < 0 || bullet.x > ARENA.width || bullet.y < 0 || bullet.y > ARENA.height) {
        return false;
      }
      return !OBSTACLES.some((obstacle) => circleRect(bullet, obstacle));
    });
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
    if (dx === 0 && dy === 0) return;
    const previousX = circle.x;
    const previousY = circle.y;
    circle.x += dx;
    circle.y += dy;
    if (OBSTACLES.some((obstacle) => circleRect(circle, obstacle))) {
      circle.x = previousX;
      circle.y = previousY;
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
      const touchingEnemy = this.enemies.some((enemy) => circleCircle(enemy, this.player));
      if (touchingEnemy) {
        this.state.hp -= ENEMY.damage;
        this.state.damageCooldown = PLAYER.damageCooldown;
      }
    }
  }

  onPreDraw(ctx) {
    ctx.clear();
    ctx.drawRectangle(ex.vec(0, 0), ARENA.width, ARENA.height, ARENA.background);
    ctx.drawRectangle(ex.vec(1, 1), ARENA.width - 2, ARENA.height - 2, ARENA.border, ex.Color.Transparent, 3);

    for (const obstacle of OBSTACLES) {
      ctx.drawRectangle(
        ex.vec(obstacle.x, obstacle.y),
        obstacle.width,
        obstacle.height,
        ex.Color.fromHex("#475569"),
        ex.Color.fromHex("#94a3b8"),
        2,
      );
    }

    for (const bullet of this.bullets) {
      ctx.drawCircle(ex.vec(bullet.x, bullet.y), bullet.radius, BULLET.color);
    }

    for (const enemy of this.enemies) {
      ctx.drawCircle(ex.vec(enemy.x, enemy.y), enemy.radius, ENEMY.color, ex.Color.fromHex("#7f1d1d"), 2);
    }

    ctx.drawLine(
      ex.vec(this.player.x, this.player.y),
      ex.vec(this.player.x + this.state.lastAim.x * 30, this.player.y + this.state.lastAim.y * 30),
      ex.Color.fromHex("#e0f2fe"),
      4,
    );
    ctx.drawCircle(ex.vec(this.player.x, this.player.y), PLAYER.radius, PLAYER.color, ex.Color.fromHex("#075985"), 2);

    this.hud.textContent = `HP: ${Math.ceil(this.state.hp)}\nScore: ${
      this.state.score
    }\nTime: ${formatTime(this.state.elapsed)}\nEnemies: ${this.enemies.length}`;

    if (this.state.status === "gameOver") {
      this.gameOver.style.display = "grid";
      this.gameOver.innerHTML = `<div><strong>GAME OVER</strong>Score: ${
        this.state.score
      }<br>Time: ${formatTime(this.state.elapsed)}<br>Press R to Restart</div>`;
    }
  }
}

const game = new ex.Engine({
  width: ARENA.width,
  height: ARENA.height,
  canvasElementId: "game-canvas",
  displayMode: ex.DisplayMode.Fixed,
  backgroundColor: ARENA.background,
  suppressPlayButton: true,
});

game.add("arena", new ArenaScene());
game.goToScene("arena");
game.start();
