// Kisüsti UI — közös segédek: számformázás, idő, HTML-építés, színek. DOM-ot nem érint.
import { HATASOK, GYUMOLCSOK, CIKKEK, OSSZETEVOK } from '../../data/tartalom.js';
import { REGIONS, NODES } from '../../data/regions.js';

const NBSP = ' ';

/** Ezres tagolás nem törő szóközzel: 12 400. */
export function szam(v, d = 0) {
  const n = Number(v) || 0;
  const [e, t] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + (t ? ',' + t : '');
}
export const ft = v => szam(Math.round(v)) + NBSP + 'Ft';
/** Előjeles összeg: +12 400 Ft / −3 000 Ft. */
export const ftE = v => (v > 0 ? '+' : v < 0 ? '−' : '') + szam(Math.abs(Math.round(v))) + NBSP + 'Ft';
export const l = v => szam(v, Math.abs(v - Math.round(v)) < 0.005 ? 0 : (Math.abs(v * 10 - Math.round(v * 10)) < 0.05 ? 1 : 2)) + NBSP + 'l';
export const szorzo = v => '×' + szam(v, 2);

/** Játékperc → „14:05”. */
export function ora(perc) {
  const m = ((Math.floor(perc) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
/** Hány nap a perc (a sim szerint a nap 0 percnél kezdődik, az első nap 1.). */
export const napOf = perc => Math.floor(perc / 1440) + 1;
/** Időtartam játékpercben → „2 ó 15 p”, „45 p”, „1 nap 3 ó”. */
export function tartam(perc) {
  perc = Math.max(0, Math.round(perc));
  const n = Math.floor(perc / 1440), o = Math.floor((perc % 1440) / 60), p = perc % 60;
  if (n) return `${n}${NBSP}nap${o ? ' ' + o + NBSP + 'ó' : ''}`;
  if (o) return `${o}${NBSP}ó${p ? ' ' + p + NBSP + 'p' : ''}`;
  return `${p}${NBSP}p`;
}
/** Mikor volt: „ma 14:05”, „tegnap 09:10”, „3. nap 18:00”. */
export function mikor(perc, most) {
  const a = napOf(perc), b = napOf(most);
  return (a === b ? 'ma ' : a === b - 1 ? 'tegnap ' : `${a}. nap `) + ora(perc);
}

/** HTML-escape. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/(\d) (?=\d{3}\b)/g, '$1\u00a0').replace(/(\d) (Ft|l|kg|fok|pont)\b/g, '$1\u00a0$2');
}
/** Címke-attribútumok egy gombhoz: data-a (művelet) és data-v (érték). */
export const gomb = (a, v = '', cls = '', tartalom = '', extra = '') =>
  `<button class="ku-b ${cls}" data-a="${esc(a)}" data-v="${esc(v)}" ${extra}>${tartalom}</button>`;

export const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
export const hatasNev = id => HATASOK[id]?.nev || id;
export const hatasSzin = id => hex(HATASOK[id]?.szin ?? 0x999999);
/** Világos-e a szín (a szövegszínhez a chipen). */
export function vilagos(n) { const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 150; }
/** Hatás-chip: színes pötty + név; ritka hatás aranykeretes. */
export function chip(id, cls = '') {
  const H = HATASOK[id]; if (!H) return '';
  return `<span class="ku-chip ${H.ritka ? 'ritka' : ''} ${H.ertek < 0 ? 'rossz' : ''} ${cls}" style="--c:${hex(H.szin)}"><i></i>${esc(H.nev)}</span>`;
}
export const gyNev = gy => GYUMOLCSOK[gy]?.nev || 'pálinka';
export const gyRovid = gy => GYUMOLCSOK[gy]?.gyumolcs || gy;
export const cikkNev = id => CIKKEK[id]?.nev || id;
export const OSSZETEVO_IDK = Object.keys(OSSZETEVOK);

export const REG = Object.fromEntries(REGIONS.map(r => [r.id, r]));
/** Melyik régióban van egy pont (a legközelebbi középpont, a sugárhoz mérve). */
export function regioAt(x, z) {
  let best = 'tanya', bd = Infinity;
  for (const r of REGIONS) { const d = Math.hypot(x - r.center[0], z - r.center[1]) / r.r; if (d < bd) { bd = d; best = r.id; } }
  return best;
}
export const nodeRegio = id => { const p = NODES[id]; return p ? regioAt(p[0], p[1]) : 'tanya'; };

/** A tétel rövid leírása: „4 l · 52 fok · 78 pont”. */
export function tetelSor(t) {
  const p = t.palack ? ` · ${t.palack.db} üveg` : '';
  return `${l(t.l)} · ${szam(t.fok)} fok · ${Math.round(t.q)} pont${p}`;
}
/** Hely olvasható neve. */
export function helyNev(hely, ingatlanok) {
  if (hely === 'nalad') return 'nálad';
  const [k, id] = hely.split(':');
  const p = ingatlanok?.find(x => x.id === id);
  if (k === 'prop') return p ? p.nev : id;
  if (k === 'rejtek') return (p ? p.nev : id) + ', rejtekben';
  if (k === 'terjeszto') return 'terjesztőnél';
  return hely;
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** Kezdőbetűk az érmékhez: „Kovács bácsi” → „KB”. */
export function monogram(nev) {
  const w = nev.replace(/^(a|az)\s+/i, '').split(/[\s,]+/).filter(Boolean);
  const masodik = w[1] && w[1][0] !== w[1][0].toLowerCase() ? w[1] : null;
  return ((w[0]?.[0] || '?') + (masodik?.[0] || '')).toUpperCase();
}
