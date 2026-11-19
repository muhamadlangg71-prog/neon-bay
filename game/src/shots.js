// Screenshot scenes behind ?shot=chase|walk|mission|vista. Each one stages a real
// game state (a mission, a wanted level, a car, a crew) and lets the world settle for
// a fixed number of steps, so the frame is what the game really looks like and the
// same seed always gives the same frame.
import { PLAYER } from './config.js';

function putPlayerInCar(g, car, x, z, heading, speed) {
  const { player, playerMesh, traffic } = g;
  traffic.detach(car);
  car.parked = false;
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

/**
 * Stage the named scene and return { shot, settleSteps, note }.
 * Any other name stages the walk scene.
 */
export function stageShot(name, g) {
  const { player, police, missions, combat, traffic } = g;
  police.reset();
  combat.clearEnemies();
  missions.reset();
  player.health = PLAYER.maxHealth;
  player.money = 1250;
  player.inCar = false;
  player.car = null;
  player.speed = 0;

  if (name === 'chase') {
    // Mission 5, The Getaway: three stars, the PD on your tail, the bridge ahead.
    missions.startAt(4);
    const car = traffic.spawnParked({ x: 0, z: 120, heading: Math.PI, color: 0xb8332c, sport: true });
    putPlayerInCar(g, car, 0, 120, Math.PI, 30);
    police.wanted = 3;
    g.hud.setObjective('Reach Cayo Verde and lose the cops');
    return { shot: 'chase', settleSteps: 240, note: 'Police chase on the bridge road, wanted 3, minimap + mission objective on the HUD.' };
  }

  if (name === 'mission') {
    // Mission 4, Dockside Deal: the ambush at the Docks, crew closing in, beacon lit.
    missions.startAt(3);
    putPlayerOnFoot(g, 40, 220, 0.7);
    police.wanted = 1;
    g.hud.setObjective('Clear the ambush and take the package');
    return { shot: 'mission', settleSteps: 150, note: 'On foot at the Docks, the crew ambush, objective beacon and containers.' };
  }

  if (name === 'vista') {
    // Golden hour on the beach road: the car, the palms, the skyline and the sunset.
    const car = traffic.spawnParked({ x: 212, z: 0, heading: -Math.PI / 2, color: 0x2c6bb8, sport: true });
    putPlayerInCar(g, car, 212, 0, -Math.PI / 2, 16);
    g.hud.setObjective('Free roam — explore Neon Bay.');
    return { shot: 'vista', settleSteps: 90, note: 'Sunset vista down the beach road: palms, skyline, billboard and ocean.' };
  }

  // Walk (default): on foot downtown, traffic and pedestrians around, mission 1 live.
  missions.startAt(0);
  putPlayerOnFoot(g, 10, 60, Math.PI);
  g.hud.setObjective('Steal a car and drive to the marker');
  return { shot: 'walk', settleSteps: 90, note: 'On foot in Downtown, traffic passing, pedestrians on the sidewalk.' };
}
