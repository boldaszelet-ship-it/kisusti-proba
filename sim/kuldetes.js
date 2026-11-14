// Kisüsti — „Nagyapa füzete”: vezetett küldetéssor. Egyszerre egy lépés aktív; ha a feltétele teljesül, jutalom és jön a következő.
import { KULDETESEK } from '../data/tartalom.js';

/** A feltételek: a szimuláció számlálóiból és állapotából. */
const CEL = {
  cefre: E => E.s.stat.cefre >= 1,
  fozes60: E => E.s.stat.keziMaxQ >= 60,
  eladas: E => E.s.stat.eladas >= 1,
  ultetes: E => E.s.stat.ultetes >= 1,
  keveres: E => E.s.stat.keveres >= 1,
  kostolo: E => E.s.stat.kostolo >= 1,
  rejtes: E => E.s.stat.rejtes >= 1,
  terjeszto: E => E.s.stat.terjeszto >= 1,
  preshaz: E => E.s.props.preshaz.owned,
  erleles3: E => E.s.stat.erlelesMax >= 3,
  feri: E => E.s.stat.feri >= 1,
  mosas: E => E.s.stat.mosott > 0,
  nagymama: E => !!E.s.hatasok.nagymama,
  major: E => E.s.props.major.owned,
  kisvaros: E => E.s.stat.kisvaros >= 1,
  gyari: E => E.s.gyari.legyozve,
  kiraly: E => E.rankIdx() >= 4,
};

export function initKuldetes(s) { s.kuldetes = { idx: 0, kesz: [] }; }

export const kuldetes = {
  quests() {
    const k = this.s.kuldetes;
    return KULDETESEK.map((q, i) => ({ id: q.id, cim: q.cim, szoveg: q.szoveg, jutalom: q.jutalom, allapot: i < k.idx ? 'kesz' : i === k.idx ? 'aktiv' : 'zarolt' }));
  },
  activeQuest() { const q = KULDETESEK[this.s.kuldetes.idx]; return q ? { id: q.id, cim: q.cim, szoveg: q.szoveg, lepes: this.s.kuldetes.idx + 1, osszes: KULDETESEK.length } : null; },
  _questCheck() {
    if (this._qLock) return;
    this._qLock = true;
    try {
      const k = this.s.kuldetes;
      while (k.idx < KULDETESEK.length && CEL[KULDETESEK[k.idx].cel](this)) {
        const q = KULDETESEK[k.idx];
        k.kesz.push({ id: q.id, nap: this.day() });
        k.idx++;
        const j = q.jutalom || {};
        if (j.kp) this.core.money += j.kp;
        if (j.cikk) for (const [id, db] of Object.entries(j.cikk)) this._ad(id, db);
        if (j.xp) this.addXp(j.xp);
        this.msg(`Nagyapa füzete — kész: ${q.cim}.`);
        this.emit({ type: 'quest', id: q.id, cim: q.cim, kesz: true, jutalom: j });
        this.emit({ type: 'sfx', id: 'kuldetes' });
        const kov = KULDETESEK[k.idx];
        if (kov) this.emit({ type: 'quest', id: kov.id, cim: kov.cim, szoveg: kov.szoveg, kesz: false });
      }
    } finally { this._qLock = false; }
  },
};
