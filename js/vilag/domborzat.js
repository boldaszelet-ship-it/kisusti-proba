// Kisüsti v4 — domborzat (TERV-v4 1. pont). A v0.3 lapos volt: ±3,6 m alapzaj, egy Szőlőhegy-púp, és minden
// település, minden út nullára simítva. Itt:
//  - dombvidék négy skálán (520 / 170 / 58 / 17 m), torzított (domain warp) zajjal, ÉNy felé emelkedő tájjal;
//  - a Szőlőhegy és az ÉNy felé futó gerince (a tanyáról is látszik);
//  - széles folyóvölgy sík ártérrel és töltéssel mindkét parton;
//  - a települések nem nullára, hanem a táj sima rétegére simulnak (enyhe lejtőn állnak, a házak lábazata látszik);
//  - az utak saját hossz-szelvényt kapnak (simítás + lejtéskorlát: Fő út 6%, régi út 7%, földút 8%, vasút 1,2%),
//    a keresztszelvényben bevágással és töltéssel (rézsű); a földutak a lejtőn horhosba vágódnak.
// Az eredmény egy 2 m-es raszter (a terephálóval egy rácson), ezen kívül az analitikus alapdomborzat.
// Determinisztikus: ugyanaz a bemenet ugyanazt a felszínt adja (a sim és a coop-vendég is ezt látja).
import { RIVER, NODES } from '../../data/regions.js';
import { SZAKASZOK_MIND, VASUT, noise2, segDist } from './adat.js';

const HC = [-170, -250];                       // a Szőlőhegy csúcsa (a szőlősorok szintvonalainak középpontja)
const GERINC = [-370, -480];                   // a gerinc ÉNy-i vége (a játéktéren túl)
const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const n = (x, z) => noise2(x, z) * 2 - 1;
const trap = (d, a, b, c, e) => d <= a || d >= e ? 0 : d < b ? sm((d - a) / (b - a)) : d <= c ? 1 : 1 - sm((d - c) / (e - c));

/** A domborzat rétegei egy pontban. */
function retegek(x, z) {
  const wx = x + 55 * n(x / 310 + 11.3, z / 310 - 4.1), wz = z + 55 * n(x / 310 - 7.9, z / 310 + 2.6);
  const L0 = 7 * n(wx / 520 + 3.1, wz / 520 - 7.7) + 3 * n(wx / 260 + 1.7, wz / 260 + 9.2);
  const L1 = 6 * n(wx / 170 + 5.3, wz / 170 + 1.9);
  const L2 = 2.1 * n(wx / 58 - 2.2, wz / 58 + 6.4);
  const L3 = 0.5 * n(x / 17 + 0.7, z / 17 - 3.3);
  // Szőlőhegy: kerek kúp a csúcs körül, és az ÉNy-i gerinc (a csúcstól távolodva magasodik)
  const rh2 = (x - HC[0]) ** 2 + (z - HC[1]) ** 2;
  const g = segDist(x, z, HC[0], HC[1], GERINC[0], GERINC[1]);
  const hegy = 15 * Math.exp(-rh2 / (2 * 112 ** 2)) + 30 * sm(g.t * 1.45) * Math.exp(-(g.d ** 2) / (2 * 112 ** 2));
  // táji dőlés: ÉNy-on magasabb, a folyó és dél felé lejt
  const dolt = -0.0065 * x - 0.0075 * z;
  // folyóvölgy: széles, a közepén sík ártér; töltés mindkét parton
  const dx = Math.abs(x - RIVER.x);
  const arter = sm((dx - 45) / 140);
  const volgy = -8.5 * Math.exp(-(dx * dx) / (2 * 78 ** 2));
  const toltes = 3.2 * trap(dx, 35, 43, 47, 56);
  return { L0, L1, L2, L3, hegy, dolt, arter, volgy, toltes };
}
/** A sima réteg: erre simulnak a települések (enyhe lejtő, de nem sík lap). */
function simaRet(r) { return r.dolt + r.L0 + r.hegy + r.volgy + r.arter * (0.28 * r.L1 + 0.12 * r.L2); }
/** A nullszint a tanyaudvar: a tanya.js és a játékmenet az udvart y = 0-n építi, ezért az egész táj ehhez tolódik,
 *  a tanya belső köre pedig vízszintes (nem a sima réteg lejtőjén áll). */
const NULLA = simaRet(retegek(0, 0));
/** Az alapdomborzat (települések és utak nélkül). */
export function alapMagassag(x, z) {
  const r = retegek(x, z);
  return r.dolt + r.L0 + r.hegy + r.volgy + r.toltes + r.arter * (r.L1 + r.L2 + r.L3) - NULLA;
}

/** Települések: [x, z, belső sugár (teljesen a sima rétegen), külső sugár (ott már a táj)]. */
const TELEPULESEK = [
  [0, 0, 24, 62], [230, 18, 82, 132], [230, -100, 18, 42], [232, -190, 66, 106],
  [-270, 140, 70, 116], [530, 290, 118, 176],
];
function telepules(x, z) {
  let k = 0, tanya = 0;
  for (const [cx, cz, r0, r1] of TELEPULESEK) {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r1) { const v = 1 - sm((d - r0) / (r1 - r0)); k = Math.max(k, v); if (!cx && !cz) tanya = v; }
  }
  return [k, tanya];
}
/** A táj a települések simításával, utak nélkül. */
function tajMagassag(x, z) {
  const r = retegek(x, z), a = r.dolt + r.L0 + r.hegy + r.volgy + r.toltes + r.arter * (r.L1 + r.L2 + r.L3) - NULLA;
  const [k, tanya] = telepules(x, z);
  if (!(k > 0)) return a;
  const cel = (simaRet(r) - NULLA) * (1 - tanya);   // a tanyán a cél a vízszintes 0
  return a + (cel - a) * k;
}

// ---------------------------------------------------------------- folyó: vízszint (a meder a terep.js-ben)
const WL_Z0 = -1600, WL_STEP = 4, WL_N = 801;
const WL = new Float32Array(WL_N);
{
  const raw = new Float32Array(WL_N);
  for (let i = 0; i < WL_N; i++) { const z = WL_Z0 + i * WL_STEP; raw[i] = Math.min(alapMagassag(RIVER.x - 15, z), alapMagassag(RIVER.x + 15, z), alapMagassag(RIVER.x, z)); }
  const mn = new Float32Array(WL_N), R = 12;
  for (let i = 0; i < WL_N; i++) { let m = 1e9; for (let k = -R; k <= R; k++) m = Math.min(m, raw[Math.max(0, Math.min(WL_N - 1, i + k))]); mn[i] = m; }
  for (let i = 0; i < WL_N; i++) { let s = 0; for (let k = -R; k <= R; k++) s += mn[Math.max(0, Math.min(WL_N - 1, i + k))]; WL[i] = s / (2 * R + 1) - 1.1; }
}
/** A folyó vízszintje a z helyen. */
export function vizszint(z) {
  const f = (z - WL_Z0) / WL_STEP, i = Math.max(0, Math.min(WL_N - 2, Math.floor(f))), t = Math.max(0, Math.min(1, f - i));
  return WL[i] * (1 - t) + WL[i + 1] * t;
}

// ---------------------------------------------------------------- utak: csomópont-magasság és hossz-szelvény
const LEJTES = { fo: 0.06, regi: 0.07, fold: 0.08, vasut: 0.012 };
const PADKA = { fo: 1.2, regi: 1.0, fold: 0.6, vasut: 1.6 };
const HID_FOLOTT = 4.6;   // a híd hídfőinek magassága a víz fölött

/** Csomópont-magasságok: a táj, aztán lejtéskorlát a gráfon (a Fő út csomópontjai nehezen mozdulnak). */
const NODE_H = {};
{
  const fo = new Set();
  for (const S of SZAKASZOK_MIND) if (S.a && S.tipus === 'fo') { fo.add(S.a); fo.add(S.b); }
  const mob = {};
  for (const k of Object.keys(NODES)) { NODE_H[k] = tajMagassag(NODES[k][0], NODES[k][1]); mob[k] = fo.has(k) ? 0.2 : 1; }
  for (const k of ['hid_ny', 'hid_k']) { NODE_H[k] = Math.max(NODE_H[k], vizszint(NODES[k][1]) + HID_FOLOTT); mob[k] = 0; }
  const el = SZAKASZOK_MIND.filter(S => S.a);
  for (let it = 0; it < 300; it++) {
    let rossz = 0;
    for (const S of el) {
      const L = Math.hypot(S.bx - S.ax, S.bz - S.az), g = LEJTES[S.tipus] * L * 0.97;
      const ha = NODE_H[S.a], hb = NODE_H[S.b], ex = Math.abs(ha - hb) - g;
      if (ex <= 0) continue;
      rossz++;
      const [hi, lo] = ha > hb ? [S.a, S.b] : [S.b, S.a], m = mob[hi] + mob[lo];
      if (!m) continue;
      NODE_H[hi] -= ex * mob[hi] / m; NODE_H[lo] += ex * mob[lo] / m;
    }
    if (!rossz) break;
  }
}
/** A vasút és az utak szakaszai egy listában (a vasút csak a domborzatnak „út”). */
const SZELVENY = [
  ...SZAKASZOK_MIND.map(S => ({ ...S })),
  { a: null, b: null, ax: VASUT.x0 - 6, az: VASUT.z, bx: VASUT.x1 + 20, bz: VASUT.z, tipus: 'vasut', w: 4.2 },
];
function csomopontNal(x, z) {
  for (const k of Object.keys(NODES)) if (Math.hypot(NODES[k][0] - x, NODES[k][1] - z) < 4) return k;
  return null;
}
for (const S of SZELVENY) {
  const L = Math.hypot(S.bx - S.ax, S.bz - S.az), N = Math.max(2, Math.ceil(L / 2) + 1);
  const T = new Float32Array(N), p = new Float32Array(N);
  for (let i = 0; i < N; i++) { const u = i / (N - 1); T[i] = tajMagassag(S.ax + (S.bx - S.ax) * u, S.az + (S.bz - S.az) * u); }
  // simítás (két menet, ±13 minta = ±26 m; a vasútnál ±40 minta)
  const R = S.tipus === 'vasut' ? 40 : 13;
  p.set(T);
  for (let m = 0; m < 2; m++) {
    const q = p.slice();
    for (let i = 0; i < N; i++) { let s = 0, c = 0; for (let k = -R; k <= R; k++) { const j = i + k; if (j >= 0 && j < N) { s += q[j]; c++; } } p[i] = s / c; }
  }
  // végpontok: csomópontnál a csomópont magassága; a korrekció lineárisan oszlik el a szakaszon
  const ka = S.a || csomopontNal(S.ax, S.az), kb = S.b || csomopontNal(S.bx, S.bz);
  const pa = ka ? NODE_H[ka] : p[0], pb = kb ? NODE_H[kb] : p[N - 1];
  const da = pa - p[0], db = pb - p[N - 1];
  for (let i = 0; i < N; i++) { const u = i / (N - 1); p[i] += da * (1 - u) + db * u; }
  // a híd pályája egyenes a két hídfő között
  if ((S.a === 'hid_ny' && S.b === 'hid_k') || (S.a === 'hid_k' && S.b === 'hid_ny')) for (let i = 0; i < N; i++) p[i] = pa + (pb - pa) * i / (N - 1);
  // horhos: a földút a lejtőn bevágódik (a lösz falai közé), a két végén kifut
  if (S.tipus === 'fold') {
    for (let i = 0; i < N; i++) {
      const j0 = Math.max(0, i - 6), j1 = Math.min(N - 1, i + 6);
      const lejto = Math.abs(T[j1] - T[j0]) / ((j1 - j0) * L / (N - 1) || 1);
      const veg = sm(Math.min(i, N - 1 - i) * (L / (N - 1)) / 30);
      p[i] -= 2.8 * sm((lejto - 0.025) / 0.05) * veg;
    }
  }
  // lejtéskorlát (előre és vissza, a végek rögzítve)
  const gd = LEJTES[S.tipus] * L / (N - 1);
  for (let m = 0; m < 4; m++) {
    for (let i = 1; i < N - 1; i++) p[i] = Math.min(p[i - 1] + gd, Math.max(p[i - 1] - gd, p[i]));
    for (let i = N - 2; i > 0; i--) p[i] = Math.min(p[i + 1] + gd, Math.max(p[i + 1] - gd, p[i]));
  }
  S.L = L; S.N = N; S.p = p;
}
/** A híd pályaszintje (a terep.js HID.y-ja ebből jön). */
export const HID_Y = (NODE_H.hid_ny + NODE_H.hid_k) / 2 + 0.42;

// ---------------------------------------------------------------- raszter (2 m, a terephálóval egy rácson)
export const RASZTER = { x0: -560, z0: -560, x1: 816, z1: 560, step: 2 };
const NX = (RASZTER.x1 - RASZTER.x0) / RASZTER.step + 1, NZ = (RASZTER.z1 - RASZTER.z0) / RASZTER.step + 1;
const H = new Float32Array(NX * NZ);
/** Út-súly a rácspontban (0: nincs út, 1: az út burkolata/padkája) — a talaj színezéséhez és a mérésekhez. */
const W = new Float32Array(NX * NZ);
{
  const st = RASZTER.step;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = tajMagassag(RASZTER.x0 + i * st, RASZTER.z0 + j * st);
  const T = H.slice(), HR = new Float32Array(NX * NZ);
  for (const S of SZELVENY) {
    const hw = S.w / 2 + PADKA[S.tipus], horhos = S.tipus === 'fold', M = hw + 42;
    const i0 = Math.max(0, Math.floor((Math.min(S.ax, S.bx) - M - RASZTER.x0) / st)), i1 = Math.min(NX - 1, Math.ceil((Math.max(S.ax, S.bx) + M - RASZTER.x0) / st));
    const j0 = Math.max(0, Math.floor((Math.min(S.az, S.bz) - M - RASZTER.z0) / st)), j1 = Math.min(NZ - 1, Math.ceil((Math.max(S.az, S.bz) + M - RASZTER.z0) / st));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = RASZTER.x0 + i * st, z = RASZTER.z0 + j * st, sd = segDist(x, z, S.ax, S.az, S.bx, S.bz);
      if (sd.d > M) continue;
      const f = sd.t * (S.N - 1), k = Math.min(S.N - 2, Math.floor(f)), pp = S.p[k] + (S.p[k + 1] - S.p[k]) * (f - k);
      const o = j * NX + i, diff = T[o] - pp;
      // rézsű: bevágásnál 1:1,4 (horhosban 1:0,7, meredek löszfal), töltésnél 1:2
      const Wb = 1.2 + Math.abs(diff) * (diff > 0 ? (horhos ? 0.7 : 1.4) : 2.0);
      const s = sm((sd.d - hw) / Wb), w = 1 - s;
      if (w > W[o]) { W[o] = w; HR[o] = pp + diff * s; }
    }
  }
  for (let o = 0; o < H.length; o++) if (W[o] > 0) H[o] = HR[o];
}

/** A domborzat magassága (a meder és a híd nélkül — azokat a terep.js teszi rá). */
export function domborzat(x, z) {
  const fx = (x - RASZTER.x0) / RASZTER.step, fz = (z - RASZTER.z0) / RASZTER.step;
  if (fx < 0 || fz < 0 || fx >= NX - 1 || fz >= NZ - 1) return alapMagassag(x, z);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, o = j * NX + i;
  return (H[o] * (1 - u) + H[o + 1] * u) * (1 - v) + (H[o + NX] * (1 - u) + H[o + NX + 1] * u) * v;
}
/** Út-súly (0..1) a ponton. */
export function utSuly(x, z) {
  const i = Math.round((x - RASZTER.x0) / RASZTER.step), j = Math.round((z - RASZTER.z0) / RASZTER.step);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return 0;
  return W[j * NX + i];
}
/** Mérés: a raszter (magasságtérkép-képhez) és a szelvények legnagyobb lejtése. */
export function domborzatMeres() {
  let mn = 1e9, mx = -1e9;
  for (let o = 0; o < H.length; o++) { if (H[o] < mn) mn = H[o]; if (H[o] > mx) mx = H[o]; }
  const lejtes = SZELVENY.map(S => {
    let g = 0; for (let i = 1; i < S.N; i++) g = Math.max(g, Math.abs(S.p[i] - S.p[i - 1]) / (S.L / (S.N - 1)));
    return { ut: (S.a || '') + '–' + (S.b || ''), tipus: S.tipus, max: +g.toFixed(4), keret: LEJTES[S.tipus] };
  });
  return { min: mn, max: mx, tartomany: mx - mn, NX, NZ, H, lejtes, csomopont: { ...NODE_H }, hidY: HID_Y };
}
