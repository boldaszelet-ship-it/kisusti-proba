// Kisüsti — Szőlőhegy (-170, -230): szőlősorok a domb oldalán a szintvonalak mentén (InstancedMesh-tőkék
// karóval és fürttel), présházsor az út mentén (oromfal az útra, pincegádor), a megvehető présház préssel
// és hordókkal, az erdész háza farakásokkal, a tetőn fa kilátó.
import * as THREE from 'three';
import { prop } from './betolto.js';
import { mat, recolor, palTeto } from './paletta.js';
import { haz, kerites, doboz, henger, tabla, pad, T, vilagba, mergeSimple } from './epulet.js';
import { talaj, utTav, terepY, PLATFORMOK, RAMPAK } from './terep.js';
import { fesusRy } from './falu.js';
import { NODES } from '../../data/regions.js';

const HC = [-170, -250];   // a domb csúcsa (a szintvonalak középpontja)

let TOKE = null;
/** Egy 2 m-es szőlősor-szakasz: karó, két tőke, lombfal két tömbből, fürtök. Csúcsszínes, lapos árnyalású. */
function tokeGeo() {
  if (TOKE) return TOKE;
  const parts = [];
  const add = (geo, color, m, jitter = 0) => {
    geo = geo.index ? geo.toNonIndexed() : geo; geo.applyMatrix4(m);
    const P = geo.attributes.position;
    if (jitter) for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + (Math.sin(i * 12.9898) * 0.5) * jitter, P.getY(i) + (Math.sin(i * 78.233) * 0.5) * jitter, P.getZ(i) + (Math.sin(i * 39.425) * 0.5) * jitter);
    geo.computeVertexNormals();
    const n = P.count, c = new Float32Array(n * 3), cc = new THREE.Color(color);
    for (let i = 0; i < n; i++) { const v = 0.88 + 0.24 * ((i * 7) % 5) / 4; c[i * 3] = cc.r * v; c[i * 3 + 1] = cc.g * v; c[i * 3 + 2] = cc.b * v; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.deleteAttribute('uv'); parts.push(geo);
  };
  const M = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));
  add(new THREE.BoxGeometry(1, 1, 1), 0x8a7a64, M(0, 0.8, -1.0, 0.07, 1.6, 0.07));
  for (const z of [-0.5, 0.5]) add(new THREE.CylinderGeometry(0.035, 0.05, 0.75, 5), 0x4e3a28, M(0, 0.37, z));
  add(new THREE.IcosahedronGeometry(1, 0), 0x56742e, M(0, 1.08, -0.48, 0.36, 0.42, 0.62, 0.3), 0.08);
  add(new THREE.IcosahedronGeometry(1, 0), 0x67843a, M(0.02, 1.12, 0.5, 0.38, 0.44, 0.6, 1.1), 0.08);
  for (const [x, z] of [[0.2, -0.2], [-0.2, 0.7]]) add(new THREE.OctahedronGeometry(1, 0), 0x3c2448, M(x, 0.74, z, 0.08, 0.14, 0.08));
  TOKE = [{ geo: mergeSimple(parts), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }) }];
  return TOKE;
}

/** Pincegádor: a présház előtt lefelé vezető, kis nyeregtetős lejáró, sötét nyílással. */
function gador(ctx, x, z, ry, fal = 0xece4d0) {
  const g = new THREE.Group(); g.position.set(x, talaj(x, z), z); g.rotation.y = ry;
  doboz(g, -0.85, 0.45, 0, 0.25, 0.9, 2.2, fal); doboz(g, 0.85, 0.45, 0, 0.25, 0.9, 2.2, fal);
  doboz(g, 0, 0.75, -1.05, 1.95, 1.5, 0.25, fal);
  doboz(g, 0, 0.62, -0.92, 1.0, 1.15, 0.05, 0x1a1512);
  for (const s of [-1, 1]) { const r = doboz(g, s * 0.52, 1.25, -0.1, 1.15, 0.08, 2.5, 0x7a4a32); r.rotation.z = s * -0.62; }
  doboz(g, 0, 0.05, 0.3, 1.4, 0.1, 1.4, 0x6a6258);
  ctx.statikus(g, 'kozep');
  const [cx, cz] = vilagba(x, z, ry, 0, -0.3); ctx.utk.obb(cx, cz, 2.1, 2.3, ry);
}

export function epitSzolohegy(ctx) {
  const R = ctx.rnd, out = {};
  const A = NODES.hegy_ut1, B = NODES.hegy_kp;
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
  // ---- présházsor
  const STP = [{ fal: 'meszel', teto: 'barna', fa: 'barna' }, { fal: 'kopott', teto: 'moha', fa: 'zold' }, { fal: 'meszel', teto: 'cserep', fa: 'barna' }, { fal: 'okker', teto: 'barna', fa: 'szurke' }, { fal: 'meszel', teto: 'moha', fa: 'kek' }];
  let k = 0;
  for (let s = 22; s < L - 14; s += 17) {
    for (const side of [-1, 1]) {
      if ((k++ + (side > 0 ? 1 : 0)) % 3 === 2) continue;   // néhol üres telek: szőlő ér az útig
      const nx = -uz * side, nz = ux * side;                // az úttól befelé
      const hossz = 2 + Math.floor(R() * 2), W = hossz * T;
      const off = 2.4 + 4.5 + W / 2;
      const hx = A[0] + ux * s + nx * off, hz = A[1] + uz * s + nz * off;
      const ry = fesusRy(nx, nz);
      haz(ctx, { x: hx, z: hz, ry, nx: hossz, nz: 2, stilus: STP[k % STP.length], oromfa: R() < 0.6, lab: 'ko', kemeny: R() < 0.4, ablakFeny: 0.25,
        falak: { w: ['wall-wood-door', 'wall-window-small'], e: ['wall', 'wall'], s: [...Array(hossz)].map((_, i) => i ? 'wall' : 'wall-window-small'), n: [...Array(hossz)].map(() => 'wall') } });
      // pincegádor az oromfal előtt (az út felé)
      const gx = hx - nx * (W / 2 + 1.4) + ux * side * 0, gz = hz - nz * (W / 2 + 1.4);
      const [px, pz] = [gx + (-nz) * 1.3, gz + nx * 1.3];
      gador(ctx, px, pz, Math.atan2(-nx, -nz) + Math.PI);
      // kiülő: asztal, pad, hordó
      if (R() < 0.6) {
        const tx = hx + (-nz) * 3.8 * side, tz = hz + nx * 3.8 * side, g = new THREE.Group(); g.position.set(tx, talaj(tx, tz), tz);
        prop('furniture-kit/tableCloth', 0, 0, 0, 2.2, ry, g); prop('survival-kit/barrel', 1.6, 0, 0.4, 3.4, 0, g);
        ctx.statikus(g, 'kozep'); ctx.utk.kor(tx, tz, 0.9, 0.9);
      }
    }
  }
  // ---- a megvehető présház: nagyobb, tornácos; előtte prés, hordók, asztal
  {
    const x = -150, z = -240, ry = 0.5;
    const H = haz(ctx, { x, z: z - 4, ry, nx: 4, nz: 2, stilus: { fal: 'meszel', teto: 'cserep', fa: 'barna' }, tornac: 2.0, oromfa: true, lab: 'ko', ablakFeny: 0.8 });
    const [dx, dz] = H.ajto;
    const g = new THREE.Group(); g.position.set(x, talaj(x, z + 1.5), z + 1.5); g.rotation.y = ry;
    // szőlőprés: kád, orsó, gerenda
    prop('survival-kit/barrel-open', -3.2, 0, 2.2, [4.4, 3.2, 4.4], 0, g);
    henger(g, -3.2, 1.6, 2.2, 0.07, 1.6, 0x5a4a3a, 10);
    doboz(g, -3.2, 2.15, 2.2, 2.2, 0.18, 0.22, 0x6b4a30);
    for (const s of [-1, 1]) doboz(g, -3.2 + s * 0.95, 1.1, 2.2, 0.16, 2.2, 0.16, 0x6b4a30);
    for (let q = 0; q < 3; q++) prop('survival-kit/barrel', 2.6 + q * 0.95, 0, 2.6, 3.6, q, g);
    prop('survival-kit/barrel', 3.05, 0.95, 2.6, 3.4, 0.4, g).rotation.z = Math.PI / 2;
    prop('furniture-kit/tableCloth', 0.2, 0, 3.2, 2.4, 0, g); prop('furniture-kit/bench', 0.2, 0, 4.6, 2.4, Math.PI, g);
    prop('food-kit/wine-red', 0.4, 0.82, 3.1, 1.0, 0, g); prop('food-kit/glass', -0.1, 0.82, 3.3, 1.6, 0, g);
    ctx.statikus(g, 'kozep');
    const W2 = (lx, lz) => vilagba(x, z + 1.5, ry, lx, lz);
    { const [a, b] = W2(-3.2, 2.2); ctx.utk.kor(a, b, 1.1); } { const [a, b] = W2(3.5, 2.6); ctx.utk.obb(a, b, 3.2, 1, ry); } { const [a, b] = W2(0.2, 3.8); ctx.utk.obb(a, b, 2, 2.6, ry, 0.9); }
    gador(ctx, ...W2(-6.6, -2.4), ry + Math.PI / 2);
    ctx.horgony('preshaz', dx, dz, null, { tipus: 'ingatlan' });
  }
  // ---- az erdész: deszkaház, farakások, tönkök, fejsze a tönkben
  {
    const x = -118, z = -276, ry = -0.3;
    const H = haz(ctx, { x, z, ry, nx: 3, nz: 2, fa: true, stilus: { fal: 'meszel', teto: 'moha', fa: 'zold' }, oromfa: true, lab: 'ko', tornac: 1.6 });
    const g = new THREE.Group(); g.position.set(x, talaj(x, z + 7), z + 7); g.rotation.y = ry;
    for (let q = 0; q < 3; q++) prop('nature-kit/log_stack', -4 + q * 2.4, 0, 0.5, 3.2, 0, g);
    prop('nature-kit/stump_round', 3.4, 0, 1.6, 3, 0, g); prop('survival-kit/tool-axe', 3.4, 0.55, 1.6, 2.6, 0.3, g).rotation.z = 0.6;
    prop('nature-kit/stump_old', 5.2, 0, -1, 3, 1, g); prop('nature-kit/log_large', 1.5, 0, 3.2, 3, 0.4, g);
    ctx.statikus(g, 'kozep');
    const [a, b] = vilagba(x, z + 7, ry, -1.6, 0.5); ctx.utk.obb(a, b, 7.6, 1.6, ry);
    ctx.horgony('erdesz', H.ajto[0], H.ajto[1], null, { tipus: 'beszallito' });
  }
  // ---- kilátó a dombtetőn (fa: négy oszlop, merevítés, meredek lépcső, járható kilátószint, sátortető)
  {
    const x = HC[0] - 12, z = HC[1] - 10, y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    const fa = 0x6b4a30, sot = 0x4e3624, H = 7.2;
    // a tető ereszvonala TH-n a kilátószint fölött: a szem (1,65 m) vízszintes nézésnél a tetőt nem látja, csak
    // ha felfelé néz (a bírálat: „a kilátó teteje fekete lapként lóg a képbe” — 2,9 m-en a mennyezet a kép harmada volt)
    const TH = 3.7;
    for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { henger(g, px, (H + TH - 0.7) / 2, pz, 0.14, H + TH + 0.7, fa, 8); ctx.utk.kor(x + px, z + pz, 0.2, H - 0.3); }
    for (const h of [2.4, 4.8]) for (const [a, b, c, d] of [[-1.6, -1.6, 1.6, -1.6], [1.6, -1.6, 1.6, 1.6], [1.6, 1.6, -1.6, 1.6], [-1.6, 1.6, -1.6, -1.6]]) {
      const L2 = Math.hypot(c - a, d - b), br = doboz(g, (a + c) / 2, h, (b + d) / 2, 0.1, 0.1, L2, sot); br.rotation.y = Math.atan2(c - a, d - b);
      const xb = doboz(g, (a + c) / 2, h - 1.2, (b + d) / 2, 0.08, 0.08, Math.hypot(L2, 2.4), sot); xb.rotation.set(Math.atan2(2.4, L2), Math.atan2(c - a, d - b), 0, 'YXZ');
    }
    // kilátószint (a lépcső tetejéig kinyúlik), korlát
    doboz(g, 0.5, H, 0, 5.2, 0.16, 4.2, 0x7a5a3a);
    // korlát körben; a déli oldalon a lépcső (x = 2,2 … 3,1) érkezésénél nyitott. Ütközővel: a játékos nem sétál
    // le a kilátószintről, és a talajról sem „ugrik fel” a kilátószint alá lépve (a talaj() ott a szint magassága).
    const KORLAT = [[0.025, -2.05, 4.25, 0.08], [0.5, 2.05, 5.2, 0.08], [-2.05, 0, 0.08, 4.2], [3.05, 0, 0.08, 4.2]];
    for (const [px, pz, w, d] of KORLAT) {
      doboz(g, px, H + 1.0, pz, w, 0.08, d, fa); doboz(g, px, H + 0.5, pz, w, 0.06, d, fa);
      ctx.utk.box(x + px - w / 2, x + px + w / 2, z + pz - d / 2, z + pz + d / 2);
    }
    for (const [px, pz] of [[-2.05, -2.05], [2.15, -2.05], [3.05, -2.05], [-2.05, 2.05], [3.05, 2.05], [0.5, 2.05], [0.5, -2.05], [-2.05, 0], [3.05, 0]]) doboz(g, px, H + 0.5, pz, 0.1, 1.0, 0.1, fa);
    // lépcső: z = -6,4 … -2,1, x = 2,2 … 3,1 (oldalgerendával)
    const N = 16;
    for (let q = 0; q < N; q++) doboz(g, 2.65, (q + 0.5) * H / N, -6.4 + (q + 0.5) * 4.3 / N, 0.9, 0.07, 0.3, 0x7a5a3a);
    for (const sx of [2.18, 3.12]) {
      const l = doboz(g, sx, H / 2, -4.25, 0.08, 0.2, Math.hypot(H, 4.3), sot); l.rotation.x = -Math.atan2(H, 4.3);
      const k = doboz(g, sx, H / 2 + 0.95, -4.25, 0.06, 0.06, Math.hypot(H, 4.3), fa); k.rotation.x = -Math.atan2(H, 4.3);   // kézlécek
      for (let q = 1; q < 4; q++) doboz(g, sx, q * H / 4 + 0.47, -6.4 + q * 4.3 / 4, 0.06, 0.95, 0.06, fa);
      ctx.utk.box(x + sx - 0.04, x + sx + 0.04, z - 6.4, z - 2.1);   // a lépcsőre csak alulról lehet fellépni
    }
    // sátortető TH (3,7 m) magasan a kilátószint fölött: a szem 1,73 m-en van, vízszintes nézésnél az eresz a látómező
    // fölött marad; alatta világos deszkamennyezet és vékony koszorúgerenda (a sötét, vastag gerenda volt a „fekete lap”)
    recolor(prop('fantasy-town-kit/roof-point', 0.5, H + TH, 0, [6.2 / 1.1, 1.5 / 0.5, 5.2 / 1.1], 0, g), palTeto('barna'));
    doboz(g, 0.5, H + TH - 0.04, 0, 5.4, 0.06, 4.4, 0xc49c6c);
    for (const [px, pz, w, d] of [[0.5, -2.1, 5.4, 0.12], [0.5, 2.1, 5.4, 0.12], [-2.1, 0, 0.12, 4.4], [3.1, 0, 0.12, 4.4]]) doboz(g, px, H + TH - 0.14, pz, w, 0.16, d, fa);
    ctx.statikus(g, 'epulet');
    RAMPAK.push([x + 2.2, x + 3.1, z - 6.4, z - 2.1, y, y + H + 0.08]);
    PLATFORMOK.push([x - 2.1, x + 3.1, z - 2.1, z + 2.1, y + H + 0.08]);
    ctx.horgony('kilato', x + 2.65, z - 7.2, null, { tipus: 'pont' });
    out.kilato = { x: x + 0.5, z, y: y + H + 0.08 };
  }
  // ---- szőlőtáblák a szintvonalak mentén (kör-ívek a csúcs körül), a ház- és úthelyeken kihagyva
  const tilt = (x, z) => utTav(x, z) < 4.5 || ctx.utk.inside(x, z, 2.2) || Math.hypot(x - (HC[0] - 12), z - (HC[1] - 10)) < 9;
  const parts = tokeGeo();
  let nT = 0;
  const TABLAK = [[150, 26, 70, 34], [192, 30, 92, 40], [232, 24, 88, 36], [272, 26, 96, 34], [312, 30, 92, 40], [352, 28, 86, 32], [110, 60, 100, 26], [20, 64, 100, 30]];
  for (const [deg, r0, r1, hw] of TABLAK) {
    const th = deg * Math.PI / 180;
    for (let r = r0; r <= r1; r += 2.9) {
      const span = hw / r;
      for (let ph = th - span; ph <= th + span; ph += 2.3 / r) {
        const x = HC[0] + Math.cos(ph) * r, z = HC[1] + Math.sin(ph) * r;
        if (tilt(x, z)) continue;
        const ry = Math.atan2(-Math.sin(ph), Math.cos(ph));
        ctx.szoro.addGeo('toke', parts, x, terepY(x, z) - 0.05, z, 1, ry, { layer: 'bokor' }); nT++;
      }
    }
  }
  out.tokek = nT;
  ctx.horgony('szolohegy', HC[0], HC[1] + 20, null, { tipus: 'regio' });
  return out;
}
