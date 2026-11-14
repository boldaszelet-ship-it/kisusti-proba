// Kisüsti — a tanya palackozója (saját, procedurális modell; 2026-11-14). A korábbi változat egy Kenney-láda volt öt
// 50–60 cm-es Kenney-üveggel a tetején („primitív dobozok” — tulajdonosi panasz). Ez valódi méretben készül, 1,5 m-ről
// nézhető: munkapad alsó polccal, esztergált profilú fél literes üvegek (üresek, töltöttek dugóval és kézírásos
// címkével), zománcozott tölcsér, demizson fonott kosárban, kézi dugózó, dugós tál, mérőkancsó, falipolc, üvegrekesz.
// A csoport origója a pad elejének közepe a talajon; a pad hossza a helyi x mentén, a kezelő a +z oldalon áll.
import * as THREE from 'three';

const A = {
  fa: new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.85 }),
  faSot: new THREE.MeshStandardMaterial({ color: 0x5e4329, roughness: 0.9 }),
  lap: new THREE.MeshStandardMaterial({ color: 0x9c7650, roughness: 0.7 }),
  uveg: new THREE.MeshStandardMaterial({ color: 0xe4f2ea, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  zold: new THREE.MeshStandardMaterial({ color: 0x3f7a4c, roughness: 0.08, transparent: true, opacity: 0.5, depthWrite: false }),
  palinka: new THREE.MeshStandardMaterial({ color: 0xd48f24, roughness: 0.15, transparent: true, opacity: 0.86, emissive: 0x3a1e00, depthWrite: false }),
  dugo: new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.95 }),
  zomanc: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.35 }),
  zomancPerem: new THREE.MeshStandardMaterial({ color: 0x23395b, roughness: 0.35 }),
  fonat: new THREE.MeshStandardMaterial({ color: 0x9b7442, roughness: 1 }),
  vas: new THREE.MeshStandardMaterial({ color: 0x3b3b3e, roughness: 0.5, metalness: 0.7 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x6d5a3e, roughness: 0.95 }),
};

/** Kézírásos címke-textúra (vászon): gyümölcs + évszám + fok, sárgás papír, kissé ferde írás. */
function cimkeTextura(gyumolcs, fok) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#efe4c4'; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#8b2f23'; x.lineWidth = 5; x.strokeRect(8, 8, 240, 112);
  x.save(); x.translate(128, 54); x.rotate(-0.04);
  x.fillStyle = '#2b2118'; x.textAlign = 'center'; x.font = 'italic 600 40px Georgia, serif'; x.fillText(gyumolcs, 0, 0);
  x.font = 'italic 26px Georgia, serif'; x.fillText(`2026 · ${fok}°`, 2, 40);
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// fél literes „pálinkás” üveg profilja (sugár, magasság méterben) — vállas, hosszú nyakú
const PROFIL = [[0, 0], [0.034, 0], [0.037, 0.006], [0.037, 0.15], [0.033, 0.175], [0.02, 0.2], [0.0135, 0.215], [0.0135, 0.262], [0.016, 0.266], [0.016, 0.272], [0.012, 0.274]];
const GEO = {
  uveg: new THREE.LatheGeometry(PROFIL.map(([r, y]) => new THREE.Vector2(r, y)), 16),
  tolt: new THREE.LatheGeometry([[0, 0.004], [0.034, 0.004], [0.034, 0.15], [0.03, 0.172], [0.0, 0.172]].map(([r, y]) => new THREE.Vector2(r, y)), 16),
  dugo: new THREE.CylinderGeometry(0.0125, 0.011, 0.024, 10),
  cimke: new THREE.CylinderGeometry(0.0375, 0.0375, 0.075, 16, 1, true, -0.9, 1.8),
};

function uveg(g, x, y, z, { tele = false, cimke = null, zold = false, ry = 0 } = {}) {
  const u = new THREE.Group(); u.position.set(x, y, z); u.rotation.y = ry; g.add(u);
  u.add(new THREE.Mesh(GEO.uveg, zold ? A.zold : A.uveg));
  if (tele) {
    const p = new THREE.Mesh(GEO.tolt, A.palinka); p.scale.set(0.96, 1, 0.96); u.add(p);
    const d = new THREE.Mesh(GEO.dugo, A.dugo); d.position.y = 0.276; u.add(d);
  }
  if (cimke) { const m = new THREE.Mesh(GEO.cimke, cimke); m.position.y = 0.085; u.add(m); }
  return u;
}
const doboz = (g, w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
const henger = (g, rt, rb, h, x, y, z, m, n = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, n), m); o.position.set(x, y, z); g.add(o); return o; };

export function palackozo() {
  const g = new THREE.Group(); g.name = 'palackozo';
  const cimkek = [['Szilva', 52], ['Barack', 48], ['Körte', 45], ['Szilva', 50]].map(([n, f]) => new THREE.MeshStandardMaterial({ map: cimkeTextura(n, f), roughness: 0.9, side: THREE.DoubleSide }));

  // ---- munkapad: 1,5 × 0,6 m, lap 0,88 m, négy láb, alsó polc, a lap elején kopott él
  const L = 1.5, D = 0.6, H = 0.88, cz = -D / 2;
  doboz(g, L, 0.05, D, 0, H - 0.025, cz, A.lap);
  doboz(g, L - 0.02, 0.03, 0.04, 0, H - 0.065, -0.02, A.faSot);
  for (const sx of [-1, 1]) for (const sz of [0, 1]) doboz(g, 0.06, H - 0.05, 0.06, sx * (L / 2 - 0.05), (H - 0.05) / 2, -0.05 - sz * (D - 0.1), A.fa);
  doboz(g, L - 0.08, 0.025, D - 0.08, 0, 0.18, cz, A.fa);                     // alsó polc
  for (const sz of [0, 1]) doboz(g, L - 0.1, 0.06, 0.03, 0, 0.75, -0.05 - sz * (D - 0.1), A.faSot);   // kávák

  // ---- a lapon: töltés alatt álló üveg tölcsérrel, mellette töltött-dugózott-címkézett sor, üres sor hátul
  const lap = H;
  uveg(g, -0.12, lap, -0.18, { tele: false });
  { // zománcozott tölcsér az üres üvegben (kék perem)
    const t = new THREE.Group(); t.position.set(-0.12, lap + 0.255, -0.18); g.add(t);
    const kup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.009, 0.08, 18, 1, true), A.zomanc); kup.position.y = 0.06; t.add(kup);
    const cso = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.007, 0.06, 8), A.zomanc); cso.position.y = 0.0; t.add(cso);
    const perem = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.004, 6, 20), A.zomancPerem); perem.rotation.x = Math.PI / 2; perem.position.y = 0.1; t.add(perem);
  }
  { // mérőkancsó pálinkával (literes, zománc)
    const k = new THREE.Group(); k.position.set(-0.32, lap, -0.15); g.add(k);
    henger(k, 0.055, 0.065, 0.15, 0, 0.075, 0, A.zomanc, 18).geometry = new THREE.CylinderGeometry(0.055, 0.065, 0.15, 18, 1, true);
    henger(k, 0.064, 0.064, 0.005, 0, 0.003, 0, A.zomanc, 18);
    const tukor = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.004, 18), A.palinka); tukor.position.y = 0.11; k.add(tukor);
    const fog = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 6, 12, Math.PI), A.zomanc); fog.position.set(0.06, 0.08, 0); fog.rotation.z = -Math.PI / 2; k.add(fog);
    const perem = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.004, 6, 18), A.zomancPerem); perem.rotation.x = Math.PI / 2; perem.position.y = 0.15; k.add(perem);
  }
  for (let i = 0; i < 4; i++) uveg(g, 0.08 + i * 0.085, lap, -0.12 - (i % 2) * 0.012, { tele: true, cimke: cimkek[i], ry: (i - 1.5) * 0.12 });
  for (let i = 0; i < 6; i++) uveg(g, -0.6 + i * 0.08, lap, -0.47, { zold: i % 3 === 1 });
  { // dugós tál
    const t = henger(g, 0.07, 0.05, 0.035, 0.52, lap + 0.018, -0.2, A.zomanc, 18);
    for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(GEO.dugo, A.dugo); const a = i * 2.4; d.position.set(0.52 + Math.cos(a) * 0.03 * (i % 3), lap + 0.042 + (i > 5 ? 0.01 : 0), -0.2 + Math.sin(a) * 0.03 * (i % 3)); d.rotation.set(Math.PI / 2, a, 0); g.add(d); }
    t.userData.ok = 1;
  }
  { // kézi dugózó (karos, vas) a pad jobb végén
    const k = new THREE.Group(); k.position.set(0.62, lap, -0.42); g.add(k);
    doboz(k, 0.1, 0.02, 0.1, 0, 0.01, 0, A.faSot);
    henger(k, 0.012, 0.012, 0.32, 0, 0.17, -0.03, A.vas, 8);
    doboz(k, 0.05, 0.06, 0.05, 0, 0.26, 0, A.vas);
    const kar = doboz(k, 0.02, 0.02, 0.26, 0, 0.32, 0.1, A.vas); kar.rotation.x = 0.5;
    henger(k, 0.016, 0.016, 0.05, 0, 0.38, 0.21, A.faSot, 8).rotation.x = Math.PI / 2;
  }
  // ---- alsó polcon: üvegrekesz (fa, 12 rekesz), benne üres üvegek
  {
    const r = new THREE.Group(); r.position.set(-0.3, 0.195, -0.3); g.add(r);
    const W = 0.36, DD = 0.27, HH = 0.12;
    doboz(r, W, 0.012, DD, 0, 0.006, 0, A.fa);
    for (const s of [-1, 1]) { doboz(r, W, HH, 0.012, 0, HH / 2, s * DD / 2, A.fa); doboz(r, 0.012, HH, DD, s * W / 2, HH / 2, 0, A.fa); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 4 !== 3) uveg(r, -0.135 + i * 0.09, 0.012, -0.09 + j * 0.09, { zold: (i * 3 + j) % 5 === 0 });
  }
  // demizson fonott kosárban a pad mellett a földön (15 l, félig pálinkával)
  {
    const d = new THREE.Group(); d.position.set(1.0, 0, -0.25); g.add(d);
    const prof = [[0, 0], [0.13, 0.01], [0.17, 0.08], [0.18, 0.18], [0.15, 0.3], [0.06, 0.37], [0.025, 0.4], [0.025, 0.47], [0.03, 0.48]];
    d.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20), A.zold));
    const tolt = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.012], [0.125, 0.02], [0.165, 0.08], [0.17, 0.17], [0, 0.17]].map(([r, y]) => new THREE.Vector2(r, y)), 20), A.palinka); d.add(tolt);
    const kosar = new THREE.Mesh(new THREE.LatheGeometry([[0.14, 0], [0.185, 0.08], [0.19, 0.2], [0.17, 0.27]].map(([r, y]) => new THREE.Vector2(r, y)), 20, 0, Math.PI * 2), A.fonat); kosar.material.side = THREE.DoubleSide; d.add(kosar);
    for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.188, 0.006, 4, 24), A.faSot); f.rotation.x = Math.PI / 2; f.position.y = 0.04 + i * 0.045; f.scale.setScalar(i === 0 ? 0.88 : i > 4 ? 0.93 : 1); d.add(f); }
    for (const s of [-1, 1]) { const fog = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 5, 10, Math.PI), A.fonat); fog.position.set(s * 0.16, 0.27, 0); fog.rotation.y = Math.PI / 2; d.add(fog); }
    henger(d, 0.024, 0.02, 0.03, 0, 0.49, 0, A.dugo, 10);
  }
  // falipolc a pad mögött (két polclap konzolon), rajta címkézett üvegek, és egy üres sor
  {
    const p = new THREE.Group(); p.position.set(0, 1.25, -0.66); g.add(p);
    for (const [k, y] of [[0, 0], [1, 0.38]].entries()) {
      doboz(p, 1.3, 0.025, 0.2, 0, y[1], 0, A.lap);
      for (const s of [-1, 1]) { const kz = doboz(p, 0.025, 0.14, 0.025, s * 0.55, y[1] - 0.08, -0.08, A.faSot); kz.rotation.x = 0; doboz(p, 0.025, 0.025, 0.16, s * 0.55, y[1] - 0.025, 0, A.faSot); }
      for (let i = 0; i < 8; i++) uveg(p, -0.56 + i * 0.16 + (k ? 0.05 : 0), y[1] + 0.0125, 0, { tele: k === 0 || i % 3 === 0, cimke: k === 0 ? cimkek[i % 4] : null, zold: k === 1 && i % 2 === 1, ry: i * 0.4 });
    }
    doboz(p, 1.34, 0.9, 0.02, 0, 0.25, -0.11, A.pad);        // deszkafal a polc mögött
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.transparent; o.receiveShadow = true; } });
  return g;
}
