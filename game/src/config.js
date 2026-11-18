// TELUK CAHAYA — central configuration: city layout, palette, economy,
// mission definitions and tuning. Every other module reads from here so the
// whole game stays consistent.
export const GAME = {
  title: 'TELUK CAHAYA',
  seed: 1,
};

// City grid: square blocks separated by roads. One block = BLOCK metres of
// buildings, ROAD metres of asphalt. The sea sits south of the grid (z > 0).
export const CITY = {
  blocks: 7, // blocks per side
  block: 42,
  road: 14,
  get pitch() { return this.block + this.road; },
  get half() { return (this.blocks * this.pitch) / 2; },
};

// Road centre coordinates: road i runs at x = roadCoord(i) (vertical road)
// or z = roadCoord(i) (horizontal road).
export function roadCoord(i) {
  return -CITY.half + CITY.road / 2 + i * CITY.pitch;
}
export function blockCoord(i) {
  return -CITY.half + CITY.road + CITY.block / 2 + i * CITY.pitch;
}

// Warm, sun-soaked tropical palette. Facades are warm plaster, brick and
// painted concrete; roofs are terracotta, slate and pale metal.
export const PALETTE = {
  facades: [0xe8dcc8, 0xd9b48f, 0xc98f6b, 0xe6c9a0, 0xb9c4c9, 0xdba98c, 0xead9b8, 0xc7a27a],
  facadesDowntown: [0xcfd6d8, 0xbcc8cc, 0xd8cdbd, 0xaeb9c2, 0xe3d3b8],
  roofs: [0xa8542f, 0x8a4a2b, 0x5d6b73, 0x7d7468, 0xb06a3c, 0x4f5d66],
  trims: [0xffffff, 0xf2e6cf, 0xd8cfc0],
  awnings: [0xc0392b, 0x2471a3, 0x1e8449, 0xd4ac0d, 0x7d3c98],
  glass: 0x1d2733,
  asphalt: 0x33363b,
  sidewalk: 0xb9b3a4,
  grass: 0x5d8a4a,
  sand: 0xdcc79a,
  sea: 0x2e7f9e,
  carPaint: [0xc0392b, 0x2471a3, 0xf1c40f, 0xecf0f1, 0x2c3e50, 0x7d3c98, 0x16a085, 0xe67e22, 0x95a5a6, 0x8e44ad],
};

// Economy and progression.
export const ECONOMY = {
  startMoney: 200,
  pistolPrice: 800,
  mealPrice: 20,
  mealHeal: 60,
  coinValue: 50,
  coinBonus: 500,
  coinCount: 10,
  taxiFareMin: 80,
  taxiFareMax: 150,
  bustedFine: 100,
  wastedLoss: 150,
  xpPerMission: 250,
  xpPerCoin: 15,
  xpPerFare: 40,
};

// Mission script. Positions are world coordinates (x, z) in metres.
export const MISSIONS = [
  {
    id: 'paket-kilat',
    title: 'Paket Kilat',
    reward: 500,
    briefing: 'Darma',
    text: 'Antar paket ini ke Dermaga Teluk. Jangan sampai basah, jangan sampai telat.',
    objective: 'Antar paket ke Dermaga Teluk',
    target: { x: 20, z: 236 },
  },
  {
    id: 'mobil-pesanan',
    title: 'Mobil Pesanan',
    reward: 1200,
    briefing: 'Darma',
    text: 'Curi Komet Merah itu, antar ke bengkelku. Jangan sampai ketahuan polisi.',
    objective: 'Curi Komet Merah di Mall Cahaya',
    target: { x: 188, z: -28 },
    deliver: { x: -28, z: 28 },
    deliverObjective: 'Antar Komet Merah ke Bengkel Darma',
  },
  {
    id: 'kabur-dari-razia',
    title: 'Kabur dari Razia',
    reward: 2500,
    briefing: 'Darma',
    text: 'Razia besar-besaran. Polisi sudah mengincarmu. Kabur ke Warung Mbak Sari, sekarang!',
    objective: 'Kabur dari polisi, sampai ke Warung Mbak Sari',
    target: { x: -84, z: 140 },
    wantedOnStart: 3,
  },
];

// Key places in the world (x, z).
export const PLACES = {
  pier: { x: 20, z: 236, name: 'Dermaga Teluk' },
  mall: { x: 196, z: -28, name: 'Mall Cahaya' },
  garage: { x: -28, z: 28, name: 'Bengkel Darma' },
  warung: { x: -84, z: 140, name: 'Warung Mbak Sari' },
  policeStation: { x: -140, z: -140, name: 'Polsek Teluk Cahaya' },
  gunStore: { x: 84, z: 84, name: 'Toko Besi' },
  taxiStand: { x: 28, z: -84, name: 'Pangkalan Ojek' },
  hospital: { x: 140, z: 140, name: 'Klinik Teluk' },
};

// Player / vehicle tuning.
export const TUNE = {
  walkSpeed: 5.2,
  runSpeed: 8.6,
  jumpSpeed: 7.5,
  gravity: 22,
  punchRange: 2.2,
  punchDamage: 18,
  pistolDamage: 34,
  pistolRange: 90,
  carAccel: 16,
  carBrake: 26,
  carMaxSpeed: 38, // ~137 km/h
  carReverseMax: 12,
  carTurn: 1.9,
  handbrakeTurn: 3.1,
  wantedDecaySeconds: 26,
  copCatchDistance: 2.4,
  copRunSpeed: 7.4,
  policeCarSpeed: 34,
};

// Traffic / pedestrians.
export const TRAFFIC = {
  cars: 12,
  peds: 18,
  parked: 6,
};
