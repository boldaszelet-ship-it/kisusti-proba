// Kisüsti — utófeldolgozás egyetlen jelenetpasszra építve (WebGL2, three r186).
// Miért nem az addonok GTAOPass/SAOPass-a: azok normál-passzt is rajzolnak, ami ezen a világon (~2 M háromszög,
// 300+ rajzhívás) még egy teljes jelenetrajzolás. Itt a környezeti takarás a mélységpufferből készül
// (normál a mélység szomszédaiból), fél felbontásban, ezért a költsége a felbontással arányos, nem a jelenettel.
//
// Lánc: jelenet → HDR (HalfFloat, magason 4× MSAA, mélységtextúrával)
//       → AO (fél felbontás, Alchemy-féle becslés, 4×4 átlapolt zaj) → mélységérzékeny elmosás
//       → bloom (küszöb + kettős szűrő: 5 lefelé, 5 felfelé lépés)
//       → kompozit (AO, bloom, napfény-szórás a párában, expozíció, fehéregyensúly, ACES, kontraszt,
//         telítettség, árnyék/csúcsfény tónus, vignetta, dither) → [FXAA] → képernyő
import * as THREE from 'three';

const VERT = `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function anyag(frag, uniforms, defines = {}) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: frag, uniforms, defines,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  });
}

// ---------------------------------------------------------------- AO (mélységből)
// 1. lineáris mélység fél felbontásban (R32F, legközelebbi szűrés): a mintavétel így 4× kevesebb texelt jár be,
//    és a nézeti pozíció mátrixszorzás nélkül áll elő (mérve: a teljes felbontású mélységből mintázó első
//    változat 7,5 ms GPU volt a faluban — a távoli minták szétverték a textúra-gyorsítótárat).
const LINZ_FRAG = `precision highp float;
in vec2 vUv; out vec4 outC;
uniform sampler2D tDepth; uniform float cameraNear, cameraFar;
void main(){
  float d = texture(tDepth, vUv).x;
  float z = d * 2.0 - 1.0;
  float lz = 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
  outC = vec4(d >= 0.99999 ? 1e5 : lz, 0.0, 0.0, 1.0);
}`;
// 2. Alchemy-féle becslés: aranyszög-spirál, 4×4 átlapolt zajjal forgatva; normál a szomszéd-mélységekből
const AO_FRAG = `precision highp float;
in vec2 vUv; out vec4 outC;
uniform sampler2D tLin; uniform vec2 texel, projXY; uniform float radius, projScale, intensity, maxDist;
// a z a texel közepéről jön (legközelebbi szűrés), ezért az xy-t is a texel közepéből kell számolni — különben a sík
// lépcsőzetesnek látszik, és a talajon vízszintes AO-csíkok futnak (mérve, 01/02 képpár, első változat)
vec3 viewPos(vec2 uv){ uv = (floor(uv / texel) + 0.5) * texel; float z = texture(tLin, uv).x; return vec3((uv * 2.0 - 1.0) * projXY * z, -z); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  vec3 P = viewPos(vUv);
  float dist = -P.z;
  if (dist > maxDist) { outC = vec4(1.0); return; }
  vec3 pr = viewPos(vUv + vec2(texel.x, 0.0)), pl = viewPos(vUv - vec2(texel.x, 0.0));
  vec3 pu = viewPos(vUv + vec2(0.0, texel.y)), pd = viewPos(vUv - vec2(0.0, texel.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  float rS = min(radius * projScale / dist, 48.0);   // a világ-sugár pixelben (felülről vágva: gyorsítótár)
  float ang = ign(gl_FragCoord.xy) * 6.2831853, sum = 0.0;
  float bias = 0.004 * dist + 0.02, r2 = radius * radius;
  for (int i = 0; i < SAMPLES; i++) {
    float t = (float(i) + 0.5) / float(SAMPLES);
    float a = ang + float(i) * 2.3999632;
    vec3 v = viewPos(vUv + vec2(cos(a), sin(a)) * rS * sqrt(t) * texel) - P;
    float vv = dot(v, v);
    // szögküszöb (sin 17° ≈ 0,3): a terep 2 m-es rácsának enyhe gyűrődése nem takarás (különben sorokban csíkoz)
    sum += max(0.0, dot(v, N) - 0.3 * sqrt(vv) - bias) / (vv + 0.02) * (1.0 - smoothstep(r2 * 0.6, r2 * 1.6, vv));
  }
  float ao = max(0.38, 1.0 - 2.0 * intensity * sum / float(SAMPLES));   // padló: a sűrű fű és a vékony tárgy ne feketedjen
  ao = mix(ao, 1.0, smoothstep(maxDist * 0.6, maxDist, dist));
  outC = vec4(ao, ao, ao, 1.0);
}`;

const BLUR_FRAG = `precision highp float;
in vec2 vUv; out vec4 outC;
uniform sampler2D tAO, tLin; uniform vec2 texel;
void main(){
  float z0 = texture(tLin, vUv).x, s = 0.0, w = 0.0;
  for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
    vec2 uv = vUv + (vec2(x, y) + 0.5) * texel;
    float k = max(0.0, 1.0 - abs(texture(tLin, uv).x - z0) / (0.04 * z0 + 0.05));
    s += texture(tAO, uv).x * k; w += k;
  }
  float ao = w > 0.001 ? s / w : 1.0;
  outC = vec4(ao, ao, ao, 1.0);
}`;

// ---------------------------------------------------------------- bloom
const PREFILTER_FRAG = `precision highp float;
in vec2 vUv; out vec4 outC;
uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold, knee;
vec3 s(vec2 o){ return texture(tSrc, vUv + o * texel).rgb; }
void main(){
  // 4 mintás doboz (lefelé mintavétel) + puha küszöb; a fényerő-súlyozás eltünteti a villódzó egyes pixeleket
  vec3 a = s(vec2(-1,-1)), b = s(vec2(1,-1)), c = s(vec2(-1,1)), d = s(vec2(1,1));
  vec4 w = 1.0 / (1.0 + vec4(dot(a, vec3(0.2126,0.7152,0.0722)), dot(b, vec3(0.2126,0.7152,0.0722)), dot(c, vec3(0.2126,0.7152,0.0722)), dot(d, vec3(0.2126,0.7152,0.0722))));
  vec3 col = (a * w.x + b * w.y + c * w.z + d * w.w) / (w.x + w.y + w.z + w.w);
  col = min(col, vec3(40.0));
  float br = max(col.r, max(col.g, col.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee); rq = rq * rq / (4.0 * knee + 1e-4);
  float k = max(rq, br - threshold) / max(br, 1e-4);
  outC = vec4(col * k, 1.0);
}`;
const DOWN_FRAG = `precision highp float;
in vec2 vUv; out vec4 outC; uniform sampler2D tSrc; uniform vec2 texel;
void main(){
  vec3 c = texture(tSrc, vUv).rgb * 4.0;
  c += texture(tSrc, vUv + vec2(-1,-1) * texel).rgb + texture(tSrc, vUv + vec2(1,-1) * texel).rgb;
  c += texture(tSrc, vUv + vec2(-1,1) * texel).rgb + texture(tSrc, vUv + vec2(1,1) * texel).rgb;
  outC = vec4(c / 8.0, 1.0);
}`;
const UP_FRAG = `precision highp float;
in vec2 vUv; out vec4 outC; uniform sampler2D tSrc, tPrev; uniform vec2 texel; uniform float mixK;
void main(){
  vec3 c = vec3(0.0);
  c += texture(tSrc, vUv + vec2(-2, 0) * texel).rgb + texture(tSrc, vUv + vec2(2, 0) * texel).rgb;
  c += texture(tSrc, vUv + vec2(0, -2) * texel).rgb + texture(tSrc, vUv + vec2(0, 2) * texel).rgb;
  c += (texture(tSrc, vUv + vec2(-1, -1) * texel).rgb + texture(tSrc, vUv + vec2(1, -1) * texel).rgb
     + texture(tSrc, vUv + vec2(-1, 1) * texel).rgb + texture(tSrc, vUv + vec2(1, 1) * texel).rgb) * 2.0;
  outC = vec4(texture(tPrev, vUv).rgb + c / 12.0 * mixK, 1.0);
}`;

// ---------------------------------------------------------------- kompozit
const COMP_FRAG = `precision highp float;
in vec2 vUv; out vec4 outC;
uniform sampler2D tScene, tAO, tBloom, tDepth;
uniform float aoK, bloomK, exposure, contrast, saturation, vignette, grain, ido, szorasK;
uniform vec3 wb, shadowTint, highTint, lift;
uniform mat4 projInv, camWorld; uniform vec3 sunDir, sunCol; uniform float cameraNear, cameraFar;
vec3 kRRTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c){
  const mat3 i = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 o = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= 1.0 / 0.6; c = i * c; c = kRRTFit(c); c = o * c; return clamp(c, 0.0, 1.0);
}
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  vec3 c = texture(tScene, vUv).rgb;
  float d = texture(tDepth, vUv).x;
  #ifdef AO
    float ao = texture(tAO, vUv).x;
    float lum0 = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= mix(1.0, ao, aoK * (1.0 - smoothstep(1.2, 3.0, lum0)));   // a világító felület (ablak, izzó) nem sötétül
  #endif
  // napfény-szórás a párában: a nap felé néző, távoli rész felizzik (aranyóra, hajnal)
  {
    vec4 vp = projInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vp.xyz /= vp.w;
    vec3 dir = normalize((camWorld * vec4(vp.xyz, 0.0)).xyz);
    float dist = d >= 0.99999 ? 4000.0 : length(vp.xyz);
    float mie = pow(max(dot(dir, sunDir), 0.0), 6.0);
    c += sunCol * mie * szorasK * (1.0 - exp(-dist * 0.0011));
  }
  #ifdef BLOOM
    c += texture(tBloom, vUv).rgb * bloomK;
  #endif
  c *= exposure * wb;
  c = aces(c);
  // osztott tónus: árnyék hűvösebb / melegebb, csúcsfény a napszak színe felé
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= mix(shadowTint, highTint, smoothstep(0.05, 0.75, L));
  c = c + lift * (1.0 - c);
  c = clamp((c - 0.5) * contrast + 0.5 + (contrast - 1.0) * 0.06, 0.0, 1.0);
  L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(L), c, saturation), 0.0, 1.0);
  vec2 q = vUv - 0.5; q.x *= 1.15;
  c *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  c = srgb(c);
  c += (ign(gl_FragCoord.xy + fract(ido * 7.0) * 61.0) - 0.5) * grain;   // dither: az ég átmenete nem sávosodik
  outC = vec4(c, 1.0);
}`;

// FXAA 3.11 (konzol-változat, egyszerűsített) — a tónusleképezett, sRGB képen fut
const FXAA_FRAG = `precision highp float;
in vec2 vUv; out vec4 outC; uniform sampler2D tSrc; uniform vec2 texel;
float lu(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
  vec3 rgbNW = texture(tSrc, vUv + vec2(-1.0, -1.0) * texel).rgb, rgbNE = texture(tSrc, vUv + vec2(1.0, -1.0) * texel).rgb;
  vec3 rgbSW = texture(tSrc, vUv + vec2(-1.0, 1.0) * texel).rgb, rgbSE = texture(tSrc, vUv + vec2(1.0, 1.0) * texel).rgb;
  vec3 rgbM = texture(tSrc, vUv).rgb;
  float lNW = lu(rgbNW), lNE = lu(rgbNE), lSW = lu(rgbSW), lSE = lu(rgbSE), lM = lu(rgbM);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float red = max((lNW + lNE + lSW + lSE) * 0.25 * 0.125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, -8.0, 8.0) * texel;
  vec3 A = 0.5 * (texture(tSrc, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(tSrc, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 B = A * 0.5 + 0.25 * (texture(tSrc, vUv + dir * -0.5).rgb + texture(tSrc, vUv + dir * 0.5).rgb);
  float lB = lu(B);
  outC = vec4((lB < lMin || lB > lMax) ? A : B, 1.0);
}`;

/** Utófeldolgozó lánc. o: {msaa, ao, aoMinta, bloom, fxaa, felbontas (ao-skála)} */
export class Post {
  constructor(renderer, o) {
    this.r = renderer; this.o = o;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad); this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.w = sz.x; this.h = sz.y;
    this.sceneRT = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, samples: o.msaa ? 4 : 0, depthBuffer: true });
    this.sceneRT.depthTexture = new THREE.DepthTexture(this.w, this.h, THREE.UnsignedIntType);   // 24 bit: a 32 bites lebegőpontos mérve +4 ms AO-t adott, csíkot nem javított
    const half = (f = THREE.UnsignedByteType) => new THREE.WebGLRenderTarget(1, 1, { type: f, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.aoRT = half(); this.aoRT2 = half();
    this.linRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, format: THREE.RedFormat, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.mips = []; this.ups = [];
    for (let i = 0; i < 5; i++) { this.mips.push(half(THREE.HalfFloatType)); this.ups.push(half(THREE.HalfFloatType)); }
    this.ldrRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.u = {
      tScene: { value: this.sceneRT.texture }, tDepth: { value: this.sceneRT.depthTexture }, tAO: { value: this.aoRT2.texture }, tBloom: { value: null },
      aoK: { value: 1 }, bloomK: { value: 0.12 }, exposure: { value: 1 }, contrast: { value: 1.05 }, saturation: { value: 1.05 }, vignette: { value: 0.22 },
      grain: { value: 1.6 / 255 }, ido: { value: 0 }, szorasK: { value: 0 }, wb: { value: new THREE.Vector3(1, 1, 1) },
      shadowTint: { value: new THREE.Vector3(1, 1, 1) }, highTint: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3() },
      projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Vector3() },
      cameraNear: { value: 0.1 }, cameraFar: { value: 2000 },
    };
    this.mComp = anyag(COMP_FRAG, this.u, { ...(o.ao ? { AO: 1 } : {}), ...(o.bloom ? { BLOOM: 1 } : {}) });
    const U = this.u;
    this.mLin = anyag(LINZ_FRAG, { tDepth: U.tDepth, cameraNear: U.cameraNear, cameraFar: U.cameraFar });
    this.mAO = anyag(AO_FRAG, { tLin: { value: this.linRT.texture }, texel: { value: new THREE.Vector2() }, projXY: { value: new THREE.Vector2(1, 1) }, radius: { value: 1.1 }, projScale: { value: 500 }, intensity: { value: 1.1 }, maxDist: { value: 110 } }, { SAMPLES: o.aoMinta || 8 });
    this.mBlur = anyag(BLUR_FRAG, { tAO: { value: this.aoRT.texture }, tLin: { value: this.linRT.texture }, texel: { value: new THREE.Vector2() } });
    this.mPre = anyag(PREFILTER_FRAG, { tSrc: { value: this.sceneRT.texture }, texel: { value: new THREE.Vector2() }, threshold: { value: 1.6 }, knee: { value: 0.6 } });
    this.mDown = anyag(DOWN_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mUp = anyag(UP_FRAG, { tSrc: { value: null }, tPrev: { value: null }, texel: { value: new THREE.Vector2() }, mixK: { value: 1 } });
    this.mFxaa = anyag(FXAA_FRAG, { tSrc: { value: this.ldrRT.texture }, texel: { value: new THREE.Vector2() } });
    this.setSize(this.w, this.h);
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    this.sceneRT.setSize(w, h);
    const hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
    this.aoRT.setSize(hw, hh); this.aoRT2.setSize(hw, hh); this.linRT.setSize(hw, hh);
    this.mAO.uniforms.texel.value.set(1 / hw, 1 / hh); this.mBlur.uniforms.texel.value.set(1 / hw, 1 / hh);
    let mw = hw, mh = hh;
    for (let i = 0; i < 5; i++) { this.mips[i].setSize(mw, mh); this.ups[i].setSize(mw, mh); mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1); }
    this.mPre.uniforms.texel.value.set(1 / w, 1 / h);
    this.ldrRT.setSize(w, h); this.mFxaa.uniforms.texel.value.set(1 / w, 1 / h);
  }
  pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.qScene, this.qCam); }
  render(scene, camera) {
    const r = this.r, U = this.u, o = this.o;
    U.projInv.value.copy(camera.projectionMatrixInverse); U.camWorld.value.copy(camera.matrixWorld);
    U.cameraNear.value = camera.near; U.cameraFar.value = camera.far;
    const prevAuto = r.autoClear;
    r.setRenderTarget(this.sceneRT); r.clear(); r.render(scene, camera);
    r.autoClear = false;
    if (o.ao) {
      // vetítési skála: 1 m világ 1 m távolságban hány fél-felbontású pixel
      const pe = camera.projectionMatrix.elements;
      this.mAO.uniforms.projScale.value = pe[5] * this.aoRT.height * 0.5;
      this.mAO.uniforms.projXY.value.set(1 / pe[0], 1 / pe[5]);
      this.pass(this.mLin, this.linRT); this.pass(this.mAO, this.aoRT); this.pass(this.mBlur, this.aoRT2);
    }
    if (o.bloom) {
      this.pass(this.mPre, this.mips[0]);
      for (let i = 1; i < 5; i++) { this.mDown.uniforms.tSrc.value = this.mips[i - 1].texture; this.mDown.uniforms.texel.value.set(1 / this.mips[i - 1].width, 1 / this.mips[i - 1].height); this.pass(this.mDown, this.mips[i]); }
      // felfelé: ups[i] = mips[i] + felskálázott ups[i+1]
      let src = this.mips[4];
      for (let i = 3; i >= 0; i--) {
        this.mUp.uniforms.tSrc.value = src.texture; this.mUp.uniforms.tPrev.value = this.mips[i].texture;
        this.mUp.uniforms.texel.value.set(1 / src.width, 1 / src.height);
        this.pass(this.mUp, this.ups[i]); src = this.ups[i];
      }
      U.tBloom.value = this.ups[0].texture;
    }
    U.ido.value += 1 / 60;
    if (o.fxaa) { this.pass(this.mComp, this.ldrRT); this.pass(this.mFxaa, null); }
    else this.pass(this.mComp, null);
    r.autoClear = prevAuto;
  }
  dispose() {
    for (const t of [this.sceneRT, this.linRT, this.aoRT, this.aoRT2, this.ldrRT, ...this.mips, ...this.ups]) t.dispose();
    for (const m of [this.mComp, this.mLin, this.mAO, this.mBlur, this.mPre, this.mDown, this.mUp, this.mFxaa]) m.dispose();
    this.quad.geometry.dispose();
  }
}
