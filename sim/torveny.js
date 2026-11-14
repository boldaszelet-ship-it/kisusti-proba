// Kisüsti — a pénzügyőr: régiónkénti gyanú, járőr az úthálón, éjjeli ellenőrzés, besúgó, füst,
// motozás, házkutatás, bírság, elkobzás, pecsét, rejtekhely.
// Minden büntetés a játékos egy tettéből indul (füst, eladás, kifutás, szem előtt hagyott pálinka, sok áru az úton),
// és a hűséges vevő előre szól, ha jönnek: az óvatos játékos el tud pakolni.
import { REGIONS, PROPERTIES, NODES } from '../data/regions.js';
import { TIME_SCALE, CARRY_LIMIT, hu } from '../sim.js';
import { TORVENY, BESUGOK, JARMUVEK, BANK } from '../data/tartalom.js';
import { clamp, path, edges, nodeRegion, REGIO_NODE, PROP_NODE } from './kozos.js';
import { VEVO } from './piac.js';

const PROPS = Object.fromEntries(PROPERTIES.map(p => [p.id, p]));
const HIVATAL = 'kv_kp';

export function initTorveny(s) {
  s.gyanu = Object.fromEntries(REGIONS.map(r => [r.id, 0]));
  s.besugok = Object.fromEntries(REGIONS.map(r => [r.id, { csendEddig: 0 }]));
  s.jarorok = [];
  s.razziak = [];
  s.figyelmeztetve = {};
}

export const torveny = {
  suspicionAt(regio) { return this.s.gyanu[regio] ?? 0; },
  /** A gyanú nő (a besúgó felnagyítja); 100-nál házkutatás jön oda, ahol ingatlanod van. */
  addSuspicion(regio, v, ok = '') {
    if (!(regio in this.s.gyanu)) return;
    if (v > 0 && this.s.besugok[regio].csendEddig <= this.now()) v *= TORVENY.besugoSzorzo;
    const elotte = this.s.gyanu[regio];
    this.s.gyanu[regio] = clamp(elotte + v, 0, 100);
    if (elotte < 75 && this.s.gyanu[regio] >= 75) {
      const b = BESUGOK[regio];
      this.msg(`${this.regionName(regio)}: „A pénzügyőr erre jár ám…” — suttogja ${b.nev}.`);
    }
    if (this.s.gyanu[regio] >= TORVENY.hazkutatasKuszob) this._razziaTerv(regio, ok);
  },
  _razziaTerv(regio, ok) {
    const prop = PROPERTIES.find(p => p.regio === regio && this.s.props[p.id].owned);
    if (!prop || this.s.razziak.some(r => r.prop === prop.id)) return;
    const ido = this.now() + TORVENY.razziaFigyelmeztetes;
    // a hűséges vevő előre szól
    const baratok = Object.entries(this.s.vevok).filter(([, st]) => st.allapot === 'aktiv' && st.huseg >= 60).map(([id]) => id);
    const ki = baratok.find(id => VEVO[id].regio === regio) || baratok[0];
    this.s.razziak.push({ prop: prop.id, ido, ok, figyelmeztetve: !!ki });
    if (ki) this._sms(ki, VEVO[ki].nev, `„Hallottam a kocsmában: két óra múlva házkutatás lesz nálad (${prop.nev}). Tüntess el mindent!”`, { figyelmeztetes: true });
    this._jarorIndul(PROP_NODE[prop.id], { razzia: prop.id });
  },

  _torvenyTick(m) {
    const ej = !this.isDay();
    for (const p of PROPERTIES) {
      const ps = this.s.props[p.id];
      if (!ps.owned) continue;
      const n = ps.ustok.filter(u => u.allapot !== 'all').length;
      if (n) {
        this.addSuspicion(p.regio, n * TORVENY.fustOra * (m / 60) * (ps.kemenysapka ? 0.5 : 1) * (ej ? TORVENY.ejjeliFust : 1), 'fust');
      }
    }
    for (const r of Object.keys(this.s.gyanu)) this.s.gyanu[r] = Math.max(0, this.s.gyanu[r] - TORVENY.csokkenOra * (m / 60));
    // esedékes házkutatás
    for (const rz of [...this.s.razziak]) if (this.now() >= rz.ido) { this.s.razziak = this.s.razziak.filter(x => x !== rz); this.raid(rz.prop); }
    // járőr megérkezik a célhoz
    for (const j of this.s.jarorok) {
      if (!j.megerkezett && this.now() >= j.celIdo) { j.megerkezett = true; this._jarorCelnal(j); }
    }
    this.s.jarorok = this.s.jarorok.filter(j => j.vege > this.now());
  },
  _torvenyOra() {
    const h = this.hour();
    // éjjeli ellenőrzés: 23 és 2 órakor a füstölő, gyanús ingatlanokhoz
    if (h === 23 || h === 2) {
      for (const p of PROPERTIES) {
        if (!this.s.props[p.id].owned || !this.fustol(p.id) || this.suspicionAt(p.regio) < 40) continue;
        this._jarorIndul(PROP_NODE[p.id], { ejjeli: p.id });
      }
      return;
    }
    if (h < 7 || h > 21 || this.s.jarorok.length >= 2) return;
    const reg = Object.entries(this.s.gyanu);
    const max = Math.max(...reg.map(([, v]) => v));
    if (this.r() > 0.04 + max / 250) return;
    let x = this.r() * reg.reduce((a, [, v]) => a + v + 5, 0), cel = reg[0][0];
    for (const [id, v] of reg) { x -= v + 5; if (x <= 0) { cel = id; break; } }
    this._jarorIndul(REGIO_NODE[cel], {});
  },
  _jarorIndul(celNode, o) {
    const oda = path(HIVATAL, celNode), vissza = path(celNode, HIVATAL);
    const nodes = [...oda.nodes, ...vissza.nodes.slice(1)];
    const pts = nodes.map(n => NODES[n]);
    const perMeter = TIME_SCALE / TORVENY.jarorSebesseg; // játékperc / méter
    const t = [this.now()];
    for (let i = 1; i < nodes.length; i++) t.push(t[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * perMeter + (i === oda.nodes.length - 1 ? 20 : 0));
    const j = { id: 'j' + (++this.s.nextId), nodes, pts, t, start: this.now(), celIdo: t[oda.nodes.length - 1], vege: t[t.length - 1], cel: celNode,
      regio: nodeRegion(celNode), ejjeli: o.ejjeli || null, razzia: o.razzia || null, megerkezett: false };
    this.s.jarorok.push(j);
    this.emit({ type: 'patrol', jaror: { id: j.id, nodes, pts, t, cel: celNode, regio: j.regio, ejjeli: !!j.ejjeli, razzia: !!j.razzia } });
    this.emit({ type: 'sfx', id: 'jaror', pos: NODES[HIVATAL] });
    return j;
  },
  _jarorCelnal(j) {
    if (!j.ejjeli) return;
    const p = PROPS[j.ejjeli];
    if (!this.fustol(p.id)) { this.msg(`Éjjel a fehér szolgálati autó lassan elgurult a kapu előtt (${p.nev}). Sötét volt, nem füstölt semmi.`); return; }
    this.s.stat.ejjeli++;
    if (this.suspicionAt(p.regio) >= 60) { this.msg(`Éjjeli ellenőrzés: a pénzügyőr meglátta a kémény füstjét (${p.nev}).`); this.raid(p.id); }
    else { this.addSuspicion(p.regio, 10, 'ejjeli'); this.msg(`Éjjel valaki zseblámpával bevilágított az ablakon (${p.nev}). A füstöt is látta.`); }
  },
  /** Aktív járőrök (a világ ezek mentén mozgatja a fehér autót). */
  patrols() { return this.s.jarorok.map(j => ({ id: j.id, nodes: j.nodes, pts: j.pts, t: j.t, cel: j.cel, regio: j.regio, pos: this._jarorPos(j) })); },
  _jarorPos(j) {
    const n = this.now();
    for (let i = 1; i < j.t.length; i++) if (n <= j.t[i]) {
      const f = clamp((n - j.t[i - 1]) / Math.max(1e-6, j.t[i] - j.t[i - 1]), 0, 1);
      return [j.pts[i - 1][0] + (j.pts[i][0] - j.pts[i - 1][0]) * f, j.pts[i - 1][1] + (j.pts[i][1] - j.pts[i - 1][1]) * f];
    }
    return j.pts[j.pts.length - 1];
  },
  /** Találkozik-e az útvonalad (csomópontlista, indulás, érkezés játékpercben) egy járőrrel. → járőr vagy null */
  _talalkozas(nodes, t0, t1) {
    const mine = new Set(edges(nodes));
    for (const j of this.s.jarorok) {
      for (let i = 1; i < j.nodes.length; i++) {
        const e = [j.nodes[i - 1], j.nodes[i]].sort().join('|');
        if (mine.has(e) && j.t[i - 1] <= t1 && j.t[i] >= t0) return j;
      }
    }
    return null;
  },

  /** Motozás az úton: a nálad lévő pálinka és készpénz. → {talalt, birsag, elkobzottL, elkobzottKp} */
  searchPlayer() {
    const regio = nodeRegion(this.s.hol);
    const J = JARMUVEK[this.s.jarmu] || JARMUVEK.gyalog;
    const L = this.literItt('nalad');
    const rejtett = this.suspicionAt(regio) > 80 && this.r() < 0.5 ? 0 : J.rejtett;
    const latszik = Math.max(0, L - rejtett);
    let birsag = 0, elkobzottL = 0, elkobzottKp = 0;
    const okok = [];
    if (latszik > TORVENY.motozasLiter + 1e-6) {
      elkobzottL = L;
      for (const t of this.tetelekItt('nalad')) delete this.s.tetelek[t.id];
      birsag += TORVENY.motozasBirsag + TORVENY.birsagLiter * latszik;
      okok.push(`${hu(latszik, 1)} l pálinka a csomagban`);
    }
    // a készpénz csak a pálinkával együtt gyanús: akkor „az eladott áru ára”, és elviszik
    if (okok.length && this.core.money > TORVENY.motozasKp) {
      elkobzottKp = Math.round(this.core.money - TORVENY.motozasKp);
      this.core.money = TORVENY.motozasKp;
      okok.push(`${this.ft(elkobzottKp)} készpénz, „az eladott áru ára”`);
    }
    this.s.stat.motozas++;
    this.emit({ type: 'search', talalt: okok.length > 0, okok, elkobzottL, elkobzottKp });
    if (!okok.length) {
      this.addSuspicion(regio, -5);
      this.msg('Motozás: „Jó utat. És vigyázzon, sok a vad az úton.”');
      return { ok: true, talalt: false, birsag: 0, elkobzottL: 0, elkobzottKp: 0 };
    }
    birsag = this._birsag(birsag);
    this.s.stat.birsag++; this.s.stat.birsagFt += birsag;
    this.addSuspicion(regio, 15, 'motozas');
    this.msg(`MOTOZÁS: ${okok.join(', ')}. Bírság: ${this.ft(birsag)}. „Bizonyítéknak.”`);
    this.s.nap.esemenyek.push(`Motozás: ${okok.join(', ')}; bírság ${this.ft(birsag)}.`);
    return { ok: true, talalt: true, birsag, elkobzottL, elkobzottKp };
  },
  _birsag(osszeg) {
    let marad = osszeg;
    const kp = Math.min(this.core.money, marad); this.core.money -= kp; marad -= kp;
    const du = Math.min(this.s.dunyha, marad); this.s.dunyha -= du; marad -= du;
    const sz = Math.min(this.s.szamla, marad); this.s.szamla -= sz; marad -= sz;
    this.s.nap.birsag += osszeg - marad;
    return osszeg - marad;
  },
  /** Házkutatás egy ingatlanon: a szem előtt lévő pálinka, a működő üst, a rejtekből kilógó rész. */
  raid(propId) {
    const p = PROPS[propId], ps = this.s.props[propId];
    if (!ps?.owned) return { ok: false };
    const lathato = this.tetelekItt('prop:' + propId);
    let L = lathato.reduce((a, t) => a + t.l, 0);
    const rejtek = this.tetelekItt('rejtek:' + propId), rl = rejtek.reduce((a, t) => a + t.l, 0);
    const kilog = Math.max(0, rl - p.rejtek);
    const fut = ps.ustok.filter(u => u.allapot !== 'all');
    const okok = [];
    let birsag = 0, elkobzott = 0;
    if (L > CARRY_LIMIT || kilog > 0) {
      for (const t of lathato) delete this.s.tetelek[t.id];
      if (kilog > 0) for (const t of rejtek) delete this.s.tetelek[t.id];
      elkobzott = L + (kilog > 0 ? rl : 0);
      okok.push(`${hu(elkobzott, 1)} l pálinka szem előtt`);
      birsag += TORVENY.birsagLiter * elkobzott;
    }
    if (fut.length) {
      for (const u of fut) {
        if (this.s.kezi && this.s.kezi.propId === propId) { this.core.still.running = false; this.core.still.heat = 0; this.s.kezi = null; }
        if (u.feri) { const f = this.s.alk[u.feri]; if (f) f.foz = null; u.feri = null; }
        u.allapot = 'all'; u.toltet = null; u.pecset = this.now() + TORVENY.pecsetPerc;
      }
      okok.push(`${fut.length} működő üst`);
      birsag += TORVENY.birsagUst * fut.length;
    }
    this.s.stat.razzia++;
    this.emit({ type: 'raid', prop: propId, talalt: okok.length > 0, okok, elkobzottL: elkobzott });
    if (!okok.length) {
      this.s.gyanu[p.regio] = 50;
      this.msg(`HÁZKUTATÁS (${p.nev}): a pénzügyőr mindent felforgatott, de nem talált semmit. „Csak erre jártam.”`);
      this.s.nap.esemenyek.push(`Házkutatás (${p.nev}): nem találtak semmit.`);
      return { ok: true, talalt: false, birsag: 0 };
    }
    if (propId === 'tanya' && this.s.dunyha > BANK.dunyhaRazzia) {
      const el = this.s.dunyha - BANK.dunyhaRazzia; this.s.dunyha = BANK.dunyhaRazzia;
      okok.push(`${this.ft(el)} a dunyha alatt`);
    }
    birsag = this._birsag(TORVENY.birsagAlap + birsag);
    this.s.stat.birsag++; this.s.stat.birsagFt += birsag;
    this.s.gyanu[p.regio] = 35;
    this.msg(`HÁZKUTATÁS (${p.nev}): ${okok.join(', ')}. Bírság: ${this.ft(birsag)}. Az üstökre pecsét került. „Bizonyítéknak.”`);
    this.s.nap.esemenyek.push(`Házkutatás (${p.nev}): ${okok.join(', ')}; bírság ${this.ft(birsag)}.`);
    this.emit({ type: 'sfx', id: 'razzia', pos: p.pos });
    return { ok: true, talalt: true, birsag, elkobzottL: elkobzott };
  },
  /** Rejtekhelyre teszed a tételt (a házkutatás nem találja meg, amíg elfér). */
  hide(batchId, propId) {
    const t = this.tetel(batchId); if (!t) return this.err('Nincs ilyen tétel.');
    const ps = this.s.props[propId]; if (!ps?.owned) return this.err('Ez nem a te ingatlanod.');
    if (t.hely !== 'nalad' && t.hely !== 'prop:' + propId) return this.err('A tétel nincs itt.');
    const szabad = PROPS[propId].rejtek - this.literItt('rejtek:' + propId);
    if (szabad < 0.05) return this.err('A rejtekhely tele van.');
    const n = this._valaszt(t, Math.min(t.l, szabad));
    n.hely = 'rejtek:' + propId;
    this.s.stat.rejtes++;
    this._questCheck();
    return this.ok({ id: n.id, l: n.l, marad: t !== n ? t.l : 0 });
  },
  /** A besúgó csendje egy fél literért: három napig nem nagyítja a gyanút. */
  appease(regio, batchId) {
    const b = BESUGOK[regio]; if (!b) return this.err('Ismeretlen régió.');
    const t = this.tetel(batchId);
    if (!t || t.hely !== 'nalad' || t.l < 0.5 - 1e-6) return this.err('Fél liter kell nálad.');
    const n = this._valaszt(t, 0.5); delete this.s.tetelek[n.id]; this._torolUres();
    this.s.besugok[regio].csendEddig = this.now() + 3 * 1440;
    this.s.gyanu[regio] = Math.max(0, this.s.gyanu[regio] - 10);
    this.msg(`${b.nev}: ${b.csend}`);
    return this.ok({});
  },

  /** Bot és próba: utazás a térképen (a valódi játékban a világ mozgatja a játékost, ott ezt nem kell hívni).
   *  Telik az idő, és ha az útvonal keresztezi egy járőrét, motozás jöhet. → {ok, perc, motozas?} */
  travelTo(node) {
    if (!NODES[node]) return this.err('Ismeretlen hely.');
    if (this.s.kezi) return this.err('Az üstöt nem hagyhatod magára.');
    const { nodes, dist } = path(this.s.hol, node);
    const J = JARMUVEK[this.s.jarmu] || JARMUVEK.gyalog;
    const perc = dist / J.sebesseg * TIME_SCALE; // valós mp × 6 = játékperc
    const t0 = this.now();
    this.advance(perc);
    this.s.hol = node;
    const j = this._talalkozas(nodes, t0, this.now());
    let motozas = null;
    if (j && this.r() < 0.7) motozas = this.searchPlayer();
    return this.ok({ perc, motozas });
  },
};
