// Kisüsti — „Nagyapa cetlijei”: a tutorial futtatója (data/tortenet.js TUTORIAL). A lépések célfeltételei a tényleges
// játékállapotból (sim-pillanatkép + sim-események + a futtató ctx-je). Nem zár: a játékos szabadon mozog; ami már
// teljesült, csendben kész (az ügyest nem tanítjuk). Élesedéskor egyszer a cetli; a jelölő azonnal, az utasítás csak a
// türelmi idő után (adaptív segítség). Az állapot az E.s.tortenet.tut-ban él, így a mentéssel együtt megy.
import * as THREE from 'three';
import { TUTORIAL, HIRMONDO_ELSO } from '../../data/tortenet.js';
import { TH, q, cetli, cetliKi, sor } from './kozos.js';

const L = TUTORIAL.lepesek, B = TUTORIAL.beallitas;
const UI_CEL = { 'ust-homero': '#ust .sav', 'ust-edeny': '#ust-edeny', telefon: '.ku-teljel', gyanu: '.ku-gyanu', nalad: '.ku-zseb' };
const KOVACSNE_SOR = 'Füstöl a kémény, kedves. Csak mondom.';   // TORTENET.md, Horgok 7.
const MARIKA_SOR = 'A vérnyomásomra nem jó. A pálinkába igen.'; // TORTENET.md, Horgok 9.
const KBD = /(^|[\s(])(WASD|W\/S|SPACE|Space|Tab|E|Q|R)(?=[:\s,.!)]|$)/g;
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const _v = new THREE.Vector3();

export class Tutorial {
  constructor(J, T) { this.J = J; this.T = T; this.ellT = 0; this.akt = null; this.aktT = 0; this.tartT = 0; this.utas = false; this.indulT = 0; this.varok = []; }
  get t() { return this.T.TS?.tut; }
  get E() { return this.J.E; }
  bekapcsolva() { return this.J.ui?.beallitasok?.cetlik !== false; }

  /** Új játék: a tutorial első napjának beállításai (TUTORIAL.beallitas) a sim állapotára. */
  indit() {
    const E = this.E, TS = this.T.TS;
    TS.tut = { aktiv: true, kesz: {}, kihagyva: {}, horog: {}, fejezet: 1, cetli: {} };
    E.s.idoSzorzo = B.idoSzorzo.ertek;
    // csendes kezdés: az első napon senki nem ír magától; Kovács (elsoVevo) és a kocsmáros (elsoSms) a tutorial horgán jön
    // (a kezdő cefre már a jatek.js ujJatek()-ben kész: nagyapa utolsó hordója)
    let k = 0;
    for (const st of Object.values(E.s.vevok)) if (st.allapot === 'aktiv') st.kov = Math.max(st.kov, 1440 + 7 * 60 + (k++) * 70);
    this.indulT = TH.tut.elsoKesleltetes;
    this.akt = null;
  }
  kihagy() {
    const t = this.t; if (!t) return;
    t.aktiv = false; this.E.s.idoSzorzo = 1;
    // a horgok nélkül is legyen első vevő: ha Kovács még nem jött, a megszokott módon ír
    if (!t.horog.elsoVevo && this.E.s.vevok.kovacs) this.E.s.vevok.kovacs.kov = Math.min(this.E.s.vevok.kovacs.kov, this.E.now() + 30);
    if (!t.horog.elsoSms && this.E.s.vevok.kocsmaros) this.E.s.vevok.kocsmaros.kov = Math.min(this.E.s.vevok.kocsmaros.kov, this.E.now() + 120);
    this._rejt(true); cetliKi();
  }
  /** Betöltés vagy Empire-csere után: a futó időzítők nullázva, az állapot a mentésből. */
  ujraKot() { this.akt = null; this.aktT = 0; this.utas = false; this.varok = []; this._rejt(true); }

  ctx() { return { flag: this.T.TS.flag, mp: this.aktT, jatekosPos: this.J.jatekosPoz() }; }

  // ------------------------------------------------------------ léptetés
  step(dt) {
    const t = this.t, J = this.J;
    if (!t?.aktiv) return;
    const S = J.S;
    // várakozó horog-események (valós mp)
    for (let i = this.varok.length - 1; i >= 0; i--) { const v = this.varok[i]; v.mp -= dt; if (v.mp <= 0) { this.varok.splice(i, 1); v.fn(); } }
    // a telefon első megnyitása (a kocsmáros SMS-e után számít)
    if (t.horog.elsoSmsKesz && J.ui?.modal?.fajta === 'telefon') this.T.TS.flag.telefonNyitva = true;
    if (S.stat?.vizezes >= 1) this.T.TS.flag.vizezett = true;
    // az időszorzó csak bekapcsolt cetlikkel és a t_alvas-ig él
    this.E.s.idoSzorzo = this.bekapcsolva() && !t.kesz[B.idoSzorzo.amig] ? B.idoSzorzo.ertek : 1;
    if (this.indulT > 0) { this.indulT -= dt; return; }
    this.ellT -= dt;
    if (this.ellT <= 0) { this.ellT = TH.tut.ellenorzes; this._ellenoriz(null); }
    const L0 = this.akt;
    if (L0) {
      if (!this.varok.some(v => v.lepes === L0.id)) this.aktT += dt;
      // tartás (pl. a hőfok 3 mp-ig a sávban)
      if (L0.tartMp) {
        if (this._kesz(L0, null)) { this.tartT += dt; if (this.tartT >= L0.tartMp) this._lezar(L0, true); } else this.tartT = 0;
      }
      if (this.akt && !this.utas && this.aktT >= L0.turelem) this._utasitas(L0);
      // aki a segítség után sem boldogul vele, annak a lépést elengedjük (ne akadjon meg a nap)
      // (a napszakhoz/eseményhez kötött lépést — alvás, elrejtés — nem: az magától lezárul)
      if (this.akt && this.utas && L0.fejezet === 1 && !L0.mikor && this.aktT > L0.turelem + TH.tut.elengedes) { t.kihagyva[L0.id] = true; this._lezar(L0, false); }
    }
    this._jelolo();
  }
  esemeny(e) {
    const t = this.t; if (!t?.aktiv) return;
    if (e.type === 'sale' && e.vevo === 'kovacs') this.T.TS.flag.eladasKovacs = true;
    if (e.type === 'dayEnd' && !t.elsoReggel) {
      t.elsoReggel = true;
      const F = this.T.TS.flag;
      const jo = HIRMONDO_ELSO.filter(h => h.ha && F[h.ha]);
      const h = (jo.length ? jo : HIRMONDO_ELSO.filter(x => !x.ha && !x.tipus))[0];
      if (h) this.T.TS.hirSor.push({ nap: this.E.day(), cim: h.cim });   // a dayEnd után már az új nap van
    }
    this._ellenoriz(e);
  }

  // ------------------------------------------------------------ lépések
  _kesz(l, ev) { try { return !!l.kesz(this.J.S, ev, this.ctx()); } catch (err) { return false; } }
  _mikor(l) { try { return !l.mikor || !!l.mikor(this.J.S, this.ctx()); } catch (err) { return false; } }
  _ellenoriz(ev) {
    const t = this.t; if (!t?.aktiv) return;
    // 1) ami teljesült, kész (az aktív lépés is; tartásos lépésnél a tartás dönt)
    for (const l of L) {
      if (t.kesz[l.id] || t.kihagyva[l.id] || l.fejezet > t.fejezet) continue;
      if (l.tartMp && l === this.akt && (this.J.S.stat?.fozes ?? 0) < 1) continue;
      if (this._kesz(l, ev)) this._lezar(l, l === this.akt);
    }
    // 2) az első napon sorban; ha a t_alvas megvolt, a többi első napi lépésnek vége
    if (t.fejezet === 1 && (t.kesz.t_alvas || L.filter(l => l.fejezet === 1).every(l => t.kesz[l.id] || t.kihagyva[l.id]))) {
      for (const l of L) if (l.fejezet === 1 && !t.kesz[l.id]) t.kihagyva[l.id] = true;
      t.fejezet = 2; this.E.s.idoSzorzo = 1;
      if (this.akt?.fejezet === 1) this._ki();
    }
    // 3) az aktív lépés kiválasztása
    let uj = null;
    if (t.fejezet === 1) {
      for (const l of L) {
        if (l.fejezet !== 1) continue;
        if (t.kesz[l.id] || t.kihagyva[l.id]) { this._horog(l); continue; }
        if (this._mikor(l)) { this._horog(l); uj = l; }
        break;
      }
    } else {
      // a második nap: független tippek, csak a hibázónak (az első, amelyik most érvényes)
      for (const l of L) {
        if (l.fejezet !== 2) continue;
        if (l.ismetelheto && t.kesz[l.id] && !this._mikor(l)) delete t.kesz[l.id];
        if (t.kesz[l.id] || t.kihagyva[l.id]) continue;
        if (this._mikor(l)) { this._horog(l); uj = l; break; }
      }
      if (!uj && L.filter(l => l.fejezet === 2 && !l.ismetelheto).every(l => t.kesz[l.id] || t.kihagyva[l.id])) { t.aktiv = false; this._rejt(true); return; }
    }
    if (uj !== this.akt) this._aktival(uj);
  }
  _aktival(l) {
    this._ki();
    this.akt = l; this.aktT = 0; this.tartT = 0; this.utas = false;
    if (!l) return;
    const t = this.t;
    if (!t.cetli[l.id] && l.cetli) {
      t.cetli[l.id] = true;
      if (this.bekapcsolva()) cetli(l.cetli, TH.tut.cetliMp, { oldal: true, alairas: '— Nagyapa' });
    }
  }
  _lezar(l, latszott) {
    const t = this.t;
    t.kesz[l.id] = true;
    if (l === this.akt) {
      if (latszott && this.utas && this.bekapcsolva()) {
        const el = q('.tt-utasitas'); el.classList.add('kesz');
        this.J.hang.play('ui_click', { pitch: 1.5, vol: 0.5 });
        setTimeout(() => { el.classList.remove('be'); setTimeout(() => el.classList.remove('kesz'), 300); }, TH.tut.keszVillan * 1000);
        this.utas = false;
      }
      this.akt = null; this._jeloloKi();
      if (!latszott) this._ki();
    }
  }
  _ki() { q('.tt-utasitas').classList.remove('be', 'kesz'); this._jeloloKi(); this.utas = false; }
  _rejt() { this._ki(); }
  _utasitas(l) {
    if (!this.bekapcsolva()) return;
    this.utas = true;
    const el = q('.tt-utasitas');
    el.classList.remove('kesz');
    el.innerHTML = esc(l.utasitas).replace(KBD, (m, a, k) => `${a}<kbd>${k}</kbd>`);
    el.classList.add('be');
  }

  // ------------------------------------------------------------ horgok (TORTENET.md, Horgok 5–7, 9)
  _horog(l) {
    const t = this.t, E = this.E, J = this.J;
    if (!l.horog || t.horog[l.horog]) return;
    t.horog[l.horog] = true;
    if (l.horog === 'elsoVevo') {
      const o = B.elsoVevo, most = E.now();
      // Kovács bácsi a kapuban áll, SMS nélkül; a mérce az első saját főzéshez igazítva (ne az első kísérlet bukjon el)
      E.forceOrder(o.vevo, { l: o.l, hely: o.hely, csendes: true, ablak: [most - 20, most + 10 * 60], minQ: 30, minFok: 38 });
    } else if (l.horog === 'elsoSms') {
      const o = B.elsoSms;
      this.varok.push({ mp: o.kesleltetes, lepes: l.id, fn: () => { E.forceOrder(o.vevo, { l: o.l, hely: o.hely }); t.horog.elsoSmsKesz = true; } });
    } else if (l.horog === 'elhajtas') {
      sor('kovacsne', KOVACSNE_SOR, 4);
      this.varok.push({ mp: 2.5, lepes: null, fn: () => this._elhajtas() });
    } else if (l.horog === 'marikaMeze') {
      E._ad('mez', 1);
      sor('marika', MARIKA_SOR, 4.5);
      J.uzen('Marika néni hozott egy adag mézet. A keverőasztalnál jó helyen lesz.');
    }
  }
  /** A fehér autó elhajt a Fő úton (nem áll meg, nem motoz); a végén ctx.flag.elhajtasVege. */
  _elhajtas() {
    const J = this.J, o = B.elhajtas, F = this.T.TS.flag;
    const rejt0 = J.S.stat?.rejtes ?? 0;
    const n = J.npc.jaror(o.ut.map(p => [...p]), { seb: o.sebesseg, kesz: () => {
      h?.stop(0.8);
      F.elhajtasVege = true;
      if ((J.E.state.stat?.rejtes ?? 0) > rejt0) F.elrejtette = true; else F.nemRejtette = true;
      this._ellenoriz(null);
    } });
    J.G?.kontakt(n.obj, 1.05, 2.1);
    const h = J.hang.loop('motor_penzugyor', { pos: n.obj, doppler: true, rpm: 0.3, gaz: 0.4, vol: 0.9 });
  }

  // ------------------------------------------------------------ jelölő (3D pont / HUD-gyűrű) és a reggeli Hírmondó
  _jeloloKi() { q('.tt-jelolo').classList.remove('be'); q('.tt-gyuru').classList.remove('be'); }
  _jelolo() {
    const l = this.akt, J = this.J;
    const jel = q('.tt-jelolo'), gy = q('.tt-gyuru');
    const modal = J.ui?.isOpen?.();
    if (!l || !this.bekapcsolva() || J.mod !== 'jatek' || (modal && l.cel?.ui !== 'telefon')) { jel.classList.remove('be'); gy.classList.remove('be'); return; }
    const c = l.cel || {};
    if (c.ui) {
      jel.classList.remove('be');
      const el = document.querySelector(UI_CEL[c.ui] || '');
      const r = el?.getBoundingClientRect();
      const lathato = r && r.width > 0 && (!c.ui.startsWith('ust') || document.getElementById('ust')?.classList.contains('be'));
      if (!lathato || (modal && c.ui === 'telefon')) { gy.classList.remove('be'); return; }
      Object.assign(gy.style, { left: (r.left - 6) + 'px', top: (r.top - 6) + 'px', width: (r.width + 12) + 'px', height: (r.height + 12) + 'px' });
      gy.classList.add('be');
      return;
    }
    gy.classList.remove('be');
    if (!c.pos || J.ust?.()) { jel.classList.remove('be'); return; }
    const [x, z] = c.pos;
    _v.set(x, J.V.talaj(x, z) + TH.tut.jeloloMagas, z).project(J.camera);
    const mogott = _v.z > 1;
    let sx = _v.x, sy = _v.y;
    if (mogott) { sx = -sx; sy = -sy; }
    const szelen = mogott || Math.abs(sx) > 0.92 || Math.abs(sy) > 0.88;
    if (szelen) { const k = 0.92 / Math.max(Math.abs(sx) / 0.92, Math.abs(sy) / 0.88, 1e-3) / 0.92; sx *= k; sy *= k; if (mogott) sy = Math.min(sy, -0.6); }
    jel.style.left = ((sx + 1) / 2 * innerWidth) + 'px'; jel.style.top = ((1 - sy) / 2 * innerHeight) + 'px';
    jel.classList.toggle('szelen', szelen);
    jel.classList.add('be');
  }
  _hir() {
    const TS = this.T.TS, J = this.J;
    if (!TS.hirSor?.length || J.ui?.isOpen?.() || J.mod !== 'jatek' || this.T.jel.fut) return;
    const o = J.S.ido.ora; if (o < 5 || o >= 12) return;
    const i = TS.hirSor.findIndex(h => J.S.ido.nap >= h.nap);
    if (i < 0 || performance.now() < (this.hirIg || 0)) return;
    this.hirIg = performance.now() + (TH.hirMp + 1) * 1000;   // naponta több cím: egymás után, nem egymásra
    this.T.hirmondoMutat(TS.hirSor.splice(i, 1)[0].cim);
  }
}
