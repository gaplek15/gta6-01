[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/gaplek15/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/gaplek15/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# TELUK CAHAYA

**[TELUK CAHAYA — make.fun bounty gta6-01](https://make.fun/bounty/gta6-01)**

Game open-world crime 3D di kota pesisir tropis fiktif. Kamu Raka, tukang ojek yang terlilit utang; fixer Darma menawarimu tiga kerjaan, dan polisi selalu mengawasi. Jelajahi kota jalan kaki atau dengan mobil curian, kerjakan misi, antar penumpang taksi, kumpulkan Koin Teluk, dan jangan sampai ketangkap.

## Cara main

Buka `game/index.html` di desktop Chrome — tidak butuh server, tidak ada request jaringan saat main.

| Kontrol | Aksi |
| --- | --- |
| W A S D | Jalan / nyetir |
| Shift | Lari |
| Spasi | Lompat / rem tangan |
| E | Masuk mobil / bicara / interaksi |
| F | Pukul |
| Klik kiri | Tembak (butuh pistol dari Toko Besi) |
| T | Taksi (antar penumpang, $80–150) |
| Esc | Jeda |
| Mouse | Putar kamera |

## Yang ada di game

- **Kota terbuka**: downtown, Mall Cahaya, Dermaga Teluk, perumahan, pantai dan laut; jalan dengan marka, zebra cross, lampu lalu lintas yang berfungsi, trotoar, palem, halte, dan billboard.
- **Lalu lintas hidup**: 12 mobil AI dan 18 pejalan kaki yang berjalan di trotoar, plus mobil parkir yang bisa dicuri.
- **Wanted 1–5 bintang**: naik saat berbuat kejahatan, turun saat sembunyi. Mobil polisi dan polisi jalan kaki mengejar; ketangkap berarti BUSTED dan denda.
- **3 misi berurutan** dengan dialog dan penanda objektif: *Paket Kilat* (+$500), *Mobil Pesanan* — curi Komet Merah di Mall (+$1.200), *Kabur dari Razia* (+$2.500).
- **Aktivitas**: taksi, 10 Koin Teluk tersembunyi (+$50, bonus $500), Toko Besi (pistol $800), Warung Mbak Sari (makan $20, +60 darah).
- **HUD lengkap**: minimap, bintang wanted, uang, darah, XP/level, jam game, objektif + jarak, speedometer; layar judul, jeda, busted, dan wasted; save otomatis ke localStorage.
- **Suara**: semua efek suara disintesis WebAudio — mesin mobil, sirene polisi, tembakan, koin, dan jingle misi. Tanpa file audio eksternal.

## Teknologi

- three.js 0.160.0 (vendored di `game/vendor/three.module.min.js`)
- Semua tekstur prosedural dari canvas — aspal, trotoar, fasad, kaca, rumput — tanpa aset eksternal
- Sky dome shader dengan matahari golden-hour, awan, dan fog hangat
- Node.js 22 (stdlib saja) untuk build dossier: `node main.ts`

## Screenshot

Empat scene deterministik (lihat `shots.json`): `?shot=cover`, `?shot=drive`, `?shot=chase`, `?shot=mission`.

## Lisensi

MIT. Kota, karakter, kendaraan, dan cerita di game ini fiktif dan dibuat dari nol — bukan salinan game komersial apa pun.
