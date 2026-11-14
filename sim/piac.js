// Kisüsti — piac: vevőhálózat (ízlés, hűség, kóstoltatás), SMS-rendelések időablakkal és találkozóval,
// alku, terjesztők, beszállítók leadási ponttal, és a rivális „a Gyári”.
import { NODES, SUPPLIERS } from '../data/regions.js';
import { hu } from '../sim.js';
import {
  GYUMOLCSOK, VEVOK_TELJES, KOSTOL, TERJESZTOK, SZALLITOK, SZALLITMANY_ELVESZ, CIKKEK, HATASOK, UVEGEK, CIMKEK,
  DEMIZSON_SZORZO, TALALKOZOK, REGIO_TALALKOZOK, GYARI, XP, TORVENY, PIAC_SZORZO,
} from '../data/tartalom.js';
import { clamp } from './kozos.js';
import { ertekSzorzo } from './keveres.js';

export const VEVO = Object.fromEntries(VEVOK_TELJES.map(v => [v.id, v]));
export const TERJ = Object.fromEntries(TERJESZTOK.map(d => [d.id, d]));
export const SZALL = Object.fromEntries(SUPPLIERS.map(s => [s.id, { ...s, ...SZALLITOK[s.id] }]));

const ora = m => { const x = Math.floor(((m % 1440) + 1440) % 1440); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

export function initPiac(s) {
  s.vevok = {};
  VEVOK_TELJES.forEach((v, i) => {
    s.vevok[v.id] = { allapot: v.kezd ? 'aktiv' : 'ismeretlen', huseg: v.kezd ? 25 : 0, kov: v.kezd ? 7 * 60 + i * 95 : 0, terjeszto: null, kostolCd: 0, db: 0 };
  });
  s.rendelesek = {};
  s.uzenetek = [];
  s.terjesztok = {};
  s.szallitmanyok = {};
  s.gyari = { akcio: null, ero: 1, legyozve: false };
}

export const piac = {
  // ------------------------------------------------------------ érték
  /** Egy tétel l literjének értéke általában vagy egy vevő szemében (ízlés, igényesség, szorzó). */
  value(batchId, l, vevoId) {
    const t = typeof batchId === 'string' ? this.tetel(batchId) : batchId;
    if (!t) return 0;
    return this._ertek(t, l ?? t.l, vevoId ? VEVO[vevoId] : null);
  },
  _ertek(t, l, v) {
    const G = GYUMOLCSOK[t.gyumolcs];
    let p = l * G.ar * PIAC_SZORZO * (0.5 + t.q / 100) * (0.6 + t.fok / 100);
    p *= ertekSzorzo(t.effektek) * (1 + (t.erlelesSzorzo || 0));
    p *= t.palack ? UVEGEK[t.palack.meret].szorzo * CIMKEK[t.palack.cimke].szorzo : DEMIZSON_SZORZO;
    if (v) {
      p *= v.szorzo;
      const kedv = t.effektek.filter(e => v.kedvel.includes(e)).length;
      p *= 1 + 0.15 * Math.min(2, kedv);
      if (t.effektek.some(e => v.utal.includes(e))) p *= 0.7;
      if (v.igenyes && !t.palack) p *= 0.8;
    }
    return Math.round(p);
  },
  /** Mit kér: „0,5 l barackpálinka · max. 45 fok · min. 50 pont · Mézes”. */
  wishText(r) {
    const parts = [`${hu(r.l)} l ${r.gyumolcs ? GYUMOLCSOK[r.gyumolcs].nev : 'bármilyen pálinka'}`];
    if (r.minFok) parts.push(`min. ${r.minFok} fok`);
    if (r.maxFok) parts.push(`max. ${r.maxFok} fok`);
    parts.push(`min. ${r.minQ} pont`);
    if (r.hatas) parts.push(HATASOK[r.hatas].nev);
    return parts.join(' · ');
  },
  /** Megfelel-e a tétel a kérésnek; ha nem, a vevő válasza. */
  _megfelel(t, r, v) {
    if (r.gyumolcs && t.gyumolcs !== r.gyumolcs) return `„Én ${GYUMOLCSOK[r.gyumolcs].nev.slice(0, -1)}át kértem, fiam.”`;
    if (r.minFok && t.fok + 1e-4 < r.minFok) return `„${v.gyenge || 'Ez gyenge.'}” (${hu(t.fok, 0)} fokos, legalább ${r.minFok} kell)`;
    if (r.maxFok && t.fok - 1e-4 > r.maxFok) return `„${v.eros || 'Ez túl erős.'}” (${hu(t.fok, 0)} fokos, legfeljebb ${r.maxFok} kell)`;
    if (t.q + 1e-4 < r.minQ) return `„Ez kozmás, fiam.” (legalább ${r.minQ} pont kell, a tiéd ${Math.floor(t.q)})`;
    if (r.hatas && !t.effektek.includes(r.hatas)) return `„${HATASOK[r.hatas].nev} kell, nem ez.”`;
    return null;
  },

  // ------------------------------------------------------------ vevők
  /** Látható-e a vevő (a régió nyitva, és aki bemutatná, az már vevőd). */
  _elerheto(id) {
    const v = VEVO[id];
    if (!this.regionOpen(v.regio)) return false;
    return !v.ajanlo || this.s.vevok[v.ajanlo].allapot === 'aktiv';
  },
  customers() {
    return VEVOK_TELJES.filter(v => this._elerheto(v.id) || this.s.vevok[v.id].allapot === 'aktiv').map(v => {
      const st = this.s.vevok[v.id];
      return { id: v.id, nev: v.nev, regio: v.regio, allapot: st.allapot, huseg: Math.round(st.huseg), torzs: st.huseg >= 80, terjeszto: st.terjeszto,
        kostolhato: st.allapot !== 'aktiv' && this.now() >= st.kostolCd,
        izles: { gyumolcs: v.tipus, minFok: v.minFok || null, maxFok: v.maxFok || null, minQ: v.minQ, kedvel: v.kedvel, utal: v.utal, igenyes: v.igenyes },
        keres: v.keres, ajanlo: v.ajanlo };
    });
  },
  /** Kóstoltatás: 0,1 l a nálad lévő tételből. Ízlés szerint nyit új vevőt. → {ok, siker, valasz} */
  giveSample(customerId, batchId) {
    const v = VEVO[customerId], st = this.s.vevok[customerId];
    if (!v) return this.err('Nincs ilyen ember.');
    if (st.allapot === 'aktiv') return this.err(`${v.nev} már a vevőd.`);
    if (!this._elerheto(customerId)) return this.err(`${v.nev} még nem ismer téged.`);
    if (this.now() < st.kostolCd) return this.err(`${v.nev} ma már kóstolt. Holnap.`);
    const t = this.tetel(batchId);
    if (!t || t.hely !== 'nalad' || t.l < 0.1) return this.err('Kóstolóhoz legalább 1 deci kell nálad.');
    t.l -= 0.1; this._torolUres();
    let p = 0.3;
    if (!v.tipus || v.tipus === t.gyumolcs) p += 0.2;
    if ((!v.minFok || t.fok >= v.minFok) && (!v.maxFok || t.fok <= v.maxFok)) p += 0.2; else p -= 0.15;
    p += clamp((t.q - v.minQ) / 100, -0.3, 0.25);
    p += 0.12 * t.effektek.filter(e => v.kedvel.includes(e)).length;
    if (t.effektek.some(e => v.utal.includes(e))) p -= 0.25;
    if (v.igenyes && !t.palack) p -= 0.1;
    const siker = this.r() < clamp(p, 0.05, 0.95);
    const pool = siker ? KOSTOL.igen : KOSTOL.nem;
    const valasz = pool[Math.floor(this.r() * pool.length)];
    if (siker) {
      st.allapot = 'aktiv'; st.huseg = 30; st.kov = this.now() + 60 + this.r() * 300;
      this.s.stat.kostolo++; this.s.nap.ujVevok++;
      this.addXp(XP.ujVevo);
      this.msg(`${v.nev}: ${valasz} Új vevő!`);
      this.emit({ type: 'unlock', mit: 'vevo', id: customerId, nev: v.nev });
      this._questCheck();
    } else {
      st.kostolCd = this.now() + 1440;
      this.msg(`${v.nev}: ${valasz}`);
    }
    return this.ok({ siker, valasz, esely: Math.round(clamp(p, 0.05, 0.95) * 100) });
  },

  // ------------------------------------------------------------ SMS és rendelés
  _sms(kitol, nev, szoveg, extra = {}) {
    const m = { id: 'm' + (++this.s.nextId), kitol, nev, szoveg, ido: this.now(), olvasva: false, ...extra };
    this.s.uzenetek.push(m);
    if (this.s.uzenetek.length > 250) this.s.uzenetek.splice(0, this.s.uzenetek.length - 250);
    this.emit({ type: 'sms', uzenet: m });
    return m;
  },
  messages() { return [...this.s.uzenetek].reverse(); },
  markRead(id) { const m = this.s.uzenetek.find(x => x.id === id); if (m) m.olvasva = true; },
  orders() { return Object.values(this.s.rendelesek).filter(r => r.allapot === 'uj' || r.allapot === 'elfogadva'); },

  _gyariFaktor(regio, huseg) {
    const a = this.s.gyari.akcio;
    if (!a || a.regio !== regio || this.now() > a.eddig || huseg >= GYARI.husegVedelem) return { ar: 1, gyak: 1 };
    const e = this.s.gyari.ero;
    return { ar: 1 - (1 - GYARI.arSzorzo) * e, gyak: 1 - (1 - GYARI.gyakorisag) * e };
  },
  _kovRendeles(id) {
    const st = this.s.vevok[id], v = VEVO[id];
    const g = this._gyariFaktor(v.regio, st.huseg);
    st.kov = this.now() + 1440 * (0.8 + this.r() * 0.9) * (1.25 - st.huseg / 200) / g.gyak;
  },
  /** o (a történeti réteg felülírásai, mind elhagyható): {l, minFok, minQ, arSzorzo, ablak: [tól, ig] (abszolút perc),
   *  hely, csendes (SMS nélkül, azonnal elfogadva), cimke (a rendelés jelölése, pl. 'lakodalom')} */
  _ujRendeles(id, o = {}) {
    const v = VEVO[id], st = this.s.vevok[id];
    const lmin = v.l[0], lmax = v.l[1];
    const l = o.l ?? Math.max(0.5, Math.round((lmin + this.r() * (lmax - lmin)) * 2) / 2);
    const helyek = v.hely ? [v.hely] : REGIO_TALALKOZOK[v.regio];
    const hely = o.hely ?? helyek[Math.floor(this.r() * helyek.length)];
    const ismertKedv = v.kedvel.filter(e => this.s.hatasok[e]);
    const hatas = st.huseg >= 30 && ismertKedv.length && this.r() < 0.4 ? ismertKedv[Math.floor(this.r() * ismertKedv.length)] : null;
    const minFok = o.minFok ?? (v.minFok || null), minQ = o.minQ ?? v.minQ;
    const q = minQ + 12, fok = minFok ? minFok + 3 : v.maxFok ? v.maxFok - 3 : 52;
    const G = GYUMOLCSOK[v.tipus || 'szilva'];
    const g = this._gyariFaktor(v.regio, st.huseg);
    const b = this.s.arBonusz && this.now() <= this.s.arBonusz.eddig ? this.s.arBonusz.szorzo : 1;   // versenyérem: N napig drágábban
    const arNyers = l * G.ar * PIAC_SZORZO * (0.5 + q / 100) * (0.6 + fok / 100) * v.szorzo * (hatas ? 1.15 + HATASOK[hatas].ertek : 1) * g.ar * (1 + st.huseg / 500) * b * (o.arSzorzo ?? 1);
    const ar = Math.round(arNyers / 100) * 100;
    const kezd = this.now() + 30, hossz = 360 + this.r() * 300;
    const r = { id: 'r' + (++this.s.nextId), vevo: id, nev: v.nev, l, gyumolcs: v.tipus, minFok, maxFok: v.maxFok || null, minQ, hatas,
      ar, ablak: o.ablak ? [...o.ablak] : [kezd, kezd + hossz], hely, helyNev: TALALKOZOK[hely].nev, pos: NODES[hely], regio: TALALKOZOK[hely].regio, allapot: o.csendes ? 'elfogadva' : 'uj', alkuk: 0, ido: this.now() };
    if (o.cimke) r.cimke = o.cimke;
    this.s.rendelesek[r.id] = r;
    st.nyitott = r.id;
    const szoveg = `„${v.keres}” Kérem: ${this.wishText(r)}. Hely: ${r.helyNev}, ${ora(r.ablak[0])}–${ora(r.ablak[1])}. Fizetek ${this.ft(ar)}.`;
    if (!o.csendes) this._sms(id, v.nev, szoveg, { rendeles: r.id });
    this.emit({ type: 'order', rendeles: { ...r } });
    return r;
  },
  /** Kényszerített rendelés (a történeti réteg: első vevő a kapuban, a lagzi 20 litere). A nyitott rendelést lezárja.
   *  o: mint a _ujRendeles felülírásai, plusz {elfogad}: SMS-sel jön, de azonnal elfogadva. → a rendelés másolata */
  forceOrder(vevoId, o = {}) {
    const st = this.s.vevok[vevoId];
    if (!st || !VEVO[vevoId]) return this.err('Nincs ilyen vevő.', true);
    if (st.nyitott && this.s.rendelesek[st.nyitott]) this.s.rendelesek[st.nyitott].allapot = 'elutasitva';
    const r = this._ujRendeles(vevoId, o);
    if (o.elfogad && r.allapot === 'uj') r.allapot = 'elfogadva';
    return this.ok({ rendeles: { ...r } });
  },
  acceptOrder(orderId) {
    const r = this.s.rendelesek[orderId];
    if (!r || r.allapot !== 'uj') return this.err('Ez a rendelés már nem él.');
    r.allapot = 'elfogadva';
    this._sms('en', 'Te', `Rendben, ${ora(r.ablak[0])} és ${ora(r.ablak[1])} között ott leszek: ${r.helyNev}.`);
    return this.ok({ rendeles: { ...r } });
  },
  declineOrder(orderId) {
    const r = this.s.rendelesek[orderId];
    if (!r || (r.allapot !== 'uj' && r.allapot !== 'elfogadva')) return this.err('Ez a rendelés már nem él.');
    r.allapot = 'elutasitva';
    this.s.vevok[r.vevo].huseg = Math.max(0, this.s.vevok[r.vevo].huseg - 2);
    this.s.vevok[r.vevo].nyitott = null;
    this._kovRendeles(r.vevo);
    return this.ok({});
  },
  /** Alku a rendelés áráról (átadás előtt). → {elfogad, ellenajanlat} */
  haggle(orderId, ar) {
    const r = this.s.rendelesek[orderId];
    if (!r || (r.allapot !== 'uj' && r.allapot !== 'elfogadva')) return { ok: false, elfogad: false, ellenajanlat: null, hiba: 'Ez a rendelés már nem él.' };
    const st = this.s.vevok[r.vevo];
    if (ar <= r.ar) { r.ar = Math.round(ar); return { ok: true, elfogad: true, ellenajanlat: null, valasz: '„Na, ez beszéd!”' }; }
    const hatar = r.alapAr ?? r.ar;
    r.alapAr = hatar;
    const limit = hatar * (1.12 + st.huseg / 600);
    r.alkuk++;
    if (ar <= limit) {
      r.ar = Math.round(ar / 100) * 100;
      st.huseg = Math.max(0, st.huseg - 1);
      return { ok: true, elfogad: true, ellenajanlat: null, valasz: '„Hát jó. De a következőnél engedsz.”' };
    }
    if (r.alkuk >= 3) {
      r.allapot = 'elutasitva'; st.huseg = Math.max(0, st.huseg - 8); st.nyitott = null; this._kovRendeles(r.vevo);
      this._sms(r.vevo, r.nev, '„Ennyiért a Gyáriban két üveget kapok. Hagyjuk.”');
      return { ok: true, elfogad: false, ellenajanlat: null, valasz: '„Hagyjuk.”', megszakadt: true };
    }
    const ellen = Math.round(((r.ar + limit) / 2) / 100) * 100;
    return { ok: true, elfogad: false, ellenajanlat: ellen, valasz: `„Ennyit nem ér, fiam. ${this.ft(ellen)}, és kezet fogunk.”` };
  },
  /** Átadás a találkozón. ar: amit kérsz (alapból a rendelés ára); ha a pálinka megéri, az árat is elfogadja.
   *  → {ok, alku, valasz, fizetett?, ellenajanlat?} */
  deliver(orderId, batchId, l, ar) {
    const r = this.s.rendelesek[orderId];
    if (!r || (r.allapot !== 'uj' && r.allapot !== 'elfogadva')) return { ok: false, alku: false, valasz: 'Ez a rendelés már nem él.' };
    const v = VEVO[r.vevo], st = this.s.vevok[r.vevo];
    const now = this.now();
    if (now < r.ablak[0]) return { ok: false, alku: false, valasz: `„Korán jöttél. ${ora(r.ablak[0])}-tól várlak.”` };
    if (now > r.ablak[1]) return { ok: false, alku: false, valasz: '„Elkéstél.”' };
    const t = this.tetel(batchId);
    if (!t) return { ok: false, alku: false, valasz: 'Nincs ilyen tétel.' };
    const tp = this._propOf(t);
    if (t.hely !== 'nalad' && !(tp && this._propRegio(tp) === r.regio)) return { ok: false, alku: false, valasz: 'Ez a pálinka nincs nálad.' };
    l = l ?? r.l;
    if (t.palack) l = Math.ceil(l / UVEGEK[t.palack.meret].l - 1e-6) * UVEGEK[t.palack.meret].l;
    if (l + 1e-6 < r.l) return { ok: false, alku: false, valasz: `„${hu(r.l)} litert kértem.”` };
    if (t.l + 1e-6 < l) return { ok: false, alku: false, valasz: `Nincs ennyi a tételben (${hu(t.l, 2)} l).` };
    const hiba = this._megfelel(t, r, v);
    if (hiba) { st.huseg = Math.max(0, st.huseg - 3); return { ok: false, alku: false, valasz: hiba }; }
    const ertek = this._ertek(t, l, v);
    ar = Math.round(ar ?? r.ar);
    const plafon = Math.max(r.ar, ertek) * (1 + st.huseg / 400);
    if (ar > plafon) {
      r.alkuk++;
      st.huseg = Math.max(0, st.huseg - 2);
      const ellen = Math.round(Math.max(r.ar, Math.min(ar, ertek)) / 100) * 100;
      return { ok: false, alku: true, ellenajanlat: ellen, valasz: `„Ennyit nem ér, fiam. ${this.ft(ellen)}, és kezet fogunk.”` };
    }
    // fizet
    const n = this._valaszt(t, l);
    delete this.s.tetelek[n.id];
    this._torolUres();
    this._bevetel(ar, 'eladas');
    r.allapot = 'kesz'; r.fizetett = ar; st.nyitott = null; st.db++;
    const elotte = st.huseg;
    st.huseg = clamp(st.huseg + 6 + (ertek > r.ar * 1.15 ? 5 : 0) + (t.effektek.some(e => v.kedvel.includes(e)) ? 4 : 0), 0, 100);
    if (elotte < 80 && st.huseg >= 80) this.msg(`${v.nev} mostantól törzsvendég.`);
    this._kovRendeles(r.vevo);
    this.addXp(ar * XP.eladasFt);
    this.addSuspicion(r.regio, TORVENY.eladas * (st.huseg >= 60 ? 0.5 : 1), 'eladas');
    this.s.stat.eladas++; this.s.stat.eladottL += l;
    this.s.nap.eladottL += l;
    this.s.nap.regioEladas[r.regio] = (this.s.nap.regioEladas[r.regio] || 0) + ar;
    if (r.regio === 'kisvaros') this.s.stat.kisvaros++;
    const a = this.s.gyari.akcio;
    if (a && a.regio === r.regio && this.now() <= a.eddig && t.q >= 80) this._gyariGyengul();
    const rk = this.s.receptek[Object.keys(this.s.receptek).find(k => this.s.receptek[k].nev === t.nev)];
    if (rk) rk.legjobbAr = Math.max(rk.legjobbAr, Math.round(ar / l));
    const valasz = `„${v.koszon}”`;
    this.msg(`${v.nev} fizetett: ${this.ft(ar)}. ${valasz}`);
    this.emit({ type: 'sale', vevo: r.vevo, rendeles: r.id, ar, l, regio: r.regio });
    this.emit({ type: 'sfx', id: 'penz', pos: r.pos });
    this._questCheck();
    return { ok: true, alku: ar > r.ar, valasz, fizetett: ar, ertek };
  },
  _rendelesTick() {
    const now = this.now(), h = this.hour();
    for (const r of Object.values(this.s.rendelesek)) {
      if ((r.allapot === 'uj' || r.allapot === 'elfogadva') && now > r.ablak[1]) {
        const st = this.s.vevok[r.vevo];
        st.huseg = Math.max(0, st.huseg - (r.allapot === 'elfogadva' ? 10 : 3));
        r.allapot = 'lejart'; st.nyitott = null;
        this._kovRendeles(r.vevo);
        const a = this.s.gyari.akcio;
        this._sms(r.vevo, r.nev, a && a.regio === VEVO[r.vevo].regio ? '„Na, akkor majd a Gyáriban veszek.”' : '„Nem jöttél. Átmentem a szomszédhoz.”');
        this.emit({ type: 'orderExpired', rendeles: r.id, vevo: r.vevo });
      }
      if (r.allapot !== 'uj' && r.allapot !== 'elfogadva' && now - r.ablak[1] > 2 * 1440) delete this.s.rendelesek[r.id];
    }
    if (h < 7 || h >= 19) return;
    for (const v of VEVOK_TELJES) {
      const st = this.s.vevok[v.id];
      if (st.allapot !== 'aktiv' || now < st.kov) continue;
      if (st.terjeszto) { this._terjesztoElad(st.terjeszto, v.id); continue; }
      if (st.nyitott) continue;
      this._ujRendeles(v.id);
    }
  },

  // ------------------------------------------------------------ terjesztők
  dealers() {
    return TERJESZTOK.map(d => {
      const st = this.s.terjesztok[d.id];
      return { ...d, felveve: !!st, elerheto: this.rankIdx() >= d.rank && this.regionOpen(d.regio),
        vevok: st ? [...st.vevok] : [], keszletL: st ? this.literItt('terjeszto:' + d.id) : 0, kp: st ? Math.round(st.kp) : 0,
        lebukva: st ? st.lebukva > this.now() : false, osszes: st ? Math.round(st.osszes) : 0 };
    });
  },
  hireDealer(dealerId) {
    const d = TERJ[dealerId]; if (!d) return this.err('Nincs ilyen terjesztő.');
    if (this.s.terjesztok[dealerId]) return this.err(`${d.nev} már nálad dolgozik.`);
    if (this.rankIdx() < d.rank || !this.regionOpen(d.regio)) return this.err(`${d.nev} csak ${this.rangNev(d.rank)} ranggal áll szóba veled.`);
    if (!this._fizet(d.felvetel, 'kp')) return this.err(`A belépő ${this.ft(d.felvetel)} készpénzben.`);
    this.s.terjesztok[dealerId] = { vevok: [], kp: 0, osszes: 0, lebukva: 0 };
    this.s.stat.terjeszto++;
    this.msg(`${d.nev}: „${d.mondas}”`);
    this.emit({ type: 'unlock', mit: 'terjeszto', id: dealerId });
    this._questCheck();
    return this.ok({});
  },
  /** Vevőt rendelsz egy terjesztőhöz (dealerId = null: visszaveszed). */
  assign(customerId, dealerId) {
    const st = this.s.vevok[customerId]; if (!st) return this.err('Nincs ilyen vevő.');
    if (st.allapot !== 'aktiv') return this.err('Csak a meglévő vevőidet adhatod át.');
    if (st.terjeszto) { const o = this.s.terjesztok[st.terjeszto]; o.vevok = o.vevok.filter(x => x !== customerId); st.terjeszto = null; }
    if (!dealerId) return this.ok({});
    const d = TERJ[dealerId], ds = this.s.terjesztok[dealerId];
    if (!ds) return this.err('Ez a terjesztő nem nálad dolgozik.');
    if (ds.vevok.length >= d.maxVevo) return this.err(`${d.nev} legfeljebb ${d.maxVevo} vevőt visz.`);
    ds.vevok.push(customerId); st.terjeszto = dealerId;
    if (st.nyitott) { const r = this.s.rendelesek[st.nyitott]; if (r) r.allapot = 'atadva'; st.nyitott = null; }
    return this.ok({});
  },
  stockDealer(dealerId, batchId, l) {
    const ds = this.s.terjesztok[dealerId]; if (!ds) return this.err('Ez a terjesztő nem nálad dolgozik.');
    if (ds.lebukva > this.now()) return this.err(`${TERJ[dealerId].nev} most lapít.`);
    const t = this.tetel(batchId); if (!t) return this.err('Nincs ilyen tétel.');
    if (t.hely !== 'nalad' && !this._propOf(t)) return this.err('Ez a tétel nem a tiéd.');
    if (t.erleles) return this.err('Érlelődik.');
    const n = this._valaszt(t, Math.min(l ?? t.l, t.l));
    n.hely = 'terjeszto:' + dealerId;
    return this.ok({ id: n.id, l: n.l });
  },
  collect(dealerId) {
    const ds = this.s.terjesztok[dealerId]; if (!ds) return this.err('Ez a terjesztő nem nálad dolgozik.');
    const kp = Math.round(ds.kp);
    ds.kp = 0;
    if (kp > 0) { this.core.money += kp; this.msg(`${TERJ[dealerId].nev} leszámolt: ${this.ft(kp)}.`); this.emit({ type: 'sfx', id: 'penz' }); }
    return this.ok({ osszeg: kp });
  },
  _terjesztoElad(dealerId, vevoId) {
    const ds = this.s.terjesztok[dealerId], d = TERJ[dealerId], v = VEVO[vevoId], st = this.s.vevok[vevoId];
    this._kovRendeles(vevoId);
    if (ds.lebukva > this.now()) return;
    const l = Math.max(0.5, Math.round(((v.l[0] + v.l[1]) / 2) * 2) / 2);
    const r = { gyumolcs: v.tipus, minFok: v.minFok, maxFok: v.maxFok, minQ: v.minQ, hatas: null, l };
    const kesz = this.tetelekItt('terjeszto:' + dealerId).filter(t => t.l + 1e-6 >= l && !this._megfelel(t, r, v))
      .sort((a, b) => this._ertek(b, l, v) - this._ertek(a, l, v));
    if (!kesz.length) {
      st.huseg = Math.max(0, st.huseg - 2);
      if (!ds.szolt || this.now() - ds.szolt > 360) { ds.szolt = this.now(); this._sms(dealerId, d.nev, `„${v.nev} kérne ${this.wishText(r)}, de nincs nálam ilyen. Hozz utánpótlást.”`); }
      return;
    }
    const t = kesz[0];
    const ar = Math.round(this._ertek(t, l, v) * 0.95);
    const n = this._valaszt(t, l); delete this.s.tetelek[n.id]; this._torolUres();
    ds.kp += ar * (1 - d.jutalek); ds.osszes += ar;
    st.huseg = clamp(st.huseg + 3, 0, 100); st.db++;
    this.s.stat.terjesztoBevetel += ar * (1 - d.jutalek);
    this.s.nap.terjesztoBevetel += ar * (1 - d.jutalek);
    this.s.stat.eladottL += l; this.s.nap.eladottL += l;
    this.addXp(ar * XP.terjesztoFt);
    this.addSuspicion(v.regio, TORVENY.terjesztoEladas, 'terjeszto');
    this.emit({ type: 'sale', vevo: vevoId, terjeszto: dealerId, ar, l, regio: v.regio });
  },
  _terjesztoNap() {
    for (const [id, ds] of Object.entries(this.s.terjesztok)) {
      if (ds.lebukva > this.now()) continue;
      const d = TERJ[id];
      const keszletL = this.literItt('terjeszto:' + id);
      if (keszletL < 0.05 && ds.kp < 1) continue; // akinél nincs semmi, azt nem lehet rajtakapni
      const p = d.kockazat * (0.4 + this.suspicionAt(d.regio) / 100) * (1 + keszletL / 15 + ds.kp / 200000);
      if (this.r() < p) {
        const elv = keszletL, kp = Math.round(ds.kp);
        for (const t of this.tetelekItt('terjeszto:' + id)) delete this.s.tetelek[t.id];
        ds.kp = 0; ds.lebukva = this.now() + 2 * 1440;
        this.addSuspicion(d.regio, 12, 'terjeszto');
        this.s.stat.terjesztoBukas++;
        this.s.nap.esemenyek.push(`${d.nev} lebukott: odalett ${hu(elv, 1)} l és ${this.ft(kp)}.`);
        this._sms(id, d.nev, `„Lebuktam. Elvitték, ami nálam volt (${hu(elv, 1)} l, ${this.ft(kp)}). Két napig lapítok.”`);
      }
    }
  },

  // ------------------------------------------------------------ beszállítók
  suppliers() {
    return Object.values(SZALL).map(s => ({ id: s.id, nev: s.nev, regio: s.regio, hely: s.hely, leadas: s.leadas, fizetes: s.fizetes,
      elerheto: this.rankIdx() >= s.rank, cikkek: Object.entries(CIKKEK).filter(([, c]) => c.sz === s.id)
        .map(([id, c]) => ({ id, nev: c.nev, ar: c.ar, tipus: c.tipus, elerheto: this.rankIdx() >= (c.rank || 0) })) }));
  },
  /** Rendelés: fizetés a beszállító módja szerint; a leadási ponton kell átvenni (E.pickup), vagy a sógor hozza. → {ok, erkezes, hely, id} */
  order(supplierId, tetel, db = 1) {
    const S = SZALL[supplierId], C = CIKKEK[tetel];
    if (!S) return this.err('Nincs ilyen beszállító.');
    if (!C || C.sz !== supplierId) return this.err(`${S.nev} ilyet nem árul.`);
    if (this.rankIdx() < S.rank) return this.err(`${S.nev} csak ${this.rangNev(S.rank)} rangtól szállít neked.`);
    if (this.rankIdx() < (C.rank || 0)) return this.err(`${C.nev}: ${this.rangNev(C.rank)} rangtól.`);
    db = Math.max(1, Math.floor(db));
    const osszeg = C.ar * db;
    if (!this._fizet(osszeg, S.fizetes)) return this.err(`Nincs ${this.ft(osszeg)} (${S.fizetes === 'kp' ? 'készpénz' : S.fizetes === 'szamla' ? 'számla' : 'készpénz vagy számla'}).`);
    const erkezes = this.now() + S.ido[0] + this.r() * (S.ido[1] - S.ido[0]);
    const id = 'sz' + (++this.s.nextId);
    this.s.szallitmanyok[id] = { id, sz: supplierId, tetel, db, erkezes, hely: S.hely, helyNev: S.leadas, pos: NODES[S.hely], allapot: 'uton' };
    this.msg(`Rendelve: ${db} × ${C.nev} (${this.ft(osszeg)}). Érkezik ${ora(erkezes)}-kor: ${S.leadas}.`);
    return this.ok({ id, erkezes, hely: S.hely, helyNev: S.leadas, pos: NODES[S.hely] });
  },
  deliveries() { return Object.values(this.s.szallitmanyok).filter(d => d.allapot !== 'atveve').map(d => ({ ...d })); },
  /** A megérkezett szállítmány átvétele a leadási ponton. */
  pickup(deliveryId) {
    const d = this.s.szallitmanyok[deliveryId];
    if (!d) return this.err('Nincs ilyen szállítmány.');
    if (d.allapot === 'uton') return this.err(`Még úton van (${ora(d.erkezes)}).`);
    if (d.allapot !== 'megerkezett') return this.err('Ezt már átvetted, vagy elvitte valaki.');
    const C = CIKKEK[d.tetel];
    if (C.tipus === 'gyumolcs') {
      const st = this.s.gyumolcs[C.gy], kg = 10 * d.db;
      st.q = (st.q * st.kg + C.q * kg) / (st.kg + kg); st.kg += kg;
    } else this._ad(d.tetel, d.db);
    d.allapot = 'atveve';
    delete this.s.szallitmanyok[deliveryId];
    return this.ok({ tetel: d.tetel, db: d.db });
  },
  _szallitTick() {
    for (const d of Object.values(this.s.szallitmanyok)) {
      if (d.allapot === 'uton' && this.now() >= d.erkezes) {
        d.allapot = 'megerkezett';
        this.emit({ type: 'delivery', szallitmany: { ...d } });
        this._sms(d.sz, SZALL[d.sz].nev, `„Ott van, ahol megbeszéltük: ${d.helyNev}.” (${d.db} × ${CIKKEK[d.tetel].nev})`);
      } else if (d.allapot === 'megerkezett' && this.now() > d.erkezes + SZALLITMANY_ELVESZ) {
        d.allapot = 'elveszett';
        this.msg(`A ${CIKKEK[d.tetel].nev} szállítmányt elvitte valaki a leadási pontról.`);
        delete this.s.szallitmanyok[d.id];
      }
    }
  },

  // ------------------------------------------------------------ a Gyári
  _gyariGyengul() {
    const g = this.s.gyari;
    g.ero = Math.max(0.2, g.ero - 0.04);
    if (!g.legyozve && g.ero <= 0.6) {
      g.legyozve = true;
      this._sms('gyari', 'a Gyári', '„Átmeneti készlethiány miatt akcióink szünetelnek.” A falu szerint: a te pálinkád miatt.');
      this._questCheck();
    }
  },
  _gyariNap() {
    const g = this.s.gyari;
    if (this.day() < GYARI.kezdNap) return;
    if (g.akcio && this.now() <= g.akcio.eddig) return;
    const er = this.s.tegnap?.regioEladas || {};
    const jelolt = Object.keys(er).filter(r => this.regionOpen(r)).sort((a, b) => er[b] - er[a])[0];
    if (!jelolt) { g.akcio = null; return; }
    g.akcio = { regio: jelolt, eddig: this.now() + GYARI.akcioNap * 1440 };
    g.ero = Math.min(1, g.ero + 0.05);
    const sz = GYARI.szlogenek[Math.floor(this.r() * GYARI.szlogenek.length)];
    this._sms('gyari', 'a Gyári', sz);
    this.s.nap.esemenyek.push(`A Gyári akciót hirdetett: ${this.regionName(jelolt)}.`);
  },
};
