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
  /** Pistol magazine size and reload time. */
  magSize: 12,
  reloadSeconds: 1.4,
  /** Seconds a punch combo stays open for the next hit. */
  punchComboWindow: 0.9,
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
  /** Police cars chasing, by wanted level (index = stars). */
  cars: [0, 1, 2, 3, 4, 5],
  /** Foot police chasing, by wanted level. */
  cops: [0, 0, 1, 2, 3, 4],
  /** Seconds hidden before one star drops. */
  decaySeconds: [0, 8, 10, 12, 15, 18],
  /** How close a police unit must be to keep the player "seen". */
  seenRadius: 70,
};

/** The story (design: six missions, three acts). `at` is the objective point;
 *  `kind` drives the rules in missions.js. `rep` is reputation on completion. */
export const MISSIONS = [
  {
    id: 1,
    title: 'Comeback Lap',
    brief: 'Two years inside, and Vane took your Comet, your shop, your name. The Comet is sitting in the Docks impound — take it back and get it to Nia\u2019s garage. The men watching it carry Vane Development contracts.',
    objective: 'Take back your Comet from the impound',
    at: { x: -104, z: 182 },
    at2: { x: -78, z: -52 },
    kind: 'stealDeliver',
    reward: 1500,
    rep: 100,
    wantedOnSteal: 2,
    spawnColor: 0xff7a1a,
    spawnSport: true,
    spawnOwner: 'jax',
    stealToast: 'The Comet is yours again — Vane\u2019s men are coming. Get it to Nia\u2019s garage.',
  },
  {
    id: 2,
    title: 'Pier 49',
    brief: 'The crew lifted Vane\u2019s case at the container terminal. You drive. Get them across the drawbridge to Cayo Verde before it rises — and before the PD boxes you in.',
    objective: 'Pick up the crew, then cross the bridge to Cayo Verde',
    at: { x: 52, z: 208 },
    at2: { x: 0, z: -350 },
    kind: 'pickup',
    reward: 4000,
    rep: 250,
    pickupToast: 'Crew\u2019s in. \"It\u2019s not cash — it\u2019s a drive. The Tideglass. Vane and Chief Sorn framed you, Jax.\" Bridge. Now!',
  },
  {
    id: 3,
    title: 'Valet Service',
    brief: 'Vane is throwing a gala at the Hotel Solaris. You are the valet. Lift the encryption module out of his armoured SUV and bring it to Kite — it is the key that unlocks the Tideglass drive.',
    objective: 'Steal the encryption module from Vane\u2019s SUV',
    at: { x: 182, z: 52 },
    at2: { x: -78, z: -52 },
    kind: 'stealDeliver',
    reward: 7000,
    rep: 400,
    wantedOnSteal: 2,
    spawnColor: 0x11131a,
    spawnSport: false,
    spawnOwner: 'vane',
    stealToast: 'Module secured. Kite can crack the drive now — lose the gala security and get to the garage.',
  },
  {
    id: 4,
    title: 'Wrecking Ball',
    brief: 'Vane sent three demolition trucks to flatten Old Port, starting with Nia\u2019s workshop. Hold the line while Kite copies the ledger — and whatever happens, do not let them take the shop.',
    objective: 'Stop the demolition crew — defend Nia\u2019s workshop',
    at: { x: -78, z: -52 },
    kind: 'combat',
    reward: 10000,
    rep: 600,
    ambushToast: 'Demolition crew! Vane\u2019s men are tearing the workshop down — take them out.',
    grabToast: 'Crew down. Grab the ledger copy — Kite needs it off-site, now.',
  },
  {
    id: 5,
    title: 'Dead Air',
    brief: 'Kite is going to broadcast the Tideglass live, during Vane\u2019s marina ground-breaking. Escort the broadcast van through all three relay zones — the whole city will be watching, and so will the PD.',
    objective: 'Escort the broadcast van — relay 1 of 3',
    at: { x: 52, z: -52 },
    at2: { x: -104, z: 52 },
    at3: { x: 104, z: 130 },
    kind: 'escort',
    reward: 15000,
    rep: 800,
  },
  {
    id: 6,
    title: 'Last Exit: Neon Bay',
    brief: 'Vane is running. His armoured limo is a decoy — he is fleeing in YOUR stolen Comet, heading for the seaplane at the marina. Take the Comet back without wrecking it, and end this.',
    objective: 'Reclaim your Comet at the marina',
    at: { x: 156, z: 26 },
    at2: { x: 78, z: 52 },
    kind: 'stealDeliver',
    reward: 50000,
    rep: 1000,
    wantedOnSteal: 5,
    spawnColor: 0xff7a1a,
    spawnSport: true,
    spawnOwner: 'jax',
    stealToast: 'That\u2019s your Comet — and Vane\u2019s in it. Five stars, the whole PD, and one seaplane to beat. Bring it home.',
  },
];

/** Reputation ranks — they open jobs, cars and mods, never the story itself. */
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
  { owner: 'Silas Vane', car: 'Armoured SUV', perk: 'Encryption module — and a secret' },
];

/** The two story cars. `spawnOwner: 'jax' | 'vane'` in a mission picks one of these. */
export const JAX_CAR = { owner: 'Jax Marlowe', car: 'Comet GT', perk: 'Your car. Your name on the title.' };
export const VANE_SUV = { owner: 'Silas Vane', car: 'Armoured SUV', perk: 'Encryption module — and a secret' };

/** Small street events the city stages for itself, built from the pedestrians
 *  already walking around: a crowd, a moment, then everyone moves on. */
export const STREET_EVENTS = [
  { label: 'Street performers draw a crowd on Palm Strip', kind: 'buskers' },
  { label: 'Tourists stop for photos by the boardwalk', kind: 'tourists' },
  { label: 'A vendor and a cabbie argue over a parking spot', kind: 'argument' },
  { label: 'Someone is failing a parallel park — badly', kind: 'parking' },
];
