// Kisüsti — az intró lejátszója (data/tortenet.js INTRO, „a tor”). Csak új játéknál, a sim indulása előtt fut: a fő hurok
// addig nem lépteti a simet (J.mod = 'intro'), a kép, a hang és a figurák innen mennek. Sávok: kamera (ease-in-out,
// kemény vágás, elsötétítés), figurák és klipjeik, feliratok (sor/cim/cetli), hang (play/loop/stop/ambient, mozgó forrás),
// a fehér autó útja, a látvány órája. Átugrás: Space / Esc / Enter 1 mp-ig nyomva (bármely gomb megmutatja a jelet).
import * as THREE from 'three';
import { prop } from '../vilag/betolto.js';
import { kupica, palinkasUveg, pogacsasTanyer } from '../szereplok/kiegeszitok.js';
import { INTRO } from '../../data/tortenet.js';
import { TH, easeInOut, gyoker, q, sor, sorKi, cetli, cetliKi, Figura } from './kozos.js';

/** A kamera-kulcskockák takarásmentesítése: a nézett pontból a kamera felé sugár; ha útközben épület, sövény,
 *  fa vagy domb van, a kamera a takaró elé (35 cm-rel) húzódik. A pontokat a világ átrendezése után az asztalhoz
 *  igazítjuk, ezért egy fix koordináta falba vagy lombba kerülhet (2026-11-13: a 14,5 mp-es asztalkép teljesen zöld volt). */
function kameraSzabadra(scene, kulcsok) {
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3();
  const takarhat = x => (x.isMesh || x.isInstancedMesh) && x.visible && !x.material?.transparent && !/^(fu|eg|felho|viz)/i.test(x.name || '');
  const jeloltek = []; scene.traverse(x => { if (takarhat(x)) jeloltek.push(x); });
  for (const k of kulcsok) {
    o.set(...k.nez); d.set(...k.pos).sub(o); const tav = d.length(); if (tav < 0.5) continue;
    rc.set(o, d.normalize()); rc.near = 0.6; rc.far = tav;
    const h = rc.intersectObjects(jeloltek, false)[0];
    if (h && h.distance < tav - 0.05) {
      const uj = o.clone().addScaledVector(d, Math.max(0.8, h.distance - 0.35));
      k.pos = [uj.x, uj.y, uj.z];
    }
  }
}

// A kerti asztal (vilag/tanya.js): a tableCloth a (-9.4, 8.2) pontban, ry = 0,2, ×2,4 → 2,02 × 0,79 × 1,08 m (glbinfo),
// a modell origója a SARKA (helyi x 0…2,02, z −1,08…0). Az INTRO adata a (-9.4, 8.2)-t tengelyhez igazított középnek vette:
// a lejátszó az asztal 6 m-es körén belüli pontokat (figurák, kamera, asztal-közeli hangok) a valódi középhez és
// forgatáshoz igazítja; a távoli pontok (út, kerítés, Kovácsné, pajta) maradnak.
const ASZTAL = { x: -9.4, z: 8.2, ry: 0.2, hossz: 2.02, szel: 1.08, magas: 0.79 };
const C_ = Math.cos(ASZTAL.ry), S_ = Math.sin(ASZTAL.ry);
const helyibol = (lx, lz) => [ASZTAL.x + lx * C_ + lz * S_, ASZTAL.z - lx * S_ + lz * C_];   // THREE rotation.y
const KOZEP = helyibol(ASZTAL.hossz / 2, -ASZTAL.szel / 2);
const ASZTAL_KOR = 6;
const ATUGRO = new Set(['Space', 'Escape', 'Enter', 'NumpadEnter']);

/** Adatpont (az asztal feltételezett, tengelyhez igazított középpontjához mérve) → a valódi asztalhoz igazított pont. */
function asztalhoz([x, z]) {
  const dx = x - ASZTAL.x, dz = z - ASZTAL.z;
  return [KOZEP[0] + dx * C_ + dz * S_, KOZEP[1] - dx * S_ + dz * C_];
}
const asztalKozeli = (x, z) => Math.hypot(x - ASZTAL.x, z - ASZTAL.z) < ASZTAL_KOR;
/** [x, y, z]: ha az asztal közelében van, átvisszük; különben marad. */
const pont3 = p => { if (!p || !asztalKozeli(p[0], p[2])) return p; const [x, z] = asztalhoz([p[0], p[2]]); return [x, p[1], z]; };

export class Intro {
  constructor(J) {
    this.J = J; this.fut = false; this.t = 0;
    gyoker();
    // a billentyűk az intró alatt csak ide jutnak (a UI Tab/Esc kezelője elé, rögzítő fázisban)
    addEventListener('keydown', e => this._le(e), true);
    addEventListener('keyup', e => this._fel(e), true);
    addEventListener('mousemove', () => { if (this.fut) this._mutat(); });
  }

  /** Indítás. o.kezi: a próba lépteti (introLep), nincs saját képkocka-hurok. vege(): a lejátszás után (átugrás után is). */
  indit({ kezi = false, vege = null } = {}) {
    if (this.fut) return false;
    const J = this.J;
    // az asztal-közeli pontok a valódi asztalhoz (lásd ASZTAL fent)
    const D = { ...INTRO,
      kamera: INTRO.kamera.map(k => ({ ...k, pos: pont3(k.pos), nez: pont3(k.nez) })),
      anim: INTRO.anim.map(a => ({ ...a, nez: a.nez && pont3(a.nez), cel: a.cel && (asztalKozeli(...a.cel) ? asztalhoz(a.cel) : a.cel) })),
      hang: INTRO.hang.map(h => ({ ...h, pos: h.pos && pont3(h.pos) })) };
    this.D = D; this.vege = vege; this.kezi = kezi;
    kameraSzabadra(J.scene, D.kamera);
    this.t = 0; this.fut = true; this.tartas = null; this.atugrasT = TH.intro.atugrasMutat; this.ugras = false;
    this.elozoMod = J.mod; J.mod = 'intro';
    cetliKi(); sorKi();
    document.body.classList.add('tt-intro');
    if (J.ui?.el) J.ui.el.style.display = 'none';
    document.exitPointerLock?.();
    this.fov0 = J.camera.fov;
    this.ora = D.latvanyOra;
    // díszlet: a tor asztala (poharak, üveg; ülő változatban még egy pad és egy rövid pad a fejnél)
    const ulnek = TH.intro.ulnek;
    this.diszlet = new THREE.Group(); this.diszlet.name = 'tortenet:tor'; J.scene.add(this.diszlet);
    // a lócák a világ része (vilag/tanya.js): az 'ul' klipben a csípő ~0,24 m-rel a figura talppontja mögött és
    // 0,50 m magasan van, ezért az ülőlap teteje 0,43 m, a közepe a talppont mögött 0,22 m-rel (2026-11-14, mérve)
    // kupicák a két hosszanti szél mentén (a vendégek előtt), a fejnél egy, középen a fél literes pálinkásüveg és egy
    // tányér pogácsa — valódi méretben (a Kenney-pohár 16 cm-es, az üveg 56 cm-es volt: a tor asztala babaháznak látszott)
    const lap = ASZTAL.magas + 0.005;
    for (const [lx, lz] of [[0.35, -0.24], [1.01, -0.22], [1.67, -0.24], [0.35, -0.84], [1.01, -0.86], [1.67, -0.84], [0.14, -0.54]]) {
      const [gx, gz] = helyibol(lx, lz);
      const k = kupica(); k.position.set(gx, lap + 0.032, gz); this.diszlet.add(k);
    }
    for (const [i, [lx, lz]] of [[1.25, -0.5], [0.8, -0.6]].entries()) {
      const [bx, bz] = helyibol(lx, lz);
      const u = palinkasUveg(); u.position.set(bx, lap, bz); u.rotation.y = i * 2.1; this.diszlet.add(u);
    }
    { const [tx, tz] = helyibol(0.55, -0.55); this.diszlet.add(pogacsasTanyer(tx, lap, tz)); }
    this.diszlet.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // figurák
    this.fig = {};
    for (const s of D.szereplok) {
      if (s.ki === 'nagyapa') continue;
      const asztalnal = s.anim === 'sit', ul = asztalnal && ulnek;
      let pos = s.pos;
      if (asztalnal && !ulnek) {   // állva: az ülőhelynél kicsit kijjebb az asztaltól (a hosszanti oldalon z, a fejnél x)
        const lx = pos[0] - ASZTAL.x, lz = pos[1] - ASZTAL.z, k = TH.intro.allvaKifele;
        pos = Math.abs(lz) > 0.5 ? [pos[0], pos[1] + Math.sign(lz) * k] : [pos[0] + Math.sign(lx) * k, pos[1]];
      }
      const [x, z] = asztalnal || asztalKozeli(...pos) ? asztalhoz(pos) : pos;
      const f = new Figura(J, s.ki, x, z, s.ry + (asztalnal ? ASZTAL.ry : 0));
      f.asztalnal = asztalnal;
      if (ul) f.ultet();
      if (asztalnal) { f.sz.fog(kupica(), 'R'); f.kupica = true; }   // a tor: mindenki kezében egy kupica (ülve is)
      if (s.rejtve) f.obj.visible = false;
      f.rejtve = !!s.rejtve;
      this.fig[s.ki] = f;
    }
    // a fehér szolgálati autó (a világ járőr-modellje), a saját útján
    this.auto = J.npc.jaror([[D.auto[0].x, D.auto[0].z], [D.auto[0].x + 1, D.auto[0].z]], { seb: 0.01, sav: 0 });
    this.auto.var = 1e9; this.auto.obj.visible = false;
    this.hangok = {}; this.hi = 0; this.ai = 0; this.fi = 0; this.aktFelirat = null; this.cimek = []; this.mindenkiNez = false;
    this.kamIdx = -1;
    this._kamera(0, true);
    q('.tt-fekete').style.opacity = 1;
    J.hang.ambient({ napszak: D.ambient.napszak, regio: D.ambient.regio });
    this._mutat();
    if (!kezi && !J.TEST) { this._last = performance.now(); requestAnimationFrame(n => this._kocka(n)); }
    return true;
  }
  _kocka(now) {
    if (!this.fut) return;
    const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
    this.lep(dt);
    if (this.fut) requestAnimationFrame(n => this._kocka(n));
  }

  /** Egy lépés (valós mp). */
  lep(dt) {
    if (!this.fut) return;
    const J = this.J, D = this.D;
    this.t += dt;
    const t = this.t;
    // átugrás: a nyomva tartás kitölti a kört, 1 mp után ugrik
    if (this.tartas != null) {
      const a = Math.min(1, (performance.now() - this.tartas) / 1000 / D.kihagyasTartas);
      q('.tt-atugras .t').style.strokeDashoffset = String(75.4 * (1 - a));
      if (a >= 1) { this.ugrik(); return; }
    }
    if (this.atugrasT > 0) { this.atugrasT -= dt; if (this.atugrasT <= 0 && this.tartas == null) q('.tt-atugras').classList.remove('be'); }
    this._kamera(t);
    this._animok(t);
    this._feliratok(t);
    this._hangok(t);
    this._autoLep(t);
    // aki a kamerához 0,75 m-nél közelebb kerül (pl. a D-beállítás a kocsmáros helyéről néz az útra), az nem látszik:
    // a figura nem takarhatja a kamerát, és a közelsík nem vághat bele
    const cam = J.camera.position;
    for (const f of Object.values(this.fig)) {
      if (f.rejtve) continue;
      const p = f.obj.position, d = Math.hypot(p.x - cam.x, p.y + 1.1 - cam.y, p.z - cam.z);
      f.obj.visible = d > TH.intro.kameraTav;
      if (f.obj.visible) f.update(dt);
    }
    J.V.update(dt, this.ora, J.camera.position, J.camera);
    J.G?.update(dt, this.ora);
    if (t >= D.hossz) this._befejez();
  }

  // ------------------------------------------------------------ kamera
  _kamera(t, elso = false) {
    const J = this.J, K = this.D.kamera, cam = J.camera;
    let i = 0; while (i < K.length - 1 && K[i + 1].t <= t) i++;
    const a = K[i], b = K[i + 1];
    let u = 0;
    if (b && !b.vagas) u = easeInOut(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
    const B = b && !b.vagas ? b : a;
    const L = (x, y) => x + (y - x) * u;
    cam.position.set(L(a.pos[0], B.pos[0]), L(a.pos[1], B.pos[1]), L(a.pos[2], B.pos[2]));
    cam.lookAt(L(a.nez[0], B.nez[0]), L(a.nez[1], B.nez[1]), L(a.nez[2], B.nez[2]));
    const fa = a.fov ?? 60, fb = B.fov ?? fa, fov = L(fa, fb);
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // elsötétítés: az utolsó megadott érték öröklődik; két kulcskocka között ease-in-out
    const sot = k => { for (let j = k; j >= 0; j--) if (K[j].elsotet != null) return K[j].elsotet; return 0; };
    const sa = sot(i), sb = b && !b.vagas ? sot(i + 1) : sa;
    q('.tt-fekete').style.opacity = String(L(sa, sb));
    if (i !== this.kamIdx) {
      this.kamIdx = i;
      for (let j = i; j >= 0; j--) if (K[j].latvanyOra != null) { this.ora = K[j].latvanyOra; break; }
      if (a.vagas || elso) J.V.lodMost(cam.position);
    }
  }

  // ------------------------------------------------------------ figurák
  _animok(t) {
    const A = this.D.anim;
    while (this.ai < A.length && A[this.ai].t <= t) {
      const e = A[this.ai++];
      const kik = e.ki === '*asztal' ? Object.values(this.fig).filter(f => f.asztalnal) : [this.fig[e.ki]].filter(Boolean);
      for (const f of kik) {
        if (f.rejtve) { f.obj.visible = true; f.rejtve = false; }
        if (e.nez) { f.nez(e.nez); f.sajatNezIg = t + 6; }
        if (e.cel) { f.setal(e.cel[0], e.cel[1], f.ry); continue; }
        if (e.ki === '*asztal') { f.alapKlip = f.ul ? 'ul' : 'all'; f.anim(f.alapKlip); this.mindenkiNez = true; continue; }
        if (e.anim === 'idle') { f.alapKlip = f.ul ? 'ul' : 'all'; f.anim(f.alapKlip); continue; }
        f.beszel(true, e.anim); f.gesztusT = e.t;
        f.gesztusIg = t + 4.2;
      }
    }
    for (const f of Object.values(this.fig)) if (f.gesztusIg && t > f.gesztusIg) { f.gesztusIg = 0; f.beszel(false); }
  }

  // ------------------------------------------------------------ feliratok
  _feliratok(t) {
    const F = this.D.feliratok;
    while (this.fi < F.length && F[this.fi].t <= t) {
      const f = F[this.fi++];
      this._felBe(f);
    }
    const a = this.aktFelirat;
    if (a && t >= a.ig) { this._felKi(a); this.aktFelirat = null; }
    for (const c of this.cimek || []) if (!c.ki && t >= c.ig) { c.ki = true; q('.tt-cim').classList.remove('be'); }
  }
  _felBe(f) {
    if (f.tipus === 'cim') { const el = q('.tt-cim'); el.textContent = f.szoveg; el.classList.add('be'); (this.cimek ||= []).push({ ig: f.ig }); return; }
    if (f.tipus === 'cetli') { cetli(f.szoveg.replace(/\s*— Nagyapa$/, ''), f.ig - f.t, { alairas: '— Nagyapa' }); return; }
    if (this.aktFelirat) this._felKi(this.aktFelirat);
    sor(f.ki, f.szoveg);
    this.aktFelirat = f;
    // a beszélő gesztikulál, az asztal többi tagja felé fordul
    const b = this.fig[f.ki];
    if (b) {
      if (b.gesztusT !== f.t) b.beszel(true);   // ha a sor egy saját klippel indul (koccintás), az marad
      b.gesztusIg = f.ig - 0.2;
      const fej = b.obj.position.clone(); fej.y += b.ul ? 1.15 : 1.6;
      for (const o of Object.values(this.fig)) if (o !== b && o.asztalnal && !this.mindenkiNez) o.nez(fej);
      if (!(b.sajatNezIg > f.t)) b.nez([ASZTAL.x, 1.05, ASZTAL.z]);
    }
  }
  _felKi() { sorKi(); }

  // ------------------------------------------------------------ hang és autó
  _hangok(t) {
    const J = this.J, H = this.D.hang;
    while (this.hi < H.length && H[this.hi].t <= t) {
      const h = H[this.hi++];
      if (h.tipus === 'ambient') { J.hang.ambient({ napszak: h.napszak, regio: h.regio }); continue; }
      if (h.tipus === 'stop') { this.hangok[h.id]?.stop(1.2); delete this.hangok[h.id]; continue; }
      const pos = h.ut === 'auto' ? this.auto.obj.position : h.pos;
      if (h.tipus === 'loop') { this.hangok[h.id] = J.hang.loop(h.id, { pos, vol: h.vol ?? 1, doppler: true, rpm: 0.3, gaz: 0.35 }); continue; }
      J.hang.play(h.id, { pos, vol: h.vol ?? 1 });
    }
  }
  _autoLep(t) {
    const P = this.D.auto, o = this.auto.obj;
    if (t < P[0].t || t > P[P.length - 1].t) { o.visible = false; return; }
    let i = 0; while (i < P.length - 2 && P[i + 1].t <= t) i++;
    const a = P[i], b = P[i + 1], u = (t - a.t) / (b.t - a.t);   // a kocsi egyenletesen halad (8 m/s), nem lassít
    const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
    o.visible = true;
    o.position.set(x, this.J.V.talaj(x, z), z);
    o.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  }

  // ------------------------------------------------------------ átugrás és vége
  _mutat() { this.atugrasT = TH.intro.atugrasRejt; q('.tt-atugras').classList.add('be'); }
  _le(e) {
    if (!this.fut) return;
    e.preventDefault(); e.stopImmediatePropagation();
    this._mutat();
    if (ATUGRO.has(e.code) && this.tartas == null && !e.repeat) this.tartas = performance.now();
  }
  _fel(e) {
    if (!this.fut) return;
    if (ATUGRO.has(e.code)) { this.tartas = null; q('.tt-atugras .t').style.strokeDashoffset = '75.4'; }
  }
  /** Átugrás: elsötétül, a lényeg egy cetlin marad. */
  ugrik() {
    if (!this.fut || this.ugras) return;
    this.ugras = true;
    this._befejez(true);
  }
  _befejez(atugorva = false) {
    const J = this.J;
    this.fut = false;
    this.tartas = null;
    for (const h of Object.values(this.hangok)) h?.stop(0.4);
    this.hangok = {};
    sorKi(); cetliKi();
    q('.tt-cim').classList.remove('be'); q('.tt-atugras').classList.remove('be');
    for (const f of Object.values(this.fig)) f.torol();
    this.fig = {};
    this.diszlet.removeFromParent(); this.diszlet = null;
    if (J.npc.lista.includes(this.auto)) J.npc.torol(this.auto);
    J.camera.fov = this.fov0; J.camera.updateProjectionMatrix();
    J.mod = this.elozoMod === 'intro' ? 'jatek' : this.elozoMod || 'jatek';
    document.body.classList.remove('tt-intro');
    if (J.ui?.el) J.ui.el.style.display = '';
    J.bemenet.keys.clear(); J.bemenet.egerKi(); J.bemenet.kockaVege();
    J.hely(2, 2.5, -22, -5);
    // az egér visszakérése (az átugró gombnyomás friss felhasználói gesztus; ha nem megy, a vászonra kattintás kéri)
    if (!J.TEST) try { J.renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch (e) { /* gesztus nélkül nem megy */ }
    const fek = q('.tt-fekete');
    fek.style.transition = 'none'; fek.style.opacity = '1';
    void fek.offsetWidth;
    fek.style.transition = `opacity ${atugorva ? 0.9 : 1.2}s ease-in-out`; fek.style.opacity = '0';
    setTimeout(() => { fek.style.transition = ''; }, 1400);
    if (atugorva) cetli(this.D.kihagyasCetli.replace(/\s*— Nagyapa$/, ''), TH.intro.kihagyasCetliMp, { alairas: '— Nagyapa' });
    this.atugorva = atugorva;
    this.vege?.(atugorva);
  }
}
