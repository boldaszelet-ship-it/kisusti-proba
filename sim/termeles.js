// Kisüsti — termelés: gyümölcsös, cefre, üstök (kézi minigame és automata), érlelés, palackozás, vizezés, tételek.
import { PROPERTIES } from '../data/regions.js';
import { BARREL_CAP, FERMENT_MIN, WATER_STEP, hu } from '../sim.js';
import {
  GYUMOLCSOK, FA, ADALEKOK, CEFRE_ROMLIK_ORA, USTOK, USTSOR, CSIGA, KEMENYSAPKA, AUTO_KIHOZATAL,
  HORDOK, UVEGEK, CIMKEK, CIKKEK, HATASOK, MAX_HATAS, KEZDES, XP,
} from '../data/tartalom.js';
import { clamp } from './kozos.js';
import { receptNev } from './keveres.js';

export const PROP = Object.fromEntries(PROPERTIES.map(p => [p.id, p]));

function ujHordo() { return { allapot: 'ures', gyumolcs: null, l: 0, q: 0, kesz: 0, kihozatal: 1, adalek: [] }; }
function ujUst() { return { szint: 'kisusti', csiga: false, allapot: 'all', vege: 0, toltet: null, pecset: 0, technika: 0 }; }

export function initTermeles(s) {
  s.props = {};
  for (const p of PROPERTIES) {
    s.props[p.id] = {
      owned: p.ar === 0,
      fak: Array(p.kert).fill(null),
      hordok: Array.from({ length: p.hordo }, ujHordo),
      ustok: Array.from({ length: p.ustok }, ujUst),
      kemenysapka: false,
      autoPalack: null,
    };
  }
  KEZDES.fak.forEach(([gy], i) => {
    const g = GYUMOLCSOK[gy];
    s.props.tanya.fak[i] = { gyumolcs: gy, kor: g.erik, viz: 0.8, tragya: 0, permet: 0, kartevo: false, termes: g.kg * 1.6, q: 72 };
  });
  s.gyumolcs = Object.fromEntries(Object.keys(GYUMOLCSOK).map(k => [k, { kg: 0, q: 0 }]));
  s.tetelek = {};
  s.kezi = null;
}

function mergeQ(dst, kg, q) {
  if (kg <= 0) return;
  dst.q = (dst.q * dst.kg + q * kg) / (dst.kg + kg);
  dst.kg += kg;
}

export const termeles = {
  // ------------------------------------------------------------ tételek
  _ujTetel(f) {
    const id = 't' + (++this.s.nextId);
    const t = { id, gyumolcs: f.gyumolcs, l: f.l, q: f.q, fok: f.fok, effektek: f.effektek ? [...f.effektek] : [], osszetevok: f.osszetevok ? [...f.osszetevok] : [],
      hely: f.hely, erleles: f.erleles ? { ...f.erleles } : null, erlelesSzorzo: f.erlelesSzorzo || 0, palack: f.palack ? { ...f.palack } : null,
      szin: f.szin || null, nap: f.nap ?? this.day(), nev: '' };
    t.nev = receptNev(t.gyumolcs, t.effektek);
    this.s.tetelek[id] = t;
    return t;
  },
  /** Leválaszt l litert a tételből (új tétel, ugyanazokkal a tulajdonságokkal); ha l ≥ a teljes, magát adja. */
  _valaszt(t, l) {
    if (l >= t.l - 1e-6) return t;
    t.l -= l;
    if (t.palack) t.palack.db = Math.round(t.l / UVEGEK[t.palack.meret].l);
    const n = this._ujTetel({ ...t, l, hely: t.hely });
    if (n.palack) n.palack.db = Math.round(l / UVEGEK[n.palack.meret].l);
    return n;
  },
  _torolUres() { for (const [id, t] of Object.entries(this.s.tetelek)) if (t.l < 0.005) delete this.s.tetelek[id]; },
  tetel(id) { return this.s.tetelek[id] || null; },
  tetelekItt(hely) { return Object.values(this.s.tetelek).filter(t => t.hely === hely); },
  /** Összes liter egy helyen ('nalad', 'prop:tanya', 'rejtek:tanya', 'terjeszto:postas'). */
  literItt(hely) { return this.tetelekItt(hely).reduce((a, t) => a + t.l, 0); },
  _propOf(t) { const [k, p] = t.hely.split(':'); return k === 'prop' || k === 'rejtek' ? p : null; },

  /** A tételt (vagy l literét) magadhoz veszed. */
  carry(batchId, l) {
    const t = this.tetel(batchId);
    if (!t) return this.err('Nincs ilyen tétel.');
    if (!this._propOf(t) && t.hely !== 'nalad') return this.err('Ez a tétel nem a te raktáradban van.');
    const n = this._valaszt(t, l ?? t.l);
    n.hely = 'nalad';
    return this.ok({ id: n.id, l: n.l });
  },
  /** Összeöntés: azonos gyümölcsű, azonos hatású, palackozatlan tételek egy demizsonba (fok és pont térfogattal súlyozva). */
  merge(batchId, masikId) {
    const a = this.tetel(batchId), b = this.tetel(masikId);
    if (!a || !b || a === b) return this.err('Nincs ilyen tétel.');
    if (a.gyumolcs !== b.gyumolcs) return this.err('Szilvát barackkal nem öntünk össze. Nagyapa sem tette.');
    if (a.palack || b.palack || a.erleles || b.erleles) return this.err('Palackozott vagy érlelődő pálinkát nem öntesz össze.');
    if ([...a.effektek].sort().join() !== [...b.effektek].sort().join()) return this.err('Más az íze: csak azonos hatású tételeket önthetsz össze.');
    const l = a.l + b.l;
    a.fok = (a.fok * a.l + b.fok * b.l) / l;
    a.q = Math.round((a.q * a.l + b.q * b.l) / l);
    a.erlelesSzorzo = ((a.erlelesSzorzo || 0) * a.l + (b.erlelesSzorzo || 0) * b.l) / l;
    a.l = l;
    delete this.s.tetelek[b.id];
    return this.ok({ id: a.id, l });
  },
  /** Leválasztás: l litert külön demizsonba töltesz (új tétel-id). */
  split(batchId, l) {
    const t = this.tetel(batchId); if (!t) return this.err('Nincs ilyen tétel.');
    if (!(l > 0) || l >= t.l - 1e-6) return this.err('Ennyit nem lehet leválasztani.');
    const n = this._valaszt(t, l);
    return this.ok({ id: n.id, l: n.l });
  },
  /** Leteszed egy ingatlanon (szem előtt). */
  store(batchId, propId) {
    const t = this.tetel(batchId);
    if (!t) return this.err('Nincs ilyen tétel.');
    if (!this.s.props[propId]?.owned) return this.err('Ez nem a te ingatlanod.');
    t.hely = 'prop:' + propId;
    return this.ok({ id: t.id });
  },

  // ------------------------------------------------------------ gyümölcsös
  _fa(propId, slot) {
    const p = this.s.props[propId];
    if (!p?.owned) return [null, 'Ez nem a te ingatlanod.'];
    if (slot < 0 || slot >= p.fak.length) return [null, 'Nincs ilyen hely a kertben.'];
    return [p, null];
  },
  plant(propId, slot, gyumolcs) {
    const [p, e] = this._fa(propId, slot); if (e) return this.err(e);
    const g = GYUMOLCSOK[gyumolcs]; if (!g) return this.err('Ismeretlen gyümölcs.');
    if (p.fak[slot]) return this.err('Ott már áll egy fa.');
    if (!this._van(`csemete_${gyumolcs}`, 1)) return this.err(`Nincs ${g.gyumolcs}csemetéd. A gazdaboltban rendelhetsz.`);
    this._vesz(`csemete_${gyumolcs}`, 1);
    p.fak[slot] = { gyumolcs, kor: 0, viz: 0.7, tragya: 0, permet: 0, kartevo: false, termes: 0, q: 0 };
    this.s.stat.ultetes++;
    this.msg(`Elültettél egy ${g.gyumolcs}csemetét. ${g.erik} nap múlva terem.`);
    this.emit({ type: 'sfx', id: 'ultetes' });
    this._questCheck();
    return this.ok({});
  },
  /** Öntözés; slot nélkül (vagy -1-gyel) az ingatlan minden fáját. */
  water(propId, slot = -1) {
    const p = this.s.props[propId];
    if (!p?.owned) return this.err('Ez nem a te ingatlanod.');
    const fak = slot < 0 ? p.fak.filter(Boolean) : [p.fak[slot]].filter(Boolean);
    if (!fak.length) return this.err('Nincs mit öntözni.');
    for (const f of fak) f.viz = 1;
    this.emit({ type: 'sfx', id: 'ontozes' });
    return this.ok({ db: fak.length });
  },
  fertilize(propId, slot) {
    const [p, e] = this._fa(propId, slot); if (e) return this.err(e);
    const f = p.fak[slot]; if (!f) return this.err('Ott nincs fa.');
    if (!this._van('tragya', 1)) return this.err('Nincs trágyád.');
    this._vesz('tragya', 1);
    f.tragya = FA.tragyaNap;
    return this.ok({});
  },
  /** Permetezés: három napig véd a kártevő ellen, és meggyógyítja a beteg fát. */
  spray(propId, slot) {
    const [p, e] = this._fa(propId, slot); if (e) return this.err(e);
    const f = p.fak[slot]; if (!f) return this.err('Ott nincs fa.');
    if (!this._van('permet', 1)) return this.err('Nincs permetszered.');
    this._vesz('permet', 1);
    f.permet = FA.permetNap; f.kartevo = false;
    return this.ok({});
  },
  /** Szüret: a fa érett termése a kamrába; slot nélkül az összes fa. → {ok, kg} */
  harvest(propId, slot = -1) {
    const p = this.s.props[propId];
    if (!p?.owned) return this.err('Ez nem a te ingatlanod.');
    let kg = 0;
    p.fak.forEach((f, i) => {
      if (!f || (slot >= 0 && i !== slot) || f.termes < 0.5) return;
      const k = Math.floor(f.termes);
      mergeQ(this.s.gyumolcs[f.gyumolcs], k, f.q);
      f.termes -= k; kg += k;
    });
    if (kg <= 0) return this.err('Nincs érett gyümölcs.');
    this.emit({ type: 'sfx', id: 'szedes' });
    return this.ok({ kg });
  },
  _faNap(p) {
    for (const f of p.fak) {
      if (!f) continue;
      const g = GYUMOLCSOK[f.gyumolcs];
      f.kor++;
      if (f.permet <= 0 && this.r() < FA.kartevo) f.kartevo = true;
      if (f.kor >= g.erik) {
        const kg = g.kg * (0.4 + 0.6 * f.viz) * (f.tragya > 0 ? 1.5 : 1) * (f.kartevo ? 0.5 : 1);
        const q = clamp(48 + 30 * f.viz + (f.tragya > 0 ? 12 : 0) + (f.permet > 0 ? 6 : 0) - (f.kartevo ? 20 : 0), 20, 98);
        const uj = Math.min(kg, g.kg * FA.maxTermesNap - f.termes);
        if (uj > 0) { f.q = f.termes > 0 ? (f.q * f.termes + q * uj) / (f.termes + uj) : q; f.termes += uj; }
      }
      f.viz = Math.max(0, f.viz - FA.kiszaradas);
      f.tragya = Math.max(0, f.tragya - 1);
      f.permet = Math.max(0, f.permet - 1);
    }
  },

  // ------------------------------------------------------------ cefre
  /** {gyumolcs, kg, adalek:[]}: a gyümölcsből cefre lesz a hordóban. Adalékonként 20 l-enként 1 adag. */
  fillBarrel(propId, barrelIdx, o = {}) {
    const p = this.s.props[propId];
    if (!p?.owned) return this.err('Ez nem a te ingatlanod.');
    const h = p.hordok[barrelIdx]; if (!h) return this.err('Nincs ilyen hordó.');
    if (h.allapot !== 'ures') return this.err('Ebben a hordóban már van cefre.');
    const gy = o.gyumolcs || Object.keys(this.s.gyumolcs).reduce((b, k) => (this.s.gyumolcs[k].kg > this.s.gyumolcs[b].kg ? k : b), 'szilva');
    const st = this.s.gyumolcs[gy];
    const kg = Math.min(o.kg ?? st.kg, st.kg, BARREL_CAP);
    if (kg < 1) return this.err(`Nincs ${GYUMOLCSOK[gy].gyumolcs}.`);
    const adalek = [...new Set(o.adalek || [])].filter(a => ADALEKOK[a]);
    const adag = Math.ceil(kg / 20);
    for (const a of adalek) if (!this._van(a, adag)) return this.err(`Nincs elég ${ADALEKOK[a].nev} (${adag} adag kell).`);
    for (const a of adalek) this._vesz(a, adag);
    let ido = FERMENT_MIN, q = st.q, terf = 1, kih = 1;
    for (const a of adalek) { const A = ADALEKOK[a]; ido *= A.ido; q += A.q; terf *= A.terfogat; kih *= A.kihozatal; }
    st.kg -= kg; if (st.kg < 0.01) { st.kg = 0; st.q = 0; }
    Object.assign(h, { allapot: 'erjed', gyumolcs: gy, l: Math.min(BARREL_CAP * 1.25, kg * terf), q: clamp(q, 5, 100), kesz: this.now() + ido, kihozatal: kih, adalek });
    this.s.stat.cefre++;
    this.msg(`${hu(h.l, 0)} l ${GYUMOLCSOK[gy].gyumolcs}cefre erjed (${Math.round(ido / 60)} óra).`);
    this.emit({ type: 'sfx', id: 'hordo', pos: PROP[propId].pos });
    this._questCheck();
    return this.ok({ l: h.l, kesz: h.kesz });
  },
  _hordoTick(p, propId, m) {
    for (const h of p.hordok) {
      if (h.allapot === 'erjed' && this.now() >= h.kesz) {
        h.allapot = 'kesz';
        this.msg(`Megerjedt ${this.aNev(GYUMOLCSOK[h.gyumolcs].gyumolcs + 'cefre')} (${PROP[propId].nev}): ${hu(h.l, 0)} l vár az üstre.`);
      }
      if (h.allapot === 'kesz' && this.now() > h.kesz + CEFRE_ROMLIK_ORA * 60) h.q = Math.max(15, h.q - m / 60);
    }
  },

  // ------------------------------------------------------------ üst
  /** mod: 'kezi' (a minigame, E.setHeat / E.cut / E.finishStill) vagy 'auto' (Feri bácsi vagy oszlopos üst). */
  startStill(propId, ustIdx, barrelIdx, mod = 'kezi') {
    const p = this.s.props[propId];
    if (!p?.owned) return this.err('Ez nem a te ingatlanod.');
    const u = p.ustok[ustIdx]; if (!u) return this.err('Nincs ilyen üst.');
    if (u.pecset > this.now()) return this.err('Az üstön a Hivatal pecsétje van.');
    if (u.allapot !== 'all') return this.err('Ez az üst már fő.');
    const h = p.hordok[barrelIdx];
    if (!h || h.allapot !== 'kesz') return this.err('Nincs kész cefre ebben a hordóban.');
    const U = USTOK[u.szint];
    let technika = 0;
    if (mod === 'kezi') {
      if (this.s.kezi) return this.err('Egyszerre csak egy üstöt kezelhetsz kézzel.');
    } else {
      const feri = this._alkItt(propId, 'feri').find(a => !a.foz);
      if (!feri && !U.auto) return this.err('Ehhez az üsthöz főzőmester kell (Feri bácsi), vagy oszlopos üst.');
      technika = feri ? 80 + this.r() * 10 : 76 + this.r() * 6;
      if (feri) { feri.foz = `${propId}:${ustIdx}`; u.feri = feri.id; }
    }
    const l = Math.min(h.l, U.cap);
    h.l -= l;
    const toltet = { gyumolcs: h.gyumolcs, l, q: h.q, kihozatal: h.kihozatal };
    if (h.l < 0.5) Object.assign(h, ujHordo());
    u.toltet = toltet; u.allapot = mod === 'kezi' ? 'kezi' : 'auto'; u.technika = technika;
    if (mod === 'kezi') {
      const c = this.core;
      const st = c._freshStill();
      st.running = true; st.tipus = toltet.gyumolcs; st.charge = l;
      c.still = st;
      this.s.kezi = { propId, ustIdx };
      this.msg(`${hu(l, 0)} l ${GYUMOLCSOK[toltet.gyumolcs].gyumolcs}cefre a ${U.nev}ben. Fűts fel, és vágd le az előpárlatot!`);
    } else {
      u.vege = this.now() + U.ido;
      this.msg(`${PROP[propId].nev}: ${hu(l, 0)} l cefre fő magától a ${U.nev}ben (${Math.round(U.ido / 60)} óra).`);
    }
    this.emit({ type: 'sfx', id: 'ust_indul', pos: PROP[propId].pos });
    return this.ok({ l, mod });
  },
  /** A kézi üst fűtése (0–1) és vágása: a meglévő minigame. */
  setHeat(h) { this.core.setHeat(h); },
  cut() { this.core.cut(); this.emit({ type: 'sfx', id: 'vagas' }); },
  /** A kézi főzés lezárása (a minigame maga is meghívja, ha kifogyott a cefre). */
  finishStill() { if (this.s.kezi) this.core.finishStill(); },

  /** A core.finishStill helyett fut (a konstruktor köti be): a minigame eredményéből tétel lesz. */
  _keziKesz() {
    const c = this.core, st = c.still, k = this.s.kezi;
    if (!st.running || !k) { st.running = false; return; }
    const qc = c.qualityPreview(), fokc = c.fokPreview();
    st.running = false; st.heat = 0;
    const u = this.s.props[k.propId].ustok[k.ustIdx];
    const U = USTOK[u.szint];
    const l = st.prodL * u.toltet.kihozatal * U.kihozatal * (u.csiga ? CSIGA.kihozatal : 1);
    const q = clamp(Math.round(qc * (0.6 + 0.4 * u.toltet.q / 100)) + (qc > 0 ? U.q : 0), 0, 100);
    const fok = clamp(fokc + U.fok, 0, 92);
    c.lastBatch = { tipus: u.toltet.gyumolcs, l, q, fok };
    this._ustKesz(k.propId, u, l, q, fok, 'kezi');
    this.s.kezi = null;
    st.charge = 0;
  },
  _ustKesz(propId, u, l, q, fok, mod) {
    const gy = u.toltet.gyumolcs;
    u.allapot = 'all'; u.toltet = null; u.vege = 0;
    if (u.feri) { const f = this.s.alk[u.feri]; if (f) f.foz = null; u.feri = null; }
    if (l < 0.01) { this.msg('Kész a főzés, de a palackba nem került semmi.'); return null; }
    const t = this._ujTetel({ gyumolcs: gy, l, q, fok, hely: 'prop:' + propId });
    // ha van sógor az ingatlanon, rögtön a rejtekbe viszi (éjjel is: „ilyenkor a legjobb, senki nem látja”)
    if (this._alkItt(propId, 'sogor').length) this.hide(t.id, propId);
    this.s.stat.fozes++;
    if (mod === 'kezi') this.s.stat.keziMaxQ = Math.max(this.s.stat.keziMaxQ, q);
    this.s.nap.fozesek++;
    this.addXp(XP.fozes);
    this.msg(`Kész: ${hu(l, 2)} l ${GYUMOLCSOK[gy].nev}, ${hu(fok, 0)} fokos, minőség ${q} (${PROP[propId].nev}).`);
    this.emit({ type: 'sfx', id: 'ust_kesz', pos: PROP[propId].pos });
    this._questCheck();
    return t;
  },
  _ustTick(p, propId) {
    for (const u of p.ustok) {
      if (u.allapot !== 'auto' || this.now() < u.vege) continue;
      const U = USTOK[u.szint];
      const l = u.toltet.l * AUTO_KIHOZATAL * u.toltet.kihozatal * U.kihozatal * (u.csiga ? CSIGA.kihozatal : 1);
      const q = clamp(Math.round(u.technika * (0.6 + 0.4 * u.toltet.q / 100)) + U.q, 0, 100);
      const fok = 57 + this.r() * 3 + U.fok;
      this._ustKesz(propId, u, l, q, fok, 'auto');
    }
  },
  /** Fut-e üst az ingatlanon (füst a kéményből). */
  fustol(propId) { return this.s.props[propId].ustok.some(u => u.allapot !== 'all'); },

  /** Üstfejlesztés: kisüst → dupla üst → oszlopos üst (készpénzből, ha nincs elég, számláról). */
  upgradeStill(propId, ustIdx, szint) {
    const p = this.s.props[propId]; if (!p?.owned) return this.err('Ez nem a te ingatlanod.');
    const u = p.ustok[ustIdx]; if (!u) return this.err('Nincs ilyen üst.');
    const U = USTOK[szint]; if (!U) return this.err('Ismeretlen üst.');
    if (USTSOR.indexOf(szint) <= USTSOR.indexOf(u.szint)) return this.err('Ennél már jobb üstöd van.');
    if (u.allapot !== 'all') return this.err('Főzés közben nem cserélhető.');
    if (this.rankIdx() < U.rank) return this.err(`A(z) ${U.nev} ${this.rangNev(U.rank)} rangtól vehető.`);
    if (!this._fizet(U.ar, 'barmely')) return this.err(`Nincs ${this.ft(U.ar)} (készpénz vagy számla).`);
    u.szint = szint;
    this.msg(`Új üst: ${U.nev} (${PROP[propId].nev}).`);
    this.emit({ type: 'unlock', mit: 'ust', id: szint });
    return this.ok({});
  },
  /** Rézcsiga-hűtő (+10 % kihozatal) vagy kéménysapka (fél füst) — számláról vagy készpénzből. */
  buyUpgrade(propId, mit, ustIdx = 0) {
    const p = this.s.props[propId]; if (!p?.owned) return this.err('Ez nem a te ingatlanod.');
    const X = mit === 'csiga' ? CSIGA : mit === 'kemenysapka' ? KEMENYSAPKA : null;
    if (!X) return this.err('Ismeretlen fejlesztés.');
    if (this.rankIdx() < X.rank) return this.err(`${X.nev}: ${this.rangNev(X.rank)} rangtól.`);
    if (mit === 'csiga' && (!p.ustok[ustIdx] || p.ustok[ustIdx].csiga)) return this.err('Ezen az üstön már van csiga.');
    if (mit === 'kemenysapka' && p.kemenysapka) return this.err('Már van kéménysapka.');
    if (!this._fizet(X.ar, 'barmely')) return this.err(`Nincs ${this.ft(X.ar)} (készpénz vagy számla).`);
    if (mit === 'csiga') p.ustok[ustIdx].csiga = true; else p.kemenysapka = true;
    this.msg(`Felszerelve: ${X.nev}.`);
    return this.ok({});
  },

  // ------------------------------------------------------------ vizezés, érlelés, palack
  /** Vizezés: −5 fok, arányosan több, −2 pont; 30 fok alá nem megy. */
  dilute(batchId) {
    const t = this.tetel(batchId); if (!t) return this.err('Nincs ilyen tétel.');
    if (t.palack) return this.err('A palackozott pálinkát már nem vizezed.');
    if (t.fok <= 30 + 1e-6) return this.err('30 fok alá nem megy: azt már a kút sem vállalja.');
    const uj = Math.max(30, t.fok - WATER_STEP);
    t.l = t.l * t.fok / uj; t.fok = uj; t.q = Math.max(0, t.q - 2);
    this.s.stat.vizezes++;
    this.msg('Vizezés. „Vizezni bűn” — mondta nagyapád is, aztán vizezett.');
    this.emit({ type: 'sfx', id: 'kut' });
    return this.ok({ l: t.l, fok: t.fok });
  },
  /** Hordós érlelés: egy érlelőhordót (cikk) foglal, naponta nő a minőség és az érték. */
  age(batchId, hordoTipus = 'akac') {
    const t = this.tetel(batchId); if (!t) return this.err('Nincs ilyen tétel.');
    const H = HORDOK[hordoTipus]; if (!H) return this.err('Ismeretlen hordó.');
    if (!this._propOf(t)) return this.err('Érlelni csak a saját ingatlanodon lehet.');
    if (t.palack) return this.err('Palackozott pálinkát nem érlelsz.');
    if (t.erleles) return this.err('Ez már érlelődik.');
    if (t.l > H.cap) return this.err(`Egy hordóba legfeljebb ${H.cap} l fér.`);
    if (!this._van('hordo_' + hordoTipus, 1)) return this.err(`Nincs üres ${H.nev}d. Az erdésznél rendelhetsz.`);
    this._vesz('hordo_' + hordoTipus, 1);
    t.erleles = { hordo: hordoTipus, start: this.now(), napok: 0 };
    this.msg(`${hu(t.l, 1)} l ${t.nev} ${H.nev}ban érlelődik.`);
    return this.ok({});
  },
  /** Kivétel a hordóból (a hordó visszakerül a készletbe). */
  endAging(batchId) {
    const t = this.tetel(batchId); if (!t?.erleles) return this.err('Ez nem érlelődik.');
    this._ad('hordo_' + t.erleles.hordo, 1);
    t.erleles = null;
    return this.ok({ q: t.q, erlelesSzorzo: t.erlelesSzorzo });
  },
  _erlelesNap() {
    for (const t of Object.values(this.s.tetelek)) {
      if (!t.erleles) continue;
      const H = HORDOK[t.erleles.hordo];
      t.erleles.napok++;
      if (t.erleles.napok * H.q <= H.maxQ) t.q = Math.min(100, t.q + H.q);
      t.erlelesSzorzo = Math.min(H.maxErtek, t.erleles.napok * H.ertek);
      t.szin = H.szin;
      if (t.erleles.napok === 3 && !t.effektek.includes(H.hatas) && t.effektek.length < MAX_HATAS) {
        t.effektek.push(H.hatas); t.nev = receptNev(t.gyumolcs, t.effektek);
        this._ujHatas(H.hatas);
      }
      this.s.stat.erlelesMax = Math.max(this.s.stat.erlelesMax, t.erleles.napok);
    }
  },
  /** Palackozás: uvegMeret '02' | '05' | '07' | '10', cimke 'nincs' | 'kezi' | 'nyomtatott' | 'arany'. A maradék kimért marad. */
  bottle(batchId, uvegMeret = '05', cimke = 'kezi') {
    const t = this.tetel(batchId); if (!t) return this.err('Nincs ilyen tétel.');
    if (t.palack) return this.err('Ez már palackban van.');
    const U = UVEGEK[uvegMeret], C = CIMKEK[cimke];
    if (!U || !C) return this.err('Ismeretlen üveg vagy címke.');
    const db = Math.floor(t.l / U.l + 1e-6);
    if (db < 1) return this.err(`Ennyi pálinkából egy ${U.nev} üveg sem telik.`);
    const kell = Math.min(db, this._db('uveg_' + uvegMeret), C.cikk ? this._db(C.cikk) : Infinity);
    if (kell < 1) return this.err(`Nincs ${U.nev} üveged${C.cikk ? ' vagy címkéd' : ''}.`);
    this._vesz('uveg_' + uvegMeret, kell); if (C.cikk) this._vesz(C.cikk, kell);
    if (t.erleles) this.endAging(t.id);
    const n = this._valaszt(t, kell * U.l);
    n.palack = { meret: uvegMeret, cimke, db: kell };
    this.s.stat.palack += kell;
    this.msg(`${kell} ${U.nev} üveg ${n.nev}, ${cimke === 'nincs' ? 'címke nélkül' : C.nev + ' címkével'}.`);
    this.emit({ type: 'sfx', id: 'palack' });
    return this.ok({ id: n.id, db: kell });
  },
  /** A szomszéd néni ezzel palackoz magától (null = kikapcsolva). */
  setAutoBottle(propId, beallitas) {
    const p = this.s.props[propId]; if (!p?.owned) return this.err('Ez nem a te ingatlanod.');
    p.autoPalack = beallitas ? { meret: beallitas.meret || '05', cimke: beallitas.cimke || 'kezi' } : null;
    return this.ok({});
  },

  // ------------------------------------------------------------ belső: óránkénti és napi lépés
  _termelesTick(m) {
    for (const [id, p] of Object.entries(this.s.props)) {
      if (!p.owned) continue;
      this._hordoTick(p, id, m);
      this._ustTick(p, id);
    }
  },
  _termelesNap() {
    for (const p of Object.values(this.s.props)) if (p.owned) this._faNap(p);
    this._erlelesNap();
  },
};

export { CIKKEK, HATASOK };
