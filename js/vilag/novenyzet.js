// Kisüsti — növényzet és táj: erdők, fasorok, gyümölcsösök, kukoricás tömbök, bálák, fűcsomók, virágok.
// Minden ismétlődő elem InstancedMesh cellánként (Szoro), távolság szerint rejtve.
import * as THREE from 'three';
import { talaj, felulet, beepitett, utTav, vizben, terepY } from './terep.js';
import { F, BOUNDS, RIVER, PARC_ANG, parcella, hash2, fbm, SZAKASZOK, segDist } from './adat.js';
import { TEREP_BELSO } from './terep.js';

const N = n => 'nature-kit/' + n;
const LOMB = ['tree_default', 'tree_oak', 'tree_default_dark', 'tree_oak_dark'];
const NYAR = ['tree_tall', 'tree_thin'];

/** Kifejezett erdők és ligetek (a parcellás „erdő” táblák mellett). [x, z, w, d, sűrűség m] */
export const ERDOK = [
  [-90, -335, 170, 70, 7],     // a Szőlőhegy déli lába: az erdész erdeje
  [-30, -260, 50, 90, 7],
  [-380, -150, 70, 260, 8],    // nyugati erdősáv
  [-395, 330, 60, 220, 8],
  [80, 400, 260, 70, 8],       // déli erdő
  [660, -300, 120, 200, 8],    // keleti dombok
  [460, -380, 200, 60, 8],
  [120, -400, 200, 40, 8],
];

/** Fák és táj szórása a teljes térképen. */
export function epitNovenyzet(ctx) {
  const R = ctx.rnd, S = ctx.szoro;
  const tilos = (x, z, pad = 2) =>
    beepitett(x, z, pad) || utTav(x, z) < 3 + pad || vizben(x, z) || Math.abs(x - RIVER.x) < RIVER.width / 2 + 3 || ctx.utk.inside(x, z, pad);
  const fa = (key, x, z, s, layer = 'fa', shadow = true) => {
    const y = talaj(x, z) - 0.05;
    const tint = new THREE.Color().setHSL(0.2 + (R() - 0.5) * 0.1, 0.3, 0.82 + R() * 0.16);
    S.add(N(key), x, y, z, s, R() * 6.28, { layer, shadow, color: tint.getHex() });
  };
  let nFa = 0;
  // 1. kifejezett erdők (szabálytalan szél: zajjal ritkítva)
  for (const [cx, cz, w, d, step] of ERDOK) {
    for (let x = cx - w / 2; x < cx + w / 2; x += step) for (let z = cz - d / 2; z < cz + d / 2; z += step) {
      const px = x + (R() - 0.5) * step * 0.9, pz = z + (R() - 0.5) * step * 0.9;
      const ex = Math.min(px - (cx - w / 2), cx + w / 2 - px, pz - (cz - d / 2), cz + d / 2 - pz);
      if (ex < 12 * fbm(px * 0.05, pz * 0.05)) continue;
      if (tilos(px, pz, 1)) continue;
      fa(LOMB[Math.floor(R() * LOMB.length)], px, pz, 4.2 + R() * 2.2); nFa++;
    }
  }
  // 2. parcellás erdők és a táblák szélén bokorsor / nyárfasor
  const B = BOUNDS;
  for (let x = B.x0 + 4; x < B.x1; x += 9) for (let z = B.z0 + 4; z < B.z1; z += 9) {
    const px = x + (R() - 0.5) * 7, pz = z + (R() - 0.5) * 7;
    if (tilos(px, pz, 3)) continue;
    const k = felulet(px, pz);
    if (k === F.ERDO) { fa(LOMB[Math.floor(R() * LOMB.length)], px, pz, 4 + R() * 2.4); nFa++; }
  }
  // mezsgyék: a parcellahatárok egy részén fasor vagy bokorsor
  const C = Math.cos(PARC_ANG), Sn = Math.sin(PARC_ANG);
  for (let i = Math.floor((B.x0 - 200) / 46); i < (B.x1 + 200) / 46; i++) {
    const h = hash2(i, 99); if (h > 0.32) continue;
    const u = i * 46, nyar = h < 0.12;
    for (let v = -700; v < 700; v += nyar ? 6.5 : 4.5) {
      const px = u * C - v * Sn, pz = u * Sn + v * C;
      if (px < B.x0 || px > B.x1 || pz < B.z0 || pz > B.z1) continue;
      if (tilos(px, pz, 4) || fbm(px * 0.02, pz * 0.02 + i) < 0.42) continue;
      if (nyar) { fa(NYAR[Math.floor(R() * 2)], px + (R() - 0.5), pz, 5.5 + R() * 1.6); nFa++; }
      else if (R() < 0.6) S.add(N(R() < 0.5 ? 'plant_bushLarge' : 'plant_bushDetailed'), px, talaj(px, pz) - 0.1, pz, 5 + R() * 3, R() * 6, { layer: 'bokor', color: 0xd8e0c0 });
      else { fa(R() < 0.5 ? 'tree_default' : 'tree_small', px, pz, 3.6 + R() * 1.6); nFa++; }
    }
  }
  // 3. fasorok az utak mentén (diófa, akác) a falvakon kívül
  for (const Sg of SZAKASZOK) {
    const L = Math.hypot(Sg.bx - Sg.ax, Sg.bz - Sg.az), ux = (Sg.bx - Sg.ax) / L, uz = (Sg.bz - Sg.az) / L;
    for (const side of [-1, 1]) for (let s = 4; s < L; s += 13 + R() * 9) {
      const off = Sg.w / 2 + 3.2 + R() * 1.5, px = Sg.ax + ux * s - uz * off * side, pz = Sg.az + uz * s + ux * off * side;
      if (tilos(px, pz, 0.5) || R() < 0.3) continue;
      fa(R() < 0.55 ? 'tree_default' : 'tree_oak', px, pz, 4.2 + R() * 1.8); nFa++;
    }
  }
  // 4. a játéktér széle: sűrű erdőgyűrű (a köd mögött a horizont)
  const ring = (x, z) => { if (!vizben(x, z) && Math.abs(x - RIVER.x) > 16) { fa(LOMB[Math.floor(R() * LOMB.length)], x, z, 5 + R() * 3, 'fa', false); nFa++; } };
  for (let x = B.x0 - 120; x < B.x1 + 120; x += 10) for (const z0 of [B.z0 - 20, B.z1 + 20]) for (let k = 0; k < 4; k++) ring(x + R() * 8, z0 + (z0 < 0 ? -1 : 1) * k * 22 + R() * 10);
  for (let z = B.z0 - 100; z < B.z1 + 100; z += 10) for (const x0 of [B.x0 - 20, B.x1 + 20]) for (let k = 0; k < 4; k++) ring(x0 + (x0 < 0 ? -1 : 1) * k * 22 + R() * 10, z + R() * 8);

  // 5. kukoricás: a tábla egy tömb (oldalán szárak, tetején lomb), a széleken valódi tövek
  const tomb = kukoricaTombok(ctx);
  // 6. bálák a tarlón
  let nBala = 0;
  for (let x = B.x0; x < B.x1; x += 23) for (let z = B.z0; z < B.z1; z += 23) {
    const px = x + R() * 18, pz = z + R() * 18;
    if (felulet(px, pz) !== F.TARLO || tilos(px, pz, 3) || R() < 0.55) continue;
    S.addGeo('bala', balaGeo(), px, talaj(px, pz) + 0.62, pz, 1, R() * 6, { layer: 'kozep', rz: 0 }); nBala++;
  }
  // 7. fűcsomók, virágok, kövek (közelre, csoportokban): réten, mezsgyén, az utak szélén, a falvakban
  let nKis = 0;
  for (let x = B.x0; x < B.x1; x += 6.5) for (let z = B.z0; z < B.z1; z += 6.5) {
    const px = x + R() * 6.5, pz = z + R() * 6.5, k = felulet(px, pz);
    if (k !== F.FU && k !== F.RET && k !== F.PADKA && k !== F.ERDO) continue;
    if (R() < 0.3 || vizben(px, pz) || ctx.utk.inside(px, pz, 0.4) || utTav(px, pz) < 0.6 || talaj(px, pz) - terepY(px, pz) > 0.2) continue;
    const r = R();
    S.addKlaszter(r < 0.42 ? 'fu' : r < 0.7 ? 'fu2' : r < 0.86 ? 'virag' : 'bokor', px, talaj(px, pz) - 0.04, pz, 0.85 + R() * 0.4, R() * 6.28); nKis++;
  }
  return { fak: nFa, bala: nBala, kis: nKis, kukorica: tomb };
}

let BALA = null;
function balaGeo() {
  if (BALA) return BALA;
  const geo = new THREE.CylinderGeometry(0.62, 0.62, 1.2, 16, 1); geo.rotateZ(Math.PI / 2);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d');
  c.fillStyle = '#c9ae6a'; c.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 900; i++) { c.strokeStyle = `rgba(${120 + Math.random() * 100},${100 + Math.random() * 70},40,0.5)`; c.beginPath(); const x = Math.random() * 128, y = Math.random() * 64; c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 6, y + 6); c.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  BALA = [{ geo, mat: new THREE.MeshStandardMaterial({ map: t, roughness: 1 }) }];
  return BALA;
}

// ---------------------------------------------------------------- kukoricás
function kukoricaTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d');
  c.clearRect(0, 0, 256, 128);
  for (let i = 0; i < 46; i++) {
    const x = i * 5.6 + Math.random() * 3, top = 4 + Math.random() * 18;
    c.strokeStyle = `rgb(${110 + Math.random() * 30},${130 + Math.random() * 30},${50 + Math.random() * 20})`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, 128); c.lineTo(x + (Math.random() - 0.5) * 3, top); c.stroke();
    for (let k = 0; k < 6; k++) {
      const y = top + 10 + k * 16 + Math.random() * 6, d = Math.random() < 0.5 ? -1 : 1, L = 10 + Math.random() * 12;
      c.strokeStyle = `rgb(${120 + Math.random() * 50},${140 + Math.random() * 30},${50 + Math.random() * 25})`; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + d * L * 0.6, y - 6, x + d * L, y + 4); c.stroke();
    }
    if (Math.random() < 0.6) { c.fillStyle = '#d8c070'; c.fillRect(x - 1, top - 4, 3, 6); }   // címer
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** A kukoricatáblák: a parcellán belüli téglalap, oldalai alfa-maszkos szár-textúrával, teteje lombos.
 *  Csak a 380 m-en belüli táblák kapnak tömböt (a távolabbiakat a terep színe adja). */
function kukoricaTombok(ctx) {
  const tex = kukoricaTex();
  const sideM = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
  const topM = new THREE.MeshStandardMaterial({ color: 0x7d8a3c, roughness: 0.95 });
  const C = Math.cos(PARC_ANG), Sn = Math.sin(PARC_ANG);
  const seen = new Set(); let n = 0;
  const H = 2.3;
  const sides = [], tops = [];
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 20) for (let z = BOUNDS.z0; z < BOUNDS.z1; z += 20) {
    const p = parcella(x, z); if (p.tipus !== F.KUKORICA) continue;
    const key = p.i + ':' + p.j; if (seen.has(key)) continue; seen.add(key);
    // a tábla belső téglalapja (u, v sávban), a tiltott részek miatt lépésenként építjük: 6 m-es szeletek
    const u0 = p.i * 46 + 2.4, u1 = (p.i + 1) * 46 - 2.4;
    const h = hash2(p.i, 7), v0 = (p.j - h) * 150 + 2.4, v1 = (p.j + 1 - h) * 150 - 2.4;
    const step = 6;
    let run = null;
    const flush = () => {
      if (!run) return;
      const [a, b] = run; run = null;
      // a téglalap sarkai (u0..u1 × a..b)
      const pt = (u, v) => [u * C - v * Sn, u * Sn + v * C];
      const P = [pt(u0, a), pt(u1, a), pt(u1, b), pt(u0, b)];
      for (let k = 0; k < 4; k++) { const A = P[k], Bp = P[(k + 1) % 4]; sides.push(fal(A, Bp, H)); }
      tops.push(teteje(P, H)); n++;
    };
    for (let v = v0; v < v1; v += step) {
      let ok = true;
      for (const uu of [u0, (u0 + u1) / 2, u1]) for (const vv of [v, v + step]) {
        const px = uu * C - vv * Sn, pz = uu * Sn + vv * C;
        if (px < BOUNDS.x0 + 10 || px > BOUNDS.x1 - 10 || pz < BOUNDS.z0 + 10 || pz > BOUNDS.z1 - 10 || beepitett(px, pz, 6) || utTav(px, pz) < 4 || Math.abs(px - RIVER.x) < 20) ok = false;
      }
      if (ok) { if (!run) run = [v, v + step]; else run[1] = v + step; } else flush();
    }
    flush();
  }
  if (!sides.length) return 0;
  const sg = mergeQuads(sides), tg = mergeQuads(tops);
  const a = new THREE.Mesh(sg, sideM), b = new THREE.Mesh(tg, topM);
  a.castShadow = b.castShadow = true; a.receiveShadow = b.receiveShadow = true;
  a.name = 'kukorica-oldal'; b.name = 'kukorica-teto';
  ctx.scene.add(a, b);
  return n;
}
function fal(A, B, H) {
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.ceil(L / 4));
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t, y = terepY(x, z) - 0.1;
    pos.push(x, y, z, x, y + H + 0.15, z); uv.push(L * t / 6, 0, L * t / 6, 1);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  return { pos, uv, idx };
}
function teteje(P, H) {
  // rácsos tető (követi a terepet), enyhe hullámmal
  const pos = [], uv = [], idx = [], n = 10, m = 24;
  for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) {
    const a = i / n, b = j / m;
    const x = (P[0][0] * (1 - a) + P[1][0] * a) * (1 - b) + (P[3][0] * (1 - a) + P[2][0] * a) * b;
    const z = (P[0][1] * (1 - a) + P[1][1] * a) * (1 - b) + (P[3][1] * (1 - a) + P[2][1] * a) * b;
    pos.push(x, terepY(x, z) + H - 0.1 + Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.12, z); uv.push(a, b);
  }
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  return { pos, uv, idx };
}
function mergeQuads(list) {
  const pos = [], uv = [], idx = []; let o = 0;
  for (const q of list) { pos.push(...q.pos); uv.push(...q.uv); for (const i of q.idx) idx.push(i + o); o += q.pos.length / 3; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
