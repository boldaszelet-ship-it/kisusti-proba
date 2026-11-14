// Kisüsti — szereplő-katalógus: a modulos ruharészek (Quaternius Ultimate Modular Men/Women, CC0) szerepkiosztása,
// a ruha- és hajkészletek, a színpaletták. A figuragyár (szereplo.js) ebből rakja össze a figurát; a színek
// csúcsszínként kerülnek a hálóra (egy közös anyag minden figurára → figuránként egy rajzhívás).
//
// Szerepek (a palettában ezekre lehet színt adni): bor, szem, szemfeher, szemoldok, haj, bajusz, felso, felso2, ing,
// nyakkendo, melleny, mellenycsik, also, also2, ov, cipo, cipo2, kalap, kalap2, kendo, koteny, szemuveg.

/** anyagnév → szerep, részenként (a GLB-ben „Ruha_Rész” a háló neve). '-' = elrejtve (pl. sisak, korona). */
export const RESZ = {
  f: {
    Farmer_Head: { Skin: 'bor', Beige: 'kalap', Red: 'kalap2', Eyebrows: 'szemoldok', Eye: 'szem' },
    Farmer_Body: { Brown: 'felso', LightBlue: 'also', Skin: 'bor', Beige: 'ov' },
    Farmer_Legs: { LightBlue: 'also' },
    Farmer_Feet: { Brown2: 'cipo2', Brown: 'cipo' },
    Worker_Head: { Worker_Yellow: '-', Skin: 'bor', Eyebrows: 'szemoldok', Eye: 'szem', Moustache: 'bajusz' },
    Worker_Body: { Worker_Yellow: 'mellenycsik', Worker_Vest: 'melleny', LightBrown: 'felso', Skin: 'bor' },
    Worker_Legs: { Brown2: 'also2', Brown: 'also' },
    Worker_Feet: { Black: 'cipo', Grey: 'cipo2' },
    Suit_Head: { Skin: 'bor', Hair: 'haj', Eyebrows: 'szemoldok', Eye: 'szem' },
    Suit_Body: { Suit: 'felso', White: 'ing', Tie: 'nyakkendo', Skin: 'bor' },
    Suit_Legs: { Suit: 'also' },
    Suit_Feet: { Black: 'cipo' },
    Casual_Head: { Skin: 'bor', Eyebrows: 'szemoldok', Eye: 'szem', Hair: 'haj' },
    Casual_Body: { Purple: 'felso', Skin: 'bor' },
    Casual_Legs: { Skin: 'bor', LightBlue: 'also' },
    Casual_Feet: { White: 'cipo2', Purple: 'cipo' },
    Casual2_Head: { Skin: 'bor', Skin_Darker: 'bor', Eyebrows: 'szemoldok', Eye: 'szem', Hair: 'haj' },
    Casual2_Body: { LightBrown: 'felso', Skin: 'bor' },
    Casual2_Legs: { LightBlue: 'also' },
    Casual2_Feet: { White: 'cipo2', Red_Dark: 'cipo' },
    Beach_Head: { Skin: 'bor', Eyebrows: 'szemoldok', Eye: 'szem', Hair: 'haj', Earrings: '-' },
    Beach_Body: { Skin: 'bor', LightBrown: 'felso' },
    Beach_Legs: { Skin: 'bor', Red_Dark: 'also', White: 'also2' },
    Beach_Feet: { Skin: 'bor', Red_Dark: 'cipo' },
    King_Head: { Skin: 'bor', Hair_White: 'haj', Eye: 'szem', Gold: '-' },
    Adventurer_Head: { Skin: 'bor', Eyebrows: 'szemoldok', Eye: 'szem', Hair: 'haj' },
    Adventurer_Body: { Green: 'felso', LightGreen: 'felso2', Skin: 'bor' },
    Adventurer_Legs: { Brown2: 'also2', Brown: 'also' },
    Adventurer_Feet: { Black: 'cipo', Grey: 'cipo2' },
  },
  n: {
    Casual_Head: { Skin: 'bor', Hair_Blond: 'haj', Hair_Brown: 'szemoldok', Brown: 'szem' },
    Casual_Body: { White: 'felso', Skin: 'bor' },
    Casual_Legs: { Orange: 'also' },
    Casual_Feet: { Skin: 'bor', Grey: 'cipo' },
    Worker_Head: { Skin: 'bor', Worker_Yellow: '-', DarkBrown: 'haj', Brown: 'szem' },
    Worker_Body: { Skin: 'bor', Worker_Vest: 'melleny', Worker_Yellow: 'mellenycsik', White: 'felso' },
    Worker_Legs: { Brown_02: 'also', Brown2: 'also2' },
    Worker_Feet: { Skin: 'bor', Black: 'cipo' },
    Suit_Head: { Skin: 'bor', Hair_Blond: 'haj', Hair_Brown: 'szemoldok', Brown: 'szem' },
    Suit_Body: { Black: 'felso', White: 'ing', Skin: 'bor' },
    Suit_Legs: { Black: 'also' },
    Suit_Feet: { Black: 'cipo', Skin: 'bor' },
    Formal_Head: { Skin: 'bor', Red: 'haj', Brown: 'szem+' },
    Formal_Body: { Skin: 'bor', LimeGreen: 'felso', Gold: 'ov' },
    Formal_Legs: { Skin: 'bor', LimeGreen: 'felso' },
    Formal_Feet: { Skin: 'bor', Red: 'cipo' },
    Adventurer_Head: { Skin: 'bor', Hair_Brown: 'haj', Brown: 'szem' },
    Soldier_Head: { Skin: 'bor', Hair_Brown: 'haj', Brown: 'szem' },
    Soldier_Body: { Black: 'felso', Swat: 'felso2', Skin: 'bor' },
    Medieval_Head: { Black: '-', DarkBrown: '-', Skin: 'bor', White: 'haj', Brown: 'szem+' },
    Witch_Head: { Purple: '-', Gold: '-', Skin: 'bor', Hair_Black: 'haj', Brown: 'szem' },
    Witch_Body: { Purple: 'felso', Skin: 'bor', Gold: 'ov', Brown2: 'ov' },
    Witch_Legs: { Purple: 'also', Gold: 'also', Brown: 'also2' },
    Witch_Feet: { Brown2: 'cipo' },
  },
};

/** Ruhák: felsőtest + láb + lábbeli (+ generált réteg: mellény, kötény). */
export const RUHAK = {
  f: {
    kantaros: { resz: ['Farmer_Body', 'Farmer_Legs', 'Farmer_Feet'], szin: { felso: 0x8a6a4a, also: 0x3d4f66, ov: 0x9a8a60, cipo: 0x4a3322, cipo2: 0x2a1d14 } },
    munkas: { resz: ['Worker_Body', 'Worker_Legs', 'Adventurer_Feet'], szin: { felso: 0x6f6a5c, melleny: 0x3f5a6e, mellenycsik: 0x3f5a6e, also: 0x3a4a5e, also2: 0x2f3b4a, cipo: 0x2b211a, cipo2: 0x1a1512 } },
    ing: { resz: ['Casual2_Body', 'Casual2_Legs', 'Casual2_Feet'], szin: { felso: 0xb7aa8e, also: 0x45536a, cipo: 0x3b2a1e, cipo2: 0x8f8476 } },
    pulover: { resz: ['Casual_Body', 'Casual2_Legs', 'Casual_Feet'], szin: { felso: 0x6b4a52, also: 0x4a5160, cipo: 0x2c2a2a, cipo2: 0xb9b0a0 } },
    triko: { resz: ['Beach_Body', 'Farmer_Legs', 'Adventurer_Feet'], szin: { felso: 0xd9d4c4, also: 0x4b5a4a, cipo: 0x3a2b1f, cipo2: 0x221a14 } },
    oltony: { resz: ['Suit_Body', 'Suit_Legs', 'Suit_Feet'], szin: { felso: 0x30353f, also: 0x30353f, ing: 0xe8e4da, nyakkendo: 0x7a2630, cipo: 0x1d1a18 } },
    zold_ing: { resz: ['Adventurer_Body', 'Adventurer_Legs', 'Adventurer_Feet'], szin: { felso: 0x5c6440, felso2: 0x4c5436, also: 0x5a4a36, also2: 0x463a2c, cipo: 0x2b221b, cipo2: 0x1d1814 } },
    // a pénzügyőr egyenruhája: sötét olívzöld zubbony és nadrág, embléma és felirat NÉLKÜL (a Hivatal fiktív)
    egyenruha: { resz: ['Suit_Body', 'Suit_Legs', 'Adventurer_Feet'], szin: { felso: 0x34402f, also: 0x2c3628, ing: 0xb8b59a, nyakkendo: 0x1f261c, cipo: 0x161412, cipo2: 0x0f0d0c } },
  },
  n: {
    otthonka: { resz: ['Formal_Body', 'Formal_Legs', 'Formal_Feet'], koteny: true, szin: { felso: 0x6f86a8, ov: 0x6f86a8, cipo: 0x5a4a3e, koteny: 0xe6dccb } },
    ruha: { resz: ['Formal_Body', 'Formal_Legs', 'Formal_Feet'], szin: { felso: 0x8a3a3a, ov: 0x3b2a22, cipo: 0x3a2a22 } },
    polo: { resz: ['Casual_Body', 'Casual_Legs', 'Casual_Feet'], szin: { felso: 0xd8d0c0, also: 0x44506a, cipo: 0x6a5a4a } },
    kosztum: { resz: ['Suit_Body', 'Suit_Legs', 'Suit_Feet'], szin: { felso: 0x2e3440, also: 0x2e3440, ing: 0xece6da, cipo: 0x1c1a19 } },
    munkas: { resz: ['Worker_Body', 'Worker_Legs', 'Worker_Feet'], szin: { felso: 0xc9c1ae, melleny: 0x5a6b48, mellenycsik: 0x5a6b48, also: 0x4a4038, also2: 0x3a322c, cipo: 0x2b221b } },
    tunika: { resz: ['Witch_Body', 'Witch_Legs', 'Witch_Feet'], szin: { felso: 0x5b6e5a, ov: 0x3b2f26, also: 0x3a3634, also2: 0x3a3634, cipo: 0x3a2b20 } },
    fekete: { resz: ['Soldier_Body', 'Suit_Legs', 'Suit_Feet'], szin: { felso: 0x24242a, felso2: 0x24242a, also: 0x2a2e3a, cipo: 0x1a1818 } },
  },
};

/** Hajak (= fejváltozatok). A 'szakall' a fejbe épített szakáll. */
export const HAJAK = {
  f: {
    oldalt: 'Suit_Head', gondor: 'Casual_Head', rovid: 'Casual2_Head', tuskes: 'Beach_Head',
    hosszu_szakall: 'Adventurer_Head', osz_szakall: 'King_Head', bajszos: 'Worker_Head', szalmakalap: 'Farmer_Head',
  },
  n: {
    hosszu: 'Casual_Head', felhosszu: 'Suit_Head', konty: 'Formal_Head', osz_hosszu: 'Medieval_Head',
    bubi: 'Witch_Head', barna_hosszu: 'Soldier_Head', barna_rovid: 'Worker_Head', rovid: 'Adventurer_Head',
  },
};

// ------------------------------------------------------------------ színkészletek (sRGB)
export const BOR = [0xe8b896, 0xdcaa86, 0xc99a74, 0xb88660, 0xe3bfa2];
export const HAJSZIN = { fekete: 0x231c18, barna: 0x4a3222, gesztenye: 0x6a3f24, szoke: 0xb08d58, voros: 0x8a3a1e, oszes: 0x8a8580, osz: 0xb9b5ae, feher: 0xdedbd4 };
export const FELSO = [0x8a6a4a, 0x6b7a5a, 0x5f6f86, 0x8a4a42, 0xb7aa8e, 0x6e5a7a, 0x9a8a68, 0x4f6a6a, 0xa86a3a, 0x7a7a72];
export const ALSO = [0x3d4f66, 0x45536a, 0x4a4038, 0x5a4a36, 0x3a3634, 0x52564a, 0x2e3440];
export const KENDO = [0x8a2f3a, 0x2f4a7a, 0x3a5a3a, 0x6a3a6a, 0x9a6a2a, 0x2a2a3a];
export const OTTHONKA = [0x6f86a8, 0x8a6a8a, 0x5f8a7a, 0xa87a5a, 0x7a8a5a, 0x9a5a5a];

/** Testalkat: has (a derék kidomborítása, m), csipo (csípő), magassag-szorzó. */
export const ALKAT = {
  vekony: { has: -0.006, csipo: -0.006, torzs: -0.014 },
  atlag: { has: 0.0, csipo: 0.0, torzs: 0.0 },
  testes: { has: 0.045, csipo: 0.035, torzs: 0.035 },
  pocakos: { has: 0.085, csipo: 0.025, torzs: 0.025 },
};
