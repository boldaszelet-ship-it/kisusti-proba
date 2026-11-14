// Kisüsti — a történeti jelenetek futtatója (data/tortenet.js JELENETEK) és a horgaik (TORTENET.md, Horgok 11–13).
// Élesítés (`mikor`: sim-esemény és/vagy állapot) → várakozás a helyszínen (a `jon: true` szereplő a tanya kapujához
// jön, szolgálati autóval is) → indulás, ha a játékos `r` méteren belül van → sorok feliratként (a játékos mozoghat) →
// döntés (1/2/3 vagy egér) → válasz → hatások a simre. Elsétálva elhalasztódik. Az állapot az E.s.tortenet.jel-ben.
import * as THREE from 'three';
import { JELENETEK, EPILOGUSOK } from '../../data/tortenet.js';
import { REGIONS, PROPERTIES } from '../../data/regions.js';
import { TH, q, sor, sorKi, cetli, sorHossz, nevE, Figura } from './kozos.js';

const KAPU = [0, 13.4];
const KAPU_HELYEK = [[0.9, 13.9], [-0.9, 14.2], [2.6, 13.8]];      // a kapunyílásban, arccal az udvar felé (szereplok.js talalkozoHely)
const BEJOVO = [-9, 17.2];                                          // innen sétál be a Fő útról
const VERSENY_SMS = {   // integrátori sorok (a narratíva még jóváhagyja): a verseny eredménye Jolántól
  nyert: '„Arany! A zsűri kétszer is kóstolta. A Hivatal is felírta.” Öt napig drágábban viszik a pálinkádat.',
  vesztett: '„Idén a Gyári nyert. Ők is neveztek. Jövőre több szívvel, kevesebb vízzel!”',
};
const _v = new THREE.Vector3();
const tav = (p, x, z) => Math.hypot(p.x - x, p.z - z);

export class Jelenetek {
  constructor(J, T) {
    this.J = J; this.T = T;
    this.fut = null;        // a futó jelenet
    this.helyszin = {};     // id → {figurak:{ki: Figura}, auto, kesz (megérkeztek)}: a várakozó jelenetek díszlete (nem mentett)
    this.pollT = 0; this.egerT = 0; this.epilog = null; this.egerMod = false;
    addEventListener('mousemove', () => { this.egerT = performance.now(); });
    addEventListener('keydown', e => this._billentyu(e), true);
    q('.tt-valasz').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) this.valaszt(+b.dataset.i); });
    // a döntés idején a lezárt egérrel kattintva felszabadul a kurzor (a választáshoz), a sim addig áll
    addEventListener('mousedown', e => {
      if (e.button !== 0 || this.fut?.fazis !== 'dontes' || this.egerMod || !document.pointerLockElement) return;
      this.egerMod = true; this.J.menuNyitva(true); document.body.classList.add('modal-tt');
    });
  }
  get TS() { return this.T.TS; }
  get E() { return this.J.E; }
  ctx() { return { flag: this.TS.flag, jatekosPos: this.J.jatekosPoz() }; }
  def(id) { return JELENETEK.find(j => j.id === id) || this.TS.jel[id]?.def || null; }

  ujraKot() {
    this._leallit(false);
    for (const id of Object.keys(this.helyszin)) this._helyszinTorol(id);
  }

  // ------------------------------------------------------------ élesítés
  esemeny(e) {
    const TS = this.TS; if (!TS) return;
    for (const j of JELENETEK) {
      if (!this.auto || TS.jel[j.id] || j.mikor?.esemeny !== e.type) continue;
      let ok = false; try { ok = !!j.mikor.felt(this.J.E.state, e, this.ctx()); } catch (err) { ok = false; }
      if (ok) this.elesit(j, e);
    }
    // a lagzi 20 litere (horog: nagyRendeles)
    const n = TS.nagy;
    if (n && (e.type === 'sale' || e.type === 'orderExpired') && e.rendeles === n.id) {
      const siker = e.type === 'sale';
      if (siker && n.utanaGyanu) this.E.addSuspicion(n.utanaGyanu.regio, n.utanaGyanu.ertek);
      const u = this.def(n.jelenet)?.utana?.[siker ? 'siker' : 'kudarc'];
      if (u?.sms) this.E._sms(u.sms.kitol, nevE(u.sms.kitol), u.sms.szoveg);
      if (u?.hirmondo) TS.hirSor.push({ nap: this.E.day() + 1, cim: u.hirmondo });
      TS.nagy = null;
    }
  }
  elesit(j, ev = null) {
    const TS = this.TS;
    if (TS.jel[j.id]) return false;
    const st = TS.jel[j.id] = { allapot: 'var', nap: this.E.day() };
    if (ev) st.ev = { type: ev.type, prop: ev.prop, talalt: !!ev.talalt, rang: ev.rang };
    if (j.hely?.jon) this.J.uzen(`Valaki jön a kapuhoz: ${j.cim}.`);
    else if (!j.hely?.aktualis) this.J.uzen(`Nagyapa füzete: ${j.cim} — ${nevE(j.szereplok?.[0])} vár.`);
    return true;
  }
  /** A jelenet helye (x, z). */
  _pos(j, st) {
    if (j.hely?.jon) return KAPU;
    if (j.hely?.aktualis) { const P = PROPERTIES.find(p => p.id === st?.ev?.prop); return P ? P.pos : KAPU; }
    return j.hely?.pos || KAPU;
  }

  // ------------------------------------------------------------ léptetés
  step(dt) {
    const TS = this.TS, J = this.J; if (!TS) return;
    const S = J.S;
    this.pollT -= dt;
    if (this.pollT <= 0) {
      this.pollT = 0.5;
      for (const j of JELENETEK) {
        if (!this.auto || TS.jel[j.id] || j.mikor?.esemeny) continue;
        let ok = false; try { ok = !!j.mikor?.felt(S, null, this.ctx()); } catch (err) { ok = false; }
        if (ok) this.elesit(j);
      }
      this._verseny();
      this._masnap();
    }
    // várakozók: díszlet (szereplők, autó) és indulás
    const p = J.jatekosPoz();
    for (const [id, st] of Object.entries(TS.jel)) {
      if (st.allapot !== 'var') continue;
      const j = this.def(id); if (!j) continue;
      const [x, z] = this._pos(j, st);
      const oraOk = !j.hely?.ora || (S.ido.ora >= j.hely.ora[0] && S.ido.ora < j.hely.ora[1]);
      const kell = oraOk && (j.hely?.jon || tav(p, x, z) < TH.jelenet.spawnTav);
      if (kell && !this.helyszin[id]) this._helyszin(j, st);
      else if (!kell && this.helyszin[id] && this.fut?.id !== id) this._helyszinTorol(id);
      const r = j.hely?.r ?? 18;
      if (!this.fut && oraOk && this._indulhat() && tav(p, x, z) < r && (!this.helyszin[id] || this.helyszin[id].kesz)) this.indit(id);
    }
    for (const h of Object.values(this.helyszin)) { for (const f of Object.values(h.figurak)) f.update(dt); h.autoLep?.(dt); }
    if (this.fut) this._futLep(dt);
    if (this.epilog) this._epilogLep(dt);
  }
  _indulhat() {
    const J = this.J;
    return J.mod === 'jatek' && !J.ui?.isOpen?.() && !J.ust?.() && !J.sz?.jelenet && !J.buszNyitva && !this.T.intro?.fut;
  }

  // ------------------------------------------------------------ díszlet: szereplők a helyükön (a kapuhoz sétálva / autóval)
  _helyszin(j, st) {
    const J = this.J, h = this.helyszin[j.id] = { figurak: {}, kesz: false, auto: null };
    const kik = (j.szereplok || []);
    const [x, z] = this._pos(j, st);
    if (j.hely?.aktualis) { h.kesz = true; return; }   // a házkutatás figurái a szereplok.js-éi
    if (!j.hely?.jon) {
      const p = J.jatekosPoz();
      kik.forEach((ki, i) => {
        const fx = x + (i - (kik.length - 1) / 2) * 1.3, fz = z;
        const f = new Figura(J, ki, fx, fz, Math.atan2(p.x - fx, p.z - fz));
        h.figurak[ki] = f;
      });
      h.kesz = true;
      return;
    }
    // a kapuhoz jön: a Fő útról besétál (szolgálati autóval: az autó előbb begördül és megáll)
    const setal = (ki, i, kesleltet = 0) => {
      const [kx, kz] = KAPU_HELYEK[i % KAPU_HELYEK.length];
      const from = h.auto ? [TH.jelenet.autoParkol[0] - 1.4, TH.jelenet.autoParkol[1] - 1.6] : [BEJOVO[0] - i * 1.2, BEJOVO[1]];
      const f = new Figura(J, ki, from[0], from[1], 0);
      f.obj.visible = kesleltet <= 0;
      h.figurak[ki] = f;
      const megy = () => { f.obj.visible = true; f.setal(kx, kz, Math.PI, () => { if (Object.values(h.figurak).every(g => !g.seta && g.obj.visible)) h.kesz = true; }); };
      if (kesleltet > 0) setTimeout(megy, kesleltet * 1000); else megy();
    };
    if (j.hely.jarmu === 'penzugyor') {
      const [ax, az] = TH.jelenet.autoParkol, ido = TH.jelenet.autoBe;
      const n = J.npc.jaror([[ax - 0.1, az], [ax, az]], { seb: 0.01, sav: 0 });
      n.var = 1e9; n.obj.rotation.y = Math.PI / 2;
      J.G?.kontakt(n.obj, 1.05, 2.1);
      h.auto = n;
      let t = 0;
      const x0 = ax - 70;
      h.autoLep = dt => {
        if (t > ido) return;
        t += dt;
        const u = Math.min(1, t / ido), e = 1 - Math.pow(1 - u, 2.2);   // a hangmotor jelenet-görbéjével egyezik
        n.obj.position.set(x0 + (ax - x0) * e, J.V.talaj(ax, az), az);
      };
      h.autoLep(0);
      J.hang.jelenet('penzugyor', { pos: [ax, 0.7, az], kapu: [KAPU_HELYEK[0][0], 0, KAPU_HELYEK[0][1]] });
      kik.forEach((ki, i) => setal(ki, i, J.TEST ? 0 : ido + 2.2 + i * 0.6));
    } else kik.forEach((ki, i) => setal(ki, i));
  }
  _helyszinTorol(id, elsetal = false) {
    const h = this.helyszin[id]; if (!h) return;
    delete this.helyszin[id];
    const J = this.J;
    const vege = () => {
      for (const f of Object.values(h.figurak)) f.torol();
      if (h.auto && J.npc.lista.includes(h.auto)) { J.G?.kontaktTorol(h.auto.obj); J.npc.torol(h.auto); }
    };
    if (!elsetal) { vege(); return; }
    // elsétálnak (a Fő út felé), az autó elhajt keletre
    const marad = { figurak: h.figurak, kesz: true, auto: h.auto };
    this.helyszin['~' + id] = marad;
    let db = Object.keys(h.figurak).length;
    const kesz = () => { if (--db <= 0) { delete this.helyszin['~' + id]; if (h.auto) this._autoEl(h.auto); for (const f of Object.values(h.figurak)) f.torol(); } };
    if (!db) { delete this.helyszin['~' + id]; if (h.auto) this._autoEl(h.auto); return; }
    for (const f of Object.values(h.figurak)) {
      f.obj.visible = true;
      const o = f.obj.position;
      const cel = h.auto ? [TH.jelenet.autoParkol[0] - 1.2, TH.jelenet.autoParkol[1] - 1.4] : o.z > 10 ? [BEJOVO[0] - 4, BEJOVO[1]] : [o.x + 8, o.z + 8];
      f.setal(cel[0], cel[1], null, kesz);
    }
  }
  _autoEl(n) {
    const J = this.J;
    J.hang.play('ajto_csapas', { pos: n.obj.position.clone() });
    const h = J.hang.loop('motor_penzugyor', { pos: n.obj, doppler: true, rpm: 0.3, gaz: 0.5, vol: 0.9 });
    const x0 = n.obj.position.x, z = n.obj.position.z;
    J.tweenek.push({ t: 0, dur: 9, f: a => { const e = a * a; n.obj.position.set(x0 + 110 * e, J.V.talaj(x0 + 110 * e, z), z); }, kesz: () => { h?.stop(0.6); J.G?.kontaktTorol(n.obj); if (J.npc.lista.includes(n)) J.npc.torol(n); } });
  }

  // ------------------------------------------------------------ futás
  /** Indítás (a próba is hívhatja: a helyszín nélkül is indul). */
  indit(id) {
    const j = this.def(id), st = this.TS.jel[id];
    if (!j || !st || this.fut) return false;
    if (!this.helyszin[id]) this._helyszin(j, st);
    let sorok = j.sorok || [];
    if (j.valtozatok) {
      const v = Object.values(j.valtozatok).find(v => { try { return v.felt(this.J.S, st.ev || {}, this.ctx()); } catch (e) { return false; } });
      sorok = v?.sorok || sorok;
    }
    this.fut = { id, j, st, sorok: [...sorok], i: -1, t: 0, dur: 0, koz: 0, fazis: 'sor', valasz: null };
    st.allapot = 'fut';
    document.body.classList.add('tt-jelenet');
    for (const hj of j.hangjel || []) {
      if (hj.id?.startsWith('jelenet:') || hj.tipus === 'ambient') continue;
      const [x, z] = this._pos(j, st);
      this.J.hang.play(hj.id, { pos: hj.pos || [x, 1, z], vol: 0.8 });
    }
    this._kovSor();
    return true;
  }
  _fig(ki) { for (const h of Object.values(this.helyszin)) if (h.figurak[ki]) return h.figurak[ki]; return null; }
  _kovSor() {
    const F = this.fut;
    F.i++; F.t = 0;
    const s = F.sorok[F.i];
    if (!s) { this._sorokVege(); return; }
    F.dur = sorHossz(s.szoveg);
    sor(s.ki, s.szoveg);
    const b = this._fig(s.ki);
    const cam = this.J.camera.position;
    for (const h of Object.values(this.helyszin)) for (const f of Object.values(h.figurak)) { if (f !== b) f.nez(b ? b.obj : cam); }
    if (b) { b.nez(this.J.camera); b.beszel(true, s.anim || null); }
    F.beszelo = b;
  }
  _sorokVege() {
    const F = this.fut;
    F.beszelo?.beszel(false);
    sorKi();
    if (F.fazis === 'sor' && F.j.dontes) { this._dontes(); return; }
    if (F.fazis === 'sor' && F.j.hatas) this._hatas(F.j.hatas);
    this._vege();
  }
  _futLep(dt) {
    const F = this.fut, J = this.J;
    const [x, z] = this._pos(F.j, F.st);
    const r = F.j.hely?.r ?? 18;
    // elsétált: elhalasztva (a szereplők megvárják)
    if (!F.j.hely?.aktualis && tav(J.jatekosPoz(), x, z) > r * TH.jelenet.elhalasztTav && !this.egerMod) {
      J.uzen(`${nevE(F.j.szereplok?.[0])}: „Majd visszajössz, ha ráérsz.”`);
      this._leallit(true); return;
    }
    // a fej finoman a beszélő felé, ha az egér 2 mp-e áll
    const b = F.beszelo;
    if (b && performance.now() - this.egerT > TH.jelenet.fejFordul * 1000 && !J.bemenet.van('KeyW', 'KeyA', 'KeyS', 'KeyD')) {
      b.obj.getWorldPosition(_v); J.nezRa(_v.x, _v.y + (b.ul ? 1.1 : 1.55), _v.z, dt * 0.35);
    }
    if (F.fazis === 'dontes') return;
    F.t += dt;
    if (F.koz > 0) { F.koz -= dt; if (F.koz <= 0) this._kovSor(); return; }
    if (F.t >= F.dur) {
      F.beszelo?.beszel(false);
      if (F.i + 1 < F.sorok.length) { sorKi(); F.koz = TH.sorKoz; } else this._sorokVege();
    }
  }
  _dontes() {
    const F = this.fut, S = this.J.S, el = q('.tt-valasz');
    F.fazis = 'dontes';
    el.innerHTML = '';
    F.j.dontes.opciok.forEach((o, i) => {
      let ok = true; try { ok = !o.feltetel || !!o.feltetel(S, this.ctx()); } catch (e) { ok = false; }
      const b = document.createElement('button'); b.dataset.i = i; b.disabled = !ok;
      b.innerHTML = `<kbd>${i + 1}</kbd><span></span>`;
      b.querySelector('span').textContent = o.szoveg;
      if (!ok) { const s = document.createElement('small'); s.textContent = (S.nalad ?? 0) < 0.5 ? 'Nincs nálad pálinka.' : 'Most nem lehet.'; b.querySelector('span').appendChild(s); }
      el.appendChild(b);
    });
    const tipp = document.createElement('div'); tipp.className = 'tt-tipp';
    tipp.textContent = this.J.TEST || !document.pointerLockElement ? '1–' + F.j.dontes.opciok.length + ' vagy kattintás' : '1–' + F.j.dontes.opciok.length + ' · kattintásra az egér is választhat';
    el.appendChild(tipp);
    el.classList.add('be');
  }
  /** Választás (0-tól). */
  valaszt(i) {
    const F = this.fut; if (!F || F.fazis !== 'dontes') return false;
    const o = F.j.dontes.opciok[i]; if (!o) return false;
    let ok = true; try { ok = !o.feltetel || !!o.feltetel(this.J.S, this.ctx()); } catch (e) { ok = false; }
    if (!ok) { this.J.hang.play('ui_click', { pitch: 0.6, vol: 0.5 }); return false; }
    const gomb = q(`.tt-valasz button[data-i="${i}"]`); gomb?.classList.add('valasztott');
    this.J.hang.play('ui_click', { pitch: 1.2, vol: 0.6 });
    if (this.egerMod) { this.egerMod = false; this.J.menuNyitva(false); document.body.classList.remove('modal-tt'); }
    setTimeout(() => q('.tt-valasz').classList.remove('be'), TH.jelenet.valaszVar * 1000);
    const r = this._hatas(o.hatas || []);
    F.st.valasz = i;
    F.fazis = 'valasz';
    F.sorok = r.hiba && o.kudarc ? [...o.kudarc] : [...(o.valasz || [])];
    F.i = -1; F.koz = TH.jelenet.valaszVar + 0.15; F.t = 0;
    if (!F.sorok.length) this._vege();
    return true;
  }
  _billentyu(e) {
    const F = this.fut;
    if (!F || (this.J.ui?.isOpen?.() && !this.egerMod)) return;   // nyitott telefon/menü: a számok az övéi
    if (F.fazis === 'dontes') {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m) { e.preventDefault(); e.stopImmediatePropagation(); this.valaszt(+m[1] - 1); return; }
      if (e.code === 'Escape' && this.egerMod) { e.preventDefault(); e.stopImmediatePropagation(); this.egerMod = false; this.J.menuNyitva(false); document.body.classList.remove('modal-tt'); }
      return;
    }
    if (e.code === 'Enter' && F.koz <= 0) { e.preventDefault(); F.t = F.dur; }   // Enter: tovább a következő sorra
  }
  _vege() {
    const F = this.fut; if (!F) return;
    const TS = this.TS;
    F.st.allapot = 'kesz';
    if (F.j.hirmondo) TS.hirSor.push({ nap: this.E.day() + 1, cim: F.j.hirmondo });   // a következő napi Hírmondóban
    const u = F.j.utana?.masnapReggel;
    if (u) TS.masnap.push({ nap: this.E.day() + 1, ki: u.ki, szoveg: u.szoveg, hely: u.hely, id: F.id + '_utana' });
    this.fut = null;
    document.body.classList.remove('tt-jelenet');
    q('.tt-valasz').classList.remove('be');
    sorKi();
    setTimeout(() => this._helyszinTorol(F.id, true), 1200);
  }
  /** Leállítás: elhalasztva (vissza várakozóba) vagy betöltéskor (díszlet nélkül). */
  _leallit(halaszt) {
    const F = this.fut; if (!F) return;
    if (this.egerMod) { this.egerMod = false; this.J.menuNyitva(false); document.body.classList.remove('modal-tt'); }
    F.beszelo?.beszel(false);
    if (halaszt) F.st.allapot = 'var';
    this.fut = null;
    document.body.classList.remove('tt-jelenet');
    q('.tt-valasz').classList.remove('be');
    sorKi();
  }

  // ------------------------------------------------------------ hatások (SIM-API + horgok)
  _hatas(lista) {
    const E = this.E, TS = this.TS, J = this.J;
    let hiba = false;
    for (const h of lista) {
      if (h.api) {
        const args = h.args.map(a => (a === '$tetel05' ? E.tetelekItt('nalad').filter(t => t.l >= 0.5 - 1e-6).sort((a, b) => a.l - b.l)[0]?.id : a));
        if (args.includes(undefined) || typeof E[h.api] !== 'function') { hiba = true; continue; }
        const r = E[h.api](...args);
        if (r && r.ok === false) hiba = true;
        continue;
      }
      if (h.flag) { TS.flag[h.flag] = h.ertek; continue; }
      switch (h.horog) {
        case 'nagyRendeles': {
          const most = E.now(), hatarido = Math.floor(most / 1440) * 1440 + h.hataridoNap * 1440 + h.hataridoOra * 60;
          const r = E.forceOrder(h.vevo, { l: h.l, minFok: h.minFok, arSzorzo: h.arSzorzo, ablak: [most, hatarido], cimke: 'lakodalom', elfogad: true });
          if (r.ok) TS.nagy = { id: r.rendeles.id, jelenet: this.fut?.id, utanaGyanu: h.utanaGyanu };
          break;
        }
        case 'gyariErosodik': E.s.gyari.ero = Math.min(1, (E.s.gyari.ero || 0) + h.ertek); break;
        case 'vevoSzunet': {
          const st = E.s.vevok[h.vevo]; if (!st) break;
          st.kov = Math.max(st.kov, E.now() + h.nap * 1440);
          if (h.utanaHuseg) st.huseg = Math.min(100, st.huseg + h.utanaHuseg);
          break;
        }
        case 'jelol': {
          const P = PROPERTIES.find(p => p.id === h.id);
          TS.jelolesek = [...new Set([...(TS.jelolesek || []), h.id])];
          J.uzen(`Nagyapa füzetében bekarikázva: ${P ? P.nev : h.id}.`);
          break;
        }
        case 'verseny': TS.verseny = { nev: h.nev, minQ: h.minQ, nyeremeny: h.nyeremeny, eredmeny: E.now() + 2 * 1440 }; break;
        case 'penz': E._bevetel(h.osszeg); J.uzen(`A zsebedbe került: ${h.osszeg.toLocaleString('hu-HU')} Ft.`); break;
        case 'gyanuMindenhol': for (const r of REGIONS) E.addSuspicion(r.id, h.ertek); break;
        case 'epilogus': this.epilog = { lista: [...(EPILOGUSOK[h.id] || [])], i: -1, t: 0 }; break;
      }
    }
    return { hiba };
  }
  _epilogLep(dt) {
    const e = this.epilog;
    e.t -= dt;
    if (e.t > 0 || this.fut) return;
    e.i++;
    if (e.i >= e.lista.length) { this.epilog = null; return; }
    cetli(e.lista[e.i], 5, { alairas: '' });
    e.t = 5.4;
  }
  /** A verseny eredménye 2 nappal a nevezés után: a legjobb tétel minősége dönt. */
  _verseny() {
    const TS = this.TS, E = this.E, v = TS.verseny;
    if (!v || E.now() < v.eredmeny) return;
    TS.verseny = null;
    const legjobb = Math.max(0, ...Object.values(E.s.tetelek || {}).map(t => t.q || 0));
    if (legjobb >= v.minQ) {
      const ny = v.nyeremeny || {};
      if (ny.cimke) E._ad('cimke_' + ny.cimke, 6);
      E.s.arBonusz = { szorzo: ny.arSzorzo || 1, eddig: E.now() + (ny.nap || 5) * 1440 };
      E._sms('jolan', nevE('jolan'), VERSENY_SMS.nyert);
      TS.flag.versenyEredmeny = 'nyert';
    } else { E._sms('jolan', nevE('jolan'), VERSENY_SMS.vesztett); TS.flag.versenyEredmeny = 'vesztett'; }
  }
  /** Másnap reggeli rövid jelenet (j08 után Marika a pogácsával). */
  _masnap() {
    const TS = this.TS, S = this.J.S;
    for (let i = TS.masnap.length - 1; i >= 0; i--) {
      const m = TS.masnap[i];
      if (S.ido.nap < m.nap || S.ido.ora < 7) continue;
      TS.masnap.splice(i, 1);
      TS.jel[m.id] = { allapot: 'var', nap: S.ido.nap, def: { id: m.id, cim: 'Reggel a kapuban', hely: { pos: m.hely, r: 18, jon: true }, szereplok: [m.ki], sorok: [{ ki: m.ki, anim: 'holding-right', szoveg: m.szoveg }] } };
    }
  }
}
