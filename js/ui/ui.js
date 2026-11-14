// Kisüsti UI — a vezérlő. Egyetlen belépési pont az integrátornak:
//   import { UI } from './js/ui/ui.js';
//   const ui = new UI(E, { hang, onOpen, onClose, onLoad, onBeallitas, onQuit, kozel });
//   ui.update(dt)            // minden frame-ben (valós mp); a szimulációt NEM lépteti
//   ui.open(nev, arg)        // 'telefon' | app: 'uzenetek' … | 'kever' {prop} | 'palack' {prop} | 'gyumolcsos' {prop} | 'hordo' {prop, idx?}
//                            // 'atadas' {rendeles} | 'kostolo' {vevo} | 'nap' {osszesito} | 'szunet' | 'mentes' | 'birsag' {…} | 'terkep-nagy'
//   ui.isOpen(nev?)          // nyitva van-e valami (ekkor a játék engedje el az egeret, és ne mozgassa a játékost)
//   ui.close() · ui.prompt(szoveg) · ui.setPlayer(x, z) · ui.alvas() · ui.setEmpire(E2) · ui.beallitasok
// Billentyűk: Tab vagy F telefon · Esc vissza / szünet · nyilak mozgás · Enter/Space választás · E bezárja a munkapadot.
// Nyitott felületnél a billentyűket elnyeli (a játék nem kapja meg), zárt állapotban csak a Tab, F és Esc kell neki.
import { Hud } from './hud.js';
import { TELEFON_LAPOK, kezdoLap, szalKulcs } from './telefon.js';
import { PANELEK } from './panelek.js';
import { MENUK } from './menuk.js';
import { regioAt, esc } from './kozos.js';
import { utana } from './elemek.js';
import { NODES } from '../../data/regions.js';
import { Empire } from '../../sim/empire.js';

const LAPOK = { ...TELEFON_LAPOK, ...PANELEK, ...MENUK };
const BEALL_KULCS = 'kisusti.beallitasok';
export const MENTES_KULCS = 'kisusti.mentes.';
const ALAP_BEALL = { hangero: 0.8, eger: 1, szoveg: 1, mozgas: 1 };
const FOKUSZ = 'button:not([disabled]):not(.ku-fiz), [data-st]';

export class UI {
  constructor(E, opts = {}) {
    this.opts = opts;
    this.hangObj = opts.hang || null;
    this.el = document.createElement('div');
    this.el.className = 'ku';
    (opts.root || document.body).appendChild(this.el);
    this.beallitasok = { ...ALAP_BEALL, ...this._olvas(BEALL_KULCS) };
    this._alkalmaz();
    this.hud = new Hud(this, this.el);
    this.modal = null;
    this.szal = {};          // 'en' üzenetek szála: üzenet-id → vevő-id
    this._enSzal = null;
    this.pos = null;
    this._liveT = 0; this.piszkos = false;
    this.setEmpire(E, true);
    this._key = e => this._billentyu(e);
    window.addEventListener('keydown', this._key, true);
    this.el.addEventListener('click', e => this._kattint(e));
    this.el.addEventListener('mousemove', e => { const b = e.target.closest(FOKUSZ); if (b && this.modal?.el.contains(b) && document.activeElement !== b && !b.closest('.ku-fiz')) b.focus({ preventScroll: true }); });
    this.el.addEventListener('focusin', e => this._fokuszba(e.target));
  }

  // ------------------------------------------------------------ szimuláció bekötése
  setEmpire(E, elso = false) {
    if (this._le) this._le();
    this.E = E;
    this._le = E.on(e => this._esemeny(e));
    this.S = E.state;
    this.hud.kpMutat = null;
    if (!elso) { this.opts.onLoad?.(E); this.piszkos = true; }
  }
  _esemeny(e) {
    const h = this.hud;
    switch (e.type) {
      case 'msg': h.naplo(e.text, !!e.hiba); (this.naplo ||= []).push({ t: e.text, hiba: !!e.hiba, ido: this.E.now() }); if (this.naplo.length > 80) this.naplo.shift(); break;
      case 'sms':
        if (e.uzenet.kitol === 'en') this.szal[e.uzenet.id] = this._enSzal;
        else { h.sms(e.uzenet); this.hang('sms'); }
        this.piszkos = true; break;
      case 'sale': h.eladas(e); if (!e.terjeszto) this.hang('penz_papir'); this.piszkos = true; break;
      case 'rankUp': h.rang(e); this.hang('rangemeles'); this.piszkos = true; break;
      case 'quest': h.kuldetes(e); this.piszkos = true; break;
      case 'delivery': h.szallitmany(e.szallitmany); this.piszkos = true; break;
      case 'unlock': h.nyitas(e); this.piszkos = true; break;
      case 'search': case 'raid':
        if (e.talalt && this.opts.autoBirsag !== false) {
          const elotte = this.E.s.stat.birsagFt;
          queueMicrotask(() => this.open('birsag', { tipus: e.type === 'raid' ? 'razzia' : 'motozas', prop: e.prop, okok: e.okok, elkobzottL: e.elkobzottL, elkobzottKp: e.elkobzottKp, birsag: this.E.s.stat.birsagFt - elotte }));
        }
        break;
      case 'dayEnd': case 'order': case 'orderExpired': this.piszkos = true; break;
    }
    for (const f of this._figyelok || []) f(e);
  }
  /** A lapok ezen át figyelhetnek egy-egy hívás eseményeire (pl. a keverés felfedezésére). */
  figyel(fn) { (this._figyelok ||= []).push(fn); return () => { this._figyelok = this._figyelok.filter(x => x !== fn); }; }

  hang(id, o) {
    if (!this.hangObj || this.beallitasok.hangero <= 0) return;
    try { this.hangObj.play(id, o); } catch (e) { /* hang nélkül is működik */ }
  }
  setPlayer(x, z) { this.pos = [x, z]; }
  jatekosPos(S = this.S) { return this.pos || NODES[S.hol] || [0, 0]; }
  jatekosRegio(S = this.S) { const p = this.jatekosPos(S); return regioAt(p[0], p[1]); }
  /** Közel van-e a játékos egy célhoz ({node} | {pos} | {prop}). Az integrátor adja meg; nélküle (próbaoldal) mindig igen. */
  kozel(cel) { return this.opts.kozel ? !!this.opts.kozel(cel) : true; }
  prompt(t) { this.hud.prompt(t); }

  // ------------------------------------------------------------ megnyitás, zárás
  isOpen(nev) {
    if (!this.modal) return false;
    if (!nev) return true;
    return this.modal.stack.some(p => p.nev === nev);
  }
  open(nev, arg = {}) {
    const mk = LAPOK[nev];
    if (!mk) throw new Error('Ismeretlen UI-képernyő: ' + nev);
    this.S = this.E.state;
    const lap = mk(this, arg); lap.nev = nev;
    const fajta = lap.fajta || 'panel';
    if (fajta === 'telefon') {
      if (this.modal?.fajta !== 'telefon') this._ujModal('telefon', [kezdoLap(this)]);
      if (nev !== 'telefon') this.push(lap); else this.rajzol();
    } else this._ujModal(fajta, [lap]);
    return lap;
  }
  _ujModal(fajta, stack) {
    const elozo = !!this.modal;
    if (this.modal) this.modal.el.remove();
    const el = document.createElement('div');
    el.className = `ku-modal ku-m-${fajta}` + (this.beallitasok.mozgas ? '' : ' nyugi');
    el.innerHTML = HEJ[fajta]();
    this.el.appendChild(el);
    this.modal = { fajta, stack, el, lapEl: el.querySelector('[data-lap]'), fokusz: {} };
    requestAnimationFrame(() => el.classList.add('be'));
    this.hud.halvany(true);
    stack.forEach(p => p.init?.(this));
    this.rajzol(true);
    if (!elozo) this.opts.onOpen?.(stack[stack.length - 1].nev);
    if (fajta === 'telefon') this.hang('ui_click', { pitch: 1.2 });
  }
  get lap() { return this.modal?.stack[this.modal.stack.length - 1]; }
  push(lap) {
    if (!this.modal) return;
    this._fokuszMent();
    this.modal.stack.push(lap); lap.init?.(this);
    this.rajzol(true); this.hang('ui_click');
  }
  /** Csere a verem tetején (a vissza ugyanoda visz, ahonnan jöttél). */
  csere(lap) { if (!this.modal) return; this.modal.stack.pop()?.vege?.(this); this.modal.stack.push(lap); lap.init?.(this); this.rajzol(true); }
  back() {
    if (!this.modal) return;
    const top = this.lap;
    if (top?.vissza?.(this)) { this.rajzol(); return; }
    if (this.modal.stack.length <= 1) { this.close(); return; }
    this.modal.stack.pop()?.vege?.(this);
    this.rajzol(true, true); this.hang('ui_click', { pitch: 0.85 });
  }
  close() {
    if (!this.modal) return;
    const m = this.modal; this.modal = null;
    m.stack.forEach(p => p.vege?.(this));
    m.el.classList.remove('be'); m.el.classList.add('ki');
    setTimeout(() => m.el.remove(), 260);
    this.hud.halvany(false);
    if (document.activeElement && this.el.contains(document.activeElement)) document.activeElement.blur();
    this.opts.onClose?.();
  }
  /** Alvás: E.sleep(), napi összesítő, automatikus mentés. */
  alvas() {
    // közös játékban az alvás szavazás: az ígéret akkor teljesül, ha mindenki lefeküdt (vagy elévült)
    return utana(this.E.sleep(), r => {
      if (!r.ok) return r;
      if (this.opts.autoMentes !== false && this.opts.coop !== 'vendeg') this.ment('auto');
      this.open('nap', { osszesito: r });
      return r;
    });
  }

  // ------------------------------------------------------------ rajzolás
  _fokuszMent() {
    const a = document.activeElement, m = this.modal;
    if (!m || !a || !m.el.contains(a)) return;
    m.fokusz[m.stack.length] = kulcs(a);
  }
  /** A felső lap újrarajzolása; a fókusz és a görgetés megmarad. */
  rajzol(uj = false, vissza = false) {
    const m = this.modal; if (!m) return;
    const lap = this.lap;
    this.S = this.E.state;
    let fk = null;
    const a = document.activeElement;
    if (!uj && a && m.lapEl.contains(a)) fk = kulcs(a);
    if (vissza) fk = m.fokusz[m.stack.length] || null;
    const gorg = uj ? {} : Object.fromEntries([...m.lapEl.querySelectorAll('[data-gorget]')].map(x => [x.dataset.gorget, x.scrollTop]));
    m.lapEl.innerHTML = lap.html(this);
    m.lapEl.dataset.lap = lap.nev;
    m.el.dataset.lap = lap.nev;
    for (const x of m.lapEl.querySelectorAll('[data-gorget]')) if (gorg[x.dataset.gorget] != null) x.scrollTop = gorg[x.dataset.gorget];
    const cim = typeof lap.cim === 'function' ? lap.cim(this) : lap.cim;
    const fej = m.el.querySelector('[data-cim]'); if (fej) fej.innerHTML = cim || '';
    const al = m.el.querySelector('[data-al]'); if (al) al.innerHTML = (typeof lap.al === 'function' ? lap.al(this) : lap.al) || '';
    const lab = m.el.querySelector('[data-lab]'); if (lab) lab.innerHTML = lap.lab || alapLab(m.fajta, m.stack.length);
    if (m.fajta === 'telefon') {
      m.el.querySelector('[data-ora]').textContent = this.hud.$.ora.textContent;
      m.el.querySelector('[data-sk-bal]').textContent = lap.softBal || 'Választ';
      m.el.querySelector('[data-sk-jobb]').textContent = m.stack.length > 1 ? 'Vissza' : 'Bezár';
    }
    let cel = fk && m.lapEl.querySelector(selKulcs(fk));
    if (!cel) cel = m.lapEl.querySelector('[data-elso]') || m.lapEl.querySelector(FOKUSZ);
    if (cel) { cel.focus({ preventScroll: true }); cel.scrollIntoView({ block: 'nearest' }); }
    this.piszkos = false; this._liveT = 0;
    this._visszaszamol();
    lap.utan?.(this, m.lapEl);
  }
  /** Csak egy részlet újrarajzolása (data-resz), a fókusz nem mozdul. */
  resz(nev) {
    const m = this.modal; if (!m) return;
    const el = m.lapEl.querySelector(`[data-resz="${nev}"]`);
    const f = this.lap.reszek?.[nev];
    if (el && f) { el.innerHTML = f.call(this.lap, this); this._visszaszamol(); }
  }
  _visszaszamol() {
    const m = this.modal; if (!m) return;
    const most = this.E.now();
    for (const x of m.el.querySelectorAll('[data-cd]')) {
      const v = +x.dataset.cd - most;
      x.textContent = v > 0 ? (x.dataset.elo || '') + tartamRovid(v) : (x.dataset.lejart || 'lejárt');
      x.classList.toggle('surgos', v > 0 && v < 90);
    }
    for (const x of m.el.querySelectorAll('[data-cdsav]')) {
      const [t0, t1] = x.dataset.cdsav.split(',').map(Number);
      const f = Math.max(0, Math.min(1, (t1 - most) / Math.max(1, t1 - t0)));
      x.style.width = (x.classList.contains('fordit') ? 1 - f : f) * 100 + '%';
    }
  }

  // ------------------------------------------------------------ frame
  update(dt = 1 / 60) {
    this.S = this.E.state;
    this.hud.update(this.S, dt);
    if (!this.modal) return;
    this._liveT += dt;
    if (this.lap.ujraRajz) { this.lap.ujraRajz = false; this.piszkos = true; }   // közös játék: megjött a parancs válasza
    if (this.piszkos || (this.lap.live && this._liveT > (this.lap.live === true ? 1 : this.lap.live))) this.rajzol();
    else this._visszaszamol();
    if (this.modal.fajta === 'telefon') this.modal.el.querySelector('[data-ora]').textContent = this.hud.$.ora.textContent;
    this.lap.tick?.(this, dt);
  }

  // ------------------------------------------------------------ bemenet
  _kattint(e) {
    const b = e.target.closest('[data-a]');
    if (!b || !this.modal || !this.modal.el.contains(b) || b.disabled) return;
    this.akcio(b.dataset.a, b.dataset.v, b);
  }
  akcio(a, v, el) {
    const lap = this.lap;
    if (a === '@vissza') return this.back();
    if (a === '@bezar') return this.close();
    if (a === '@app') { const mk = LAPOK[v]; if (mk) { const l = mk(this, {}); l.nev = v; this.push(l); } return; }
    if (a === '@lap') { const [n, x] = v.split('|'); const l = LAPOK[n](this, x ? JSON.parse(x) : {}); l.nev = n; this.push(l); return; }
    if (a === '@st-' || a === '@st+') return this.lep(v, a === '@st+' ? 1 : -1);
    if (a === '@gomb') return this.gomb(v);
    if (a === '@sk-bal') { const f = document.activeElement; if (f && this.modal.lapEl.contains(f) && f.matches('button')) f.click(); else this.modal.lapEl.querySelector(FOKUSZ)?.click(); return; }
    if (a === '@sk-jobb') return this.back();
    const r = lap.act?.(a, v, this, el);
    this.hang('ui_click');
    if (r !== false && this.modal && this.lap === lap) this.rajzol();
    // közös játék: az act a parancs ígéretét adta vissza → a válasz után még egyszer rajzolunk
    if (r && typeof r.then === 'function') r.then(x => { if (x !== false && this.modal && this.lap === lap) this.rajzol(); });
  }
  /** Léptető (data-st) állítása. */
  lep(nev, d, nagy = false) {
    const st = this.lap?.st?.[nev]; if (!st) return;
    const lepes = (nagy ? (st.nagy || st.lepes * 10) : st.lepes) * d;
    const uj = Math.min(st.max, Math.max(st.min, Math.round((st.v + lepes) / st.lepes) * st.lepes));
    if (uj === st.v) return;
    st.v = uj;
    this.hang('ui_click', { pitch: 1.4, vol: 0.5 });
    this.lap.valtozott?.(nev, this);
    this.rajzol();
  }
  gomb(k) {
    const lap = this.lap;
    if (lap?.gomb?.(k, this) === false) return;
    this.rajzol();
  }
  _fokuszba(t) {
    const lap = this.lap; if (!lap || !this.modal.lapEl.contains(t)) return;
    lap.fokusz?.(t.dataset.a, t.dataset.v, this, t);
  }
  _billentyu(e) {
    if (this.opts.billentyu === false) return;
    const k = e.key;
    if (!this.modal) {
      if (e.target?.matches?.('input, textarea')) return;
      if (k === 'Tab' || k === 'f' || k === 'F') { e.preventDefault(); e.stopImmediatePropagation(); this.open('telefon'); }
      else if (k === 'Escape' && this.opts.escSzunet !== false) { e.preventDefault(); this.open('szunet'); }
      return;
    }
    e.stopImmediatePropagation();
    const m = this.modal, f = document.activeElement;
    if (k === 'Tab' || ((k === 'f' || k === 'F') && m.fajta === 'telefon')) { e.preventDefault(); if (m.fajta === 'telefon') this.close(); return; }
    if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); this.back(); return; }
    if ((k === 'e' || k === 'E') && m.fajta === 'panel') { e.preventDefault(); this.close(); return; }
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (f?.dataset?.st && (k === 'ArrowLeft' || k === 'ArrowRight')) { this.lep(f.dataset.st, k === 'ArrowRight' ? 1 : -1, e.shiftKey); return; }
      this.nav(k.slice(5).toLowerCase());
      return;
    }
    if (m.fajta === 'telefon' && /^[0-9*#]$/.test(k)) { e.preventDefault(); this._gombVillan(k); this.gomb(k); return; }
    if ((k === 'Enter' || k === ' ') && f?.dataset?.st) { e.preventDefault(); this.lap.enter?.(this); return; }
    if ((k === 'Enter' || k === ' ') && (!f || !m.el.contains(f))) { e.preventDefault(); m.lapEl.querySelector(FOKUSZ)?.focus(); return; }
    const r = this.lap.billentyu?.(k, this, e);
    if (r) e.preventDefault();
  }
  _gombVillan(k) {
    const b = this.modal?.el.querySelector(`.ku-bill [data-v="${k === '*' ? '\\*' : k === '#' ? '\\#' : k}"]`);
    if (b) { b.classList.remove('nyom'); void b.offsetWidth; b.classList.add('nyom'); }
  }
  /** Térbeli fókuszléptetés (kontrollerszerű): a legközelebbi elem a megadott irányban. */
  nav(irany) {
    const m = this.modal; if (!m) return;
    const els = [...m.lapEl.querySelectorAll(FOKUSZ)].filter(x => x.offsetParent !== null);
    if (!els.length) return;
    const f = document.activeElement;
    if (!f || !els.includes(f)) { els[0].focus(); return; }
    const r0 = f.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[irany];
    let best = null, bs = Infinity;
    for (const x of els) {
      if (x === f) continue;
      const r = x.getBoundingClientRect();
      const ex = Math.max(r.left, Math.min(cx, r.right)), ey = Math.max(r.top, Math.min(cy, r.bottom));
      const vx = (r.left + r.width / 2) - cx, vy = (r.top + r.height / 2) - cy;
      const fo = dx ? vx * dx : vy * dy;
      // az irányba eső, és ne ugyanabban a sorban/oszlopban „visszafelé”
      const kozel = dx ? (dx > 0 ? r.left >= r0.right - 4 : r.right <= r0.left + 4) : (dy > 0 ? r.top >= r0.bottom - 4 : r.bottom <= r0.top + 4);
      if (!kozel || fo <= 0) continue;
      const mer = dx ? Math.abs(ex - cx) : Math.abs(ey - cy);
      const ker = dx ? Math.abs((r.top + r.height / 2) - cy) : Math.abs((r.left + r.width / 2) - cx);
      const s = mer + ker * 2.2;
      if (s < bs) { bs = s; best = x; }
    }
    if (!best && (irany === 'down' || irany === 'up')) {
      // lista végén: a sor elejére/végére ugrik (a görgethető listák kontrollerrel is körbejárhatók)
      const i = els.indexOf(f);
      best = irany === 'down' ? (i === els.length - 1 ? null : els[i + 1]) : (i === 0 ? null : els[i - 1]);
    }
    if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', behavior: this.beallitasok.mozgas ? 'smooth' : 'auto' }); this.hang('ui_click', { pitch: 1.6, vol: 0.35 }); }
  }

  // ------------------------------------------------------------ beállítások, mentés
  _olvas(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch (e) { return {}; } }
  beallit(o) {
    Object.assign(this.beallitasok, o);
    try { localStorage.setItem(BEALL_KULCS, JSON.stringify(this.beallitasok)); } catch (e) { /* privát mód */ }
    this._alkalmaz();
    this.opts.onBeallitas?.({ ...this.beallitasok });
  }
  _alkalmaz() {
    const b = this.beallitasok;
    this.el.style.setProperty('--ku-skala', b.szoveg);
    this.el.classList.toggle('nyugi', !b.mozgas);
    try { this.hangObj?.master?.(b.hangero); } catch (e) { /* nincs hang */ }
  }
  mentesLista() {
    return ['auto', '1', '2', '3'].map(id => {
      let m = null;
      try { const raw = localStorage.getItem(MENTES_KULCS + id); if (raw) m = JSON.parse(raw).meta; } catch (e) { m = { hibas: true }; }
      return { id, meta: m };
    });
  }
  ment(id) {
    // vendégként a tükör nem a te birodalmad: a saját egyjátékos-mentésedet nem írja felül
    if (this.opts.coop === 'vendeg') return { ok: false, hiba: 'Közös játékban a házigazda gépe ment.' };
    const S = this.E.state;
    const meta = { nap: S.ido.nap, ora: S.ido.szoveg.split(/\s+/).pop(), rang: S.rang.nev, kp: S.penz.kp + S.penz.dunyha, szamla: S.penz.szamla, receptek: S.receptekSzama, mentve: Date.now() };
    try { localStorage.setItem(MENTES_KULCS + id, JSON.stringify({ meta, adat: this.E.save() })); return { ok: true, meta }; }
    catch (e) { return { ok: false, hiba: 'Nem fért el a mentés (a böngésző tárhelye megtelt).' }; }
  }
  betolt(id) {
    if (this.opts.coop) return { ok: false, hiba: 'Közös játék közben nem tölthetsz be mentést.' };
    try {
      const raw = localStorage.getItem(MENTES_KULCS + id); if (!raw) return { ok: false, hiba: 'Üres hely.' };
      const E2 = Empire.load(JSON.parse(raw).adat);
      this.setEmpire(E2);
      return { ok: true };
    } catch (e) { return { ok: false, hiba: 'A mentés sérült: ' + e.message }; }
  }
  destroy() { window.removeEventListener('keydown', this._key, true); this._le?.(); this.el.remove(); }
}

// ------------------------------------------------------------ keretek
const HEJ = {
  telefon: () => `
    <div class="ku-tel" role="dialog" aria-label="Telefon">
      <div class="ku-szalag">Nagyapáé!<br>Ne nyúlj hozzá.</div>
      <div class="ku-tel-fej"><i class="ku-hangszoro"></i><i class="ku-led"></i></div>
      <div class="ku-kep">
        <div class="ku-sb"><span class="ku-jel"><i></i><i></i><i></i><i></i></span><b data-ora>06:00</b><span class="ku-akku"><i></i></span></div>
        <div class="ku-lapfej" data-cim></div>
        <div class="ku-lap" data-lap></div>
        <div class="ku-soft"><span data-sk-bal>Választ</span><span class="ku-soft-k">Enter</span><span data-sk-jobb>Vissza</span></div>
      </div>
      <div class="ku-vez">
        <button class="ku-fiz ku-sk" data-a="@sk-bal" tabindex="-1" aria-label="Választ"><i></i></button>
        <div class="ku-dpad"><i></i></div>
        <button class="ku-fiz ku-sk jobb" data-a="@sk-jobb" tabindex="-1" aria-label="Vissza"><i></i></button>
      </div>
      <div class="ku-bill">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => `<button class="ku-fiz" tabindex="-1" data-a="@gomb" data-v="${k}"><b>${k}</b><small>${BETUK[k] || ''}</small></button>`).join('')}</div>
    </div>`,
  panel: () => `
    <div class="ku-pad" role="dialog">
      <div class="ku-pad-fej"><h2 data-cim></h2><span class="ku-pad-al" data-al></span><button class="ku-fiz ku-x" data-a="@bezar" tabindex="-1" aria-label="Bezár"><kbd>Esc</kbd></button></div>
      <div class="ku-lap" data-lap></div>
      <div class="ku-pad-lab" data-lab></div>
    </div>`,
  menu: () => `<div class="ku-lap" data-lap></div><div class="ku-menu-lab" data-lab></div>`,
};
const BETUK = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz', 0: '␣', '*': '', '#': '' };
function alapLab(fajta, mely) {
  const v = mely > 1 ? 'vissza' : 'bezár';
  if (fajta === 'panel') return `<kbd>↑↓←→</kbd> választás <kbd>Enter</kbd> mehet <kbd>←→</kbd> a számokon állít ` + (mely > 1 ? `<kbd>Esc</kbd> vissza <kbd>E</kbd> bezár` : `<kbd>Esc</kbd> vagy <kbd>E</kbd> bezár`);
  return `<kbd>↑↓</kbd> választás <kbd>Enter</kbd> mehet <kbd>Esc</kbd> ${v}`;
}
const kulcs = el => el.dataset.st ? 'st:' + el.dataset.st : el.dataset.a ? el.dataset.a + '|' + (el.dataset.v ?? '') : null;
function selKulcs(k) {
  if (k.startsWith('st:')) return `[data-st="${CSS.escape(k.slice(3))}"]`;
  const i = k.indexOf('|');
  return `[data-a="${CSS.escape(k.slice(0, i))}"][data-v="${CSS.escape(k.slice(i + 1))}"]`;
}
function tartamRovid(p) {
  p = Math.round(p);
  const o = Math.floor(p / 60), m = p % 60;
  return o ? `${o} ó ${String(m).padStart(2, '0')} p` : `${m} p`;
}
export { esc, szalKulcs };
