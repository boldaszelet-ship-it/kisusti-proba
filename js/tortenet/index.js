// Kisüsti — a történeti réteg belépési pontja: intró, tutorial („Nagyapa cetlijei”), történeti jelenetek, reggeli Hírmondó.
// A jatek.js-ből három hívás köti be: ujJatek(E) az új játék végén, esemeny(e) a sim eseményeire, step(dt) a fő hurok végén;
// a próbák kampói a window.__teszt-be kerülnek (tesztKampok). Az állapot az E.s.tortenet-ben él (mentéssel együtt megy);
// régi mentésnél nincs ilyen mező: ott sem intró, sem tutorial nem indul újra, a jelenetek viszont élesíthetők.
import { Intro } from './intro.js';
import { Tutorial } from './tutorial.js';
import { Jelenetek } from './jelenet.js';
import { JELENETEK } from '../../data/tortenet.js';
import { gyoker, hirmondo, TH } from './kozos.js';

const Q = new URLSearchParams(location.search);

export class Tortenet {
  constructor(J) {
    this.J = J; this.E = null;
    gyoker();
    this.intro = new Intro(J);
    this.tut = new Tutorial(J, this);
    this.jel = new Jelenetek(J, this);
    // tesztmódban a jelenetek nem élesednek maguktól (a probe_jatek determinisztikus marad); a kampó vagy ?jelenetek=1 igen
    this.jel.auto = !J.TEST || Q.has('jelenetek');
  }
  /** A mentett történeti állapot (a sim állapotában, így a mentés viszi). */
  get TS() { return this.E?.s?.tortenet || null; }
  _kot(E) {
    this.E = E;
    if (!E?.s) return;   // coop-vendég (proxy): a történetet a gazda futtatja
    const TS = E.s.tortenet ||= {};
    TS.flag ||= {}; TS.jel ||= {}; TS.hirSor ||= []; TS.masnap ||= [];
    this.tut.ujraKot(); this.jel.ujraKot();
  }

  /** Új játék (a jatek.js ujJatek() végén): intró a sim indulása előtt, utána a tutorial. Tesztmódban egyik sem indul
   *  magától (?intro=1 / ?tutorial=1 vagy a kampók). */
  ujJatek(E) {
    this._kot(E);
    if (!this.TS) return;
    const J = this.J, intro = !J.TEST || Q.has('intro'), tutorial = !J.TEST || Q.has('tutorial');
    if (tutorial) this.tut.indit();
    // átugrás után a kihagyás-cetli 5,5 mp-ig látszik: a tutorial első cetlije utána jön, nem helyette
    if (intro) this.intro.indit({ vege: atugorva => { this.tut.indulT = atugorva ? TH.intro.kihagyasCetliMp + 0.6 : TH.tut.elsoKesleltetes; } });
  }
  esemeny(e) {
    if (!this.TS || this.J.E !== this.E) return;
    this.tut.esemeny(e);
    this.jel.esemeny(e);
  }
  step(dt) {
    if (this.J.E !== this.E) this._kot(this.J.E);
    if (!this.TS || this.J.mod !== 'jatek') return;
    this.tut.step(dt);
    this.jel.step(dt);
    this.tut._hir();
  }
  hirmondoMutat(cim) { hirmondo(cim); }

  /** A próbák kampói (window.__teszt). render: a jatek.js rajzolója. */
  tesztKampok({ render }) {
    const T = this, J = this.J;
    return {
      /** Az intró indítása kézi léptetéssel (tesztben nincs saját képkocka-hurok). */
      introIndit() { if (T.E !== J.E) T._kot(J.E); return T.intro.indit({ kezi: true }); },
      /** Az intró léptetése sec mp-cel (30 Hz), utána rajzolás. */
      introLep(sec, rajz = true) { const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n && T.intro.fut; i++) T.intro.lep(1 / 30); if (rajz) render(); return T.intro.fut ? T.intro.t : -1; },
      /** Ugrás az intró adott idejére (t mp), a köztes sávok lefutnak (hang nélkül nem számít). */
      introIdo(t, rajz = true) { while (T.intro.fut && T.intro.t < t) T.intro.lep(Math.min(1 / 30, t - T.intro.t + 1e-6)); if (rajz) render(); return T.intro.fut ? T.intro.t : -1; },
      introUgrik() { T.intro.ugrik(); render(); return { fut: T.intro.fut, mod: J.mod, atugorva: !!T.intro.atugorva }; },
      introAllapot: () => ({ fut: T.intro.fut, t: T.intro.t, mod: J.mod, fov: J.camera.fov }),
      tutorialIndit() { if (T.E !== J.E) T._kot(J.E); T.tut.indit(); T.tut.indulT = 0; return true; },
      tutorialKihagy() { T.tut.kihagy(); return true; },
      tutorialAllapot() {
        const t = T.TS?.tut, a = T.tut.akt;
        return t ? { aktiv: t.aktiv, fejezet: t.fejezet, lepes: a?.id || null, utasitas: T.tut.utas ? a?.utasitas : null, kesz: Object.keys(t.kesz).filter(k => !t.kihagyva[k]),
          kihagyva: Object.keys(t.kihagyva), horog: { ...t.horog }, idoSzorzo: J.E.s.idoSzorzo || 1, flag: { ...T.TS.flag } } : null;
      },
      /** Egy jelenet élesítése és indítása (a feltételtől függetlenül). o.helyben: a játékost a helyszínre teszi. */
      jelenetInditas(id, o = {}) {
        if (T.E !== J.E) T._kot(J.E);
        const j = JELENETEK.find(x => x.id === id); if (!j) return false;
        delete T.TS.jel[id];
        T.jel._leallit(false);
        T.jel.elesit(j, o.ev || null);
        if (o.helyben !== false) { const [x, z] = T.jel._pos(j, T.TS.jel[id]); J.hely(x + (o.dx ?? 0), z + (o.dz ?? -5), o.yaw ?? 180, -4); }
        T.jel._helyszinTorol(id);
        T.jel._helyszin(j, T.TS.jel[id]);
        for (const f of Object.values(T.jel.helyszin[id]?.figurak || {})) if (f.seta) { f.seta.t = f.seta.dur; f.update(0); }
        if (T.jel.helyszin[id]) { T.jel.helyszin[id].kesz = true; T.jel.helyszin[id].autoLep?.(99); }
        return T.jel.indit(id);
      },
      jelenetValaszt: i => T.jel.valaszt(i),
      jelenetAllapot() {
        const F = T.jel.fut;
        return { fut: F ? { id: F.id, fazis: F.fazis, sor: F.i, sorok: F.sorok.length } : null, jel: JSON.parse(JSON.stringify(T.TS?.jel || {})), flag: { ...(T.TS?.flag || {}) }, nagy: T.TS?.nagy || null, hirSor: [...(T.TS?.hirSor || [])] };
      },
      tortenetAllapot: () => JSON.parse(JSON.stringify(T.TS || null)),
    };
  }
}
