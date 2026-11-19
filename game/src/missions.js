// The story: six missions in a chain, each with an objective marker in the world, on
// the minimap and in the HUD. Completing one pays out and starts the next.
import * as THREE from '../vendor/three.module.min.js';
import { CAR_OWNERS, MISSIONS } from './config.js';

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
  let cometCar = null;
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
    if (m.kind === 'driveTo') setTarget(m.at.x, m.at.z);
    else if (m.kind === 'pickup') setTarget(m.at.x, m.at.z);
    else if (m.kind === 'stealDeliver') {
      // The Comet GT waits by the beach road — the mayor's convertible, dashcam and all.
      cometCar = traffic.spawnParked({ x: m.at.x, z: m.at.z, heading: Math.PI / 2, color: 0xff7a1a, sport: true, owner: CAR_OWNERS[7] });
      setTarget(m.at.x, m.at.z);
    } else if (m.kind === 'combat') setTarget(m.at.x, m.at.z);
    else if (m.kind === 'escape') {
      hooks.setWanted(3);
      setTarget(m.at.x, m.at.z);
    } else if (m.kind === 'robbery') setTarget(m.at.x, m.at.z);
  }

  function completeMission(player) {
    const m = current();
    player.money += m.reward;
    audio.cash();
    hooks.onMissionComplete(m, m.reward);
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
      if (cometCar) {
        traffic.remove(cometCar);
        cometCar = null;
      }
    },
    update(dt, time, player, ctx) {
      beacon.update(dt, time);
      if (startDelay > 0) {
        startDelay -= dt;
        if (startDelay <= 0) startMission(index);
        return;
      }
      const m = current();
      if (!m) return;
      const px = player.x;
      const pz = player.z;
      const near = (t, r) => Math.hypot(px - t.x, pz - t.z) < r;
      phaseTimer += dt;

      if (m.kind === 'driveTo') {
        if (player.inCar && near(m.at, 9)) completeMission(player);
      } else if (m.kind === 'pickup') {
        if (phase === 0) {
          if (player.inCar && near(m.at, 9)) {
            phase = 1;
            hooks.onToast('Maya hops in. "Docks. Step on it."');
            audio.pickup();
            setTarget(m.at2.x, m.at2.z);
          }
        } else if (player.inCar && near(m.at2, 9)) {
          completeMission(player);
        }
      } else if (m.kind === 'stealDeliver') {
        if (phase === 0) {
          if (player.inCar && player.car === cometCar) {
            phase = 1;
            hooks.setWanted(2);
            hooks.onToast('The Comet GT is yours — and its dashcam proves the setup. Lose the cops, get it to Ray\'s garage.');
            setTarget(m.at2.x, m.at2.z);
          }
        } else if (player.inCar && player.car === cometCar && near(m.at2, 9)) {
          completeMission(player);
        }
      } else if (m.kind === 'combat') {
        if (phase === 0) {
          if (!player.inCar && near(m.at, 34)) {
            phase = 1;
            hooks.onToast('Ambush! Take down the Harbormaster\'s crew.');
            ctx.spawnCrew(m.at.x, m.at.z);
            crewSpawned = true;
          }
        } else if (phase === 1) {
          if (ctx.crewAlive() === 0 && crewSpawned) {
            phase = 2;
            hooks.onToast('Crew down. Grab the package.');
            setTarget(m.at.x, m.at.z);
          }
        } else if (!player.inCar && near(m.at, 4)) {
          completeMission(player);
        }
      } else if (m.kind === 'escape') {
        if (near(m.at, 30)) {
          // On the island the heat dies faster: the PD cannot follow forever.
          phaseTimer += dt * 2;
          if (phaseTimer > 14) {
            hooks.setWanted(0);
            completeMission(player);
          }
        }
      } else if (m.kind === 'robbery') {
        if (phase === 0) {
          if (!player.inCar && near(m.at, 7)) {
            holdTimer += dt;
            hooks.onHold(holdTimer / 5);
            if (holdTimer >= 5) {
              phase = 1;
              hooks.setWanted(4);
              hooks.onToast('Cash grabbed! Get back to the safehouse — now!');
              audio.cash();
              setTarget(m.at2.x, m.at2.z);
            }
          } else {
            holdTimer = Math.max(0, holdTimer - dt * 2);
            hooks.onHold(holdTimer / 5);
          }
        } else if (near(m.at2, 9)) {
          completeMission(player);
        }
      }
    },
  };
}
