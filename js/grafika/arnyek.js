// Kisüsti — kontaktárnyék a mozgó szereplők és járművek alatt: puha, sötét folt a talajon, ami a tárgy
// talajtól mért magasságával halványul. A napárnyék a figurák lábánál vékony és a 110 m-es árnyékkamerán
// kívül nincs; ettől „lebegnek”. Egy rajzhívás (InstancedMesh), minden minőségi szinten.
import * as THREE from 'three';

function foltTex() {
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv); return t;
}

export class KontaktArnyek {
  constructor(scene, talaj, max = 96) {
    this.talaj = talaj; this.lista = []; this.max = max;
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ map: foltTex(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, fog: true });
    // az átlátszóság a textúra alfájából jön (a szín fekete)
    this.mat.alphaMap = this.mat.map; this.mat.map = null;
    this.im = new THREE.InstancedMesh(g, this.mat, max); this.im.count = 0; this.im.frustumCulled = false; this.im.renderOrder = 1; this.im.name = 'kontaktarnyek';
    this.im.instanceColor = null;
    scene.add(this.im);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  /** obj: Object3D; sx, sz: a folt fél-méretei (m) a tárgy helyi x/z tengelyén; dy: a tárgy origója és a talpa közti eltérés. */
  add(obj, sx = 0.45, sz = sx, dy = 0) { this.lista.push({ obj, sx, sz, dy }); }
  torol(obj) { this.lista = this.lista.filter(e => e.obj !== obj); }
  update(cam) {
    let n = 0; const p = this._p, m = this._m, q = this._q, s = this._s;
    for (const e of this.lista) {
      if (n >= this.max) break;
      const o = e.obj; if (!o.visible || (o.parent && !o.parent.visible)) continue;
      o.getWorldPosition(p);
      if ((p.x - cam.x) ** 2 + (p.z - cam.z) ** 2 > 60 * 60) continue;
      const gy = this.talaj(p.x, p.z), h = Math.max(0, p.y + e.dy - gy);
      const k = Math.max(0, 1 - h / 1.5); if (k <= 0.02) continue;
      this._e.set(0, Math.atan2(o.matrixWorld.elements[8], o.matrixWorld.elements[10]), 0); q.setFromEuler(this._e);
      const gr = 1 + h * 0.6;
      s.set(e.sx * 2 * gr, 1, e.sz * 2 * gr);
      p.y = gy + 0.04;
      m.compose(p, q, s); this.im.setMatrixAt(n, m);
      n++;
    }
    this.im.count = n; this.im.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.im.removeFromParent(); this.im.geometry.dispose(); this.mat.dispose(); }
}
