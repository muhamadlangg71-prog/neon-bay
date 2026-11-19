// Cars: meshes, player driving physics, and traffic AI that follows the road graph.
import * as THREE from '../vendor/three.module.min.js';
import { CAR, CAR_OWNERS, TRAFFIC, WORLD } from './config.js';

const CAR_COLORS = [0xb8332c, 0x2c6bb8, 0xd8a13c, 0x3a9a4a, 0x8a8f96, 0x1d2733, 0x7a4a9a, 0xc8c8c8, 0x4a6a7a, 0xe8e4da];
const HALF_BOUND = WORLD.half + 2;
// Shared geometry: every car on the street is built from the same four shapes.
const BODY_GEO = new THREE.BoxGeometry(2.0, 0.55, 4.4);
const CABIN_GEO = new THREE.BoxGeometry(1.7, 0.5, 2.2);
const WHEEL_GEO = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
const LIGHT_GEO = new THREE.BoxGeometry(0.35, 0.18, 0.08);
const BAR_GEO = new THREE.BoxGeometry(1.2, 0.22, 0.5);

/** Build a low-poly car mesh. `opts.police` adds a light bar; `opts.sport` lowers the cabin. */
export function createCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2430 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const body = new THREE.Mesh(BODY_GEO, paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(CABIN_GEO, glass);
  cabin.position.set(0, 1.1, opts.sport ? -0.35 : -0.2);
  cabin.scale.y = opts.sport ? 0.8 : 1;
  cabin.castShadow = true;
  g.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xc02020 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(LIGHT_GEO, headMat);
    h.position.set(hx, 0.62, 2.21);
    g.add(h);
    const t = new THREE.Mesh(LIGHT_GEO, tailMat);
    t.position.set(hx, 0.62, -2.21);
    g.add(t);
  }
  if (opts.police) {
    const barBase = new THREE.Mesh(BAR_GEO, new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barBase.position.set(0, 1.42, -0.2);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.45), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.32, 1.45, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.45), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.32, 1.45, -0.2);
    g.add(barBase, red, blue);
    g.userData.policeLights = { red, blue };
  }
  g.userData.wheels = wheels;
  return g;
}

function spinWheels(mesh, speed, dt) {
  const spin = (speed / 0.38) * dt;
  for (const w of mesh.userData.wheels) w.rotation.x += spin;
}

function edgeLength(nodes, a, b) {
  return Math.hypot(nodes[b].x - nodes[a].x, nodes[b].z - nodes[a].z);
}

export function createTraffic(city, scene, random) {
  const cars = [];
  const nodes = city.nodes;

  function randomEdge() {
    const a = random.int(0, nodes.length - 1);
    const edges = nodes[a].edges;
    return { a, b: edges[random.int(0, edges.length - 1)] };
  }

  function spawnCar(parked, spec) {
    const color = spec?.color ?? CAR_COLORS[random.int(0, CAR_COLORS.length - 1)];
    const mesh = createCarMesh(color, spec);
    scene.add(mesh);
    const car = {
      mesh,
      color,
      parked: !!parked,
      speed: 0,
      maxSpeed: random.range(TRAFFIC.speedMin, TRAFFIC.speedMax),
      heading: 0,
      x: 0,
      z: 0,
      health: CAR.maxHealth,
      edgeA: 0,
      edgeB: 0,
      t: 0,
      dir: 1,
      ox: 0, // collision nudge offset, decays back to the lane
      oz: 0,
      // Keys are identities: every car belongs to someone.
      owner: spec?.owner ?? CAR_OWNERS[random.int(0, CAR_OWNERS.length - 1)],
    };
    if (parked) {
      car.x = spec.x;
      car.z = spec.z;
      car.heading = spec.heading ?? random.range(0, Math.PI * 2);
    } else {
      const e = randomEdge();
      car.edgeA = e.a;
      car.edgeB = e.b;
      car.t = random.next();
      car.dir = random.next() < 0.5 ? 1 : -1;
      car.speed = car.maxSpeed;
    }
    cars.push(car);
    return car;
  }

  for (let i = 0; i < TRAFFIC.count; i += 1) spawnCar(false);

  function placeCar(car) {
    const a = nodes[car.edgeA];
    const b = nodes[car.edgeB];
    const len = edgeLength(nodes, car.edgeA, car.edgeB);
    const t = car.dir > 0 ? car.t : 1 - car.t;
    const px = a.x + (b.x - a.x) * t;
    const pz = a.z + (b.z - a.z) * t;
    const dx = (b.x - a.x) / len;
    const dz = (b.z - a.z) / len;
    // Right-hand lane: offset to the right of the travel direction.
    const side = car.dir > 0 ? 1 : -1;
    const ox = -dz * WORLD.laneOffset * side;
    const oz = dx * WORLD.laneOffset * side;
    car.x = px + ox + car.ox;
    car.z = pz + oz + car.oz;
    car.heading = car.dir > 0 ? Math.atan2(b.x - a.x, b.z - a.z) : Math.atan2(a.x - b.x, a.z - b.z);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    spinWheels(car.mesh, car.speed, 0.016);
  }

  // How fast may this car go, given the car ahead of it (if any)?
  function speedFor(car, other, target) {
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist >= 11 || dist <= 0.01) return target;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const ahead = (dx * fx + dz * fz) / dist;
    if (ahead <= 0.55) return target;
    return Math.min(target, Math.max(0, (dist - 6) * 0.9));
  }

  return {
    cars,
    spawnParked(spec) {
      return spawnCar(true, spec);
    },
    remove(car) {
      this.detach(car);
      scene.remove(car.mesh);
    },
    /** Take a car out of traffic but leave its mesh in the scene (stealing). */
    detach(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    },
    /** Put a car back into the world as a parked car (exiting it). */
    park(car) {
      car.parked = true;
      car.speed = 0;
      if (!cars.includes(car)) cars.push(car);
    },
    /** Nearest car to a point, within maxDist (parked cars count too). */
    nearest(x, z, maxDist) {
      let best = null;
      let bestD = maxDist * maxDist;
      for (const c of cars) {
        const dx = c.x - x;
        const dz = c.z - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    },
    update(dt, playerCar, onCrash) {
      for (const car of cars) {
        if (car.parked) {
          car.mesh.position.set(car.x, 0, car.z);
          car.mesh.rotation.y = car.heading;
          continue;
        }
        // Slow down for a car ahead (traffic or the player's car).
        let target = car.maxSpeed;
        for (const other of cars) {
          if (other !== car) target = speedFor(car, other, target);
        }
        if (playerCar) target = speedFor(car, playerCar, target);
        car.speed += (target - car.speed) * Math.min(1, dt * 2.5);
        const len = edgeLength(nodes, car.edgeA, car.edgeB);
        car.t += (car.speed * dt) / len;
        if (car.t >= 1) {
          // Arrived at the far node: pick a new edge (no U-turn unless forced).
          const node = car.dir > 0 ? car.edgeB : car.edgeA;
          const from = car.dir > 0 ? car.edgeA : car.edgeB;
          const options = nodes[node].edges.filter((e) => e !== from);
          const next = options.length ? options[random.int(0, options.length - 1)] : from;
          car.edgeA = node;
          car.edgeB = next;
          car.t = 0;
          car.dir = 1;
        }
        // Decay the collision nudge.
        car.ox *= Math.max(0, 1 - dt * 3);
        car.oz *= Math.max(0, 1 - dt * 3);
        placeCar(car);
      }
      // Traffic vs player car: push apart, damage on a hard hit.
      if (playerCar) {
        for (const car of cars) {
          const dx = playerCar.x - car.x;
          const dz = playerCar.z - car.z;
          const dist = Math.hypot(dx, dz);
          const min = 3.4;
          if (dist < min && dist > 0.001) {
            const push = (min - dist) / 2;
            const nx = dx / dist;
            const nz = dz / dist;
            playerCar.x += nx * push;
            playerCar.z += nz * push;
            car.ox -= nx * push * 0.6;
            car.oz -= nz * push * 0.6;
            const impact = Math.abs(playerCar.speed - car.speed);
            if (impact > 8 && onCrash) onCrash(impact);
            playerCar.speed *= 0.86;
            car.speed *= 0.9;
          }
        }
      }
    },
  };
}

/** Arcade driving for the player's car. Returns nothing; mutates `car`. */
export function drivePlayerCar(car, input, dt, city) {
  const fwd = input.y; // W = +1, S = -1
  const steer = input.x; // D = +1
  const handbrake = input.handbrake;
  if (fwd > 0) car.speed += CAR.accel * dt;
  else if (fwd < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  }
  car.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, car.speed));
  // Steering weakens at standstill, sharpens with the handbrake.
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 8) * (handbrake ? 1.6 : 1);
  car.heading += steer * CAR.turnRate * steerAuthority * dt * Math.sign(car.speed || 1);
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  // Stay inside the world; the bridge and island are reachable, the sea is not.
  car.x = Math.max(-HALF_BOUND, Math.min(HALF_BOUND, car.x));
  car.z = Math.max(-440, Math.min(258, car.z));
  const pos = { x: car.x, z: car.z };
  city.collideCircle(pos, 1.7);
  car.x = pos.x;
  car.z = pos.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Body roll and wheel spin sell the speed.
  car.mesh.rotation.z = -steer * Math.min(0.06, Math.abs(car.speed) * 0.0016);
  spinWheels(car.mesh, car.speed, dt);
}
