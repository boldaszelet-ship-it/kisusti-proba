// Kisüsti coop — az Empire két coop-arca. Mindkettőnek ugyanaz az alakja, így a játék egy kódúton dolgozik:
//
//   EmpireProxy (kliens): árnyék-Empire a host deltáiból. Az olvasók (state, tetel, mixPreview, value, recipes…)
//     helyben, szinkron, pontosan válaszolnak; a parancsok a hostra mennek, és ígéretet adnak vissza.
//   HostKapu (host): a valódi Empire elé áll; az olvasók közvetlenül, a parancsok ugyanazon a fogás/ütközés-szűrőn át,
//     mint a klienseké (a host nem előzheti meg a vendéget), és szintén ígéretet adnak.
//
// A kézi üst a bérlő gépén helyben fut (setHeat/cut azonnal hat, a hőmérő ugyanabban a frame-ben mozdul); a host
// a fűtés/vágás-sort visszajátssza. Ilyenkor a setHeat/cut szinkron (mint az Empire-ben), nem ígéret.
import { Empire, MENTES_VERZIO } from '../../sim/empire.js';
import { OLVASO, PARANCS, CSAK_HOST } from './protokoll.js';
import { alkalmaz } from './delta.js';

const UST_LEPES = 0.25;   // az Empire.step szelete: a helyi üst pontosan így lép, hogy a host visszajátszása bitre egyezzen

export class EmpireProxy {
  constructor(coop, teljes) {
    this.coop = coop;
    this.figyelok = [];
    this.keretek = [];          // a bérelt üst még el nem küldött lépései
    this.sajatBerlet = false;
    this._ver = 0; this._allapotVer = -1; this._allapot = null;
    this.teljes(teljes);
  }

  /** Teljes tükör a hostról (belépés, újracsatlakozás, hézag). */
  teljes(m) {
    const E = Empire.load({ v: MENTES_VERZIO, seed: m.seed, s: m.a.s, core: m.a.core });
    // az árnyék nem hoz döntést: a főzés lezárása és a kifutás gyanúja a host dolga
    E.core.finishStill = () => { E.core.still.running = false; E.core.still.heat = 0; };
    E.core.addSuspicion = () => {};
    this.E = E;
    this.q = m.q;
    this.gyoker = { get s() { return E.s; }, set s(v) { E.s = v; }, core: E.core };
    this.sajatBerlet = !!(m.meta?.berlet && m.meta.berlet.ki === this.coop.te && !m.meta.berlet.arva && E.s.kezi);
    this._ver++;
  }
  /** Delta a hostról. Hézagnál teljes tükröt kér. */
  delta(m) {
    if (m.q !== this.q + 1) { if (m.q > this.q) this.coop._teljesKer(); return; }
    const kihagy = this.sajatBerlet ? ut => ut.startsWith('core/still') : null;
    try { alkalmaz(this.gyoker, m.o, kihagy); } catch (e) { console.warn('[coop]', e.message); this.coop._teljesKer(); return; }
    this.q = m.q;
    this._ver++;
    if (m.e) for (const e of m.e) this._kiad(e);
  }
  _kiad(e) {
    // a saját vágás hangja már helyben szólt
    if (e.type === 'sfx' && e.id === 'vagas' && e.ki === this.coop.te && this.sajatBerlet) return;
    for (const f of this.figyelok) f(e);
  }
  esemeny(e) { this._kiad(e); }
  /** Helyi esemény (a játék saját üzenete, pl. J.uzen): csak ezen a gépen, a hostnak nem megy. */
  emit(e) { this._kiad(e); }
  /** Bérlet-üzenet: kezdet (a pontos üstállapottal), szinkron a visszatérés után, vagy vége. */
  berlet(m) {
    if (m.ki === this.coop.te && m.still) { this.E.core.still = { ...m.still }; this.sajatBerlet = true; this.keretek = []; }
    else { this.sajatBerlet = false; if (m.still) this.E.core.still = { ...m.still }; }
    this._ver++;
  }
  /** A coop hívja minden válasz előtt: a bérlet a startStill válaszával indul, még mielőtt a hívó tovább futna. */
  valaszElott(nev, r) {
    if ((nev === 'startStill' || nev === 'ustAtvesz') && r?.ok && r.still) this.berlet({ ki: this.coop.te, still: r.still });
  }

  // ------------------------------------------------------------ az Empire alakja
  on(fn) { this.figyelok.push(fn); return () => { this.figyelok = this.figyelok.filter(f => f !== fn); }; }
  get state() {
    if (this._allapotVer !== this._ver) { this._allapot = this.E.state; this._allapotVer = this._ver; }
    return this._allapot;
  }
  get core() { return this.E.core; }
  get s() { return this.E.s; }
  get seed() { return this.E.seed; }
  /** A kliens fő hurka hívja: a bérelt üst helyben lép (a host ugyanezt a sort kapja meg). */
  step(dt) {
    if (!this.sajatBerlet) return;
    const c = this.E.core;
    let left = dt;
    while (left > 1e-9 && c.still.running) {
      const d = Math.min(left, UST_LEPES);
      this.keretek.push([d, c.still.heat]);
      c.stepStill(d);
      left -= d;
    }
    this._ver++;
  }
  advance() { return Promise.resolve({ ok: false, hiba: 'Az idő a házigazdánál telik.' }); }
  setPlayerPos(x, z) { this.coop._sajatXZ = [x, z]; }
  setHeat(h) {
    if (this.sajatBerlet) { this.E.core.setHeat(h); this._ver++; return; }
    return this.coop.kuld('setHeat', h);
  }
  cut() {
    if (this.sajatBerlet) {
      if (!this.E.core.still.running) return;
      this.E.core.cut(); this.keretek.push('c'); this._ver++;
      this._kiad({ type: 'sfx', id: 'vagas', ki: this.coop.te, helyi: true });
      return;
    }
    return this.coop.kuld('cut');
  }
  finishStill() {
    if (this.sajatBerlet) { this.E.core.finishStill(); this.keretek.push('f'); this._ver++; return; }
    return this.coop.kuld('finishStill');
  }
  /** Árva (gazdátlan) kézi üst átvétele: aki odaáll, folytatja. */
  ustAtvesz() { return this.coop.kuld('ustAtvesz'); }
  /** Lefekvés visszavonása (az alvás-szavazásból). */
  alvasMegse() { return this.coop.kuld('alvasMegse'); }
  /** A még el nem küldött üst-keretek (a coop időzítője viszi a hostnak `ustKeretMs`-enként). */
  keretekKi() { const f = this.keretek; this.keretek = []; return f; }
}
for (const n of OLVASO) EmpireProxy.prototype[n] = function (...a) { return this.E[n](...a); };
for (const n of PARANCS) if (!(n in EmpireProxy.prototype)) EmpireProxy.prototype[n] = function (...a) { return this.coop.kuld(n, ...a); };
for (const n of CSAK_HOST) if (!(n in EmpireProxy.prototype)) EmpireProxy.prototype[n] = function () { return Promise.resolve({ ok: false, hiba: 'Ezt csak a házigazda futtathatja.' }); };

export class HostKapu {
  constructor(coop, E, mag) { this.coop = coop; this.E = E; this.mag = mag; }
  on(fn) { this.mag.helyiFigyelok.push(fn); return () => { this.mag.helyiFigyelok = this.mag.helyiFigyelok.filter(f => f !== fn); }; }
  /** Helyi esemény (a játék saját üzenete, pl. J.uzen): csak a host képernyőjén, a vendégekhez nem megy. */
  emit(e) { for (const f of this.mag.helyiFigyelok) f(e); }
  get state() { return this.E.state; }
  get core() { return this.E.core; }
  get s() { return this.E.s; }
  get seed() { return this.E.seed; }
  step(dt) { this.E.step(dt); this.mag.lepesUtan(); }
  setPlayerPos(x, z) { this.mag.hostXZ = [x, z]; this.E.setPlayerPos(x, z); }
  ustAtvesz() { return this.coop.kuld('ustAtvesz'); }
  alvasMegse() { return this.coop.kuld('alvasMegse'); }
}
for (const n of OLVASO) HostKapu.prototype[n] = function (...a) { return this.E[n](...a); };
for (const n of [...PARANCS, ...CSAK_HOST]) if (!(n in HostKapu.prototype)) HostKapu.prototype[n] = function (...a) { return this.coop.kuld(n, ...a); };
