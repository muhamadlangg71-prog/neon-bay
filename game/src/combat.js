// Combat: punch (three-hit combo) and pistol (limited magazine, reload with R).
// Shots are sphere-tested against enemies, pedestrians, cops and cars; a tracer
// line and the synth gunshot sell each round.
import * as THREE from '../vendor/three.module.min.js';
import { COMBAT } from './config.js';

const PISTOL_DAMAGE = 34;
const PUNCH_DAMAGE = 15;
const PISTOL_RANGE = 70;
const FIRE_INTERVAL = 0.28;

function createEnemyMesh() {
  const g = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0x8a1f1f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1d2733 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pants);
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), red);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.75;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 1.25, 0.3);
  g.add(legs, torso, head, gun);
  g.traverse((m) => {
    m.castShadow = true;
  });
  return g;
}

export function createCombat(scene, random) {
  const enemies = [];
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  let fireCooldown = 0;
  let punchCooldown = 0;
  let wantedRaiseCooldown = 0;
  let ammo = COMBAT.magSize;
  let reloadTimer = 0;
  let combo = 0;
  let comboTimer = 0;

  function startReload(audio) {
    if (reloadTimer > 0 || ammo >= COMBAT.magSize) return;
    reloadTimer = COMBAT.reloadSeconds;
    if (audio) audio.reload();
  }

  function spawnEnemy(x, z) {
    const mesh = createEnemyMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const enemy = { mesh, x, z, health: 60, heading: 0, shootTimer: random.range(1, 2.5), walkPhase: 0 };
    enemies.push(enemy);
    return enemy;
  }

  function removeEnemy(enemy) {
    scene.remove(enemy.mesh);
    const i = enemies.indexOf(enemy);
    if (i >= 0) enemies.splice(i, 1);
  }

  // Ray-sphere test against a list of {x, z, y?, radius, ref}.
  function rayHit(origin, dir, targets) {
    let best = null;
    let bestT = PISTOL_RANGE;
    for (const t of targets) {
      const cx = t.x - origin.x;
      const cy = (t.y ?? 1.2) - origin.y;
      const cz = t.z - origin.z;
      const proj = cx * dir.x + cy * dir.y + cz * dir.z;
      if (proj < 0 || proj > bestT) continue;
      const px = origin.x + dir.x * proj;
      const py = origin.y + dir.y * proj;
      const pz = origin.z + dir.z * proj;
      const dx = t.x - px;
      const dy = (t.y ?? 1.2) - py;
      const dz = t.z - pz;
      if (dx * dx + dy * dy + dz * dz < t.radius * t.radius) {
        bestT = proj;
        best = t;
      }
    }
    return best ? { target: best, distance: bestT } : null;
  }

  function addTracer(from, to) {
    const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const geo = new THREE.CylinderGeometry(0.02, 0.02, len, 4);
    const mesh = new THREE.Mesh(geo, tracerMat.clone());
    mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    mesh.lookAt(to.x, to.y, to.z);
    mesh.rotateX(Math.PI / 2);
    mesh.userData.life = 0.07;
    scene.add(mesh);
    tracers.push(mesh);
  }

  return {
    enemies,
    get ammo() {
      return ammo;
    },
    get magSize() {
      return COMBAT.magSize;
    },
    get reloading() {
      return reloadTimer > 0;
    },
    spawnEnemy,
    spawnCrew(x, z) {
      const spots = [[-6, -4], [6, -6], [-4, 6], [7, 4]];
      for (const [ox, oz] of spots) spawnEnemy(x + ox, z + oz);
    },
    crewAlive() {
      return enemies.length;
    },
    clearEnemies() {
      for (const e of [...enemies]) removeEnemy(e);
    },
    update(dt, ctx) {
      fireCooldown -= dt;
      punchCooldown -= dt;
      wantedRaiseCooldown -= dt;
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
      if (reloadTimer > 0) {
        reloadTimer -= dt;
        if (reloadTimer <= 0) {
          reloadTimer = 0;
          ammo = COMBAT.magSize;
        }
      }
      // Tracer fade.
      for (const t of [...tracers]) {
        t.userData.life -= dt;
        t.material.opacity = Math.max(0, t.userData.life / 0.07) * 0.9;
        if (t.userData.life <= 0) {
          scene.remove(t);
          tracers.splice(tracers.indexOf(t), 1);
        }
      }
      // Player punch (F): a three-hit combo — the third hit is a heavy finisher.
      if (ctx.input.wasPressed('punch') && punchCooldown <= 0) {
        punchCooldown = 0.45;
        combo = comboTimer > 0 ? combo + 1 : 1;
        comboTimer = COMBAT.punchComboWindow;
        const finisher = combo >= 3;
        if (finisher) combo = 0;
        const damage = finisher ? PUNCH_DAMAGE * 2 : PUNCH_DAMAGE;
        ctx.audio.punch();
        const fx = Math.sin(ctx.player.heading);
        const fz = Math.cos(ctx.player.heading);
        const hitList = [];
        for (const e of enemies) hitList.push({ x: e.x, z: e.z, radius: 1, ref: e, kind: 'enemy' });
        for (const p of ctx.peds.peds) hitList.push({ x: p.x, z: p.z, radius: 1, ref: p, kind: 'ped' });
        for (const u of ctx.police.units) {
          if (u.kind === 'cop') hitList.push({ x: u.x, z: u.z, radius: 1, ref: u, kind: 'cop' });
        }
        for (const h of hitList) {
          const dx = h.x - ctx.player.x;
          const dz = h.z - ctx.player.z;
          const d = Math.hypot(dx, dz);
          if (d < 2.4 && (dx * fx + dz * fz) / (d || 1) > 0.4) {
            if (h.kind === 'enemy') {
              h.ref.health -= damage;
              ctx.audio.hit();
              if (h.ref.health <= 0) removeEnemy(h.ref);
            } else if (h.kind === 'cop') {
              ctx.police.addWanted(1);
              ctx.audio.hit();
            } else {
              ctx.peds.scare(h.x, h.z, 8);
              ctx.police.addWanted(1);
            }
            break;
          }
        }
      }
      // Reload (R), or automatically when the magazine runs dry.
      if (ctx.input.wasPressed('reload')) startReload(ctx.audio);
      // Player pistol: mouse click fires from the camera toward its forward ray.
      if (ctx.input.shootClicked() && fireCooldown <= 0 && ctx.screen === 'play') {
        if (reloadTimer > 0) {
          // Mid-reload: the trigger does nothing.
        } else if (ammo <= 0) {
          ctx.audio.click();
          startReload(ctx.audio);
        } else {
          ammo -= 1;
          fireCooldown = FIRE_INTERVAL;
        const origin = ctx.shootOrigin;
        const dir = ctx.shootDir;
        const targets = [];
        for (const e of enemies) targets.push({ x: e.x, z: e.z, y: 1.2, radius: 1.1, ref: e, kind: 'enemy' });
        for (const p of ctx.peds.peds) targets.push({ x: p.x, z: p.z, y: 1.2, radius: 1, ref: p, kind: 'ped' });
        for (const u of ctx.police.units) {
          if (u.kind === 'cop') targets.push({ x: u.x, z: u.z, y: 1.2, radius: 1, ref: u, kind: 'cop' });
          else targets.push({ x: u.x, z: u.z, y: 1, radius: 2.4, ref: u, kind: 'policeCar' });
        }
        for (const c of ctx.traffic.cars) targets.push({ x: c.x, z: c.z, y: 1, radius: 2.4, ref: c, kind: 'car' });
        const hit = rayHit(origin, dir, targets);
        const end = hit
          ? { x: origin.x + dir.x * hit.distance, y: origin.y + dir.y * hit.distance, z: origin.z + dir.z * hit.distance }
          : { x: origin.x + dir.x * PISTOL_RANGE, y: origin.y + dir.y * PISTOL_RANGE, z: origin.z + dir.z * PISTOL_RANGE };
        addTracer(origin, end);
        ctx.audio.shoot();
        ctx.peds.scare(ctx.player.x, ctx.player.z, 40);
        if (hit) {
          if (hit.target.kind === 'enemy') {
            hit.target.ref.health -= PISTOL_DAMAGE;
            ctx.audio.hit();
            if (hit.target.ref.health <= 0) removeEnemy(hit.target.ref);
          } else if (hit.target.kind === 'cop') {
            ctx.police.addWanted(1);
            ctx.audio.hit();
          } else if (hit.target.kind === 'ped') {
            ctx.police.addWanted(1);
            ctx.peds.scare(hit.target.x, hit.target.z, 20);
          } else if (hit.target.kind === 'policeCar' || hit.target.kind === 'car') {
            hit.target.ref.health -= PISTOL_DAMAGE;
            if (hit.target.ref.health <= 0 && hit.target.kind === 'car') ctx.audio.crash();
          }
          // Firing a gun where the law can see it draws heat.
          if (wantedRaiseCooldown <= 0) {
            for (const u of ctx.police.units) {
              if (Math.hypot(u.x - ctx.player.x, u.z - ctx.player.z) < 55) {
                ctx.police.addWanted(1);
                wantedRaiseCooldown = 3;
                break;
              }
            }
          }
        }
        }
      }
      // Enemies: close in and shoot at the player.
      for (const e of [...enemies]) {
        const dx = ctx.player.x - e.x;
        const dz = ctx.player.z - e.z;
        const dist = Math.hypot(dx, dz);
        e.heading = Math.atan2(dx, dz);
        e.mesh.rotation.y = e.heading;
        if (dist > 9) {
          e.x += Math.sin(e.heading) * 3.4 * dt;
          e.z += Math.cos(e.heading) * 3.4 * dt;
          e.walkPhase += dt * 8;
          e.mesh.rotation.x = Math.sin(e.walkPhase) * 0.05;
        } else {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = random.range(1.1, 2.2);
            const from = { x: e.x, y: 1.4, z: e.z };
            const to = { x: ctx.player.x, y: 1.2, z: ctx.player.z };
            addTracer(from, to);
            ctx.audio.shoot();
            if (Math.random() < 0.45) {
              ctx.damagePlayer(9);
            }
          }
        }
        const pos = { x: e.x, z: e.z };
        ctx.city.collideCircle(pos, 0.5);
        e.x = pos.x;
        e.z = pos.z;
        e.mesh.position.set(e.x, 0, e.z);
      }
    },
  };
}
