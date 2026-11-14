// Kisüsti — utak (aszfalt Fő út, foltozott régi aszfalt, földút füves középsávval), terek burkolata,
// folyó és híd, vasút, villanyoszlopok vezetékkel. A textúrák vászonra rajzoltak (nincs külső kép).
import * as THREE from 'three';
import { talaj, terepY, vizszint, HID } from './terep.js';
import { SZAKASZOK, SZAKASZOK_MIND, TEREK, VASUT, RIVER, F, hash2, segDist } from './adat.js';
import { NODES } from '../../data/regions.js';
import { prop } from './betolto.js';
import { doboz, henger, oszlopGeo } from './epulet.js';
import { mat, recolorMaterial } from './paletta.js';
import { EG_U } from './eg.js';

// ---------------------------------------------------------------- textúrák
function vaszon(w, h, fn) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); fn(c, w, h);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function szemcse(c, w, h, n, col, a0, a1, s0 = 1, s1 = 3) {
  for (let i = 0; i < n; i++) { const s = s0 + Math.random() * (s1 - s0); c.fillStyle = `rgba(${col},${a0 + Math.random() * (a1 - a0)})`; c.fillRect(Math.random() * w, Math.random() * h, s, s); }
}
/** Aszfalt (u: keresztben 0..1, v: 12 m hosszanként). Szaggatott felezővonal, folytonos szélső vonal. */
function aszfaltTex() {
  return vaszon(128, 512, (c, w, h) => {
    c.fillStyle = '#5b5b59'; c.fillRect(0, 0, w, h);
    szemcse(c, w, h, 9000, '30,30,30', 0.1, 0.35); szemcse(c, w, h, 5000, '150,150,145', 0.08, 0.25);
    // keréknyomok (világosabb, kopott)
    for (const u of [0.2, 0.38, 0.62, 0.8]) { c.fillStyle = 'rgba(140,140,135,0.13)'; c.fillRect(u * w - 6, 0, 12, h); }
    // foltok
    for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(40,40,40,0.35)'; c.fillRect(Math.random() * w * 0.8, Math.random() * h, 20 + Math.random() * 30, 30 + Math.random() * 60); }
    // repedések
    c.strokeStyle = 'rgba(25,25,25,0.6)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 14; y += Math.random() * 10; c.lineTo(x, y); } c.stroke(); }
    // vonalak: szélső folytonos, felező szaggatott (3 m vonal / 9 m hézag)
    c.fillStyle = 'rgba(232,232,222,0.85)';
    c.fillRect(w * 0.035, 0, 3, h); c.fillRect(w * 0.965 - 3, 0, 3, h);
    c.fillRect(w / 2 - 2, 0, 4, h * 0.25);
  });
}
function regiTex() {
  return vaszon(128, 512, (c, w, h) => {
    c.fillStyle = '#6c6a64'; c.fillRect(0, 0, w, h);
    szemcse(c, w, h, 9000, '35,35,32', 0.1, 0.3); szemcse(c, w, h, 6000, '170,165,150', 0.08, 0.3);
    for (let i = 0; i < 7; i++) { const v = 44 + Math.random() * 26; c.fillStyle = `rgba(${v},${v},${v * 0.96},0.55)`; c.fillRect(Math.random() * w * 0.7, Math.random() * h, 18 + Math.random() * 40, 20 + Math.random() * 70); }
    c.strokeStyle = 'rgba(30,30,28,0.6)';
    for (let i = 0; i < 10; i++) { c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (Math.random() - 0.5) * 18; y += Math.random() * 12; c.lineTo(x, y); } c.stroke(); }
    // töredezett szél: átlátszó csipkék (alphaTest)
    const d = c.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, e = Math.min(u, 1 - u), lim = 0.03 + 0.05 * hash2(Math.floor(y / 6), x < w / 2 ? 1 : 2);
      if (e < lim) d.data[(y * w + x) * 4 + 3] = 0;
    }
    c.putImageData(d, 0, 0);
  });
}
function foldTex() {
  return vaszon(128, 512, (c, w, h) => {
    c.fillStyle = '#8b7556'; c.fillRect(0, 0, w, h);
    szemcse(c, w, h, 8000, '60,48,32', 0.1, 0.35); szemcse(c, w, h, 5000, '190,170,130', 0.1, 0.3);
    // két keréknyom (sötétebb, tömörebb), középen és a széleken fű
    for (const u of [0.28, 0.72]) { const g = c.createLinearGradient((u - 0.12) * w, 0, (u + 0.12) * w, 0); g.addColorStop(0, 'rgba(90,72,50,0)'); g.addColorStop(0.5, 'rgba(90,72,50,0.55)'); g.addColorStop(1, 'rgba(90,72,50,0)'); c.fillStyle = g; c.fillRect((u - 0.12) * w, 0, 0.24 * w, h); }
    for (let i = 0; i < 1800; i++) { const u = 0.5 + (Math.random() - 0.5) * 0.16; c.fillStyle = `rgba(${80 + Math.random() * 40},${110 + Math.random() * 40},${50 + Math.random() * 20},0.8)`; c.fillRect(u * w, Math.random() * h, 2, 3 + Math.random() * 4); }
    for (let i = 0; i < 2600; i++) { const s = Math.random() < 0.5 ? Math.random() * 0.1 : 1 - Math.random() * 0.1; c.fillStyle = `rgba(${80 + Math.random() * 40},${110 + Math.random() * 40},${50 + Math.random() * 20},0.85)`; c.fillRect(s * w, Math.random() * h, 2, 3 + Math.random() * 4); }
    const d = c.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, e = Math.min(u, 1 - u), lim = 0.02 + 0.07 * hash2(Math.floor(y / 5), x < w / 2 ? 3 : 4);
      if (e < lim) d.data[(y * w + x) * 4 + 3] = 0;
    }
    c.putImageData(d, 0, 0);
  });
}
function kockakoTex() {   // térkő (piactér, főtér)
  return vaszon(256, 256, (c, w, h) => {
    c.fillStyle = '#8f877a'; c.fillRect(0, 0, w, h);
    const s = 32;
    for (let y = 0; y < h; y += s / 2) for (let x = -(y / (s / 2) % 2) * s / 2; x < w; x += s) {
      const v = 120 + Math.random() * 40;
      c.fillStyle = `rgb(${v + 14},${v + 6},${v - 6})`; c.fillRect(x + 1.5, y + 1.5, s - 3, s / 2 - 3);
      szemcse(c, w, h, 0, '0,0,0', 0, 0);
    }
    szemcse(c, w, h, 6000, '40,36,30', 0.05, 0.25); szemcse(c, w, h, 3000, '200,190,170', 0.05, 0.2);
  });
}
function betonTex() {   // a major betonja: 4 × 4 tábla (egy tábla 7 m), mindegyik más: tónus, folt, repedés, letört sarok
  // (korábban egy 7 m-es csempe ismétlődött — ugyanaz a repedés minden táblán, gépies rács)
  const N = 4;
  return vaszon(1024, 1024, (c, w, h) => {
    const T = w / N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x0 = i * T, y0 = j * T, v = 134 + Math.random() * 22 - (i + j) % 3 * 3;
      c.fillStyle = `rgb(${v | 0},${(v * 0.98) | 0},${(v * 0.92) | 0})`; c.fillRect(x0, y0, T, T);
      for (let k = 0; k < 3 + Math.random() * 4; k++) {   // lágy foltok (víz, olaj, por)
        const r = 20 + Math.random() * 70, g = c.createRadialGradient(0, 0, 0, 0, 0, r), sot = Math.random() < 0.7;
        const col = sot ? '62,60,52' : '196,190,174', a = sot ? 0.12 + Math.random() * 0.16 : 0.1 + Math.random() * 0.12;
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        c.save(); c.beginPath(); c.rect(x0, y0, T, T); c.clip(); c.translate(x0 + Math.random() * T, y0 + Math.random() * T); c.scale(1, 0.5 + Math.random()); c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r); c.restore();
      }
      if (Math.random() < 0.18) {   // olajfolt
        c.save(); c.translate(x0 + 40 + Math.random() * (T - 80), y0 + 40 + Math.random() * (T - 80)); c.scale(1, 0.6 + Math.random() * 0.4);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 34); g.addColorStop(0, 'rgba(28,26,24,0.55)'); g.addColorStop(0.7, 'rgba(34,32,28,0.3)'); g.addColorStop(1, 'rgba(34,32,28,0)'); c.fillStyle = g; c.fillRect(-34, -34, 68, 68); c.restore();
      }
      c.strokeStyle = 'rgba(34,32,28,0.75)'; c.lineWidth = 1.4;
      const nrep = Math.random() < 0.35 ? 0 : 1 + (Math.random() < 0.35 ? 1 : 0);
      for (let k = 0; k < nrep; k++) {   // repedés: a tábla széléről indul, elágazással
        let x = x0 + (Math.random() < 0.5 ? 2 : T - 2), y = y0 + Math.random() * T; if (Math.random() < 0.5) [x, y] = [x0 + Math.random() * T, y0 + (Math.random() < 0.5 ? 2 : T - 2)];
        const dx = (x0 + T / 2 - x) / T, dy = (y0 + T / 2 - y) / T; c.beginPath(); c.moveTo(x, y);
        for (let q = 0; q < 8 + Math.random() * 8; q++) { x += dx * 22 + (Math.random() - 0.5) * 16; y += dy * 22 + (Math.random() - 0.5) * 16; c.lineTo(x, y); if (q === 4 && Math.random() < 0.5) { c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 50); c.moveTo(x, y); } }
        c.stroke();
      }
      if (Math.random() < 0.3) {   // letört sarok: sötétebb, kavicsos mélyedés
        const sx = Math.random() < 0.5 ? x0 : x0 + T, sy = Math.random() < 0.5 ? y0 : y0 + T, d = 18 + Math.random() * 26;
        c.fillStyle = 'rgba(92,86,74,0.85)'; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.sign(x0 + T / 2 - sx) * d, sy); c.lineTo(sx + Math.sign(x0 + T / 2 - sx) * d * 0.4, sy + Math.sign(y0 + T / 2 - sy) * d * 0.5); c.lineTo(sx, sy + Math.sign(y0 + T / 2 - sy) * d); c.fill();
      }
    }
    szemcse(c, w, h, 90000, '50,50,45', 0.05, 0.22); szemcse(c, w, h, 45000, '196,190,176', 0.05, 0.18);
    // dilatációs hézagok: sötét, kopott perem; benne csak szakaszosan moha (nem folytonos zöld vonal)
    for (let k = 0; k < N; k++) {
      const p = k * T;
      c.fillStyle = 'rgba(52,50,44,0.7)'; c.fillRect(0, p, w, 2); c.fillRect(p, 0, 2, h);
      c.fillStyle = 'rgba(120,116,104,0.3)'; c.fillRect(0, p + 2, w, 1); c.fillRect(p + 2, 0, 1, h);
    }
    for (let i = 0; i < 40; i++) {
      const t = Math.random() * w, L = 6 + Math.random() * 30, vert = i % 2, p = Math.floor(Math.random() * N) * T;
      c.fillStyle = `rgba(${74 + Math.random() * 24},${84 + Math.random() * 22},${42 + Math.random() * 12},${0.35 + Math.random() * 0.35})`;
      if (vert) c.fillRect(p, t, 2 + Math.random() * 2, L); else c.fillRect(t, p, L, 2 + Math.random() * 2);
    }
  });
}
function udvarTex() {   // döngölt föld: lágy foltok, apró kavics, keréknyom nélkül
  return vaszon(256, 256, (c, w, h) => {
    c.fillStyle = '#978660'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 30); const v = Math.random() < 0.5 ? '120,104,72' : '170,152,112'; g.addColorStop(0, `rgba(${v},0.35)`); g.addColorStop(1, `rgba(${v},0)`); c.save(); c.translate(Math.random() * w, Math.random() * h); c.fillStyle = g; c.fillRect(-30, -30, 60, 60); c.restore(); }
    szemcse(c, w, h, 3000, '80,68,48', 0.05, 0.18, 1, 2); szemcse(c, w, h, 900, '190,176,144', 0.15, 0.35, 1, 2.5);
  });
}
function kavicsTex() {
  return vaszon(128, 128, (c, w, h) => {
    c.fillStyle = '#6f675c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 70 + Math.random() * 90; c.fillStyle = `rgb(${v},${v * 0.95},${v * 0.88})`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 2 + Math.random() * 2); }
  });
}

// ---------------------------------------------------------------- szalag-háló az úton
/** Út-szalag a talajra simítva. v: méterben (a textúra ismétlése vRep m-enként). */
function szalag(ax, az, bx, bz, w, yOff, ext, vRep) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
  const sx = ax - ux * ext, sz = az - uz * ext, len = L + 2 * ext;
  const n = Math.max(2, Math.ceil(len / 2.5)) + 1, cols = 5;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), cx = sx + ux * len * t, cz = sz + uz * len * t;
    for (let k = 0; k < cols; k++) {
      const s = k / (cols - 1) - 0.5, x = cx + nx * w * s, z = cz + nz * w * s;
      pos.push(x, talaj(x, z) + yOff, z); uv.push(k / (cols - 1), len * t / vRep);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < cols - 1; k++) { const a = i * cols + k, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Elforgatott téglalap a talajra simítva (terek burkolata). */
function folt(x, z, w, d, ry, yOff, rep, lokal = false) {
  const c = Math.cos(ry), s = Math.sin(ry), nx = Math.max(2, Math.ceil(w / 2)) + 1, nz = Math.max(2, Math.ceil(d / 2)) + 1;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const lx = (i / (nx - 1) - 0.5) * w, lz = (j / (nz - 1) - 0.5) * d, X = x + lx * c + lz * s, Z = z - lx * s + lz * c;
    pos.push(X, talaj(X, Z) + yOff, Z); if (lokal) uv.push(lx / rep, lz / rep); else uv.push(X / rep, Z / rep);
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, cc = a + nx, dd = cc + 1; idx.push(a, cc, b, b, cc, dd); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function osszevon(geos) {
  let n = 0, ni = 0; for (const g of geos) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < g.index.count; i++) idx[oi++] = g.index.array[i] + o;
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  return geo;
}
const surf = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: o.po ?? -2, polygonOffsetUnits: o.po ?? -2, alphaTest: o.alpha ? 0.5 : 0, ...o.extra });

// ---------------------------------------------------------------- víz
// Periodikus hullám-magasságmezőből számolt normáltérkép (véletlen irányú, a csempére illeszkedő szinuszok),
// a shaderben két skálán, két irányba úsztatva; a fresnel-tag az ég színét (EG_U: a valódi égbolt színei)
// tükrözi, a napcsillanást a Standard anyag fénye adja. Közelről átlátszóbb, súrolva tükör.
export const vizAnyag = (() => {
  const S = 256, H = new Float32Array(S * S), hullamok = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 28; i++) { const kx = Math.round((rnd() - 0.5) * 2 * (2 + i * 0.6)), ky = Math.round((rnd() - 0.5) * 2 * (2 + i * 0.6)) || 1; hullamok.push([kx, ky, rnd() * 6.28, 1 / Math.hypot(kx, ky) ** 1.1]); }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let h = 0; for (const [kx, ky, f, a] of hullamok) h += Math.sin((kx * x + ky * y) / S * 6.2832 + f) * a; H[y * S + x] = h; }
  const nm = vaszon(S, S, (c, w, h) => {
    const d = c.createImageData(w, h), at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, L = Math.hypot(dx, dy, 1);
      const o = (y * w + x) * 4; d.data[o] = 128 - dx / L * 127; d.data[o + 1] = 128 - dy / L * 127; d.data[o + 2] = 128 + 127 / L; d.data[o + 3] = 255;
    }
    c.putImageData(d, 0, 0);
  });
  nm.colorSpace = THREE.NoColorSpace;
  const m = new THREE.MeshStandardMaterial({ color: 0x34482f, roughness: 0.22, metalness: 0.0, normalMap: nm, normalScale: new THREE.Vector2(0.3, 0.3), transparent: true, opacity: 0.9 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uEgTop: EG_U.top, uEgHor: EG_U.hor, uVizIdo: VIZ_IDO });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uEgTop, uEgHor; uniform float uVizIdo;')
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        `vec3 mapN1 = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	vec3 mapN2 = texture2D( normalMap, vNormalMapUv * 0.43 + vec2( 0.37, 0.11 ) + uVizIdo * vec2( -0.013, 0.021 ) ).xyz * 2.0 - 1.0;
	vec3 mapN = normalize( vec3( mapN1.xy + mapN2.xy, mapN1.z * mapN2.z ) );`)
      .replace('#include <opaque_fragment>', `{
		// a fresnel a simított normállal (a geometriáé felé húzva): a hullám ne szemcsézze a tükröt
		vec3 vV = normalize( vViewPosition );
		vec3 nS = normalize( mix( normal, normalize( vNormal ), 0.6 ) );
		float ndv = saturate( dot( nS, vV ) );
		float fr = 0.04 + 0.96 * pow( 1.0 - ndv, 5.0 );
		vec3 rW = transpose( mat3( viewMatrix ) ) * reflect( - vV, normal );
		// az ég tükörképe a víz színével tompítva (iszapos alföldi folyó, nem tengerkék)
		vec3 eg = mix( uEgHor, uEgTop, pow( saturate( rW.y ), 0.6 ) ) * vec3( 0.78, 0.86, 0.8 );
		outgoingLight = mix( outgoingLight, eg, min( fr * 0.75 + 0.05, 0.7 ) );
		diffuseColor.a = mix( 0.82, 0.97, saturate( 1.0 - ndv + fr ) );
	}
	#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'viz2';
  return m;
})();
const VIZ_IDO = { value: 0 };

const SIN_PAL = { nev: 'sin', rules: [[(r, g, b) => r > 170 && r - g > 40 && g - b > 15, [104, 84, 66], [241, 151, 108]], [(r, g, b) => b > r + 12 && b > g + 8, [128, 130, 134], [160, 168, 201]]] };
/** Az utak, terek, a folyó, a híd és a vasút. */
export function epitUtak(ctx) {
  const scene = ctx.scene, out = {};
  const by = { fo: [], regi: [], fold: [] };
  for (const S of SZAKASZOK_MIND) {
    const yo = S.tipus === 'fo' ? 0.07 : S.tipus === 'regi' ? 0.055 : 0.045;
    by[S.tipus].push(szalag(S.ax, S.az, S.bx, S.bz, S.w, yo, S.tipus === 'fo' ? S.w * 0.3 : S.w * 0.5, 12));
  }
  const M = { fo: surf(aszfaltTex(), { po: -4 }), regi: surf(regiTex(), { po: -3, alpha: true }), fold: surf(foldTex(), { po: -2, alpha: true }) };
  for (const k in by) if (by[k].length) {
    const me = new THREE.Mesh(osszevon(by[k]), M[k]); me.receiveShadow = true; me.name = 'ut:' + k; scene.add(me);
  }
  // terek
  const TM = { [F.BURKOLAT]: surf(kockakoTex(), { po: -5 }), [F.BETON]: surf(betonTex(), { po: -5 }), [F.UDVAR]: surf(udvarTex(), { po: -5 }) };
  const REP = { [F.BURKOLAT]: 4, [F.BETON]: 28, [F.UDVAR]: 6 };   // a beton csempéje 4 × 4 tábla (7 m)
  const tg = {};
  for (const t of TEREK) if (TM[t.kod]) (tg[t.kod] ||= []).push(folt(t.x, t.z, t.w, t.d, t.ry, t.yo ?? (t.kod === F.UDVAR ? 0.03 : 0.05), REP[t.kod], t.kod === F.BETON));   // a beton hézagai a tér tengelyéhez igazodnak
  for (const k in tg) { const me = new THREE.Mesh(osszevon(tg[k]), TM[k]); me.receiveShadow = true; scene.add(me); }

  // ---- folyó: vízfelület a meder fölött, hullámzó normáltérképpel
  {
    const pos = [], uv = [], idx = [], n = 400, z0 = -1500, z1 = 1500, hw = RIVER.width / 2 + 2.5;
    for (let i = 0; i <= n; i++) {
      const z = z0 + (z1 - z0) * i / n, y = vizszint(z);
      for (const s of [-1, 0, 1]) { pos.push(RIVER.x + s * hw, y, z); uv.push((s + 1) * 1.5, z / 8); }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 1, c = a + 3, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const viz = new THREE.Mesh(g, vizAnyag); viz.name = 'folyo'; viz.receiveShadow = true; scene.add(viz);
    ctx.frissitok.push(dt => { vizAnyag.normalMap.offset.y -= dt * 0.05; vizAnyag.normalMap.offset.x += dt * 0.004; VIZ_IDO.value += dt; });
    out.viz = viz;
  }
  // ---- híd: betonpálya, mellvéd korláttal, két pillér, hídfők
  {
    const g = new THREE.Group(), L = HID.x1 - HID.x0 + 6, cxh = (HID.x0 + HID.x1) / 2, zc = (HID.z0 + HID.z1) / 2, Wd = HID.z1 - HID.z0;
    const beton = 0xa29d92, sotet = 0x7d786f;
    doboz(g, cxh, HID.y - 0.45, zc, L, 0.9, Wd, beton);
    for (const s of [-1, 1]) {
      const zz = zc + s * (Wd / 2 - 0.2);
      doboz(g, cxh, HID.y + 0.42, zz, L, 0.85, 0.4, beton);
      doboz(g, cxh, HID.y + 0.88, zz, L, 0.08, 0.48, sotet);
      for (let x = HID.x0 - 2; x <= HID.x1 + 2; x += 2.2) henger(g, x, HID.y + 1.15, zz, 0.035, 0.5, 0x5a6066, 6);
      doboz(g, cxh, HID.y + 1.4, zz, L, 0.06, 0.06, 0x5a6066);
      ctx.utk.box(HID.x0 - 3, HID.x1 + 3, zz - 0.25, zz + 0.25);
    }
    const yb = vizszint(zc) - 2.5;
    for (const x of [cxh - 7, cxh + 7]) doboz(g, x, (HID.y - 0.9 + yb) / 2, zc, 1.6, HID.y - 0.9 - yb, Wd - 0.6, sotet);
    for (const x of [HID.x0 - 2.5, HID.x1 + 2.5]) doboz(g, x, (HID.y + yb) / 2 - 0.5, zc, 5, HID.y - yb, Wd + 1.4, beton);
    ctx.statikus(g, 'epulet');
  }
  // ---- folyópart: nád és sás a víz szélén, vízililiom a csendes részeken
  for (let z = -440; z < 470; z += 3.4) {
    if (Math.abs(z - 16.5) < 12) continue;
    for (const s of [-1, 1]) {
      if (ctx.rnd() < 0.35) continue;
      const x = RIVER.x + s * (RIVER.width / 2 + 0.3 + ctx.rnd() * 1.6), y = Math.max(terepY(x, z), vizszint(z));
      ctx.szoro.addKlaszter('nad', x, y - 0.05, z, 0.9 + ctx.rnd() * 0.5, ctx.rnd() * 6);
    }
    if (ctx.rnd() < 0.12) { const x = RIVER.x + (ctx.rnd() - 0.5) * 12; ctx.szoro.add('nature-kit/lily_large', x, vizszint(z) + 0.02, z, 3, ctx.rnd() * 6, { layer: 'kis', shadow: false }); }
  }

  // ---- vasút: zúzottkő ágyazat, Kenney-sínpár talpfákkal, ütközőbak
  {
    const geos = [szalag(VASUT.x0 - 6, VASUT.z, VASUT.x1 + 40, VASUT.z, 4.2, 0.09, 0, 4)];
    const me = new THREE.Mesh(osszevon(geos), surf(kavicsTex(), { po: -3 })); me.receiveShadow = true; scene.add(me);
    const S = 2.1, L = 4 * S;
    for (let x = VASUT.x0; x < VASUT.x1 + 40; x += L) {
      const y = talaj(x + L / 2, VASUT.z) + 0.12;
      // a Kenney-talpfa lazacszínű, a sín liláskék: kátrányos fa és acélszürke
      ctx.szoro.add('train-kit/railroad-straight', x, y + 1.0 * S, VASUT.z, S, Math.PI / 2, { layer: 'kozep', vc: false, pal: 'sin', palMat: m => recolorMaterial(m, SIN_PAL) });
    }
    const g = new THREE.Group(); const yb = talaj(VASUT.x0, VASUT.z) + 0.1;
    doboz(g, VASUT.x0 - 1.4, yb + 0.5, VASUT.z, 0.5, 1, 2.6, 0x6a5040);
    doboz(g, VASUT.x0 - 1.1, yb + 1.0, VASUT.z, 0.3, 0.5, 2.8, 0xc23a2a);
    for (const s of [-0.6, 0.6]) henger(g, VASUT.x0 - 0.8, yb + 1.0, VASUT.z + s, 0.16, 0.3, 0x3a3a3a, 10).rotation.z = Math.PI / 2;
    ctx.statikus(g, 'kozep'); ctx.utk.box(VASUT.x0 - 1.8, VASUT.x0 - 0.6, VASUT.z - 1.4, VASUT.z + 1.4);
    out.vasutY = x => talaj(x, VASUT.z) + 0.12 + 0.2;
  }
  return out;
}

/** Villanyoszlopok a Fő út és a falusi utak mentén, belógó vezetékkel (egy LineSegments). A lámpás
 *  oszlopok a lakott részen éjjel égnek. */
export function epitOszlopok(ctx) {
  const parts = oszlopGeo(), wires = [], lamps = [];
  const sor = (ax, az, bx, bz, oldal, lakott, lepes = 38, tav = 4) => {
    const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * oldal * tav, nz = ux * oldal * tav;
    let prev = null;
    for (let s = 6; s < L - 4; s += lepes) {
      const x = ax + ux * s + nx, z = az + uz * s + nz;
      if (ctx.utk.inside(x, z, 0.6)) { prev = null; continue; }
      if (Math.abs(x - RIVER.x) < RIVER.width / 2 + 9) { prev = null; continue; }
      const y = talaj(x, z), ry = Math.atan2(-nx, -nz);
      ctx.szoro.addGeo('oszlop', parts, x, y, z, 1, ry, { layer: 'epulet' });
      ctx.utk.kor(x, z, 0.22);
      const lamp = lakott(x, z);
      if (lamp) { const lx = x - nx / tav * 1.45, lz = z - nz / tav * 1.45; ctx.lampa(lx, y + 6.42, lz, 11, 'falu'); }
      const tops = [-0.7, 0, 0.7].map(o => [x + Math.cos(ry) * o, y + 8.38, z - Math.sin(ry) * o]);
      if (prev) for (let k = 0; k < 3; k++) wires.push([prev[k], tops[k]]);
      prev = tops;
    }
  };
  const lakottFalu = (x, z) => (Math.hypot(x - 230, z - 16) < 110) || (Math.hypot(x - 230, z + 190) < 85) || (Math.hypot(x, z) < 40);
  for (const S of SZAKASZOK) {
    if (S.tipus === 'fo') sor(S.ax, S.az, S.bx, S.bz, -1, lakottFalu, S.a === 'kv_be' || S.b === 'kv_be' ? 34 : 38, S.w / 2 + 1.3);
    else if (S.tipus === 'regi') sor(S.ax, S.az, S.bx, S.bz, 1, lakottFalu, 34, S.w / 2 + 1.2);
  }
  // vezetékek: belógó láncgörbe, szakaszonként 8 pont
  const pos = [];
  for (const [a, b] of wires) {
    const span = Math.hypot(b[0] - a[0], b[2] - a[2]); if (span > 60) continue;
    let p = a;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, sag = 4 * t * (1 - t) * span * 0.018;
      const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t];
      pos.push(...p, ...q); p = q;
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.75 }));
  ls.name = 'vezetekek'; ctx.scene.add(ls);
  return ls;
}
export { NODES };
