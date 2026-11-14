// Kisüsti — rajzhívás-takarékosság: statikus kötegelő (összevont geometria anyagonként és cellánként),
// szórás (InstancedMesh cellánként), távolsági elrejtés (LOD), ütközők térbeli rácson.
import * as THREE from 'three';
import { MODELS, modelGeo, mergeItems } from './betolto.js';

/** Rétegek: cellaméret (m) és láthatósági távolság (m). A köd ezek előtt elnyeli a széleket. */
export const RETEG = {
  epulet: { ch: 192, dist: 800 },   // házak, utcabútor, nagy tárgyak
  kozep: { ch: 128, dist: 330 },    // kerítés, oszlop, kis tárgyak
  kis: { ch: 128, dist: 100 },      // fűcsomó-, virág-, kőcsoportok
  fa: { ch: 512, dist: 900 },       // fák (távolról is látszanak: ez adja a táj mélységét)
  bokor: { ch: 256, dist: 330 },    // bokrok, szőlősorok
  ablak: { ch: 192, dist: 800 },
  din: { ch: 128, dist: 290 },      // dinamikus (célozható, mozgó) tárgyak: a szülőcsoport rejt, a tárgy saját láthatósága az integrátoré
};

/** Cellánkénti csoportok + távolsági elrejtés. */
export class Lod {
  constructor(scene) { this.scene = scene; this.cells = new Map(); this.list = []; this.t = 0; }
  cell(layer, x, z) {
    const L = RETEG[layer], i = Math.floor(x / L.ch), j = Math.floor(z / L.ch), key = layer + ':' + i + ':' + j;
    let c = this.cells.get(key);
    if (!c) {
      const g = new THREE.Group(); g.name = key; this.scene.add(g);
      c = { g, x: (i + 0.5) * L.ch, z: (j + 0.5) * L.ch, r: L.ch * 0.7072, dist: L.dist, layer };
      this.cells.set(key, c); this.list.push(c);
    }
    return c;
  }
  /** Láthatóság frissítése (olcsó: cellánként egy távolság). mult: távolság-szorzó (pl. éjjel kisebb). */
  update(cam, mult = 1) {
    for (const c of this.list) {
      const d = Math.hypot(cam.x - c.x, cam.z - c.z) - c.r;
      c.g.visible = d < c.dist * mult;
    }
  }
}

/** Statikus kötegelő: a hozzáadott objektumok hálóit anyagonként és cellánként egy hálóba vonja. */
export class Kotegelo {
  constructor(lod) { this.lod = lod; this.groups = new Map(); this.meshes = []; this.n = 0; }
  add(obj, layer = 'epulet') {
    obj.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    obj.traverse(m => {
      if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || !m.visible) return;
      if (m.material.transparent && m.material.opacity === 0) return;   // célzó-gömb
      v.setFromMatrixPosition(m.matrixWorld);
      const L = RETEG[layer];
      const vc = m.material.userData.vc;
      const key = layer + '|' + Math.floor(v.x / L.ch) + '|' + Math.floor(v.z / L.ch) + '|' + (vc || m.material.uuid) + '|' + (m.castShadow ? 1 : 0);
      let g = this.groups.get(key);
      if (!g) { g = { layer, x: v.x, z: v.z, mat: vc ? vcMat(vc) : m.material, vc: !!vc, cast: m.castShadow, items: [] }; this.groups.set(key, g); }
      g.items.push({ geo: m.geometry, m: m.matrixWorld.clone(), color: vc ? m.material.color : null });
      this.n++;
    });
    obj.removeFromParent();
  }
  build() {
    for (const g of this.groups.values()) {
      // egy hálóban legfeljebb ~60 000 csúcs (16 bites index és jó frustum-vágás)
      let batch = [], nv = 0;
      const flush = () => {
        if (!batch.length) return;
        const geo = mergeItems(batch, g.vc);
        const me = new THREE.Mesh(geo, g.mat);
        me.castShadow = g.cast; me.receiveShadow = true; me.matrixAutoUpdate = false;
        this.lod.cell(g.layer, g.x, g.z).g.add(me); this.meshes.push(me);
        batch = []; nv = 0;
      };
      for (const it of g.items) {
        const c = it.geo.attributes.position.count;
        if (nv + c > 60000) flush();
        batch.push(it); nv += c;
      }
      flush();
    }
    this.groups.clear();
    return this.meshes.length;
  }
}

export const VC_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const vcMats = {};
/** Csúcsszínes közös anyag (az egyszínű anyagok összevonásához). */
export function vcMat(k) { return vcMats[k] ||= (k === 'lambert2' ? VC_MAT : new THREE.MeshLambertMaterial({ vertexColors: true })); }

/** Kis növénycsoportok: [modell, x, z, skála] — egy csoport egy InstancedMesh-példány (kevesebb rajzhívás). */
export const KLASZTER = {
  fu: [['grass', 0, 0, 2.6], ['grass_leafs', 0.7, 0.3, 3.4], ['grass_leafs', -0.6, -0.4, 3.0], ['grass_leafs', 0.1, 0.8, 2.6]],
  fu2: [['grass_leafs', 0, 0, 3.6], ['grass_leafs', 0.8, -0.2, 3.0], ['grass_leafs', -0.5, 0.5, 3.2], ['flower_yellowA', 0.3, -0.7, 2.4], ['plant_bush', -0.9, -0.5, 2.4]],
  virag: [['flower_purpleA', 0, 0, 2.4], ['flower_redA', 0.6, 0.4, 2.2], ['grass_leafs', -0.5, 0.2, 3.2], ['flower_yellowA', 0.2, -0.6, 2.0]],
  bokor: [['plant_bush', 0, 0, 3.2], ['plant_bushSmall', 0.9, 0.4, 3.6], ['rock_smallA', -0.7, 0.3, 2.6], ['grass_leafs', 0.2, -0.8, 3]],
  nad: [['grass_leafs', 0, 0, 5.5], ['grass_leafs', 0.6, 0.4, 4.8], ['grass', -0.5, 0.3, 3.4], ['grass_leafs', 0.1, -0.6, 5]],
};
const klCache = new Map();
function klaszter(name) {
  if (klCache.has(name)) return klCache.get(name);
  const items = [];
  for (const [k, x, z, s] of KLASZTER[name]) {
    const g = modelGeo('nature-kit/' + k, true)[0].geo;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), x * 7 + z * 3), new THREE.Vector3(s, s, s));
    items.push({ geo: g, m });
  }
  const r = [{ geo: mergeItems(items, true), mat: VC_MAT }];
  klCache.set(name, r); return r;
}

/** Szórás: ismétlődő modellek InstancedMesh-ként, modellenként és cellánként. */
export class Szoro {
  constructor(lod) { this.lod = lod; this.groups = new Map(); this.meshes = []; this.count = 0; }
  /** key: modell; s: szám vagy [sx,sy,sz]; o: {layer, vc (csúcsszín-sütés), shadow, color (példányszín), rx, rz} */
  add(key, x, y, z, s = 1, ry = 0, o = {}) {
    const layer = o.layer || 'fa', L = RETEG[layer];
    const gk = key + '|' + layer + '|' + Math.floor(x / L.ch) + '|' + Math.floor(z / L.ch) + '|' + (o.shadow === false ? 0 : 1) + '|' + (o.vc === false ? 0 : 1) + '|' + (o.pal || '');
    let g = this.groups.get(gk);
    if (!g) { g = { key, layer, x, z, shadow: o.shadow !== false, vc: o.vc !== false, palMat: o.palMat || null, list: [] }; this.groups.set(gk, g); }
    g.list.push([x, y, z, s, ry, o.color ?? null, o.rx || 0, o.rz || 0]);
  }
  /** Csoport (több kis modell egy példányban, pl. fűcsomó + virág + kő): név a KLASZTER-ből. */
  addKlaszter(name, x, y, z, s = 1, ry = 0, o = {}) { this.addGeo('k:' + name, klaszter(name), x, y, z, s, ry, { layer: 'kis', shadow: false, ...o }); }
  /** Saját geometria szórása (nem modell): parts = [{geo, mat}] */
  addGeo(name, parts, x, y, z, s = 1, ry = 0, o = {}) {
    const layer = o.layer || 'kozep', L = RETEG[layer];
    const gk = 'geo:' + name + '|' + layer + '|' + Math.floor(x / L.ch) + '|' + Math.floor(z / L.ch);
    let g = this.groups.get(gk);
    if (!g) { g = { parts, layer, x, z, shadow: o.shadow !== false, list: [] }; this.groups.set(gk, g); }
    g.list.push([x, y, z, s, ry, o.color ?? null, o.rx || 0, o.rz || 0]);
  }
  build() {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (const g of this.groups.values()) {
      const parts = g.parts || modelGeo(g.key, g.vc).map(pt => ({ geo: pt.geo, mat: pt.mat ? (g.palMat ? g.palMat(pt.mat) : pt.mat) : VC_MAT }));
      for (const pt of parts) {
        const im = new THREE.InstancedMesh(pt.geo, pt.mat, g.list.length);
        im.castShadow = g.shadow; im.receiveShadow = true;
        const hasCol = g.list.some(r => r[5] != null);
        g.list.forEach((r, i) => {
          const [x, y, z, s, ry, c, rx, rz] = r;
          e.set(rx, ry, rz, 'YXZ'); q.setFromEuler(e); p.set(x, y, z);
          if (Array.isArray(s)) sc.set(s[0], s[1], s[2]); else sc.setScalar(s);
          m4.compose(p, q, sc); im.setMatrixAt(i, m4);
          if (hasCol) im.setColorAt(i, col.set(c ?? 0xffffff));
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        this.lod.cell(g.layer, g.x, g.z).g.add(im); this.meshes.push(im);
        this.count += g.list.length;
      }
    }
    this.groups.clear();
    return this.meshes.length;
  }
}

/** Ütközők térbeli rácson: tengelyhez igazított doboz, elforgatott doboz, kör. */
export class Utkozok {
  constructor(cell = 16) { this.cell = cell; this.grid = new Map(); this.all = []; this.stamp = 0; }
  _ins(c, x0, x1, z0, z1) {
    const C = this.cell;
    for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++)
      for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) {
        const k = i * 100003 + j; let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(c);
      }
    c.s = 0; this.all.push(c); return c;
  }
  /** Kompatibilis a régi {x0,x1,z0,z1} formával. */
  push(...cs) { for (const c of cs) this.box(c.x0, c.x1, c.z0, c.z1); }
  box(x0, x1, z0, z1, h = 99) { return this._ins({ t: 0, x0, x1, z0, z1, h }, x0, x1, z0, z1); }
  /** Elforgatott doboz: közép, szélesség (helyi x), mélység (helyi z), elforgatás y körül. */
  obb(cx, cz, w, d, ry, h = 99) {
    if (Math.abs(Math.sin(ry)) < 1e-4 || Math.abs(Math.cos(ry)) < 1e-4) {
      const sw = Math.abs(Math.cos(ry)) > 0.5 ? w : d, sd = Math.abs(Math.cos(ry)) > 0.5 ? d : w;
      return this.box(cx - sw / 2, cx + sw / 2, cz - sd / 2, cz + sd / 2, h);
    }
    const R = Math.hypot(w, d) / 2;
    return this._ins({ t: 1, cx, cz, hx: w / 2, hz: d / 2, c: Math.cos(ry), s_: Math.sin(ry), h }, cx - R, cx + R, cz - R, cz + R);
  }
  kor(x, z, r, h = 99) { return this._ins({ t: 2, cx: x, cz: z, r, h }, x - r, x + r, z - r, z + r); }
  /** Kör (p.x, p.z, R) kitolása az ütközőkből. Visszaadja, volt-e ütközés. y: a láb magassága a talaj felett (alacsony akadály átléphető). */
  resolve(p, R, lift = 0) {
    const C = this.cell; let hit = false; this.stamp++;
    for (let i = Math.floor((p.x - R) / C); i <= Math.floor((p.x + R) / C); i++)
      for (let j = Math.floor((p.z - R) / C); j <= Math.floor((p.z + R) / C); j++) {
        const a = this.grid.get(i * 100003 + j); if (!a) continue;
        for (const c of a) {
          if (c.s === this.stamp) continue; c.s = this.stamp;
          if (c.h < lift) continue;
          if (c.t === 0) hit = boxPush(p, R, c.x0, c.x1, c.z0, c.z1) || hit;
          else if (c.t === 2) {
            const dx = p.x - c.cx, dz = p.z - c.cz, d = Math.hypot(dx, dz), m = R + c.r;
            if (d < m) { if (d > 1e-6) { p.x = c.cx + dx / d * m; p.z = c.cz + dz / d * m; } else p.x = c.cx + m; hit = true; }
          } else {
            // helyi koordinátába, doboz-kitolás, vissza
            const dx = p.x - c.cx, dz = p.z - c.cz;
            const lp = { x: dx * c.c - dz * c.s_, z: dx * c.s_ + dz * c.c };
            if (boxPush(lp, R, -c.hx, c.hx, -c.hz, c.hz)) {
              hit = true;
              p.x = c.cx + lp.x * c.c + lp.z * c.s_; p.z = c.cz - lp.x * c.s_ + lp.z * c.c;
            }
          }
        }
      }
    return hit;
  }
  /** Pont egy ütközőben van-e (a járművek sarkaihoz). */
  inside(x, z, pad = 0) {
    const C = this.cell, a = this.grid.get(Math.floor(x / C) * 100003 + Math.floor(z / C)); if (!a) return null;
    for (const c of a) {
      if (c.t === 0) { if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return c; }
      else if (c.t === 2) { if (Math.hypot(x - c.cx, z - c.cz) < c.r + pad) return c; }
      else {
        const dx = x - c.cx, dz = z - c.cz, lx = dx * c.c - dz * c.s_, lz = dx * c.s_ + dz * c.c;
        if (Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad) return c;
      }
    }
    return null;
  }
}
function boxPush(p, R, x0, x1, z0, z1) {
  const cx = Math.max(x0, Math.min(p.x, x1)), cz = Math.max(z0, Math.min(p.z, z1));
  const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= R * R) return false;
  if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (R - d) / d; p.x += dx * k; p.z += dz * k; }
  else {
    const pen = [[p.x - x0 + R, -1, 0], [x1 - p.x + R, 1, 0], [p.z - z0 + R, 0, -1], [z1 - p.z + R, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    p.x += pen[1] * pen[0]; p.z += pen[2] * pen[0];
  }
  return true;
}
export { MODELS };
