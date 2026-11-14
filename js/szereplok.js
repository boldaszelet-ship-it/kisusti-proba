// Kisüsti — a világ élő szereplői és pontjai, a sim állapotából: vevőtalálkozók (a vevő megjelenik és vár az időablakban),
// kóstolók, beszállítói szállítmányok a leadási ponton, terjesztők, a pénzügyőr-járőr az úthálón (a sim `patrol`
// eseményéből), motozás és házkutatás látható jelenettel, buszmegállók (fizetős gyorsutazás), eladó ingatlanok és
// üzletek táblája, gyümölcsös-helyek (csemete → fa → termés), a megvett ingatlanok főzőhelye (üst, hordó, asztal).
import { palackozo } from './vilag/palackozo.js';
import * as THREE from 'three';
import { prop } from './vilag/betolto.js';
import { fruitObj, hitProxy } from './vilag/tanya.js';
import { ut } from './npc.js';
import { NODES, ROADS, PROPERTIES, BUSINESSES, SUPPLIERS, REGIONS } from '../data/regions.js';
import { TERJESZTOK, TORVENY, GYUMOLCSOK, CIKKEK, REGIO_TALALKOZOK, TALALKOZOK } from '../data/tartalom.js';
import { TIME_SCALE, hu, ft } from '../sim.js';
import { utana } from './ui/elemek.js';

const HANGOLAS = {
  vevoElore: 20,          // játékperc: ennyivel az ablak előtt már ott áll
  vevoSetal: 3.2,         // mp: ennyi alatt sétál be a helyére
  motozasTav: 10,         // m: a járőrautó ennyire közel → megállít (előtted 7–9 m-re fékez le)
  motozasTavAllo: 45,     // m: ha a járőr áll a játékos mögötti dugóban (előtte, ugyanazon a sávon), ennyiről is kiszáll
  motozasGyanu: 40,       // ha nincs nálad semmi, csak ekkora regionális gyanúnál állít meg
  jarorSeb: TORVENY.jarorSebesseg,
  buszAlap: 15, buszPerMeter: 0.05,       // játékperc
  buszFt: 300, buszFtPerMeter: 1,
  hangTav: 260,           // m: a járőrmotor-hurok ezen belül szól
};
export { HANGOLAS as SZEREPLO_HANGOLAS };

const ADJ = {};
for (const [a, b] of ROADS) { (ADJ[a] ||= []).push(b); (ADJ[b] ||= []).push(a); }
const hashIdx = (s, n = 8) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % n; };
const ora = p => { const m = Math.floor(((p % 1440) + 1440) % 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const easeOut = a => 1 - (1 - a) * (1 - a);
/** Klónozás a célzási hivatkozások (userData.root) nélkül: az Object3D.clone JSON-másolja a userData-t, a körkörös
 *  hivatkozás végtelen rekurzió lenne. */
function klon(o) {
  const ment = [];
  o.traverse(x => { if (x.userData.root) { ment.push([x, x.userData.root]); delete x.userData.root; } });
  const c = o.clone(true);
  for (const [x, r] of ment) x.userData.root = r;
  return c;
}

/** Felirat-tábla (vászontextúra) egy oszlopon: ELADÓ, BUSZ. */
function tabla(szoveg, al, szin = '#c8392b') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#f3ead6'; c.fillRect(0, 0, 256, 160);
  c.strokeStyle = szin; c.lineWidth = 10; c.strokeRect(8, 8, 240, 144);
  c.fillStyle = szin; c.font = 'bold 54px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(szoveg, 128, al ? 66 : 80);
  if (al) { c.fillStyle = '#3a2a1e'; c.font = '24px Georgia, serif'; c.fillText(al, 128, 118); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  const g = new THREE.Group();
  const lap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.56, 0.04), [0, 0, 0, 0, 1, 1].map(i => i ? new THREE.MeshLambertMaterial({ map: tx }) : new THREE.MeshLambertMaterial({ color: 0x6b4a30 })));
  lap.position.y = 1.55; lap.castShadow = true; g.add(lap);
  const oszlop = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0x5a3e28 }));
  oszlop.position.y = 0.8; oszlop.castShadow = true; g.add(oszlop);
  return g;
}
/** Buszmegálló-tábla: zöld kör alakú tábla buszjellel, oszlopon (felirat nélkül). */
function buszTabla() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#1f6b45'; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f2ead8'; c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1f6b45';
  c.fillRect(30, 40, 68, 40); c.fillRect(34, 80, 8, 10); c.fillRect(86, 80, 8, 10);
  c.fillStyle = '#f2ead8'; c.fillRect(36, 46, 16, 14); c.fillRect(56, 46, 16, 14); c.fillRect(76, 46, 16, 14);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const lap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 24), [new THREE.MeshLambertMaterial({ color: 0x1f6b45 }), new THREE.MeshLambertMaterial({ map: tx }), new THREE.MeshLambertMaterial({ map: tx })]);
  lap.rotation.x = Math.PI / 2; lap.position.y = 2.25; lap.castShadow = true; g.add(lap);
  const oszlop = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8), new THREE.MeshLambertMaterial({ color: 0x9a9a96 }));
  oszlop.position.y = 1.15; oszlop.castShadow = true; g.add(oszlop);
  return g;
}

export class Szereplok {
  constructor(J) {
    this.J = J;
    this.vevok = new Map();       // rendelés-id → {n, L, fazis, t, from, to, ry}
    this.kostolok = new Map();    // vevő-id → {n, L}
    this.ladak = new Map();       // szállítmány-id → {obj, L}
    this.jarorok = new Map();     // sim járőr-id → {n, hang, motozva}
    this.terjesztok = [];
    this.tablak = {};             // 'ingatlan:id' | 'uzlet:id' → {obj, L}
    this.megallok = [];           // {id, nev, x, z, regio}
    this.slotok = {};             // propId → [{x, z, obj, fa, gyumolcsok[], L, proxy}]
    this.uzemek = {};             // propId → {ustok:[obj], ...}
    this.jelenet = null;          // motozás / házkutatás
    this.pecsetek = {};           // propId → szalag-háló
    this.t = 0;
    this._spot = {};
  }
  get E() { return this.J.E; }
  get V() { return this.J.V; }

  // ------------------------------------------------------------ segédek
  celoz(obj, data) {
    obj.userData = { ...obj.userData, ...data };
    obj.traverse(o => { o.userData.root = obj; });
    this.J.celok.push(obj); return obj;
  }
  celTorol(obj) { const i = this.J.celok.indexOf(obj); if (i >= 0) this.J.celok.splice(i, 1); obj.userData.kind = 'gone'; }
  talaj(x, z) { return this.V.talaj(x, z); }
  szabad(x, z, r = 0.6) { return !this.V.utk.inside(x, z, r) && !this.V.vizben(x, z); }
  /** Egy útcsomópont melletti szabad hely (az út szélén, oldalra d méterre), arccal az út felé. */
  oldalHely(node, d = 4.2, elcsuszas = 0) {
    const kulcs = node + '|' + d + '|' + elcsuszas;
    if (this._spot[kulcs]) return this._spot[kulcs];
    const [nx, nz] = NODES[node];
    const nb = ADJ[node]?.[0];
    let dx = 1, dz = 0;
    if (nb) { dx = NODES[nb][0] - nx; dz = NODES[nb][1] - nz; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; }
    const px = -dz, pz = dx;
    let best = null;
    outer: for (const k of [0, 3, -3, 6, -6, 10, -10]) for (const s of [1, -1]) for (const dd of [d, d + 2, d + 4]) {
      const x = nx + dx * (k + elcsuszas) + px * s * dd, z = nz + dz * (k + elcsuszas) + pz * s * dd;
      if (this.szabad(x, z, 0.7) && Math.abs(this.talaj(x, z) - this.talaj(nx, nz)) < 1.6) { best = { x, z }; break outer; }
    }
    if (!best) best = { x: nx + px * d, z: nz + pz * d };
    best.ry = Math.atan2(nx - best.x, nz - best.z);
    return (this._spot[kulcs] = best);
  }
  /** Egy vevő/kóstoló helye a csomópontnál. A tanya kapujánál: a kapunyílásban, arccal az udvar felé. */
  talalkozoHely(node, i = 0) {
    if (node === 'kapu') return [{ x: 0.9, z: 13.9, ry: Math.PI }, { x: -0.9, z: 14.2, ry: Math.PI }, { x: 3.4, z: 13.8, ry: Math.PI }][i % 3];
    return this.oldalHely(node, 4.2, i * 2.2);
  }
  figura(x, z, ry, idx) {
    const n = this.J.npc.allo(x, z, ry, idx);
    n.obj.position.y = this.talaj(x, z);
    return n;
  }
  figuraTorol(n) { if (n && this.J.npc.lista.includes(n)) this.J.npc.torol(n); }
  /** A pénzügyőr: sötétzöld tányérsapkás figura. */
  penzugyor(x, z, ry, id = 'penzugyor') {
    const n = this.figura(x, z, ry, id);
    if (n.obj.userData.szereplo) return n;   // az új figurának saját tányérsapkája és zubbonya van
    const sapka = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: 0x23402f });
    const tet = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.09, 14), m); tet.position.y = 0.05; sapka.add(tet);
    const ell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 14), new THREE.MeshLambertMaterial({ color: 0x14140f })); ell.position.set(0, 0.0, 0.07); ell.scale.set(1, 1, 0.8); sapka.add(ell);
    const jel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.01), new THREE.MeshLambertMaterial({ color: 0xd8b34a, emissive: 0x302008 })); jel.position.set(0, 0.06, 0.16); sapka.add(jel);
    sapka.position.y = 1.71; sapka.traverse(o => { if (o.isMesh) o.castShadow = true; });
    n.obj.add(sapka);
    return n;
  }
  /** Séta: a figura a megadott pontra megy (walk), utána áll (idle), arccal ry felé. */
  setal(n, x, z, dur, ryVeg, kesz) {
    const o = n.obj;
    n.seta = { fx: o.position.x, fz: o.position.z, tx: x, tz: z, t: 0, dur, ryVeg, kesz };
    o.userData.anim('walk');
  }
  _setaLep(n, dt) {
    const s = n.seta; if (!s) return;
    s.t += dt;
    const a = Math.min(1, s.t / s.dur);
    const o = n.obj;
    o.position.x = s.fx + (s.tx - s.fx) * a; o.position.z = s.fz + (s.tz - s.fz) * a;
    o.position.y = this.talaj(o.position.x, o.position.z);
    const iry = Math.atan2(s.tx - s.fx, s.tz - s.fz);
    n.ry0 = a < 1 ? iry : (s.ryVeg ?? iry);
    if (a < 1) o.rotation.y = iry;   // séta közben nem tekinget körbe (az álló figura ringatását felülírjuk)
    if (a >= 1) { n.seta = null; o.userData.anim('idle'); s.kesz?.(); }
  }

  // ------------------------------------------------------------ felépítés
  epit() {
    const J = this.J, V = this.V, T = V.tanya;
    // a tanya gyümölcsei: fánként 3 (a TREES sorrendje = a sim kertjének 0–2. helye)
    T.fruits.forEach((f, i) => { f.userData.slot = Math.floor(i / 3); f.userData.prop = 'tanya'; });
    // keverőasztal (a pajta munkapadja) és palackozó (a nagy láda üvegekkel)
    { const g = new THREE.Group(); g.position.set(9.7, T.pajtaY ?? 0, -5.4); J.scene.add(g); hitProxy(g, 0.9, 0.9); this.celoz(g, { kind: 'kever', prop: 'tanya' }); J.cimke(g, 'KEVERŐASZTAL', 1.9, 13); }
    {
      const g = new THREE.Group(); g.position.set(4.0, T.pajtaY ?? 0, -5.6); J.scene.add(g);
      g.add(palackozo());   // saját modell (vilag/palackozo.js), a régi Kenney-láda + óriásüvegek helyett
      hitProxy(g, 0.9, 0.8); this.celoz(g, { kind: 'palack', prop: 'tanya' }); J.cimke(g, 'PALACKOZÓ', 2.15, 13);
    }
    this._slotokTanya();
    this._terjesztok();
    this._beszallitok();
    this._megallok();
    this._tablak();
    // az eladó kisautó (a sim „kocka” járműve) a tanya előtt
    const auto = J.jarmuvek.lista.find(v => v.tipus === 'auto');
    if (auto) { this.autoElado = auto; hitProxy(auto.obj, 1.6, 0.8); }
    this.jarmuSzinkron();
  }
  /** A sim járművei → a világ járművei: a bicikli a nagyapáé, az autó csak megvéve vezethető. */
  jarmuSzinkron() {
    const J = this.J, S = J.S, a = this.autoElado; if (!a) return;
    const van = S.jarmuvek.sajat.some(id => id === 'kocka' || id === 'traktor' || id === 'furgon');
    const benne = J.jarmuvek.lista.includes(a);
    if (van && !benne) { J.jarmuvek.lista.push(a); this.celTorol(a.obj); a.obj.userData.kind = null; }
    if (!van && benne) { J.jarmuvek.lista.splice(J.jarmuvek.lista.indexOf(a), 1); }
    if (!van && !J.celok.includes(a.obj)) this.celoz(a.obj, { kind: 'jarmu_elado' });
  }

  // ------------------------------------------------------------ gyümölcsös
  _slotokTanya() {
    const T = [[-7, 5], [-2.5, 8.5], [4.5, 6.5], [9.2, 2.8], [11.6, 6.2], [9.0, 9.4]];
    this.slotok.tanya = T.map(([x, z], i) => this._slot('tanya', i, x, z, i < 3));
  }
  _slotokProp(id) {
    const P = PROPERTIES.find(p => p.id === id); if (!P.kert || this.slotok[id]) return;
    const a = this.V.anchors[id]?.position || new THREE.Vector3(P.pos[0], 0, P.pos[1]);
    const out = [];
    // szabad helyek az ingatlan körül, 4,5 m-es rácsban, a horgonytól 8–30 m-re
    const jel = [];
    for (let r = 8; r <= 34 && jel.length < P.kert; r += 4.5)
      for (let k = 0; k < 24 && jel.length < P.kert; k++) {
        const ang = k / 24 * Math.PI * 2 + r * 0.3, x = a.x + Math.cos(ang) * r, z = a.z + Math.sin(ang) * r;
        if (!this.szabad(x, z, 1.6) || jel.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4)) continue;
        if (Math.abs(this.talaj(x, z) - this.talaj(a.x, a.z)) > 3) continue;
        const f = this.V.felulet(x, z); if (f === 1 || f === 2 || f === 9 || f === 13) continue;   // úton, burkolaton nem
        jel.push([x, z]);
      }
    jel.forEach(([x, z], i) => out.push(this._slot(id, i, x, z, false)));
    this.slotok[id] = out;
  }
  _slot(prop, i, x, z, regiFa) {
    const J = this.J, g = new THREE.Group(); g.position.set(x, this.talaj(x, z), z); J.scene.add(g);
    const s = { prop, i, x, z, g, regiFa, fa: null, gyumolcsok: [], allapot: null };
    if (!regiFa) {
      // üres hely: felásott földkupac karóval
      const kup = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5c4330 }));
      kup.scale.y = 0.22; kup.receiveShadow = true; g.add(kup); s.kupac = kup;
      const karo = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a48 }));
      karo.position.set(0.18, 0.6, 0.05); karo.castShadow = true; g.add(karo); s.karo = karo;
    }
    const pr = hitProxy(g, regiFa ? 0.55 : 0.8, regiFa ? 1.0 : 0.4); pr.scale.y = regiFa ? 2.2 : 1;
    this.celoz(g, { kind: 'fa', prop, slot: i });
    s.L = J.cimke(g, '', regiFa ? 0 : 1.5, 13);
    if (regiFa) s.L.text = '';
    return s;
  }
  /** A fák látványa a sim kertjéből: csemete mérete a kor szerint, gyümölcs, ha érett. */
  _slotFrissit() {
    const S = this.J.S;
    for (const [prop, lista] of Object.entries(this.slotok)) {
      const P = S.ingatlanok.find(p => p.id === prop); if (!P?.owned) continue;
      for (const s of lista) {
        const f = P.fak[s.i];
        const allapot = !f ? 'ures' : `${f.gyumolcs}|${Math.min(GYUMOLCSOK[f.gyumolcs].erik, f.kor)}|${f.termes >= 0.5 ? Math.min(3, Math.ceil(f.termes / (GYUMOLCSOK[f.gyumolcs].kg * 0.55))) : 0}`;
        if (s.regiFa) {
          // a tanya régi fái: a gyümölcs a vilag/tanya.js tárgya
          const db = f && f.termes >= 0.5 ? Math.min(3, Math.max(1, Math.ceil(f.termes / (GYUMOLCSOK[f.gyumolcs].kg * 0.55)))) : 0;
          this.V.tanya.fruits.forEach((o, k) => { if (Math.floor(k / 3) === s.i) o.visible = (k % 3) < db; });
          continue;
        }
        if (allapot === s.allapot) continue;
        s.allapot = allapot;
        if (s.fa) { s.g.remove(s.fa); s.fa = null; }
        s.gyumolcsok = [];
        if (!f) { s.kupac.visible = true; s.karo.visible = true; s.L.text = 'ÜRES HELY'; continue; }
        const G = GYUMOLCSOK[f.gyumolcs], n = Math.min(1, f.kor / G.erik);
        s.kupac.visible = n < 0.5; s.karo.visible = n < 0.8;
        const fa = new THREE.Group();
        prop('nature-kit/tree_fat', 0, 0, 0, 0.7 + 2.6 * n, s.i * 1.3, fa);
        if (f.termes >= 0.5) {
          const db = Math.min(3, Math.max(1, Math.ceil(f.termes / (G.kg * 0.55))));
          const gy = ['szilva', 'barack', 'korte'].includes(f.gyumolcs) ? f.gyumolcs : 'szilva';
          for (let k = 0; k < db; k++) { const a = 0.6 + k * 2.1; s.gyumolcsok.push(fruitObj(this.V.ctx, gy, Math.cos(a) * 1.2, 1.9, Math.sin(a) * 1.1, 1.5, fa)); }
        }
        s.g.add(fa); s.fa = fa;
        if (n >= 0.5 && !s.utk) { s.utk = true; this.V.utk.kor(s.x, s.z, 0.3); }   // a megnőtt fa törzse már akadály
        s.L.text = n < 1 ? `${G.gyumolcs.toUpperCase()}CSEMETE` : '';
      }
    }
  }
  /** Szüretkor a gyümölcs a kamera felé röppen és eltűnik (100 ms-on belül látható válasz). */
  szuretEffekt(prop, slot) {
    const J = this.J;
    const lista = prop === 'tanya' && slot < 3 ? this.V.tanya.fruits.filter((o, k) => Math.floor(k / 3) === slot && o.visible) : (this.slotok[prop]?.[slot]?.gyumolcsok || []);
    for (const o of lista) {
      const c = klon(o); const p = new THREE.Vector3(); o.getWorldPosition(p);
      c.position.copy(p); J.scene.add(c); o.visible = false;
      J.tweenek.push({ t: 0, dur: 0.35, f: a => { const e = easeOut(a); c.position.lerpVectors(p, J.camera.position.clone().add(new THREE.Vector3(0, -0.5, 0)), e); c.scale.setScalar(1 - 0.8 * e); }, kesz: () => c.removeFromParent() });
    }
    if (this.slotok[prop]?.[slot]) this.slotok[prop][slot].allapot = null;
  }

  // ------------------------------------------------------------ terjesztők, beszállítók, megállók, táblák
  _terjesztok() {
    const V = this.V;
    const HELY = { postas: 'posta', buszsofor: 'buszmegallo', hentes: null, fodrasz: null, pinceor: null, traktoros: null, pultos: 'foter' };
    const NODE = { hentes: 'felveg_kp', fodrasz: 'felveg_le', pinceor: 'hegy_kp', traktoros: 'major_kp', pultos: 'kv_kp' };
    TERJESZTOK.forEach((d, i) => {
      let x, z, ry;
      const a = HELY[d.id] && V.anchors[HELY[d.id]];
      if (a) {
        const p = a.position;
        for (const [ox, oz] of [[1.6, 1.4], [-1.6, 1.4], [2.4, -1.2], [-2.4, -1.2], [0, 2.6]]) if (this.szabad(p.x + ox, p.z + oz, 0.5)) { x = p.x + ox; z = p.z + oz; break; }
        if (x == null) { x = p.x + 1.5; z = p.z + 1.5; }
        ry = Math.atan2(p.x - x, p.z - z) + Math.PI;
      } else { const h = this.oldalHely(NODE[d.id], 5.5, 4); x = h.x; z = h.z; ry = h.ry; }
      const n = this.figura(x, z, ry, d.id);
      hitProxy(n.obj, 0.6, 0.9);
      this.celoz(n.obj, { kind: 'terjeszto', id: d.id });
      const L = this.J.cimke(n.obj, d.nev, 2.3, 13);
      this.terjesztok.push({ id: d.id, n, L });
    });
  }
  _beszallitok() {
    for (const s of SUPPLIERS) {
      const a = this.V.anchors[s.id]; if (!a) continue;
      const g = new THREE.Group(); g.position.copy(a.position); this.J.scene.add(g);
      hitProxy(g, 1.1, 1.0); this.celoz(g, { kind: 'beszallito', id: s.id, nev: s.nev });
      this.J.cimke(g, s.nev, 2.6, 13);
    }
  }
  _megallok() {
    const V = this.V, J = this.J;
    const lista = [];
    const a = V.anchors.buszmegallo;
    if (a) lista.push({ id: 'falu', nev: 'Kisüstfalva, a buszváró', regio: 'falu', x: a.position.x, z: a.position.z, sajat: false });
    for (const [id, node, nev] of [['tanya', 'kapu', 'A tanya, a Fő út'], ['felveg', 'felveg_kp', 'Felvég, a kút'], ['szolohegy', 'hegy_kp', 'Szőlőhegy, a pincesor'], ['major', 'major_kp', 'A régi major'], ['kisvaros', 'kv_kp', 'Kisváros, az állomás']]) {
      const h = id === 'tanya' ? { x: -6.5, z: 21.2, ry: Math.PI } : this.oldalHely(node, 4.6, -8);
      lista.push({ id, nev, regio: id, x: h.x, z: h.z, ry: h.ry, sajat: true });
    }
    for (const m of lista) {
      const g = m.sajat ? buszTabla() : new THREE.Group();
      g.position.set(m.x, this.talaj(m.x, m.z), m.z); if (m.ry != null) g.rotation.y = m.ry; J.scene.add(g);
      if (m.sajat) this.V.utk.kor(m.x, m.z, 0.15);
      hitProxy(g, 0.9, 1.2); this.celoz(g, { kind: 'busz', megallo: m.id });
      J.cimke(g, 'BUSZ', 2.7, 13);
      this.megallok.push(m);
    }
  }
  _tablak() {
    for (const p of PROPERTIES) if (p.ar > 0) this._tabla('ingatlan', p.id, p.pos);
    for (const b of BUSINESSES) this._tabla('uzlet', b.id, b.pos);
    this.tablaSzinkron();
  }
  _tabla(fajta, id, pos) {
    const a = this.V.anchors[id]?.position || new THREE.Vector3(pos[0], 0, pos[1]);
    let x = a.x, z = a.z;
    for (const [ox, oz] of [[2.2, 1.2], [-2.2, 1.2], [2.2, -1.2], [-2.2, -1.2], [0, 2.4], [3.4, 0], [-3.4, 0]]) if (this.szabad(a.x + ox, a.z + oz, 0.4)) { x = a.x + ox; z = a.z + oz; break; }
    const g = tabla('ELADÓ', fajta === 'ingatlan' ? 'ingatlan' : 'üzlet');
    g.position.set(x, this.talaj(x, z), z);
    { let bn = null, bd = 1e9; for (const [k, q] of Object.entries(NODES)) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < bd) { bd = d; bn = q; } } g.rotation.y = Math.atan2(bn[0] - x, bn[1] - z); }
    this.J.scene.add(g);
    hitProxy(g, 0.8, 1.3); this.celoz(g, { kind: fajta, id });
    const L = this.J.cimke(g, '', 2.3, 13);
    this.tablak[fajta + ':' + id] = { g, L, fajta, id };
  }
  tablaSzinkron() {
    const S = this.J.S;
    for (const t of Object.values(this.tablak)) {
      const sajat = t.fajta === 'ingatlan' ? S.ingatlanok.find(p => p.id === t.id)?.owned : S.uzletek.find(b => b.id === t.id)?.sajat;
      if (sajat && t.g.parent) { t.g.removeFromParent(); this.celTorol(t.g); t.L.text = ''; }
      if (!sajat) { const nev = t.fajta === 'ingatlan' ? S.ingatlanok.find(p => p.id === t.id).nev : S.uzletek.find(b => b.id === t.id).nev; t.L.text = nev; }
    }
    for (const p of S.ingatlanok) if (p.owned && p.id !== 'tanya' && !this.uzemek[p.id]) this._uzem(p.id);
  }
  vasarlas(fajta, id) {
    this.tablaSzinkron();
    if (fajta === 'ingatlan') this.J.uzen('A tiéd. A kulcs a lábtörlő alatt. Az üst már a helyén.');
  }

  /** A megvett ingatlan főzőhelye: üst(ök), hordó, keverőasztal, palackozó, pinceajtó — a horgony mellett, szabad helyen. */
  _uzem(id) {
    const J = this.J, P = PROPERTIES.find(p => p.id === id), a = this.V.anchors[id]?.position || new THREE.Vector3(P.pos[0], 0, P.pos[1]);
    let bx = null, bz = null;
    for (let r = 5; r <= 30 && bx == null; r += 2.5) for (let k = 0; k < 16; k++) {
      const ang = k / 16 * Math.PI * 2, x = a.x + Math.cos(ang) * r, z = a.z + Math.sin(ang) * r;
      let ok = true;
      for (const [ox, oz] of [[0, 0], [-3, 0], [3, 0], [0, 2.5], [-3, 2.5], [3, 2.5]]) if (!this.szabad(x + ox, z + oz, 1.0)) { ok = false; break; }
      if (ok && Math.abs(this.talaj(x, z) - this.talaj(a.x, a.z)) < 2) { bx = x; bz = z; break; }
    }
    if (bx == null) { bx = a.x + 6; bz = a.z; }
    const y = this.talaj(bx, bz), ry = Math.atan2(a.x - bx, a.z - bz);
    const g = new THREE.Group(); g.position.set(bx, y, bz); g.rotation.y = ry; J.scene.add(g);
    const U = { g, ustok: [] };
    const db = Math.min(2, P.ustok);
    for (let i = 0; i < db; i++) {
      const s = klon(this.V.tanya.still);
      s.position.set(-1.6 + i * 3.2, 0, 0); s.rotation.y = 0; g.add(s);
      s.userData = {}; s.traverse(o => { o.userData = {}; });
      this.celoz(s, { kind: 'ust', prop: id, ustIdx: i });
      U.ustok.push(s);
    }
    const hordo = new THREE.Group(); hordo.position.set(-3.6, 0, 2.6); g.add(hordo);
    prop('survival-kit/barrel', 0, 0, 0, 3.8, 0, hordo); prop('survival-kit/barrel', 1.1, 0, 0.3, 3.8, 0.7, hordo);
    this.celoz(hordo, { kind: 'hordo2', prop: id });
    const asztal = new THREE.Group(); asztal.position.set(0.2, 0, 2.8); g.add(asztal);
    prop('survival-kit/workbench', 0, 0, 0, 3.0, Math.PI, asztal); hitProxy(asztal, 0.9, 0.9);
    this.celoz(asztal, { kind: 'kever', prop: id });
    const lada = new THREE.Group(); lada.position.set(3.4, 0, 2.6); g.add(lada);
    prop('survival-kit/box-large', 0, 0, 0, 2.6, 0.2, lada);
    for (let k = 0; k < 4; k++) prop(k % 2 ? 'food-kit/wine-red' : 'food-kit/bottle-oil', -0.3 + k * 0.18, 1.02, 0, 1.05, k, lada);
    hitProxy(lada, 0.9, 0.8); this.celoz(lada, { kind: 'palack', prop: id });
    const ajto = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.2), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
    ajto.position.set(5.4, 0.12, 0.4); ajto.castShadow = ajto.receiveShadow = true; g.add(ajto);
    this.celoz(ajto, { kind: 'pince2', prop: id });
    g.updateMatrixWorld(true);
    const w = new THREE.Vector3();
    for (const s of U.ustok) { s.getWorldPosition(w); this.V.utk.kor(w.x, w.z, 0.9); J.cimke(s, 'ÜST', 2.5); }
    hordo.getWorldPosition(w); this.V.utk.kor(w.x, w.z, 0.9); J.cimke(hordo, 'HORDÓK', 1.7);
    asztal.getWorldPosition(w); this.V.utk.kor(w.x, w.z, 0.8); J.cimke(asztal, 'KEVERŐASZTAL', 1.9, 13);
    lada.getWorldPosition(w); this.V.utk.kor(w.x, w.z, 0.7); J.cimke(lada, 'PALACKOZÓ', 1.8, 13);
    J.cimke(ajto, 'PINCE', 0.8);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.uzemek[id] = U;
    this._slotokProp(id);
  }
  /** Az ingatlan üstjeinek világbeli helye (hang, füst). */
  ustHelyek() {
    const out = [{ prop: 'tanya', idx: 0, obj: this.V.tanya.still }];
    for (const [id, U] of Object.entries(this.uzemek)) U.ustok.forEach((s, i) => out.push({ prop: id, idx: i, obj: s }));
    return out;
  }

  // ------------------------------------------------------------ busz
  buszMenu(honnan) {
    const J = this.J, S = J.S, el = document.getElementById('busz');
    const m0 = this.megallok.find(m => m.id === honnan);
    const sor = this.megallok.filter(m => m.id !== honnan).map((m, i) => {
      const len = this._utHossz([m0.x, m0.z], [m.x, m.z]);
      const perc = Math.round(HANGOLAS.buszAlap + len * HANGOLAS.buszPerMeter), ar = Math.round((HANGOLAS.buszFt + len * HANGOLAS.buszFtPerMeter) / 10) * 10;
      const nyitva = S.regiok.find(r => r.id === m.regio)?.nyitva;
      return { m, perc, ar, nyitva, i };
    });
    this.busz = { honnan, sor };
    el.innerHTML = `<h3>BUSZ · ${m0.nev}</h3><div class="b-al">Hová? Számbillentyű vagy kattintás. Esc: mégse.</div>` +
      sor.map(s => `<button data-i="${s.i}" ${s.nyitva ? '' : 'disabled'}><b>${s.i + 1}</b><span>${s.m.nev}</span><small>${s.nyitva ? `${s.perc} perc · ${ft(s.ar)}` : 'még nem a te vidéked'}</small></button>`).join('');
    el.classList.add('be');
    J.menuNyitva(true);
    el.onclick = e => { const b = e.target.closest('button[data-i]'); if (b && !b.disabled) this.buszUt(+b.dataset.i); };
  }
  buszZar() { document.getElementById('busz').classList.remove('be'); this.busz = null; this.J.menuNyitva(false); }
  buszBillentyu(code) {
    if (!this.busz) return false;
    if (code === 'Escape' || code === 'KeyE') { this.buszZar(); return true; }
    const d = /^(Digit|Numpad)([1-9])$/.exec(code);
    if (d) { const s = this.busz.sor.find(x => x.i === +d[2] - 1); if (s?.nyitva) this.buszUt(s.i); return true; }
    return false;
  }
  _utHossz(a, b) { const p = ut(a, b); let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
  buszUt(i) {
    const J = this.J, E = this.E, s = this.busz?.sor.find(x => x.i === i); if (!s) return;
    return utana(E.payFare(s.ar), r => {
      if (!r.ok) { J.uzen(`A jegy ${ft(s.ar)}. Nincs ennyi a zsebedben.`, true); return; }
      this.buszZar();
      J.hang.play('penz_erme', { vol: 0.6 });
      J.fade(() => {
        // közös játékban az út nem ugratja az időt (az mindenkié); csak odavisz
        if (!J.coop) E.advance(s.perc);
        const m = s.m;
        J.hely(m.x + Math.sin((m.ry ?? 0) + Math.PI) * 1.6, m.z + Math.cos((m.ry ?? 0) + Math.PI) * 1.6, ((m.ry ?? 0) + Math.PI) * 180 / Math.PI);
        J.idougras();
        J.uzen(J.coop ? `Megérkeztél: ${m.nev}. (${ft(s.ar)})` : `Megérkeztél: ${m.nev}. (${s.perc} perc, ${ft(s.ar)})`);
      }, 0.6);
    });
  }

  // ------------------------------------------------------------ a sim eseményei
  esemeny(e) {
    switch (e.type) {
      case 'patrol': {
        this._jarorIndul(e.jaror);
        // a járőr oka olvasható: a játékos tettéből fakad (füst, eladás, kifutott üst), nem óraütésből
        const S = this.J.S, r = S.regiok.find(x => x.id === e.jaror.regio);
        const ok = e.jaror.razzia ? 'házkutatás: a gyanú elérte a 100-at (füst, eladások)' : e.jaror.ejjeli ? 'éjjel füstölt a kéményed' : `a gyanú itt ${r?.gyanu ?? '?'} (füst, eladások)`;
        this.J.uzen(`Fehér szolgálati autó indult ${r ? 'a ' + r.nev + ' felé' : ''}. Oka: ${ok}.`, true);
        break;
      }
      case 'raid': this._razzia(e); break;
      case 'sale': {
        const v = e.rendeles && this.vevok.get(e.rendeles);
        if (v) { v.n.obj.userData.anim('jump'); v.orom = 0.9; this.J.cimkeTorol(v.L); v.L = null; }
        break;
      }
      case 'unlock': if (e.mit === 'ingatlan' || e.mit === 'uzlet' || e.mit === 'jarmu') { this.tablaSzinkron(); this.jarmuSzinkron(); } break;
    }
  }

  // ------------------------------------------------------------ frissítés
  update(dt) {
    this.t += dt;
    const S = this.J.S;
    for (const n of this._setalok()) this._setaLep(n, dt);
    if (this._t2 == null || this.t - this._t2 > 0.25) {
      this._t2 = this.t;
      this._vevokFrissit(S); this._kostolokFrissit(S); this._ladakFrissit(S); this._slotFrissit(); this._jarorSzinkron(S); this._pecsetek(S);
      this._terjesztoCimkek(S);
    }
    for (const [id, v] of this.vevok) {
      if (v.orom > 0) { v.orom -= dt; if (v.orom <= 0) this._vevoEl(id, v); }
    }
    this._jarorok(dt, S);
    this._jelenetLep(dt);
  }
  *_setalok() { for (const v of this.vevok.values()) yield v.n; for (const v of this.kostolok.values()) yield v.n; if (this.jelenet) for (const n of this.jelenet.figurak) yield n; }

  // ---- vevők a találkozón
  _vevokFrissit(S) {
    const most = S.ido.perc, kell = new Map();
    for (const r of S.rendelesek) if (r.allapot === 'elfogadva' && most >= r.ablak[0] - HANGOLAS.vevoElore && most <= r.ablak[1]) kell.set(r.id, r);
    for (const [id, v] of this.vevok) if (!kell.has(id) && !v.megy && !(v.orom > 0)) this._vevoEl(id, v);
    let i = 0;
    for (const [id, r] of kell) {
      if (this.vevok.has(id)) { const v = this.vevok.get(id); if (v.L) v.L.text = this._vevoFelirat(r, most); continue; }
      this._vevoJon(r, i++);
    }
  }
  _vevoFelirat(r, most) {
    const varj = most < r.ablak[0] ? `\n${ora(r.ablak[0])}-tól` : `\n${ora(r.ablak[1])}-ig`;
    return `${r.nev}\n${this.E.wishText(r)}${varj}`;
  }
  _vevoJon(r, i) {
    const h = this.talalkozoHely(r.hely, [...this.vevok.values()].filter(v => v.hely === r.hely && !v.megy).length);
    const ax = h.x + Math.sin(h.ry + Math.PI / 2) * 9, az = h.z + Math.cos(h.ry + Math.PI / 2) * 9;
    const indul = this.szabad(ax, az, 0.3) ? [ax, az] : [h.x + 6, h.z];
    const n = this.figura(indul[0], indul[1], h.ry, r.vevo);
    hitProxy(n.obj, 0.6, 0.9);
    this.celoz(n.obj, { kind: 'vevo', rendeles: r.id });
    this.setal(n, h.x, h.z, HANGOLAS.vevoSetal, h.ry);
    const L = this.J.cimke(n.obj, this._vevoFelirat(r, this.J.S.ido.perc), 2.35, 14);
    this.vevok.set(r.id, { n, L, hely: r.hely, megy: false, orom: 0 });
  }
  _vevoEl(id, v) {
    v.megy = true;
    this.celTorol(v.n.obj);
    if (v.L) { this.J.cimkeTorol(v.L); v.L = null; }
    const o = v.n.obj.position, ry = v.n.ry0 + Math.PI / 2;   // az út szélén, oldalra sétál el (nem vág át az úton)
    this.setal(v.n, o.x + Math.sin(ry) * 14, o.z + Math.cos(ry) * 14, 6, ry, () => { this.figuraTorol(v.n); this.vevok.delete(id); });
  }

  // ---- kóstolók: a még nem vevő, de kóstolható falusiak a régió második találkozóján
  _kostolokFrissit(S) {
    const kell = new Map(), regiDb = {};
    for (const v of S.vevok) {
      if (v.allapot === 'aktiv' || !v.kostolhato) continue;
      const nyitva = S.regiok.find(r => r.id === v.regio)?.nyitva; if (!nyitva) continue;
      regiDb[v.regio] = (regiDb[v.regio] || 0) + 1; if (regiDb[v.regio] > 2) continue;
      kell.set(v.id, { v, k: regiDb[v.regio] - 1 });
    }
    for (const [id, k] of this.kostolok) if (!kell.has(id)) { this.celTorol(k.n.obj); this.J.cimkeTorol(k.L); this.figuraTorol(k.n); this.kostolok.delete(id); }
    for (const [id, { v, k }] of kell) {
      if (this.kostolok.has(id)) continue;
      const helyek = REGIO_TALALKOZOK[v.regio] || ['kapu'];
      const node = helyek[helyek.length - 1];
      const h = node === 'kapu' ? { x: -12 - k * 2.2, z: 20.6, ry: Math.PI } : this.oldalHely(node, 6.5, 4 + k * 2.4);
      const n = this.figura(h.x, h.z, h.ry, id);
      hitProxy(n.obj, 0.6, 0.9);
      this.celoz(n.obj, { kind: 'kostolo', vevo: id, nev: v.nev });
      const L = this.J.cimke(n.obj, `${v.nev}\nmegkóstolná`, 2.35, 13);
      this.kostolok.set(id, { n, L });
    }
  }

  // ---- szállítmányok a leadási ponton
  _ladakFrissit(S) {
    const kell = new Map(S.szallitmanyok.filter(d => d.allapot === 'megerkezett').map(d => [d.id, d]));
    for (const [id, l] of this.ladak) if (!kell.has(id)) this.ladaFel(id);
    let i = 0;
    for (const [id, d] of kell) {
      if (this.ladak.has(id)) continue;
      const h = d.hely === 'kapu' ? { x: -3.2 - i * 1.4, z: 13.2 } : this.oldalHely(d.hely, 3.4, -3 - i * 1.5);
      const g = new THREE.Group(); g.position.set(h.x, this.talaj(h.x, h.z), h.z); g.rotation.y = 0.3 + i; this.J.scene.add(g);
      const C = CIKKEK[d.tetel];
      prop(C?.tipus === 'gyumolcs' ? 'survival-kit/box-open' : 'survival-kit/box', 0, 0, 0, 2.2, 0, g);
      if (C?.tipus === 'gyumolcs') for (let k = 0; k < 4; k++) fruitObj(this.V.ctx, ['szilva', 'barack', 'korte'].includes(C.gy) ? C.gy : 'szilva', -0.2 + (k % 2) * 0.4, 0.62, -0.15 + Math.floor(k / 2) * 0.3, 1.2, g);
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      hitProxy(g, 0.7, 0.5);
      const felirat = `${d.db} × ${C?.nev || d.tetel}`;
      this.celoz(g, { kind: 'szallitmany', id, felirat });
      const L = this.J.cimke(g, `SZÁLLÍTMÁNY\n${felirat}`, 1.3, 13);
      this.ladak.set(id, { g, L }); i++;
    }
  }
  ladaFel(id) {
    const l = this.ladak.get(id); if (!l) return;
    this.ladak.delete(id); this.celTorol(l.g); this.J.cimkeTorol(l.L);
    const g = l.g, s0 = g.scale.x;
    this.J.tweenek.push({ t: 0, dur: 0.25, f: a => g.scale.setScalar(s0 * (1 - easeOut(a))), kesz: () => g.removeFromParent() });
  }

  _terjesztoCimkek(S) {
    for (const t of this.terjesztok) {
      const d = S.terjesztok.find(x => x.id === t.id); if (!d) continue;
      t.L.text = d.lebukva ? `${d.nev}\nlebukott` : d.felveve ? `${d.nev}\n${hu(d.keszletL, 1)} l nála · ${ft(d.kp)}` : d.elerheto ? `${d.nev}\nterjesztőnek állna` : d.nev;
    }
  }

  // ---- pecsét az üstön (házkutatás után 24 óra)
  _pecsetek(S) {
    for (const u of this.ustHelyek()) {
      const P = S.ingatlanok.find(p => p.id === u.prop), on = (P?.ustok[u.idx]?.pecset || 0) > 0;
      const k = u.prop + ':' + u.idx;
      if (on && !this.pecsetek[k]) {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 16;
        const c = cv.getContext('2d'); for (let x = 0; x < 256; x += 32) { c.fillStyle = '#c8261e'; c.fillRect(x, 0, 16, 16); c.fillStyle = '#f4f0e6'; c.fillRect(x + 16, 0, 16, 16); }
        const tx = new THREE.CanvasTexture(cv); tx.wrapS = THREE.RepeatWrapping; tx.repeat.set(3, 1); tx.colorSpace = THREE.SRGBColorSpace;
        const sz = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.12, 28, 1, true), new THREE.MeshLambertMaterial({ map: tx, side: THREE.DoubleSide }));
        sz.position.y = 1.05; sz.rotation.z = 0.08; u.obj.add(sz);
        const sz2 = sz.clone(); sz2.position.y = 0.72; sz2.rotation.z = -0.1; u.obj.add(sz2);
        this.pecsetek[k] = [sz, sz2];
      } else if (!on && this.pecsetek[k]) { for (const m of this.pecsetek[k]) m.removeFromParent(); delete this.pecsetek[k]; }
    }
  }

  // ------------------------------------------------------------ pénzügyőr-járőr
  _jarorIndul(j, kezdoPts = null) {
    if (this.jarorok.has(j.id)) return;
    const pts = kezdoPts || j.pts.map(p => [p[0], p[1]]);
    if (pts.length < 2) return;
    const n = this.J.npc.jaror(pts, { seb: HANGOLAS.jarorSeb, kesz: () => { const x = this.jarorok.get(j.id); x?.hang?.stop(); this.jarorok.delete(j.id); } });
    n.obj.userData.jaror = j.id;
    this.jarorok.set(j.id, { n, hang: null, motozva: false, max: n.max });
  }
  /** A sim járőrei és a világ autói egyeznek-e (alvás, busz, betöltés után újraépül a sim helyéből). */
  _jarorSzinkron(S, eros = false) {
    const elo = new Map(S.jarorok.map(j => [j.id, j]));
    const cam = this.J.camera.position;
    for (const [id, x] of this.jarorok) {
      if (eros || (!elo.has(id) && Math.hypot(x.n.obj.position.x - cam.x, x.n.obj.position.z - cam.z) > 120)) {
        if (this.jelenet?.car === x) continue;
        x.hang?.stop(); if (this.J.npc.lista.includes(x.n)) this.J.npc.torol(x.n); this.jarorok.delete(id);
      }
    }
    if (!eros) return;
    for (const j of S.jarorok) {
      // a hátralévő útvonal a sim mostani helyétől
      const most = S.ido.perc; let i = 1; while (i < j.t.length && j.t[i] < most) i++;
      if (i >= j.t.length) continue;
      this._jarorIndul(j, [j.pos, ...j.pts.slice(i)]);
    }
  }
  ujraszinkron() { this._jarorSzinkron(this.J.S, true); this.tablaSzinkron(); this.jarmuSzinkron(); for (const l of Object.values(this.slotok)) for (const s of l) s.allapot = null; }
  _jarorok(dt, S) {
    const J = this.J, cam = J.camera.position, p = J.jatekosPoz();
    for (const [id, x] of this.jarorok) {
      const o = x.n.obj, d = Math.hypot(o.position.x - cam.x, o.position.z - cam.z);
      // motor: csak közelben szól (Doppler a hangmotorban)
      if (d < HANGOLAS.hangTav && !x.hang) x.hang = J.hang.loop('motor_penzugyor', { pos: o, doppler: true, rpm: 0.3, gaz: 0.4, vol: 0.9 });
      if (d > HANGOLAS.hangTav + 20 && x.hang) { x.hang.stop(); x.hang = null; }
      if (x.hang) x.hang.set({ rpm: 0.08 + Math.min(1, x.n.seb / 16) * 0.6, gaz: x.n.seb < x.max * 0.8 ? 0.6 : 0.3 });
      // motozás: ha a járőr eléri a játékost (nálad van valami, vagy nagy a gyanú), megáll és megmotoz
      // (ha a járőr egy, a játékos előtt fékező civil autó mögött ragadt, onnan száll ki: álló autónál nagyobb a sugár)
      const rx = p.x - o.position.x, rz = p.z - o.position.z, ry = o.rotation.y;
      const elol = rx * Math.sin(ry) + rz * Math.cos(ry), oldal = Math.abs(rx * Math.cos(ry) - rz * Math.sin(ry));
      const dugoban = x.n.seb < 0.5 && elol > 0 && elol < HANGOLAS.motozasTavAllo && oldal < 4;
      if (!x.motozva && !this.jelenet && !J.ust() && (dugoban || Math.hypot(rx, rz) < HANGOLAS.motozasTav)) {
        const reg = J.regioId();
        const gyanu = S.regiok.find(r => r.id === reg)?.gyanu || 0;
        if (S.nalad > 0.005 || gyanu >= HANGOLAS.motozasGyanu) { x.motozva = true; this._motozas(x); }
        else x.motozva = true;   // tiszta zseb, kis gyanú: továbbmegy
      }
    }
  }

  // ------------------------------------------------------------ jelenetek
  _motozas(x) {
    const J = this.J, car = x.n, p = J.jatekosPoz();
    car.max = 0;   // lefékez (a járművezetés 8 m/s²-es lassításával)
    J.hang.play('fek', { pos: car.obj.position.clone() });
    if (J.jarmuvek.vezet) J.jarmuvek.vezet.seb *= 0.2;
    J.zar(true);
    const S = J.S, gy = S.regiok.find(r => r.id === J.regioId())?.gyanu || 0;
    J.felirat('MOTOZÁS', `„Jó napot. A Hivataltól. Mi van a csomagban?” — ${S.nalad > 0.005 ? `${hu(S.nalad, 1)} l pálinka van nálad` : `a környéken ${gy} a gyanú`}`);
    const o = car.obj.position;
    const ox = o.x + Math.cos(car.obj.rotation.y) * 1.3, oz = o.z - Math.sin(car.obj.rotation.y) * 1.3;
    const pu = this.penzugyor(ox, oz, 0);
    const dx = p.x - ox, dz = p.z - oz, L = Math.hypot(dx, dz) || 1;
    const cx = p.x - dx / L * 1.3, cz = p.z - dz / L * 1.3;
    this.jelenet = { tipus: 'motozas', t: 0, figurak: [pu], car: x, fazis: 0, eredmeny: null };
    setTimeout(() => J.hang.play('ajto_csapas', { pos: [ox, 1, oz] }), 700);
    this.setal(pu, cx, cz, 1.6, Math.atan2(dx, dz), () => {});
  }
  _razzia(e) {
    const J = this.J, P = PROPERTIES.find(p => p.id === e.prop); if (!P) return;
    const a = this.V.anchors[e.prop]?.position || new THREE.Vector3(P.pos[0], 0, P.pos[1]);
    const p = J.jatekosPoz(), kozel = Math.hypot(p.x - a.x, p.z - a.z) < 90;
    if (this.jelenet) this._jelenetVege();
    // az autó a kapu előtt (tanya: a Fő úton), két pénzügyőr bemegy az üsthöz
    const ust = this.ustHelyek().find(u => u.prop === e.prop);
    const cel = new THREE.Vector3(); (ust?.obj || this.V.anchors[e.prop]).getWorldPosition(cel);
    const autoP = e.prop === 'tanya' ? [3.5, 17.4] : [a.x + 4, a.z + 3];
    const car = this.J.npc.jaror([[autoP[0] - 0.1, autoP[1]], autoP], { seb: 0.01, sav: 0 });
    car.obj.rotation.y = -Math.PI / 2; car.var = 1e9;
    const f1 = this.penzugyor(autoP[0] - 1.5, autoP[1] - 1.8, Math.PI), f2 = this.penzugyor(autoP[0] + 0.2, autoP[1] - 2.0, Math.PI, 'penzugyor2');
    const t1 = e.prop === 'tanya' ? [1.2, 10.5] : null;
    const menj = (f, pont, cx, cz) => this.setal(f, pont[0], pont[1], 3.5, 0, () => this.setal(f, cx, cz, 4.5, Math.atan2(cel.x - cx, cel.z - cz)));
    menj(f1, t1 || [cel.x - 2, cel.z + 3], cel.x - 1.2, cel.z + 1.8);
    menj(f2, t1 ? [-0.8, 10.8] : [cel.x + 2, cel.z + 3], cel.x + 1.4, cel.z + 1.6);
    // éjjel zseblámpa: emisszív fénykúp (új fényforrás nélkül, a shaderek nem fordulnak újra)
    if (!J.S.ido.nappal) for (const f of [f1, f2]) {
      const kup = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      kup.rotation.x = -Math.PI / 2 - 0.25; kup.position.set(0.25, 1.1, 2.4); f.obj.add(kup);
    }
    if (kozel) {
      J.hang.jelenet('penzugyor', { pos: [autoP[0], 0.7, autoP[1]], kapu: [cel.x, 0, cel.z] });
      J.felirat('HÁZKUTATÁS', (e.talalt ? `Találtak: ${(e.okok || []).join(', ')}.` : '„Na, itt minden rendben. Egyelőre.”') + ' Oka: a gyanú 100 volt (füst, eladások).', 6);
    }
    this.jelenet = { tipus: 'razzia', t: 0, figurak: [f1, f2], autoN: car, hossz: 26 };
  }
  _jelenetLep(dt) {
    const j = this.jelenet; if (!j) return;
    const J = this.J;
    j.t += dt;
    if (j.tipus === 'motozas') {
      const pu = j.figurak[0];
      // a kamera a pénzügyőrre fordul
      const p = J.camera.position, o = pu.obj.position;
      J.nezRa(o.x, this.talaj(o.x, o.z) + 1.5, o.z, dt);
      if (j.fazis === 0 && j.t > 2.6) {
        j.fazis = 1;
        utana(this.E.searchPlayer(), r => {
          j.eredmeny = r;
          if (!r.talalt) J.felirat('MOTOZÁS', '„Jó utat. És vigyázzon, sok a vad az úton.”', 2.5);
          else { J.felirat('MOTOZÁS', `„Bizonyítéknak.” Bírság: ${ft(r.birsag)}`, 3.5); J.razas(0.6); }
        });
      }
      if (j.fazis === 1 && j.t > (j.eredmeny?.talalt ? 5.2 : 4.4)) {
        j.fazis = 2;
        J.zar(false);
        const c = j.car.n.obj.position;
        this.setal(pu, c.x + 0.8, c.z + 0.8, 1.4, 0, () => { this.figuraTorol(pu); j.figurak = []; j.car.n.max = j.car.max; J.hang.play('ajto_csapas', { pos: [c.x, 1, c.z] }); this.jelenet = null; });
      }
    } else if (j.tipus === 'razzia') {
      if (j.t > j.hossz && !j.ki) {
        j.ki = true;
        const c = j.autoN.obj.position;
        let kesz = 0;
        for (const f of j.figurak) this.setal(f, c.x - 0.6, c.z - 1.2, 5, 0, () => { this.figuraTorol(f); if (++kesz === j.figurak.length) this._jelenetVege(); });
      }
    }
  }
  _jelenetVege() {
    const j = this.jelenet; if (!j) return;
    for (const f of j.figurak) this.figuraTorol(f);
    if (j.autoN) { j.autoN.var = 0; j.autoN.max = 11; j.autoN.pts = [[j.autoN.obj.position.x, j.autoN.obj.position.z], [j.autoN.obj.position.x - 60, j.autoN.obj.position.z]]; j.autoN.i = 1; }
    if (j.tipus === 'motozas') { j.car.n.max = j.car.max; this.J.zar(false); }
    this.jelenet = null;
  }
}
