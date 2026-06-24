import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

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

await RAPIER.init();

const container = document.querySelector("#game");
const hud = document.querySelector("#hud");
const gameOver = document.querySelector("#game-over");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(ARENA.width, ARENA.height);
renderer.setClearColor(0x111318);
container.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111318);

const camera = new THREE.OrthographicCamera(-480, 480, 270, -270, 0.1, 2000);
camera.position.set(480, 800, 270);
camera.up.set(0, 0, -1);
camera.lookAt(480, 0, 270);

scene.add(new THREE.HemisphereLight(0xffffff, 0x202838, 2.5));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
keyLight.position.set(120, 300, 80);
scene.add(keyLight);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(ARENA.width, 4, ARENA.height),
  new THREE.MeshStandardMaterial({ color: 0x111318 }),
);
floor.position.set(ARENA.width / 2, -2, ARENA.height / 2);
scene.add(floor);

const borderMaterial = new THREE.MeshStandardMaterial({ color: 0x6b7280 });
for (const spec of [
  { x: ARENA.width / 2, z: 1.5, w: ARENA.width, d: 3 },
  { x: ARENA.width / 2, z: ARENA.height - 1.5, w: ARENA.width, d: 3 },
  { x: 1.5, z: ARENA.height / 2, w: 3, d: ARENA.height },
  { x: ARENA.width - 1.5, z: ARENA.height / 2, w: 3, d: ARENA.height },
]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 8, spec.d), borderMaterial);
  mesh.position.set(spec.x, 2, spec.z);
  scene.add(mesh);
}

const materials = {
  player: new THREE.MeshStandardMaterial({ color: 0x38bdf8 }),
  enemy: new THREE.MeshStandardMaterial({ color: 0xfb7185 }),
  bullet: new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x4a3500 }),
  obstacle: new THREE.MeshStandardMaterial({ color: 0x475569 }),
  aim: new THREE.LineBasicMaterial({ color: 0xe0f2fe, linewidth: 4 }),
};

const keys = new Set();
let pointer = { x: PLAYER.x + 1, y: PLAYER.y, down: false };

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
renderer.domElement.addEventListener("pointermove", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * ARENA.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * ARENA.height;
});
renderer.domElement.addEventListener("pointerdown", () => {
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

let world;
let random;
let state;
let player;
let bullets = [];
let enemies = [];
let obstacleBodies = [];
let playerMesh;
let aimLine;
let obstacleMeshes = [];

function createDynamicCircle(x, z, radius) {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0, z).setLinearDamping(3);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.ball(radius).setRestitution(0).setFriction(0);
  world.createCollider(colliderDesc, body);
  return body;
}

function resetGame() {
  clearDynamicObjects();
  world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
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
  gameOver.style.display = "none";

  obstacleBodies = [];
  for (const obstacle of OBSTACLES) {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      obstacle.x + obstacle.width / 2,
      0,
      obstacle.y + obstacle.height / 2,
    );
    const body = world.createRigidBody(bodyDesc);
    world.createCollider(RAPIER.ColliderDesc.cuboid(obstacle.width / 2, 14, obstacle.height / 2), body);
    obstacleBodies.push(body);
  }

  player = createDynamicCircle(PLAYER.x, PLAYER.y, PLAYER.radius);
  playerMesh = new THREE.Mesh(new THREE.SphereGeometry(PLAYER.radius, 24, 16), materials.player);
  playerMesh.position.set(PLAYER.x, PLAYER.radius, PLAYER.y);
  scene.add(playerMesh);

  for (const mesh of obstacleMeshes) scene.remove(mesh);
  obstacleMeshes = OBSTACLES.map((obstacle) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.width, 28, obstacle.height),
      materials.obstacle,
    );
    mesh.position.set(obstacle.x + obstacle.width / 2, 14, obstacle.y + obstacle.height / 2);
    scene.add(mesh);
    return mesh;
  });

  bullets = [];
  enemies = [];
  const aimGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(PLAYER.x, 18, PLAYER.y),
    new THREE.Vector3(PLAYER.x + 30, 18, PLAYER.y),
  ]);
  aimLine = new THREE.Line(aimGeometry, materials.aim);
  scene.add(aimLine);
}

function clearDynamicObjects() {
  if (playerMesh) scene.remove(playerMesh);
  if (aimLine) scene.remove(aimLine);
  for (const bullet of bullets) scene.remove(bullet.mesh);
  for (const enemy of enemies) scene.remove(enemy.mesh);
  bullets = [];
  enemies = [];
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
  const body = createDynamicCircle(x, y, ENEMY.radius);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(ENEMY.radius, 20, 12), materials.enemy);
  mesh.position.set(x, ENEMY.radius, y);
  scene.add(mesh);
  enemies.push({
    body,
    mesh,
    radius: ENEMY.radius,
    hp: ENEMY.hp,
    speed: ENEMY.speed * difficulty.speedMultiplier,
    enteredArena: false,
  });
}

function shoot() {
  if (state.shotTimer > 0) return;
  const translation = player.translation();
  const aim = state.lastAim;
  const offset = PLAYER.radius + BULLET.radius + 2;
  const bullet = {
    x: translation.x + aim.x * offset,
    y: translation.z + aim.y * offset,
    vx: aim.x * BULLET.speed,
    vy: aim.y * BULLET.speed,
    radius: BULLET.radius,
    lifetime: BULLET.lifetime,
    damage: BULLET.damage,
    mesh: new THREE.Mesh(new THREE.SphereGeometry(BULLET.radius, 12, 8), materials.bullet),
  };
  bullet.mesh.position.set(bullet.x, BULLET.radius, bullet.y);
  scene.add(bullet.mesh);
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

  const playerPos = player.translation();
  const aim = normalize(pointer.x - playerPos.x, pointer.y - playerPos.z);
  if (aim.x !== 0 || aim.y !== 0) state.lastAim = aim;

  let dx = 0;
  let dy = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
  const move = normalize(dx, dy);
  player.setLinvel({ x: move.x * PLAYER.speed, y: 0, z: move.y * PLAYER.speed }, true);
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
    const ep = enemy.body.translation();
    const dir = normalize(playerPos.x - ep.x, playerPos.z - ep.z);
    enemy.body.setLinvel({ x: dir.x * enemy.speed, y: 0, z: dir.y * enemy.speed }, true);
  }

  world.step();
  clampRapierBody(player, PLAYER.radius);

  for (const enemy of enemies) {
    const ep = enemy.body.translation();
    if (
      ep.x >= ENEMY.radius &&
      ep.x <= ARENA.width - ENEMY.radius &&
      ep.z >= ENEMY.radius &&
      ep.z <= ARENA.height - ENEMY.radius
    ) {
      enemy.enteredArena = true;
    }
    if (enemy.enteredArena) clampRapierBody(enemy.body, ENEMY.radius);
  }

  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.lifetime -= dt;
    bullet.mesh.position.set(bullet.x, BULLET.radius, bullet.y);
  }

  const deadEnemies = new Set();
  const removedBullets = new Set();
  for (const bullet of bullets) {
    if (
      bullet.lifetime <= 0 ||
      bullet.x < 0 ||
      bullet.x > ARENA.width ||
      bullet.y < 0 ||
      bullet.y > ARENA.height ||
      OBSTACLES.some((obstacle) => circleRect(bullet, obstacle))
    ) {
      removedBullets.add(bullet);
      continue;
    }
    for (const enemy of enemies) {
      if (deadEnemies.has(enemy)) continue;
      const ep = enemy.body.translation();
      const dx = ep.x - bullet.x;
      const dy = ep.z - bullet.y;
      const rr = ENEMY.radius + BULLET.radius;
      if (dx * dx + dy * dy <= rr * rr) {
        enemy.hp -= bullet.damage;
        removedBullets.add(bullet);
        if (enemy.hp <= 0) {
          deadEnemies.add(enemy);
          state.score += ENEMY.score;
        }
        break;
      }
    }
  }

  bullets = bullets.filter((bullet) => {
    const keep = !removedBullets.has(bullet);
    if (!keep) scene.remove(bullet.mesh);
    return keep;
  });
  enemies = enemies.filter((enemy) => {
    const keep = !deadEnemies.has(enemy);
    if (!keep) {
      scene.remove(enemy.mesh);
      world.removeRigidBody(enemy.body);
    }
    return keep;
  });

  if (state.damageCooldown <= 0) {
    const pp = player.translation();
    const touchingPlayer = enemies.some((enemy) => {
      const ep = enemy.body.translation();
      const dx = ep.x - pp.x;
      const dy = ep.z - pp.z;
      const rr = ENEMY.radius + PLAYER.radius;
      return dx * dx + dy * dy <= rr * rr;
    });
    if (touchingPlayer) {
      state.hp -= ENEMY.damage;
      state.damageCooldown = PLAYER.damageCooldown;
    }
  }

  syncMeshes();

  if (state.hp <= 0) {
    state.hp = 0;
    state.status = "gameOver";
    gameOver.style.display = "grid";
    gameOver.innerHTML = `<div><strong>GAME OVER</strong>Score: ${state.score}<br>Time: ${formatTime(
      state.elapsed,
    )}<br>Press R to Restart</div>`;
  }
}

function clampRapierBody(body, radius) {
  const p = body.translation();
  const x = clamp(p.x, radius, ARENA.width - radius);
  const z = clamp(p.z, radius, ARENA.height - radius);
  if (x !== p.x || z !== p.z) {
    body.setTranslation({ x, y: 0, z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
}

function syncMeshes() {
  const pp = player.translation();
  playerMesh.position.set(pp.x, PLAYER.radius, pp.z);
  const points = [
    new THREE.Vector3(pp.x, PLAYER.radius + 2, pp.z),
    new THREE.Vector3(pp.x + state.lastAim.x * 30, PLAYER.radius + 2, pp.z + state.lastAim.y * 30),
  ];
  aimLine.geometry.setFromPoints(points);

  for (const enemy of enemies) {
    const ep = enemy.body.translation();
    enemy.mesh.position.set(ep.x, ENEMY.radius, ep.z);
  }

  hud.textContent = `HP: ${Math.ceil(state.hp)}\nScore: ${state.score}\nTime: ${formatTime(
    state.elapsed,
  )}\nEnemies: ${enemies.length}`;
}

let lastTime = performance.now();
function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateGame(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resetGame();
requestAnimationFrame(animate);
