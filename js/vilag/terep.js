// Kisüsti — domborzat és talaj. A magasság a data/regions.js height()-jéből jön; ehhez jön a folyómeder
// kivájása és a híd pályája. A terep darabolt (128 m-es cellák, 2 m-es rács), csúcsszínezett, a szántó
// barázdáit és a részletzajt a shader rajzolja (olcsó, és közelről sem mosott).
import * as THREE from 'three';
import { RIVER, BOUNDS } from '../../data/regions.js';
import { F, SZAKASZOK_MIND as SZAKASZOK, TEREK, BEEPITETT, VASUT, parcella, segDist, fbm, noise2, hash2, PARC_ANG } from './adat.js';
import { domborzat as height, vizszint, HID_Y } from './domborzat.js';
export { vizszint };

// ---------------------------------------------------------------- folyó: meder (a vízszint a domborzat.js-ben)
const HW = RIVER.width / 2, BANK = 7;
function meder(x, z, h) {
  const dx = Math.abs(x - RIVER.x);
  if (dx > HW + BANK) return h;
  if (dx > HW + 1 && Math.abs(z - 16.5) < 7.5) return h;   // a hídfők töltése (a Fő út nem süllyed a mederbe)
  const w = vizszint(z);
  if (dx < HW) return Math.min(h, w - 0.25 - 1.7 * (1 - (dx / HW) ** 2));
  const t = (dx - HW) / BANK, s = t * t * (3 - 2 * t);
  return Math.min(h, (w - 0.25) * (1 - s) + h * s);
}
/** A híd pályája (a Fő út a folyón). */
export const HID = { x0: 371, x1: 399, z0: 12.6, z1: 20.4, y: HID_Y };

/** További járható felületek (peron, rakodórámpa): [x0, x1, z0, z1, y]. A régióépítő tölti fel. */
export const PLATFORMOK = [];
/** Rámpák / lépcsők: [x0, x1, z0, z1, y0, y1] — a magasság z mentén y0-tól y1-ig nő. */
export const RAMPAK = [];
/** Talajmagasság (járható felület): domborzat + meder + híd + peronok. */
export function talaj(x, z) {
  if (x > HID.x0 && x < HID.x1 && z > HID.z0 && z < HID.z1) return HID.y;
  for (const p of PLATFORMOK) if (x > p[0] && x < p[1] && z > p[2] && z < p[3]) return p[4];
  for (const p of RAMPAK) if (x > p[0] && x < p[1] && z > p[2] && z < p[3]) return p[4] + (p[5] - p[4]) * (z - p[2]) / (p[3] - p[2]);
  return meder(x, z, height(x, z));
}
/** Csak a domborzat + meder (a híd nélkül) — a terephálóhoz. */
export function terepY(x, z) { return meder(x, z, height(x, z)); }
/** Vízben van-e a pont (a gyalogos és a jármű nem mehet be). */
export function vizben(x, z) {
  if (x > HID.x0 && x < HID.x1 && z > HID.z0 && z < HID.z1) return false;
  return Math.abs(x - RIVER.x) < HW + 1.2 && terepY(x, z) < vizszint(z) + 0.15;
}

// ---------------------------------------------------------------- felületi raszter (utak, terek)
const R0X = BOUNDS.x0 - 40, R0Z = BOUNDS.z0 - 40, RW = (BOUNDS.x1 - BOUNDS.x0) + 80, RD = (BOUNDS.z1 - BOUNDS.z0) + 80;
const RAS = new Uint8Array(RW * RD);
const rset = (x, z, k, prio = true) => {
  const i = Math.floor(x - R0X), j = Math.floor(z - R0Z);
  if (i < 0 || j < 0 || i >= RW || j >= RD) return;
  const o = j * RW + i; if (prio || !RAS[o]) RAS[o] = k;
};
// terek (elforgatott téglalapok)
for (const t of TEREK) {
  const c = Math.cos(t.ry), s = Math.sin(t.ry), R = Math.hypot(t.w, t.d) / 2;
  for (let x = Math.floor(t.x - R); x <= t.x + R; x++) for (let z = Math.floor(t.z - R); z <= t.z + R; z++) {
    const dx = x + 0.5 - t.x, dz = z + 0.5 - t.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < t.w / 2 && Math.abs(lz) < t.d / 2) rset(x + 0.5, z + 0.5, t.kod);
  }
}
// utak: padka, aztán a burkolat (a burkolat felülírja)
for (const pass of [0, 1]) for (const S of SZAKASZOK) {
  const hw = S.w / 2 + (pass ? 0 : 1.3);
  const x0 = Math.floor(Math.min(S.ax, S.bx) - hw), x1 = Math.ceil(Math.max(S.ax, S.bx) + hw);
  const z0 = Math.floor(Math.min(S.az, S.bz) - hw), z1 = Math.ceil(Math.max(S.az, S.bz) + hw);
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const d = segDist(x + 0.5, z + 0.5, S.ax, S.az, S.bx, S.bz).d;
    if (d < hw) rset(x + 0.5, z + 0.5, pass ? { fo: F.ASZFALT, regi: F.REGI, fold: F.FOLDUT }[S.tipus] : (S.tipus === 'fold' ? F.FOLDUT : F.PADKA), pass === 1);
  }
}
// sínek
for (let x = VASUT.x0 - 4; x < VASUT.x1; x++) for (let z = VASUT.z - 3; z <= VASUT.z + 3; z++) rset(x + 0.5, z + 0.5, F.SINEK);

/** Felületkód a ponton: út/tér a raszterből, különben beépített terület, parcella, rét. */
export function felulet(x, z) {
  const i = Math.floor(x - R0X), j = Math.floor(z - R0Z);
  if (i >= 0 && j >= 0 && i < RW && j < RD) { const k = RAS[j * RW + i]; if (k) return k; }
  if (Math.abs(x - RIVER.x) < HW + 2) return F.MEDER;
  for (const b of BEEPITETT) if ((x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) return F.FU;
  const p = parcella(x, z);
  if (p.edge) return F.RET;
  return p.tipus;
}
/** Beépített (régió-) területen van-e: ide nem kerül szántó, erdő. */
export function beepitett(x, z, pad = 0) { for (const b of BEEPITETT) if ((x - b.x) ** 2 + (z - b.z) ** 2 < (b.r + pad) ** 2) return true; return false; }
/** Úthoz (a burkolat szélétől) mért távolság. */
export function utTav(x, z) {
  let m = 1e9;
  for (const S of SZAKASZOK) { const d = segDist(x, z, S.ax, S.az, S.bx, S.bz).d - S.w / 2; if (d < m) m = d; }
  return m;
}

// ---------------------------------------------------------------- színek
const C = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
const SZIN = {
  [F.FU]: [C(98, 124, 58), C(122, 140, 70)], [F.RET]: [C(124, 138, 70), C(150, 150, 84)],
  [F.SZANTO]: [C(98, 76, 54), C(118, 92, 64)], [F.TARLO]: [C(184, 160, 100), C(204, 180, 118)],
  [F.KUKORICA]: [C(94, 88, 54), C(108, 98, 60)], [F.LUCERNA]: [C(82, 120, 52), C(96, 134, 60)],
  [F.UDVAR]: [C(146, 128, 94), C(160, 142, 104)], [F.BURKOLAT]: [C(140, 132, 120), C(150, 142, 128)],
  [F.BETON]: [C(126, 124, 116), C(146, 142, 132)], [F.MEDER]: [C(100, 92, 70), C(118, 106, 80)],
  [F.ERDO]: [C(64, 78, 42), C(80, 92, 50)], [F.KERT]: [C(96, 74, 52), C(110, 86, 60)],
  [F.SZOLO]: [C(110, 116, 62), C(126, 126, 70)], [F.PADKA]: [C(132, 124, 104), C(118, 124, 80)],
  [F.ASZFALT]: [C(90, 90, 88), C(96, 96, 92)], [F.REGI]: [C(104, 102, 96), C(110, 108, 100)],
  [F.FOLDUT]: [C(138, 118, 86), C(150, 128, 92)], [F.SINEK]: [C(110, 102, 92), C(120, 112, 100)],
};
const BARAZDA = { [F.SZANTO]: 1, [F.TARLO]: 0.45, [F.LUCERNA]: 0.3, [F.KUKORICA]: 0.6 };
const tmp = new THREE.Color();
// a talaj finom változatossága (KRITIKA-v3 10. „egytextúrás talaj”): taposott kopás az utak, terek szélén (foltosan,
// nem egyenletes sávban), dúsabb, sötétebb gyepfoltok. Csak a csúcsszínt írja (2 m-es rács): futásidőben ingyenes.
const KOPO = new Set([F.ASZFALT, F.REGI, F.FOLDUT, F.PADKA, F.BURKOLAT, F.UDVAR, F.BETON]);
const KOP_MINTA = [];
for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; KOP_MINTA.push([Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0.085], [Math.cos(a + 0.4) * 4.5, Math.sin(a + 0.4) * 4.5, 0.04]); }
function kopas(x, z) {
  let n = 0;
  for (const [dx, dz, w] of KOP_MINTA) {
    const i = Math.floor(x + dx - R0X), j = Math.floor(z + dz - R0Z);
    if (i >= 0 && j >= 0 && i < RW && j < RD && KOPO.has(RAS[j * RW + i])) n += w;
  }
  return Math.min(1, n);
}
const TAPOSOTT = C(128, 112, 80), DUS = C(66, 100, 42), GAZ_FOLD = C(122, 108, 80), GAZ_FU = C(118, 124, 66);
// PBR-réteg (v4): melyik fotótextúra a ponton — [fű, földút]; a maradék a föld (szántó, udvar, meder)
const FU_K = new Set([F.FU, F.RET, F.LUCERNA, F.ERDO, F.SZOLO]);
export const ANYAG = [0, 0];
function szin(x, z, out) {
  let k = felulet(x, z);
  ANYAG[0] = FU_K.has(k) ? 1 : k === F.GAZOS ? 0.55 : k === F.KUKORICA || k === F.TARLO ? 0.25 : 0;
  ANYAG[1] = k === F.FOLDUT || k === F.PADKA ? 1 : 0;
  if (k === F.ASZFALT || k === F.REGI) k = F.PADKA;          // az út alatti terep a padka színét kapja
  const pal = SZIN[k] || SZIN[F.FU];
  const n = fbm(x * 0.06, z * 0.06), n2 = noise2(x * 0.4, z * 0.4);
  out.copy(pal[0]).lerp(pal[1], Math.min(1, n * 1.2));
  if (k === F.FU || k === F.RET) {
    // száraz foltok és sötétebb, nedves mélyedések
    const dry = Math.max(0, fbm(x * 0.013 + 9, z * 0.013) - 0.55) * 1.8;
    out.lerp(tmp.setRGB(0.55, 0.5, 0.26), dry * 0.5);
    out.multiplyScalar(0.92 + n2 * 0.14);
    // dús, sötétebb foltok (mélyedés, lóhere), és taposott kopás az utak, terek peremén
    const dus = Math.max(0, fbm(x * 0.021 - 31, z * 0.021 + 17) - 0.56) * 2.6;
    out.lerp(DUS, Math.min(0.42, dus * 0.6));
    const kop = kopas(x, z);
    if (kop > 0) out.lerp(TAPOSOTT, Math.min(0.62, kop * Math.max(0, 0.45 + 1.1 * (fbm(x * 0.17 + 5, z * 0.17 - 3) - 0.5)) * 0.85));
  } else if (k === F.GAZOS) {
    // elhanyagolt udvar: taposott föld és száraz, gazos gyep szigetekben (nem egyenletes zöld pázsit)
    const f = fbm(x * 0.09 + 11, z * 0.09 - 4), t = Math.min(1, Math.max(0, (f - 0.46) / 0.2));
    out.copy(GAZ_FOLD).lerp(GAZ_FU, t * t * (3 - 2 * t)).multiplyScalar(0.92 + n2 * 0.14);
    const kop = kopas(x, z); if (kop > 0) out.lerp(TAPOSOTT, Math.min(0.5, kop * 0.6));   // a beton peremén letaposva
  } else if (k === F.SZANTO || k === F.TARLO || k === F.KUKORICA) {
    out.multiplyScalar(0.94 + n2 * 0.1);   // nedvesebb és szárazabb rögök
  }
  // árnyalat a magasság szerint (a domb teteje szárazabb)
  const h = height(x, z);
  if (h > 16) out.lerp(tmp.setRGB(0.42, 0.42, 0.2), Math.min(0.25, (h - 16) / 80));
  // a beépített területek széle felé fokozatosan
  return BARAZDA[k] || 0;
}

// ---------------------------------------------------------------- anyag (barázda + részletzaj a shaderben)
// Részlet-textúra (adat, nem szín): R = gyep (nyújtott zaj: szálazott, fésült hatás), G = föld (rögök és apró
// kavics), B = nagy foltok (a csempézés elrejtésére). Mind periodikus, a csempe széle nem látszik.
function detailTex() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const cx = cv.getContext('2d'), d = cx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // S = 512: minden osztó a 512 osztója, így a periódus egész (a csempe széle varrat nélküli)
    const gy = 0.45 * pnoise(x / 2, y / 8, 256, 64) + 0.3 * pnoise(x / 8, y / 8, 64) + 0.25 * pnoise(x / 2, y / 2, 256);
    const rog = pnoise(x / 16, y / 16, 32), kavics = pnoise(x / 2, y / 2, 256);
    const fo = 0.5 * Math.min(1, Math.max(0, (rog - 0.35) * 2.2)) + 0.35 * pnoise(x / 4, y / 4, 128) + 0.15 * (kavics > 0.78 ? 1 : 0);
    const mak = 0.6 * pnoise(x / 64, y / 64, 8) + 0.4 * pnoise(x / 32, y / 32, 16);
    const o = (y * S + x) * 4; d.data[o] = gy * 255; d.data[o + 1] = fo * 255; d.data[o + 2] = mak * 255; d.data[o + 3] = 255;
  }
  cx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace;
  return t;
}
function pnoise(x, y, P, Py = P) {   // periodikus értékzaj (P, Py: periódus cellában, egész)
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash2(((a % P) + P) % P | 0, ((b % Py) + Py) % Py | 0);
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// PBR-talaj (TERV-v4 2. pont): CC0 fotótextúrák (ASSETS.md), albedó + normál, 1K WebP
const TEX_UT = 'textures/talaj/';
function talajTex(nev, szin) {
  const t = new THREE.TextureLoader().load(new URL('../../' + TEX_UT + nev + '.webp', import.meta.url).href);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = szin ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
export function terepAnyag() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: detailTex() });
  const U = {
    tFu: { value: talajTex('fu_albedo', true) }, tFold: { value: talajTex('fold_albedo', true) }, tUt: { value: talajTex('ut_albedo', true) },
    nFu: { value: talajTex('fu_normal') }, nFold: { value: talajTex('fold_normal') }, nUt: { value: talajTex('ut_normal') },
    uRel: { value: 1 },   // a normáltérkép ereje
    uPbr: { value: 0 },   // a fotótextúra-ág: a Grafika „kozepes” szinttől kapcsolja be (alacsony szinten és a szoftveres
                          // renderelőn — a próbák swiftshaderén — a 12 mintavétel percekre lassította a képkockát)
  };
  m.userData.uRel = U.uRel; m.userData.uPbr = U.uPbr;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float barazda;\nattribute vec2 anyag;\nvarying float vBar;\nvarying vec2 vW;\nvarying vec2 vAny;\nvarying float vNy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBar = barazda;\nvAny = anyag;\nvNy = normal.y;\nvW = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vBar;\nvarying vec2 vW;\nvarying vec2 vAny;\nvarying float vNy;
uniform sampler2D tFu, tFold, tUt, nFu, nFold, nUt; uniform float uRel, uPbr;
vec3 pbrN; float pbrFade;
// két lépték, elforgatva és a nagy foltok szerint keverve: a csempézés nem ismétlődik láthatóan
vec4 ket(sampler2D t, vec2 w, float k) {
  vec2 a = w / 3.2, b = mat2(0.8, -0.6, 0.6, 0.8) * w / 7.9 + 0.37;
  return mix(texture2D(t, a), texture2D(t, b), k);
}`)
      .replace('#include <map_fragment>', '')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // részlet három skálán (1,6 m, 5 m, 36 m); a növényzet aránya a csúcsszín zöldségéből
          vec3 d1 = texture2D( map, vMapUv ).rgb, d2 = texture2D( map, vMapUv * 0.137 + 0.31 ).rgb, d3 = texture2D( map, vMapUv * 3.1 + 0.53 ).rgb;
          float fin = clamp( 1.0 - length( fwidth( vMapUv * 3.1 ) ) * 1.6, 0.0, 1.0 );
          float zold = clamp( ( diffuseColor.g - max( diffuseColor.r, diffuseColor.b ) ) * 9.0, 0.0, 1.0 );
          float gy = mix( d1.r, d1.r * 0.45 + d3.r * 0.55, fin ), fo = mix( d1.g, d1.g * 0.5 + d3.g * 0.5, fin );
          float det = mix( fo, gy, zold );
          diffuseColor.rgb *= 0.74 + 0.5 * det;
          diffuseColor.rgb *= mix( vec3( 0.92, 0.95, 0.9 ), vec3( 1.07, 1.04, 0.97 ), smoothstep( 0.25, 0.75, d2.b ) );
        }
        float pu = vW.x * ${Math.cos(PARC_ANG).toFixed(5)} + vW.y * ${Math.sin(PARC_ANG).toFixed(5)};
        float fw = fwidth(pu);
        float sv = 0.5 + 0.5 * sin(pu * 6.2832 / 0.95);
        float fade = 1.0 - smoothstep(0.15, 0.5, fw);
        diffuseColor.rgb *= mix(1.0, 0.7 + 0.5 * sv, vBar * fade);
        diffuseColor.rgb *= mix(1.0, 0.86, vBar * (1.0 - fade));
        pbrN = vec3(0.0);
        if (uPbr > 0.5) {
          // fotótextúra: a csúcsszín (paletta) marad a tónus, a textúra a saját átlagához mérve adja a részletet;
          // meredek rézsűn (horhos, töltés) föld/lösz látszik a fű helyett
          float kk = smoothstep(0.3, 0.7, texture2D(map, vMapUv * 0.137 + 0.31).b);
          float meredek = smoothstep(0.93, 0.8, vNy);
          float wFu = vAny.x * (1.0 - meredek), wUt = vAny.y * (1.0 - meredek), wFold = max(0.0, 1.0 - wFu - wUt);
          vec3 a = ket(tFu, vW, kk).rgb / vec3(0.378, 0.426, 0.189) * wFu + ket(tFold, vW, kk).rgb / vec3(0.517, 0.477, 0.413) * wFold + ket(tUt, vW, kk).rgb / vec3(0.554, 0.506, 0.388) * wUt;
          // a fű színét csak részben veszi át (a paletta napszakos tónusa megmarad), a föld többet
          vec3 lum = vec3(dot(a, vec3(0.333)));
          a = mix(lum, a, 0.35 + 0.4 * wFold);
          pbrFade = 1.0 - smoothstep(0.08, 0.6, length(fwidth(vW / 3.2)));
          diffuseColor.rgb *= mix(vec3(1.0), clamp(a, 0.25, 2.2), 0.35 + 0.6 * pbrFade);
          if (meredek > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.06, 0.82), meredek * 0.5);
          vec3 nn = (ket(nFu, vW, kk).xyz * 2.0 - 1.0) * wFu + (ket(nFold, vW, kk).xyz * 2.0 - 1.0) * wFold + (ket(nUt, vW, kk).xyz * 2.0 - 1.0) * wUt;
          pbrN = vec3(nn.x, 0.0, -nn.y) * uRel * pbrFade * 0.9;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + (viewMatrix * vec4(pbrN, 0.0)).xyz);`);
  };
  return m;
}

/** Egy terepdarab (x0..x0+size, z0..z0+size, step rácsosztással). skirt: lefelé hajló szegély (a távoli gyűrűhöz). */
export function terepDarab(x0, z0, size, step, material, skirt = false) {
  const n = Math.round(size / step) + 1, N = n * n + (skirt ? 4 * n : 0);
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3), uv = new Float32Array(N * 2), bar = new Float32Array(N), any = new Float32Array(N * 2);
  const c = new THREE.Color(), m = n + 2, H = new Float32Array(m * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) H[j * m + i] = terepY(x0 + (i - 1) * step, z0 + (j - 1) * step);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * step, z = z0 + j * step, o = j * n + i, hk = (j + 1) * m + i + 1;
    const y = H[hk];
    pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
    const nx = H[hk - 1] - H[hk + 1], nz = H[hk - m] - H[hk + m];
    const L = Math.hypot(nx, 2 * step, nz); nor[o * 3] = nx / L; nor[o * 3 + 1] = 2 * step / L; nor[o * 3 + 2] = nz / L;
    bar[o] = szin(x, z, c); any[o * 2] = ANYAG[0]; any[o * 2 + 1] = ANYAG[1];
    col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
    uv[o * 2] = x / 5; uv[o * 2 + 1] = z / 5;
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
    idx.push(a, cc, b, b, cc, d);
  }
  if (skirt) {
    // szegély: a négy oldal csúcsai 6 m-rel lejjebb
    const edges = [[...Array(n).keys()].map(i => i), [...Array(n).keys()].map(i => (n - 1) * n + i), [...Array(n).keys()].map(j => j * n), [...Array(n).keys()].map(j => j * n + n - 1)];
    let o = n * n;
    for (const E of edges) {
      const base = o;
      for (const v of E) { pos[o * 3] = pos[v * 3]; pos[o * 3 + 1] = pos[v * 3 + 1] - 6; pos[o * 3 + 2] = pos[v * 3 + 2]; nor[o * 3 + 1] = 1; col.copyWithin(o * 3, v * 3, v * 3 + 3); any.copyWithin(o * 2, v * 2, v * 2 + 2); o++; }
      for (let k = 0; k < n - 1; k++) idx.push(E[k], base + k, E[k + 1], E[k + 1], base + k, base + k + 1, E[k], E[k + 1], base + k, E[k + 1], base + k + 1, base + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('barazda', new THREE.BufferAttribute(bar, 1));
  g.setAttribute('anyag', new THREE.BufferAttribute(any, 2));
  g.setIndex(idx);
  g.computeBoundingSphere(); g.computeBoundingBox();
  const me = new THREE.Mesh(g, material);
  me.receiveShadow = true; me.matrixAutoUpdate = false;
  return me;
}

/** A teljes terep: belső rész 128 m-es darabokban 2 m-es ráccsal, a játéktéren kívül 256 m-es darabok 8 m-rel. */
export const TEREP_BELSO = { x0: -512, x1: 768, z0: -512, z1: 512 };
export function epitTerep(scene) {
  const m = terepAnyag(), g = new THREE.Group(); g.name = 'terep'; scene.add(g);
  const B = TEREP_BELSO;
  for (let x = B.x0; x < B.x1; x += 256) for (let z = B.z0; z < B.z1; z += 256) g.add(terepDarab(x, z, 256, 2, m));
  // a játéktéren kívüli gyűrű (a köd mögött a horizont): 8 m-es rács, négy sávba összevonva (4 rajzhívás)
  const E = 768, savok = [[B.x0 - E, B.z0 - E, B.x1 + E, B.z0], [B.x0 - E, B.z1, B.x1 + E, B.z1 + E], [B.x0 - E, B.z0, B.x0, B.z1], [B.x1, B.z0, B.x1 + E, B.z1]];
  for (const [x0, z0, x1, z1] of savok) {
    const parts = [];
    for (let x = x0; x < x1; x += 256) for (let z = z0; z < z1; z += 256) parts.push(terepDarab(x, z, 256, 8, m, true).geometry);
    const me = new THREE.Mesh(osszefuz(parts), m); me.receiveShadow = true; me.matrixAutoUpdate = false; g.add(me);
  }
  return { group: g, material: m };
}
function osszefuz(geos) {
  let n = 0, ni = 0; for (const q of geos) { n += q.attributes.position.count; ni += q.index.count; }
  const out = new THREE.BufferGeometry();
  for (const [a, k] of [['position', 3], ['normal', 3], ['color', 3], ['uv', 2], ['barazda', 1], ['anyag', 2]]) {
    const arr = new Float32Array(n * k); let o = 0; for (const q of geos) { arr.set(q.attributes[a].array, o); o += q.attributes[a].array.length; }
    out.setAttribute(a, new THREE.BufferAttribute(arr, k));
  }
  const idx = new Uint32Array(ni); let o = 0, v = 0;
  for (const q of geos) { const I = q.index.array; for (let i = 0; i < I.length; i++) idx[o++] = I[i] + v; v += q.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
  return out;
}
export { height };
