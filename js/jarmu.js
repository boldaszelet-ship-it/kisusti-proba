// Kisüsti — vezethető járművek: bicikli (saját modell, első kosárral) és márka nélküli kisautó (Kenney Car Kit
// hatchback, palettacserével). Beszállás/kiszállás E-vel, kameraváltás C-vel (bicikli: belső / közeli külső;
// autó: közeli külső / motorháztető). Árkád kezelés: kinematikus kerékpármodell, felület szerinti tapadás,
// lejtő, rugózás, ütközés falnak (visszapattanás + kamerarázás).
import * as THREE from 'three';
import { prop, MODELS, mergeItems } from './vilag/betolto.js';
import { recolor, isTeal, mat } from './vilag/paletta.js';
import { TAPADAS } from './vilag/adat.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const SPEC = {
  auto: { L: 1.9, W: 1.45, hossz: 3.15, maxSeb: 25, gyors: 4.6, fek: 10, hatra: 6, motorfek: 1.6, maxKorm: 0.62, kormSeb: 2.6, gurul: 0.25, kerekR: 0.33, beszallTav: 3.2 },
  bicikli: { L: 1.05, W: 0.5, hossz: 1.75, maxSeb: 7.4, sprint: 9.6, gyors: 2.3, fek: 6.5, hatra: 1.2, motorfek: 0.35, maxKorm: 0.55, kormSeb: 2.4, gurul: 0.12, kerekR: 0.34, beszallTav: 2.2 },
};

// ---------------------------------------------------------------- modellek
/** A kisautó: Kenney hatchback, a zöld karosszéria krémszínre (a hetvenes évek kisautói), márkajel nélkül. */
function autoModell() {
  const g = new THREE.Group();
  const m = prop('car-kit/hatchback-sports', 0, 0, 0, 1.12);
  recolor(m, { nev: 'kisauto', rules: [[isTeal, [214, 196, 150], [79, 184, 130]]] });
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(m);
  const kerek = {};
  m.traverse(o => { if (o.name?.startsWith('wheel-')) kerek[o.name] = o; });
  // a hátsó szárnyat (spoiler) a krém kisautóhoz nem illik: a karosszéria hátsó felső részét nem bántjuk,
  // csak a rendszámtábla-helyre egy üres, fehér tábla kerül (felirat nélkül)
  return { g, kerek, model: m };
}
/** Bicikli: klasszikus falusi „csepel”-forma, sárvédő, csomagtartó, fonott első kosár egy üveggel. */
function biciklModell() {
  const g = new THREE.Group();
  const vaz = mat(0x2d5e4a, { roughness: 0.45, metalness: 0.3 }), krom = mat(0xc9ccd0, { roughness: 0.3, metalness: 0.8 }), gumi = mat(0x1c1c1c, { roughness: 0.9 }), bor = mat(0x5a3a22, { roughness: 0.7 }), krem = mat(0xe8dfc8, { roughness: 0.6 });
  const cso = (a, b, r, m) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), m); me.position.copy(A).add(B).multiplyScalar(0.5);
    me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); me.castShadow = true; g.add(me); return me;
  };
  const kerekek = [];
  for (const z of [-0.53, 0.53]) {
    const w = new THREE.Group(); w.position.set(0, 0.34, z); g.add(w);
    const gum = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.026, 8, 32), gumi); gum.rotation.y = Math.PI / 2; gum.castShadow = true; w.add(gum);
    const felni = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.011, 6, 32), krom); felni.rotation.y = Math.PI / 2; w.add(felni);
    for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.58, 4), krom); s.rotation.x = k / 8 * Math.PI; w.add(s); }
    const agy = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), krom); agy.rotation.z = Math.PI / 2; w.add(agy);
    // sárvédő (íves) a kerék fölött
    const sv = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.028, 4, 20, Math.PI * 0.62), vaz); sv.rotation.y = Math.PI / 2; sv.rotation.x = z < 0 ? 0.25 : 0.9; sv.position.copy(w.position);
    g.add(sv);
    kerekek.push(w);
  }
  const R = [0, 0.34, -0.53], F = [0, 0.34, 0.53], BB = [0, 0.3, -0.06], ST = [0, 0.86, -0.22], HT = [0, 0.9, 0.36], HB = [0, 0.7, 0.41];
  cso(BB, ST, 0.019, vaz); cso(BB, HB, 0.022, vaz); cso([0, 0.82, -0.2], [0, 0.78, 0.38], 0.018, vaz);
  for (const x of [-0.05, 0.05]) { cso([x, 0.34, -0.53], [0, 0.3, -0.06], 0.011, vaz); cso([x, 0.34, -0.53], [0, 0.84, -0.21], 0.011, vaz); cso([x, 0.34, 0.53], [0, 0.72, 0.41], 0.013, krom); }
  cso(HB, HT, 0.02, vaz);
  // kormány
  const korm = new THREE.Group(); korm.position.set(0, 0.9, 0.36); g.add(korm);
  const kk = (a, b, r, m) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B); const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), m); me.position.copy(A).add(B).multiplyScalar(0.5); me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); korm.add(me); return me; };
  kk([0, 0, 0], [0, 0.16, -0.04], 0.014, krom); kk([-0.3, 0.17, -0.12], [0.3, 0.17, -0.12], 0.012, krom);
  kk([-0.3, 0.17, -0.12], [-0.36, 0.17, -0.22], 0.012, krom); kk([0.3, 0.17, -0.12], [0.36, 0.17, -0.22], 0.012, krom);
  for (const x of [-0.37, 0.37]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.11, 8), bor); m.position.set(x, 0.17, -0.26); m.rotation.x = Math.PI / 2; korm.add(m); }
  // csengő
  { const c = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), krom); c.position.set(0.2, 0.19, -0.12); korm.add(c); }
  // fonott kosár a kormány előtt, benne egy üveg
  const kosar = new THREE.Group(); kosar.position.set(0, 0.06, 0.16); korm.add(kosar);
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const c = cv.getContext('2d');
  c.fillStyle = '#9a6e3c'; c.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 6) for (let x = 0; x < 64; x += 8) { c.fillStyle = (x / 8 + y / 6) % 2 ? '#c49456' : '#7a5228'; c.fillRect(x + ((y / 6) % 2) * 4, y, 6, 4); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 1);
  const fon = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9, side: THREE.DoubleSide });
  for (const [w, h, d, x, y, z] of [[0.36, 0.2, 0.01, 0, 0, -0.13], [0.36, 0.2, 0.01, 0, 0, 0.13], [0.01, 0.2, 0.26, -0.18, 0, 0], [0.01, 0.2, 0.26, 0.18, 0, 0], [0.36, 0.01, 0.26, 0, -0.1, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fon); b.position.set(x, y, z); b.castShadow = true; kosar.add(b);
  }
  if (MODELS['food-kit/bottle-oil']) { const u = prop('food-kit/bottle-oil', 0.06, -0.09, 0.02, 0.62); kosar.add(u); }
  // nyereg, nyeregcső, csomagtartó, hajtómű, pedálok
  cso([0, 0.84, -0.21], [0, 0.95, -0.24], 0.013, krom);
  { const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), bor); s.scale.set(0.95, 0.38, 1.45); s.position.set(0, 0.98, -0.25); s.castShadow = true; g.add(s); }
  cso([-0.08, 0.78, -0.58], [0.08, 0.78, -0.58], 0.008, krom); cso([-0.08, 0.78, -0.3], [-0.08, 0.78, -0.62], 0.008, krom); cso([0.08, 0.78, -0.3], [0.08, 0.78, -0.62], 0.008, krom);
  cso([-0.08, 0.78, -0.62], [-0.05, 0.34, -0.53], 0.007, krom); cso([0.08, 0.78, -0.62], [0.05, 0.34, -0.53], 0.007, krom);
  const lanc = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20), krom); lanc.rotation.y = Math.PI / 2; lanc.position.set(0.06, 0.3, -0.06); g.add(lanc);
  const hajto = new THREE.Group(); hajto.position.set(0, 0.3, -0.06); g.add(hajto);
  for (const s of [-1, 1]) {
    const kar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.025), krom); kar.position.set(s * 0.09, s * 0.075, 0); hajto.add(kar);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), gumi); ped.position.set(s * 0.14, s * 0.155, 0); hajto.add(ped);
  }
  // első lámpa (krém) és hátsó prizma
  { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 12), krem); l.rotation.x = Math.PI / 2; l.position.set(0, 0.76, 0.47); g.add(l); }
  { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.01), mat(0xb3261e, { emissive: 0x400000 })); p.position.set(0, 0.72, -0.64); g.add(p); }
  // kitámasztó
  const tamasz = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), krom); tamasz.position.set(-0.1, 0.17, -0.12); tamasz.rotation.z = 0.5; g.add(tamasz);
  // a sok kis alkatrész anyagonként egy hálóba (a bicikli 60+ rajzhívás helyett ~12)
  for (const grp of [g, korm, kosar, hajto, ...kerekek]) osszevon(grp, [tamasz]);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, kerekek, korm, hajto, tamasz };
}

/** Egy csoport közvetlen gyerek-hálóinak összevonása anyagonként (a csoporthoz képest álló részek). */
function osszevon(grp, kiveve = []) {
  const by = new Map();
  for (const c of [...grp.children]) {
    if (!c.isMesh || kiveve.includes(c)) continue;
    c.updateMatrix();
    const k = c.material.uuid; if (!by.has(k)) by.set(k, { mat: c.material, items: [] });
    by.get(k).items.push({ geo: c.geometry, m: c.matrix.clone() }); grp.remove(c);
  }
  for (const { mat: m, items } of by.values()) { const me = new THREE.Mesh(mergeItems(items), m); me.castShadow = true; grp.add(me); }
}

/** A sofőr/kerékpáros figura (Kenney mini-character, ülő póz). */
function sofor(key = 'mini-characters/character-male-a') {
  const src = MODELS[key]; if (!src) return null;
  const o = SkeletonUtils.clone(src.scene); o.scale.setScalar(2.3);
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(o);
  const clip = src.animations.find(a => a.name === 'sit'); if (clip) { const a = mixer.clipAction(clip); a.play(); }
  mixer.update(0.01);
  return { o, mixer };
}

// ---------------------------------------------------------------- jármű
export class Jarmu {
  constructor(V, scene, tipus, x, z, yaw) {
    this.V = V; this.tipus = tipus; this.S = SPEC[tipus];
    this.x = x; this.z = z; this.yaw = yaw; this.seb = 0; this.korm = 0; this.pitch = 0; this.roll = 0; this.y = V.talaj(x, z); this.yv = 0;
    this.obj = new THREE.Group(); this.obj.name = 'jarmu:' + tipus; scene.add(this.obj);
    this.test = new THREE.Group(); this.obj.add(this.test);
    if (tipus === 'auto') { const m = autoModell(); this.test.add(m.g); this.kerek = m.kerek; }
    else { const m = biciklModell(); this.test.add(m.g); this.bk = m; }
    // az autóban nem ültetünk figurát (a Kenney-karosszéria sötét üvege mögött a fej átszúrná a tetőt)
    const s = tipus === 'bicikli' ? sofor() : null; if (s) { this.sofor = s; s.o.visible = false; this.test.add(s.o); if (tipus === 'auto') s.o.position.set(0.3, 0.12, -0.15); else { s.o.position.set(0, 0.42, -0.34); } }
    this.lean = 0; this.pedal = 0; this.razas = 0; this.parkol = true;
    this.allit(0);
  }
  /** Talajra igazítás: négy keréknél mért magasság → bólintás, dőlés. */
  talajra(dt, rug = true) {
    const S = this.S, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const t = (a, b) => this.V.talaj(this.x + fx * a + rx * b, this.z + fz * a + rz * b);
    const hl = S.L / 2, hw = S.W / 2;
    const yF = (t(hl, -hw) + t(hl, hw)) / 2, yB = (t(-hl, -hw) + t(-hl, hw)) / 2, yL = (t(hl, -hw) + t(-hl, -hw)) / 2, yR = (t(hl, hw) + t(-hl, hw)) / 2;
    const cel = (yF + yB) / 2;
    const pT = Math.atan2(yF - yB, S.L), rT = this.tipus === 'auto' ? Math.atan2(yL - yR, S.W) : 0;
    if (!rug || !dt) { this.y = cel; this.yv = 0; this.pitch = pT; this.roll = rT; return; }
    // rugózás: kritikusan csillapított követés (az úthibák érződnek, de nem pattog)
    const k = 160, c = 2 * Math.sqrt(k) * 0.75;
    this.yv += ((cel - this.y) * k - this.yv * c) * dt; this.y += this.yv * dt;
    if (this.y < cel - 0.15) { this.y = cel - 0.15; this.yv = Math.max(0, this.yv); }
    const a = Math.min(1, dt * 10); this.pitch += (pT - this.pitch) * a; this.roll += (rT - this.roll) * a;
  }
  allit(dt) {
    this.obj.position.set(this.x, this.y, this.z);
    this.obj.rotation.set(0, this.yaw, 0);
    // bólintás és dőlés a test csoporton (fékezéskor előre bólint)
    this.test.rotation.set(-this.pitch, 0, this.roll + (this.tipus === 'bicikli' ? (this.parkol ? 0.16 : this.lean) : 0), 'YXZ');
    if (this.kerek) {
      const spin = this.seb * dt / this.S.kerekR;
      for (const [n, w] of Object.entries(this.kerek)) { w.rotation.x += spin; if (n.includes('front')) w.rotation.y = this.korm; }
      for (const [n, w] of Object.entries(this.kerek)) { w.rotation.order = 'YXZ'; }
    }
    if (this.bk) {
      const spin = this.seb * dt / this.S.kerekR;
      for (const w of this.bk.kerekek) w.rotation.x += spin;
      this.bk.korm.rotation.y = this.korm * 0.9;
      this.bk.kerekek[1].rotation.y = this.korm * 0.9;
      this.bk.hajto.rotation.x = this.pedal;
      this.bk.tamasz.visible = this.parkol;
    }
  }
  /** Egy lépés. inp: {gaz (−1..1), korm (−1..1), kezifek, sprint} vagy null (parkol). */
  update(dt, inp) {
    const S = this.S, V = this.V;
    if (!inp) { this.parkol = Math.abs(this.seb) < 0.05; inp = { gaz: 0, korm: 0, kezifek: true }; }
    else this.parkol = false;
    const tap = TAPADAS[V.felulet(this.x, this.z)] ?? 0.62;
    const max = (inp.sprint && S.sprint ? S.sprint : S.maxSeb) * tap;
    // hosszirányú: gáz, fék, hátramenet, motorfék, gördülési ellenállás, lejtő
    let a = 0;
    if (inp.gaz > 0) a = this.seb < -0.3 ? S.fek : S.gyors * Math.max(0, 1 - (this.seb / max) ** 2) * (this.tipus === 'auto' ? (0.55 + 0.45 * Math.min(1, Math.abs(this.seb) / 6)) * 1.25 : 1);
    else if (inp.gaz < 0) a = this.seb > 0.3 ? -S.fek : -S.hatra * Math.max(0, 1 - (this.seb / (max * 0.35)) ** 2);
    else a = -Math.sign(this.seb) * Math.min(Math.abs(this.seb) / Math.max(dt, 1e-3), S.motorfek + S.gurul * (2 - tap));
    if (inp.kezifek) a = -Math.sign(this.seb) * Math.min(Math.abs(this.seb) / Math.max(dt, 1e-3), S.fek * 1.2);
    a -= 9.81 * Math.sin(this.pitch) * (this.tipus === 'auto' ? 0.55 : 0.8);
    if (this.seb > max && inp.gaz >= 0) a = Math.min(a, -(this.seb - max) * 1.5);
    this.seb += a * dt;
    if (Math.abs(this.seb) < 0.02 && !inp.gaz) this.seb = 0;
    // kormányzás: nagy sebességnél kisebb szög, simított, középre visszaáll
    const kc = inp.korm * S.maxKorm / (1 + Math.abs(this.seb) / (this.tipus === 'auto' ? 9 : 6));
    const rate = (Math.abs(kc) < Math.abs(this.korm) ? 1.7 : 1) * S.kormSeb * dt;
    this.korm += THREE.MathUtils.clamp(kc - this.korm, -rate, rate);
    this.yaw += this.seb / S.L * Math.tan(this.korm) * dt;
    // bicikli: bedőlés a kanyarba, pedálozás
    if (this.tipus === 'bicikli') {
      const cel = THREE.MathUtils.clamp(-this.seb * this.seb / S.L * Math.tan(this.korm) / 9.81, -0.5, 0.5);
      this.lean += (cel - this.lean) * Math.min(1, dt * 6);
      if (inp.gaz > 0 || Math.abs(this.seb) > 0.5) this.pedal += this.seb * dt / 0.9 * (inp.gaz > 0 ? 1 : 0.0);
    }
    // mozgás + ütközés (a karosszéria sarkai és orra)
    const ox = this.x, oz = this.z;
    this.x += Math.sin(this.yaw) * this.seb * dt; this.z += Math.cos(this.yaw) * this.seb * dt;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw), hl = S.hossz / 2, hw = S.W / 2;
    const lift = Math.max(0, this.y - V.talaj(this.x, this.z));
    // hány pontja (sarkok, orr, far, oldalak) van ütközőben egy adott helyen
    const utkozo = (x, z) => {
      let n = 0;
      for (const [a1, b1] of [[hl, -hw], [hl, hw], [-hl, -hw], [-hl, hw], [hl, 0], [-hl, 0], [0, -hw], [0, hw]]) {
        const px = x + fx * a1 + rx * b1, pz = z + fz * a1 + rz * b1;
        const c = V.utk.inside(px, pz, 0);
        if ((c && c.h > lift + 0.3) || V.vizben(px, pz)) n++;
      }
      return n;
    };
    // ha már a régi helyen is ütközőben volt (kanyarodáskor belefordult), azt a lépést engedjük, amelyik
    // nem rontja a helyzetet — különben minden irányba tilt, és a jármű végleg beragad (végigjátszás, 2026-11-13)
    const most = utkozo(this.x, this.z);
    let hit = most > 0 && (most > utkozo(ox, oz) || utkozo(ox, oz) === 0);
    const B = V.BOUNDS;
    if (this.x < B.x0 + 3 || this.x > B.x1 - 3 || this.z < B.z0 + 3 || this.z > B.z1 - 3) hit = true;
    if (hit) {
      this.x = ox; this.z = oz;
      this.razas = Math.min(1, this.razas + Math.abs(this.seb) / 12);
      this.seb *= -0.25;
    }
    this.talajra(dt);
    this.razas = Math.max(0, this.razas - dt * 3);
    this.allit(dt);
  }
}

// ---------------------------------------------------------------- kezelő: beszállás, vezetés, kamera
export class JarmuKezelo {
  constructor(V, jatekos, camera, bemenet, scene, o = {}) {
    this.V = V; this.j = jatekos; this.camera = camera; this.in = bemenet; this.scene = scene;
    this.lista = [
      new Jarmu(V, scene, 'auto', o.auto?.[0] ?? -8.5, o.auto?.[1] ?? 13.25, o.auto?.[2] ?? Math.PI / 2),
      new Jarmu(V, scene, 'bicikli', o.bicikli?.[0] ?? -1.4, o.bicikli?.[1] ?? 5.6, o.bicikli?.[2] ?? 0.12),
    ];
    this.vezet = null; this.kameraMod = null;
    this.cam = { pos: new THREE.Vector3(), yaw: 0, nezYaw: 0, nezPitch: 0, nezIdo: 0 };
    this.fov0 = camera.fov;
  }
  kozeli() {
    let best = null, bd = 1e9;
    for (const v of this.lista) { const d = Math.hypot(v.x - this.j.pos.x, v.z - this.j.pos.z); if (d < v.S.beszallTav && d < bd) { bd = d; best = v; } }
    return best;
  }
  sugo() {
    if (this.vezet) return Math.abs(this.vezet.seb) < 2 ? 'E – kiszállás · C – nézet' : '';
    const k = this.kozeli(); return k ? (k.tipus === 'auto' ? 'E – beszállás az autóba' : 'E – felülés a biciklire') : '';
  }
  beszall(tipus = null, azonnal = false) {
    const v = tipus ? this.lista.find(x => x.tipus === tipus) : this.kozeli();
    if (!v) return false;
    if (azonnal) { this.j.pos.set(v.x, v.y, v.z); }
    this.vezet = v; this.j.aktiv = false;
    if (v.sofor) v.sofor.o.visible = true;
    this.kameraMod = v.tipus === 'auto' ? 'kulso' : 'belso';
    this.cam.yaw = v.yaw; this.cam.pos.set(v.x - Math.sin(v.yaw) * 5, v.y + 2.2, v.z - Math.cos(v.yaw) * 5); this.cam.nezYaw = 0; this.cam.nezPitch = 0;
    v.parkol = false;
    this.kameraAllit(0);
    return true;
  }
  kiszall(eros = false) {
    const v = this.vezet; if (!v) return;
    if (!eros && Math.abs(v.seb) > 2) return;
    const rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
    for (const s of [-1, 1, -1.6, 1.6]) {
      const p = { x: v.x + rx * s * (v.S.W / 2 + 0.7), z: v.z + rz * s * (v.S.W / 2 + 0.7) };
      if (!this.V.utk.inside(p.x, p.z, 0.3) && !this.V.vizben(p.x, p.z)) { this.j.pos.set(p.x, this.V.talaj(p.x, p.z), p.z); break; }
    }
    this.j.yaw = v.yaw + Math.PI; this.j.pitch = -0.1; this.j.aktiv = true; this.j.camY = null; this.j.kamera();
    if (v.sofor) v.sofor.o.visible = false;
    this.vezet = null; this.camera.fov = this.fov0; this.camera.updateProjectionMatrix();
  }
  update(dt) {
    const I = this.in;
    if (I.most('KeyE')) { if (this.vezet) this.kiszall(); else this.beszall(); }
    if (this.vezet && I.most('KeyC')) {
      const m = this.vezet.tipus === 'auto' ? ['kulso', 'motorhazto'] : ['belso', 'kulso'];
      this.kameraMod = m[(m.indexOf(this.kameraMod) + 1) % m.length];
    }
    for (const v of this.lista) {
      if (v === this.vezet) {
        const inp = { gaz: (I.van('KeyW') ? 1 : 0) - (I.van('KeyS') ? 1 : 0), korm: (I.van('KeyA') ? 1 : 0) - (I.van('KeyD') ? 1 : 0), kezifek: I.van('Space'), sprint: I.van('ShiftLeft', 'ShiftRight') };
        v.update(dt, inp);
        this.j.pos.set(v.x, v.y, v.z);
      } else if (Math.abs(v.seb) > 0.01 || !v._lerakva) { v.update(dt, null); v._lerakva = Math.abs(v.seb) < 0.01; }
      if (v.sofor && v.sofor.o.visible) v.sofor.mixer.update(dt);
      // a parkoló jármű távolról rejtett (rajzhívás-takarékosság)
      v.obj.visible = v === this.vezet || Math.hypot(v.x - this.camera.position.x, v.z - this.camera.position.z) < 300;
    }
    if (this.vezet) this.kameraAllit(dt);
  }
  kameraAllit(dt) {
    const v = this.vezet, C = this.cam, cam = this.camera;
    // szabad nézelődés egérrel; 1,2 mp tétlenség után visszaáll előre
    const [dx, dy] = this.in.egerKi();
    if (dx || dy) { C.nezYaw -= dx * 0.0022; C.nezPitch = THREE.MathUtils.clamp(C.nezPitch - dy * 0.0022, -0.9, 0.6); C.nezIdo = 0; }
    else { C.nezIdo += dt; if (C.nezIdo > 1.2 && this.kameraMod !== 'belso') { C.nezYaw *= Math.max(0, 1 - dt * 2.5); C.nezPitch *= Math.max(0, 1 - dt * 2.5); } }
    C.nezYaw = THREE.MathUtils.clamp(C.nezYaw, -2.6, 2.6);
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const shake = v.razas * v.razas * 0.12;
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    const kmh = Math.abs(v.seb) * 3.6;
    if (this.kameraMod === 'kulso') {
      // a kamera iránya késve követi a járművet (dinamikus, de nem hintázik)
      let dyaw = v.yaw - C.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      C.yaw += dyaw * Math.min(1, dt ? dt * 4.5 : 1);
      const yy = C.yaw + C.nezYaw, tav = v.tipus === 'auto' ? 5.6 + kmh * 0.012 : 4.3, mag = v.tipus === 'auto' ? 2.05 : 2.45;
      let cx = v.x - Math.sin(yy) * tav, cz = v.z - Math.cos(yy) * tav;
      // ha a kamera falba kerülne, közelebb húzzuk
      for (let k = 1; k <= 8; k++) {
        const t = k / 8, px = v.x + (cx - v.x) * t, pz = v.z + (cz - v.z) * t;
        if (this.V.utk.inside(px, pz, 0.25)) { const tt = Math.max(0.25, (k - 1) / 8); cx = v.x + (cx - v.x) * tt; cz = v.z + (cz - v.z) * tt; break; }
      }
      const cy = Math.max(this.V.talaj(cx, cz) + 0.6, v.y + mag + C.nezPitch * -2);
      if (!dt) C.pos.set(cx, cy, cz); else C.pos.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 9));
      cam.position.set(C.pos.x + sx, C.pos.y + sy, C.pos.z);
      cam.lookAt(v.x + fx * 2.5, v.y + (v.tipus === 'auto' ? 1.05 : 1.2), v.z + fz * 2.5);
    } else {
      // belső (bicikli: a kerékpáros szeme) vagy motorháztető (autó)
      const fwd = this.kameraMod === 'motorhazto' ? 0.9 : -0.32, up = this.kameraMod === 'motorhazto' ? 1.32 : 1.64;
      const p = new THREE.Vector3(0, up, fwd).applyEuler(new THREE.Euler(-v.pitch, v.yaw, v.roll + (v.tipus === 'bicikli' ? v.lean * 0.6 : 0), 'YXZ'));
      cam.position.set(v.x + p.x + sx, v.y + p.y + sy + (v.tipus === 'bicikli' ? Math.sin(v.pedal * 2) * 0.012 : 0), v.z + p.z);
      cam.rotation.set(v.pitch * 0.8 + C.nezPitch - (v.tipus === 'bicikli' ? 0.3 : 0.04), v.yaw + Math.PI + C.nezYaw, (v.tipus === 'bicikli' ? -v.lean * 0.5 : 0), 'YXZ');
    }
    const fov = this.fov0 + Math.min(10, kmh * 0.11);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, (dt || 1) * 3); cam.updateProjectionMatrix(); }
    // a figura a belső nézetben nem takar
    if (v.sofor) v.sofor.o.visible = this.kameraMod === 'kulso' || this.kameraMod === 'motorhazto';
  }
}
