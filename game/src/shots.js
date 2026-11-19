// Screenshot scenes behind ?shot=chase|walk|mission|vista. Each one stages a real
// game state (a mission, a wanted level, a car, a crew) and lets the world settle for
// a fixed number of steps, so the frame is what the game really looks like and the
// same seed always gives the same frame.
import { PLAYER } from './config.js';

function putPlayerInCar(g, car, x, z, heading, speed) {
  const { player, playerMesh, traffic } = g;
  traffic.detach(car);
  car.parked = false;
  car.health = 9999; // Staged cars do not get wrecked mid-shot.
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  player.car = car;
  player.inCar = true;
  player.x = x;
  player.z = z;
  player.heading = heading;
  player.camYaw = heading;
  playerMesh.visible = false;
}

function putPlayerOnFoot(g, x, z, heading) {
  const { player, playerMesh } = g;
  player.inCar = false;
  player.car = null;
  player.x = x;
  player.z = z;
  player.heading = heading;
  player.camYaw = heading;
  player.camPitch = 0.3;
  playerMesh.visible = true;
  playerMesh.position.set(x, 0, z);
  playerMesh.rotation.y = heading;
}

// Common reset before any scene: a clean, healthy, lightly-funded Jax.
function resetStage(g) {
  const { player, police, missions, combat } = g;
  police.reset();
  combat.clearEnemies();
  missions.reset();
  player.health = PLAYER.maxHealth;
  player.money = 1250;
  player.inCar = false;
  player.car = null;
  player.speed = 0;
}

/**
 * Stage the named scene and return { shot, settleSteps, note }.
 * Any other name stages the walk scene.
 */
export function stageShot(name, g) {
  const { player, police, missions, traffic } = g;
  resetStage(g);

  if (name === 'chase') {
    // Mission 6, Last Exit: five stars, your stolen Comet ahead on the marina
    // road, the seaplane waiting and the whole PD on your tail.
    missions.startAt(5);
    const car = traffic.spawnParked({ x: 156, z: 78, heading: Math.PI, color: 0xff7a1a, sport: true });
    putPlayerInCar(g, car, 156, 78, Math.PI, 30);
    police.wanted = 5;
    // The heli drifts 1.2 rad during the 240-step settle; start it behind so it
    // ends up dead ahead of the camera when the frame is taken.
    police.setHeliAngle(-Math.PI / 2 - 1.2);
    g.hud.setObjective('Reclaim your Comet at the marina');
    return { shot: 'chase', settleSteps: 240, note: 'Police chase at the marina, wanted 5, helicopter overhead, minimap + mission objective on the HUD.' };
  }

  if (name === 'mission') {
    // Mission 4, Wrecking Ball: the demolition crew at the street in front of
    // Nia's workshop, beacon lit. The player stands ON the road (z=-52) facing
    // west at the crew, so the camera stays on open road too — staging the
    // player inside a block put the camera inside a building.
    missions.startAt(3);
    putPlayerOnFoot(g, -66, -52, -Math.PI / 2);
    police.wanted = 1;
    g.hud.setObjective('Stop the demolition crew — defend Nia\u2019s workshop');
    return { shot: 'mission', settleSteps: 150, note: 'On foot at Nia\u2019s workshop in Old Port, the demolition crew closing in, objective beacon.' };
  }

  if (name === 'vista') {
    // Golden hour on the beach road, heading north: palms framing the road,
    // the ocean on the right, the skyline on the left.
    const car = traffic.spawnParked({ x: 212, z: 104, heading: Math.PI, color: 0x2c6bb8, sport: true });
    putPlayerInCar(g, car, 212, 104, Math.PI, 16);
    g.hud.setObjective('Free roam — explore Neon Bay.');
    return { shot: 'vista', settleSteps: 240, note: 'Sunset vista up the Palm Strip beach road: palms, ocean, skyline.' };
  }

  // Walk (default): on foot on the Palm Strip boardwalk, traffic on the beach
  // road, palms and the ocean — mission 1 live.
  missions.startAt(0);
  putPlayerOnFoot(g, 216, 40, 0);
  g.hud.setObjective('Take back your Comet from the impound');
  return { shot: 'walk', settleSteps: 240, note: 'On foot on the Palm Strip boardwalk, traffic on the beach road, palms and ocean.' };
}
