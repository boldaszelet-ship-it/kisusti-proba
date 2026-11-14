// Kisüsti — füst, tűz és vízsugár részecskék. Minden részecske pályája a csúcs-shaderben számolódik az időből
// és a fázisából (nincs CPU-oldali részecske-léptetés); a CPU félmásodpercenként csak azt dönti el, melyik
// kibocsátó van a kamera közelében. Típusonként egy rajzhívás. A köd és a napszak színe rájuk is hat.
import * as THREE from 'three';
import { SZEL } from './szel.js';

const TIPUS = {
  // élettartam (s), részecske/kibocsátó, kapacitás (kibocsátó)
  fust: { elet: 7.5, n: 16, kap: 40 },
  tuz: { elet: 0.75, n: 22, kap: 6 },
  viz: { elet: 1.3, n: 160, kap: 4 },
};

const VERT = `
attribute vec4 aEm; attribute vec4 aPar;
uniform float uIdo, uElet; uniform vec2 uSzelIrany;
varying vec2 vUv; varying float vAge; varying float vEro; varying float vSeed;
#include <fog_pars_vertex>
float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main(){
  float seed = aEm.w;
  float age = fract(uIdo / (uElet * (0.85 + 0.3 * h1(seed * 3.1))) + seed);
  vec3 p = aEm.xyz; float size;
  float ero = aPar.x;
#if TIPUS == 0
  // füst: emelkedik, szélirányba sodródik és tágul, kavarog
  float r = age * age;
  p.y += age * 5.5 * (0.8 + 0.4 * h1(seed * 5.0)) * aPar.y;
  p.xz += uSzelIrany * r * 5.0 * aPar.y + vec2(sin(age * 6.0 + seed * 40.0), cos(age * 5.0 + seed * 23.0)) * 0.35 * age;
  size = mix(0.35, 2.6, sqrt(age)) * aPar.y;
#elif TIPUS == 1
  // láng: gyors emelkedés, szűkülés, kis oldalirányú lobogás
  p.y += age * 0.75 * aPar.y;
  p.xz += vec2(h1(seed * 9.0) - 0.5, h1(seed * 7.0) - 0.5) * 0.45 * aPar.y * (1.0 - age) + vec2(sin(uIdo * 11.0 + seed * 30.0), cos(uIdo * 9.0 + seed * 20.0)) * 0.05 * age;
  size = mix(0.32, 0.06, age) * aPar.y;
#else
  // vízsugár: ferde hajítás körben, a medencébe hull vissza
  float a = h1(seed * 13.0) * 6.2831853, v = 2.6 + 0.6 * h1(seed * 17.0), tt = age * 1.1;
  vec3 v0 = vec3(cos(a) * 0.9, v, sin(a) * 0.9) * aPar.y;
  p += v0 * tt + vec3(0.0, -4.9 * tt * tt * aPar.y, 0.0);
  size = 0.16 * aPar.y * (0.7 + 0.6 * h1(seed * 2.0));
#endif
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  float rot = seed * 40.0 + age * (TIPUS == 0 ? 0.8 : 0.0);
  vec2 q = position.xy; q = vec2(q.x * cos(rot) - q.y * sin(rot), q.x * sin(rot) + q.y * cos(rot));
  mvPosition.xy += q * size;
  gl_Position = projectionMatrix * mvPosition;
  vUv = position.xy + 0.5; vAge = age; vEro = ero; vSeed = seed;
  #include <fog_vertex>
}`;

const FRAG = `
uniform vec3 uSzin, uSzin2; uniform float uIdo;
varying vec2 vUv; varying float vAge; varying float vEro; varying float vSeed;
#include <fog_pars_fragment>
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 c = vUv - 0.5; float r = length(c) * 2.0;
  if (r > 1.0) discard;
#if TIPUS == 0
  float n = vn(vUv * 3.0 + vSeed * 17.0) * 0.6 + vn(vUv * 7.0 - vSeed * 9.0) * 0.4;
  float a = smoothstep(1.0, 0.15, r) * (0.55 + 0.6 * n);
  a *= smoothstep(0.0, 0.08, vAge) * pow(1.0 - vAge, 1.5) * 0.42 * vEro;
  // alul (frissen) melegebb-sötétebb, fent a fény színét veszi fel
  vec3 col = mix(uSzin2, uSzin, smoothstep(0.0, 0.5, vAge) * 0.7 + (1.0 - r) * 0.3);
  gl_FragColor = vec4(col, a);
#elif TIPUS == 1
  float a = smoothstep(1.0, 0.0, r);
  vec3 col = mix(vec3(6.0, 3.6, 1.2), vec3(2.6, 0.55, 0.08), smoothstep(0.0, 0.7, vAge));
  gl_FragColor = vec4(col * a * (1.0 - vAge) * vEro, 1.0);
#else
  float a = smoothstep(1.0, 0.2, r) * 0.8 * (1.0 - vAge * 0.5) * vEro;
  gl_FragColor = vec4(uSzin * 1.25 + 0.15, a);
#endif
  #include <fog_fragment>
}`;

export class Reszecskek {
  constructor(scene) {
    this.scene = scene; this.emitterek = []; this.t = 0; this.valT = 1; this.meshes = {};
    this.u = { uIdo: { value: 0 }, uSzin: { value: new THREE.Color(0.8, 0.8, 0.8) }, uSzin2: { value: new THREE.Color(0.35, 0.33, 0.32) } };
    const quad = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0];
    Object.entries(TIPUS).forEach(([nev, T], ti) => {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(quad, 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
      const N = T.n * T.kap;
      const aEm = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), aPar = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
      aEm.setUsage(THREE.DynamicDrawUsage); aPar.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aEm', aEm); g.setAttribute('aPar', aPar); g.instanceCount = 0;
      const m = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uElet: { value: T.elet } }]), vertexShader: VERT, fragmentShader: FRAG,
        defines: { TIPUS: ti }, transparent: true, depthWrite: false, fog: true,
        blending: ti === 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      Object.assign(m.uniforms, this.u, { uSzelIrany: SZEL.irany });
      const me = new THREE.Mesh(g, m); me.frustumCulled = false; me.renderOrder = 5; me.name = 'reszecske:' + nev; me.matrixAutoUpdate = false;
      scene.add(me);
      this.meshes[nev] = { me, g, aEm, aPar, T };
    });
    this._v = new THREE.Vector3();
  }
  /** Kibocsátó: tipus 'fust'|'tuz'|'viz'; hely: {x,y,z} vagy {obj, off:[x,y,z]} (követi a tárgyat); ero: 0..1+; meret: skála. */
  add(tipus, hely, ero = 1, meret = 1) { const e = { tipus, ...hely, ero, meret, aktiv: true }; this.emitterek.push(e); this.valT = 1; return e; }
  hely(e, out) {
    if (e.obj) { out.set(...(e.off || [0, 0, 0])); e.obj.updateWorldMatrix(true, false); return e.obj.localToWorld(out); }
    return out.set(e.x, e.y, e.z);
  }
  /** cam: kamera helye; szin: a füst megvilágított színe (THREE.Color), szin2: az árnyékos. */
  update(dt, cam, szin, szin2) {
    this.t += dt; this.u.uIdo.value = this.t;
    if (szin) this.u.uSzin.value.copy(szin); if (szin2) this.u.uSzin2.value.copy(szin2);
    this.valT += dt;
    // a kibocsátók kiválasztása (és a követett tárgyak helye) félmásodpercenként; közben csak az idő lép
    if (this.valT < 0.5) return;
    this.valT = 0;
    for (const [nev, M] of Object.entries(this.meshes)) {
      const v = this._v;
      const list = this.emitterek.filter(e => e.tipus === nev && e.aktiv).map(e => { this.hely(e, v); return [e, v.x, v.y, v.z, (v.x - cam.x) ** 2 + (v.z - cam.z) ** 2]; })
        .filter(r => r[4] < (nev === 'fust' ? 260 * 260 : 90 * 90)).sort((a, b) => a[4] - b[4]).slice(0, M.T.kap);
      const E = M.aEm.array, P = M.aPar.array; let k = 0;
      for (const [e, x, y, z] of list) for (let i = 0; i < M.T.n; i++, k++) {
        E[k * 4] = x; E[k * 4 + 1] = y; E[k * 4 + 2] = z; E[k * 4 + 3] = ((i + 0.5) / M.T.n + (e.seed ??= Math.random())) % 1;
        P[k * 4] = e.ero; P[k * 4 + 1] = e.meret;
      }
      M.g.instanceCount = k;
      M.aEm.needsUpdate = true; M.aPar.needsUpdate = true;
    }
  }
  dispose() { for (const M of Object.values(this.meshes)) { M.me.removeFromParent(); M.g.dispose(); M.me.material.dispose(); } }
}
