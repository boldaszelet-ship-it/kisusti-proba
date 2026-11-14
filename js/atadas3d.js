// Kisüsti — átadás a világban, panel nélkül (CORE-KRITIKA 2/A). Egyjátékos módban a vevőnek a kezedből adod az üveget:
//   • a kész párlat üvegben áll az üst csapja mellett; E-re a kezedbe kerül (a kép alján lebeg, kéz nélkül);
//   • a vevő a kapuban integet, ha közel jössz; közelről a feje fölött buborék: mit kér, mennyit, mennyiért,
//     és hogy a kezedben lévő megfelel-e (Z/X: ár le/fel, ez az alku);
//   • E: a kamera a vevő felé fordul, az üveg a kezébe repül (atad), meghúzza (iszik), és az arca válaszol
//     (orul/koccint, ha jó; szid, ha gyenge vagy kevés — a válasz szövege a buborékba megy);
//   • a pénz bankjegyekben a HUD-tárcába repül, a számláló pörög (hud.js penzRepul).
// A sim-hívás (deliver) az E lenyomásakor azonnal megtörténik: az animáció csak mutatja, nem késlelteti a döntést.
// Tesztmódban (?teszt=1, a régi próbák) és közös játékban a régi teljes képernyős átadás-panel él (interakcio.js).
import * as THREE from 'three';
import { palinkasUveg } from './szereplok/kiegeszitok.js';
import { hu, ft } from '../sim.js';
import { UVEGEK, GYUMOLCSOK } from '../data/tartalom.js';
import { utana } from './ui/elemek.js';

/** Hangolható értékek (játékérzet). */
export const ATADAS_HANGOLAS = {
  integetTav: 9,           // m: ennyiről int a vevő (egyszer, amíg el nem távolodsz 14 m-re)
  nezTav: 11,              // m: ezen belül feléd fordítja a fejét
  fordulTav: 6,            // m: ezen belül feléd fordul egész testtel
  buborekTav: 4.8,         // m: ezen belül látszik a kérés-buborék
  kezPoz: [0.2, -0.40, -0.46],   // az üveg a kamera terében (m): jobbra, lent, előre — a kép alján
  kezDoles: [0.10, -0.32, -0.10], // rad: az üveg dőlése a kézben
  billeg: 0.012,           // m: séta közbeni billegés
  repulMp: 0.38,           // mp: az üveg a vevő kezébe repül
  atadSeb: 1.8, atadMp: 0.95,     // az atad-mozdulat sebessége és a hossza
  iszikSeb: 2.6, iszikMp: 1.2,    // ~1 mp húzás
  reakcioMp: 1.9,          // mp: orul/koccint/szid, utána elmegy (siker) vagy visszaadja (hiba)
  kameraMp: 0.85,          // mp: a kamera ennyi ideig fordul a vevő felé
  arLepes: 500,            // Ft: Z/X egy lépése
  arMin: 0.5, arMax: 1.8,  // a kért ár határai a rendelés árához képest
  felvetelMax: 3,          // l: E az üvegnél legfeljebb ennyit vesz magadhoz (a motozás e fölött büntet)
};
const H = ATADAS_HANGOLAS;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gyNev = gy => GYUMOLCSOK[gy]?.nev || 'pálinka';
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

/** Az üveg anyagai a kézben: mindig a világ előtt rajzolódik (nem lóg bele a falba). */
function kezUveg() {
  const g = palinkasUveg();
  g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.depthTest = false; o.renderOrder = 999; o.castShadow = false; } });
  g.renderOrder = 999;
  return g;
}

export class Atadas3D {
  constructor(J) {
    this.J = J;
    this.seq = null;            // a futó átadás: {id, v, r, t, fazis, res, tipus, uveg}
    this.ar = {};               // rendelés-id → a kért ár (Z/X)
    this.buborekId = null;      // melyik vevő fölött van a buborék
    this.kez = kezUveg(); this.kez.visible = false; J.scene.add(this.kez);
    this.kezFel = 0;            // 0..1: az üveg felemelkedése a kép aljáról (felvételkor)
    this.asztal = null;         // a kész üveg az üst csapja mellett (célozható)
    this.el = document.createElement('div');
    this.el.className = 'ku-buborek';
    Object.assign(this.el.style, { position: 'fixed', left: '0', top: '0', zIndex: 6, pointerEvents: 'none', display: 'none', maxWidth: '300px', minWidth: '200px',
      transform: 'translate(-50%, -100%)', background: 'rgba(246,238,220,0.96)', color: '#2b1d12', borderRadius: '12px', padding: '10px 14px 9px',
      font: '15px/1.3 Georgia, "Times New Roman", serif', boxShadow: '0 6px 22px rgba(0,0,0,0.35)', border: '1px solid rgba(90,62,40,0.35)', textAlign: 'left' });
    document.body.appendChild(this.el);
    this._html = '';
  }
  get E() { return this.J.E; }
  get S() { return this.J.S; }
  /** Az új átadás él-e (egyjátékos, nem tesztmód). */
  aktiv() { return !this.J.TEST && !this.J.coop; }
  fut(rendelesId) { return !!this.seq && this.seq.id === rendelesId; }

  // ------------------------------------------------------------ tételek
  _regio(hely) { const p = this.S.ingatlanok.find(x => x.id === hely.split(':')[1]); return p?.regio; }
  /** A rendeléshez elérhető tételek: nálad, vagy az ugyanazon régióbeli raktárban. */
  _tetelek(r) {
    return this.S.tetelek.filter(t => !t.erleles && t.l > 0.004 && (t.hely === 'nalad' || ((t.hely.startsWith('prop:') || t.hely.startsWith('rejtek:')) && this._regio(t.hely) === r.regio)));
  }
  _lAt(r, t) { return t?.palack ? Math.ceil(r.l / UVEGEK[t.palack.meret].l - 1e-6) * UVEGEK[t.palack.meret].l : r.l; }
  /** Mi a baj a tétellel (null: megfelel). → {fajta: 'keves'|'gyenge', szoveg} */
  _hiba(r, t) {
    if (!t) return { fajta: 'nincs', szoveg: 'Nincs nálad pálinka.' };
    if (r.gyumolcs && t.gyumolcs !== r.gyumolcs) return { fajta: 'gyenge', szoveg: `más gyümölcs (${gyNev(t.gyumolcs)})` };
    if (r.minFok && t.fok + 1e-4 < r.minFok) return { fajta: 'gyenge', szoveg: `túl gyenge: ${hu(t.fok, 0)} fok, legalább ${r.minFok} kell` };
    if (r.maxFok && t.fok - 1e-4 > r.maxFok) return { fajta: 'gyenge', szoveg: `túl erős: ${hu(t.fok, 0)} fok, legfeljebb ${r.maxFok}` };
    if (t.q + 1e-4 < r.minQ) return { fajta: 'gyenge', szoveg: `gyenge: ${Math.floor(t.q)} pont, legalább ${r.minQ} kell` };
    if (r.hatas && !t.effektek?.includes(r.hatas)) return { fajta: 'gyenge', szoveg: 'nem az, amit kért' };
    if (t.l + 1e-6 < this._lAt(r, t)) return { fajta: 'keves', szoveg: `kevés: ${hu(t.l, 2)} l, ${hu(r.l)} l kell` };
    return null;
  }
  /** Az átadandó tétel: a legjobb megfelelő (a nálad lévő előre, aztán a jobb minőség); ha egyik sem jó, a legközelebbi. */
  valaszt(r) {
    const lista = this._tetelek(r);
    const pont = t => (t.hely === 'nalad' ? 1000 : 0) + t.q + Math.min(t.l, 5);
    const jo = lista.filter(t => !this._hiba(r, t)).sort((a, b) => pont(b) - pont(a));
    if (jo.length) return jo[0];
    return lista.sort((a, b) => pont(b) - pont(a))[0] || null;
  }
  _arOf(r) { return this.ar[r.id] ?? r.ar; }

  // ------------------------------------------------------------ a kész üveg az üst mellett (E: a kezedbe)
  _friss() {
    const S = this.S;
    if (S.keziUst || S.tetelek.some(t => t.hely === 'nalad' && t.l > 0.004)) return null;
    // a tanya raktárában (nem a pincében) álló, palackozatlan tétel: a legutóbbi főzés
    const l = S.tetelek.filter(t => t.hely === 'prop:tanya' && !t.palack && !t.erleles && t.l > 0.02);
    return l[l.length - 1] || null;
  }
  _asztalFrissit() {
    const t = this.aktiv() || this.J.coop ? this._friss() : null;
    if (!t) { if (this.asztal) { this.J.sz.celTorol(this.asztal); this.asztal.removeFromParent(); this.asztal = null; } return; }
    if (this.asztal) { this.asztal.userData.tetel = t.id; return; }
    const u = this.J.sz.ustHelyek().find(x => x.prop === 'tanya');
    if (!u) return;
    u.obj.getWorldPosition(_v);
    const g = new THREE.Group();
    const uveg = palinkasUveg(); uveg.scale.setScalar(1.25); g.add(uveg);
    g.position.set(_v.x + 1.5, _v.y, _v.z + 0.45);
    // célzás: nagyvonalú láthatatlan gömb az üveg körül (a játékos ne pixelre célozzon)
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    h.position.y = 0.25; g.add(h);
    this.J.scene.add(g);
    this.J.sz.celoz(g, { kind: 'uveg_kesz', tetel: t.id });
    this.asztal = g;
  }
  /** Felirat a célzott üveghez. */
  uvegSzoveg() {
    const t = this._friss();
    return t ? `E – a kezedbe: ${hu(Math.min(t.l, H.felvetelMax), 2)} l ${gyNev(t.gyumolcs)}, ${hu(t.fok, 0)} fok` : '';
  }
  /** E az üvegen: a kezedbe veszed (legfeljebb 3 l). */
  felvesz() {
    const t = this._friss(); if (!t) return;
    utana(this.E.carry(t.id, t.l > H.felvetelMax ? H.felvetelMax : undefined), r => {
      if (!r?.ok) return;
      this.kezFel = 0;
      this.J.hang.play('uveg', { vol: 0.7 });
      this.J.S = this.E.state;
      this._asztalFrissit();
    });
  }

  // ------------------------------------------------------------ E a vevőn
  /** Az interakcio.js hívja egyjátékos módban (a régi panel helyett). */
  atad(n, r) {
    if (this.seq) return;
    const sz = this.J.sz, v = sz.vevok.get(r.id);
    if (!v) return;
    const most = this.S.ido.perc;
    if (most < r.ablak[0]) { this._rovid(v, 'beszel', `„Korán jöttél. ${ora(r.ablak[0])}-tól várlak.”`); return; }
    const t = this.valaszt(r);
    const hiba = this._hiba(r, t);
    if (hiba?.fajta === 'nincs') { this._rovid(v, 'szid', '„Üres kézzel jöttél, fiam?” Előbb főzz, és vedd kézbe az üveget.'); return; }
    if (hiba?.fajta === 'keves') { this._rovid(v, 'szid', `„${hu(r.l)} litert kértem.” (${hiba.szoveg})`); this.J.hang.play('ui_click'); return; }
    const ar = this._arOf(r);
    const hud = this.J.ui?.hud;
    if (hud) hud.repulesJon = r.id;          // a HUD a pénzt a repülés végéig visszatartja (pörgő számláló)
    const res0 = this.E.deliver(r.id, t.id, this._lAt(r, t), ar);
    const indul = res => {
      if (hud && !res?.ok) hud.repulesJon = null;
      if (res?.alku) {   // túl sokat kértél: ellenajánlat, az üveg nálad marad
        this.ar[r.id] = res.ellenajanlat;
        this._rovid(v, 'beszel', `${res.valasz} [E] áll az alku · [Z]/[X] ár`);
        return;
      }
      const tipus = res?.ok ? 'jo' : hiba ? 'gyenge' : 'elutasit';
      v.atadasban = true;
      const o = v.n.obj, szr = o.userData.szereplo;
      const uveg = kezUveg(); uveg.traverse(m => { if (m.isMesh) { m.material.depthTest = true; m.renderOrder = 0; } });
      // indulás: a kézben lévő üveg helyéről (vagy a kép aljáról)
      this._kezPoz(uveg, 0);
      this.J.scene.add(uveg);
      this.seq = { id: r.id, r, v, t: 0, fazis: 'repul', res, tipus, uveg, ar, honnan: uveg.position.clone(), szr };
      this.kez.visible = false; this.kezFel = 0;
      szr?.anim('atad', { sebesseg: H.atadSeb, utana: 'all' });
      szr?.nez(this.J.camera.position);
      this.J.hang.play('uveg', { vol: 0.6 });
      this._buborek(v, r, { cim: true, sor: '…' });
    };
    utana(res0, indul);
  }
  /** Rövid válasz átadás nélkül (korán, kevés, alku): egy mozdulat és a szöveg a buborékba. */
  _rovid(v, anim, szoveg) {
    v.n.obj.userData.szereplo?.anim(anim === 'szid' ? 'szid' : anim, { utana: 'all' });
    if (anim === 'szid') setTimeout(() => v.n.obj.userData.szereplo?.anim('all'), 1600);
    this.uzenet = { id: [...this.J.sz.vevok].find(([, x]) => x === v)?.[0], szoveg, ig: performance.now() + 3200 };
  }

  // ------------------------------------------------------------ frissítés (szereplok.js update hívja)
  update(dt) {
    const J = this.J;
    if (!J.S) return;
    this._asztalT = (this._asztalT || 0) - dt;
    if (this._asztalT <= 0) { this._asztalT = 0.25; this._asztalFrissit(); }
    const modal = J.ui?.isOpen?.(), ust = J.ust?.(), vezet = !!J.jarmuvek?.vezet;
    const p = J.jatekosPoz(), cam = J.camera.position;
    // vevők: integetés, fejfordítás, odafordulás
    let kozeli = null, kd = 1e9;
    for (const [id, v] of J.sz.vevok) {
      if (v.megy) continue;
      const o = v.n.obj, szr = o.userData.szereplo;
      const d = Math.hypot(o.position.x - p.x, o.position.z - p.z);
      if (!v.n.seta && szr) {
        if (d < H.nezTav) szr.nez(cam); else szr.nez(null);
        if (d < H.integetTav && !v.integetett && !this.seq) { v.integetett = true; szr.anim('integet', { utana: 'all' }); J.hang.play('koszones', { pos: o, vol: 0.35 }); }
        if (d > 14) v.integetett = false;
        if (d < H.fordulTav || v.atadasban) {
          const cel = Math.atan2(cam.x - o.position.x, cam.z - o.position.z);
          if (v.yaw == null) v.yaw = o.rotation.y;
          let dy = cel - v.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          v.yaw += dy * Math.min(1, dt * 4);
          o.rotation.y = v.yaw; v.n.ry0 = v.yaw;
        } else v.yaw = null;
      }
      if (this.aktiv() && d < H.buborekTav && d < kd && !v.n.seta) { kozeli = id; kd = d; }
    }
    if (this.seq) kozeli = this.seq.id;
    // alku: Z/X a közeli vevőnél
    if (kozeli && !this.seq && !modal && !ust && this.aktiv()) {
      const r = J.S.rendelesek.find(x => x.id === kozeli);
      if (r) {
        const I = J.bemenet; let d = 0;
        if (I.most('KeyZ')) d = -1; if (I.most('KeyX')) d = 1;
        if (d) {
          const a = this._arOf(r) + d * H.arLepes;
          this.ar[r.id] = Math.round(Math.min(r.ar * H.arMax, Math.max(r.ar * H.arMin, a)) / 100) * 100;
          J.hang.play('ui_click', { pitch: d > 0 ? 1.2 : 0.9, vol: 0.5 });
        }
      }
    }
    if (this.seq) this._seqLep(dt);
    // buborék
    const rejt = modal || ust || vezet || J.mod !== 'jatek';
    if (kozeli && !rejt) {
      const v = J.sz.vevok.get(kozeli), r = J.S.rendelesek.find(x => x.id === kozeli) || this.seq?.r;
      if (v && r) this._buborek(v, r);
      else this._buborekKi();
    } else this._buborekKi();
    this.buborekId = kozeli && !rejt ? kozeli : null;
    // az üveg a kézben
    this._kezLep(dt, rejt);
  }
  _kezLep(dt, rejt) {
    const van = !this.seq && this.S.tetelek.some(t => t.hely === 'nalad' && t.l > 0.004);
    this.kez.visible = van && !rejt;
    if (!this.kez.visible) { this.kezFel = 0; return; }
    this.kezFel = Math.min(1, this.kezFel + dt * 3.5);
    this._kezPoz(this.kez, 1 - (1 - this.kezFel) ** 3);
  }
  /** Az üveg helye a kamera terében; a = 0..1 felemelkedés (0: a kép alja alatt). */
  _kezPoz(obj, a) {
    const J = this.J, cam = J.camera, j = J.jatekos;
    const b = Math.sin((j?.bob || 0)) * H.billeg;
    _v.set(H.kezPoz[0], H.kezPoz[1] - (1 - a) * 0.22 + b, H.kezPoz[2]).applyQuaternion(cam.quaternion).add(cam.position);
    obj.position.copy(_v);
    _q.setFromEuler(_e.set(...H.kezDoles));
    obj.quaternion.copy(cam.quaternion).multiply(_q);
    obj.scale.setScalar(1);
  }

  _seqLep(dt) {
    const s = this.seq, J = this.J, o = s.v.n.obj, szr = s.szr;
    s.t += dt;
    // a kamera finoman a vevő felé (fej magasság)
    if (s.t < H.kameraMp) { o.getWorldPosition(_v); J.nezRa(_v.x, _v.y + 1.45, _v.z, dt); }
    const T1 = H.repulMp, T2 = H.atadMp, T3 = T2 + H.iszikMp, T4 = T3 + H.reakcioMp;
    if (s.fazis === 'repul') {
      // az üveg ívben a vevő jobb kezébe
      const w = szr?.cs?.WristR; if (w) w.getWorldPosition(_v); else { o.getWorldPosition(_v); _v.y += 1.1; }
      const a = Math.min(1, s.t / T1), e = 1 - (1 - a) ** 2;
      s.uveg.position.lerpVectors(s.honnan, _v, e); s.uveg.position.y += Math.sin(a * Math.PI) * 0.18;
      s.uveg.rotation.set(0, 0, 0); s.uveg.scale.setScalar(1);
      if (a >= 1) {
        s.uveg.removeFromParent();
        if (szr) szr.fog(s.uveg, 'R', { poz: [0, -0.07, 0.04] });
        s.fazis = 'atad';
      }
    } else if (s.fazis === 'atad' && s.t >= T2) {
      s.fazis = 'iszik';
      szr?.anim('iszik', { sebesseg: H.iszikSeb, utana: 'all' });
    } else if (s.fazis === 'iszik' && s.t >= T3) {
      s.fazis = 'reakcio';
      const r = s.r;
      if (s.tipus === 'jo') {
        szr?.anim(r.l >= 1 ? 'koccint' : 'orul', { sebesseg: r.l >= 1 ? 1.6 : 1, utana: 'all' });
        J.hang.play('koszones', { pos: o, vol: 0.6 });
        // a pénz a vevőtől a tárcába repül
        o.getWorldPosition(_v); _v.y += 1.5; _v.project(J.camera);
        const sx = (_v.x + 1) / 2 * innerWidth, sy = (1 - _v.y) / 2 * innerHeight;
        J.ui?.hud?.penzRepul?.(s.res.fizetett ?? s.ar, sx, sy, r.id);
      } else {
        szr?.anim('szid');
        J.hang.play('ui_click', { pitch: 0.7, vol: 0.6 });
      }
    } else if (s.fazis === 'reakcio' && s.t >= T4) this._seqVege();
  }
  _seqVege() {
    const s = this.seq; this.seq = null;
    const v = s.v, szr = s.szr;
    v.atadasban = false;
    if (s.tipus === 'jo') {
      v.orom = 0.01;   // a szereplok.js elküldi (az üveg a kezében marad)
    } else {
      szr?.elenged('R'); szr?.anim('all');
      this.kezFel = 0;   // az üveg visszakerül a kezedbe (a sim nem vette el)
    }
  }

  // ------------------------------------------------------------ buborék
  _buborek(v, r) {
    const J = this.J, s = this.seq;
    const vv = J.S.vevok.find(x => x.id === r.vevo);
    let fo, al = '';
    const uz = this.uzenet && this.uzenet.id === r.id && performance.now() < this.uzenet.ig ? this.uzenet.szoveg : null;
    if (s) {
      if (s.fazis === 'repul' || s.fazis === 'atad') fo = '<i>Átveszi az üveget…</i>';
      else if (s.fazis === 'iszik') fo = '<i>Meghúzza…</i>';
      else if (s.tipus === 'jo') { fo = esc(s.res.valasz || '„Egészségünkre!”'); al = `<b style="color:#2f6b2a;font-size:20px">+${esc(ft(s.res.fizetett ?? s.ar))}</b>`; }
      else fo = `<b style="color:#9b2a1c">${esc(s.res?.valasz || 'Nem kéri.')}</b>`;
    } else if (uz) fo = esc(uz).replace(/\[(.+?)\]/g, '<kbd style="font:12px monospace;border:1px solid #8a6a44;border-radius:3px;padding:0 3px">$1</kbd>');
    else {
      const t = this.valaszt(r), h = this._hiba(r, t), ar = this._arOf(r);
      fo = `<span style="font-style:italic">„${esc(vv?.keres || '')}”</span>`;
      const korai = J.S.ido.perc < r.ablak[0];
      const allapot = korai ? `<span style="color:#8a6a44">${ora(r.ablak[0])}-tól vár</span>`
        : h ? `<span style="color:#9b2a1c">✗ ${esc(h.szoveg)}</span>`
          : `<span style="color:#2f6b2a">✓ ${hu(t.l, 2)} l · ${hu(t.fok, 0)} fok · ${Math.round(t.q)} pont</span>`;
      const arSzin = ar > r.ar ? '#9b2a1c' : ar < r.ar ? '#2f6b2a' : '#2b1d12';
      al = `<div style="font-size:16px;margin-top:4px"><b>${esc(hu(r.l))} l ${esc(r.gyumolcs ? gyNev(r.gyumolcs) : 'pálinka')}</b> · <b style="color:${arSzin}">${esc(ft(ar))}</b>${ar !== r.ar ? ` <s style="opacity:.55">${esc(ft(r.ar))}</s>` : ''}</div>
        <div style="font-size:13px;margin-top:3px">${allapot}</div>
        <div style="font:12px/1.4 system-ui,sans-serif;margin-top:5px;opacity:.75"><kbd style="font:12px monospace;border:1px solid #8a6a44;border-radius:3px;padding:0 3px">E</kbd> átadás · <kbd style="font:12px monospace;border:1px solid #8a6a44;border-radius:3px;padding:0 3px">Z</kbd>/<kbd style="font:12px monospace;border:1px solid #8a6a44;border-radius:3px;padding:0 3px">X</kbd> ár</div>`;
    }
    const html = `<div style="font-weight:bold;font-size:13px;letter-spacing:.02em;color:#6b4a30;margin-bottom:2px">${esc(r.nev)}</div><div>${fo}</div>${al}`;
    if (html !== this._html) { this._html = html; this.el.innerHTML = html; }
    // a fej fölé
    const o = v.n.obj; o.getWorldPosition(_v); _v.y += 2.05; _v.project(J.camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { this.el.style.display = 'none'; return; }
    const x = (_v.x + 1) / 2 * innerWidth, y = (1 - _v.y) / 2 * innerHeight;
    this.el.style.left = Math.round(Math.min(innerWidth - 160, Math.max(160, x))) + 'px';
    this.el.style.top = Math.round(Math.max(120, y)) + 'px';
    this.el.style.display = 'block';
  }
  _buborekKi() { if (this.el.style.display !== 'none') this.el.style.display = 'none'; }
}
function ora(p) { const m = Math.floor(((p % 1440) + 1440) % 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
