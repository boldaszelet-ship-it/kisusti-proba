// Kisüsti — játéklogika, a világtól és a rajzolástól függetlenül.
// A böngészős játék (index.html) ezt hajtja, a tools/probe_kor.mjs Node alatt közvetlenül hívja.
// Minden idő valós másodpercben jön be; a játékidő percben fut.

export const TIME_SCALE = 6;              // 1 valós mp = 6 játékperc → 1 nap = 4 perc
export const DAY_START = 6 * 60;
export const FERMENT_MIN = 12 * 60;       // a cefre fél játéknap alatt erjed
export const BARREL_CAP = 60;
export const STILL_CAP = 20;
export const YIELD = 0.12;                // 10 l cefréből ~1,2 l párlat
export const FORE_END = 0.10;             // 0–10 %: előpárlat
export const HEART_END = 0.65;            // 10–65 %: középpárlat, utána utópárlat
export const IDEAL_T = 91;
export const FRUIT_PER_PICK = 4;
export const MARKET_KG = 10;
export const FINE = 50000;
export const CARRY_LIMIT = 3;             // ennél több kint lévő pálinka a pénzügyőrnél gond
export const WATER_STEP = 5;              // egy vizezés ennyi fokot visz le

export const DRINKS = {
  szilva: { nev: 'szilvapálinka', gyumolcs: 'szilva', gyumolcsot: 'szilvát', gyumolcsre: 'szilvára', ar: 8000, piac: 1500, szin: 0x4b2470 },
  barack: { nev: 'barackpálinka', gyumolcs: 'barack', gyumolcsot: 'barackot', gyumolcsre: 'barackra', ar: 10000, piac: 2500, szin: 0xe39a3b },
  korte:  { nev: 'körtepálinka',  gyumolcs: 'körte', gyumolcsot: 'körtét', gyumolcsre: 'körtére', ar: 9000,  piac: 2000, szin: 0xb7c24a },
};
export const TYPES = Object.keys(DRINKS);

// A vevők: szatíra a magyar ivási kultúrára. Nem az iváson nevetünk, hanem azon, amit
// mondunk róla („gyógyszer”, „egy kupica nem árt”, „ami hatvan alatt van, az üdítő”).
export const VEVOK = [
  { nev: 'Kovács bácsi', tipus: 'szilva', l: 0.5, minFok: 50, minQ: 40,
    keres: 'Egy kupicát reggelire. A gyomornak. Az orvos is mondta.',
    gyenge: 'Ezzel a gyomrot nem lehet fertőtleníteni, fiam.' },
  { nev: 'Marika néni', tipus: 'barack', l: 0.5, maxFok: 45, minQ: 50,
    keres: 'A vérnyomásomra, aranyom. Szigorúan gyógyászati célra.',
    eros: 'Ettől még a kanárim is berúgna! Gyengébbet, aranyom.' },
  { nev: 'Lajos, a násznagy', tipus: null, l: 2.0, minFok: 60, minQ: 30,
    keres: 'Lagzi lesz! Ami hatvan fok alatt van, az üdítő.',
    gyenge: 'Ez fröccs, nem pálinka. A vőfély ki fog nevetni.' },
  { nev: 'a kocsmáros', tipus: 'szilva', l: 1.5, minQ: 30, szorzo: 0.7,
    keres: 'A törzsvendégeknek. Úgyis vizezem, de ezt ne mondd el senkinek.' },
  { nev: 'a körzeti orvos', tipus: 'korte', l: 1.0, minFok: 50, minQ: 60,
    keres: 'Fertőtlenítésre. Belsőleg.',
    gyenge: 'Ezzel a bacilus is csak koccintana.' },
  { nev: 'a polgármester sógora', tipus: 'barack', l: 1.0, minFok: 50, minQ: 75, szorzo: 1.3,
    keres: 'Reprezentációs célra. Számlát nem kérek.' },
  { nev: 'Piroska, a postás', tipus: 'korte', l: 0.5, minQ: 40,
    keres: 'A nyugdíjasoknak viszem a nyugdíj mellé. Hagyomány.' },
];

/** Magyar szám: tizedesvessző, d tizedesjeggyel. */
export function hu(v, d = 1) { return Number(v).toFixed(d).replace('.', ','); }
/** Forint ezres tagolással (nem törhető szóköz nélkül, sima szóközzel). */
export function ft(v) { return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; }

/** A lepárlás p-edik pontján csepegő párlat erőssége (fok). */
export function fokAt(p) { return 78 - 52 * p; }

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function emptyStock() { const o = {}; for (const t of TYPES) o[t] = { l: 0, q: 0, fok: 0 }; return o; }

function merge(dst, l, q, fok) {
  if (l <= 0) return;
  const tot = dst.l + l;
  dst.q = (dst.q * dst.l + q * l) / tot;
  dst.fok = (dst.fok * dst.l + fok * l) / tot;
  dst.l = tot;
}

export class Sim {
  constructor(seed = Date.now()) {
    this.rand = rng(seed);
    this.listeners = [];
    this.minutes = DAY_START;
    this.money = 5000;
    this.fruit = { szilva: 0, barack: 0, korte: 0 };
    this.barrel = { l: 0, tipus: null, readyAt: -1 };
    this.mash = { szilva: 0, barack: 0, korte: 0 };
    this.out = emptyStock();
    this.cellar = emptyStock();
    this.still = this._freshStill();
    this.lastBatch = null;
    this.suspicion = 0;
    this.warned = false;
    this.inspectorDue = false;
    this.customer = null;
    this.customerCooldown = 20;
    this.lastDay = 1;
    this.stat = { eladott: 0, vizezes: 0, birsag: 0 };
  }

  on(fn) { this.listeners.push(fn); }
  msg(t) { for (const f of this.listeners) f(t); }

  // ------------------------------------------------------------ idő
  day() { return Math.floor(this.minutes / 1440) + 1; }
  hour() { return Math.floor((this.minutes % 1440) / 60); }
  clock() {
    const m = Math.floor(this.minutes % 1440);
    return `${this.day()}. nap  ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  isDay() { const h = this.hour(); return h >= 7 && h < 21; }

  /** Valós dt-vel lép; true, ha új nap kezdődött (a fák újra teremnek). */
  step(dt) {
    this.advance(dt * TIME_SCALE);
    this.stepStill(dt);
    this.stepSuspicion(dt);
    this.stepCustomer(dt);
    if (this.day() !== this.lastDay) { this.lastDay = this.day(); return true; }
    return false;
  }

  advance(m) {
    this.minutes += m;
    const b = this.barrel;
    if (b.readyAt >= 0 && this.minutes >= b.readyAt) {
      this.mash[b.tipus] += b.l;
      this.msg(`Megerjedt a ${DRINKS[b.tipus].gyumolcs}cefre: ${hu(b.l, 0)} l vár az üstre.`);
      b.l = 0; b.tipus = null; b.readyAt = -1;
    }
  }

  sleep() {
    let next = this.day() * 1440 + DAY_START;
    if (this.minutes % 1440 < DAY_START) next -= 1440;
    this.advance(next - this.minutes);
    this.suspicion = Math.max(0, this.suspicion - 25);
    this.msg('Kialudtad magad. A falu is elfelejtett ezt-azt.');
  }

  // ------------------------------------------------------------ gyümölcs, hordó
  pick(tipus) {
    this.fruit[tipus] += FRUIT_PER_PICK;
    this.msg(`+${FRUIT_PER_PICK} kg ${DRINKS[tipus].gyumolcs}`);
  }

  buy(tipus) {
    const ar = DRINKS[tipus].piac;
    if (this.money < ar) { this.msg(`Nincs elég pénzed ${DRINKS[tipus].gyumolcsre}.`); return false; }
    this.money -= ar;
    this.fruit[tipus] += MARKET_KG;
    this.msg(`Vettél ${MARKET_KG} kg ${DRINKS[tipus].gyumolcsot} (${ft(ar)}).`);
    return true;
  }

  fruitTotal() { return TYPES.reduce((a, t) => a + this.fruit[t], 0); }
  mainFruit() { return TYPES.reduce((b, t) => (this.fruit[t] > this.fruit[b] ? t : b), TYPES[0]); }
  fermenting() { return this.barrel.readyAt >= 0; }
  barrelLeft() { return Math.max(0, this.barrel.readyAt - this.minutes); }

  /** A legtöbb gyümölcsfajtát önti a hordóba (egyszerre egy fajta erjed). */
  fillBarrel() {
    if (this.fermenting()) { this.msg('A hordóban már erjed a cefre.'); return false; }
    if (this.fruitTotal() <= 0) { this.msg('Nincs nálad gyümölcs.'); return false; }
    const t = this.mainFruit();
    const l = Math.min(this.fruit[t], BARREL_CAP);
    this.fruit[t] -= l;
    Object.assign(this.barrel, { l, tipus: t, readyAt: this.minutes + FERMENT_MIN });
    this.msg(`${hu(l, 0)} l ${DRINKS[t].gyumolcs}cefre erjed. Fél nap, és mehet az üstbe.`);
    return true;
  }

  mashTotal() { return TYPES.reduce((a, t) => a + this.mash[t], 0); }

  // ------------------------------------------------------------ üst
  _freshStill() {
    return { running: false, tipus: null, charge: 0, heat: 0, temp: 20, p: 0, vessel: 'elo',
      prodL: 0, prodFore: 0, prodTail: 0, prodAlc: 0, waste: 0, stabSum: 0, stabW: 0, overT: 0 };
  }

  loadStill() {
    if (this.still.running) return false;
    const t = TYPES.reduce((b, x) => (this.mash[x] > this.mash[b] ? x : b), TYPES[0]);
    if (this.mash[t] < 1) { this.msg('Nincs kész cefre. Előbb a hordó.'); return false; }
    const s = this._freshStill();
    s.running = true; s.tipus = t; s.charge = Math.min(this.mash[t], STILL_CAP);
    this.mash[t] -= s.charge;
    this.still = s;
    this.msg(`${hu(s.charge, 0)} l ${DRINKS[t].gyumolcs}cefre az üstben. Fűts fel, és vágd le az előpárlatot!`);
    return true;
  }

  setHeat(h) { this.still.heat = Math.min(1, Math.max(0, h)); }

  phase() {
    const p = this.still.p;
    return p < FORE_END ? 'előpárlat' : p < HEART_END ? 'középpárlat' : 'utópárlat';
  }

  /** Vágás: elo (moslék) → sziv (palack) → uto (moslék). */
  cut() {
    const s = this.still;
    if (!s.running) return;
    if (s.vessel === 'elo') { s.vessel = 'sziv'; this.msg('Vágás: mostantól a palackba csepeg.'); }
    else if (s.vessel === 'sziv') { s.vessel = 'uto'; this.msg('Vágás: a palack lezárva, a többi moslék.'); }
  }

  stepStill(dt) {
    const s = this.still;
    if (!s.running) return;
    // minél kevesebb a folyadék, annál könnyebben forr: menet közben vissza kell venni
    const target = 20 + s.heat * 92 + s.p * 8;
    s.temp += (target - s.temp) * Math.min(1, 0.35 * dt);
    if (s.temp > 99) { s.overT += dt; if (s.overT > 2.5) this._boilOver(); }
    else s.overT = Math.max(0, s.overT - dt);
    if (s.temp < 80) return;
    const rate = 0.015 * Math.min(1.5, Math.max(0, (s.temp - 80) / 11));
    const dp = Math.min(rate * dt, 1 - s.p);
    const vol = dp * s.charge * YIELD;
    const mid = s.p + dp / 2;
    if (s.vessel === 'sziv') {
      s.prodL += vol;
      s.prodAlc += vol * fokAt(mid);
      if (mid < FORE_END) s.prodFore += vol;
      else if (mid >= HEART_END) s.prodTail += vol;
    } else s.waste += vol;
    s.stabSum += (Math.max(0, Math.abs(s.temp - IDEAL_T) - 3) / 10) * dp;
    s.stabW += dp;
    s.p += dp;
    if (s.p >= 0.999) this.finishStill();
  }

  _boilOver() {
    const s = this.still;
    s.overT = 0; s.temp = 85;
    const lost = s.charge * (1 - s.p) * 0.3;
    s.charge -= lost;
    this.addSuspicion(15);
    this.msg(`KIFUTOTT AZ ÜST! Odaveszett ${hu(lost)} l cefre, és az egész falu érzi a szagát.`);
  }

  qualityPreview() {
    const s = this.still;
    if (s.prodL <= 1e-4) return 0;
    const purity = Math.min(1, Math.max(0, (s.prodL - 3 * s.prodFore - s.prodTail) / s.prodL));
    const stab = s.stabW > 0 ? Math.min(1, Math.max(0.4, 1 - s.stabSum / s.stabW)) : 1;
    return Math.round(100 * purity * stab);
  }

  fokPreview() { const s = this.still; return s.prodL > 1e-4 ? s.prodAlc / s.prodL : 0; }

  finishStill() {
    const s = this.still;
    if (!s.running) return;
    const q = this.qualityPreview(), fok = this.fokPreview();
    s.running = false; s.heat = 0;
    if (s.prodL > 0.01) {
      merge(this.out[s.tipus], s.prodL, q, fok);
      this.lastBatch = { tipus: s.tipus, l: s.prodL, q, fok };
      this.msg(`Kész: ${hu(s.prodL, 2)} l ${DRINKS[s.tipus].nev}, ${hu(fok, 0)} fokos, minőség ${q}.`);
    } else {
      this.lastBatch = { tipus: s.tipus, l: 0, q: 0, fok: 0 };
      this.msg('Kész a főzés, de a palackba nem került semmi.');
    }
    s.charge = 0;
  }

  // ------------------------------------------------------------ készlet, kút, pince
  outTotal() { return TYPES.reduce((a, t) => a + this.out[t].l, 0); }
  cellarTotal() { return TYPES.reduce((a, t) => a + this.cellar[t].l, 0); }

  /** Vizezés a kútnál: minden kint lévő pálinka WATER_STEP fokkal gyengébb, cserébe több. */
  water() {
    let any = false;
    for (const t of TYPES) {
      const b = this.out[t];
      if (b.l <= 0.001 || b.fok <= 30) continue;
      b.l = b.l * b.fok / (b.fok - WATER_STEP);
      b.fok -= WATER_STEP;
      b.q = Math.max(0, b.q - 2);
      any = true;
    }
    if (!any) { this.msg('Nincs mit vizezni (30 fok alá nem megy: azt már a kút sem vállalja).'); return false; }
    this.stat.vizezes++;
    this.msg('Vizezés. „Vizezni bűn” — mondta nagyapád is, aztán vizezett.');
    return true;
  }

  toggleCellar() {
    if (this.outTotal() > 0.001) {
      for (const t of TYPES) { const b = this.out[t]; merge(this.cellar[t], b.l, b.q, b.fok); this.out[t] = { l: 0, q: 0, fok: 0 }; }
      this.msg('Minden pálinka le a pincébe.');
    } else if (this.cellarTotal() > 0.001) {
      for (const t of TYPES) { const b = this.cellar[t]; merge(this.out[t], b.l, b.q, b.fok); this.cellar[t] = { l: 0, q: 0, fok: 0 }; }
      this.msg('Felhoztad a pálinkát a pincéből.');
    } else this.msg('A pince üres.');
  }

  // ------------------------------------------------------------ gyanú, pénzügyőr
  addSuspicion(v) { this.suspicion = Math.min(100, Math.max(0, this.suspicion + v)); }

  stepSuspicion(dt) {
    if (this.still.running && this.still.temp > 60) this.suspicion += 0.6 * dt;
    else this.suspicion -= 0.12 * dt;
    this.suspicion = Math.min(100, Math.max(0, this.suspicion));
    if (this.suspicion >= 75 && !this.warned) {
      this.warned = true;
      this.msg('A szomszéd áthajol a kerítésen: „A pénzügyőr a faluban jár ám…”');
    }
    if (this.suspicion < 60) this.warned = false;
    if (this.suspicion >= 100) this.inspectorDue = true;
  }

  /** A pénzügyőr a kapuban. true, ha bírságolt. */
  inspect() {
    this.inspectorDue = false;
    const okok = [];
    if (this.still.running) okok.push('ég a tűz az üst alatt');
    if (this.outTotal() > CARRY_LIMIT) okok.push(`${hu(this.outTotal())} l pálinka van szem előtt`);
    if (!okok.length) {
      this.suspicion = 55;
      this.msg('A pénzügyőr körbeszimatolt. „Csak erre jártam.” Elment.');
      return false;
    }
    const fine = Math.min(FINE, this.money);
    this.money -= fine;
    this.out = emptyStock();
    if (this.still.running) { this.still.running = false; this.still.charge = 0; this.still.heat = 0; }
    this.suspicion = 40;
    this.stat.birsag++;
    this.msg(`BÍRSÁG: ${ft(fine)} (${okok.join(', ')}). Az üstöt lezárta, a kint lévő pálinkát elvitte. „Bizonyítéknak.”`);
    return true;
  }

  // ------------------------------------------------------------ vevők
  stepCustomer(dt) {
    if (this.customer) {
      this.customer.turelem -= dt;
      if (this.customer.turelem <= 0) {
        this.msg(`${this.customer.nev} megunta a várakozást, és átment a szomszédhoz.`);
        this.customer = null; this.customerCooldown = 30;
      }
      return;
    }
    if (!this.isDay()) return;
    this.customerCooldown -= dt;
    if (this.customerCooldown <= 0) this.spawnCustomer();
  }

  spawnCustomer(i = -1) {
    const v = VEVOK[i >= 0 ? i : Math.floor(this.rand() * VEVOK.length)];
    this.customer = { ...v, turelem: 75 };
    this.msg(`${v.nev} a kapuban: „${v.keres}”`);
    return this.customer;
  }

  /** A vevő kérése röviden: „0,5 l barackpálinka · max. 45 fok · min. 50 pont”. */
  wishText(c = this.customer) {
    if (!c) return '';
    const parts = [`${hu(c.l)} l ${c.tipus ? DRINKS[c.tipus].nev : 'bármilyen pálinka'}`];
    if (c.minFok) parts.push(`min. ${c.minFok} fok`);
    if (c.maxFok) parts.push(`max. ${c.maxFok} fok`);
    parts.push(`min. ${c.minQ} pont`);
    return parts.join(' · ');
  }

  price(tipus, l, q, fok, szorzo = 1) {
    return Math.round(l * DRINKS[tipus].ar * (0.5 + q / 100) * (0.6 + fok / 100) * szorzo);
  }

  /** Melyik kint lévő tétel felel meg a vevőnek; ha egyik sem, az ok szövege. */
  match(c = this.customer) {
    if (!c) return { tipus: null, ok: 'nincs vevő' };
    const types = c.tipus ? [c.tipus] : [...TYPES].sort((a, b) => this.out[b].fok - this.out[a].fok);
    let reason = `Nincs nálad ${hu(c.l)} l ${c.tipus ? DRINKS[c.tipus].nev : 'pálinka'}. (A pincében is lehet.)`;
    for (const t of types) {
      const b = this.out[t];
      if (b.l + 1e-4 < c.l) continue;
      if (c.minFok && b.fok + 1e-4 < c.minFok) { reason = `„${c.gyenge || 'Ez gyenge.'}” (${hu(b.fok, 0)} fokos, legalább ${c.minFok} kell)`; continue; }
      if (c.maxFok && b.fok - 1e-4 > c.maxFok) { reason = `„${c.eros || 'Ez túl erős.'}” (${hu(b.fok, 0)} fokos, legfeljebb ${c.maxFok} kell)`; continue; }
      if (b.q + 1e-4 < c.minQ) { reason = `„Ez kozmás, fiam.” (legalább ${c.minQ} pont kell, a tiéd ${Math.floor(b.q)})`; continue; }
      return { tipus: t, ok: null };
    }
    return { tipus: null, ok: reason };
  }

  sell() {
    const c = this.customer;
    if (!c) return false;
    const m = this.match(c);
    if (!m.tipus) {
      this.msg(m.ok);
      c.turelem = Math.min(c.turelem, 12);
      return false;
    }
    const b = this.out[m.tipus];
    const pay = this.price(m.tipus, c.l, b.q, b.fok, c.szorzo || 1);
    this.money += pay;
    b.l -= c.l;
    if (b.l < 0.001) this.out[m.tipus] = { l: 0, q: 0, fok: 0 };
    this.addSuspicion(10);
    this.stat.eladott += c.l;
    this.msg(`${c.nev} fizetett: ${ft(pay)}. „Egészségünkre!”`);
    this.customer = null;
    this.customerCooldown = 35 + this.rand() * 25;
    return true;
  }
}
