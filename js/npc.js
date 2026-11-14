// Kisüsti — NPC-mozgatás az úthálón (data/regions.js NODES/ROADS): útkereső (Dijkstra), gyalogos falusiak
// (Kenney mini-characters, járás/állás animáció) és járművek (jobb oldali sávban, kanyarban lassítva, a játékos
// előtt megállnak). A pénzügyőr-járőr autója ugyanezt használja: npc.jaror(pontok) vagy npc.jaror(ut('kapu','falu_kp')).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { NODES, ROADS } from '../data/regions.js';
import { MODELS, prop } from './vilag/betolto.js';
import { recolor, isRed, isTeal, isBlue } from './vilag/paletta.js';
import { segDist } from './vilag/adat.js';
import { szereplo, betoltve } from './szereplok/szereplo.js';
import { KIOSZTAS, falusi } from './szereplok/kiosztas.js';
const hashStr = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

// ---------------------------------------------------------------- gráf és útkereső
const ADJ = {};
for (const [a, b] of ROADS) {
  const d = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);
  (ADJ[a] ||= []).push([b, d]); (ADJ[b] ||= []).push([a, d]);
}
/** A legközelebbi csomópont azonosítója. */
export function legkozelebbiCsomopont(x, z) {
  let best = null, bd = 1e9;
  for (const id in NODES) { const d = Math.hypot(NODES[id][0] - x, NODES[id][1] - z); if (d < bd) { bd = d; best = id; } }
  return best;
}
/** A legközelebbi útpont (vetület a legközelebbi útszakaszra): {x, z, a, b, d}. */
export function utraVetit(x, z) {
  let best = null;
  for (const [a, b] of ROADS) {
    const r = segDist(x, z, NODES[a][0], NODES[a][1], NODES[b][0], NODES[b][1]);
    if (!best || r.d < best.d) best = { x: r.cx, z: r.cz, a, b, d: r.d, t: r.t };
  }
  return best;
}
function dijkstra(from, extra = null) {
  const dist = { [from]: 0 }, prev = {}, open = new Set([from]);
  while (open.size) {
    let u = null; for (const k of open) if (u === null || dist[k] < dist[u]) u = k;
    open.delete(u);
    const nb = [...(ADJ[u] || []), ...(extra?.[u] || [])];
    for (const [v, w] of nb) { const nd = dist[u] + w; if (dist[v] === undefined || nd < dist[v]) { dist[v] = nd; prev[v] = u; open.add(v); } }
  }
  return { dist, prev };
}
/**
 * Útvonal az úthálón. a, b: csomópont-azonosító ('kapu', 'falu_kp' …) vagy [x, z] pont (ilyenkor a legközelebbi
 * útszakaszra vetítjük, és onnan indul / oda érkezik). Visszaad: [[x, z], …] pontlista (az első az indulás).
 */
export function ut(a, b) {
  const pont = p => typeof p === 'string' ? { id: p, x: NODES[p][0], z: NODES[p][1] } : { x: p[0], z: p[1] };
  const A = pont(a), B = pont(b);
  // ideiglenes csomópontok a vetületekre
  const extra = {}, add = (u, v, w) => { (extra[u] ||= []).push([v, w]); };
  let sId = A.id, eId = B.id, sP = null, eP = null;
  if (!sId) {
    const v = utraVetit(A.x, A.z); sId = '_s'; sP = [v.x, v.z];
    for (const n of [v.a, v.b]) { const w = Math.hypot(NODES[n][0] - v.x, NODES[n][1] - v.z); add('_s', n, w); add(n, '_s', w); }
  }
  if (!eId) {
    const v = utraVetit(B.x, B.z); eId = '_e'; eP = [v.x, v.z];
    for (const n of [v.a, v.b]) { const w = Math.hypot(NODES[n][0] - v.x, NODES[n][1] - v.z); add('_e', n, w); add(n, '_e', w); }
    if (sP && ((v.a === utraVetit(A.x, A.z).a && v.b === utraVetit(A.x, A.z).b))) { const w = Math.hypot(sP[0] - eP[0], sP[1] - eP[1]); add('_s', '_e', w); }
  }
  const { prev, dist } = dijkstra(sId, extra);
  if (dist[eId] === undefined) return [];
  const ids = []; for (let u = eId; u !== undefined; u = prev[u]) { ids.unshift(u); if (u === sId) break; }
  const pts = ids.map(id => id === '_s' ? sP : id === '_e' ? eP : [...NODES[id]]);
  if (!A.id) pts.unshift([A.x, A.z]);
  if (!B.id) pts.push([B.x, B.z]);
  // egymás utáni azonos pontok kiszűrése
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.05);
}
/** Pontlista eltolása oldalra (pozitív: jobbra a haladási irányhoz képest), a sarkoknál a szögfelezővel. */
export function eltol(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let n1 = [0, 0], n2 = [0, 0];
    if (i > 0) { const dx = p[0] - a[0], dz = p[1] - a[1], L = Math.hypot(dx, dz) || 1; n1 = [-dz / L, dx / L]; }
    if (i < pts.length - 1) { const dx = b[0] - p[0], dz = b[1] - p[1], L = Math.hypot(dx, dz) || 1; n2 = [-dz / L, dx / L]; }
    let nx = n1[0] + n2[0], nz = n1[1] + n2[1]; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    const cos = i > 0 && i < pts.length - 1 ? Math.max(0.5, n1[0] * nx + n1[1] * nz) : 1;
    // a haladási irány (dx,dz) jobb oldala (x kelet, z dél, y fel): (-dz, dx)
    out.push([p[0] + nx * d / cos, p[1] + nz * d / cos]);
  }
  return out;
}

// ---------------------------------------------------------------- figurák és járművek
const CHARS = ['character-male-a', 'character-female-b', 'character-male-c', 'character-female-a', 'character-male-e', 'character-female-c', 'character-male-b', 'character-female-d'];
/**
 * Figura: a valós arányú szereplő (szereplok/szereplo.js), ha a sablonok betöltődtek; különben a régi Kenney-figura.
 * be: szám (névtelen falusi a sorszámból), tartalom-id ('kovacs', 'penzugyor', …) vagy teljes leírás-objektum.
 */
function figura(be, regio = 'falu') {
  if (betoltve()) {
    let spec = be;
    if (typeof be === 'number') spec = falusi(be, regio);
    else if (typeof be === 'string' && !KIOSZTAS[be]) spec = falusi(hashStr(be), regio);
    const sz = szereplo(spec);
    sz.obj.userData.npcFigura = true;
    return sz.obj;
  }
  const idx = typeof be === 'number' ? be : hashStr(String(be));
  const key = 'mini-characters/' + CHARS[idx % CHARS.length];
  const g = new THREE.Group();
  const m = SkeletonUtils.clone(MODELS[key].scene); m.scale.setScalar(2.4); g.add(m);
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const mixer = new THREE.AnimationMixer(m), clips = MODELS[key].animations;
  let cur = null;
  g.userData.anim = name => { const c = clips.find(a => a.name === name); if (!c) return; const act = mixer.clipAction(c); if (cur === act) return; act.reset().fadeIn(0.25).play(); if (cur) cur.fadeOut(0.25); cur = act; };
  g.userData.mixer = mixer;
  return g;
}
const AUTOK = [['car-kit/sedan', null], ['car-kit/van', null], ['car-kit/truck-flat', 'kopott'], ['car-kit/delivery', null], ['car-kit/hatchback-sports', 'piros'], ['car-kit/tractor', null]];
function autoObj(key, pal) {
  const g = new THREE.Group();
  const m = prop(key, 0, 0, 0, key.includes('tractor') ? 1.5 : 1.25, 0, g);
  if (pal === 'piros') recolor(m, { nev: 'npc-piros', rules: [[isTeal, [176, 52, 40], [79, 184, 130]]] });
  if (pal === 'kopott') recolor(m, { nev: 'npc-kopott', rules: [[isRed, [120, 130, 140], [232, 97, 71]], [isBlue, [110, 120, 128], [101, 142, 214]]] });
  if (pal === 'jaror') recolor(m, { nev: 'jaror', rules: [[isRed, [38, 72, 56], [232, 97, 71]]] });
  const kerek = []; m.traverse(o => { if (o.name?.startsWith('wheel-')) kerek.push(o); });
  g.userData.kerek = kerek;
  return g;
}

export class NpcRendszer {
  constructor(V, scene) { this.V = V; this.scene = scene; this.lista = []; this.rnd = mulberry(77); this.jatekosPoz = null; }
  /** Véletlen NPC-k indítása: gyalogos falusiak a lakott részeken, autók és traktor az utakon. */
  indit({ gyalogos = 12, auto = 4, arusok = true } = {}) {
    const R = this.rnd;
    if (arusok) (this.V.arusok || []).forEach((a, i) => this.allo(a.x, a.z, a.ry, i));
    const lakott = ['falu_kp', 'felveg_le', 'felveg_kp', 'kapu', 'kv_kp', 'kv_be', 'hegy_kp', 'falu_kp', 'kv_kp'];
    for (let i = 0; i < gyalogos; i++) {
      const home = lakott[i % lakott.length];
      const o = figura(i, home.startsWith('kv_') ? 'kisvaros' : 'falu'); this.scene.add(o);
      const n = { tipus: 'gyalogos', obj: o, seb: 1.25 + R() * 0.35, home, oldal: R() < 0.5 ? -1 : 1, var: 0, pts: [], i: 0 };
      const [x, z] = NODES[home]; o.position.set(x + (R() - 0.5) * 30, 0, z + (R() - 0.5) * 6);
      this._ujCel(n, true);
      this.lista.push(n);
    }
    for (let i = 0; i < auto; i++) {
      const [key, pal] = AUTOK[i % AUTOK.length];
      const o = autoObj(key, pal); this.scene.add(o);
      const ids = Object.keys(NODES), start = ids[Math.floor(R() * ids.length)];
      const n = { tipus: 'auto', obj: o, max: key.includes('tractor') ? 6.5 : 12 + R() * 3, seb: 0, sav: key.includes('tractor') ? 1.0 : 1.35, pts: [], i: 0, start };
      o.position.set(NODES[start][0], 0, NODES[start][1]);
      this._ujCel(n, true);
      this.lista.push(n);
    }
  }
  _ujCel(n, elso = false) {
    const R = this.rnd, ids = Object.keys(NODES);
    const p = n.obj.position;
    let cel;
    if (n.tipus === 'gyalogos') {
      // a gyalogos a lakóhelye körül sétál: a szomszédos csomópontok felé, vagy egy véletlen pontra a közelben
      const nb = ADJ[n.home].map(e => e[0]);
      cel = R() < 0.5 ? n.home : nb[Math.floor(R() * nb.length)];
      const [cx, cz] = NODES[cel];
      const L = Math.hypot(cx - p.x, cz - p.z);
      const pts = ut([p.x, p.z], L > 140 ? [p.x + (cx - p.x) * 140 / L, p.z + (cz - p.z) * 140 / L] : cel);
      n.pts = eltol(pts, n.oldal * 3.6); n.i = 1;
      n.var = elso ? R() * 4 : 2 + R() * 6;
    } else {
      do { cel = ids[Math.floor(R() * ids.length)]; } while (Math.hypot(NODES[cel][0] - p.x, NODES[cel][1] - p.z) < 60);
      n.pts = eltol(ut([p.x, p.z], cel), n.sav); n.i = 1;
      n.var = elso ? 0 : 1 + R() * 3;
    }
  }
  /** Álló figura (árus, kocsmáros): helyben áll, néha körülnéz. */
  allo(x, z, ry = 0, idx = 0) {
    const o = figura(typeof idx === 'number' ? idx + 3 : idx); o.position.set(x, this.V.talaj(x, z), z); o.rotation.y = ry; this.scene.add(o);
    o.userData.anim('idle');
    const n = { tipus: 'allo', obj: o, ry0: ry, t: this.rnd() * 10 };
    this.lista.push(n); return n;
  }
  /** Járőrautó a megadott útvonalon (pontlista vagy ut() eredménye). o: {seb, sav, kesz()}. Visszaad egy NPC-leírót. */
  jaror(pontok, o = {}) {
    const obj = autoObj('car-kit/sedan', 'jaror'); this.scene.add(obj);
    const pts = eltol(pontok, o.sav ?? 1.35);
    obj.position.set(pts[0][0], this.V.talaj(pts[0][0], pts[0][1]), pts[0][1]);
    const n = { tipus: 'jaror', obj, max: o.seb ?? 11, seb: 0, pts, i: 1, var: 0, kesz: o.kesz, egyszer: true };
    this.lista.push(n);
    return n;
  }
  torol(n) { n.obj.removeFromParent(); this.lista.splice(this.lista.indexOf(n), 1); }
  update(dt, cam) {
    const V = this.V;
    for (const n of [...this.lista]) {
      const o = n.obj, p = o.position;
      const tav = cam ? Math.hypot(p.x - cam.x, p.z - cam.z) : 0;
      o.visible = !n.rejt && tav < (n.tipus === 'gyalogos' || n.tipus === 'allo' ? 160 : 520);
      if (n.tipus === 'allo') { n.t += dt; o.rotation.y = n.ry0 + Math.sin(n.t * 0.4) * 0.35; if (o.visible) o.userData.mixer?.update(dt); continue; }
      if (n.var > 0) { n.var -= dt; if (n.tipus === 'gyalogos') o.userData.anim('idle'); if (o.visible) o.userData.mixer?.update(dt); n.seb0 = 0; continue; }
      const cel = n.pts[n.i];
      if (!cel) {
        if (n.egyszer) { n.kesz?.(n); this.torol(n); continue; }
        this._ujCel(n); continue;
      }
      const dx = cel[0] - p.x, dz = cel[1] - p.z, d = Math.hypot(dx, dz);
      let v;
      if (n.tipus === 'gyalogos') { v = n.seb; if (o.userData.szereplo) o.userData.szereplo.halad(v); else o.userData.anim('walk'); }
      else {
        // kanyar előtt lassít (a következő szakasz iránya szerint), a játékos / más jármű előtt megáll
        const nx2 = n.pts[n.i + 1];
        let cel2 = n.max;
        if (nx2) { const ex = nx2[0] - cel[0], ez = nx2[1] - cel[1], c = (dx * ex + dz * ez) / ((d || 1) * (Math.hypot(ex, ez) || 1)); if (c < 0.9 && d < 30) cel2 = Math.max(4, n.max * (0.35 + 0.65 * (c + 1) / 2)); }
        else if (d < 25) cel2 = Math.max(2, d * 0.5);
        const fx = dx / (d || 1), fz = dz / (d || 1);
        const elol = (qx, qz) => { const rx = qx - p.x, rz = qz - p.z, el = rx * fx + rz * fz, ol = Math.abs(rx * fz - rz * fx); return el > 0 && el < 14 && ol < 2.6; };
        if (this.jatekosPoz && elol(this.jatekosPoz.x, this.jatekosPoz.z)) cel2 = 0;
        for (const m of this.lista) if (m !== n && (m.tipus === 'auto' || m.tipus === 'jaror') && elol(m.obj.position.x, m.obj.position.z)) { const mf = Math.sin(m.obj.rotation.y) * fx + Math.cos(m.obj.rotation.y) * fz; if (mf > 0.3) cel2 = Math.min(cel2, Math.max(0, m.seb * 0.9)); }
        n.seb += THREE.MathUtils.clamp(cel2 - n.seb, -8 * dt, 3 * dt);
        v = n.seb;
        for (const w of o.userData.kerek || []) w.rotation.x += v * dt / 0.4;
      }
      const step = Math.min(d, v * dt);
      if (d < 0.3 || step >= d - 1e-4) { p.x = cel[0]; p.z = cel[1]; n.i++; }
      else { p.x += dx / d * step; p.z += dz / d * step; }
      p.y = V.talaj(p.x, p.z);
      if (d > 0.05 && v > 0.01) {
        const ry = Math.atan2(dx, dz); let dr = ry - o.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        o.rotation.y += dr * Math.min(1, dt * (n.tipus === 'gyalogos' ? 8 : 5));
      }
      if (o.visible) o.userData.mixer?.update(dt);
    }
  }
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
