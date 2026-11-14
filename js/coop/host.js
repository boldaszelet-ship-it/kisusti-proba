// Kisüsti coop — a host oldala: itt fut az egyetlen igazi Empire. A kliensek szándékot küldenek (parancs azonosítóval),
// a host sorban végrehajtja, dönt az ütközésről, és a változást deltában szórja szét.
//
// Szabályok:
//  • Fogás: egy sikeres parancs után a tárgy (hordó, üst, tétel, rendelés…) `fogasMs`-ig a parancsadóé. Ha közben más
//    nyúl ugyanahhoz, a host nem hajtja végre, és mindkét félnek `utkozes` eseményt küld (ki fogja, mit).
//  • Üstbérlet: a kézi üst azé, aki elindította. A bérlő gépén fut a minigame; a host a bérlő fűtés/vágás-sorát
//    (dt, fűtés) PONTOSAN ugyanabban a lépésközben játssza vissza, ezért a két gépen bitre ugyanaz az eredmény.
//    Ha a bérlő kiesik vagy `berletArvaMs`-ig nem küld keretet, a host átveszi: fűtés 0 (hűl, nem fut ki), és bárki
//    átveheti (`ustAtvesz`).
//  • Alvás: csak ha minden online játékos lefeküdt; `alvasMs` után a szavazás elévül.
//  • Mentés: `mentesMp`-enként és minden napfordulón a relére is felmegy; a host kilépésekor (vagy kiesésekor)
//    a relé mindenkinek kiosztja. A kliensek tükre maga is teljes mentést tud adni (EmpireProxy.save()).
import { HANGOLAS as H, PARANCS, CSAK_HOST, kulcsok } from './protokoll.js';
import { klonoz, kulonbseg } from './delta.js';

const UST_PARANCS = ['setHeat', 'cut', 'finishStill'];
const RTT_ORA = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const pontosMasolat = o => JSON.parse(JSON.stringify(o));
const UST_LEPES = 0.25;   // ugyanaz a szelet, amivel az Empire.step a kézi üstöt lépteti

export class HostMag {
  constructor(coop, E) {
    this.coop = coop;
    this.E = E;
    this.q = 0;                       // a delta sorszáma
    this.alap = klonoz(this._elo());  // az utoljára kiküldött állapot
    this.fogas = new Map();           // kulcs → {ki, ig}
    this.berlet = null;               // {ki, propId, ustIdx, kulcs, utolso, arva}
    this.alvas = null;                // {igen: Map(ki → id|null), ig}
    this.kesz = new Map();            // ki → Map(id → válasz): újraküldött parancs ne fusson kétszer
    this.puffer = [];                 // a következő deltával együtt kimenő események
    this.ki = null;                   // a most futó parancs gazdája (az események ezt kapják)
    this.helyiFigyelok = [];
    this.utolsoLepes = RTT_ORA();
    this.utolsoMentes = RTT_ORA();
    this.hostXZ = null;
    this.stat = { parancs: 0, utkozes: 0, deltaMs: 0, deltaDb: 0 };
    // A host saját Empire-jén a kézi üst csak akkor lép magától, ha nem távoli bérlő viszi (őt a keretei léptetik).
    const eredeti = Object.getPrototypeOf(E.core).stepStill;
    this._ustLep = dt => eredeti.call(E.core, dt);
    E.core.stepStill = dt => { if (this._tavoliBerlet() && !this._visszajatszas) return; this._ustLep(dt); };
    this.leiratkozik = E.on(e => this._esemeny(e));
  }

  _elo() { const c = this.E.core; return { s: this.E.s, core: { minutes: c.minutes, money: c.money, still: c.still, lastBatch: c.lastBatch, lastDay: c.lastDay } }; }
  _tavoliBerlet() { return !!(this.berlet && this.berlet.ki !== this.coop.te && !this.berlet.arva); }
  get te() { return this.coop.te; }

  // ------------------------------------------------------------ események
  _esemeny(e) {
    const x = this.ki ? { ...e, ki: this.ki } : e;
    for (const f of this.helyiFigyelok) if (!(x.hiba && x.ki && x.ki !== this.te)) f(x);
    if (x.hiba && x.ki) { if (x.ki !== this.te) this.coop._neki(x.ki, { t: 'e', e: x }); }
    else this.puffer.push(x);
    if (e.type === 'dayEnd') this.mentesFel();
  }
  /** Delta (és az addig gyűlt események) ki most: parancs után, a válasz előtt, hogy a válaszra a tükör már friss legyen. */
  kifele(kotelezo = false) {
    const t0 = RTT_ORA();
    const o = kulonbseg(this._elo(), this.alap);
    this.stat.deltaMs += RTT_ORA() - t0; this.stat.deltaDb++;
    if (!o.length && !this.puffer.length && !kotelezo) return;
    const uzenet = { t: 'd', q: ++this.q, o };
    if (this.puffer.length) { uzenet.e = this.puffer; this.puffer = []; }
    this.coop._mindenkinek(uzenet);
  }
  /** Teljes tükör egy játékosnak (belépés, újracsatlakozás, sorszám-hézag). */
  teljes(ki) {
    this.kifele();
    this.coop._neki(ki, { t: 'teljes', q: this.q, seed: this.E.seed, a: this.alap, meta: this.meta() });
  }
  meta() {
    const b = this.berlet;
    return { berlet: b && { ki: b.ki, propId: b.propId, ustIdx: b.ustIdx, arva: b.arva },
      alvas: this.alvas && { igen: [...this.alvas.igen.keys()], kell: this._online(), ig: this.alvas.ig } };
  }
  metaKi() { const m = this.meta(); this.coop._mindenkinek({ t: 'meta', ...m }); this.coop._metaHelyben(m); }
  mentesFel() { this.utolsoMentes = RTT_ORA(); this.coop._relenek({ t: 'mentes', adat: this.E.save() }); }
  _online() { return this.coop.jatekosok.filter(j => j.online).map(j => j.id); }

  // ------------------------------------------------------------ parancs
  /** Egy parancs végrehajtása. Visszaad: válasz-objektum, vagy null, ha a válasz később jön (alvás-szavazás). */
  vegrehajt(ki, id, nev, args = []) {
    const tar = this.kesz.get(ki);
    if (id != null && tar?.has(id)) return tar.get(id);
    const r = this._futtat(ki, id, nev, Array.isArray(args) ? args : []);
    if (r === null) return null;
    this._tarol(ki, id, r);
    return r;
  }
  _tarol(ki, id, r) {
    if (id == null) return;
    let tar = this.kesz.get(ki); if (!tar) this.kesz.set(ki, tar = new Map());
    tar.set(id, r); if (tar.size > 64) tar.delete(tar.keys().next().value);
  }
  _futtat(ki, id, nev, a) {
    const E = this.E, most = RTT_ORA();
    this.stat.parancs++;
    if (nev === 'sleep') return this._alvasSzavaz(ki, id);
    if (nev === 'alvasMegse') return this._alvasMegse(ki);
    if (nev === 'ustAtvesz') return this._ustAtvesz(ki);
    if (CSAK_HOST.includes(nev)) { if (ki !== this.te) return { ok: false, hiba: 'Ezt csak a házigazda futtathatja.' }; }
    else if (!PARANCS.includes(nev)) return { ok: false, hiba: `Ismeretlen parancs: ${nev}` };
    if (UST_PARANCS.includes(nev) && this.berlet && this.berlet.ki !== ki) return this._utkozes(ki, nev, this.berlet.kulcs, this.berlet.ki);
    const ks = kulcsok(nev, a);
    for (const k of ks) {
      const f = this.fogas.get(k);
      if (f && f.ki !== ki && (f.berlet || f.ig > most)) return this._utkozes(ki, nev, k, f.ki);
    }
    let r;
    this.ki = ki;
    const visszaPoz = nev === 'searchPlayer' && ki !== this.te && this._jatekosXZ(ki);
    try {
      if (visszaPoz) E.setPlayerPos(visszaPoz[0], visszaPoz[1]);
      r = E[nev](...a);
    } catch (e) { r = { ok: false, hiba: `Hiba a hoston: ${e.message}` }; }
    finally {
      if (visszaPoz && this.hostXZ) E.setPlayerPos(this.hostXZ[0], this.hostXZ[1]);
      this.ki = null;
    }
    if (r === undefined) r = { ok: true };
    if (r && typeof r === 'object' && r.ok !== false) {
      for (const k of ks) this.fogas.set(k, { ki, ig: most + H.fogasMs });
      if (nev === 'startStill' && (a[3] ?? 'kezi') === 'kezi' && E.s.kezi) this._berletKezd(ki, a[0], a[1]);
    }
    r = pontosMasolat(r);
    if (nev === 'startStill' && this.berlet?.ki === ki && r.ok) r.still = pontosMasolat(E.core.still);
    // a host saját üstkezelése frame-enként jön: azt a 10 Hz-es ütem viszi ki, nem minden setHeat
    if (!UST_PARANCS.includes(nev)) this.kifele();
    return r;
  }
  _utkozes(ki, parancs, kulcs, kie) {
    this.stat.utkozes++;
    const nevE = id => this.coop.jatekosok.find(j => j.id === id)?.nev || id;
    const e = { type: 'utkozes', kulcs, kie, kieNev: nevE(kie), ki, kiNev: nevE(ki), parancs };
    this.coop._coopEsemeny(e, [ki, kie]);
    return { ok: false, hiba: `${nevE(kie)} már fogja (${kulcs}).`, utkozes: { kulcs, kie, kieNev: nevE(kie) } };
  }
  _jatekosXZ(ki) { const p = this.coop.jatekosPoz(ki); return p ? [p.x, p.z] : null; }

  // ------------------------------------------------------------ üstbérlet
  _berletKezd(ki, propId, ustIdx) {
    const kulcs = `ust:${propId}:${ustIdx}`;
    this.berlet = { ki, propId, ustIdx, kulcs, utolso: RTT_ORA(), arva: false, n: null };
    this.fogas.set(kulcs, { ki, ig: Infinity, berlet: true });
    this.metaKi();
  }
  _berletVege() {
    const b = this.berlet; if (!b) return;
    this.fogas.delete(b.kulcs);
    this.berlet = null;
    this.kifele();
    this.coop._mindenkinek({ t: 'berlet', ki: null, vege: true, still: pontosMasolat(this.E.core.still) });
    this.metaKi();
  }
  /** A bérlő fűtés/vágás-sora: [dt, fűtés] lépések, 'c' = vágás, 'f' = befejezés; `n` a csomag sorszáma. */
  ustKeretek(ki, f, n) {
    const b = this.berlet;
    if (!b || b.ki !== ki || !Array.isArray(f)) return;
    const hezag = n != null && b.n != null && n !== b.n + 1;   // kiesésnél elveszett csomag: a két üst elválna
    if (b.arva || hezag) {   // a bérlő helyi példánya elavult: előbb szinkron (a közben jött kereteket eldobjuk)
      b.arva = false; b.utolso = RTT_ORA(); b.n = null;
      this.coop._neki(ki, { t: 'berlet', ki, still: pontosMasolat(this.E.core.still), szinkron: true });
      this.metaKi();
      return;
    }
    b.n = n ?? null;
    b.utolso = RTT_ORA();
    this._visszajatszas = true; this.ki = ki;
    try {
      for (const x of f) {
        if (!this.E.s.kezi) break;
        if (x === 'c') this.E.cut();
        else if (x === 'f') this.E.finishStill();
        else if (Array.isArray(x)) { this.E.core.setHeat(+x[1] || 0); this._ustLep(Math.min(UST_LEPES, Math.max(0, +x[0] || 0))); }
      }
    } finally { this._visszajatszas = false; this.ki = null; }
    if (!this.E.s.kezi) this._berletVege();
  }
  _ustAtvesz(ki) {
    const b = this.berlet;
    if (!b) return { ok: false, hiba: 'Nem fő kézi üst.' };
    if (b.ki === ki) return { ok: true, still: pontosMasolat(this.E.core.still) };
    const online = this._online().includes(b.ki);
    if (!b.arva && online) return this._utkozes(ki, 'ustAtvesz', b.kulcs, b.ki);
    b.ki = ki; b.arva = false; b.utolso = RTT_ORA(); b.n = null;
    this.fogas.set(b.kulcs, { ki, ig: Infinity, berlet: true });
    this.metaKi();
    return { ok: true, still: pontosMasolat(this.E.core.still) };
  }
  _arvaKeres() {
    const b = this.berlet;
    if (!b || b.arva || b.ki === this.te) return;
    if (RTT_ORA() - b.utolso > H.berletArvaMs || !this._online().includes(b.ki)) {
      b.arva = true; this.E.core.setHeat(0); this.metaKi();
    }
  }

  // ------------------------------------------------------------ alvás
  _alvasSzavaz(ki, id) {
    if (this.E.s.kezi) return { ok: false, hiba: 'Előbb fejezd be a főzést: az üstöt nem hagyod magára.' };
    if (!this.alvas) this.alvas = { igen: new Map(), ig: Date.now() + H.alvasMs };
    this.alvas.igen.set(ki, id);
    if (this._alvasKesz()) return null;   // mindenki (ő is) a _valaszol-on át kapta meg
    this.metaKi();
    return null;
  }
  _alvasMegse(ki) {
    const a = this.alvas; if (!a || !a.igen.has(ki)) return { ok: true };
    this._valaszol(ki, a.igen.get(ki), { ok: false, hiba: 'Meggondoltad: nem fekszel le.' });
    a.igen.delete(ki);
    if (!a.igen.size) this.alvas = null;
    this.metaKi();
    return { ok: true };
  }
  _alvasKesz() {
    const a = this.alvas; if (!a) return false;
    const kell = this._online();
    if (!kell.every(k => a.igen.has(k))) return false;
    this.alvas = null;
    let r;
    try { r = pontosMasolat(this.E.sleep()); } catch (e) { r = { ok: false, hiba: e.message }; }
    this.kifele();
    for (const [k, id] of a.igen) this._valaszol(k, id, r);
    this.metaKi();
    return true;
  }
  _alvasIdo() {
    const a = this.alvas; if (!a) return;
    if (Date.now() > a.ig) {
      this.alvas = null;
      for (const [k, id] of a.igen) this._valaszol(k, id, { ok: false, hiba: 'Az alvás elmaradt: nem feküdt le mindenki.' });
      this.metaKi();
    } else this._alvasKesz();
  }
  _valaszol(ki, id, r) { this._tarol(ki, id, r); this.coop._valasz(ki, id, r); }

  // ------------------------------------------------------------ ütem
  /** A host fő hurka hívja minden E.step után (a HostKapu.step). */
  lepesUtan() { this.utolsoLepes = RTT_ORA(); if (this.puffer.length) this.kifele(); }
  /** A coop időzítője hívja `deltaHz`-en. */
  utem() {
    const most = RTT_ORA();
    if (this.coop.hatterLepes && most - this.utolsoLepes > H.hatterLepesMs) {
      // háttérfül vagy szünetmenü: a közös idő nem állhat meg a host miatt. A plafon 60 mp, mert a Chrome a régóta
      // rejtett fül időzítőit percenként egyre fogja vissza; ennél nagyobb ugrás már inkább alvás/hiba.
      this.E.step(Math.min(H.hatterPlafonMp, (most - this.utolsoLepes) / 1000));
      this.utolsoLepes = most;
    }
    this._arvaKeres();
    this._alvasIdo();
    if (this.berlet && !this.E.s.kezi) this._berletVege();
    for (const [k, f] of this.fogas) if (!f.berlet && f.ig < most) this.fogas.delete(k);
    this.kifele();
    if (most - this.utolsoMentes > H.mentesMp * 1000) this.mentesFel();
  }
  jatekosKi(ki) { this._arvaKeres(); if (this.alvas) { this.alvas.igen.delete(ki); this._alvasKesz(); this.metaKi(); } }
  leall() { this.leiratkozik?.(); delete this.E.core.stepStill; }
}
