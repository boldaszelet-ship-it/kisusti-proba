// Kisüsti v0.3 — a fő hurok és a bekötés: világ (vilag/), játékos és járművek, NPC-k, birodalmi szimuláció (sim/empire),
// UI (js/ui/ui.js), hangmotor (hang.js), interakció és üst (interakcio.js), élő szereplők (szereplok.js),
// mentés/betöltés, kezdőképernyő, tesztkampók (window.__teszt).
//
// Idő: a sim TIME_SCALE-je (1 valós mp = 6 játékperc) változatlan. A nagy térképet a járművek (a bicikli az elején a
// tanyán áll), a buszmegállók fizetős gyorsutazása (szereplok.js) és az éjszakai alvás (reggelig ugrik) oldja meg.
import * as THREE from 'three';
import { epitVilag, regioNal } from './vilag/index.js';
import { Jatekos, Bemenet } from './jatekos.js';
import { JarmuKezelo } from './jarmu.js';
import { NpcRendszer } from './npc.js';
import { Hang } from './hang.js';
import { Empire } from '../sim/empire.js';
import { YIELD } from '../sim.js';
import { NODES, PROPERTIES } from '../data/regions.js';
import { UI } from './ui/ui.js';
import { Interakcio } from './interakcio.js';
import { Szereplok } from './szereplok.js';
import { szereplokBetolt, Szereplo } from './szereplok/szereplo.js';
import { Grafika, MINOSEGEK } from './grafika/index.js';
import { Coop } from './coop/coop.js';
import { kezdoPanel, KozosJatek, COOP_MENTES } from './kozosJatek.js';
import { utana } from './ui/elemek.js';
import { Tortenet } from './tortenet/index.js';

const Q = new URLSearchParams(location.search);
const TEST = Q.has('teszt') || navigator.webdriver;
const $ = id => document.getElementById(id);
const MENTES = 'kisusti.mentes.';

/** Hangolható értékek (játékérzet). */
const H = {
  cimkeTav: 14,              // m: a 3D-feliratok eddig látszanak
  kozelTav: 14,              // m: a UI „ott vagy-e" kérdésére (találkozó, leadási pont)
  lepesHangero: 0.5,
  ustHangTav: 70,            // m: az üst hurkai eddig szólnak
  ambientIdo: 0.5,           // mp: a környezeti réteg frissítése
  razasLecseng: 3.2,
};

// ================================================================ renderer, jelenet
const renderer = new THREE.WebGLRenderer({ antialias: !TEST || Q.has('aa'), preserveDrawingBuffer: TEST, powerPreference: 'high-performance' });
renderer.setPixelRatio(TEST ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;           // (PCFSoft a nagy térképen túl drága)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.info.autoReset = false;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 2300);   // a far a teljes térképhez kell
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); J.G?.resize(); });

/** A közös állapot: minden modul ezen át éri el a többit. */
const J = { scene, camera, renderer, TEST, celok: [], tweenek: [], cimkeLista: [], mod: 'start', E: null, S: null, ui: null, zarolva: false };
window.__hiba = null;
addEventListener('error', e => { window.__hiba = String(e.message || e); });

// ================================================================ betöltés
const t0 = performance.now();
const V = await epitVilag(scene, { onProgress: (f, k, n) => { $('tolt-i').style.width = (k / n * 100) + '%'; $('tolt-f').textContent = f === 'modellek' ? 'A falu ébredezik…' : 'Még egy pillanat…'; } });
J.V = V;
await szereplokBetolt();          // a valós arányú figurák sablonjai (ferfi.glb, no.glb, animációk)
Szereplo.kamera = camera.position;
const bemenet = new Bemenet(renderer.domElement);
const jatekos = new Jatekos(camera, V, bemenet);
jatekos.hely(2, 2.5, -22, -5);
const jarmuvek = new JarmuKezelo(V, jatekos, camera, bemenet, scene);
const npc = new NpcRendszer(V, scene);
npc.indit({ gyalogos: 14, auto: 5 });
const hang = new Hang();
hang.helyek({ kocsma: V.anchors.kocsma ? [V.anchors.kocsma.position.x, 1.5, V.anchors.kocsma.position.z] : undefined, torony: V.anchors.torony ? [V.anchors.torony.position.x, 18, V.anchors.torony.position.z] : undefined });
Object.assign(J, { bemenet, jatekos, jarmuvek, npc, hang });
const I = new Interakcio(J); J.I = I;
J.T = new Tortenet(J);   // a történeti réteg (js/tortenet/): intró, tutorial, jelenetek
for (const L of V.cimkek) cimkeDom(L);
// a Grafika (utófeldolgozás, fű, szél, füst, kontaktárnyék): ?grafika= felülírja; tesztben (swiftshader) alacsony
const grafikaAlap = () => { try { return JSON.parse(localStorage.getItem('kisusti.beallitasok') || '{}').grafika; } catch (e) { return null; } };
const GQ = Q.get('grafika') || (TEST ? 'alacsony' : grafikaAlap() || 'kozepes');
const G = J.G = MINOSEGEK.includes(GQ) ? new Grafika(renderer, scene, camera, { minoseg: GQ, vilag: V }) : null;
if (G) {
  for (const n of npc.lista) G.kontakt(n.obj, n.tipus === 'gyalogos' || n.tipus === 'allo' ? 0.42 : 1.1, n.tipus === 'gyalogos' || n.tipus === 'allo' ? 0.42 : 2.2);
  for (const v of jarmuvek.lista || []) G.kontakt(v.obj, v.tipus === 'auto' ? 1.05 : 0.35, v.tipus === 'auto' ? 2.1 : 0.95);
}
V.update(0, 10, camera.position, camera);
V.lodMost(camera.position);
G?.update(0, 10);
renderer.compile(scene, camera);
if (G) G.render(); else renderer.render(scene, camera);
J.betoltes = Math.round(performance.now() - t0);

// ================================================================ segédfüggvények a moduloknak
J.uzen = (t, hiba = false) => J.E?.emit({ type: 'msg', text: t, hiba });
J.jatekosPoz = () => (jarmuvek.vezet ? jarmuvek.vezet.obj.position : jatekos.pos);
J.regioId = () => { const p = J.jatekosPoz(); return regioNal(p.x, p.z)?.id || null; };
J.ust = () => !!I.ust;
J.zar = b => { J.zarolva = b; if (b) bemenet.keys.clear(); };
J.razas = a => { J.razasA = Math.max(J.razasA || 0, a); };
J.hely = (x, z, yawFok = 0, pitchFok = 0) => { if (jarmuvek.vezet) jarmuvek.kiszall(true); jatekos.hely(x, z, yawFok, pitchFok); V.lodMost(camera.position); };
J.nezRa = (x, y, z, dt) => {
  if (jarmuvek.vezet) return;
  const c = camera.position, dx = x - c.x, dy = y - c.y, dz = z - c.z;
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  let d = yaw - jatekos.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  const a = 1 - Math.exp(-dt * 6);
  jatekos.yaw += d * a; jatekos.pitch += (pitch - jatekos.pitch) * a; jatekos.kamera();
};
J.cimke = (obj, text, off = 2, size = 15) => { const L = { obj, text, off, size }; cimkeDom(L); return L; };
J.cimkeTorol = L => { if (!L) return; L.el?.remove(); const i = J.cimkeLista.indexOf(L); if (i >= 0) J.cimkeLista.splice(i, 1); };
J.felirat = (cim, szoveg, mp = 3) => {
  const el = $('jelenet'); el.querySelector('h2').textContent = cim; el.querySelector('p').textContent = szoveg || '';
  el.classList.add('be'); J.feliratT = mp;
};
/** Elsötétítés: elsötétül, lefut fn, kivilágosodik. Tesztben azonnal (determinisztikus). */
J.fade = (fn, mp = 0.5) => {
  if (TEST) { fn(); return; }
  const el = $('elsot'); el.classList.add('be'); J.zar(true);
  setTimeout(() => { try { fn(); } finally { setTimeout(() => { el.classList.remove('be'); J.zar(false); }, 120); } }, mp * 500);
};
J.menuNyitva = b => { J.buszNyitva = b; if (b) { document.exitPointerLock?.(); bemenet.keys.clear(); } else zarEger(); };
/** Időugrás után (alvás, busz, ledőlés, betöltés): a világ a sim mostani állapotához igazodik. */
J.idougras = () => { J.S = J.E.state; J.sz?.ujraszinkron(); V.lodMost(camera.position); };
J.alvas = () => {
  // közös játék: az alvás szavazás — reggel akkor lesz, ha mindenki lefeküdt; újra az ágyon: mégse
  if (J.coop) {
    if (J.coop.meta.alvas?.igen.includes(J.coop.te)) { utana(J.E.alvasMegse(), () => J.uzen('Mégsem fekszel le.')); return; }
    J.uzen('Lefeküdtél. Ha mindenki lefekszik, reggel lesz.');
    utana(J.ui.alvas(), r => { if (r?.ok) { J.idougras(); ment(); } });
    return;
  }
  J.fade(() => {
    const r = J.ui.alvas();
    if (r && r.ok === false) return;
    J.idougras(); ment();
  }, 0.9);
};

function cimkeDom(L) {
  const el = document.createElement('div'); el.className = 'lbl'; el.style.fontSize = (L.size || 15) + 'px'; el.style.display = 'none';
  $('labels').appendChild(el); L.el = el; L._t = null; J.cimkeLista.push(L); return L;
}
const _v = new THREE.Vector3();
function cimkek() {
  const nyitott = J.ui?.isOpen() || I.ust;
  for (const L of J.cimkeLista) {
    if (nyitott || !L.text) { if (L.el.style.display !== 'none') L.el.style.display = 'none'; continue; }
    let lathato = true;
    for (let p = L.obj; p; p = p.parent) if (!p.visible) { lathato = false; break; }
    L.obj.getWorldPosition(_v); _v.y += L.off;
    const d = _v.distanceTo(camera.position);
    _v.project(camera);
    const tav = L.tav || H.cimkeTav;   // a társak neve messzebbről is látszik (kozosJatek.js)
    const vis = lathato && L.obj.parent && d < tav && _v.z < 1 && Math.abs(_v.x) < 0.9 && _v.y < 0.85 && _v.y > -0.9;   // a képszélen csonka felirat nem látszik
    if (!vis) { if (L.el.style.display !== 'none') L.el.style.display = 'none'; continue; }
    if (L._t !== L.text) { L.el.textContent = L.text; L._t = L.text; }
    L.el.style.display = '';
    L.el.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; L.el.style.top = ((1 - _v.y) / 2 * innerHeight) + 'px';
    L.el.style.opacity = Math.min(1, (tav - d) / 4);
    L.el.style.fontSize = Math.round((L.size || 15) * Math.max(0.8, Math.min(1.25, 7 / d))) + 'px';
  }
}

// ================================================================ hang
/** A sim hangjelei → a hangmotor hangjai (ami a hangmotorban nincs, annak a legközelebbi megfelelője). */
const SFX = {
  ultetes: ['gyumolcs', { pitch: 0.7 }], ontozes: ['vodor'], kut: ['vodor'], ust_indul: ['hordo_fedel'], ust_kesz: ['dugo'],
  keveres: ['toltes'], palack: ['dugo'], razzia: ['gyanu'], kuldetes: ['ui_click', { pitch: 0.8 }], szedes: ['gyumolcs'], hordo: ['hordo'],
  vagas: null,     // a vágás hangját az üstmód adja (azonnali visszajelzés), ne szóljon kétszer
  jaror: null,     // a járőrt a motorja jelzi, közelről
};
function hangEsemeny(e) {
  if (e.type === 'sfx') {
    if (e.id === 'penz' || e.id === 'rang') { if (!J.uiValodi) hang.esemeny(e); return; }   // a UI is megszólaltatja
    const m = SFX[e.id];
    if (m === null) return;
    if (!m) { hang.esemeny(e); return; }
    hang.play(m[0], { ...(m[1] || {}), pos: e.pos });
    return;
  }
  if (e.type === 'search' || e.type === 'raid') { hang.esemeny(e); return; }
  if (!J.uiValodi && (e.type === 'sms' || e.type === 'sale' || e.type === 'rankUp')) hang.esemeny(e);
}
const HURKOK = {};   // 'prop:idx' → {tuz, forras, csepeges}
let lepesFazis = 0, ambT = 0, jarmuHang = null, jarmuHangTipus = null;
const FELULET = { 0: 'fu', 10: 'fu', 11: 'fu', 14: 'fu', 15: 'fu', 17: 'fu', 1: 'aszfalt', 2: 'aszfalt', 9: 'aszfalt', 13: 'aszfalt', 16: 'aszfalt' };
const feluletHang = (x, z) => FELULET[V.felulet(x, z)] || 'fold';
function hangLep(dt) {
  const S = J.S;
  // környezet: napszak és régió
  ambT += dt;
  if (ambT > H.ambientIdo) { ambT = 0; hang.ambient({ napszak: (S.ido.perc % 1440) / 1440, regio: J.regioId() || 'tanya' }); }
  // lépések a fejbillegés ütemére
  if (!jarmuvek.vezet && jatekos.foldon && Math.hypot(jatekos.vel.x, jatekos.vel.z) > 0.6) {
    const f = Math.floor(jatekos.bob / Math.PI);
    if (f !== lepesFazis) { lepesFazis = f; hang.lepes(feluletHang(jatekos.pos.x, jatekos.pos.z), { vol: H.lepesHangero * (bemenet.van('ShiftLeft', 'ShiftRight') ? 1.15 : 1) }); }
  }
  // üstök: tűz, forrás, csepegés
  const cam = camera.position;
  for (const u of J.sz.ustHelyek()) {
    const P = S.ingatlanok.find(p => p.id === u.prop), us = P?.ustok[u.idx], k = u.prop + ':' + u.idx;
    u.obj.getWorldPosition(_v);
    const fut = us && us.allapot !== 'all' && _v.distanceTo(cam) < H.ustHangTav;
    let h = HURKOK[k];
    if (fut && !h) {
      const pos = [_v.x, 0.6, _v.z];
      h = HURKOK[k] = { tuz: hang.loop('tuz', { pos, ero: 0.3 }), forras: hang.loop('forras', { pos: [_v.x, 1.2, _v.z], ho: 0.2 }), csepeges: hang.loop('csepeges', { pos: [_v.x + 1.5, 0.6, _v.z], seb: 0, tele: 0, vol: 0 }) };
    }
    if (!fut && h) { for (const l of Object.values(h)) l.stop(0.6); delete HURKOK[k]; continue; }
    if (!h) continue;
    const kezi = S.keziUst && S.keziUst.propId === u.prop && S.keziUst.ustIdx === u.idx;
    const c = J.E.core.still;
    const ero = kezi ? c.heat : 0.6, ho = kezi ? THREE.MathUtils.clamp((c.temp - 55) / 45, 0, 1) : 0.75;
    const seb = kezi ? (c.temp >= 80 ? Math.min(1, (c.temp - 80) / 11) : 0) : 0.5;
    const tele = kezi ? Math.min(1, c.prodL / Math.max(0.1, c.charge * YIELD * 0.6)) : 0.5;
    h.tuz.set({ ero, vol: 0.3 + 0.7 * ero });
    h.forras.set({ ho, vol: ho > 0.05 ? 1 : 0 });
    h.csepeges.set({ seb, tele, vol: seb > 0.02 ? 1 : 0 });
  }
  // a játékos járműve
  const v = jarmuvek.vezet, tip = v?.tipus || null;
  if (tip !== jarmuHangTipus) {
    jarmuHang?.stop(0.4); jarmuHang = null;
    if (tip === 'auto') { hang.play('ajto_csapas', { vol: 0.8 }); hang.play('kisauto_indit', { vol: 0.8 }); jarmuHang = hang.loop('motor_kisauto', { rpm: 0.05, gaz: 0.15, vol: 0.85 }); }
    if (jarmuHangTipus === 'auto' && !tip) hang.play('ajto_csapas', { vol: 0.8 });
    if (tip === 'bicikli') jarmuHang = hang.loop('bicikli', { seb: 0, teker: 0, vol: 0 });
    jarmuHangTipus = tip;
  }
  if (v && jarmuHang) {
    const s = Math.abs(v.seb), gaz = bemenet.van('KeyW') ? 1 : 0;
    if (tip === 'auto') jarmuHang.set({ rpm: Math.min(1, 0.05 + s / v.S.maxSeb * 0.9), gaz: gaz ? 0.8 : 0.15 });
    else jarmuHang.set({ seb: Math.min(1, s / 9), teker: gaz, vol: s > 0.3 ? 1 : 0 });
    if (tip === 'bicikli' && bemenet.most('KeyB')) hang.play('bicikli_csengo', { vol: 0.8 });
  }
}

// ================================================================ a tanya látványa (tűz, füst, feliratok)
function tanyaLatvany(dt) {
  const S = J.S, T = V.tanya, P = S.ingatlanok.find(p => p.id === 'tanya');
  const u = P.ustok[0], kezi = S.keziUst && S.keziUst.propId === 'tanya';
  const c = J.E.core.still, fut = u.allapot !== 'all';
  const ero = kezi ? c.heat : fut ? 0.6 : 0;
  T.fire.intensity = ero * 9 * (0.85 + 0.15 * Math.sin(performance.now() * 0.013) * Math.sin(performance.now() * 0.0071));
  T.fireGlow.visible = ero > 0.05;
  const fust = fut && (!kezi || c.temp > 60);
  if (G) G.ustFust(fust);
  for (const s of T.smoke) {
    s.userData.t += dt * 0.25; if (s.userData.t > 1) s.userData.t -= 1;
    const t = s.userData.t;
    s.visible = fust && !G;   // a Grafika saját részecskefüstje helyettesíti
    s.position.set(6.2 + t * 1.6, 4.4 + t * 4.0, -8.1 + Math.sin(t * 9 + s.id) * 0.3);
    s.scale.setScalar((0.5 + t * 2.0) * (1 + (J.gozT || 0)));
    s.material.opacity = 0.4 * (1 - t);
  }
  if (J.gozT > 0) J.gozT = Math.max(0, J.gozT - dt * 1.5);
  T.stillLbl.text = u.pecset > 0 ? 'ÜST · lepecsételve' : kezi ? `ÜST · ${Math.round(c.temp)} °C` : fut ? 'ÜST · magától fő' : 'ÜST';
  const erj = P.hordok.filter(h => h.allapot === 'erjed').length, kesz = P.hordok.filter(h => h.allapot === 'kesz').length;
  T.barrelLbl.text = kesz ? 'HORDÓ · kész cefre' : erj ? 'HORDÓ · erjed' : 'HORDÓ';
  // a többi ingatlan üstje: a tűz izzása
  for (const x of J.sz.ustHelyek()) {
    if (x.prop === 'tanya') continue;
    const us = S.ingatlanok.find(p => p.id === x.prop)?.ustok[x.idx];
    x.obj.traverse(o => { if (o.isMesh && o.material?.isMeshBasicMaterial && o.material.color.getHex() === 0xff6a1a) o.visible = !!us && us.allapot !== 'all'; });
  }
}

// ================================================================ az Empire és a UI
let leiratkozik = null;
function esemeny(e) {
  hangEsemeny(e);
  J.sz?.esemeny(e);
  if (e.type === 'msg' && /KIFUTOTT/.test(e.text)) { I.kifutott(); J.gozT = 1.6; J.razas(0.8); }
  J.T.esemeny(e);   // történet: tutorial-lépések, jelenetek élesítése, horgok
}
function bekot(E) {
  leiratkozik?.();
  J.E = E; J.S = E.state;
  leiratkozik = E.on(esemeny);
}
/** A UI betöltött egy mentést (szünet → betöltés): a világ az új állapothoz igazodik. */
function csere(E2) {
  bekot(E2);
  I.ustKi();
  J.hely(2, 2.5, -22, -5);
  J.idougras();
}
function kozel(cel) {
  const p = J.jatekosPoz();
  let x, z;
  if (cel?.pos) [x, z] = cel.pos;
  else if (cel?.node && NODES[cel.node]) [x, z] = NODES[cel.node];
  else if (cel?.prop) { const a = V.anchors[cel.prop]?.position; if (a) { x = a.x; z = a.z; } }
  if (x == null) return true;
  return Math.hypot(p.x - x, p.z - z) < H.kozelTav;
}
function zarEger() {
  if (TEST || J.mod !== 'jatek' || J.ui?.isOpen() || J.buszNyitva) return;
  try { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch (e) { /* gesztus nélkül nem megy */ }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement || TEST || J.mod !== 'jatek') return;
  if (!J.ui?.isOpen() && !J.buszNyitva && !I.ust) J.ui.open('szunet');
});

/** Mentés a localStorage-ba (a UI formátumában, plusz a játékos helye). */
function ment(hely = 'auto') {
  if (!J.E || J.mod !== 'jatek') return;
  if (J.coop?.szerep === 'kliens') return;   // vendég: a tükör nem írja felül a saját egyjátékos-mentést
  const S = J.E.state, p = J.jatekosPoz();
  const meta = { nap: S.ido.nap, ora: S.ido.szoveg.split(/\s+/).pop(), rang: S.rang.nev, kp: S.penz.kp + S.penz.dunyha, szamla: S.penz.szamla, receptek: S.receptekSzama, mentve: Date.now() };
  try { localStorage.setItem(MENTES + hely, JSON.stringify({ meta, adat: J.E.save(), jatek: { pos: [p.x, p.z], yaw: jatekos.yaw * 180 / Math.PI } })); } catch (e) { console.warn('[mentés]', e.message); }
}
function legujabbMentes() {
  let best = null;
  for (const id of ['auto', '1', '2', '3']) {
    try { const raw = localStorage.getItem(MENTES + id); if (!raw) continue; const d = JSON.parse(raw); if (d?.adat && (!best || (d.meta?.mentve || 0) > (best.meta?.mentve || 0))) best = d; } catch (e) { /* sérült hely */ }
  }
  return best;
}
addEventListener('pagehide', () => ment());
addEventListener('beforeunload', () => ment());

async function indit(E, jatekAdat = null, coop = null) {
  coopBekot(coop);   // közös játék: coop.E (HostKapu / EmpireProxy) ugyanolyan alakú, mint az Empire
  bekot(E);
  if (!J.ui) {
    const ui = new UI(E, {
      hang, kozel, autoMentes: true,
      onBeallitas: b => { jatekos.erz = 0.0022 * (b.eger ?? 1); if (G && b.grafika && b.grafika !== G.minoseg && !Q.get('grafika')) G.setMinoseg(b.grafika); },
      onOpen: () => { document.body.classList.add('modal'); document.exitPointerLock?.(); bemenet.keys.clear(); },
      onClose: () => { document.body.classList.remove('modal'); zarEger(); },
      onLoad: E2 => csere(E2),
      onQuit: () => { ment(); kilep(); },
    });
    J.ui = ui; J.uiValodi = true;
    jatekos.erz = 0.0022 * (ui.beallitasok?.eger ?? 1);
  } else J.ui.setEmpire(E, true);
  J.ui.opts.coop = coop ? (coop.szerep === 'host' ? 'host' : 'vendeg') : null;
  if (!J.sz) { J.sz = new Szereplok(J); J.sz.epit(); } else J.sz.ujraszinkron();
  if (jatekAdat?.pos) jatekos.hely(jatekAdat.pos[0], jatekAdat.pos[1], jatekAdat.yaw || 0, -4);
  else jatekos.hely(2, 2.5, -22, -5);   // az udvar közepe, szemben a pajta és az üst
  V.lodMost(camera.position);
  J.mod = 'jatek';
  J.idougras();
  $('start').classList.add('ki');
  J.ui.el?.style && (J.ui.el.style.display = '');
}
function ujJatek(seed = TEST ? 7 : (Date.now() & 0x7fffffff)) {
  return indit(ujEmpire(seed)).then(() => J.T.ujJatek(J.E));   // történet: intró (a sim indulása előtt), tutorial
}
/** Új birodalom a nyitánnyal (az egyjátékos új játék és a közös játék házigazdája is ezzel indul). */
function ujEmpire(seed = TEST ? 7 : (Date.now() & 0x7fffffff)) {
  const E = new Empire(seed);
  if (!E.s.jarmuvek.includes('bicikli')) E.s.jarmuvek.push('bicikli');   // nagyapa biciklije: az elejétől a tanyán áll
  // nyitány (KRITIKA-v3 4.): nagyapa utolsó főzete kész cefreként vár a 2. hordóban (az első főzés 2 percen belül
  // indulhat), az első napon egyetlen vevő ír (Kovács bácsi, a kapuhoz), a többiek a második naptól.
  Object.assign(E.s.props.tanya.hordok[1], { allapot: 'kesz', gyumolcs: 'szilva', l: 24, q: 70, kesz: E.now(), kihozatal: 1, adalek: [] });
  let k = 0;
  for (const [id, st] of Object.entries(E.s.vevok)) if (st.allapot === 'aktiv' && id !== 'kovacs') st.kov = 1440 + 8 * 60 + (k++) * 70;
  if (E.s.vevok.kovacs) E.s.vevok.kovacs.kov = 8 * 60 + 30;   // 8:30-kor SMS, a találkozó 9:00-tól a kapuban
  E.advance(120);   // reggel nyolc: a nyitókép világos (hajnali 6-kor a tanya még szürke)
  return E;
}
function kilep() {
  J.mod = 'start'; I.ustKi();
  document.exitPointerLock?.();
  J.coop?.kilep();   // a host bezárja a szobát (a relé a mentést megkapja), a vendég kilép
  startMutat();
}

// ================================================================ közös játék (kozosJatek.js; a hálózat: coop/, server/BEKOTES.md)
let coopVar = null;   // a megnyitott, még el nem indított host-szoba: {coop, jatekAdat}
function coopBekot(coop) {
  if (J.kj && J.kj.coop !== coop) { J.kj.lebont(); J.kj = null; }
  J.coop = coop || null;
  if (coop && !J.kj) J.kj = new KozosJatek(J, coop, { onVege: coopVege });
}
/** Host: szobát nyit a legutóbbi mentéssel (vagy új birodalommal); a játék még nem indul. Visszaad: a szobakód. */
async function coopNyit(url, nev, { uj = false, seed } = {}, lista = null) {
  if (coopVar) { const v = coopVar; coopVar = null; await v.coop.kilep(); }
  const m = uj ? null : legujabbMentes();
  let E = null;
  try { if (m) E = Empire.load(m.adat); } catch (e) { console.warn('[coop] a mentés nem tölthető:', e.message); }
  const coop = new Coop({ url, nev });
  const kod = await coop.hostol(null, E || ujEmpire(seed));
  if (lista) { coop.on(e => { if (e.type === 'jatekosok') lista(e.lista); }); lista(coop.jatekosok); }
  coopVar = { coop, jatekAdat: E ? m.jatek : null };
  return kod;
}
async function coopIndit() {
  const v = coopVar; if (!v) throw new Error('Nincs nyitott szoba.');
  coopVar = null;
  await indit(v.coop.E, v.jatekAdat, v.coop);
}
/** Vendég: belép, megvárja a teljes tükröt, és indul (a host figurája a szobakód mellett). */
async function coopBelep(url, kod, nev) {
  const coop = new Coop({ url, nev });
  await coop.csatlakozik(kod);
  await indit(coop.E, null, coop);
}
/** A szoba bezárult (host kilépett / kiesett, kapcsolat elveszett, vagy mi léptünk ki). */
function coopVege(e) {
  const coop = J.coop; if (!coop) return;
  const host = coop.szerep === 'host';
  coopBekot(null);
  if (J.ui) J.ui.opts.coop = null;
  if (host) {   // a házigazda a saját birodalmával egyedül megy tovább
    bekot(coop.Ev); J.ui?.setEmpire(coop.Ev, true); J.idougras();
    if (J.mod === 'jatek') { ment(); J.uzen('A közös játék véget ért. Egyedül folytatod.'); }
    return;
  }
  if (e.mentes) try { localStorage.setItem(COOP_MENTES, JSON.stringify({ mentve: Date.now(), kod: coop.kod, adat: e.mentes })); } catch (x) { /* tele */ }
  if (e.ok === 'kilepett') return;
  J.ui?.close(); I.ustKi();
  J.mod = 'start'; document.exitPointerLock?.();
  startMutat();
  coopPanel.mutat().then(() => coopPanel.allapot('A szoba bezárult. A közös állás külön elmentve, a saját mentésed érintetlen.'));
}

// ================================================================ kezdőképernyő
function startMutat() {
  const m = legujabbMentes();
  $('start').classList.remove('ki');
  $('start').querySelector('.tolt').hidden = true;
  $('start').querySelector('.gombok').hidden = false;
  if (J.ui?.el) J.ui.el.style.display = 'none';
  const f = $('folytatas');
  f.hidden = !m;
  if (m) $('folytatas-al').textContent = `${m.meta?.nap ?? '?'}. nap, ${m.meta?.ora ?? ''} · ${m.meta?.rang ?? ''}`;
  $('uj').innerHTML = 'Új játék';
  $('uj').dataset.biztos = '';
  (m ? f : $('uj')).focus({ preventScroll: true });
}
$('uj').addEventListener('click', async () => {
  const b = $('uj');
  if (legujabbMentes() && !b.dataset.biztos) { b.dataset.biztos = '1'; b.innerHTML = 'Új játék<small>A régi mentés az első alváskor felülíródik. Még egy kattintás.</small>'; return; }
  hang.unlock(); hang.listener(camera);
  renderer.domElement.requestPointerLock?.();
  await ujJatek();
});
$('folytatas').addEventListener('click', async () => {
  const m = legujabbMentes(); if (!m) return;
  hang.unlock(); hang.listener(camera);
  renderer.domElement.requestPointerLock?.();
  try { await indit(Empire.load(m.adat), m.jatek); } catch (e) { console.warn('[betöltés]', e.message); await ujJatek(); }
});
startMutat();
/** Egérzár a kattintás gesztusából (az új Chrome ígéretet ad; elutasítás — pl. fej nélkül — ne legyen kezeletlen hiba). */
const egerZarKattintasra = () => { try { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch (e) { /* */ } };
const coopPanel = kezdoPanel($('start'), {
  nyit: (url, nev, lista) => coopNyit(url, nev, {}, lista),
  indul: () => { hang.unlock(); hang.listener(camera); egerZarKattintasra(); return coopIndit(); },
  megse: () => { const v = coopVar; coopVar = null; return v?.coop.kilep(); },
  belep: async (url, kod, nev) => {
    hang.unlock(); hang.listener(camera); egerZarKattintasra();
    try { await coopBelep(url, kod, nev); } catch (e) { document.exitPointerLock?.(); throw e; }
  },
  hostInfo: () => { const m = legujabbMentes(); return m ? `A mentésed jön: ${m.meta?.nap ?? '?'}. nap` : 'Új birodalommal indultok'; },
});
$('kozos').addEventListener('click', () => coopPanel.mutat());

// ================================================================ fő hurok
let setPosT = 0, utolsoJarmu = null, promptSzoveg = null;
function step(dt) {
  if (J.mod !== 'jatek') return;
  const E = J.E, ui = J.ui;
  const modal = ui.isOpen(), menu = modal && ui.modal?.fajta === 'menu';
  const szunet = menu || J.buszNyitva;
  if (!szunet || J.coop) E.step(dt);   // közös játékban az idő nem áll meg a szünetben (mindenkié)
  J.S = E.state;
  // bemenet → interakció (felület vagy busz-menü nyitva: a játék nem kap gombot)
  let cel = null;
  if (!modal && !J.buszNyitva && !J.zarolva && !I.ust) {
    cel = jarmuvek.vezet ? null : I.celzott();
    if (bemenet.most('KeyE') && cel && I.vegrehajt(cel, 'E', bemenet.van('ShiftLeft', 'ShiftRight'))) bemenet.lenyomva.delete('KeyE');
    if (bemenet.most('KeyR') && cel) I.vegrehajt(cel, 'R');
    J.S = E.state;   // a művelet után friss pillanatkép (pl. az üst most indult)
  }
  $('cross').classList.toggle('cel', !!cel);
  jatekos.zarolva = modal || !!I.ust || J.zarolva || !!J.buszNyitva;
  if (jatekos.zarolva) bemenet.lenyomva.delete('KeyE');
  if (!jarmuvek.vezet) jatekos.update(dt);
  if (!modal && !J.buszNyitva) I.ustUpdate(dt);
  if (!modal && !J.zarolva && !J.buszNyitva) jarmuvek.update(dt);
  else if (jarmuvek.vezet) { jarmuvek.vezet.update(dt, null); jarmuvek.kameraAllit(dt); }
  // a sim tudja, min közlekedsz (a motozásnál a rejtett csomagtér számít)
  const jt = jarmuvek.vezet?.tipus || null;
  if (jt !== utolsoJarmu) {
    utolsoJarmu = jt;
    if (jt === 'bicikli') E.useVehicle('bicikli');
    else if (jt === 'auto') { const id = ['furgon', 'traktor', 'kocka'].find(x => E.s.jarmuvek.includes(x)); if (id) E.useVehicle(id); }
    else E.s.jarmu = 'gyalog';
  }
  const p = J.jatekosPoz();
  npc.jatekosPoz = p;
  npc.update(dt, camera.position);
  J.sz.update(dt);
  J.kj?.update(dt);   // közös játék: a saját hely ki, a többiek figurája be
  for (let i = J.tweenek.length - 1; i >= 0; i--) { const t = J.tweenek[i]; t.t += dt; const a = Math.min(1, t.t / t.dur); t.f(a); if (a >= 1) { J.tweenek.splice(i, 1); t.kesz?.(); } }
  V.update(dt, (J.S.ido.perc % 1440) / 60, camera.position, camera);
  G?.update(dt, (J.S.ido.perc % 1440) / 60);
  tanyaLatvany(dt);
  hangLep(dt);
  setPosT += dt;
  if (setPosT > 0.5) { setPosT = 0; E.setPlayerPos(p.x, p.z); ui.setPlayer(p.x, p.z); }
  const sz = I.ust ? '' : I.szoveg(cel);
  if (sz !== promptSzoveg) { promptSzoveg = sz; ui.prompt(sz); }
  ui.update(dt);
  // kamerarázás (kifutás, bírság), jelenet-felirat
  if (J.razasA > 0) { const a = J.razasA * 0.03; camera.rotation.x += (Math.random() - 0.5) * a; camera.rotation.y += (Math.random() - 0.5) * a; J.razasA = Math.max(0, J.razasA - dt * H.razasLecseng); }
  if (J.feliratT > 0) { J.feliratT -= dt; if (J.feliratT <= 0) $('jelenet').classList.remove('be'); }
  J.T.step(dt);   // történet: tutorial, jelenetek, reggeli Hírmondó
}
function render() { renderer.info.reset(); if (G) G.render(); else renderer.render(scene, camera); cimkek(); }
addEventListener('keydown', e => {
  if (J.sz?.buszBillentyu(e.code)) { e.preventDefault(); bemenet.lenyomva.delete(e.code); }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt); render();
  bemenet.kockaVege();
  requestAnimationFrame(frame);
}
if (!TEST) requestAnimationFrame(frame);
else render();

// ================================================================ tesztkampók (Playwright: tools/probe_jatek.py, tools/jatek_kepek.py)
window.__teszt = {
  J, V, I, G, jatekos, jarmuvek, npc, hang, betoltes: J.betoltes,
  get E() { return J.E; }, get ui() { return J.ui; }, get sz() { return J.sz; },
  /** Új játék (seed), vagy a legutóbbi mentés folytatása. */
  async uj(seed = 7) { await ujJatek(seed); this.lep(0.05); return true; },
  async folytat() { const m = legujabbMentes(); if (!m) return false; await indit(Empire.load(m.adat), m.jatek); this.lep(0.05); return true; },
  /** Közös játék: szobát nyit (új birodalom, seed) és indul; visszaad: a szobakód. */
  async coopHost(url, nev = 'Házigazda', seed = 7) { const kod = await coopNyit(url, nev, { uj: true, seed }); await coopIndit(); this.lep(0.05); return kod; },
  /** Közös játék: belép a kódú szobába, és indul vendégként. */
  async coopCsatlakozik(url, kod, nev = 'Vendég') { await coopBelep(url, kod, nev); this.lep(0.05); return true; },
  /** A közös játék állapota (szoba, játékosok, a társ-figurák). */
  coop() {
    const c = J.coop; if (!c) return null;
    return { kod: c.kod, szerep: c.szerep, allapot: c.allapot, te: c.te, rtt: c.rtt, jatekosok: c.jatekosok.map(j => ({ id: j.id, nev: j.nev, host: j.host, online: j.online, en: j.en })),
      tarsak: J.kj?.allapot() || [], meta: c.meta };
  },
  coopPanel: () => coopPanel,
  ment: () => ment(),
  idougras: () => J.idougras(),
  /** A játékos (gyalog) helye és nézése fokban. */
  hely(x, z, yaw = 0, pitch = 0, rajz = true) { J.hely(x, z, yaw, pitch); J.S = J.E.state; if (rajz) render(); return [jatekos.pos.x, jatekos.pos.y, jatekos.pos.z]; },
  /** Állás (x, z), nézés a (tx, ty, tz) pontra. */
  nez(x, z, tx, ty, tz) { const y = V.talaj(x, z) + 1.65, dx = tx - x, dy = ty - y, dz = tz - z; return this.hely(x, z, Math.atan2(-dx, -dz) * 180 / Math.PI, Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI); },
  /** Idő léptetése 30 Hz-es lépésekkel (valós mp), utána egy rajzolás. */
  lep(sec, rajz = true) { const n = Math.max(1, Math.round(sec * 30)); for (let i = 0; i < n; i++) { step(1 / 30); bemenet.kockaVege(); } if (rajz) render(); },
  /** Gombnyomás (pl. 'KeyE'): egy lépés alatt lenyomva, vagy dur mp-ig nyomva tartva. */
  gomb(code, dur = 0, rajz = false) { bemenet.keys.add(code); bemenet.lenyomva.add(code); if (dur) this.lep(dur, false); else { step(1 / 30); bemenet.kockaVege(); } bemenet.keys.delete(code); if (rajz) render(); return this.allapot(); },
  /** A játékidő a mai nap adott órájára (előre léptetve; ha már elmúlt, a következő napra). */
  ora(h) { const E = J.E, most = E.now(), cel = Math.floor(most / 1440) * 1440 + h * 60; E.advance(cel >= most ? cel - most : cel + 1440 - most); J.idougras(); this.lep(0.05); return E.clock(); },
  celzott() { const c = I.celzott(); return c ? { kind: c.userData.kind, ...Object.fromEntries(Object.entries(c.userData).filter(([k, v]) => typeof v !== 'object')) } : null; },
  prompt: () => I.szoveg(I.celzott()),
  allapot() {
    const S = J.E.state, p = J.jatekosPoz();
    return { ido: S.ido.szoveg, perc: S.ido.perc, kp: S.penz.kp, szamla: S.penz.szamla, nalad: S.nalad, ust: !!I.ust, keziUst: !!S.keziUst, jarmu: jarmuvek.vezet?.tipus || null,
      x: p.x, z: p.z, regio: J.regioId(), modal: J.ui.isOpen(), jelenet: J.sz.jelenet?.tipus || null, jarorok: J.sz.jarorok.size, vevok: J.sz.vevok.size, uiValodi: J.uiValodi,
      gyanu: Object.fromEntries(S.regiok.map(r => [r.id, r.gyanu])), stat: S.stat };
  },
  /** A kamera r méteres körében járó gyalogosok elrejtése (a képen ne takarjon előtérben figura). */
  npcTavol(r = 9) { const c = camera.position; for (const n of npc.lista) { if (n.tipus !== 'gyalogos') continue; n.rejt = Math.hypot(n.obj.position.x - c.x, n.obj.position.z - c.z) < r; if (n.rejt) n.obj.visible = false; } render(); },
  beszall(tipus) { const r = jarmuvek.beszall(tipus, true); this.lep(0.05); return r; },
  kiszall() { jarmuvek.kiszall(true); this.lep(0.05); },
  kameraMod(m) { jarmuvek.kameraMod = m; jarmuvek.update(0); render(); },
  render, step,
  drawCalls() { render(); return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
  fps(n = 20) {
    const gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    render(); sync();
    const t = performance.now(); for (let i = 0; i < n; i++) { step(1 / 60); render(); sync(); }
    const ms = (performance.now() - t) / n; return { fps: Math.round(1000 / ms * 10) / 10, ms: Math.round(ms * 10) / 10 };
  },
  /**
   * Előtér-takarás mérése: sugárrács a kamerából (nx × ny), az r méteren belüli találatok közül a fa / bokor / lámpás
   * aránya az összes sugárhoz képest. Fa: a 'fa:' és 'bokor:' rétegek, a tanya gyümölcsfái és a csemeték; lámpás: a kapu két lámpása.
   */
  takaras(r = 12, nx = 64, ny = 36) {
    camera.updateMatrixWorld(); scene.updateMatrixWorld();
    const ray = new THREE.Raycaster(); ray.far = r;
    const FAK = [[-7, 5], [-2.5, 8.5], [4.5, 6.5]], LAMPAK = [[-2.3, 12.2], [2.3, 12.2]];
    const celok = scene.children.filter(o => o.visible && !o.isLight);
    let fa = 0, lampa = 0, ossz = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      ossz++;
      ray.setFromCamera(new THREE.Vector2((i + 0.5) / nx * 2 - 1, (j + 0.5) / ny * 2 - 1), camera);
      const h = ray.intersectObjects(celok, true).find(x => { const m = x.object.material; return !(m && m.transparent && m.opacity === 0) && x.object.visible; });
      if (!h) continue;
      let nev = '';
      for (let o = h.object; o; o = o.parent) if (o.name && /^(fa|bokor|kozep|kis|epulet|din):/.test(o.name)) { nev = o.name.split(':')[0]; break; }
      const p = h.point;
      const tanyaFa = FAK.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 2.6 && p.y > 0.4);
      const lamp = LAMPAK.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 0.7);
      let csemete = false; for (let o = h.object; o; o = o.parent) if (o.userData?.kind === 'fa') { csemete = true; break; }
      if (nev === 'fa' || nev === 'bokor' || tanyaFa || csemete) fa++;
      else if (lamp) lampa++;
    }
    return { fa: fa / ossz, lampa: lampa / ossz, osszesen: (fa + lampa) / ossz, sugarak: ossz };
  },
};
Object.assign(window.__teszt, J.T.tesztKampok({ render }));   // történet: introIndit/introLep/introUgrik, tutorialAllapot, jelenetInditas…
window.__kesz = true;
