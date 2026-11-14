// Kisüsti — ég és napszak: színátmenetes égbolt felhőkkel (shader), nap és hold, csillagok, köd,
// a játékost követő árnyékkamera, éjjel utcai lámpák (izzó + fénytócsa + a legközelebbi néhány valódi fény)
// és világító ablakok. Egy hívás: eg.set(ora, kameraPozicio).
import * as THREE from 'three';
import { talaj } from './terep.js';
import { RETEG } from './kotegelo.js';

const col = h => new THREE.Color(h);
const SKY = {
  napTop: col(0x4f86c8), napHor: col(0xc7dbec),
  alkTop: col(0x34507e), alkHor: col(0xeaa36a),
  ejTop: col(0x03060f), ejHor: col(0x0d1628),
};
const FOG_NAP = { near: 90, far: 720 }, FOG_EJ = { near: 30, far: 300 };

/** Az égbolt közös színei (a víz tükröződése és a Grafika is ezt olvassa). Lineáris színek. */
export const EG_U = {
  top: { value: SKY.napTop.clone() }, hor: { value: SKY.napHor.clone() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
  sunCol: { value: new THREE.Color(1, 0.9, 0.7) },
};

// Égbolt-shader: színátmenet horizontfénnyel, Mie-udvar és HDR napkorong (a korábbi vászon-korongot váltja),
// felhők tartomány-torzított zajból, a nap felé vett második mintával árnyalva (önárnyék + ezüst perem),
// magas fátyolfelhő-réteg. EG_LO definícióval (alacsony minőség) 3 oktáv, torzítás és önárnyék nélkül.
const EG_FRAG = `
  uniform vec3 top, hor, sunCol, felho; uniform vec3 sunDir; uniform float ido, ej, napK; varying vec3 vDir;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  #ifdef EG_LO
  float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<3;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s / 0.875; }
  #else
  float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s / 0.97; }
  #endif
  void main(){
    vec3 d = normalize(vDir); float h = d.y;
    float s = dot(d, sunDir), sp = max(s, 0.0);
    vec3 c = mix(hor, top, pow(clamp(h, 0.0, 1.0), 0.45));
    // a horizont fölötti világos sáv, a nap felőli oldalon melegebb
    c += hor * 0.18 * exp(-max(h, 0.0) * 9.0) * (0.6 + 0.4 * sp);
    c = mix(c, hor * 0.8, smoothstep(0.0, -0.18, h));
    c += sunCol * (pow(sp, 8.0) * 0.32 + pow(sp, 90.0) * 0.55) * (1.0 - ej);
    float disk = smoothstep(0.99984, 0.99993, s) * smoothstep(-0.03, 0.01, h);
    c += sunCol * disk * 14.0 * napK;
    if (h > -0.02) {
      vec2 uv = d.xz / (h + 0.11) * 1.35 + vec2(ido * 0.0045, ido * 0.0017);
      #ifdef EG_LO
      float n = fbm(uv);
      float lit = 0.75;
      #else
      vec2 w = vec2(fbm(uv * 0.55 + vec2(3.1, ido * 0.002)), fbm(uv * 0.55 + vec2(8.3, 1.7)));
      vec2 uw = uv + (w - 0.5) * 0.9;
      float n = fbm(uw);
      float n2 = fbm(uw + normalize(sunDir.xz + 1e-4) * 0.16 * (1.0 - sunDir.y * 0.5));
      float lit = clamp(0.55 + (n - n2) * 4.0, 0.0, 1.0);
      #endif
      float cov = smoothstep(0.50, 0.74, n) * smoothstep(-0.01, 0.16, h);
      vec3 arny = mix(felho * 0.66, top * 0.9, 0.25);
      vec3 cc = mix(arny, felho * 1.04, lit);
      // ezüst perem: a vékony felhőszél a nap közelében átvilágít
      cc += sunCol * pow(sp, 5.0) * (1.0 - smoothstep(0.5, 0.8, n)) * 1.2 * (1.0 - ej);
      c = mix(c, cc, cov * (1.0 - ej * 0.72));
      #ifndef EG_LO
      // fátyolfelhő: nyújtott, halvány magas réteg
      float ci = fbm(vec2(uv.x * 0.25, uv.y * 1.6) * 0.7 + vec2(ido * 0.001, 4.0));
      c = mix(c, felho * 1.02 + sunCol * pow(sp, 6.0) * 0.3, smoothstep(0.55, 0.85, ci) * 0.22 * smoothstep(0.02, 0.3, h) * (1.0 - ej));
      #endif
    }
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Egbolt {
  /** ctx: a világépítés kontextusa (lámpák, ablakok, fények); o: {arnyekMeret, fenyKeszlet} */
  constructor(scene, ctx, o = {}) {
    this.scene = scene; this.ctx = ctx;
    scene.fog = new THREE.Fog(SKY.napHor.clone(), FOG_NAP.near, FOG_NAP.far);
    scene.background = SKY.napHor.clone();
    // ---- égbolt
    this.u = { ...EG_U, felho: { value: new THREE.Color(1, 1, 1) }, ido: { value: 0 }, ej: { value: 0 }, napK: { value: 1 } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1900, 48, 24), new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: EG_FRAG,
    }));
    sky.renderOrder = -10; sky.frustumCulled = false; sky.name = 'egbolt';
    this.sky = sky; scene.add(sky);
    // ---- hold korongja (a napkorong az égbolt-shaderben van, HDR-ben: az utófeldolgozás bloomja fogja meg)
    const korong = (fn, size) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; fn(cv.getContext('2d'));
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
      m.renderOrder = -9; m.frustumCulled = false; scene.add(m); return m;
    };
    this.holdKorong = korong(c => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(200,215,255,0.35)'); g.addColorStop(1, 'rgba(200,215,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#e8ecf2'; c.beginPath(); c.arc(64, 64, 26, 0, 7); c.fill();
      c.fillStyle = 'rgba(150,160,175,0.55)'; for (const [x, y, r] of [[56, 58, 7], [72, 70, 5], [62, 76, 4], [74, 54, 3.5], [50, 70, 3]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    }, 110);
    // ---- csillagok
    {
      const n = 2200, p = new Float32Array(n * 3), cc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, y = Math.abs(u) * 0.98 + 0.02, r = Math.sqrt(1 - y * y);
        p[i * 3] = Math.cos(a) * r * 1700; p[i * 3 + 1] = y * 1700; p[i * 3 + 2] = Math.sin(a) * r * 1700;
        const b = 0.5 + Math.random() * 0.5, t = Math.random(); cc[i * 3] = b * (0.85 + t * 0.15); cc[i * 3 + 1] = b * 0.92; cc[i * 3 + 2] = b * (1.0 - t * 0.1);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      this.csillagMat = new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
      this.csillagok = new THREE.Points(g, this.csillagMat); this.csillagok.frustumCulled = false; this.csillagok.renderOrder = -9; scene.add(this.csillagok);
    }
    // ---- fények: félgömb + nap (árnyék a játékos körül)
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a4a32, 1.0); scene.add(this.hemi);
    this.nap = new THREE.DirectionalLight(0xfff1dc, 2.4);
    this.nap.castShadow = true;
    const S = o.arnyekMeret ?? 2048, E = o.arnyekKiterjedes ?? 55;
    this.nap.shadow.mapSize.set(S, S);
    Object.assign(this.nap.shadow.camera, { left: -E, right: E, top: E, bottom: -E, near: 1, far: 420 });
    this.nap.shadow.bias = -0.0004; this.nap.shadow.normalBias = 0.04;
    this.texel = 2 * E / S;
    scene.add(this.nap, this.nap.target);
    // ---- éjjeli lámpák
    this.lampak = ctx.lampak;
    const n = this.lampak.length;
    if (n) {
      const izzoGeo = new THREE.SphereGeometry(0.22, 10, 8);
      this.izzoMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
      this.izzok = new THREE.InstancedMesh(izzoGeo, this.izzoMat, n);
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(cv);
      this.tocsaMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffb060, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
      const tg = new THREE.PlaneGeometry(1, 1); tg.rotateX(-Math.PI / 2);
      this.tocsak = new THREE.InstancedMesh(tg, this.tocsaMat, n);
      // fénykorona az izzó körül (kamerára néző korong helyett gömb, additív)
      this.koronaMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffc070, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      this.koronak = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.koronaMat, n);
      const m4 = new THREE.Matrix4();
      this.lampak.forEach((L, i) => {
        this.izzok.setMatrixAt(i, m4.makeTranslation(L.x, L.y - 0.1, L.z));
        const gy = talaj(L.x, L.z) + 0.06;
        this.tocsak.setMatrixAt(i, m4.compose(new THREE.Vector3(L.x, gy, L.z), new THREE.Quaternion(), new THREE.Vector3(L.r * 1.6, 1, L.r * 1.6)));
      });
      for (const im of [this.izzok, this.tocsak, this.koronak]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.frustumCulled = false; scene.add(im); }
      this.tocsak.renderOrder = 2; this.koronak.renderOrder = 3;
    }
    // valódi pontfények: a kamerához legközelebbi néhány lámpa kapja (a fényszám állandó, nincs shader-újrafordítás)
    this.keszlet = [];
    for (let i = 0; i < (o.fenyKeszlet ?? 3); i++) { const L = new THREE.PointLight(0xffc483, 0, 16, 1.6); L.position.set(0, -100, 0); scene.add(L); this.keszlet.push(L); }
    // ---- világító ablakok: cellánként összevont négyszögek
    this.ablakMat = new THREE.MeshBasicMaterial({ color: 0xffbe6a, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.ablakMat.visible = false;
    const cells = new Map();
    for (const A of ctx.ablakok) {
      const k = Math.floor(A.x / 128) + ':' + Math.floor(A.z / 128);
      if (!cells.has(k)) cells.set(k, []); cells.get(k).push(A);
    }
    for (const list of cells.values()) {
      const pos = new Float32Array(list.length * 12), idx = [], cc = new Float32Array(list.length * 12);
      list.forEach((A, i) => {
        const c = Math.cos(A.ry), s = Math.sin(A.ry), hw = A.w / 2, hh = A.h / 2;
        // helyi x (a fal síkjában) = (c, 0, -s)
        const P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
        const warm = 0.75 + Math.random() * 0.35, tint = Math.random();
        P.forEach(([u, v], k) => {
          pos[i * 12 + k * 3] = A.x + c * u; pos[i * 12 + k * 3 + 1] = A.y + v; pos[i * 12 + k * 3 + 2] = A.z - s * u;
          cc[i * 12 + k * 3] = warm; cc[i * 12 + k * 3 + 1] = warm * (0.82 + tint * 0.12) * (v > 0 ? 0.92 : 1); cc[i * 12 + k * 3 + 2] = warm * (0.55 + tint * 0.3);
        });
        const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.setIndex(idx); g.computeBoundingSphere();
      const me = new THREE.Mesh(g, this.ablakMat); me.name = 'ablakfeny';
      this.ablakMat.vertexColors = true;
      ctx.lod.cell('ablak', list[0].x, list[0].z).g.add(me);
    }
    this.ej = 0; this.t = 0;
    this._v = new THREE.Vector3();
  }

  /** ora: 0–24 (tört), cam: a kamera (vagy a játékos) pozíciója. Visszaad: {nap (0–1 nappal), ej (0–1 éjszaka)} */
  set(ora, cam, dt = 0) {
    this.t += dt; this.u.ido.value = this.t;
    const ang = ((ora - 6) / 12) * Math.PI, el = Math.sin(ang);
    const nap = THREE.MathUtils.clamp(el * 2.2, 0, 1);              // nappali világosság
    const alk = Math.max(0, 1 - Math.abs(el - 0.05) / 0.3);          // alkonyat/hajnal ereje
    const ej = THREE.MathUtils.clamp(-el * 4 + 0.15, 0, 1);          // éjszaka
    this.ej = ej;
    const top = this.u.top.value, hor = this.u.hor.value;
    top.copy(SKY.ejTop).lerp(SKY.napTop, nap).lerp(SKY.alkTop, alk * 0.55 * (1 - nap * 0.5));
    hor.copy(SKY.ejHor).lerp(SKY.napHor, nap).lerp(SKY.alkHor, alk * 0.6);
    this.u.ej.value = ej;
    this.u.felho.value.copy(SKY.ejHor).lerp(new THREE.Color(0xf4f6f8), nap).lerp(new THREE.Color(0xf0b49a), alk * 0.5);
    const sd = this._v.set(Math.cos(ang), Math.max(-1, el), 0.42).normalize();
    this.u.sunDir.value.copy(sd);
    this.u.sunCol.value.setRGB(1, 0.75 + nap * 0.2, 0.5 + nap * 0.4).multiplyScalar(el > -0.1 ? 1 : 0);
    this.scene.fog.color.copy(hor); this.scene.background.copy(hor);
    this.scene.fog.near = FOG_NAP.near * (1 - ej) + FOG_EJ.near * ej; this.scene.fog.far = FOG_NAP.far * (1 - ej) + FOG_EJ.far * ej;
    // nap / hold: ugyanaz a fényforrás; éjjel a hold kékes fénye vet árnyékot
    const holdDir = new THREE.Vector3(-sd.x, Math.abs(sd.y) * 0.8 + 0.25, -0.3).normalize();
    const L = this.nap, dir = el > -0.04 ? sd : holdDir;
    if (el > -0.04) { L.color.setRGB(1, 0.82 + nap * 0.13, 0.62 + nap * 0.3); L.intensity = 3.0 * Math.pow(THREE.MathUtils.clamp((el + 0.04) / 0.35, 0, 1), 0.7); }   // alacsony napnál is erős, meleg fény (aranyóra)
    else { L.color.setRGB(0.62, 0.72, 1.0); L.intensity = 0.5 * ej; }
    this.hemi.intensity = 0.22 + 1.35 * nap + 0.12 * alk;
    this.hemi.color.setRGB(0.75 + nap * 0.12, 0.8 + nap * 0.1, 1).lerp(new THREE.Color(0x6070a0), ej * 0.6);
    this.hemi.groundColor.setRGB(0.35, 0.29, 0.2).multiplyScalar(0.4 + nap * 0.6);
    // árnyékkamera a kamera körül, texelrácsra igazítva (ne vibráljon)
    const tx = Math.round(cam.x / this.texel) * this.texel, tz = Math.round(cam.z / this.texel) * this.texel;
    L.target.position.set(tx, cam.y - 1.6, tz); L.position.set(tx + dir.x * 200, cam.y + dir.y * 200, tz + dir.z * 200);
    L.target.updateMatrixWorld();
    // alacsony napnál a súroló fény árnyék-pattanást (csíkozást) okoz a füvön és a talajon: a bias a magassággal nő
    const lo = 1 - THREE.MathUtils.clamp(Math.max(dir.y, 0) * 2.5, 0, 1);
    L.shadow.bias = -0.0004 - 0.0016 * lo; L.shadow.normalBias = 0.04 + 0.08 * lo;
    // korongok
    const far = 1500;
    this.u.napK.value = THREE.MathUtils.clamp((el + 0.03) * 12, 0, 1);
    this.holdKorong.position.set(cam.x + holdDir.x * far, cam.y + holdDir.y * far, cam.z + holdDir.z * far); this.holdKorong.lookAt(cam.x, cam.y, cam.z);
    this.holdKorong.visible = ej > 0.05; this.holdKorong.material.opacity = ej;
    this.sky.position.copy(cam); this.csillagok.position.copy(cam);
    this.csillagMat.opacity = ej * 0.95;
    // lámpák és ablakok
    const lit = ej > 0.25 || (el < 0.06 && ora > 12);
    if (this.izzok) {
      this.izzok.visible = this.tocsak.visible = this.koronak.visible = lit;
      if (lit) {
        // koronák: kamerára néző lapok
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
        const camQ = this._camQ || q;
        this.lampak.forEach((Lm, i) => { p.set(Lm.x, Lm.y - 0.1, Lm.z); s.setScalar(2.2); this.koronak.setMatrixAt(i, m4.compose(p, camQ, s)); });
        this.koronak.instanceMatrix.needsUpdate = true;
        // legközelebbi lámpák → valódi fény
        const best = this.lampak.map(Lm => [Lm, (Lm.x - cam.x) ** 2 + (Lm.z - cam.z) ** 2]).sort((a, b) => a[1] - b[1]);
        this.keszlet.forEach((P, i) => {
          const b = best[i];
          if (b && b[1] < 70 * 70) { P.position.set(b[0].x, b[0].y - 0.4, b[0].z); P.intensity = 22; P.distance = b[0].r * 1.9; }
          else P.intensity = 0;
        });
      }
    }
    if (!lit) for (const P of this.keszlet) P.intensity = 0;
    this.ablakMat.visible = lit;
    for (const f of this.ctx.fenyek) f.light.intensity = lit ? f.ejjel : 0;
    return { nap, ej, lit };
  }
  /** HDR-erősítés a világító felületekre (izzó, ablak, fénykorona). k = 1: közvetlen rajzolás (a kép 1,0-nál
   *  vág); utófeldolgozásnál k > 1, hogy a bloom küszöbe fölé kerüljenek és fényudvaruk legyen. */
  hdr(k = 1) {
    if (this.izzoMat) { this.izzoMat.color.set(0xffd9a0).multiplyScalar(k * 1.6 > 1 ? k * 1.6 : 1); this.koronaMat.opacity = k > 1 ? 0.55 : 0.9; }
    if (k > 1) this.ablakMat.color.setRGB(1.7, 1.05, 0.42); else this.ablakMat.color.setScalar(1);   // utófeldolgozásnál meleg ellensúly: az éjjeli kék fehéregyensúly (b ×1,22) és az ACES különben fehérre égeti
  }
  /** A kamera forgatása a fénykoronákhoz (opcionális, renderelés előtt). */
  kamera(camera) { this._camQ = camera.quaternion; }
}
