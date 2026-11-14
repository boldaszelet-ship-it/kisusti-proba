// Kisüsti — saját, procedurális kiegészítők a figurákhoz (Topshelf-kód, harmadik fél joga nem terheli).
// Merev darabok a fejcsonton: svájcisapka, kalap, tányérsapka (embléma nélkül), bajusz, szemüveg, kendőcsomó.
// A fej „horgonypontjait” (szem, orr, fejtető, fejszélesség) a fejháló kötési (bind) helyzetéből méri a figuragyár;
// minden méret ehhez igazodik, így ugyanaz a kalap minden fejre jól ül. Kötési világtér: a figura +Z felé néz.
import * as THREE from 'three';

/** Csak pozíció (+ index): a figurák flatShading-anyaggal rajzolódnak, a lapnormált a shader számolja. */
function tisztit(g) {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position').clone());
  if (g.index) out.setIndex(g.index.clone());
  return out;
}
function darab(g, szerep, { pos = [0, 0, 0], rot = [0, 0, 0], skala = [1, 1, 1] } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(...skala));
  const t = tisztit(g); t.applyMatrix4(m);
  return { geo: t, szerep, csont: 'Head' };
}
const deg = THREE.MathUtils.degToRad;

/** A — fejhorgonyok: {szemY, szemZ, szemX, orrY, orrZ, tetoY, fejX, kozepZ, hatZ, allY} (méter, kötési világtér). */
export function svajcisapka(A) {
  const r = A.fejX * 1.22, y = A.tetoY - 0.03;
  return [
    darab(new THREE.SphereGeometry(1, 12, 6), 'kalap', { pos: [A.fejX * 0.12, y, A.kozepZ - 0.012], rot: [deg(-6), 0, deg(-9)], skala: [r, 0.03, r * 1.06] }),
    darab(new THREE.CylinderGeometry(0.004, 0.006, 0.018, 5), 'kalap', { pos: [A.fejX * 0.14, y + 0.038, A.kozepZ - 0.012], rot: [0, 0, deg(-11)] }),
  ];
}
export function kalap(A) {
  const s = A.fejX / 0.078, y0 = A.tetoY - 0.052 * s;
  return [
    darab(new THREE.CylinderGeometry(0.168 * s, 0.168 * s, 0.009, 16), 'kalap', { pos: [0, y0, A.kozepZ - 0.006], rot: [deg(-4), 0, 0] }),
    darab(new THREE.CylinderGeometry(0.083 * s, 0.098 * s, 0.105 * s, 12), 'kalap', { pos: [0, y0 + 0.055 * s, A.kozepZ - 0.006], rot: [deg(-4), 0, 0] }),
    darab(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.024 * s, 12), 'kalap2', { pos: [0, y0 + 0.016 * s, A.kozepZ - 0.006], rot: [deg(-4), 0, 0] }),
    // horpadás a tetején: alacsony, keskenyebb hasáb, kalapszínben
    darab(new THREE.CylinderGeometry(0.05 * s, 0.075 * s, 0.012, 10), 'kalap', { pos: [0, y0 + 0.11 * s, A.kozepZ - 0.006], rot: [deg(-4), 0, 0], skala: [1, 1, 0.55] }),
  ];
}
/** Tányérsapka (a pénzügyőré): szalag, lapos tető, ellenző — embléma, jelvény, felirat NINCS. */
export function tanyersapka(A) {
  const s = A.fejX / 0.078, y0 = A.tetoY - 0.045 * s, z = A.kozepZ;
  return [
    darab(new THREE.CylinderGeometry(0.1 * s, 0.098 * s, 0.05 * s, 14), 'kalap2', { pos: [0, y0, z], rot: [deg(-6), 0, 0] }),
    darab(new THREE.CylinderGeometry(0.128 * s, 0.104 * s, 0.034 * s, 14), 'kalap', { pos: [0, y0 + 0.04 * s, z - 0.008], rot: [deg(-10), 0, 0] }),
    darab(new THREE.CylinderGeometry(0.096 * s, 0.096 * s, 0.006, 12, 1, false, deg(-75), deg(150)), 'kalap2', { pos: [0, y0 - 0.02 * s, z + 0.03 * s], rot: [deg(22), 0, 0], skala: [1, 1, 0.8] }),
  ];
}
export function bajusz(A, tipus = 'kefe') {
  const y = A.orrY - 0.022, z = A.orrZ - 0.014, w = A.fejX * 0.5;
  const tojas = () => new THREE.SphereGeometry(1, 8, 5);
  if (tipus === 'konya') {
    // lekonyuló, dús bajusz: két ív a szájszéleken lefelé, lekerekített végekkel
    return [-1, 1].flatMap(sx => [
      darab(tojas(), 'bajusz', { pos: [sx * w * 0.4, y, z], rot: [0, sx * deg(16), sx * deg(-16)], skala: [w * 0.5, 0.011, 0.012] }),
      darab(tojas(), 'bajusz', { pos: [sx * w * 0.8, y - 0.017, z - 0.008], rot: [0, sx * deg(30), sx * deg(-68)], skala: [0.02, 0.0075, 0.009] }),
    ]);
  }
  // kefebajusz: széles, kissé ívelt
  return [-1, 1].map(sx => darab(tojas(), 'bajusz', { pos: [sx * w * 0.38, y, z], rot: [0, sx * deg(16), sx * deg(-9)], skala: [w * 0.47, 0.0115, 0.0125] }));
}
export function szemuveg(A) {
  const z = A.szemZ + 0.014, r = A.fejX * 0.27, out = [];
  for (const sx of [-1, 1]) {
    out.push(darab(new THREE.TorusGeometry(r, 0.0028, 4, 12), 'szemuveg', { pos: [sx * A.szemX, A.szemY, z] }));
    const hossz = Math.max(0.02, z - A.kozepZ);
    out.push(darab(new THREE.BoxGeometry(0.003, 0.003, hossz), 'szemuveg', { pos: [sx * (A.szemX + r), A.szemY + 0.004, z - hossz / 2] }));
  }
  out.push(darab(new THREE.BoxGeometry(Math.max(0.008, 2 * (A.szemX - r)), 0.003, 0.003), 'szemuveg', { pos: [0, A.szemY + 0.005, z + 0.002] }));
  return out;
}
/** A fejkendő csomója az áll alatt és két lelógó vége (a kendő maga a női „Medieval” fej csuklyája, átszínezve). */
export function kendocsomo(A) {
  const out = [darab(new THREE.SphereGeometry(0.019, 6, 4), 'kendo', { pos: [0, A.allY - 0.012, A.orrZ - 0.05], skala: [1.25, 0.85, 0.9] })];
  for (const sx of [-1, 1]) out.push(darab(new THREE.BoxGeometry(0.024, 0.055, 0.008), 'kendo', { pos: [sx * 0.017, A.allY - 0.038, A.orrZ - 0.05], rot: [deg(8), 0, sx * deg(20)] }));
  return out;
}

// ------------------------------------------------------------------ kellékek a kézbe (nem bőrözött, külön háló)
const KELLEK_ANYAG = {
  uveg: new THREE.MeshLambertMaterial({ color: 0xcfe3dc, transparent: true, opacity: 0.55, flatShading: true }),
  palinka: new THREE.MeshLambertMaterial({ color: 0xe9c46a, transparent: true, opacity: 0.75, flatShading: true }),
  dugo: new THREE.MeshLambertMaterial({ color: 0x8a6a44, flatShading: true }),
  papir: new THREE.MeshLambertMaterial({ color: 0xe8e0c8, flatShading: true }),
};
/** Kupica: talpas pálinkáspohár, benne pálinka. */
export function kupica() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.015, 0.06, 8, 1, true), KELLEK_ANYAG.uveg));
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.035, 8), KELLEK_ANYAG.palinka); p.position.y = -0.01; g.add(p);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.005, 8), KELLEK_ANYAG.uveg); t.position.y = -0.032; g.add(t);
  g.name = 'kupica'; return g;
}
/** Fél literes pálinkásüveg dugóval és címkével (felirat nélkül). */
export function palinkasUveg() {
  const g = new THREE.Group();
  const test = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.17, 10), KELLEK_ANYAG.palinka); test.position.y = 0.085; g.add(test);
  const vall = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.036, 0.05, 10), KELLEK_ANYAG.uveg); vall.position.y = 0.195; g.add(vall);
  const nyak = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.05, 8), KELLEK_ANYAG.uveg); nyak.position.y = 0.245; g.add(nyak);
  const dugo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.011, 0.025, 8), KELLEK_ANYAG.dugo); dugo.position.y = 0.28; g.add(dugo);
  const cimke = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0405, 0.06, 10, 1, true, 0.2, 2.2), KELLEK_ANYAG.papir); cimke.position.y = 0.08; g.add(cimke);
  g.name = 'uveg'; return g;
}

// ------------------------------------------------------------------ díszlet-bútor (nem a figurán)
const FA = [0x7b5a3a, 0x6f5034, 0x86643f].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, flatShading: true }));
/** Falusi lóca (a tor padja): két deszkából álló ülőlap (teteje 0,43 m), szétálló bakláb párok a végeknél, merevítő léc.
 *  Hossza a helyi x mentén, a közepe az origón; mélysége 0,30 m. */
export function loca(hossz = 2.4) {
  const g = new THREE.Group(); g.name = 'loca';
  const vast = 0.045, top = 0.43, mely = 0.30, desz = 0.14;
  for (const [i, z] of [-(desz / 2 + 0.01), desz / 2 + 0.01].entries()) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(hossz, vast, desz), FA[i]);
    d.position.set(0, top - vast / 2, z); d.rotation.z = (i ? 1 : -1) * 0.004; g.add(d);
  }
  const labH = top - vast, ferde = 0.16;
  for (const sx of [-1, 1]) {
    const x = sx * (hossz / 2 - 0.16);
    const kereszt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, mely - 0.02), FA[2]); kereszt.position.set(x, labH - 0.025, 0); g.add(kereszt);
    for (const sz of [-1, 1]) {
      const h = Math.hypot(labH - 0.05, ferde * (mely / 2));
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.055, h, 0.055), FA[1]);
      l.position.set(x, (labH - 0.05) / 2, sz * (mely / 2 - 0.02)); l.rotation.x = sz * Math.atan2(ferde * mely / 2, labH - 0.05) * 0.9; g.add(l);
    }
  }
  const merev = new THREE.Mesh(new THREE.BoxGeometry(hossz - 0.32, 0.05, 0.035), FA[0]); merev.position.set(0, 0.16, 0); g.add(merev);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
const TANYER = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.4 });
const POGACSA = [new THREE.MeshStandardMaterial({ color: 0xd49a45, roughness: 0.8, flatShading: true }), new THREE.MeshStandardMaterial({ color: 0xa8692c, roughness: 0.8, flatShading: true })];
/** Tányér tepertős pogácsával (x, y = asztallap, z). */
export function pogacsasTanyer(x, y, z) {
  const g = new THREE.Group(); g.name = 'pogacsa'; g.position.set(x, y, z);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.018, 20), TANYER); t.position.y = 0.009; g.add(t);
  const hely = [[0, 0, 0.045], [0.06, 0.02, 0.03], [-0.055, 0.03, 0.03], [0.02, -0.06, 0.03], [-0.04, -0.045, 0.03], [0.065, -0.04, 0.03], [-0.07, -0.01, 0.03], [0.0, 0.07, 0.03], [0.015, 0.0, 0.065]];
  for (const [i, [px, pz, py]] of hely.entries()) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.026, 9), POGACSA[0]); p.position.set(px, py, pz); p.rotation.set(0.15 * Math.sin(i * 3), i, 0.12 * Math.cos(i * 2)); g.add(p);
    const teto = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.004, 9), POGACSA[1]); teto.position.set(0, 0.014, 0); p.add(teto);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
