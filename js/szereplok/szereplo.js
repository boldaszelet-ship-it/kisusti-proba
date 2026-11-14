// Kisüsti — figuragyár: valós arányú, stilizált low-poly emberek a Quaternius Ultimate Modular Men/Women (CC0)
// ruharészeiből, a Universal Animation Library (CC0) átvitt mozdulataival és saját mozdulatokkal (atvitel.js).
//
//   await szereplokBetolt();                       // egyszer, a játék betöltésekor (ferfi.glb, no.glb, anim_*.json)
//   const sz = szereplo('kovacs');                 // tartalom-id (kiosztas.js) …
//   const sz = szereplo({ nem: 'f', kor: 'idos', alkat: 'testes', ruha: 'kantaros', haj: 'oldalt', bajusz: 'konya',
//                         kalap: 'svajci', szemuveg: true, szinek: { felso: 0x8a6a4a } });
//   scene.add(sz.obj); sz.anim('setal'); sz.update(dt); sz.nez(kamera.position); sz.fog(kupica(), 'R');
//
// Egy figura = egy bőrözött háló (a részek és a kiegészítők összevarrva, csúcsszínnel), egy közös anyag minden
// figurára → figuránként 1 rajzhívás (+1 árnyék). Távolabb ritkább animáció-frissítés (Szereplo.kamera).
// Régi API-val is megy: obj.userData.anim(név) és obj.userData.mixer.update(dt) (a Kenney-figurák helyére).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RESZ, RUHAK, HAJAK, ALKAT, BOR, HAJSZIN } from './katalogus.js';
import * as KI from './kiegeszitok.js';
import { KIOSZTAS } from './kiosztas.js';

const BASE = new URL('../../models/szereplok/', import.meta.url).href;
const SABLON = {};
const GEO_CACHE = new Map();
/** A fejkendő a női „Medieval” fej csuklyájából készül: a csuklya kendőszínt kap, a szegélye a második kendőszínt. */
const KENDO_FEJ = 'Medieval_Head', KENDO_SZEREP = { DarkBrown: 'kendo', Black: 'kendo2', White: 'haj', Skin: 'bor', Brown: 'szem+' };
const szerepe = (S, resz, mat, kendo) => (kendo && resz === KENDO_FEJ ? KENDO_SZEREP : (RESZ[S.nem][resz] || {}))[mat];

/** A közös anyag: csúcsszín, lapos árnyalás (a csomag stílusa), Lambert — mint a világ többi része. */
export const ANYAG = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
ANYAG.name = 'szereplo';

/** Régi/angol animációnevek → a csomag nevei. */
const ALIAS = { idle: 'all', walk: 'setal', run: 'fut', jump: 'orul', sit: 'ul', wave: 'integet', talk: 'beszel', drink: 'iszik', give: 'atad', scared: 'ijedt', scold: 'szid', cheer: 'orul',
  // a data/tortenet.js Kenney-klipnevei
  'holding-right': 'atad', 'interact-right': 'atad', 'pick-up': 'atad', 'emote-yes': 'orul', 'emote-no': 'szid' };
const KAR = /Arm|Wrist|Index|Middle|Ring|Pinky|Thumb/;

// ------------------------------------------------------------------ betöltés
export async function szereplokBetolt(nemek = ['f', 'n']) {
  await Promise.all(nemek.map(async nem => {
    if (SABLON[nem]) return;
    const fajl = nem === 'f' ? 'ferfi' : 'no';
    const [g, a] = await Promise.all([
      new GLTFLoader().loadAsync(BASE + fajl + '.glb'),
      fetch(BASE + 'anim_' + fajl + '.json').then(r => r.json()),
    ]);
    SABLON[nem] = sablon(nem, g, a);
  }));
  return SABLON;
}
export const betoltve = () => !!(SABLON.f && SABLON.n);

function sablon(nem, g, a) {
  g.scene.updateMatrixWorld(true);
  // a glTF-csomópontok alapállása nem a kötési póz → a csontvázat a kötési mátrixokból állítjuk vissza
  { let sk = null; g.scene.traverse(o => { if (o.isSkinnedMesh && !sk) sk = o.skeleton; }); sk.pose(); g.scene.updateMatrixWorld(true); }
  const reszek = {}; let elso = null;
  g.scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    elso ||= o;
    const p = o.parent;
    const nev = p && !p.isBone && !p.name.startsWith('Character') && p.name.includes('_') ? p.name : o.name;
    (reszek[nev] ||= []).push(kanonikus(o.geometry, o.material.name, o.material.color));
  });
  const skel = elso.skeleton;
  const csontok = skel.bones.map(b => b.name);
  const idx = Object.fromEntries(csontok.map((n, i) => [n, i]));
  const arm = elso.parent.name.startsWith('Character') ? elso.parent : elso.parent.parent;
  // bind: háló-lokális → kötési világtér (méter); a GLTFLoader egységmátrixszal köt, a hálók az armatúra alatt ülnek
  const bind = arm.matrixWorld.clone(), bindInv = bind.clone().invert(), kotes = elso.bindMatrix.clone();
  // nyugalmi világmátrixok és -forgatások (a kiegészítők és a tengelyek számításához)
  const nyug = {}; for (const b of skel.bones) nyug[b.name] = { m: b.matrixWorld.clone(), q: b.getWorldQuaternion(new THREE.Quaternion()), p: b.getWorldPosition(new THREE.Vector3()), s: b.getWorldScale(new THREE.Vector3()).x };
  const klipek = {}, egyszeri = new Set();
  for (const j of a.klipek) { const c = THREE.AnimationClip.parse(j); klipek[c.name] = c; if (!j.loop) egyszeri.add(c.name); }
  // a csontok saját terében kifejezett „figura-tengelyek” (jobbra = −X… a figura +Z felé néz, a bal keze +X)
  const tengely = {};
  for (const n of ['Chest', 'Torso', 'Neck', 'Head', 'Abdomen']) {
    const qi = nyug[n].q.clone().invert();
    tengely[n] = { x: new THREE.Vector3(1, 0, 0).applyQuaternion(qi), y: new THREE.Vector3(0, 1, 0).applyQuaternion(qi) };
  }
  return { nem, g, reszek, skel, csontok, idx, arm, bind, bindInv, kotes, nyug, klipek, egyszeri, tengely, meta: a.meta, karIdx: new Set(csontok.filter(n => KAR.test(n)).map(n => idx[n])) };
}

/** Egységes attribútumok (position Float32, skinIndex Uint16, skinWeight Float32) — így összevarrhatók. */
function kanonikus(geo, mat, szin) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(geo.attributes.position.array), 3));
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const I = new Uint16Array(si.count * 4), W = new Float32Array(sw.count * 4);
  for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) { I[i * 4 + k] = si.getComponent(i, k); W[i * 4 + k] = sw.getComponent(i, k); }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(I, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
  g.setIndex(Array.from(geo.index.array));
  return { geo: g, mat, szin: szin.clone() };
}

// ------------------------------------------------------------------ leírás → teljes spec
function rnd(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const valaszt = (R, t) => t[Math.floor(R() * t.length)];

/** Teljes leírás: hiányzó mezők a nemből/korból, determinisztikusan (seed). */
export function teljesSpec(be) {
  const s = typeof be === 'string' ? (KIOSZTAS[be] || { seed: hash(be) }) : { ...be };
  const R = rnd(s.seed ?? hash(JSON.stringify(be)));
  s.nem ||= R() < 0.5 ? 'f' : 'n';
  s.kor ||= valaszt(R, ['fiatal', 'kozep', 'kozep', 'idos']);
  s.alkat ||= valaszt(R, s.kor === 'fiatal' ? ['vekony', 'atlag', 'atlag'] : ['atlag', 'testes', 'atlag', 'pocakos']);
  const ruhak = Object.keys(RUHAK[s.nem]), hajak = Object.keys(HAJAK[s.nem]);
  s.ruha ||= valaszt(R, ruhak.filter(r => r !== 'egyenruha'));
  s.haj ||= s.kor === 'idos' ? (s.nem === 'f' ? valaszt(R, ['oldalt', 'rovid', 'osz_szakall', 'bajszos']) : valaszt(R, ['konty', 'osz_hosszu', 'konty'])) : valaszt(R, hajak.filter(h => !['osz_szakall', 'osz_hosszu'].includes(h)));
  s.szinek = { ...(s.szinek || {}) };
  s.szinek.bor ??= valaszt(R, BOR);
  s.szinek.haj ??= s.kor === 'idos' ? valaszt(R, [HAJSZIN.osz, HAJSZIN.feher, HAJSZIN.oszes]) : s.kor === 'kozep' ? valaszt(R, [HAJSZIN.barna, HAJSZIN.fekete, HAJSZIN.oszes, HAJSZIN.gesztenye]) : valaszt(R, [HAJSZIN.barna, HAJSZIN.fekete, HAJSZIN.szoke, HAJSZIN.gesztenye, HAJSZIN.voros]);
  s.magassag ??= (s.nem === 'f' ? 1.0 : 0.97) * (0.96 + R() * 0.07) * (s.kor === 'idos' ? 0.975 : 1);
  return s;
}

// ------------------------------------------------------------------ geometria-összerakás
const V3 = () => new THREE.Vector3();
function fejHorgony(S, fejResz, kendo = false) {
  const v = V3(), szem = [], bor = [], minden = [], borTri = [];
  for (const p of S.reszek[fejResz]) {
    const szerep = szerepe(S, fejResz, p.mat, kendo);
    if (szerep === '-' || szerep === 'kendo' || szerep === 'kendo2') continue;
    const pos = p.geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(S.bind);
      minden.push(v.clone());
      if (szerep === 'szem' || szerep === 'szem+') szem.push(v.clone());
      if (szerep === 'bor') bor.push(v.clone());
    }
    if (szerep === 'bor') {
      const ix = p.geo.index.array, w = i => V3().fromBufferAttribute(pos, i).applyMatrix4(S.bind);
      for (let t = 0; t < ix.length; t += 3) borTri.push([w(ix[t]), w(ix[t + 1]), w(ix[t + 2])]);
    }
  }
  // 'szem+' = szem és szemöldök egy anyagban: az alsó harmad a szem
  let sz = szem;
  if (szem.length) { const ys = szem.map(p => p.y).sort((a, b) => a - b); const lim = ys[0] + (ys[ys.length - 1] - ys[0]) * 0.45; sz = szem.filter(p => p.y <= lim); }
  const szemY = sz.reduce((a, p) => a + p.y, 0) / sz.length;
  const szemZ = Math.max(...sz.map(p => p.z));
  const szemX = sz.reduce((a, p) => a + Math.abs(p.x), 0) / sz.length;
  const arc = bor.filter(p => p.y < szemY && p.y > szemY - 0.07);
  const orr = arc.reduce((a, p) => p.z > a.z ? p : a, arc[0]);
  const fejSzint = bor.filter(p => Math.abs(p.y - szemY) < 0.02);
  const fejX = Math.max(...fejSzint.map(p => Math.abs(p.x)));
  const head = S.nyug.Head.p;
  const tetoY = Math.max(...minden.filter(p => Math.abs(p.x) < 0.05).map(p => p.y));
  const allY = Math.min(...bor.filter(p => p.z > head.z + 0.02 && p.y > head.y - 0.06).map(p => p.y));
  const hatZ = Math.min(...bor.filter(p => Math.abs(p.y - szemY) < 0.03).map(p => p.z));
  // a fej (haj + koponya) befoglaló doboza az áll fölött: a fejkendő ehhez méretez (a konty is alá fér)
  const fej = bor.filter(p => p.y > allY + 0.01);     // a koponya (bőr) — a kendő a haj nélküli fejre simul
  const bmin = new THREE.Vector3(Infinity, Infinity, Infinity), bmax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of fej) { bmin.min(p); bmax.max(p); }
  return { szemY, szemZ, szemX, orrY: orr.y, orrZ: orr.z, tetoY, fejX, kozepZ: (szemZ + hatZ) / 2, hatZ, allY, bmin, bmax, bor, borTri };
}

/** Testalkat: a törzs és a csípő kidomborítása kötési világtérben (a has elöl jobban). */
function alkatTorzit(S, geo, alkat) {
  const A = ALKAT[alkat] || ALKAT.atlag;
  if (!A.has && !A.csipo && !A.torzs) return;
  const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const torzs = new Set(['Hips', 'Abdomen', 'Torso', 'Chest'].map(n => S.idx[n]));
  const csipo = S.idx.Hips, has = S.nyug.Abdomen.p, cz = has.z, v = V3();
  const hasY = has.y + 0.03, csipoY = S.nyug.Hips.p.y - 0.06, mellY = S.nyug.Chest.p.y;
  for (let i = 0; i < pos.count; i++) {
    // a súly a helyzetből jön (nem a csontsúlyokból), így az ing és a nadrág együtt domborodik; a karok kimaradnak
    let kar = 0, fej = 0;
    for (let k = 0; k < 4; k++) { const bi = si.getComponent(i, k), w = sw.getComponent(i, k); if (S.karIdx.has(bi)) kar += w; if (bi === S.idx.Head || bi === S.idx.Neck) fej += w; }
    const wt = 1 - Math.min(1, kar + fej);
    if (wt <= 0.02) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(S.bind);
    const dx = v.x, dz = v.z - cz, r = Math.hypot(dx, dz) || 1;
    if (r > 0.28) continue;
    const elol = Math.max(0, dz / r);
    const bHas = Math.exp(-((v.y - hasY) ** 2) / (2 * 0.15 ** 2));
    const bCsipo = Math.exp(-((v.y - csipoY) ** 2) / (2 * 0.09 ** 2));
    // a törzs egésze (mellkastól a csípőig) is szélesedik — a sziluettben ez látszik elölről is
    const bTorzs = THREE.MathUtils.smoothstep(v.y, csipoY - 0.12, csipoY + 0.05) * (1 - THREE.MathUtils.smoothstep(v.y, mellY - 0.02, mellY + 0.14));
    const d = wt * (A.has * bHas * (0.15 + 1.15 * elol) + A.csipo * bCsipo * (0.8 + 0.2 * (1 - elol)) + A.torzs * bTorzs);
    v.x += dx / r * d * 1.0; v.z += dz / r * d;
    v.applyMatrix4(S.bindInv);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
}

/** Héj: a forrásháló kiválasztott háromszögei kifelé tolva (mellény, kötény, fejkendő). */
function hej(S, darabok, felt, eltol, szerep) {
  const P = [], I = [], W = [], idx = [];
  const v = V3();
  for (const d of darabok) {
    const pos = d.geo.attributes.position, ix = d.geo.index.array;
    const wp = []; for (let i = 0; i < pos.count; i++) wp.push(v.fromBufferAttribute(pos, i).applyMatrix4(S.bind).clone());
    const map = new Map();
    for (let t = 0; t < ix.length; t += 3) {
      const a = wp[ix[t]], b = wp[ix[t + 1]], c = wp[ix[t + 2]];
      const cen = V3().add(a).add(b).add(c).multiplyScalar(1 / 3);
      const n = V3().subVectors(b, a).cross(V3().subVectors(c, a)).normalize();
      if (!felt(cen, n, [ix[t], ix[t + 1], ix[t + 2]], d)) continue;
      for (let k = 0; k < 3; k++) {
        const o = ix[t + k];
        if (!map.has(o)) {
          map.set(o, P.length / 3);
          P.push(wp[o].x, wp[o].y, wp[o].z);
          for (let q = 0; q < 4; q++) { I.push(d.geo.attributes.skinIndex.getComponent(o, q)); W.push(d.geo.attributes.skinWeight.getComponent(o, q)); }
        }
        idx.push(map.get(o));
      }
    }
  }
  if (!idx.length) return null;
  // csúcsnormálok (simított) és eltolás kifelé
  const N = new Float32Array(P.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map(k => new THREE.Vector3(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]));
    const n = V3().subVectors(b, a).cross(V3().subVectors(c, a));
    for (const k of [idx[t], idx[t + 1], idx[t + 2]]) { N[k * 3] += n.x; N[k * 3 + 1] += n.y; N[k * 3 + 2] += n.z; }
  }
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const n = new THREE.Vector3(N[i], N[i + 1], N[i + 2]).normalize();
    const e = typeof eltol === 'function' ? eltol(P[i], P[i + 1], P[i + 2], n) : eltol;
    v.set(P[i] + n.x * e, P[i + 1] + n.y * e, P[i + 2] + n.z * e).applyMatrix4(S.bindInv);
    out[i] = v.x; out[i + 1] = v.y; out[i + 2] = v.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(I), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(W), 4));
  g.setIndex(idx);
  return { geo: g, szerep };
}

/** Merev darab (kötési világtér) → bőrözött geometria a megadott csonton. */
function merev(S, d, csontIdx) {
  const g = d.geo.clone();
  g.applyMatrix4(S.bindInv);
  const n = g.attributes.position.count;
  const I = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { I[i * 4] = csontIdx; W[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(I, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
  if (!g.index) g.setIndex([...Array(n).keys()]);
  return { geo: g, szerep: d.szerep };
}

const C = new THREE.Color();
function szinez(S, item, paletta, y0) {
  const g = item.geo, n = g.attributes.position.count, col = new Float32Array(n * 3), v = V3();
  const alap = paletta[item.szerep];
  if (alap !== undefined) C.setHex(alap); else C.copy(item.szin || new THREE.Color(0.5, 0.5, 0.5));
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(S.bind);
    // olcsó „talaj-takarás”: a láb felé enyhén sötétebb, a fej felé világosabb
    const k = 0.8 + 0.2 * THREE.MathUtils.smoothstep(v.y, 0.0, 1.5);
    col[i * 3] = C.r * k; col[i * 3 + 1] = C.g * k; col[i * 3 + 2] = C.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function paletta(s, ruha) {
  const p = { szem: 0x22160f, szemfeher: 0xf4efe6, kendo2: null, szemoldok: s.szinek.haj, bajusz: s.szinek.haj, szemuveg: 0x2a2622, kalap: 0x2f2a26, kalap2: 0x1c1916, kendo: 0x8a2f3a, ...ruha.szin, ...s.szinek };
  if (p.szemoldok === undefined || s.szinek.szemoldok === undefined) p.szemoldok = sotetit(s.szinek.haj, s.kor === 'idos' ? 0.85 : 0.75);
  if (s.szinek.bajusz === undefined) p.bajusz = sotetit(s.szinek.haj, 0.92);
  p.kendo2 = vilagosit(p.kendo, 0.16);
  return p;
}
function vilagosit(hex, k) { const c = new THREE.Color(hex).lerp(new THREE.Color(0xf0e8d8), k); return c.getHex(); }
function sotetit(hex, k) { const c = new THREE.Color(hex); return (Math.round(c.r * 255 * k) << 16) | (Math.round(c.g * 255 * k) << 8) | Math.round(c.b * 255 * k); }

/** A bőrfelület z-je (előre) az (x, y) pontban: a legelső háromszög, amelyen a függőleges egyenes átmegy. */
function feluletZ(A, x, y) {
  let best = -Infinity;
  for (const [a, b, c] of A.borTri) {
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y); if (Math.abs(d) < 1e-12) continue;
    const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d, l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    const z = l1 * a.z + l2 * b.z + l3 * c.z; if (z > best) best = z;
  }
  return best;
}
/** Szem: a csomag ék alakú szemfoltja helyett saját fehér mandula + sötét írisz (olvasható közelről és félhomályban
 *  is). A méret a fejszélességből jön, a mélység a szemgödör előtti bőrből (különben a szemhéj eltakarja). */
function szemJavit(S, geo, A) {
  const pos = geo.attributes.position, v = V3(), oldal = { 1: [], [-1]: [] };
  for (const i of new Set(geo.index.array)) { v.fromBufferAttribute(pos, i).applyMatrix4(S.bind); oldal[v.x >= 0 ? 1 : -1].push(v.clone()); }
  geo.setIndex([]);                                       // az eredeti szemfolt kimarad
  const feher = [], irisz = [];
  const rx = A.fejX * 0.17, ry = rx * 0.6, ri = ry * 0.92;
  const korong = (out, cx, cy, z, ax, ay, n, ferde = 0) => {
    const p = []; for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t); p.push([cx + ca * ax, cy + sa * ay * (sa > 0 ? 1 : 0.82) + ca * ferde, z]); }
    for (let k = 0; k < n; k++) { const q = p[k], r = p[(k + 1) % n]; out.push(cx, cy, z, ...q, ...r); }
  };
  for (const sx of [1, -1]) {
    const L = oldal[sx]; if (!L.length) continue;
    const c = V3(); for (const p of L) c.add(p); c.multiplyScalar(1 / L.length);
    c.x = sx * Math.max(Math.abs(c.x), A.fejX * 0.36);
    korong(feher, c.x, c.y, 0.0009, rx, ry, 14, -sx * 0.0012);          // a külső szemzug kissé lejjebb
    korong(irisz, c.x - sx * rx * 0.08, c.y - ry * 0.05, 0.0019, ri * 0.74, ri * 0.9, 10);
  }
  // a korongok a bőrfelületre simulnak: minden csúcs z-je = a felület + kis eltolás (a „z” mező eddig csak az eltolás)
  const ra = arr => { for (let i = 0; i < arr.length; i += 3) { const z = feluletZ(A, arr[i], arr[i + 1]); arr[i + 2] = (isFinite(z) ? z : A.szemZ) + arr[i + 2]; } return arr; };
  const g = arr => { const x = new THREE.BufferGeometry(); x.setAttribute('position', new THREE.Float32BufferAttribute(ra(arr), 3)); return x; };
  return [{ geo: g(feher), szerep: 'szemfeher' }, { geo: g(irisz), szerep: 'szem' }];
}
/** Szemöldök: a csomag „mérges” ferde szemöldökét semlegesre billentjük (a belső vég feljebb). */
function szemoldokJavit(S, geo, fok = 11) {
  const pos = geo.attributes.position, v = V3(), oldal = { 1: [], [-1]: [] };
  for (const i of new Set(geo.index.array)) { v.fromBufferAttribute(pos, i).applyMatrix4(S.bind); oldal[v.x >= 0 ? 1 : -1].push([i, v.clone()]); }
  for (const sx of [1, -1]) {
    const L = oldal[sx]; if (!L.length) continue;
    const c = V3(); for (const [, p] of L) c.add(p); c.multiplyScalar(1 / L.length);
    const a = THREE.MathUtils.degToRad(fok) * (sx > 0 ? -1 : 1), ca = Math.cos(a), sa = Math.sin(a);
    for (const [i, p] of L) {
      const dx = p.x - c.x, dy = p.y - c.y;
      p.x = c.x + dx * ca - dy * sa; p.y = c.y + dx * sa + dy * ca;
      p.applyMatrix4(S.bindInv); pos.setXYZ(i, p.x, p.y, p.z);
    }
  }
}

/** A figura geometriája (gyorsítótárazva: azonos leírású figurák ugyanazt a geometriát kapják). */
function osszerak(S, s) {
  const key = JSON.stringify([s.nem, s.alkat, s.ruha, s.haj, s.bajusz, s.kalap, s.szemuveg, s.kendo, s.melleny, s.szinek]);
  if (GEO_CACHE.has(key)) return GEO_CACHE.get(key);
  const ruha = RUHAK[s.nem][s.ruha] || Object.values(RUHAK[s.nem])[0];
  const kendo = !!s.kendo && s.nem === 'n';
  const fejResz = kendo ? KENDO_FEJ : (HAJAK[s.nem][s.haj] || Object.values(HAJAK[s.nem])[0]);
  const pal = paletta(s, ruha);
  const elemek = [], forras = {};
  const szemIdx = S.csontok.length, szemoldokIdx = S.csontok.length + 1;   // a pislogó és a szemöldök-csont
  const A = fejHorgony(S, fejResz, kendo);
  for (const resz of [...ruha.resz, fejResz]) {
    for (const p of S.reszek[resz] || []) {
      let szerep = szerepe(S, resz, p.mat, kendo) || 'egyeb';
      if (szerep === '-') continue;
      const geo = p.geo.clone();
      if (resz !== fejResz) alkatTorzit(S, geo, s.alkat);
      // a fej szemei a pislogó csontra, a szemöldökök a szemöldök-csontra kerülnek
      if (szerep === 'szem' || szerep === 'szem+' || szerep === 'szemoldok') {
        const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, v = V3();
        // 'szem+' = szem és szemöldök egy anyagban → háromszögenként szétválogatva
        if (szerep === 'szem+') {
          const ix = geo.index.array, fel = [], le = [];
          for (let t = 0; t < ix.length; t += 3) {
            let y = 0; for (let k = 0; k < 3; k++) y += v.fromBufferAttribute(pos, ix[t + k]).applyMatrix4(S.bind).y / 3;
            (y > A.szemY + 0.012 ? fel : le).push(ix[t], ix[t + 1], ix[t + 2]);
          }
          const g2 = geo.clone(); g2.setIndex(fel); geo.setIndex(le);
          for (let i = 0; i < pos.count; i++) { si.setXYZW(i, szemIdx, 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); }
          const s2 = g2.attributes.skinIndex, w2 = g2.attributes.skinWeight;
          for (let i = 0; i < pos.count; i++) { s2.setXYZW(i, szemoldokIdx, 0, 0, 0); w2.setXYZW(i, 1, 0, 0, 0); }
          szemoldokJavit(S, g2, 5);
          const fh = szemJavit(S, geo, A);
          elemek.push({ geo: g2, szerep: 'szemoldok', szin: p.szin });
          for (const d of fh) elemek.push(merev(S, d, szemIdx));
          continue;
        }
        const ci = szerep === 'szemoldok' ? szemoldokIdx : szemIdx;
        for (let i = 0; i < pos.count; i++) { si.setXYZW(i, ci, 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); }
        if (szerep === 'szemoldok') szemoldokJavit(S, geo, S.nem === 'f' ? 6 : 4);
        else { for (const d of szemJavit(S, geo, A)) elemek.push(merev(S, d, szemIdx)); continue; }
      }
      const it = { geo, szerep, szin: p.szin };
      elemek.push(it);
      (forras[resz] ||= []).push(it);
    }
  }
  const fejCsont = S.idx.Head;
  // generált rétegek
  if (s.melleny) {
    const torzsTop = S.nyug.Neck.p.y - 0.035, csipoY = S.nyug.Hips.p.y - 0.13, cz = S.nyug.Chest.p.z, mellY = S.nyug.Chest.p.y;
    const testDb = forras[ruha.resz[0]].filter(d => ['felso', 'ing', 'nyakkendo', 'felso2', 'melleny', 'mellenycsik'].includes(d.szerep));
    const h = hej(S, testDb, (c, n, tri, d) => {
      for (const o of tri) for (let q = 0; q < 4; q++) if (S.karIdx.has(d.geo.attributes.skinIndex.getComponent(o, q)) && d.geo.attributes.skinWeight.getComponent(o, q) > 0.42) return false;
      if (c.y > torzsTop || c.y < csipoY) return false;
      if (c.z > cz && c.y > mellY - 0.2 && Math.abs(c.x) < 0.02 + (c.y - (mellY - 0.2)) * 0.3) return false;   // V-kivágás
      return true;
    }, 0.011, 'melleny');
    if (h) elemek.push(h);
  }
  if (ruha.koteny || s.koteny) {
    const derek = S.nyug.Abdomen.p.y + 0.02, terd = S.nyug.LowerLegL.p.y + 0.08, cz = S.nyug.Hips.p.z;
    const db = [...(forras[ruha.resz[0]] || []), ...(forras[ruha.resz[1]] || [])].filter(d => d.szerep === 'felso' || d.szerep === 'also');
    const h = hej(S, db, (c, n) => c.y < derek && c.y > terd && c.z > cz + 0.02 && n.z > 0.15 && Math.abs(c.x) < 0.15, 0.009, 'koteny');
    if (h) elemek.push(h);
  }
  if (kendo) for (const d of KI.kendocsomo(A)) elemek.push(merev(S, d, fejCsont));
  const tetoDb = s.kalap === 'svajci' ? KI.svajcisapka(A) : s.kalap === 'kalap' ? KI.kalap(A) : s.kalap === 'tanyer' ? KI.tanyersapka(A) : [];
  for (const d of tetoDb) elemek.push(merev(S, d, fejCsont));
  if (s.bajusz) for (const d of KI.bajusz(A, s.bajusz)) elemek.push(merev(S, d, fejCsont));
  if (s.szemuveg) for (const d of KI.szemuveg(A)) elemek.push(merev(S, d, fejCsont));
  for (const e of elemek) szinez(S, e, pal);
  const geo = mergeGeometries(elemek.map(e => e.geo), false);
  for (const e of elemek) e.geo.dispose();
  geo.computeBoundingBox();
  const out = { geo, A };
  GEO_CACHE.set(key, out);
  return out;
}

// ------------------------------------------------------------------ a figura
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4();

export class Szereplo {
  /** A kamera (vagy a játékos) helye: ehhez mér a távolsági animáció-ritkítás. */
  static kamera = null;
  static stat = { frissitett: 0 };

  constructor(be) {
    const s = this.spec = teljesSpec(be);
    const S = this.S = SABLON[s.nem];
    if (!S) throw new Error('szereplokBetolt() előbb kell');
    const { geo, A } = osszerak(S, s);
    this.A = A;
    // csontváz-klón (hálók nélkül)
    this.obj = new THREE.Group(); this.obj.name = 'szereplo:' + (typeof be === 'string' ? be : s.nev || '');
    const arm = new THREE.Object3D();
    S.arm.matrixWorld.decompose(arm.position, arm.quaternion, arm.scale);
    const tpl = S.arm.children.find(c => c.isBone);
    const gyoker = tpl.clone(true); arm.add(gyoker);
    this.belso = new THREE.Group(); this.belso.add(arm); this.obj.add(this.belso);
    this.belso.scale.setScalar(s.magassag);
    const cs = {}; gyoker.traverse(o => { if (o.isBone) cs[o.name] = o; });
    this.cs = cs;
    const bones = S.csontok.map(n => cs[n]);
    const inv = S.skel.boneInverses.map(m => m.clone());
    // pislogó (szem) és szemöldök csont: a fejcsont gyerekei, nyugalomban a világtengelyekhez igazítva
    const extra = (nev, p) => {
      const b = new THREE.Bone(); b.name = nev;
      const hw = S.nyug.Head.m, s0 = S.nyug.Head.s;
      const want = new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(s0, s0, s0));
      const loc = hw.clone().invert().multiply(want);
      loc.decompose(b.position, b.quaternion, b.scale);
      cs.Head.add(b); bones.push(b); inv.push(want.clone().invert().multiply(S.bind));
      b.userData.nyug = { p: b.position.clone(), s: b.scale.clone(), fel: new THREE.Vector3(0, 1, 0).applyQuaternion(S.nyug.Head.q.clone().invert()).multiplyScalar(1 / s0) };
      return b;
    };
    this.pislogo = extra('Pislogo', new THREE.Vector3(0, A.szemY, A.szemZ));
    this.szemoldok = extra('Szemoldok', new THREE.Vector3(0, A.szemY + 0.02, A.szemZ));
    this.skel = new THREE.Skeleton(bones, inv);
    const mesh = this.mesh = new THREE.SkinnedMesh(geo, ANYAG);
    mesh.castShadow = true; mesh.receiveShadow = true;
    arm.add(mesh);
    mesh.bind(this.skel, S.kotes);
    // befoglaló gömb: a kötési dobozból, bővítve (karok fel, ülés) — a csontokhoz igazított számítás helyett
    const bb = geo.boundingBox;
    mesh.boundingSphere = new THREE.Sphere(bb.getCenter(new THREE.Vector3()), bb.getSize(new THREE.Vector3()).length() * 0.62);
    mesh.frustumCulled = true;
    this.mixer = new THREE.AnimationMixer(gyoker);
    this.mixer.addEventListener('finished', e => { if (e.action === this.akt && this._utana) { const u = this._utana; this._utana = null; const cb = this._kesz; this._kesz = null; this.anim(u); cb?.(); } });
    this.akt = null; this.alap = 'all'; this._acc = 0; this._lepes = 0; this._tiszta = new Map();
    this.korSeb = s.kor === 'idos' ? 0.86 : s.kor === 'fiatal' ? 1.04 : 1;
    this.gornyed = s.kor === 'idos' ? 1 : 0;
    this.nezCel = null; this.nezYaw = 0; this.nezPitch = 0;
    this.pislogT = 1 + Math.random() * 3; this.pislogD = 0;
    this.szemoldokCel = 0; this.szemoldokAll = 0;
    // régi API
    this.obj.userData.szereplo = this;
    this.obj.userData.anim = n => this.anim(n);
    this.obj.userData.mixer = { update: dt => this.update(dt) };
    this.anim('all');
    this.mixer.update(Math.random() * 2);
  }

  /** Animáció váltása áttűnéssel. o: {atmenet, sebesseg (szorzó), ujra, utana (egyszeri után), kesz()} */
  anim(nev, o = {}) {
    nev = ALIAS[nev] || nev;
    const S = this.S, clip = S.klipek[nev];
    if (!clip) return false;
    const act = this.mixer.clipAction(clip);
    const egyszeri = S.egyszeri.has(nev);
    if (this.akt === act && !o.ujra) { if (o.sebesseg) act.timeScale = o.sebesseg * this.korSeb; return true; }
    act.reset();
    act.setLoop(egyszeri ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    act.clampWhenFinished = egyszeri;
    act.timeScale = (o.sebesseg ?? 1) * this.korSeb;
    const t = o.atmenet ?? (nev === 'ijedt' ? 0.12 : 0.28);
    act.fadeIn(t).play();
    if (this.akt) this.akt.fadeOut(t);
    this.akt = act; this.aktNev = nev;
    if (egyszeri) { this._utana = o.utana || this.alap; this._kesz = o.kesz || null; } else { this.alap = nev; this._utana = null; }
    this.szemoldokCel = nev === 'ijedt' ? 1 : nev === 'szid' ? -1 : nev === 'orul' || nev === 'integet' ? 0.5 : 0;
    return true;
  }
  /** Haladás sebesség szerint (m/s): áll / sétál / fut, a lépésritmus a sebességhez igazítva (nincs csúszó láb). */
  halad(v) {
    const m = this.S.meta.seb || {};
    if (v < 0.08) return this.anim(this.alap === 'setal' || this.alap === 'fut' ? 'all' : this.alap);
    if (v < 2.6) return this.anim('setal', { sebesseg: v / (m.setal || 1.1) / this.korSeb });
    return this.anim('fut', { sebesseg: v / (m.fut || 3.2) / this.korSeb });
  }
  /** A fej a célpont felé fordul (Vector3 vagy Object3D; null: előre). */
  nez(cel) { this.nezCel = cel; }
  /** Kellék a kézbe ('R' jobb, 'L' bal). poz/rot: a csukló terében, méterben/radiánban. */
  fog(obj, oldal = 'R', { poz = [0, -0.06, 0.03], rot = [0, 0, 0] } = {}) {
    const w = this.cs['Wrist' + oldal];
    this.elenged(oldal);
    const h = new THREE.Group(); h.name = 'kez' + oldal;
    const s0 = this.S.nyug['Wrist' + oldal].s;
    // a tartó a csukló nyugalmi világforgatását kiegyenlíti → a kellék nyugalomban függőleges
    h.quaternion.copy(this.S.nyug['Wrist' + oldal].q).invert();
    h.scale.setScalar(1 / s0);
    const inner = new THREE.Group(); inner.position.set(...poz); inner.rotation.set(...rot); inner.add(obj); h.add(inner);
    w.add(h); this['kez' + oldal] = h;
    obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return obj;
  }
  elenged(oldal = 'R') { const h = this['kez' + oldal]; if (h) { h.removeFromParent(); this['kez' + oldal] = null; } }

  update(dt) {
    // távolsági ritkítás: közel minden képkocka, 30 m-en túl minden 2., 60-on túl minden 4., 110-en túl minden 8.
    let lepes = 1, tav = 0;
    if (Szereplo.kamera) { this.obj.getWorldPosition(tmpV); tav = tmpV.distanceTo(Szereplo.kamera); lepes = tav < 30 ? 1 : tav < 60 ? 2 : tav < 110 ? 4 : 8; }
    this._acc += dt;
    if (++this._lepes < lepes) return;
    this._lepes = 0;
    const d = this._acc; this._acc = 0;
    // a mixer csak változáskor ír a csontra → az előző képkocka rárakott forgatásait előbb visszavesszük
    for (const [b, q] of this._tiszta) b.quaternion.copy(q);
    this._tiszta.clear();
    this.mixer.update(d);
    Szereplo.stat.frissitett++;
    const kozel = tav < 35;
    this._utolso(d, kozel);
  }
  _utolso(dt, kozel) {
    const S = this.S, cs = this.cs, T = S.tengely;
    const fordit = (n, ax, a) => {
      if (!a) return;
      const b = cs[n];
      if (!this._tiszta.has(b)) this._tiszta.set(b, b.quaternion.clone());
      b.quaternion.multiply(tmpQ.setFromAxisAngle(T[n][ax], a));
    };
    // idős tartás: görnyedt hát, előreeső nyak, a fej felemelve, hogy előre nézzen
    if (this.gornyed && this.aktNev !== 'ul' && this.aktNev !== 'ul_beszel') {
      fordit('Abdomen', 'x', 0.08 * this.gornyed); fordit('Chest', 'x', 0.24 * this.gornyed); fordit('Neck', 'x', 0.2 * this.gornyed); fordit('Head', 'x', -0.3 * this.gornyed);
    }
    // fej a célpont felé
    let yaw = 0, pitch = 0;
    if (this.nezCel && kozel) {
      const p = this.nezCel.isObject3D ? this.nezCel.getWorldPosition(tmpV) : tmpV.copy(this.nezCel);
      this.obj.worldToLocal(p);
      const fejY = 1.6 * this.spec.magassag;
      yaw = Math.atan2(p.x, p.z); pitch = Math.atan2(p.y - fejY, Math.hypot(p.x, p.z));
      if (Math.abs(yaw) > 1.9) yaw = 0;     // mögötte: nem tekergeti ki a nyakát
      yaw = THREE.MathUtils.clamp(yaw, -1.2, 1.2); pitch = THREE.MathUtils.clamp(pitch, -0.35, 0.45);
    }
    const k = Math.min(1, dt * 5);
    this.nezYaw += (yaw - this.nezYaw) * k; this.nezPitch += (pitch - this.nezPitch) * k;
    if (Math.abs(this.nezYaw) > 1e-3 || Math.abs(this.nezPitch) > 1e-3) {
      fordit('Neck', 'y', this.nezYaw * 0.4); fordit('Head', 'y', this.nezYaw * 0.6);
      fordit('Head', 'x', -this.nezPitch * 0.7); fordit('Neck', 'x', -this.nezPitch * 0.3);
    }
    if (!kozel) return;
    // pislogás: 2–6 mp-enként, 0,13 mp
    this.pislogT -= dt;
    if (this.pislogT <= 0) { this.pislogD = 0.13; this.pislogT = 2 + Math.random() * 4; if (Math.random() < 0.15) this.pislogT = 0.25; }
    const pn = this.pislogo.userData.nyug;
    if (this.pislogD > 0) { this.pislogD -= dt; this.pislogo.scale.set(pn.s.x, pn.s.y * 0.12, pn.s.z); }
    else this.pislogo.scale.copy(pn.s);
    // szemöldök: ijedtnél fel, szidásnál le
    this.szemoldokAll += (this.szemoldokCel - this.szemoldokAll) * Math.min(1, dt * 8);
    const sn = this.szemoldok.userData.nyug;
    this.szemoldok.position.copy(sn.p).addScaledVector(sn.fel, this.szemoldokAll * 0.007);
  }
  dispose() { this.obj.removeFromParent(); this.mixer.stopAllAction(); }
}

/** Rövid alak: szereplo(id | leírás) → Szereplo ({obj, anim, mixer, update, nez, fog, halad}). */
export function szereplo(be) { return new Szereplo(be); }
export { SABLON };
