// Kisüsti — Grafika: a világ képi rétege a renderer és a jelenet fölött. Az integrátor ezt hívja:
//
//   import { Grafika } from './js/grafika/index.js';
//   const G = new Grafika(renderer, scene, camera, { minoseg: 'magas', vilag: V });   // V = await epitVilag(...)
//   // képkockánként, a V.update(...) UTÁN:
//   G.update(dt, ora);          // ora: 0–24 (vagy {ora}); szél, napszak-színkorrekció, fű, füst, kontaktárnyék
//   G.render();                 // renderer.render(scene, camera) HELYETT
//   // ablakméret-változáskor, a renderer.setSize(...) UTÁN:
//   G.resize();
//   G.setMinoseg('kozepes');    // futás közben is (a shaderek egyszer újrafordulnak)
//   G.kontakt(obj, 0.45);       // kontaktárnyék egy mozgó tárgy alá (figura, jármű); G.kontaktTorol(obj)
//   G.ustFust(true|false);      // az üst kéményének füstje és a tűz (a játékállapot kapcsolja)
//
// Minőségszintek (mérés: tools/vilag_kepek.py --grafika-meres --gpu):
//   alacsony: közvetlen rajzolás (nincs utófeldolgozás), 1024-es árnyéktérkép, egyszerűbb ég; szél, füst, tűz,
//             kontaktárnyék, magassági köd, perem-fény, új víz — swiftshaderen is fut.
//   kozepes:  + HDR-lánc: bloom (lámpák, ablakok, tűz, nap), napszakos színkorrekció, vignetta, FXAA,
//             fűszálmező 30 m-en, 2048-as árnyéktérkép.
//   magas:    + mélységből számolt környezeti takarás (fél felbontás), fűszálmező 38 m-en, fémeken égbolt-tükröződés.
//             (4× MSAA mérve túl drága: HalfFloat többmintás cél ANGLE-Metalon +10…32 ms GPU; helyette FXAA.)
import * as THREE from 'three';
import './chunks.js';
import { Post } from './post.js';
import { napszakSzin } from './szin.js';
import { SZEL, szelesAnyag, szelesKukorica } from './szel.js';
import { FuMezo } from './fu.js';
import { Reszecskek } from './reszecske.js';
import { KontaktArnyek } from './arnyek.js';
import { EG_U } from '../vilag/eg.js';
import { hash2 } from '../vilag/adat.js';

export const MINOSEGEK = ['alacsony', 'kozepes', 'magas'];
const PRESET = {
  alacsony: { post: null, fu: null, arnyek: 1024, egLo: true, hdr: 1 },
  kozepes: { post: { msaa: false, ao: false, bloom: true, fxaa: true }, fu: { sugar: 30, max: 45000, suruseg: 0.8 }, arnyek: 2048, egLo: false, hdr: 3 },
  magas: { post: { msaa: false, ao: true, aoMinta: 8, bloom: true, fxaa: true }, fu: { sugar: 38, max: 80000, suruseg: 0.85 }, arnyek: 2048, egLo: false, hdr: 3 },
};
// növényréteg → [hajlékonyság, levélrezgés]
const SZEL_RETEG = { fa: [0.0045, 0.010], bokor: [0.02, 0.006], kis: [0.12, 0] };

export class Grafika {
  constructor(renderer, scene, camera, o = {}) {
    this.r = renderer; this.scene = scene; this.camera = camera; this.V = o.vilag || null;
    this.ora = 10; this.ki = { ao: true, bloom: true, msaa: true, fu: true, reszecske: true, kontakt: true, szel: true };
    this.post = null; this.fu = null;
    this.reszecske = new Reszecskek(scene);
    this.kontaktok = new KontaktArnyek(scene, this.V ? this.V.talaj : () => 0);
    this._szelez();
    this._emitterek();
    this._femek();
    this.setMinoseg(o.minoseg || 'magas');
    // a foltozott shader-részek (köd, perem-fény) a már lefordított anyagokra is érvényesek legyenek
    scene.traverse(m => { if (m.material) for (const mt of [].concat(m.material)) mt.needsUpdate = true; });
  }

  // ---------------------------------------------------------------- beállítás
  setMinoseg(q) {
    if (!PRESET[q]) q = 'magas';
    this.minoseg = q; const P = PRESET[q];
    this.post?.dispose(); this.post = null;
    if (P.post) this.post = new Post(this.r, { ...P.post, ao: P.post.ao && this.ki.ao, bloom: P.post.bloom && this.ki.bloom, msaa: P.post.msaa && this.ki.msaa, fxaa: P.post.fxaa || (P.post.msaa && !this.ki.msaa) });
    this.fu?.dispose(); this.fu = null;
    if (P.fu && this.V && this.ki.fu) this.fu = new FuMezo(this.scene, { ...P.fu, utk: this.V.utk });
    const tud = this.V?.terep?.material?.userData;
    if (tud?.uPbr) tud.uPbr.value = q === 'alacsony' ? 0 : 1;   // a talaj fotótextúrája (v4) „közepes” szinttől
    const eg = this.V?.eg;
    if (eg) {
      const L = eg.nap;
      if (L.shadow.mapSize.x !== P.arnyek) { L.shadow.mapSize.set(P.arnyek, P.arnyek); L.shadow.map?.dispose(); L.shadow.map = null; eg.texel = (L.shadow.camera.right - L.shadow.camera.left) / P.arnyek; }
      const sm = eg.sky.material, lo = !!P.egLo;
      if (!!sm.defines.EG_LO !== lo) { if (lo) sm.defines.EG_LO = 1; else delete sm.defines.EG_LO; sm.needsUpdate = true; }
      eg.hdr(P.hdr);
    }
    this.hdrK = P.hdr;
    this._kesz = false;
    return q;
  }
  /** Egy-egy réteg ki/bekapcsolása (méréshez): ao, bloom, msaa (helyette FXAA), fu, reszecske, kontakt, szel. */
  kapcsol(nev, be) {
    this.ki[nev] = be;
    if (nev === 'ao' || nev === 'bloom' || nev === 'fu' || nev === 'msaa') this.setMinoseg(this.minoseg);
    if (nev === 'reszecske') for (const M of Object.values(this.reszecske.meshes)) M.me.visible = be;
    if (nev === 'kontakt') this.kontaktok.im.visible = be;
    if (nev === 'szel') SZEL.ero.value = be ? 1 : 0;
  }
  kontakt(obj, sx = 0.45, sz = sx, dy = 0) { this.kontaktok.add(obj, sx, sz, dy); }
  kontaktTorol(obj) { this.kontaktok.torol(obj); }
  ustFust(be) { for (const e of this.ustEmitterek || []) e.aktiv = be; this.reszecske.valT = 1; }

  /** A növényzet anyagainak szeles másolata (InstancedMesh a fa/bokor/kis cellákban, a kukoricatábla oldala). */
  _szelez() {
    let n = 0;
    this.scene.traverse(o => {
      if (o.isInstancedMesh && o.parent?.name) {
        const L = SZEL_RETEG[o.parent.name.split(':')[0]];
        if (L && !o.material.userData?.szel) { o.material = szelesAnyag(o.material, L[0], L[1]); n++; }
      }
      if (o.isMesh && o.name === 'kukorica-oldal') szelesKukorica(o.material);
    });
    this.szelesHalok = n;
  }
  /** Füst a kémények egy részéből (háztartásonként más), az üst kéményéből és tűz az üst alatt, vízsugár a kutakból. */
  _emitterek() {
    const V = this.V; if (!V) return;
    for (const k of V.ctx.kemenyek || []) {
      const h = hash2(Math.floor(k.x * 3), Math.floor(k.z * 3));
      if (h < 0.45) this.reszecske.add('fust', { x: k.x, y: k.y, z: k.z }, 0.45 + h, 0.8 + h * 0.4);
    }
    this.ustEmitterek = [];
    const still = V.tanya?.still;
    if (still) {
      this.ustEmitterek.push(this.reszecske.add('fust', { obj: still, off: [0, 4.45, -0.5] }, 0.85, 0.7));
      this.ustEmitterek.push(this.reszecske.add('tuz', { obj: still, off: [0, 0.12, 0.62] }, 1, 0.75));
    }
    for (const s of V.ctx.szokokutak || []) this.reszecske.add('viz', { x: s.x, y: s.y, z: s.z }, 1, s.meret || 1);
  }

  /** Környezeti térkép a fémes anyagokra (réz üst, toronygomb, kerékpártartó): az ég színátmenetéből és a barnás
   *  talajból PMREM-mel. Közepes/magas minőségen félóránként (játékidő) frissül, alacsonyon egyszer készül. */
  _femek() {
    this.fem = [];
    this.scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial && m.metalness >= 0.5 && !this.fem.includes(m)) this.fem.push(m); });
    if (!this.fem.length) return;
    this.pmrem = new THREE.PMREMGenerator(this.r);
    this.envScene = new THREE.Scene();
    this.envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: EG_U.top, hor: EG_U.hor, sunDir: EG_U.sunDir, sunCol: EG_U.sunCol, fold: { value: new THREE.Color(0x4a3e2c) } },
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top, hor, sunDir, sunCol, fold; varying vec3 vD;
        void main(){ vec3 d = normalize(vD); vec3 c = mix(hor, top, pow(max(d.y, 0.0), 0.5));
          c = mix(c, fold * (0.4 + 0.6 * hor), smoothstep(0.02, -0.12, d.y));
          c += sunCol * pow(max(dot(d, sunDir), 0.0), 40.0) * 3.0;
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), this.envMat));
    this.envOra = -99;
  }
  _kornyezetFrissit(ora) {
    if (!this.pmrem) return;
    if (this.minoseg === 'alacsony' ? this.envOra > -99 : Math.abs(ora - this.envOra) < 0.5) return;
    this.envOra = ora;
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 100, { size: 64 });
    for (const m of this.fem) { m.envMap = rt.texture; m.envMapIntensity = 0.9; m.needsUpdate = m.needsUpdate || !this.envRT; }
    this.envRT?.dispose(); this.envRT = rt;
  }

  // ---------------------------------------------------------------- képkocka
  /** dt: mp; napszak: óra (0–24) vagy {ora}. */
  update(dt, napszak) {
    const ora = typeof napszak === 'number' ? napszak : (napszak?.ora ?? this.ora);
    this.ora = ora;
    SZEL.ido.value += dt;
    this._kornyezetFrissit(ora);
    const cam = this.camera.position;
    if (this.fu) { if (!this._kesz) this.fu.mostMind(cam); else this.fu.update(cam, 2); }
    this._kesz = true;
    if (this.ki.kontakt) this.kontaktok.update(cam);
    // füst színe: a félgömbfény (ég) és a nap járuléka; reggel és este erősebb (főzés, fűtés)
    const eg = this.V?.eg;
    if (eg && this.ki.reszecske) {
      const c = this._c1 ||= new THREE.Color(), c2 = this._c2 ||= new THREE.Color();
      c.copy(eg.hemi.color).multiplyScalar(eg.hemi.intensity * 0.5).add(c2.copy(eg.nap.color).multiplyScalar(eg.nap.intensity * 0.2));
      c.r = Math.min(c.r, 0.95); c.g = Math.min(c.g, 0.95); c.b = Math.min(c.b, 0.95);
      c2.copy(c).multiplyScalar(0.5);
      this.reszecske.update(dt, cam, c, c2);
    }
    if (this.post) {
      const S = napszakSzin(ora), U = this.post.u;
      U.exposure.value = S.exposure; U.wb.value.set(...S.wb); U.contrast.value = S.contrast; U.saturation.value = S.saturation;
      U.shadowTint.value.set(...S.shadowTint); U.highTint.value.set(...S.highTint); U.lift.value.set(...S.lift);
      U.bloomK.value = S.bloom; U.sunDir.value.copy(EG_U.sunDir.value);
      const sc = EG_U.sunCol.value, up = THREE.MathUtils.clamp(EG_U.sunDir.value.y * 6 + 0.3, 0, 1);
      U.sunCol.value.set(sc.r, sc.g, sc.b); U.szorasK.value = S.szoras * up;
    }
  }
  render() {
    if (this.post) this.post.render(this.scene, this.camera);
    else { this.r.setRenderTarget(null); this.r.render(this.scene, this.camera); }
  }
  resize() {
    if (!this.post) return;
    const s = this.r.getDrawingBufferSize(new THREE.Vector2());
    this.post.setSize(s.x, s.y);
  }
  /** Állapot méréshez. */
  info() {
    return { minoseg: this.minoseg, fuSzalak: this.fu?.n ?? 0, szelesHalok: this.szelesHalok, emitterek: this.reszecske.emitterek.length, kontakt: this.kontaktok.lista.length, post: this.post ? { ...this.post.o } : null };
  }
  dispose() { this.envRT?.dispose(); this.pmrem?.dispose(); this.post?.dispose(); this.fu?.dispose(); this.reszecske.dispose(); this.kontaktok.dispose(); }
}
