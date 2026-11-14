// Kisüsti — ágyas és ízesítés: összetevő + pálinka → hatáslánc, átalakulások, értékszorzó, receptkönyv.
// A szabály (a műfaj keverési logikája, saját tartalommal):
//   1. az új összetevő előbb a MEGLÉVŐ hatásokat alakítja át a saját táblája szerint (ha a cél még nincs meg);
//   2. utána hozzáadja a saját alaphatását, ha az még nincs meg és van hely (legfeljebb MAX_HATAS).
// Így egy új összetevő a régi hatásokat is átírhatja: ettől izgalmas a felfedezés.
import { GYUMOLCSOK, HATASOK, OSSZETEVOK, MAX_HATAS, CIKKEK, HATAS_JEGYZET, XP } from '../data/tartalom.js';

/** Tiszta függvény: a hatáslista egy összetevő után. → {effektek, uj:[], atalakult:[[mi, mive]]} */
export function alkalmaz(effektek, osszetevo) {
  const O = OSSZETEVOK[osszetevo];
  if (!O) return { effektek: [...effektek], uj: [], atalakult: [] };
  const out = [...effektek], atalakult = [];
  for (let i = 0; i < out.length; i++) {
    const r = O.atalakit.find(([mi]) => mi === out[i]);
    if (r && !out.includes(r[1])) { atalakult.push([out[i], r[1]]); out[i] = r[1]; }
  }
  const uj = [];
  if (!out.includes(O.hatas) && out.length < MAX_HATAS) { out.push(O.hatas); uj.push(O.hatas); }
  for (const [, mive] of atalakult) uj.push(mive);
  return { effektek: out, uj, atalakult };
}

/** Az értékszorzó: 1 + a hatások értékének összege (legalább 0,5). */
export function ertekSzorzo(effektek) {
  return Math.max(0.5, 1 + effektek.reduce((a, e) => a + (HATASOK[e]?.ertek || 0), 0));
}

/** A recept neve: a legértékesebb hatás idézőjelben + az ital neve, pl. „Nagymama titka” barackpálinka. */
export function receptNev(gyumolcs, effektek) {
  const ital = GYUMOLCSOK[gyumolcs]?.nev || 'pálinka';
  if (!effektek.length) return ital;
  const top = [...effektek].sort((a, b) => (HATASOK[b].ertek - HATASOK[a].ertek))[0];
  return `„${HATASOK[top].nev}” ${ital}`;
}

export const receptKulcs = (gyumolcs, effektek) => gyumolcs + ':' + [...effektek].sort().join('+');

/** Ennyi adag összetevő kell l liter pálinkához (literenként egy). */
export const adag = l => Math.max(1, Math.ceil(l - 1e-6));

export const keveres = {
  /** → {ok, effektek, ertekSzorzo, ujNev, uj, atalakult, adag, koltseg, ismert} */
  mixPreview(batchId, osszetevo) {
    const t = this.tetel(batchId); if (!t) return this.err('Nincs ilyen tétel.', true);
    if (!OSSZETEVOK[osszetevo]) return this.err('Ismeretlen összetevő.', true);
    const r = alkalmaz(t.effektek, osszetevo);
    const a = adag(t.l);
    return {
      ok: true, effektek: r.effektek, ertekSzorzo: ertekSzorzo(r.effektek), elotte: ertekSzorzo(t.effektek),
      ujNev: receptNev(t.gyumolcs, r.effektek), uj: r.uj, atalakult: r.atalakult, adag: a,
      koltseg: a * CIKKEK[osszetevo].ar, van: this._db(osszetevo) >= a,
      ismert: !!this.s.receptek[receptKulcs(t.gyumolcs, r.effektek)],
    };
  },
  mix(batchId, osszetevo) {
    const t = this.tetel(batchId); if (!t) return this.err('Nincs ilyen tétel.');
    if (t.palack) return this.err('Palackozott pálinkába már nem keversz.');
    if (t.erleles) return this.err('Érlelés közben ne nyúlj hozzá.');
    if (!OSSZETEVOK[osszetevo]) return this.err('Ismeretlen összetevő.');
    const a = adag(t.l);
    if (!this._van(osszetevo, a)) return this.err(`Ehhez ${a} adag ${CIKKEK[osszetevo].nev} kell.`);
    this._vesz(osszetevo, a);
    const r = alkalmaz(t.effektek, osszetevo);
    t.effektek = r.effektek;
    t.osszetevok.push(osszetevo);
    t.nev = receptNev(t.gyumolcs, t.effektek);
    this.s.stat.keveres++;
    for (const [mi, mive] of r.atalakult) this.msg(`${HATASOK[mi].nev} → ${HATASOK[mive].nev}`);
    for (const e of r.uj) this._ujHatas(e);
    const k = receptKulcs(t.gyumolcs, t.effektek);
    if (!this.s.receptek[k]) {
      this.s.receptek[k] = { kulcs: k, nev: t.nev, gyumolcs: t.gyumolcs, effektek: [...t.effektek], osszetevok: [...t.osszetevok],
        ertekSzorzo: ertekSzorzo(t.effektek), felfedezve: this.day(), legjobbAr: 0 };
      this.addXp(XP.ujRecept);
      this.msg(`Új recept a füzetben: ${t.nev} (×${ertekSzorzo(t.effektek).toFixed(2).replace('.', ',')}).`);
      this.emit({ type: 'unlock', mit: 'recept', id: k, nev: t.nev });
    }
    this.emit({ type: 'sfx', id: 'keveres' });
    this._questCheck();
    return this.ok({ effektek: t.effektek, ertekSzorzo: ertekSzorzo(t.effektek), ujNev: t.nev, atalakult: r.atalakult, uj: r.uj });
  },
  _ujHatas(e) {
    if (this.s.hatasok[e]) return;
    this.s.hatasok[e] = this.day();
    this.addXp(XP.ujHatas);
    const j = HATAS_JEGYZET[e];
    this.msg(`Új hatás: ${HATASOK[e].nev}.${j ? ' ' + j : ''}`);
  },
  /** A receptkönyv: felfedezett receptek értékszorzó szerint csökkenőben. */
  recipes() {
    return Object.values(this.s.receptek).sort((a, b) => b.ertekSzorzo - a.ertekSzorzo)
      .map(r => ({ ...r, effektNevek: r.effektek.map(e => HATASOK[e].nev) }));
  },
  /** A már felfedezett hatások. */
  knownEffects() { return Object.keys(this.s.hatasok).map(id => ({ id, nev: HATASOK[id].nev, nap: this.s.hatasok[id] })); },
};
