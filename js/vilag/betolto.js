// Kisüsti — modellbetöltő (Kenney CC0-csomagok, models/*/License.txt).
// Egy kit minden GLB-je ugyanazt a colormap.png-t használja: betöltéskor az anyagokat kitenként
// egyetlen példányra cseréljük, így a kötegelő (kotegelo.js) egy kit összes elemét egy rajzhívásba vonhatja össze.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const MODELS = {};
const BASE = new URL('../../models/', import.meta.url).href;
const loader = new GLTFLoader();
const canon = new Map();   // kit|anyagnév → közös anyag

/** A Nature Kit pasztell, türkizes színei helyett a magyar nyárvégi táj színei (sRGB). */
const NATURE = {
  leafsGreen: 0x5a8a38, leafsDark: 0x3e6a32, grass: 0x6a963a, leafsFall: 0xc07a34, woodBark: 0x6e5038, woodBarkDark: 0x5a4030,
  wood: 0x9a744e, woodDark: 0x6e5038, stone: 0x9a978e, dirt: 0x7a5c40, corn: 0xd8b85a, colorYellow: 0xeec23c, colorRed: 0xc63a3a,
  colorPurple: 0x8a62c4, woodInner: 0xc8aa82, woodBirch: 0xe6e2d6,
};
/** A Fantasy Town Kit lazacos fája (kerítés, stand, szekér, gerenda) természetesebb barna fára cserélve. */
function fantasyFa(tex) {
  const img = tex.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    if (r > 180 && r - g > 50 && g - b > 22 && g < 150) { const k = (r + g + b) / (197 + 130 + 96); p[i] = 170 * k; p[i + 1] = 120 * k; p[i + 2] = 82 * k; }
  }
  cx.putImageData(d, 0, 0);
  const t = tex.clone(); t.source = new (THREE.TextureSource || THREE.Source)(cv); t.needsUpdate = true; return t;
}

/** Kanonikus anyag: kitenként és anyagnevenként egy. A nature-kit anyagai metallicFactor = 1-gyel érkeznek
 *  (környezeti térkép nélkül feketék): matt, kétoldalas lesz. */
function canonMaterial(kit, m) {
  const key = kit + '|' + m.name + '|' + (m.map ? 'map' : m.color.getHexString());
  let c = canon.get(key);
  if (!c) {
    // a Kenney-anyagok Lambertként (a low-poly, palettás textúrához elég; olcsóbb és gyorsabban fordul).
    // A nature-kit anyagai metallicFactor = 1-gyel jönnek (Standardként feketék lennének): itt mattok, kétoldalasak.
    const nature = m.metalness >= 0.99 && !m.metalnessMap;
    let map = m.map;
    if (kit === 'fantasy-town-kit' && map) map = fantasyFa(map);
    if (kit === 'nature-kit' && NATURE[m.name] != null) m.color.setHex(NATURE[m.name]);
    c = new THREE.MeshLambertMaterial({ name: m.name, color: m.color, map, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: nature ? THREE.DoubleSide : m.side, vertexColors: m.vertexColors });
    if (c.map) { c.map.anisotropy = 4; }
    c.userData.kit = kit;
    if (!c.map && !c.transparent) c.userData.vc = 'lambert' + (nature ? '2' : '');
    canon.set(key, c);
  }
  return c;
}

/** Betölti a hiányzó modelleket (kulcs: 'kit/név'). onProgress(kész, összes). */
export async function betolt(keys, onProgress) {
  const need = [...new Set(keys)].filter(k => !MODELS[k]);
  let done = 0;
  await Promise.all(need.map(async k => {
    const g = await loader.loadAsync(BASE + k + '.glb');
    const kit = k.split('/')[0];
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(m => canonMaterial(kit, m)) : canonMaterial(kit, o.material);
    });
    MODELS[k] = g;
    onProgress?.(++done, need.length);
  }));
  return MODELS;
}

/** Egy modell példánya. s: szám vagy [x,y,z]; shadow: árnyékot vet-e. parent nélkül nem kerül jelenetbe. */
export function prop(key, x, y, z, s = 1, ry = 0, parent = null, shadow = true) {
  const src = MODELS[key];
  if (!src) throw new Error('nincs betöltve: ' + key);
  const o = src.animations.length ? SkeletonUtils.clone(src.scene) : src.scene.clone(true);
  if (Array.isArray(s)) o.scale.set(...s); else o.scale.setScalar(s);
  o.position.set(x, y, z); o.rotation.y = ry;
  o.traverse(m => { if (m.isMesh) { m.castShadow = shadow; m.receiveShadow = true; } });
  if (parent) parent.add(o);
  return o;
}

/** Egy modell egyetlen geometriává sütve (a csomópont-transzformokkal), anyagonként egy részre bontva.
 *  Az instancing (InstancedMesh) ezt használja. vertexColor: az anyag színét a csúcsokba sütjük, és az
 *  összes részt egy geometriába vonjuk (a nature-kit textúra nélküli anyagai így egy rajzhívást adnak). */
const geoCache = new Map();
export function modelGeo(key, vertexColor = false) {
  const ck = key + (vertexColor ? '|vc' : '');
  if (geoCache.has(ck)) return geoCache.get(ck);
  const root = MODELS[key].scene;
  root.updateMatrixWorld(true);
  const parts = new Map();   // anyag → [{geo, m}]
  root.traverse(o => {
    if (!o.isMesh) return;
    const mat = o.material;
    const k = vertexColor ? 'vc' : mat.uuid;
    if (!parts.has(k)) parts.set(k, { mat, items: [] });
    parts.get(k).items.push({ geo: o.geometry, m: o.matrixWorld.clone(), color: vertexColor ? mat.color : null });
  });
  const out = [...parts.values()].map(p => ({ mat: vertexColor ? null : p.mat, geo: mergeItems(p.items, vertexColor) }));
  geoCache.set(ck, out);
  return out;
}

/** Geometriák összevonása világ-mátrixszal. items: [{geo, m, color?}]. A tükrözött (negatív determinánsú)
 *  elemek háromszög-irányát megfordítja. Csak position/normal/uv/color attribútumot visz át. */
export function mergeItems(items, withColor = false) {
  let nv = 0, ni = 0, hasUv = true;
  for (const it of items) {
    nv += it.geo.attributes.position.count;
    ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count;
    if (!it.geo.attributes.uv) hasUv = false;
  }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
  const uv = hasUv ? new Float32Array(nv * 2) : null;
  const col = withColor ? new Float32Array(nv * 3) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let ov = 0, oi = 0;
  for (const it of items) {
    const g = it.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    nm.getNormalMatrix(it.m);
    const flip = it.m.determinant() < 0;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(it.m); pos[(ov + i) * 3] = v.x; pos[(ov + i) * 3 + 1] = v.y; pos[(ov + i) * 3 + 2] = v.z;
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(ov + i) * 3] = v.x; nor[(ov + i) * 3 + 1] = v.y; nor[(ov + i) * 3 + 2] = v.z; }
      if (uv) { uv[(ov + i) * 2] = U.getX(i); uv[(ov + i) * 2 + 1] = U.getY(i); }
      if (col) {
        const c = it.color || WHITE, CA = it.geo.attributes.color;
        let r = c.r, gg = c.g, b = c.b;
        if (CA) { r *= CA.getX(i); gg *= CA.getY(i); b *= CA.getZ(i); }
        if (it.vcol) { r *= it.vcol.r; gg *= it.vcol.g; b *= it.vcol.b; }
        col[(ov + i) * 3] = r; col[(ov + i) * 3 + 1] = gg; col[(ov + i) * 3 + 2] = b;
      }
    }
    if (g.index) {
      const I = g.index;
      for (let t = 0; t < I.count; t += 3) {
        const a = I.getX(t), b = I.getX(t + 1), c = I.getX(t + 2);
        idx[oi++] = ov + a; idx[oi++] = ov + (flip ? c : b); idx[oi++] = ov + (flip ? b : c);
      }
    } else {
      for (let t = 0; t < P.count; t += 3) { idx[oi++] = ov + t; idx[oi++] = ov + (flip ? t + 2 : t + 1); idx[oi++] = ov + (flip ? t + 1 : t + 2); }
    }
    ov += P.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
const WHITE = new THREE.Color(1, 1, 1);
