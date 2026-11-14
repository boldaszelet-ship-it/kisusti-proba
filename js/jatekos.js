// Kisüsti — gyalogos irányítás belső nézetben: WASD, futás (Shift), ugrás (Space, coyote time + bemeneti
// puffer), egér-nézelődés (pointer lock), a domborzaton jár (y = talaj), ütközik az épületekkel, nem megy vízbe.
import * as THREE from 'three';

/** Billentyű- és egérbemenet (közös a gyalogos és a jármű között). */
export class Bemenet {
  constructor(dom) {
    this.keys = new Set(); this.dx = 0; this.dy = 0; this.lenyomva = new Set(); this.dom = dom;
    addEventListener('keydown', e => { if (!this.keys.has(e.code)) this.lenyomva.add(e.code); this.keys.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', e => { if (document.pointerLockElement === dom) { this.dx += e.movementX; this.dy += e.movementY; } });
    dom?.addEventListener('click', () => { if (document.pointerLockElement !== dom) dom.requestPointerLock?.(); });
  }
  van(...codes) { return codes.some(c => this.keys.has(c)); }
  /** Egyszeri lenyomás (a képkocka végén törlődik). */
  most(code) { return this.lenyomva.has(code); }
  egerKi() { const r = [this.dx, this.dy]; this.dx = this.dy = 0; return r; }
  kockaVege() { this.lenyomva.clear(); }
}

const WALK = 4.3, RUN = 7.2, ACC_G = 16, ACC_AIR = 3, JUMP = 4.6, GRAV = 13, R = 0.34, EYE = 1.65;
const COYOTE = 0.1, BUFFER = 0.12;   // 6 képkocka 60 fps-en; 7 képkocka

export class Jatekos {
  /** vilag: az epitVilag() eredménye (talaj, utk, vizben, BOUNDS) */
  constructor(camera, vilag, bemenet) {
    this.camera = camera; this.V = vilag; this.in = bemenet;
    this.pos = new THREE.Vector3(0, 0, 4); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.vy = 0; this.foldon = true; this.aktiv = true;
    this.coyote = 0; this.buffer = 0; this.bob = 0; this.camY = null; this.zarolva = false;
    this.erz = 0.0022;
  }
  hely(x, z, yawFok = 0, pitchFok = 0) {
    this.pos.set(x, this.V.talaj(x, z), z); this.vel.set(0, 0, 0); this.vy = 0;
    this.yaw = yawFok * Math.PI / 180; this.pitch = pitchFok * Math.PI / 180; this.camY = null;
    this.kamera();
  }
  /** Egér-nézelődés (a jármű is hívhatja). */
  nez(dt) {
    const [dx, dy] = this.in.egerKi();
    this.yaw -= dx * this.erz; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * this.erz, -1.45, 1.45);
    if (this.in.van('ArrowLeft')) this.yaw += 1.8 * dt;
    if (this.in.van('ArrowRight')) this.yaw -= 1.8 * dt;
    if (this.in.van('ArrowUp')) this.pitch = Math.min(1.45, this.pitch + 1.2 * dt);
    if (this.in.van('ArrowDown')) this.pitch = Math.max(-1.45, this.pitch - 1.2 * dt);
  }
  update(dt) {
    if (!this.aktiv) return;
    const I = this.in, V = this.V;
    if (!this.zarolva) this.nez(dt);
    const f = this.zarolva ? 0 : (I.van('KeyW') ? 1 : 0) - (I.van('KeyS') ? 1 : 0);
    const r = this.zarolva ? 0 : (I.van('KeyD') ? 1 : 0) - (I.van('KeyA') ? 1 : 0);
    const run = I.van('ShiftLeft', 'ShiftRight');
    const sp = run ? RUN : WALK;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    let tx = fx * f + Math.cos(this.yaw) * r, tz = fz * f - Math.sin(this.yaw) * r;
    const n = Math.hypot(tx, tz); if (n > 0) { tx = tx / n * sp; tz = tz / n * sp; }
    const a = Math.min(1, (this.foldon ? ACC_G : ACC_AIR) * dt);
    this.vel.x += (tx - this.vel.x) * a; this.vel.z += (tz - this.vel.z) * a;
    // ugrás: coyote time és bemeneti puffer
    if (I.most('Space')) this.buffer = BUFFER; else this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.foldon ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0 && !this.zarolva) { this.vy = JUMP; this.buffer = 0; this.coyote = 0; this.foldon = false; }
    // mozgás + ütközés + víz + határ
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const g0 = V.talaj(this.pos.x, this.pos.z);
    V.utk.resolve(this.pos, R, Math.max(0, this.pos.y - g0));
    if (V.vizben(this.pos.x, this.pos.z)) { this.pos.x = ox; this.pos.z = oz; this.vel.x = this.vel.z = 0; }
    const B = V.BOUNDS;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, B.x0 + 2, B.x1 - 2); this.pos.z = THREE.MathUtils.clamp(this.pos.z, B.z0 + 2, B.z1 - 2);
    // függőleges: talajkövetés lejtőn (lefelé ráhúz, ha közel), gravitáció
    const g = V.talaj(this.pos.x, this.pos.z);
    this.vy -= GRAV * dt; this.pos.y += this.vy * dt;
    if (this.pos.y <= g || (this.foldon && this.vy <= 0 && this.pos.y - g < 0.35)) { this.pos.y = g; this.vy = 0; this.foldon = true; }
    else this.foldon = false;
    // fejbillegés járás közben (finom: 3 cm)
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.foldon && hs > 0.5) this.bob += dt * hs * 1.9; else this.bob *= 0.9;
    this.kamera(dt);
  }
  kamera(dt = 0) {
    const yEye = this.pos.y + EYE + (this.foldon ? Math.sin(this.bob * 2) * 0.03 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 4) : 0);
    // a lépcsős talajon a kamera magassága simítva (a szem nem ugrál)
    this.camY = this.camY == null || !dt ? yEye : this.camY + (yEye - this.camY) * Math.min(1, dt * 18);
    this.camera.position.set(this.pos.x, this.camY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
