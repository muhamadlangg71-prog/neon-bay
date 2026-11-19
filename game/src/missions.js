// The story: six missions in a chain, each with an objective marker in the world, on
// the minimap and in the HUD. Completing one pays out and starts the next.
import * as THREE from '../vendor/three.module.min.js';
import { CAR_OWNERS, JAX_CAR, MISSIONS, VANE_SUV } from './config.js';

function createBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd23c }),
  );
  diamond.position.y = 8;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3, 4.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(beam, diamond, ring);
  group.visible = false;
  scene.add(group);
  return {
    group,
    diamond,
    set(x, z) {
      group.position.set(x, 0, z);
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    update(dt, time) {
      if (!group.visible) return;
      diamond.rotation.y = time * 2;
      diamond.position.y = 8 + Math.sin(time * 2.5) * 0.8;
    },
  };
}

export function createMissions(city, scene, traffic, audio, hooks) {
  const beacon = createBeacon(scene);
  let index = -1; // -1 = no active mission (free roam / story done)
  let phase = 0;
  let phaseTimer = 0;
  let holdTimer = 0;
  let target = null;
  let storyCar = null;
  let crewSpawned = false;
  let done = false;
  let startDelay = 0;

  function current() {
    return index >= 0 && index < MISSIONS.length ? MISSIONS[index] : null;
  }

  function setTarget(x, z) {
    target = { x, z };
    beacon.set(x, z);
    hooks.onObjective(current() ? current().objective : '');
  }

  function startMission(i) {
    index = i;
    phase = 0;
    holdTimer = 0;
    crewSpawned = false;
    const m = current();
    hooks.onMissionStart(m);
    audio.mission();
    if (m.kind === 'stealDeliver') {
      // The story car waits at the marker — Jax's Comet or Vane's armoured SUV.
      const owner = m.spawnOwner === 'vane' ? VANE_SUV : m.spawnOwner === 'jax' ? JAX_CAR : CAR_OWNERS[7];
      storyCar = traffic.spawnParked({ x: m.at.x, z: m.at.z, heading: Math.PI / 2, color: m.spawnColor ?? 0xff7a1a, sport: m.spawnSport ?? true, owner });
      setTarget(m.at.x, m.at.z);
    } else if (m.kind === 'escort') {
      // Dead Air: the broadcast van needs three relay zones, and the PD knows it.
      hooks.setWanted(4);
      setTarget(m.at.x, m.at.z);
    } else if (m.kind === 'escape') {
      hooks.setWanted(3);
      setTarget(m.at.x, m.at.z);
    } else {
      // driveTo, pickup, combat, robbery: the first point is the marker.
      setTarget(m.at.x, m.at.z);
    }
  }

  function completeMission(player) {
    const m = current();
    player.money += m.reward;
    player.rep = (player.rep || 0) + (m.rep || 0);
    audio.cash();
    hooks.onMissionComplete(m, m.reward, m.rep || 0);
    beacon.hide();
    target = null;
    index += 1;
    phase = 0;
    if (index >= MISSIONS.length) {
      done = true;
      index = -1;
      hooks.onStoryComplete();
    } else {
      startDelay = 2.5;
    }
  }

  // One rule per mission kind; each returns nothing and completes when its goal is met.
  const rules = {
    driveTo(m, player) {
      if (player.inCar && near(player, m.at, 9)) completeMission(player);
    },
    pickup(m, player) {
      if (phase === 0) {
        if (player.inCar && near(player, m.at, 9)) {
          phase = 1;
          hooks.onToast(m.pickupToast || 'They hop in. "Go. Now."');
          audio.pickup();
          setTarget(m.at2.x, m.at2.z);
        }
      } else if (player.inCar && near(player, m.at2, 9)) {
        completeMission(player);
      }
    },
    stealDeliver(m, player) {
      if (phase === 0) {
        if (player.inCar && player.car === storyCar) {
          phase = 1;
          hooks.setWanted(m.wantedOnSteal ?? 2);
          hooks.onToast(m.stealToast || 'Got it. Now get it where it needs to go.');
          setTarget(m.at2.x, m.at2.z);
        }
      } else if (player.inCar && player.car === storyCar && near(player, m.at2, 9)) {
        completeMission(player);
      }
    },
    combat(m, player, ctx) {
      if (phase === 0) {
        if (!player.inCar && near(player, m.at, 34)) {
          phase = 1;
          hooks.onToast(m.ambushToast || 'Ambush! Take them down.');
          ctx.spawnCrew(m.at.x, m.at.z);
          crewSpawned = true;
        }
      } else if (phase === 1) {
        if (ctx.crewAlive() === 0 && crewSpawned) {
          phase = 2;
          hooks.onToast(m.grabToast || 'Crew down. Grab it.');
          setTarget(m.at.x, m.at.z);
        }
      } else if (!player.inCar && near(player, m.at, 4)) {
        completeMission(player);
      }
    },
    escort(m, player) {
      // Three relay zones in order; the van only uploads while the player is
      // in a car at the relay. Phase counts the relays already hit.
      const zones = [m.at, m.at2, m.at3];
      const zone = zones[phase];
      if (zone && player.inCar && near(player, zone, 9)) {
        phase += 1;
        if (phase >= zones.length) {
          hooks.onToast('Relay 3 of 3 — Tideglass is live. The whole city just saw it.');
          completeMission(player);
        } else {
          const next = zones[phase];
          hooks.onToast(`Relay ${phase} of 3 up — Tideglass is uploading. Next relay, go!`);
          hooks.onObjective(`Escort the broadcast van — relay ${phase + 1} of 3`);
          setTarget(next.x, next.z);
        }
      }
    },
    escape(m, player) {
      if (near(player, m.at, 30)) {
        // On the island the heat dies faster: the PD cannot follow forever.
        phaseTimer += dtOf(m) * 2;
        if (phaseTimer > 14) {
          hooks.setWanted(0);
          completeMission(player);
        }
      }
    },
    robbery(m, player) {
      if (phase === 0) {
        if (!player.inCar && near(player, m.at, 7)) {
          holdTimer += dtOf(m);
          hooks.onHold(holdTimer / 5);
          if (holdTimer >= 5) {
            phase = 1;
            hooks.setWanted(4);
            hooks.onToast('Cash grabbed! Get back to the safehouse — now!');
            audio.cash();
            setTarget(m.at2.x, m.at2.z);
          }
        } else {
          holdTimer = Math.max(0, holdTimer - dtOf(m) * 2);
          hooks.onHold(holdTimer / 5);
        }
      } else if (near(player, m.at2, 9)) {
        completeMission(player);
      }
    },
  };

  // The rules read the step length through this holder (set in update).
  let stepDt = 0;
  function dtOf() {
    return stepDt;
  }
  function near(player, point, radius) {
    return Math.hypot(player.x - point.x, player.z - point.z) < radius;
  }

  return {
    get index() {
      return index;
    },
    get done() {
      return done;
    },
    get target() {
      return target;
    },
    get phase() {
      return phase;
    },
    get holdProgress() {
      return holdTimer;
    },
    current,
    startStory() {
      index = -1;
      done = false;
      startMission(0);
    },
    /** Begin the story at a later mission (used when loading a save). */
    startAt(i) {
      this.reset();
      index = -1;
      done = false;
      startMission(Math.max(0, Math.min(MISSIONS.length - 1, i)));
    },
    reset() {
      index = -1;
      phase = 0;
      done = false;
      target = null;
      beacon.hide();
      if (storyCar) {
        traffic.remove(storyCar);
        storyCar = null;
      }
    },
    update(dt, time, player, ctx) {
      stepDt = dt;
      beacon.update(dt, time);
      if (startDelay > 0) {
        startDelay -= dt;
        if (startDelay <= 0) startMission(index);
        return;
      }
      const m = current();
      if (!m) return;
      phaseTimer += dt;
      const rule = rules[m.kind];
      if (rule) rule(m, player, ctx);
    },
  };
}
