// Kisüsti — szél a növényzeten. A példányosított fák, bokrok, fűcsomók anyagának másolata kap egy csúcs-
// shader-részt: a példány talppontjától mért magasság négyzetével arányos hajlás + széllökés-hullám, ami
// végigfut a tájon (a szomszéd fák nem egyszerre hajolnak), és apró levélrezgés. Rajzhívást nem ad hozzá.
import * as THREE from 'three';

/** Közös idő- és erősség-uniform (a Grafika.update lépteti). */
export const SZEL = { ido: { value: 0 }, ero: { value: 1 }, irany: { value: new THREE.Vector2(0.86, 0.5) } };

/** GLSL: a szél elmozdulása világtérben (p: a példány/pont helye xz; h: magasság a talp fölött, m). */
export const SZEL_GLSL = `
uniform float uSzelIdo, uSzelEro; uniform vec2 uSzelIrany;
float szelHullam(vec2 p, float t){
  float s = dot(p, uSzelIrany);
  // lassú, a tájon átfutó lökés + két gyorsabb rezgés
  float g = 0.55 + 0.45 * sin(s * 0.045 - t * 0.9) * sin(s * 0.011 + t * 0.31);
  return g * (0.7 + 0.3 * sin(t * 1.9 + s * 0.35)) + 0.12 * sin(t * 4.3 + p.x * 1.7 + p.y * 1.3);
}
vec3 szelEltol(vec2 p, float h, float k, float t){
  float w = szelHullam(p, t) * uSzelEro;
  vec2 d = uSzelIrany * w + vec2(-uSzelIrany.y, uSzelIrany.x) * 0.25 * sin(t * 1.3 + p.x * 0.7);
  float b = k * h * h;
  return vec3(d.x * b, -b * 0.18 * abs(w), d.y * b);
}`;

const cache = new Map();
/** Anyagmásolat széllel. k: hajlékonyság (fa ~0.0045, bokor ~0.02, fű ~0.12); rezges: levélrezgés (m). */
export function szelesAnyag(src, k, rezges = 0) {
  const key = src.uuid + '|' + k + '|' + rezges;
  if (cache.has(key)) return cache.get(key);
  const m = src.clone();
  m.userData = { ...src.userData, szel: k };
  m.onBeforeCompile = sh => {
    sh.uniforms.uSzelIdo = SZEL.ido; sh.uniforms.uSzelEro = SZEL.ero; sh.uniforms.uSzelIrany = SZEL.irany;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SZEL_GLSL)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  {
    vec3 ip = instanceMatrix[3].xyz;
    float isc = length(instanceMatrix[0].xyz);
    float hh = max(position.y, 0.0) * isc;
    vec3 dw = szelEltol(ip.xz, hh, ${k.toFixed(5)}, uSzelIdo);
    ${rezges ? `dw += vec3(sin(uSzelIdo * 7.1 + position.x * 9.0 + ip.x), sin(uSzelIdo * 6.3 + position.z * 8.0 + ip.z) * 0.6, cos(uSzelIdo * 7.7 + position.y * 7.0)) * ${rezges.toFixed(4)} * min(hh, 3.0) * uSzelEro;` : ''}
    // világ-eltolás a példány helyi terébe (egyenletes skála + forgatás: inverz = transzponált / skála²)
    transformed += transpose(mat3(instanceMatrix)) * dw / (isc * isc);
  }
#endif`);
  };
  m.customProgramCacheKey = () => 'szel|' + k + '|' + rezges;
  cache.set(key, m);
  return m;
}

/** A kukoricatábla oldalfalai: a textúra felső része (uv.y) hajlik. */
export function szelesKukorica(m) {
  if (m.userData.szel) return m;
  m.userData.szel = 1;
  m.onBeforeCompile = sh => {
    sh.uniforms.uSzelIdo = SZEL.ido; sh.uniforms.uSzelEro = SZEL.ero; sh.uniforms.uSzelIrany = SZEL.irany;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SZEL_GLSL)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  transformed += szelEltol(position.xz, uv.y * 2.3, 0.05, uSzelIdo);`);
  };
  m.customProgramCacheKey = () => 'szel-kukorica';
  m.needsUpdate = true;
  return m;
}
