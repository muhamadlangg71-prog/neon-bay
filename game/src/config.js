// Neon Bay — tuning, districts, missions. All names, places and people are original.
export const WORLD = {
  /** Half-size of the drivable city square, in metres. */
  half: 260,
  /** Distance between neighbouring intersections. */
  block: 52,
  /** Road width (asphalt). */
  roadWidth: 12,
  /** Lane offset from a road's centre line. */
  laneOffset: 2.6,
  /** Golden-hour sun direction (normalised in city.js). */
  sunDir: { x: -0.55, y: 0.62, z: 0.35 },
};

export const DISTRICTS = [
  { name: 'Downtown', x0: -130, z0: -130, x1: 130, z1: 130, tall: true },
  { name: 'Palmera Beach', x0: 130, z0: -130, x1: 260, z1: 130, tall: false },
  { name: 'The Docks', x0: -260, z0: 130, x1: 260, z1: 260, tall: false },
  { name: 'Cayo Verde', x0: -90, z0: -420, x1: 90, z1: -290, tall: false },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'Neon Bay';
}

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  radius: 0.6,
  maxHealth: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  maxSpeed: 38,
  reverseSpeed: 12,
  turnRate: 1.9,
  grip: 6,
  maxHealth: 100,
};

export const TRAFFIC = {
  count: 14,
  speedMin: 8,
  speedMax: 13,
};

export const PEDS = { count: 26 };

export const WANTED = {
  /** Police cars chasing, by wanted level (index = stars). */
  cars: [0, 1, 2, 3, 4, 5],
  /** Foot police chasing, by wanted level. */
  cops: [0, 0, 1, 2, 3, 4],
  /** Seconds hidden before one star drops. */
  decaySeconds: [0, 8, 10, 12, 15, 18],
  /** How close a police unit must be to keep the player "seen". */
  seenRadius: 70,
};

/** Mission chain. `at` is the objective point; `kind` drives the rules in missions.js. */
export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    brief: 'Jax needs a car. Steal any car off the street (walk up and press E), then drive to the yellow marker.',
    objective: 'Steal a car and drive to the marker',
    at: { x: 104, z: -52 },
    kind: 'driveTo',
    reward: 150,
  },
  {
    id: 2,
    title: 'The Pickup',
    brief: 'Maya is waiting at the Palmera corner. Pick her up, then take her to the Docks — and keep the car in one piece.',
    objective: 'Pick up Maya, then drive to the Docks',
    at: { x: -52, z: 104 },
    at2: { x: 0, z: 234 },
    kind: 'pickup',
    reward: 250,
  },
  {
    id: 3,
    title: 'Valet of the Year',
    brief: 'Pose as the Marina Hotel valet and lift three cars, each fob opening a more exclusive garage. The mayor\'s sunrise-orange Comet GT is the prize — its dashcam proves your client framed a rival. Deliver it to Ray\'s garage, and decide what the footage is worth.',
    objective: 'Steal the Comet GT — its dashcam proves the setup',
    at: { x: 182, z: 52 },
    at2: { x: -78, z: -78 },
    kind: 'stealDeliver',
    reward: 500,
  },
  {
    id: 4,
    title: 'Dockside Deal',
    brief: 'The deal at the Docks went bad. The Harbormaster\'s crew is waiting with guns. Take them down on foot and grab the package.',
    objective: 'Clear the ambush and take the package',
    at: { x: 52, z: 234 },
    kind: 'combat',
    reward: 600,
  },
  {
    id: 5,
    title: 'The Getaway',
    brief: 'Three stars and the whole Neon Bay PD on your tail. Cross the bridge to Cayo Verde and stay out of sight until the heat dies.',
    objective: 'Reach Cayo Verde and lose the cops',
    at: { x: 0, z: -350 },
    kind: 'escape',
    reward: 400,
  },
  {
    id: 6,
    title: 'The Big Score',
    brief: 'The Marina Bank keeps its cash in the back room. Walk in, grab it, and get back to the safehouse — the city will be looking for you.',
    objective: 'Rob the Marina Bank, then reach the safehouse',
    at: { x: 130, z: 130 },
    at2: { x: 78, z: 78 },
    kind: 'robbery',
    reward: 2500,
  },
];

export const SAVE_KEY = 'neon-bay-save-v1';
export const BEST_KEY = 'neon-bay-best-v1';
export const STEP = 1 / 60;

/** "Keys are identities": every car on the street belongs to someone, and the fob
 *  carries their life with it. Stealing the right car is infiltration, not speed. */
export const CAR_OWNERS = [
  { owner: 'Dr. Hale', car: 'Sedan', perk: 'Hospital parking pass' },
  { owner: 'Marina boss Voss', car: 'SUV', perk: 'Marina gate fob' },
  { owner: 'Chef Amara', car: 'Hatchback', perk: 'Docks canteen tab' },
  { owner: 'DJ Neon', car: 'Coupe', perk: 'Club backstage pass' },
  { owner: 'Banker Oka', car: 'Sedan', perk: 'Toll account, fully loaded' },
  { owner: 'Fisherman Bo', car: 'Pickup', perk: 'Harbour master key' },
  { owner: 'Professor Lin', car: 'Hatchback', perk: 'University garage card' },
  { owner: 'Mayor Delgado', car: 'Comet GT', perk: 'Dashcam — and a secret' },
];

/** Small street events the city stages for itself, built from the pedestrians
 *  already walking around: a crowd, a moment, then everyone moves on. */
export const STREET_EVENTS = [
  { label: 'Street performers draw a crowd on Palmera', kind: 'buskers' },
  { label: 'Tourists stop for photos by the boardwalk', kind: 'tourists' },
  { label: 'A vendor and a cabbie argue over a parking spot', kind: 'argument' },
  { label: 'Someone is failing a parallel park — badly', kind: 'parking' },
];
