// Kisüsti v0.3 — a birodalmi szimuláció belépési pontja (TERV-v3 szerződés). Tiszta logika: DOM és three nélkül, Node alatt is fut.
//   import { Empire } from './sim/empire.js';
//   const E = new Empire(seed); E.on(evt => …); E.step(dtSec); E.state
// A meglévő alapkör (sim.js, Sim) az E.core: a kézi üst minigame-je (setHeat, cut, hőfok, vágások) változatlanul onnan jön.
// Az API teljes leírása: projects/kisusti/SIM-API.md.
import { Sim, TIME_SCALE, DAY_START, ft as ftHu, hu } from '../sim.js';
import { REGIONS, PROPERTIES, BUSINESSES } from '../data/regions.js';
import { GYUMOLCSOK, KEZDES, BANK, BESUGOK, JARMUVEK, HORDOK, USTOK, TORVENY, GYARI } from '../data/tartalom.js';
import { rnd, nearestNode } from './kozos.js';
import { termeles, initTermeles, PROP } from './termeles.js';
import { keveres, ertekSzorzo } from './keveres.js';
import { piac, initPiac } from './piac.js';
import { torveny, initTorveny } from './torveny.js';
import { birodalom, initBirodalom } from './birodalom.js';
import { kuldetes, initKuldetes } from './kuldetes.js';

export const MENTES_VERZIO = 1;

function ujNap() {
  return { bevetel: 0, kiadas: 0, terjesztoBevetel: 0, mosott: 0, eladottL: 0, fozesek: 0, ujVevok: 0, birsag: 0, regioEladas: {}, esemenyek: [] };
}
function ujStat() {
  return { cefre: 0, fozes: 0, keziMaxQ: 0, eladas: 0, eladottL: 0, ultetes: 0, keveres: 0, kostolo: 0, rejtes: 0, terjeszto: 0, terjesztoBevetel: 0,
    terjesztoBukas: 0, ingatlan: 0, ingatlanNap: {}, erlelesMax: 0, feri: 0, mosott: 0, kisvaros: 0, vizezes: 0, palack: 0, bevetel: 0, kiadas: 0,
    birsag: 0, birsagFt: 0, razzia: 0, motozas: 0, ejjeli: 0, rangNap: {} };
}

export class Empire {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0 || 1;
    this.core = new Sim(this.seed);
    this.listeners = [];
    this.s = { v: this.seed ^ 0x9e3779b9, nextId: 0, nap: ujNap(), tegnap: null, utolso: null, osszesitok: [], stat: ujStat(), receptek: {}, hatasok: {}, hol: 'kapu' };
    initTermeles(this.s); initPiac(this.s); initTorveny(this.s); initBirodalom(this.s); initKuldetes(this.s);
    for (const [id, db] of Object.entries(KEZDES.cikkek)) this._ad(id, db);
    this._bekot();
    this.s.uzenetek.push({ id: 'm0', kitol: 'nagyapa', nev: 'Nagyapa füzete', szoveg: KEZDES.nyitoUzenet, ido: this.now(), olvasva: false });
  }
  /** A core (Sim) eseményei és a kézi üst lezárása ide futnak be. */
  _bekot() {
    this.core.on(t => this.emit({ type: 'msg', text: t }));
    this.core.finishStill = () => this._keziKesz();
    this.core.addSuspicion = v => this.addSuspicion(this.s.kezi ? PROP[this.s.kezi.propId].regio : 'tanya', v, 'kifutas');
  }

  // ------------------------------------------------------------ események, segédek
  on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; }
  emit(e) { for (const f of this.listeners) f(e); }
  msg(text) { this.emit({ type: 'msg', text }); }
  ok(o = {}) { return { ok: true, ...o }; }
  err(text, csendes = false) { if (!csendes) this.emit({ type: 'msg', text, hiba: true }); return { ok: false, hiba: text }; }
  r() { return rnd(this.s); }
  ft(v) { return ftHu(v); }
  /** Névelő a névhez: „a Présház a hegyen”, „a régi major csarnoka”. */
  aNev(n) { if (n.startsWith('A ')) return 'a ' + n.slice(2); return (/^[aáeéiíoóöőuúüű]/i.test(n) ? 'az ' : 'a ') + n; }

  // ------------------------------------------------------------ idő
  now() { return this.core.minutes; }
  day() { return this.core.day(); }
  hour() { return this.core.hour(); }
  isDay() { return this.core.isDay(); }
  clock() { return this.core.clock(); }

  /** Valós dt (mp). A kézi üst fizikája valós időben, minden más játékidőben (TIME_SCALE) lép.
   *  `s.idoSzorzo` (alap 1): a tutorial első napja lassítja a játékidőt (a kézi üstöt nem). */
  step(dt) {
    let left = dt;
    const sz = this.s.idoSzorzo || 1;
    while (left > 1e-9) {
      const d = Math.min(left, 0.25);
      if (this.s.kezi && this.core.still.running) this.core.stepStill(d);
      this.advance(d * TIME_SCALE * sz);
      left -= d;
    }
  }
  /** Játékperc telik (legfeljebb 10 perces szeletekben, hogy az órás és napi események ne maradjanak ki). */
  advance(m) {
    while (m > 1e-9) {
      const d = Math.min(m, 10);
      const elotte = this.now();
      this.core.minutes += d;
      m -= d;
      this._termelesTick(d);
      this._szallitTick();
      this._torvenyTick(d);
      if (Math.floor(this.now() / 60) > Math.floor(elotte / 60)) { this._rendelesTick(); this._alkOra(); this._torvenyOra(); this._questCheck(); }
      if (Math.floor(this.now() / 1440) > Math.floor(elotte / 1440)) this._napVege();
    }
  }
  /** Alvás reggel 6-ig: a gyanú minden régióban csökken; visszaadja a legutóbbi napi összesítőt. */
  sleep() {
    if (this.s.kezi) return this.err('Előbb fejezd be a főzést: az üstöt nem hagyod magára.');
    let next = this.day() * 1440 + DAY_START;
    if (this.now() % 1440 < DAY_START) next -= 1440;
    this.advance(next - this.now());
    for (const r of Object.keys(this.s.gyanu)) this.s.gyanu[r] = Math.max(0, this.s.gyanu[r] - TORVENY.alvas);
    this.msg('Kialudtad magad. A falu is elfelejtett ezt-azt.');
    return { ok: true, ...(this.s.utolso || { nap: 0 }) };
  }
  _napVege() {
    this._mosasNap();
    this._berNap();
    this._terjesztoNap();
    this._termelesNap();
    const n = this.s.nap;
    const sum = {
      nap: this.day() - 1, bevetel: Math.round(n.bevetel), terjesztoBevetel: Math.round(n.terjesztoBevetel), kiadas: Math.round(n.kiadas),
      mosott: Math.round(n.mosott), eladottL: Math.round(n.eladottL * 100) / 100, fozesek: n.fozesek, ujVevok: n.ujVevok, birsag: Math.round(n.birsag),
      gyanu: Object.fromEntries(Object.entries(this.s.gyanu).map(([k, v]) => [k, Math.round(v)])),
      kp: Math.round(this.core.money), dunyha: Math.round(this.s.dunyha), szamla: Math.round(this.s.szamla), rang: this.rankInfo().nev, esemenyek: [...n.esemenyek],
    };
    this.s.tegnap = n; this.s.utolso = sum;
    this.s.osszesitok.push(sum); if (this.s.osszesitok.length > 60) this.s.osszesitok.shift();
    this.s.nap = ujNap();
    this.s.napiBefizetve = 0; this.s.napiFelveve = 0;
    this._gyariNap();
    this.emit({ type: 'dayEnd', osszesito: sum });
  }
  /** A UI jelzi, hol jár a játékos (a motozás régiója ebből jön). */
  setPlayerPos(x, z) { this.s.hol = nearestNode(x, z); }

  // ------------------------------------------------------------ pillanatkép
  /** Csak olvasandó pillanatkép a UI-nak (frame-enként legfeljebb egyszer kérd le). */
  get state() {
    const s = this.s, c = this.core, now = this.now();
    const a = s.gyari.akcio && now <= s.gyari.akcio.eddig ? s.gyari.akcio : null;
    return {
      ido: { perc: now, nap: this.day(), ora: this.hour(), szoveg: this.clock(), nappal: this.isDay() },
      penz: { kp: Math.round(c.money), dunyha: Math.round(s.dunyha), szamla: Math.round(s.szamla), mosasSor: Math.round(s.mosasSor), mosasKapacitas: this.launderCapacity(),
        befizetheto: BANK.napiBefizetes - s.napiBefizetve, felveheto: BANK.napiFelvetel - s.napiFelveve },
      rang: this.rankInfo(),
      regiok: REGIONS.map(r => ({ id: r.id, nev: r.nev, nyitva: this.regionOpen(r.id), gyanu: Math.round(s.gyanu[r.id]),
        besugo: { nev: BESUGOK[r.id].nev, csendes: s.besugok[r.id].csendEddig > now }, gyariAkcio: a?.regio === r.id })),
      ingatlanok: PROPERTIES.map(p => {
        const ps = s.props[p.id];
        return { id: p.id, nev: p.nev, regio: p.regio, pos: p.pos, ar: p.ar, owned: ps.owned, agyak: p.slots, kemenysapka: ps.kemenysapka, autoPalack: ps.autoPalack,
          fak: ps.fak.map(f => f && { ...f, termo: f.kor >= GYUMOLCSOK[f.gyumolcs].erik, erett: f.termes >= 0.5 }),
          hordok: ps.hordok.map(h => ({ ...h, hatra: h.allapot === 'erjed' ? Math.max(0, h.kesz - now) : 0 })),
          ustok: ps.ustok.map(u => ({ szint: u.szint, nev: USTOK[u.szint].nev, csiga: u.csiga, allapot: u.allapot, hatra: u.allapot === 'auto' ? Math.max(0, u.vege - now) : 0,
            toltet: u.toltet && { ...u.toltet }, pecset: u.pecset > now ? u.pecset - now : 0 })),
          fust: ps.owned && this.fustol(p.id),
          rejtek: { kapacitas: p.rejtek, hasznalt: Math.round(this.literItt('rejtek:' + p.id) * 100) / 100 },
          szemElott: Math.round(this.literItt('prop:' + p.id) * 100) / 100,
          alkalmazottak: Object.values(s.alk).filter(x => x.prop === p.id).map(x => x.id) };
      }),
      keszlet: { cikkek: { ...s.inv }, gyumolcs: Object.fromEntries(Object.entries(s.gyumolcs).map(([k, v]) => [k, { kg: Math.round(v.kg), q: Math.round(v.q) }])) },
      tetelek: Object.values(s.tetelek).map(t => ({ ...t, effektNevek: t.effektek, ertekSzorzo: ertekSzorzo(t.effektek), ertek: this._ertek(t, t.l, null),
        erleles: t.erleles && { ...t.erleles, hordoNev: HORDOK[t.erleles.hordo].nev } })),
      nalad: Math.round(this.literItt('nalad') * 100) / 100,
      keziUst: s.kezi ? { ...s.kezi, futo: c.still.running, homerseklet: c.still.temp, futes: c.still.heat, haladas: c.still.p, edeny: c.still.vessel, fazis: c.phase(),
        minoseg: c.qualityPreview(), fok: c.fokPreview(), liter: c.still.prodL, toltet: c.still.charge } : null,
      vevok: this.customers(),
      rendelesek: this.orders().map(r => ({ ...r })),
      olvasatlan: s.uzenetek.filter(m => !m.olvasva).length,
      terjesztok: this.dealers(),
      szallitmanyok: this.deliveries(),
      alkalmazottak: this.employees(),
      uzletek: BUSINESSES.map(b => ({ ...b, sajat: !!s.uzletek[b.id], elerheto: this.regionOpen(b.regio) })),
      jarmuvek: { sajat: [...s.jarmuvek], aktiv: s.jarmu, kinalat: Object.entries(JARMUVEK).filter(([id]) => id !== 'gyalog').map(([id, j]) => ({ id, ...j, elerheto: this.rankIdx() >= j.rank })) },
      jarorok: this.patrols(),
      razziaFigyelmeztetes: s.razziak.filter(r => r.figyelmeztetve).map(r => ({ prop: r.prop, ido: r.ido })),
      kuldetes: { aktiv: this.activeQuest(), kesz: s.kuldetes.kesz.length },
      receptekSzama: Object.keys(s.receptek).length,
      hatasok: this.knownEffects(),
      gyari: { akcio: a ? { regio: a.regio, eddig: a.eddig } : null, ero: Math.round(s.gyari.ero * 100) / 100, legyozve: s.gyari.legyozve, nev: GYARI.nev },
      hol: s.hol, jarmu: s.jarmu,
      osszesito: s.utolso,
      stat: { ...s.stat },
    };
  }

  // ------------------------------------------------------------ mentés
  save() {
    const c = this.core;
    return JSON.stringify({ v: MENTES_VERZIO, seed: this.seed, s: this.s, core: { minutes: c.minutes, money: c.money, still: c.still, lastBatch: c.lastBatch, lastDay: c.lastDay } });
  }
  static load(str) {
    const d = typeof str === 'string' ? JSON.parse(str) : str;
    if (!d || d.v !== MENTES_VERZIO) throw new Error('Ismeretlen mentésformátum.');
    const E = new Empire(d.seed);
    E.s = d.s;
    Object.assign(E.core, d.core);
    return E;
  }
}

Object.assign(Empire.prototype, termeles, keveres, piac, torveny, birodalom, kuldetes);

export { TIME_SCALE, hu, ftHu as ft };
