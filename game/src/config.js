// Neon Bay — tuning, districts, missions. All names, places and people are original.
// This file is pure data plus two tiny lookups; nothing here touches the scene.
export const WORLD = {
  half: 260, // half-size of the drivable city square, in metres
  block: 52, // distance between neighbouring intersections
  roadWidth: 12,
  laneOffset: 2.6, // lane offset from a road's centre line
  sunDir: { x: -0.55, y: 0.62, z: 0.35 }, // golden-hour sun direction (normalised in city.js)
};

export const DISTRICTS = [
  { name: 'Old Port', x0: -130, z0: -130, x1: 130, z1: 130, tall: true },
  { name: 'Palm Strip', x0: 130, z0: -130, x1: 260, z1: 130, tall: false },
  { name: 'The Docks', x0: -260, z0: 130, x1: 260, z1: 260, tall: false },
  { name: 'Palm Heights', x0: -90, z0: -290, x1: 90, z1: -130, tall: false },
  { name: 'Cayo Verde', x0: -90, z0: -420, x1: 90, z1: -290, tall: false },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'Neon Bay';
}

export const COMBAT = {
  magSize: 12, // pistol magazine size
  reloadSeconds: 1.4,
  punchComboWindow: 0.9, // seconds a punch combo stays open for the next hit
};

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
  cars: [0, 1, 2, 3, 4, 5], // police cars chasing, by wanted level (index = stars)
  cops: [0, 0, 1, 2, 3, 4], // foot police chasing, by wanted level
  decaySeconds: [0, 8, 10, 12, 15, 18], // seconds hidden before one star drops
  seenRadius: 70, // how close a police unit must be to keep the player "seen"
};

// The story (design: six missions, three acts). `at` is the objective point;
// `kind` drives the rules in missions.js. `rep` is reputation on completion.
function mission(id, title, brief, objective, at, kind, reward, rep, extra = {}) {
  return { id, title, brief, objective, at, kind, reward, rep, ...extra };
}

export const MISSIONS = [
  mission(
    1, 'Comeback Lap',
    'Two years inside, and Vane took your Comet, your shop, your name. The Comet is sitting in the Docks impound — take it back and get it to Nia\u2019s garage. The men watching it carry Vane Development contracts.',
    'Take back your Comet from the impound',
    { x: -104, z: 182 }, 'stealDeliver', 1500, 100,
    {
      at2: { x: -78, z: -52 },
      wantedOnSteal: 2,
      spawnColor: 0xff7a1a,
      spawnSport: true,
      spawnOwner: 'jax',
      stealToast: 'The Comet is yours again — Vane\u2019s men are coming. Get it to Nia\u2019s garage.',
    },
  ),
  mission(
    2, 'Pier 49',
    'The crew lifted Vane\u2019s case at the container terminal. You drive. Get them across the drawbridge to Cayo Verde before it rises — and before the PD boxes you in.',
    'Pick up the crew, then cross the bridge to Cayo Verde',
    { x: 52, z: 208 }, 'pickup', 4000, 250,
    {
      at2: { x: 0, z: -350 },
      pickupToast: 'Crew\u2019s in. "It\u2019s not cash — it\u2019s a drive. The Tideglass. Vane and Chief Sorn framed you, Jax." Bridge. Now!',
    },
  ),
  mission(
    3, 'Valet Service',
    'Vane is throwing a gala at the Hotel Solaris. You are the valet. Lift the encryption module out of his armoured SUV and bring it to Kite — it is the key that unlocks the Tideglass drive.',
    'Steal the encryption module from Vane\u2019s SUV',
    { x: 182, z: 52 }, 'stealDeliver', 7000, 400,
    {
      at2: { x: -78, z: -52 },
      wantedOnSteal: 2,
      spawnColor: 0x11131a,
      spawnSport: false,
      spawnOwner: 'vane',
      stealToast: 'Module secured. Kite can crack the drive now — lose the gala security and get to the garage.',
    },
  ),
  mission(
    4, 'Wrecking Ball',
    'Vane sent three demolition trucks to flatten Old Port, starting with Nia\u2019s workshop. Hold the line while Kite copies the ledger — and whatever happens, do not let them take the shop.',
    'Stop the demolition crew — defend Nia\u2019s workshop',
    { x: -78, z: -52 }, 'combat', 10000, 600,
    {
      ambushToast: 'Demolition crew! Vane\u2019s men are tearing the workshop down — take them out.',
      grabToast: 'Crew down. Grab the ledger copy — Kite needs it off-site, now.',
    },
  ),
  mission(
    5, 'Dead Air',
    'Kite is going to broadcast the Tideglass live, during Vane\u2019s marina ground-breaking. Escort the broadcast van through all three relay zones — the whole city will be watching, and so will the PD.',
    'Escort the broadcast van — relay 1 of 3',
    { x: 52, z: -52 }, 'escort', 15000, 800,
    {
      at2: { x: -104, z: 52 },
      at3: { x: 104, z: 130 },
    },
  ),
  mission(
    6, 'Last Exit: Neon Bay',
    'Vane is running. His armoured limo is a decoy — he is fleeing in YOUR stolen Comet, heading for the seaplane at the marina. Take the Comet back without wrecking it, and end this.',
    'Reclaim your Comet at the marina',
    { x: 156, z: 26 }, 'stealDeliver', 50000, 1000,
    {
      at2: { x: 78, z: 52 },
      wantedOnSteal: 5,
      spawnColor: 0xff7a1a,
      spawnSport: true,
      spawnOwner: 'jax',
      stealToast: 'That\u2019s your Comet — and Vane\u2019s in it. Five stars, the whole PD, and one seaplane to beat. Bring it home.',
    },
  ),
];

// Reputation ranks — they open jobs, cars and mods, never the story itself.
export const RANKS = [
  { name: 'Rookie', rep: 0 },
  { name: 'Courier', rep: 500 },
  { name: 'Wheelman', rep: 1500 },
  { name: 'Kingpin', rep: 3500 },
  { name: 'Neon Legend', rep: 6000 },
];

export function rankForRep(rep) {
  let rank = RANKS[0];
  for (const r of RANKS) if (rep >= r.rep) rank = r;
  return rank.name;
}

export const SAVE_KEY = 'neon-bay-save-v1';
export const BEST_KEY = 'neon-bay-best-v1';
export const STEP = 1 / 60;

// "Keys are identities": every car on the street belongs to someone, and the fob
// carries their life with it. Stealing the right car is infiltration, not speed.
export const CAR_OWNERS = [
  { owner: 'Dr. Hale', car: 'Sedan', perk: 'Hospital parking pass' },
  { owner: 'Marina boss Voss', car: 'SUV', perk: 'Marina gate fob' },
  { owner: 'Chef Amara', car: 'Hatchback', perk: 'Docks canteen tab' },
  { owner: 'DJ Neon', car: 'Coupe', perk: 'Club backstage pass' },
  { owner: 'Banker Oka', car: 'Sedan', perk: 'Toll account, fully loaded' },
  { owner: 'Fisherman Bo', car: 'Pickup', perk: 'Harbour master key' },
  { owner: 'Professor Lin', car: 'Hatchback', perk: 'University garage card' },
  { owner: 'Silas Vane', car: 'Armoured SUV', perk: 'Encryption module — and a secret' },
];

// The two story cars. `spawnOwner: 'jax' | 'vane'` in a mission picks one of these.
export const JAX_CAR = { owner: 'Jax Marlowe', car: 'Comet GT', perk: 'Your car. Your name on the title.' };
export const VANE_SUV = { owner: 'Silas Vane', car: 'Armoured SUV', perk: 'Encryption module — and a secret' };

// Small street events the city stages for itself, built from the pedestrians
// already walking around: a crowd, a moment, then everyone moves on.
export const STREET_EVENTS = [
  { label: 'Street performers draw a crowd on Palm Strip', kind: 'buskers' },
  { label: 'Tourists stop for photos by the boardwalk', kind: 'tourists' },
  { label: 'A vendor and a cabbie argue over a parking spot', kind: 'argument' },
  { label: 'Someone is failing a parallel park — badly', kind: 'parking' },
];
