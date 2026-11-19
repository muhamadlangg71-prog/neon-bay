// Wanted level and the Neon Bay PD: police cars that chase and ram, foot cops that
// chase on foot, and a heat system that cools when the player stays out of sight.
import * as THREE from '../vendor/three.module.min.js';
import { WANTED } from './config.js';
import { createCarMesh } from './vehicles.js';

export function createPolice(city, scene, random) {
  const units = []; // {kind: 'car'|'cop', mesh, x, z, heading, speed, stuck, reverse}
  let wanted = 0;
  let hiddenTime = 0;
  let spawnCooldown = 0;
  let sirenOn = false;
  let heliAngle = 0;

  /** Tracker helicopter: circles the player once the heat hits 4 stars. */
  function createHeliMesh() {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x8a94b8 });
    const white = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3.4), navy);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 3.45), white);
    stripe.position.y = 0.2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.2), navy);
    tail.position.set(0, 0.2, -3);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.8), navy);
    fin.position.set(0, 0.7, -4.4);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x111318 }));
    rotor.position.y = 0.85;
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 2.6), new THREE.MeshLambertMaterial({ color: 0x111318 }));
    skidL.position.set(-0.9, -0.8, 0);
    const skidR = skidL.clone();
    skidR.position.x = 0.9;
    // Searchlight cone: apex at the heli, wide end on the street below.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.rotation.x = Math.PI;
    cone.position.y = -15;
    g.add(body, stripe, tail, fin, rotor, skidL, skidR, cone);
    g.traverse((m) => {
      m.castShadow = false;
    });
    g.visible = false;
    g.userData.rotor = rotor;
    scene.add(g);
    return g;
  }

  const heli = { mesh: createHeliMesh(), x: 0, z: 0 };

  function createCopMesh() {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), navy);
    legs.position.y = 0.4;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.75, 0.36), navy);
    torso.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
    head.position.y = 1.75;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x0d1526 }));
    cap.position.y = 1.97;
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    badge.position.set(0.15, 1.3, 0.19);
    g.add(legs, torso, head, cap, badge);
    g.traverse((m) => {
      m.castShadow = true;
    });
    return g;
  }

  function spawnCarNear(px, pz) {
    // A road point on a ring around the player.
    const nodeIdx = city.nearestNode(px, pz);
    const nodes = city.nodes;
    const options = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const d = Math.hypot(nodes[i].x - px, nodes[i].z - pz);
      if (d > 55 && d < 110) options.push(i);
    }
    const pick = options.length ? options[random.int(0, options.length - 1)] : nodeIdx;
    const node = nodes[pick];
    const mesh = createCarMesh(0x111318, { police: true });
    scene.add(mesh);
    const unit = {
      kind: 'car',
      mesh,
      x: node.x,
      z: node.z,
      heading: Math.atan2(px - node.x, pz - node.z),
      speed: 6,
      stuck: 0,
      reverse: 0,
    };
    mesh.position.set(unit.x, 0, unit.z);
    units.push(unit);
    return unit;
  }

  function spawnCopNear(px, pz) {
    const a = random.range(0, Math.PI * 2);
    const x = px + Math.sin(a) * random.range(30, 55);
    const z = pz + Math.cos(a) * random.range(30, 55);
    const mesh = createCopMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    units.push({ kind: 'cop', mesh, x, z, heading: a, speed: 0, stuck: 0, reverse: 0, walkPhase: 0 });
  }

  function removeUnit(unit) {
    scene.remove(unit.mesh);
    const i = units.indexOf(unit);
    if (i >= 0) units.splice(i, 1);
  }

  function nearestSeen(px, pz) {
    for (const u of units) {
      if (Math.hypot(u.x - px, u.z - pz) < WANTED.seenRadius) return true;
    }
    return false;
  }

  // One police car chasing the player: steer, accelerate, ram, flash the bar.
  function chaseCar(u, dt, player) {
    const px = player.x;
    const pz = player.z;
    const dx = px - u.x;
    const dz = pz - u.z;
    const dist = Math.hypot(dx, dz);
    const topSpeed = 26 + wanted * 2.4;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - u.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    if (u.reverse > 0) {
      // Backing out of a jam.
      u.reverse -= dt;
      u.speed = -6;
      u.heading -= 1.4 * dt;
    } else {
      const target = dist > 14 ? topSpeed : topSpeed * 0.75;
      u.speed += (target - u.speed) * Math.min(1, dt * 1.4);
      u.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
    }
    const before = { x: u.x, z: u.z };
    u.x += Math.sin(u.heading) * u.speed * dt;
    u.z += Math.cos(u.heading) * u.speed * dt;
    const pos = { x: u.x, z: u.z };
    city.collideCircle(pos, 1.7);
    u.x = pos.x;
    u.z = pos.z;
    const moved = Math.hypot(u.x - before.x, u.z - before.z);
    if (u.speed > 4 && moved < u.speed * dt * 0.25) {
      u.stuck += dt;
      if (u.stuck > 1.2) {
        u.reverse = 0.9;
        u.stuck = 0;
      }
    } else {
      u.stuck = Math.max(0, u.stuck - dt);
    }
    // Ram the player's car: slow it and damage it.
    if (player.inCar && dist < 3.6) {
      const car = player.car;
      const push = (3.6 - dist) * 0.5;
      car.x += (dx / (dist || 1)) * -push;
      car.z += (dz / (dist || 1)) * -push;
      car.speed *= 0.9;
      car.health -= 14 * dt * 4;
      u.speed *= 0.7;
    }
    // Flash the light bar.
    const lights = u.mesh.userData.policeLights;
    if (lights) {
      const phase = Math.floor(performance.now() / 180) % 2 === 0;
      lights.red.material.color.setHex(phase ? 0xff2020 : 0x551010);
      lights.blue.material.color.setHex(phase ? 0x101055 : 0x2040ff);
    }
    u.mesh.position.set(u.x, 0, u.z);
    u.mesh.rotation.y = u.heading;
    const spin = (u.speed / 0.38) * dt;
    for (const w of u.mesh.userData.wheels) w.rotation.x += spin;
  }

  // One foot cop: run at the player, and a cop close on foot ends the run.
  function chaseCop(u, dt, player, onBusted) {
    const dx = player.x - u.x;
    const dz = player.z - u.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - u.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    u.heading += Math.max(-4 * dt, Math.min(4 * dt, dh));
    if (dist > 1.6) {
      u.x += Math.sin(u.heading) * 6.4 * dt;
      u.z += Math.cos(u.heading) * 6.4 * dt;
    } else if (!player.inCar) {
      if (onBusted) onBusted();
    }
    const pos = { x: u.x, z: u.z };
    city.collideCircle(pos, 0.5);
    u.x = pos.x;
    u.z = pos.z;
    u.mesh.position.set(u.x, 0, u.z);
    u.mesh.rotation.y = u.heading;
    u.walkPhase += dt * 9;
    u.mesh.rotation.x = Math.sin(u.walkPhase) * 0.06;
  }

  return {
    get wanted() {
      return wanted;
    },
    set wanted(v) {
      wanted = Math.max(0, Math.min(5, Math.round(v)));
    },
    get units() {
      return units;
    },
    get sirenOn() {
      return sirenOn;
    },
    /** True while the tracker helicopter is up (wanted 4-5). */
    get heliActive() {
      return wanted >= 4;
    },
    /** Point the helicopter's orbit at a given angle (screenshot staging). */
    setHeliAngle(a) {
      heliAngle = a;
    },
    /** Ground position of the helicopter, for the minimap; null when grounded. */
    get heliPos() {
      return wanted >= 4 ? { x: heli.x, z: heli.z } : null;
    },
    /** True when the player has been out of sight for a while. */
    get isHidden() {
      return wanted > 0 && hiddenTime > 2;
    },
    addWanted(n) {
      wanted = Math.max(0, Math.min(5, wanted + n));
      hiddenTime = 0;
    },
    clearWanted() {
      wanted = 0;
      hiddenTime = 0;
      heli.mesh.visible = false;
      for (const u of [...units]) removeUnit(u);
    },
    reset() {
      wanted = 0;
      hiddenTime = 0;
      spawnCooldown = 0;
      heli.mesh.visible = false;
      for (const u of [...units]) removeUnit(u);
    },
    update(dt, player, onBusted) {
      const px = player.x;
      const pz = player.z;
      spawnCooldown -= dt;
      // No heat, no force: the PD stands down and the streets go quiet.
      if (wanted === 0) {
        for (const u of [...units]) removeUnit(u);
      }
      // Keep the force at the wanted level's strength.
      const wantCars = WANTED.cars[wanted] || 0;
      const wantCops = WANTED.cops[wanted] || 0;
      const haveCars = units.filter((u) => u.kind === 'car').length;
      const haveCops = units.filter((u) => u.kind === 'cop').length;
      if (spawnCooldown <= 0) {
        if (haveCars < wantCars) spawnCarNear(px, pz);
        else if (haveCops < wantCops) spawnCopNear(px, pz);
        spawnCooldown = 1.2;
      }
      // Despawn units that fell far behind.
      for (const u of [...units]) {
        if (Math.hypot(u.x - px, u.z - pz) > 320) removeUnit(u);
      }
      sirenOn = units.length > 0;

      // Tracker helicopter: circles high above the player at 4-5 stars, and its
      // spotlight makes the heat cool down much slower while it is up.
      const heliActive = wanted >= 4;
      heli.mesh.visible = heliActive;
      if (heliActive) {
        heliAngle += dt * 0.3;
        heli.x = px + Math.cos(heliAngle) * 42;
        heli.z = pz + Math.sin(heliAngle) * 42;
        heli.mesh.position.set(heli.x, 24, heli.z);
        heli.mesh.rotation.y = Math.atan2(px - heli.x, pz - heli.z);
        heli.mesh.userData.rotor.rotation.y += dt * 22;
      }

      // Heat decay: hidden from every unit for a while drops one star.
      if (wanted > 0) {
        if (!nearestSeen(px, pz)) {
          hiddenTime += dt * (heliActive ? 0.35 : 1);
          if (hiddenTime > WANTED.decaySeconds[wanted]) {
            wanted -= 1;
            hiddenTime = 0;
          }
        } else {
          hiddenTime = 0;
        }
      }

      // Chase behaviour.
      for (const u of [...units]) {
        if (u.kind === 'car') chaseCar(u, dt, player);
        else chaseCop(u, dt, player, onBusted);
      }
      // Police cars keep their distance from each other.
      for (let i = 0; i < units.length; i += 1) {
        for (let j = i + 1; j < units.length; j += 1) {
          const a = units[i];
          const b = units[j];
          if (a.kind !== 'car' || b.kind !== 'car') continue;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const d = Math.hypot(dx, dz);
          if (d < 7 && d > 0.01) {
            const push = (7 - d) / 2;
            const nx = dx / d;
            const nz = dz / d;
            a.x -= nx * push;
            a.z -= nz * push;
            b.x += nx * push;
            b.z += nz * push;
          }
        }
      }
    },
  };
}
