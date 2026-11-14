// Kisüsti — fűszálmező a kamera körül (közepes és magas minőség). A talaj közelről egy textúra volt; most
// a gyepen, réten, padkán, erdőalján, lucernán és tarlón tízezernyi szál nő, ami szélben hajlik, a tövénél
// sötétebb, a hegyénél napszítta. Egy rajzhívás (InstancedBufferGeometry), árnyékot fogad, nem vet.
// A mező 16 m-es csempékből áll; a csempe tartalma egyszer számolódik (gyorsítótár), a kamera mozgásakor
// csak a puffer áll össze újra. A szélső sávban a szálak összezsugorodnak (nincs látható határ).
import * as THREE from 'three';
import { F, hash2, fbm } from '../vilag/adat.js';
import { felulet, terepY, vizben } from '../vilag/terep.js';
import { SZEL, SZEL_GLSL } from './szel.js';

const CS = 16;   // csempeméret, m
const C = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
// felület → [sűrűség /m², magasság m, alapszín, szárazság]
const FELULET = {
  [F.FU]: [11, 0.3, C(92, 120, 50), 0.25], [F.RET]: [12, 0.44, C(104, 124, 54), 0.55], [F.PADKA]: [6, 0.26, C(100, 116, 58), 0.45],
  [F.ERDO]: [3.5, 0.34, C(66, 86, 38), 0.15], [F.KERT]: [3, 0.26, C(88, 112, 46), 0.2], [F.LUCERNA]: [9, 0.38, C(80, 120, 46), 0.1],
  [F.SZOLO]: [3, 0.26, C(106, 118, 58), 0.4], [F.TARLO]: [6, 0.14, C(176, 156, 96), 1.0],
  [F.GAZOS]: [4.5, 0.3, C(122, 124, 62), 0.8],   // elhanyagolt udvar (major): ritkább, szárazabb, foltos
};

function bladeGeo() {
  const g = new THREE.InstancedBufferGeometry();
  // 7 csúcs, 5 háromszög: széles tő, keskenyedő szál, hegyes vég (x: −0,5…0,5, y: 0…1)
  const P = [-0.5, 0, 0.5, 0, -0.42, 0.34, 0.42, 0.34, -0.26, 0.68, 0.26, 0.68, 0, 1];
  const pos = new Float32Array(21); for (let i = 0; i < 7; i++) { pos[i * 3] = P[i * 2]; pos[i * 3 + 1] = P[i * 2 + 1]; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(21).fill(0).map((_, i) => i % 3 === 2 ? 1 : 0), 3));
  g.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
  return g;
}

export class FuMezo {
  /** o: {sugar (m), max (szálak), utk (ütközők: épületbe ne nőjön), suruseg (szorzó)} */
  constructor(scene, o = {}) {
    this.R = o.sugar ?? 44; this.max = o.max ?? 90000; this.utk = o.utk || null; this.sur = o.suruseg ?? 1;
    this.cache = new Map(); this.kulcs = '';
    const g = bladeGeo();
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 4), 4); this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 4), 4); this.aCol.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', this.aPos); g.setAttribute('aCol', this.aCol); g.instanceCount = 0;
    this.geo = g;
    this.u = { uSugar: { value: this.R } };
    const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.u, { uSzelIdo: SZEL.ido, uSzelEro: SZEL.ero, uSzelIrany: SZEL.irany });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute vec4 aPos; attribute vec4 aCol; uniform float uSugar; varying vec3 vFuSzin; varying float vFuY;
${SZEL_GLSL}`)
        .replace('#include <beginnormal_vertex>', `
  float fuA = aPos.w * 6.2831853;
  vec3 objectNormal = normalize(mix(vec3(sin(fuA), 0.0, cos(fuA)), vec3(0.0, 1.0, 0.0), 0.72));`)
        .replace('#include <begin_vertex>', `
  float fuD = distance(cameraPosition.xz, aPos.xz);
  float fuF = 1.0 - smoothstep(uSugar * 0.62, uSugar, fuD);
  float fuH = aCol.w * fuF * (0.7 + 0.6 * fract(aPos.w * 7.31));
  float fuW = 0.045 * (0.8 + 0.5 * fract(aPos.w * 3.7)) * (fuF > 0.0 ? 1.0 : 0.0);
  float fuY = position.y;
  vec2 fuDir = vec2(cos(fuA), -sin(fuA));
  vec3 transformed = vec3(aPos.x, aPos.y, aPos.z);
  transformed.xz += fuDir * position.x * fuW;
  // hajlás: saját dőlés + szél, a hegy felé négyzetesen; a magasság ennyivel csökken (a szál hossza ~állandó)
  vec2 lean = vec2(cos(aPos.w * 41.0), sin(aPos.w * 41.0)) * 0.35;
  vec3 sz = szelEltol(aPos.xz, 1.0, 1.0, uSzelIdo) * 0.35;
  vec2 hj = (lean + sz.xz) * fuY * fuY * fuH;
  transformed.xz += hj;
  transformed.y += fuY * fuH - dot(hj, hj) * 0.5 / max(fuH, 0.05);
  vFuY = fuY; vFuSzin = aCol.rgb;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFuSzin; varying float vFuY;')
        .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb = vFuSzin * (0.72 + 0.5 * vFuY);`)
        // a kétoldalas lap hátoldala ne kapjon lefelé fordított normált (attól lett fekete a szál): a normál mindig a csúcsé
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );');
    };
    m.customProgramCacheKey = () => 'fumezo';
    this.mat = m;
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.castShadow = false; this.mesh.matrixAutoUpdate = false;
    this.mesh.name = 'fumezo';
    scene.add(this.mesh);
  }
  /** Egy csempe szálai: Float32Array [x,y,z,rnd, r,g,b,h] szálanként. */
  csempe(i, j) {
    const k = i + ':' + j; let t = this.cache.get(k); if (t) return t;
    const x0 = i * CS, z0 = j * CS, out = [];
    const hy = new Float32Array(9 * 9);
    for (let b = 0; b <= 8; b++) for (let a = 0; a <= 8; a++) hy[b * 9 + a] = terepY(x0 + a * 2, z0 + b * 2);
    const col = new THREE.Color();
    for (let cz = 0; cz < CS; cz++) for (let cx = 0; cx < CS; cx++) {
      const px = x0 + cx + 0.5, pz = z0 + cz + 0.5;
      const fk = FELULET[felulet(px, pz)]; if (!fk) continue;
      if (this.utk && this.utk.inside(px, pz, 0.25)) continue;
      if (vizben(px, pz)) continue;
      // foltosság: a sűrűség zajjal változik (kopott és dús foltok)
      const folt = fbm(px * 0.09, pz * 0.09);
      const n = Math.round(fk[0] * this.sur * (0.45 + folt * 0.9) * (0.75 + hash2(cx + i * 31, cz + j * 17) * 0.5));
      for (let q = 0; q < n; q++) {
        const r1 = hash2(Math.floor(px * 13) + q * 7, Math.floor(pz * 11) - q * 3), r2 = hash2(Math.floor(pz * 17) + q, Math.floor(px * 7) + q * 13);
        const x = px - 0.5 + r1, z = pz - 0.5 + r2;
        const ax = (x - x0) / 2, az = (z - z0) / 2, ia = Math.min(7, Math.floor(ax)), ib = Math.min(7, Math.floor(az)), fx = ax - ia, fz = az - ib;
        const y = (hy[ib * 9 + ia] * (1 - fx) + hy[ib * 9 + ia + 1] * fx) * (1 - fz) + (hy[(ib + 1) * 9 + ia] * (1 - fx) + hy[(ib + 1) * 9 + ia + 1] * fx) * fz - 0.03;
        const dry = Math.min(1, fk[3] * (0.5 + fbm(x * 0.05 + 7, z * 0.05) * 1.1) + hash2(q, Math.floor(x * 5)) * 0.15);
        col.copy(fk[2]).lerp(C(150, 140, 74), dry * 0.55).multiplyScalar(0.85 + hash2(Math.floor(x * 9), q) * 0.3);
        out.push(x, y, z, hash2(Math.floor(x * 31), Math.floor(z * 29)), col.r, col.g, col.b, fk[1] * (0.6 + folt * 0.8));
      }
    }
    t = new Float32Array(out); this.cache.set(k, t);
    if (this.cache.size > 400) this.cache.delete(this.cache.keys().next().value);
    return t;
  }
  /** cam: a kamera helye. budget: legfeljebb ennyi új csempe számolódik egy hívásban. */
  update(cam, budget = 3) {
    const ci = Math.floor(cam.x / CS), cj = Math.floor(cam.z / CS), r = Math.ceil(this.R / CS);
    const kulcs = ci + ':' + cj;
    if (kulcs === this.kulcs && !this.hianyos) return;
    const list = [];
    let uj = 0, hianyos = false;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      // a csempe legközelebbi pontja a sugáron belül?
      const dx = Math.max(i * CS - cam.x, 0, cam.x - (i + 1) * CS), dz = Math.max(j * CS - cam.z, 0, cam.z - (j + 1) * CS);
      if (dx * dx + dz * dz > this.R * this.R) continue;
      if (!this.cache.has(i + ':' + j)) { if (uj >= budget) { hianyos = true; continue; } uj++; }
      list.push(this.csempe(i, j));
    }
    this.hianyos = hianyos; this.kulcs = kulcs;
    const P = this.aPos.array, Cc = this.aCol.array;
    let n = 0;
    for (const t of list) {
      const m = Math.min(t.length / 8, this.max - n);
      for (let q = 0; q < m; q++) {
        const s = q * 8, d = (n + q) * 4;
        P[d] = t[s]; P[d + 1] = t[s + 1]; P[d + 2] = t[s + 2]; P[d + 3] = t[s + 3];
        Cc[d] = t[s + 4]; Cc[d + 1] = t[s + 5]; Cc[d + 2] = t[s + 6]; Cc[d + 3] = t[s + 7];
      }
      n += m; if (n >= this.max) break;
    }
    this.geo.instanceCount = n; this.n = n;
    this.aPos.clearUpdateRanges(); this.aPos.addUpdateRange(0, n * 4); this.aPos.needsUpdate = true;
    this.aCol.clearUpdateRanges(); this.aCol.addUpdateRange(0, n * 4); this.aCol.needsUpdate = true;
  }
  /** Az összes csempe azonnali kiszámítása (betöltéskor, teleport után). */
  mostMind(cam) { this.kulcs = ''; this.update(cam, 1e9); }
  dispose() { this.mesh.removeFromParent(); this.geo.dispose(); this.mat.dispose(); }
}
