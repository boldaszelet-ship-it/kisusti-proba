// Kisüsti — közös segédek a birodalmi szimulációhoz: mentehető véletlen, úthálózat, régió-keresés.
import { NODES, ROADS, REGIONS } from '../data/regions.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round1 = v => Math.round(v * 10) / 10;

/** Xorshift; az állapota (s.v) a mentésbe kerül, így a betöltött játék ugyanúgy folytatódik. */
export function rnd(s) {
  let x = s.v >>> 0 || 1;
  x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
  s.v = x;
  return x / 4294967296;
}

// ------------------------------------------------------------ úthálózat
const ADJ = {};
for (const [a, b] of ROADS) {
  const d = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);
  (ADJ[a] ??= []).push([b, d]);
  (ADJ[b] ??= []).push([a, d]);
}

/** Legrövidebb út két csomópont között: {nodes, dist} (méter). */
export function path(from, to) {
  if (from === to) return { nodes: [from], dist: 0 };
  const dist = { [from]: 0 }, prev = {}, open = new Set([from]), done = new Set();
  while (open.size) {
    let u = null;
    for (const n of open) if (u === null || dist[n] < dist[u]) u = n;
    open.delete(u); done.add(u);
    if (u === to) break;
    for (const [v, d] of ADJ[u] || []) {
      if (done.has(v)) continue;
      const nd = dist[u] + d;
      if (dist[v] === undefined || nd < dist[v]) { dist[v] = nd; prev[v] = u; open.add(v); }
    }
  }
  if (dist[to] === undefined) return { nodes: [from, to], dist: Infinity };
  const nodes = [to];
  while (nodes[0] !== from) nodes.unshift(prev[nodes[0]]);
  return { nodes, dist: dist[to] };
}

/** Az útvonal szakaszai irányítatlan kulcsként („a|b”), a járőr-találkozáshoz. */
export function edges(nodes) {
  const out = [];
  for (let i = 1; i < nodes.length; i++) out.push([nodes[i - 1], nodes[i]].sort().join('|'));
  return out;
}

export function nodePos(id) { return NODES[id]; }

/** A pont régiója: a legközelebbi régió a sugárhoz mérve. */
export function regionAt(x, z) {
  let best = REGIONS[0], bd = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(x - r.center[0], z - r.center[1]) / r.r;
    if (d < bd) { bd = d; best = r; }
  }
  return best.id;
}

export function nodeRegion(id) { const p = NODES[id]; return p ? regionAt(p[0], p[1]) : 'tanya'; }

export function nearestNode(x, z) {
  let best = 'kapu', bd = Infinity;
  for (const [id, p] of Object.entries(NODES)) {
    const d = Math.hypot(x - p[0], z - p[1]);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

/** Egy régió fő csomópontja (a járőr célpontja). */
export const REGIO_NODE = { tanya: 'kapu', falu: 'falu_kp', felveg: 'felveg_kp', szolohegy: 'hegy_kp', major: 'major_kp', kisvaros: 'kv_kp' };
/** Az ingatlanok csomópontja. */
export const PROP_NODE = { tanya: 'kapu', preshaz: 'hegy_kp', major: 'major_kp', pince: 'kv_kp' };
