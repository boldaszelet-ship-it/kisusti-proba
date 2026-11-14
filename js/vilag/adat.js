// Kisüsti — a világ saját (nem szerződéses) adatai: úttípusok, felületi kódok, parcellák, burkolt terek.
// A szerződéses adatok (régiók, ingatlanok, utak gráfja) a data/regions.js-ben vannak; ez csak a megjelenést írja le.
import { NODES, ROADS, RIVER, BOUNDS } from '../../data/regions.js';

export { NODES, ROADS, RIVER, BOUNDS };

/** Úttípusok: szélesség (m), felület-kód. 'fo' = aszfaltos Fő út, 'regi' = foltozott régi aszfalt, 'fold' = földút. */
export const UTTIPUS = {
  fo: { w: 5.4, kod: 1 }, regi: { w: 4.4, kod: 2 }, fold: { w: 3.6, kod: 3 },
};
const FO = new Set(['fout_ny|major_le', 'major_le|hegy_lab', 'hegy_lab|kapu', 'kapu|falu_kp', 'falu_kp|hid_ny', 'hid_ny|hid_k', 'hid_k|fout_k', 'hid_k|kv_be', 'kv_be|kv_kp']);
const REGI = new Set(['falu_kp|felveg_le', 'felveg_le|felveg_kp']);
export function uttipus(a, b) {
  const k = a + '|' + b, k2 = b + '|' + a;
  if (FO.has(k) || FO.has(k2)) return 'fo';
  if (REGI.has(k) || REGI.has(k2)) return 'regi';
  return 'fold';
}
/** Az utak szakaszai: {a, b, ax, az, bx, bz, tipus, w}. */
export const SZAKASZOK = ROADS.map(([a, b]) => {
  const t = uttipus(a, b);
  return { a, b, ax: NODES[a][0], az: NODES[a][1], bx: NODES[b][0], bz: NODES[b][1], tipus: t, w: UTTIPUS[t].w };
});

/** Csak látványbeli mellékutcák (nincsenek a gráfban, az NPC nem használja): [ax, az, bx, bz, típus]. */
export const MELLEKUTAK = [
  [230, -190, 230, -266, 'regi'],      // Felvég utcája a csomóponton túl
  [520, 293, 520, 366, 'fo'],          // Állomás utca
  [563, 262, 652, 262, 'fo'],          // keleti utca
  [501, 284, 446, 284, 'fo'],          // nyugati utca
  [-150, -180, -112, -158, 'fold'],    // dűlőút a présházsorból
];
export const SZAKASZOK_MIND = [...SZAKASZOK, ...MELLEKUTAK.map(([ax, az, bx, bz, t]) => ({ a: null, b: null, ax, az, bx, bz, tipus: t, w: UTTIPUS[t].w }))];

/** Felületi kódok (a terep csúcsszínéhez és a járművek tapadásához). */
export const F = {
  FU: 0, ASZFALT: 1, REGI: 2, FOLDUT: 3, PADKA: 4, SZANTO: 5, TARLO: 6, KUKORICA: 7, UDVAR: 8, BURKOLAT: 9,
  SZOLO: 10, RET: 11, MEDER: 12, BETON: 13, ERDO: 14, KERT: 15, SINEK: 16, LUCERNA: 17, GAZOS: 18,   // GAZOS: elhanyagolt, taposott udvar (föld és száraz gyep foltokban)
};
/** Tapadás / végsebesség-szorzó felületenként (jármű). */
export const TAPADAS = { 1: 1, 2: 0.95, 3: 0.82, 4: 0.85, 8: 0.8, 9: 0.9, 13: 0.95, 16: 0.7, 18: 0.85 };

/** Burkolt vagy döngölt terek (téglalap, elforgatással): a falu piactere, a major betonja, a kisváros főtere. */
export const TEREK = [
  { x: 0, z: 0, w: 28, d: 24, ry: 0, kod: F.UDVAR },               // a tanya udvara
  { x: 240, z: 36, w: 34, d: 22, ry: 0, kod: F.BURKOLAT },         // Kisüstfalva piactere
  { x: 254, z: -9, w: 22, d: 18, ry: 0, kod: F.BURKOLAT },         // a torony tere
  { x: -269, z: 141, w: 136, d: 88, ry: 0.01, kod: F.GAZOS },     // a major udvara: csak a talaj színe és a fű (nincs burkolat-háló)
  // a major betonja (a bírálat: „gépies rács”): nem egy 120 × 74 m-es tábla, hanem a használat nyoma — csarnokelő,
  // a kaputól bevezető betonút, a B csarnok és a silók betonja; köztük visszafoglalt gyep (major.js)
  { x: -284, z: 120, w: 62, d: 30, ry: 0.06, kod: F.BETON },       // A csarnok + csarnokelő
  { x: -254.6, z: 118.9, w: 7, d: 59, ry: -0.628, kod: F.BETON, yo: 0.065 },   // betonút a kaputól a csarnokelőig (a csarnokelő fölött: nincs z-harc)
  { x: -241, z: 166, w: 52, d: 22, ry: 0.06, kod: F.BETON },       // B csarnok + tartály
  { x: -311, z: 166, w: 40, d: 26, ry: 0.06, kod: F.BETON },       // silók + silótér
  { x: -208, z: 98, w: 9, d: 9, ry: 0.2, kod: F.BETON },           // víztorony talpa
  { x: 532, z: 272, w: 64, d: 44, ry: 0, kod: F.BURKOLAT },        // a kisváros főtere
  { x: 545, z: 248, w: 22, d: 4, ry: 0, kod: F.BURKOLAT },         // járda a cukrászda-terasz alatt (az északi házsor előtt)
  { x: 508, z: 248, w: 12, d: 4, ry: 0, kod: F.BURKOLAT },         // járda az órásbolt előtt
  { x: 548, z: 303, w: 31, d: 21, ry: 0, kod: F.BURKOLAT },        // nagypiac
  { x: 520, z: 357, w: 110, d: 14, ry: 0, kod: F.BURKOLAT },       // peron és állomás előtti tér
  { x: 563, z: 236, w: 30, d: 22, ry: 0, kod: F.BETON },           // gumis udvar
  { x: -150, z: -232, w: 22, d: 16, ry: 0.5, kod: F.UDVAR },       // a présház udvara
  { x: 520, z: 329, w: 15, d: 72, ry: 0, kod: F.BURKOLAT },        // Állomás utca járdával
  { x: 607, z: 262, w: 92, d: 15, ry: 0, kod: F.BURKOLAT },        // keleti utca járdával
  { x: 474, z: 284, w: 56, d: 15, ry: 0, kod: F.BURKOLAT },        // nyugati utca járdával
  { x: 512, z: 226, w: 15, d: 52, ry: 0.38, kod: F.BURKOLAT },     // a bevezető út a városban
];

/** A vasút: kelet–nyugati szárnyvonal a kisváros északi szélén, ütközőbakkal végződik. */
export const VASUT = { z: 384, x0: 436, x1: 760 };

/** A régiók sík (beépített) területei: itt nincs szántó és erdő. */
export const BEEPITETT = [
  { x: 0, z: 0, r: 34 }, { x: 230, z: 18, r: 105 }, { x: 230, z: -100, r: 30 }, { x: 232, z: -190, r: 88 },
  { x: -170, z: -235, r: 120 }, { x: -270, z: 140, r: 92 }, { x: 530, z: 290, r: 150 }, { x: 385, z: 16, r: 30 },
];

// determinisztikus zaj
export function hash2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise2(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z) { return noise2(x, z) * 0.5 + noise2(x * 2.1, z * 2.1) * 0.3 + noise2(x * 4.3, z * 4.3) * 0.2; }
export function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/** Parcellák: a tájat 0,12 rad-dal elforgatott sávokra osztjuk (a magyar dűlők hosszú, keskeny táblái). */
export const PARC_ANG = 0.12;
const PC = Math.cos(PARC_ANG), PS = Math.sin(PARC_ANG);
export function parcella(x, z) {
  const u = x * PC + z * PS, v = -x * PS + z * PC;
  const i = Math.floor(u / 46), h = hash2(i, 7);
  const j = Math.floor(v / 150 + h);
  const fu = u / 46 - i, fv = v / 150 + h - j;
  const edge = Math.min(fu, 1 - fu) * 46 < 1.6 || Math.min(fv, 1 - fv) * 150 < 1.6;   // mezsgye
  const t = hash2(i * 3 + 1, j * 5 + 2);
  const tipus = t < 0.3 ? F.SZANTO : t < 0.5 ? F.TARLO : t < 0.66 ? F.KUKORICA : t < 0.78 ? F.LUCERNA : t < 0.9 ? F.RET : F.ERDO;
  return { tipus, edge, i, j, u, v };
}

/** Pont–szakasz távolság (és a vetület paramétere). */
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0;
  const cx = ax + dx * t, cz = az + dz * t;
  return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
}
