// Pedestrians: they stroll the sidewalks, wait at corners, and run when shots ring out.
import * as THREE from '../vendor/three.module.min.js';
import { PEDS, STREET_EVENTS, WORLD } from './config.js';

const SHIRT_COLORS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0xd84ad0, 0x4ad8d0, 0xe8e4da, 0x8a8f96];

function createPedMesh(color) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
  const shirt = new THREE.MeshLambertMaterial({ color });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pants);
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.75;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), shirt);
  armL.position.set(-0.4, 1.15, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(legs, torso, head, armL, armR);
  g.traverse((m) => {
    m.castShadow = true;
  });
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export function createPeds(city, scene, random) {
  const peds = [];
  const HALF = WORLD.half;

  function randomSidewalkPoint() {
    // On a sidewalk: near a road line, offset 8-10 from its centre.
    const along = random.range(-HALF + 10, HALF - 10);
    const line = random.int(-5, 5) * WORLD.block;
    const off = random.pick([-1, 1]) * random.range(8, 10.5);
    if (random.next() < 0.5) return { x: along, z: line + off };
    return { x: line + off, z: along };
  }

  function spawn() {
    const p = randomSidewalkPoint();
    const mesh = createPedMesh(SHIRT_COLORS[random.int(0, SHIRT_COLORS.length - 1)]);
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    peds.push({
      mesh,
      x: p.x,
      z: p.z,
      heading: random.range(0, Math.PI * 2),
      speed: random.range(1.2, 2.2),
      target: null,
      flee: 0,
      wait: random.range(0, 4),
      walkPhase: random.range(0, Math.PI * 2),
      eventUntil: 0,
    });
  }

  for (let i = 0; i < PEDS.count; i += 1) spawn();

  // One walking step toward the target; returns false when the ped is idle.
  function walkStep(ped, dt) {
    if (ped.wait > 0) {
      ped.wait -= dt;
      return false;
    }
    if (!ped.target) ped.target = randomSidewalkPoint();
    if (ped.flee > 0) ped.flee -= dt;
    const dx = ped.target.x - ped.x;
    const dz = ped.target.z - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      if (ped.flee > 0) {
        ped.flee = 0;
        ped.target = null;
      } else {
        ped.target = null;
        ped.wait = random.range(1, 5);
      }
      return false;
    }
    const speed = ped.flee > 0 ? 5.5 : ped.speed;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
    ped.x = Math.max(-HALF, Math.min(HALF, ped.x));
    ped.z = Math.max(-HALF, Math.min(HALF, ped.z));
    const pos = { x: ped.x, z: ped.z };
    city.collideCircle(pos, 0.5);
    ped.x = pos.x;
    ped.z = pos.z;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // Walk-cycle arm swing.
    ped.walkPhase += dt * speed * 3.2;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.armL.rotation.x = swing;
    ped.mesh.userData.armR.rotation.x = -swing;
    return true;
  }

  return {
    peds,
    /** Stage one small street event just off-camera: a few pedestrians gather in a
     *  circle for a while (buskers, tourists, an argument), then drift back to walking.
     *  Returns the event's label for the radio/toast, or null when nothing staged. */
    startStreetEvent(px, pz) {
      const event = STREET_EVENTS[random.int(0, STREET_EVENTS.length - 1)];
      // A sidewalk point 35-70 units from the player, so it is near but off-camera.
      const a = random.range(0, Math.PI * 2);
      const r = random.range(35, 70);
      const cx = Math.max(-240, Math.min(240, px + Math.sin(a) * r));
      const cz = Math.max(-240, Math.min(240, pz + Math.cos(a) * r));
      // Gather the three nearest peds into a circle around the point.
      const sorted = [...peds].sort(
        (p, q) => (p.x - cx) ** 2 + (p.z - cz) ** 2 - ((q.x - cx) ** 2 + (q.z - cz) ** 2),
      );
      const group = sorted.slice(0, 3);
      if (group.length < 3) return null;
      group.forEach((ped, i) => {
        const ang = (i / 3) * Math.PI * 2;
        ped.target = { x: cx + Math.sin(ang) * 2.2, z: cz + Math.cos(ang) * 2.2 };
        ped.wait = 0;
        ped.flee = 0;
        ped.eventUntil = 14;
      });
      return event.label;
    },
    /** Scare every ped near a point (gunfire, a crash): they run away from it. */
    scare(x, z, radius) {
      for (const ped of peds) {
        const dx = ped.x - x;
        const dz = ped.z - z;
        if (dx * dx + dz * dz < radius * radius) {
          ped.flee = 4;
          ped.target = { x: ped.x + dx * 2, z: ped.z + dz * 2 };
        }
      }
    },
    nearest(x, z, maxDist) {
      let best = null;
      let bestD = maxDist * maxDist;
      for (const p of peds) {
        const dx = p.x - x;
        const dz = p.z - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    },
    update(dt, time) {
      for (const ped of peds) {
        if (ped.eventUntil > 0) {
          ped.eventUntil -= dt;
          // Stand in the circle and watch until the moment passes.
          if (!ped.target) ped.wait = Math.max(ped.wait, 0.6);
        }
        walkStep(ped, dt);
      }
    },
  };
}
