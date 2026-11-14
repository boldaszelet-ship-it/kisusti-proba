// Kisüsti — a történeti réteg közös darabjai: hangolás, DOM-gyökér (#tt), felirat és cetli, beszélőnevek,
// animációnevek (a tortenet.js Kenney-klipjei → a figurák klipjei), saját figurák (séta, fej, kontaktárnyék).
import * as THREE from 'three';
import { szereplo } from '../szereplok/szereplo.js';
import { SZEREPLOK } from '../../data/tortenet.js';
import { VEVOK_TELJES, TERJESZTOK, BESUGOK } from '../../data/tartalom.js';

/** Hangolható értékek: minden időzítés itt, mp-ben. */
export const TH = {
  // intró
  // ulnek: a tor vendégei padon ülnek ('ul'/'ul_beszel'). 2026-11-14: az átvitel javítva (a csípő-elmozdulást a Body
  // viszi, a Root alatti lábfej a lábszárat követi) — false esetén az asztal körül ÁLLNAK (allvaKifele).
  intro: { atugrasMutat: 4.5, atugrasRejt: 2.5, kihagyasCetliMp: 5.5, ulnek: true, allvaKifele: 0.28, kameraTav: 0.9 },
  // feliratok és jelenetek
  sorMin: 2.6, sorMax: 6.5, sorAlap: 1.5, sorKarakter: 0.052, sorKoz: 0.6,
  jelenet: { spawnTav: 80, elhalasztTav: 1.6, valaszVar: 0.25, fejFordul: 2.0, elsetal: 6, setaSeb: 1.15, autoBe: 7.5, autoParkol: [3.5, 17.4] },
  // tutorial
  tut: { cetliMp: 6, elsoKesleltetes: 1.6, elengedes: 60, keszVillan: 0.9, ellenorzes: 0.25, jeloloMagas: 1.3 },
  hirMp: 7.5,
};

export const easeInOut = a => (a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2);
export const easeOut = a => 1 - Math.pow(1 - a, 3);
export const sorHossz = s => Math.max(TH.sorMin, Math.min(TH.sorMax, TH.sorAlap + (s || '').length * TH.sorKarakter));

// ------------------------------------------------------------------ DOM
let ROOT = null;
export function gyoker() {
  if (ROOT) return ROOT;
  ROOT = document.createElement('div'); ROOT.id = 'tt';
  ROOT.innerHTML = `
    <div class="tt-fekete"></div>
    <div class="tt-sav fent"></div><div class="tt-sav lent"></div>
    <div class="tt-cim"></div>
    <div class="tt-hir"><b>KISÜSTFALVI HÍRMONDÓ</b><span></span></div>
    <div class="tt-cetli"></div>
    <div class="tt-jelolo"><small></small></div>
    <div class="tt-gyuru"></div>
    <div class="tt-utasitas"></div>
    <div class="tt-valasz"></div>
    <div class="tt-sor"><b></b><span></span></div>
    <div class="tt-atugras"><svg viewBox="0 0 30 30"><circle class="h" cx="15" cy="15" r="12"/><circle class="t" cx="15" cy="15" r="12" stroke-dasharray="75.4" stroke-dashoffset="75.4"/></svg><span>Átugrás: tartsd lenyomva <kbd>Space</kbd></span></div>`;
  document.body.appendChild(ROOT);
  return ROOT;
}
export const q = sel => gyoker().querySelector(sel);

/** Beszélő megjelenítendő neve: SZEREPLOK, vevő, terjesztő, besúgó. */
export function nevE(ki) {
  if (!ki) return '';
  const sz = SZEREPLOK[ki]; if (sz) return sz.becenev && ki !== 'erno' ? sz.becenev : sz.nev;
  const v = VEVOK_TELJES.find(x => x.id === ki); if (v) return v.nev.split(',')[0];
  const t = TERJESZTOK.find(x => x.id === ki); if (t) return t.nev.split(',')[0];
  if (ki.startsWith('besugo_')) { const b = BESUGOK[ki.slice(7)]; if (b) return b.nev.split(' a ')[0].replace(/^a /, '').replace(/^\w/, c => c.toUpperCase()); }
  return ki;
}
export const idezet = s => `„${s}”`;

/** Felirat alul (beszélő + sor). mp = null: marad, amíg el nem tüntetik. */
let sorT = null;
export function sor(ki, szoveg, mp = null) {
  const el = q('.tt-sor');
  el.querySelector('b').textContent = ki ? nevE(ki) : '';
  el.querySelector('b').style.display = ki ? '' : 'none';
  el.querySelector('span').textContent = ki ? idezet(szoveg) : szoveg;
  el.classList.add('be');
  clearTimeout(sorT); if (mp) sorT = setTimeout(() => el.classList.remove('be'), mp * 1000);
}
export const sorKi = () => { clearTimeout(sorT); q('.tt-sor').classList.remove('be'); };

let cetliT = null;
/** Nagyapa cetlije. oldal: a tutorial kis lapja bal oldalt (nem takarja a célkeresztet). */
export function cetli(szoveg, mp = TH.tut.cetliMp, { oldal = false, alairas = '' } = {}) {
  const el = q('.tt-cetli');
  el.classList.toggle('oldal', oldal);
  el.textContent = szoveg;
  if (alairas) { const i = document.createElement('i'); i.textContent = alairas; el.appendChild(i); }
  void el.offsetWidth; el.classList.add('be');
  clearTimeout(cetliT); if (mp) cetliT = setTimeout(() => el.classList.remove('be'), mp * 1000);
}
export const cetliKi = () => { clearTimeout(cetliT); q('.tt-cetli').classList.remove('be'); };

let hirT = null;
export function hirmondo(cim, mp = TH.hirMp) {
  const el = q('.tt-hir'); el.querySelector('span').textContent = cim; el.classList.add('be');
  clearTimeout(hirT); hirT = setTimeout(() => el.classList.remove('be'), mp * 1000);
}

// ------------------------------------------------------------------ animációk
/** tortenet.js klipnév → figura-klip; ülő figuránál a gesztus helyett ülve beszél (az álló klip felállítaná).
 *  A hangnem miatt: az 'emote-yes' nem ugrál örömében (az 'orul' ugrás), csak beszél; kupicával a kézben a 'holding' koccint. */
const ALLO = { 'holding-right': 'atad', 'holding-left': 'atad', 'interact-right': 'beszel', 'interact-left': 'beszel', 'pick-up': 'felvesz',
  'emote-yes': 'beszel', 'emote-no': 'szid', idle: 'all', walk: 'setal', sit: 'ul' };
export function klip(nev, ul = false, kupica = false) {
  if (ul) return nev === 'idle' || nev === 'sit' ? 'ul' : 'ul_beszel';
  if (kupica && /^holding/.test(nev)) return 'koccint';
  return ALLO[nev] || nev;
}

// ------------------------------------------------------------------ saját figura (a történet idejére)
const _v = new THREE.Vector3();
export class Figura {
  constructor(J, ki, x, z, ry = 0) {
    this.J = J; this.ki = ki;
    this.sz = szereplo(ki);
    this.obj = this.sz.obj; this.obj.name = 'tortenet:' + ki;
    this.obj.position.set(x, J.V.talaj(x, z), z); this.obj.rotation.y = ry; this.ry = ry;
    J.scene.add(this.obj);
    J.G?.kontakt(this.obj, 0.42, 0.42);
    this.ul = false; this.seta = null; this.alapKlip = 'all';
  }
  anim(nev, o) { this.sz.anim(nev, o); }
  /** Ülés: a klip 'ul', a csípő a pad magasságán. */
  ultet() { this.ul = true; this.alapKlip = 'ul'; this.sz.anim('ul', { atmenet: 0.01 }); this.sz.mixer.update(Math.random() * 3); }
  beszel(be, nev = null) {
    if (this.seta) return;
    const beszelo = this.ul ? 'ul_beszel' : 'beszel';   // az egyszeri gesztus (koccint, felvesz) után tovább beszél
    if (be) this.sz.anim(nev ? klip(nev, this.ul, this.kupica) : beszelo, { utana: beszelo });
    else this.sz.anim(this.alapKlip);
  }
  nez(p) { this.sz.nez(p ? (p.isVector3 || p.isObject3D ? p : _v.set(p[0], p[1], p[2]).clone()) : null); }
  /** Séta a pontra (állandó tempó, a lépés a sebességhez igazítva), a végén ry felé fordul. */
  setal(x, z, ryVeg = null, kesz = null, seb = TH.jelenet.setaSeb) {
    const o = this.obj.position, L = Math.hypot(x - o.x, z - o.z);
    this.seta = { fx: o.x, fz: o.z, tx: x, tz: z, t: 0, dur: Math.max(0.3, L / seb), ryVeg, kesz };
    this.sz.anim('setal', { sebesseg: 1 });
  }
  update(dt) {
    const s = this.seta, o = this.obj;
    if (s) {
      s.t += dt;
      const a = Math.min(1, s.t / s.dur);
      o.position.x = s.fx + (s.tx - s.fx) * a; o.position.z = s.fz + (s.tz - s.fz) * a;
      o.position.y = this.J.V.talaj(o.position.x, o.position.z);
      const iry = Math.atan2(s.tx - s.fx, s.tz - s.fz);
      if (a < 1) this._fordul(iry, dt, 10);
      else { this.seta = null; this.sz.anim(this.alapKlip); if (s.ryVeg != null) this.ry = s.ryVeg; s.kesz?.(); }
    } else this._fordul(this.ry, dt, 4);
    this.sz.update(dt);
  }
  _fordul(cel, dt, k) { let d = cel - this.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); this.obj.rotation.y += d * Math.min(1, dt * k); }
  torol() { this.J.G?.kontaktTorol(this.obj); this.sz.dispose(); }
}
