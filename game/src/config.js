// Teluk Cahaya — configuration, tuning and story data.
// One job: every number and every line of story text lives here, so the
// rest of the game reads from a single place.
export const GAME_TITLE = 'TELUK CAHAYA';
export const GAME_SUBTITLE = 'An Open-World Crime Story';
export const SAVE_KEY = 'telukcahaya-save-v1';

// The city is a grid of blocks. Roads run every BLOCK metres; the beach and
// the sea sit on the south edge (positive z).
export const CITY = {
  seed: 1337,
  half: 300, // playable half-extent in metres (x and z)
  block: 60, // block pitch
  roadWidth: 14,
  beachZ: 252, // sand starts here
  seaZ: 292, // water starts here
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.6,
  maxHealth: 100,
  punchRange: 2.2,
  punchDamage: 12,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 34, // sports car, m/s (~122 km/h)
  maxReverse: 9,
  steerMax: 0.55,
  drag: 0.35,
  handbrakeDecel: 26,
  radius: 1.6,
};

export const WANTED = {
  maxStars: 5,
  heatPerStar: 20,
  decayPerSec: 1.6, // heat lost while unseen
  decayHiddenPerSec: 6, // heat lost while no police can see the player
  steal: 25,
  punchPed: 15,
  shoot: 30,
  killPed: 40,
  hitPed: 20,
  ramPolice: 15,
};

export const POLICE = {
  maxCars: 5,
  maxCops: 4,
  carSpeed: 30,
  copSpeed: 7.5,
  arrestSeconds: 2.5,
  bustFine: 200,
  spawnDistance: 70,
};

// The story: Raka, an ojek rider in Teluk Cahaya, takes jobs from Darma.
export const STORY = {
  hero: 'Raka',
  fixer: 'Darma',
  warungOwner: 'Mbak Sari',
  intro: [
    'Teluk Cahaya — kota pesisir yang tak pernah tidur.',
    'Raka, tukang ojek, butuh uang cepat. Darma, sang calo, punya tawaran.',
    'Selesaikan tiga pekerjaan Darma, dan kota ini milikmu.',
  ],
};

export const MISSIONS = [
  {
    id: 'paket-kilat',
    title: 'Paket Kilat',
    briefing: [
      ['Darma', 'Raka, ada paket buat orang di dermaga. Penting. Jangan telat.'],
      ['Raka', 'Berapa bayarannya?'],
      ['Darma', 'Lima ratus. Antar sebelum waktunya habis. Mobil? Cari sendiri.'],
    ],
    objective: 'Antar paket ke Dermaga Teluk',
    reward: 500,
    timer: 100,
    marker: { x: -30, z: 265 },
    startPos: { x: 30, z: 30 },
  },
  {
    id: 'mobil-pesanan',
    title: 'Mobil Pesanan',
    briefing: [
      ['Darma', 'Kerja bagus. Sekarang yang kedua: ada Komet Merah parkir di Mall Cahaya.'],
      ['Darma', 'Bawa ke Bengkel Darma. Jangan sampai ketahuan polisi.'],
      ['Raka', 'Kalau ketahuan?'],
      ['Darma', 'Ya kabur. Itu kan keahlianmu.'],
    ],
    objective: 'Curi Komet Merah, antar ke Bengkel Darma',
    reward: 1200,
    timer: 0,
    marker: { x: 165, z: -140 }, // the red sports car, parked by the mall
    garage: { x: -180, z: 195 }, // the garage forecourt, in front of the bay
    startPos: { x: 30, z: 30 },
  },
  {
    id: 'kabur-dari-razia',
    title: 'Kabur dari Razia',
    briefing: [
      ['Darma', 'Polisi sudah mengendusmu, Raka. Razia di mana-mana.'],
      ['Mbak Sari', 'Sembunyi di warungku. Lewat jalan belakang, jangan lewat jalan besar.'],
      ['Raka', 'Kalau aku sampai, kita beres. Kalau tidak... ya sudah.'],
    ],
    objective: 'Kabur dari polisi, sampai ke Warung Mbak Sari',
    reward: 2500,
    timer: 0,
    marker: { x: -60, z: -52 }, // the safehouse warung, just outside its door
    startPos: { x: 30, z: 30 },
  },
];

// Side activities.
export const TAXI = { fareMin: 80, fareMax: 150, timePerMetre: 0.55 };
export const COINS = { total: 10, value: 50, bonusAll: 500 };
export const SHOP = { pistolPrice: 800, ammoPrice: 100, ammoAmount: 12, mealPrice: 20 };
export const WARUNG_HEAL = 60;

// Small original details that make the city feel lived-in.
export const SIGNS = [
  'WARUNG MBAK SARI',
  'OJEK 24 JAM',
  'BENGKEL DARMA',
  'MALL CAHAYA',
  'DERMAGA TELUK',
  'TOKO BESI',
  'ES KELAPA MUDA',
  'PELABUHAN',
  'POLSEK TELUK',
  'RS CAHAYA',
];
