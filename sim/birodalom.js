// Kisüsti — birodalom: ingatlanok, alkalmazottak (bér, ágy, automatizált munka), tisztességes üzletek és pénzmosás,
// készpénz és számla napi limitekkel, járművek, rang és XP.
import { REGIONS, PROPERTIES, BUSINESSES } from '../data/regions.js';
import { hu } from '../sim.js';
import { SZEREPEK, BER_UVEG_L, RANGOK, SZINTEK, BANK, JARMUVEK, CIKKEK, USTOK, GYUMOLCSOK, HORDOK } from '../data/tartalom.js';
import { PROP } from './termeles.js';
import { TERJ } from './piac.js';

const BIZ = Object.fromEntries(BUSINESSES.map(b => [b.id, b]));
const REG = Object.fromEntries(REGIONS.map(r => [r.id, r]));

export function initBirodalom(s) {
  s.szamla = BANK.kezdoSzamla;
  s.dunyha = 0;
  s.inv = {};
  s.alk = {};
  s.uzletek = {};
  s.mosasSor = 0;
  s.napiBefizetve = 0; s.napiFelveve = 0;
  s.jarmuvek = ['gyalog'];
  s.jarmu = 'gyalog';
  s.xp = 0; s.szint = 0;
}

export const birodalom = {
  // ------------------------------------------------------------ készlet és pénz
  _db(id) { return this.s.inv[id] || 0; },
  _van(id, n) { return this._db(id) >= n; },
  _vesz(id, n) { this.s.inv[id] = this._db(id) - n; if (this.s.inv[id] <= 0) delete this.s.inv[id]; },
  _ad(id, n) { this.s.inv[id] = this._db(id) + n; },
  inventory() { return Object.entries(this.s.inv).map(([id, db]) => ({ id, db, nev: CIKKEK[id]?.nev || id, tipus: CIKKEK[id]?.tipus || '' })); },
  /** mod: 'kp' (készpénz: zseb, aztán dunyha), 'szamla', 'barmely' (előbb készpénz, aztán számla). */
  _fizet(osszeg, mod = 'kp') {
    if (osszeg <= 0) return true;
    const kp = this.core.money + this.s.dunyha, sz = this.s.szamla;
    const kpbol = () => { const z = Math.min(this.core.money, osszeg); this.core.money -= z; this.s.dunyha -= osszeg - z; };
    if (mod === 'kp' && kp >= osszeg) kpbol();
    else if (mod === 'szamla' && sz >= osszeg) this.s.szamla -= osszeg;
    else if (mod === 'barmely' && kp >= osszeg) kpbol();
    else if (mod === 'barmely' && sz >= osszeg) this.s.szamla -= osszeg;
    else return false;
    this.s.nap.kiadas += osszeg; this.s.stat.kiadas += osszeg;
    return true;
  },
  _bevetel(osszeg) { this.core.money += osszeg; this.s.nap.bevetel += osszeg; this.s.stat.bevetel += osszeg; },
  /** A falusi piac standja: 10 kg gyümölcs készpénzért, azonnal a kamrába. (Parancs, hogy közös játékban is a host könyvelje.) */
  buyFruit(tipus) {
    const c = CIKKEK['gyumolcs_' + tipus], kg = 10;
    if (!c || !this.s.gyumolcs[tipus]) return this.err('Ilyen gyümölcs nincs a piacon.', true);
    if (!this._fizet(c.ar, 'kp')) return this.err(`Nincs ${this.ft(c.ar)} a zsebedben.`, true);
    const st = this.s.gyumolcs[tipus];
    st.q = (st.q * st.kg + c.q * kg) / (st.kg + kg); st.kg += kg;
    return this.ok({ kg, ar: c.ar });
  },
  /** Buszjegy készpénzből (a gyorsutazás ára). */
  payFare(ar) {
    ar = Math.max(0, Math.round(+ar || 0));
    if (!this._fizet(ar, 'kp')) return this.err(`A jegy ${this.ft(ar)}. Nincs ennyi a zsebedben.`, true);
    return this.ok({ ar });
  },
  /** Készpénz a dunyha alá (a tanyán): a motozás nem találja, a vásárlás innen is fizet. */
  stash(osszeg) {
    osszeg = Math.floor(Math.min(osszeg ?? this.core.money, this.core.money));
    if (osszeg <= 0) return this.err('Nincs nálad készpénz.');
    this.core.money -= osszeg; this.s.dunyha += osszeg;
    return this.ok({ osszeg, dunyha: this.s.dunyha });
  },
  unstash(osszeg) {
    osszeg = Math.floor(Math.min(osszeg ?? this.s.dunyha, this.s.dunyha));
    if (osszeg <= 0) return this.err('A dunyha alatt nincs pénz.');
    this.s.dunyha -= osszeg; this.core.money += osszeg;
    return this.ok({ osszeg, dunyha: this.s.dunyha });
  },
  /** Készpénz összesen (zseb + dunyha). */
  cash() { return this.core.money + this.s.dunyha; },
  /** Befizetés a takarékba (napi limit, e fölött kérdeznék, honnan van). */
  deposit(osszeg) {
    osszeg = Math.floor(Math.min(osszeg, this.cash(), BANK.napiBefizetes - this.s.napiBefizetve));
    if (osszeg <= 0) return this.err(`Ma már nem fizethetsz be többet (napi ${this.ft(BANK.napiBefizetes)}). A többit mosd tisztára.`);
    this._fizet(osszeg, 'kp'); this.s.nap.kiadas -= osszeg; this.s.stat.kiadas -= osszeg;
    this.s.szamla += osszeg; this.s.napiBefizetve += osszeg;
    return this.ok({ osszeg });
  },
  withdraw(osszeg) {
    osszeg = Math.floor(Math.min(osszeg, this.s.szamla, BANK.napiFelvetel - this.s.napiFelveve));
    if (osszeg <= 0) return this.err(`Ma már nem vehetsz fel többet (napi ${this.ft(BANK.napiFelvetel)}).`);
    this.s.szamla -= osszeg; this.core.money += osszeg; this.s.napiFelveve += osszeg;
    return this.ok({ osszeg });
  },
  /** Pénzmosás: a készpénz a saját üzleteid kasszájába kerül, éjjel (a napi kapacitásig) a számlán landol. */
  launder(osszeg) {
    if (!Object.keys(this.s.uzletek).length) return this.err('Pénzmosáshoz előbb üzlet kell (kocsma, lángosos, bolt, autómosó).');
    osszeg = Math.floor(Math.min(osszeg, this.cash()));
    if (osszeg <= 0) return this.err('Nincs készpénzed.');
    this._fizet(osszeg, 'kp'); this.s.nap.kiadas -= osszeg; this.s.stat.kiadas -= osszeg;
    this.s.mosasSor += osszeg;
    this.msg(`${this.ft(osszeg)} a kasszába. „Ma nagyon jól ment az üzlet.”`);
    return this.ok({ osszeg, kapacitas: this.launderCapacity() });
  },
  launderCapacity() { return Object.keys(this.s.uzletek).reduce((a, id) => a + BIZ[id].mosas, 0); },
  _mosasNap() {
    const kap = this.launderCapacity();
    const m = Math.min(kap, this.s.mosasSor);
    if (m <= 0) return 0;
    this.s.mosasSor -= m;
    const tiszta = Math.round(m * (1 - BANK.mosasDij));
    this.s.szamla += tiszta;
    this.s.stat.mosott += tiszta; this.s.nap.mosott += tiszta;
    return tiszta;
  },
  buyBusiness(id) {
    const b = BIZ[id]; if (!b) return this.err('Nincs ilyen üzlet.');
    if (this.s.uzletek[id]) return this.err('Ez már a tiéd.');
    if (!this.regionOpen(b.regio)) return this.err(`${this.regionName(b.regio)} még nem nyílt meg neked.`);
    if (!this._fizet(b.ar, 'kp')) return this.err(`${b.nev}: ${this.ft(b.ar)} készpénzben.`);
    this.s.uzletek[id] = { nap: this.day() };
    this.msg(`Megvetted: ${b.nev}. Napi ${this.ft(b.mosas)} mosható tisztára.`);
    this.emit({ type: 'unlock', mit: 'uzlet', id });
    return this.ok({});
  },

  // ------------------------------------------------------------ ingatlan
  buyProperty(id) {
    const p = PROP[id]; if (!p) return this.err('Nincs ilyen ingatlan.');
    const ps = this.s.props[id];
    if (ps.owned) return this.err('Ez már a tiéd.');
    if (!this.regionOpen(p.regio)) return this.err(`${this.regionName(p.regio)} csak ${this.rangNev(REG[p.regio].rank)} rangtól nyílik meg.`);
    if (!this._fizet(p.ar, 'kp')) return this.err(`${p.nev}: ${this.ft(p.ar)} készpénzben. („Ingatlan? Itt mindenki készpénzzel fizet.”)`);
    ps.owned = true;
    this.s.stat.ingatlan++;
    this.s.stat.ingatlanNap[id] = this.day();
    this.msg(`Megvetted: ${p.nev}. ${p.ustok} üsthely, ${p.hordo} hordó, ${p.slots} ágy, ${p.rejtek} l rejtek.`);
    this.emit({ type: 'unlock', mit: 'ingatlan', id });
    this._questCheck();
    return this.ok({});
  },

  // ------------------------------------------------------------ alkalmazottak
  _alkItt(propId, szerep) { return Object.values(this.s.alk).filter(a => a.prop === propId && (!szerep || a.szerep === szerep)); },
  employees() { return Object.values(this.s.alk).map(a => ({ ...a, szerepNev: SZEREPEK[a.szerep].nev, feladat: SZEREPEK[a.szerep].feladat })); },
  hire(propId, szerep) {
    const p = PROP[propId], ps = this.s.props[propId], S = SZEREPEK[szerep];
    if (!ps?.owned) return this.err('Ez nem a te ingatlanod.');
    if (!S) return this.err('Ismeretlen szerep.');
    if (this._alkItt(propId).length >= p.slots) return this.err(`${p.nev}: nincs több ágy (${p.slots}).`);
    if (!this._fizet(S.ber, 'kp')) return this.err(`Az első napi bér ${this.ft(S.ber)} előre.`);
    const db = Object.values(this.s.alk).filter(a => a.szerep === szerep).length;
    const id = 'a' + (++this.s.nextId);
    const nev = szerep === 'feri' && db === 0 ? 'Feri bácsi' : S.nevek[db % S.nevek.length];
    this.s.alk[id] = { id, szerep, prop: propId, nev, ber: S.ber, tartozas: 0, foz: null };
    if (szerep === 'feri') this.s.stat.feri++;
    const ki = nev.toLowerCase().includes(S.nev.toLowerCase()) ? nev : `${nev} (${S.nev.toLowerCase()})`;
    this.msg(`${ki[0].toUpperCase() + ki.slice(1)} munkába állt (${p.nev}): ${S.feladat}. Napi ${this.ft(S.ber)}, vagy egy üveg.`);
    this._questCheck();
    return this.ok({ id, nev });
  },
  fire(empId) {
    const a = this.s.alk[empId]; if (!a) return this.err('Nincs ilyen alkalmazott.');
    if (a.foz) return this.err(`${a.nev} épp főz. Ha végzett, mehet.`);
    delete this.s.alk[empId];
    this.msg(`${a.nev} elment. „Majd szólj, ha kellek.”`);
    return this.ok({});
  },
  _berNap() {
    for (const a of Object.values(this.s.alk)) {
      if (this._fizet(a.ber, 'kp')) { a.tartozas = 0; continue; }
      const t = Object.values(this.s.tetelek).filter(x => (x.hely === 'prop:' + a.prop || x.hely === 'rejtek:' + a.prop) && x.l >= BER_UVEG_L && !x.erleles)[0];
      if (t) { const n = this._valaszt(t, BER_UVEG_L); delete this.s.tetelek[n.id]; this._torolUres(); this.s.nap.esemenyek.push(`${a.nev} ma egy üveggel érte be.`); a.tartozas = 0; continue; }
      a.tartozas++;
      if (a.tartozas >= 2) { delete this.s.alk[a.id]; this.s.nap.esemenyek.push(`${a.nev} felmondott: két napja nem kapott se pénzt, se pálinkát.`); }
    }
  },
  /** Melyik gyümölcsöt cefrézik az alkalmazottak: amiből van legalább 15 kg, és amiből a legkevesebb pálinka áll (cefrével együtt). */
  _cefreFajta() {
    const all = {};
    for (const t of Object.values(this.s.tetelek)) all[t.gyumolcs] = (all[t.gyumolcs] || 0) + t.l;
    for (const p of Object.values(this.s.props)) for (const h of p.hordok) if (h.gyumolcs) all[h.gyumolcs] = (all[h.gyumolcs] || 0) + h.l * 0.065;
    const jo = Object.keys(this.s.gyumolcs).filter(k => this.s.gyumolcs[k].kg >= 15);
    return jo.sort((a, b) => (all[a] || 0) - (all[b] || 0))[0] || null;
  },
  /** Óránkénti munka 6 és 21 óra között: a láncnak tényleg termelnie kell. */
  _alkOra() {
    const h = this.hour();
    if (h < 6 || h > 21) return;
    for (const a of Object.values(this.s.alk)) {
      const ps = this.s.props[a.prop];
      if (a.szerep === 'unokaocs') {
        ps.fak.forEach((f, i) => {
          if (!f) return;
          if (f.viz < 0.6) f.viz = 1;
          if (f.tragya <= 0 && this._van('tragya', 1)) { this._vesz('tragya', 1); f.tragya = 3; }
          if (f.termes >= 3) this.harvest(a.prop, i);
        });
      } else if (a.szerep === 'neni') {
        const h0 = ps.hordok.findIndex(x => x.allapot === 'ures');
        const gy = this._cefreFajta();
        if (h0 >= 0 && gy && this.s.gyumolcs[gy].kg >= 15) {
          const kg = Math.min(60, this.s.gyumolcs[gy].kg);
          this.fillBarrel(a.prop, h0, { gyumolcs: gy, kg, adalek: this._van('eleszto', Math.ceil(kg / 20)) ? ['eleszto'] : [] });
        }
        if (ps.autoPalack) {
          const t = Object.values(this.s.tetelek).find(x => (x.hely === 'prop:' + a.prop || x.hely === 'rejtek:' + a.prop) && !x.palack && !x.erleles && x.l >= 0.5);
          if (t) this.bottle(t.id, ps.autoPalack.meret, ps.autoPalack.cimke);
        }
      } else if (a.szerep === 'feri') {
        // ha nincs néni az ingatlanon, Feri bácsi maga cefréz
        const h0 = ps.hordok.findIndex(x => x.allapot === 'ures');
        const gy = this._cefreFajta();
        if (h0 >= 0 && gy && !this._alkItt(a.prop, 'neni').length && this.s.gyumolcs[gy].kg >= 15) {
          const kg = Math.min(60, this.s.gyumolcs[gy].kg);
          this.fillBarrel(a.prop, h0, { gyumolcs: gy, kg, adalek: this._van('eleszto', Math.ceil(kg / 20)) ? ['eleszto'] : [] });
        }
        if (a.foz) continue;
        const u = ps.ustok.findIndex(x => x.allapot === 'all' && x.pecset <= this.now());
        const b = ps.hordok.findIndex(x => x.allapot === 'kesz');
        // Feri bácsi magától nem főz éjjel („a füst a holdfényben is látszik”), csak ha éjszakai műszakot kértél
        const vege = (this.now() % 1440) + USTOK[ps.ustok[u]?.szint || 'kisusti'].ido;
        if (u >= 0 && b >= 0 && (ps.ejjel || vege <= 23 * 60)) this.startStill(a.prop, u, b, 'auto');
      } else if (a.szerep === 'sogor') {
        for (const d of Object.values(this.s.szallitmanyok)) if (d.allapot === 'megerkezett') this.pickup(d.id);
        for (const t of this.tetelekItt('prop:' + a.prop)) this.hide(t.id, a.prop);
        for (const [did, ds] of Object.entries(this.s.terjesztok)) {
          if (ds.lebukva > this.now() || this.literItt('terjeszto:' + did) >= 1) continue;
          const jelolt = Object.values(this.s.tetelek).filter(x => (x.hely === 'rejtek:' + a.prop || x.hely === 'prop:' + a.prop) && !x.erleles && x.l >= 0.5)
            .sort((x, y) => this._ertek(y, 1, null) - this._ertek(x, 1, null))[0];
          if (jelolt) this.stockDealer(did, jelolt.id, Math.min(3, jelolt.l));
        }
        if (this.hour() === 20) for (const did of Object.keys(this.s.terjesztok)) if (this.s.terjesztok[did].kp >= 1000) this.collect(did);
      }
    }
  },

  /** Éjszakai műszak: Feri bácsi éjjel is indít főzést (több pálinka, de a füst éjjel is látszik). */
  setNightShift(propId, be) {
    const ps = this.s.props[propId]; if (!ps?.owned) return this.err('Ez nem a te ingatlanod.');
    ps.ejjel = !!be; return this.ok({});
  },

  // ------------------------------------------------------------ járművek
  buyVehicle(id) {
    const J = JARMUVEK[id]; if (!J || id === 'gyalog') return this.err('Nincs ilyen jármű.');
    if (this.s.jarmuvek.includes(id)) return this.err('Ez már a tiéd.');
    if (this.rankIdx() < J.rank) return this.err(`${J.nev}: ${this.rangNev(J.rank)} rangtól.`);
    if (!this._fizet(J.ar, 'szamla')) return this.err(`${J.nev}: ${this.ft(J.ar)} a számládról (a kereskedő nem fogad el dunyha alól előkerült pénzt).`);
    this.s.jarmuvek.push(id); this.s.jarmu = id;
    this.msg(`Új jármű: ${J.nev}. Rejtett csomagtér: ${J.rejtett} l.`);
    this.emit({ type: 'unlock', mit: 'jarmu', id });
    return this.ok({});
  },
  /** Melyik járművel közlekedsz ('gyalog' is lehet). */
  useVehicle(id) {
    if (!this.s.jarmuvek.includes(id)) return this.err('Ez nem a te járműved.');
    this.s.jarmu = id; return this.ok({});
  },

  // ------------------------------------------------------------ rang, régiók
  rankIdx() { return SZINTEK[this.s.szint][0]; },
  rangNev(idx) { return RANGOK[idx]; },
  rankInfo() {
    const [r, alf, xp0] = SZINTEK[this.s.szint];
    const kov = SZINTEK[this.s.szint + 1];
    const romai = ['I', 'II', 'III', 'IV', 'V'][alf - 1];
    return { szint: this.s.szint, rang: r, alfok: alf, nev: `${RANGOK[r]} ${romai}`, xp: Math.floor(this.s.xp), szintXp: xp0, kovetkezoXp: kov ? kov[2] : null };
  },
  addXp(n) {
    this.s.xp += n;
    while (SZINTEK[this.s.szint + 1] && this.s.xp >= SZINTEK[this.s.szint + 1][2]) {
      const elotte = this.rankIdx();
      this.s.szint++;
      const info = this.rankInfo();
      this.msg(`Új rang: ${info.nev}!`);
      this.emit({ type: 'rankUp', ...info });
      this.emit({ type: 'sfx', id: 'rang' });
      if (this.rankIdx() > elotte) this._rangNyit(this.rankIdx());
      this.s.stat.rangNap[this.s.szint] = this.day();
    }
    this._questCheck?.();
  },
  _rangNyit(r) {
    for (const g of REGIONS.filter(x => x.rank === r)) { this.msg(`Megnyílt: ${g.nev}. ${g.leiras}`); this.emit({ type: 'unlock', mit: 'regio', id: g.id, nev: g.nev }); }
    for (const [id, c] of Object.entries(CIKKEK)) if (c.rank === r) this.emit({ type: 'unlock', mit: 'cikk', id, nev: c.nev });
    for (const [id, u] of Object.entries(USTOK)) if (u.rank === r && u.ar) this.emit({ type: 'unlock', mit: 'ust', id, nev: u.nev });
    for (const [id, j] of Object.entries(JARMUVEK)) if (j.rank === r && j.ar) this.emit({ type: 'unlock', mit: 'jarmu', id, nev: j.nev });
    for (const d of Object.values(TERJ)) if (d.rank === r) this.emit({ type: 'unlock', mit: 'terjeszto', id: d.id, nev: d.nev });
    for (const [id, g] of Object.entries(GYUMOLCSOK)) if (g.rank === r && r > 0) this.emit({ type: 'unlock', mit: 'gyumolcs', id, nev: g.gyumolcs });
    for (const [id, h] of Object.entries(HORDOK)) if (CIKKEK['hordo_' + id]?.rank === r) this.emit({ type: 'unlock', mit: 'hordo', id, nev: h.nev });
  },
  regionOpen(id) { return this.rankIdx() >= (REG[id]?.rank ?? 99); },
  regionName(id) { return REG[id]?.nev || id; },
  _propRegio(propId) { return PROP[propId]?.regio; },
};

export { hu };
