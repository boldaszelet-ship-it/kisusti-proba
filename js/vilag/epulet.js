// Kisüsti — épületgyár: moduláris ház (Kenney Fantasy Town falelemek, palettacsere), változatok
// (méret, falanyag, falszín, tetőszín és -forma, kémény, tornác, lábazat, emelet), kerítés, utcabútor, tábla.
import * as THREE from 'three';
import { prop } from './betolto.js';
import { recolor, palFantasy, palTeto, palCity, mat, FAL, TETO, FA, rgb } from './paletta.js';
import { talaj } from './terep.js';

export const T = 2.6;          // a moduláris falelemek rácsmérete (a Kenney-egység 2,6-szorosa)
export const RISE = 2.4;       // nyeregtető magassága
const FK = n => 'fantasy-town-kit/' + n;
const LAB = { szurke: 0x8c877d, sotet: 0x5d5853, tegla: 0x8b4c37, ko: 0x9a9488, sarga: 0xb79a66 };

const oromGeo = new Map();
function orom(D, rise) {
  const k = D.toFixed(2) + '|' + rise;
  if (!oromGeo.has(k)) {
    const sh = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rise)]);
    oromGeo.set(k, new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }));
  }
  return oromGeo.get(k);
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
/** Doboz egy csoportba (egységkockából skálázva: a kötegelő így egy geometriát lát). */
export function doboz(parent, x, y, z, w, h, d, m, ry = 0) {
  const me = new THREE.Mesh(boxGeo, typeof m === 'number' ? mat(m) : m);
  me.position.set(x, y, z); me.scale.set(w, h, d); me.rotation.y = ry; me.castShadow = true; me.receiveShadow = true;
  parent.add(me); return me;
}
const cylGeo = new Map();
export function henger(parent, x, y, z, r, h, m, seg = 12, r2 = null) {
  const k = seg + '|' + (r2 == null ? 1 : (r2 / r).toFixed(3));
  if (!cylGeo.has(k)) cylGeo.set(k, new THREE.CylinderGeometry(r2 == null ? 1 : r2 / r, 1, 1, seg));
  const me = new THREE.Mesh(cylGeo.get(k), typeof m === 'number' ? mat(m) : m);
  me.position.set(x, y, z); me.scale.set(r, h, r); me.castShadow = true; me.receiveShadow = true;
  parent.add(me); return me;
}

/** Talajra ültetés: a lábnyom sarkaiban mért legmagasabb pont (a lejtős oldalon a lábazat látszik). */
export function alap(x, z, W, D, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  let hi = -1e9, lo = 1e9;
  for (const [lx, lz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [0, 0]]) {
    const y = talaj(x + lx * c + lz * s, z - lx * s + lz * c); hi = Math.max(hi, y); lo = Math.min(lo, y);
  }
  return { y: hi + 0.04, lo };
}
/** Helyi pont → világ (a ház középpontja és elforgatása szerint). */
export function vilagba(x, z, ry, lx, lz) { const c = Math.cos(ry), s = Math.sin(ry); return [x + lx * c + lz * s, z - lx * s + lz * c]; }

/**
 * Moduláris ház. Helyi koordinátákban épül (közép = 0,0; a gerinc a helyi x mentén; a homlokzat, „s” = +z),
 * majd elforgatva a helyére kerül.
 * o: {x, z, ry, nx, nz, emelet, falak:{n,s,w,e}, falak2 (emeleti), stilus:{fal,teto,fa}, teto:'nyereg'|'sator'|'lapos'|'nincs',
 *     kemeny, tornac (mélység m), fa (deszkafal), oromfa (fa oromzat), lab (lábazat színe), ablak (elemnév), ablakFeny (0..1), layer, utk}
 * Visszaad: {g, ajto: [x,z] (a bejárat előtt 1 m-rel), y, W, D, teto: tetőgerinc magassága}
 */
export function haz(ctx, o) {
  const nx = o.nx ?? 3, nz = o.nz ?? 2, em = o.emelet ?? 1, ry = o.ry ?? 0;
  const W = nx * T, D = nz * T, P = o.tornac || 0;
  const st = { fal: 'meszel', teto: 'cserep', fa: null, ...(o.stilus || {}) };
  const pal = palFantasy(st.fal, st.teto, st.fa);
  const { y: yb, lo } = alap(o.x, o.z, W + 0.4, D + P + 0.4, ry);
  const g = new THREE.Group(); g.position.set(o.x, yb, o.z); g.rotation.y = ry;
  const cx = i => -W / 2 + T / 2 + T * i, cz = j => -D / 2 + T / 2 + T * j;
  const put = (name, px, py, pz, r, sc = T) => recolor(prop(FK(name), px, py, pz, sc, r, g), /^roof/.test(name) ? palT : pal);
  const palT = palTeto(st.teto);
  const wood = !!o.fa;
  const win = o.ablak || (wood ? 'wall-wood-window-shutters' : 'wall-window-shutters');
  const sima = wood ? 'wall-wood' : 'wall', ajto = wood ? 'wall-wood-door' : 'wall-door';
  const def = {
    s: [...Array(nx)].map((_, i) => i === Math.floor((nx - 1) / 2) ? ajto : win),
    n: [...Array(nx)].map((_, i) => i % 2 ? win : sima),
    w: [...Array(nz)].map(() => win), e: [...Array(nz)].map((_, j) => j % 2 ? sima : win),
  };
  const ROT = { n: Math.PI / 2, s: -Math.PI / 2, w: Math.PI, e: 0 };
  const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  let ajtoHely = null;
  const fenyP = o.ablakFeny ?? 0.55;
  for (let f = 0; f < em; f++) {
    const F = f === 0 ? { ...def, ...(o.falak || {}) } : { ...def, s: def.s.map(() => o.ablak2 || 'wall-window-glass'), ...(o.falak2 || {}) };
    if (f > 0) { F.s = F.s.map(n => n === ajto ? (o.ablak2 || 'wall-window-glass') : n); }
    for (const side of ['n', 's', 'w', 'e']) {
      (F[side] || []).forEach((name, k) => {
        if (!name) return;
        const px = side === 'n' || side === 's' ? cx(k) : side === 'w' ? cx(0) : cx(nx - 1);
        const pz = side === 'w' || side === 'e' ? cz(k) : side === 'n' ? cz(0) : cz(nz - 1);
        put(name, px, f * T, pz, ROT[side]);
        const [ox, oz] = OUT[side];
        if (/window/.test(name) && ctx.rnd() < fenyP) {
          const lx = px + ox * T * 0.515, lz = pz + oz * T * 0.515;
          const [wx, wz] = vilagba(o.x, o.z, ry, lx, lz);
          ctx.ablak(wx, yb + f * T + T * 0.54, wz, T * 0.36, T * 0.4, ry + Math.atan2(ox, oz));
        }
        if (/door/.test(name) && f === 0 && side === (o.ajtoOldal || 's') && !ajtoHely) ajtoHely = vilagba(o.x, o.z, ry, px + ox * (T * 0.5 + 1), pz + oz * (T * 0.5 + 1));
      });
    }
    if (f > 0) doboz(g, 0, f * T, 0, W + 0.22, 0.22, D + 0.22, FAL[st.fal] ? rgb(FAL[st.fal].map(v => v * 0.86)) : 0xcfc6b0);   // párkány az emeletek között
  }
  const top = em * T;
  // lábazat (a lejtős oldalon lejjebb ér)
  // lab: null/false = nincs lábazat (a pajta) — a ?? a null-t is alapértékre cserélte, így a pajtát 0,42 m-es betontömb
  // töltötte ki, és az üst, a hordó, a palackozó félig belesüllyedt (2026-11-14)
  const lab = 'lab' in o ? o.lab : 'szurke';
  if (lab) {
    const h0 = lo - yb - 0.35;
    doboz(g, 0, (h0 + 0.42) / 2, 0, W + 0.16, 0.42 - h0, D + 0.16, LAB[lab] ?? lab);
  } else if (yb - lo > 0.06) {   // lábazat nélkül, lejtőn: talpgerenda a padlószint ALÁ (a padló nem emelkedik)
    const h = yb - lo + 0.1;
    doboz(g, 0, -h / 2 + 0.005, 0, W + 0.1, h, D + 0.1, 0x4a3826);
  }
  // tornác: oszlopsor a homlokzat előtt, a tető lenyúlik fölé
  if (P) {
    doboz(g, 0, 0.06, D / 2 + P / 2, W, 0.16, P, LAB[lab] ?? 0x8c877d);
    for (let i = 0; i <= nx; i++) {
      const px = Math.max(-W / 2 + 0.2, Math.min(W / 2 - 0.2, -W / 2 + i * T));
      put('pillar-stone', px, 0, D / 2 + P - 0.22, 0, [1.7, top - 0.02, 1.7]);
    }
  }
  const Dr = D + P, zc = P / 2, tt = o.teto || 'nyereg';
  let gerinc = top;
  if (tt === 'nyereg') {
    for (let i = 0; i < nx; i++) put('roof-gable', cx(i), top, zc, 0, [T * (i === 0 || i === nx - 1 ? 1.03 : 1.0), RISE / 0.57, Dr * 1.12 / 1.07]);
    const om = o.oromfa || wood ? mat(0x6b4a30) : mat(FAL[st.fal] ? rgb(FAL[st.fal]) : 0xe6dcc4);
    for (const d of [1, -1]) {
      const tri = new THREE.Mesh(orom(Dr, RISE * 0.96), om);
      tri.position.set(d > 0 ? -W / 2 + 0.05 : W / 2 - 0.05, top, zc); tri.rotation.y = d > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (d < 0) tri.position.x -= 0; tri.castShadow = tri.receiveShadow = true; g.add(tri);
      if (o.oromfa) {   // padlásszellőző a fa oromzaton
        doboz(g, d > 0 ? -W / 2 - 0.02 : W / 2 + 0.02, top + RISE * 0.42, zc, 0.06, 0.5, 0.36, 0x2e2620);
      }
    }
    gerinc = top + RISE;
  } else if (tt === 'sator') {
    put('roof-point', 0, top, 0, 0, [W / 1.0, (o.rise || 2.6) / 0.5, D / 1.0]);
    gerinc = top + (o.rise || 2.6);
  } else if (tt === 'lapos') {
    doboz(g, 0, top + 0.12, 0, W + 0.3, 0.24, D + 0.3, LAB.sotet);
    doboz(g, 0, top + 0.45, -D / 2 - 0.05, W + 0.3, 0.5, 0.12, rgb(FAL[st.fal] || [200, 200, 200]));
    doboz(g, 0, top + 0.45, D / 2 + 0.05, W + 0.3, 0.5, 0.12, rgb(FAL[st.fal] || [200, 200, 200]));
    gerinc = top + 0.7;
  }
  if (o.kemeny !== false && tt !== 'lapos') {
    const kx = o.kemenyX ?? (W / 2 - T * 0.75), kz = tt === 'sator' ? -0.4 : zc - Dr * 0.19;
    const ky = top + (tt === 'sator' ? 1.2 : 0.9);
    put('chimney', kx, ky, kz, 0, T);
    // a kéménytorok világhelye (a modell x: 0,21…0,42, magassága 1 Kenney-egység): a füst innen indul
    const [wx, wz] = vilagba(o.x, o.z, ry, kx + 0.315 * T, kz);
    ctx.kemenyek?.push({ x: wx, y: yb + ky + T, z: wz });
  }
  ctx.statikus(g, o.layer || 'epulet');
  if (o.utk !== false) { const [ux, uz] = vilagba(o.x, o.z, ry, 0, 0); ctx.utk.obb(ux, uz, W + 0.1, D + 0.1, ry); }
  if (!ajtoHely) ajtoHely = vilagba(o.x, o.z, ry, 0, D / 2 + P + 1);
  return { g, ajto: ajtoHely, y: yb, W, D, teto: yb + gerinc, pal };
}

/** City Kit-ház (külvárosi vagy belvárosi modell) palettacserével, a talajra ültetve, ütközővel. */
export function cityHaz(ctx, key, x, z, ry, s, stilus = {}, layer = 'epulet') {
  const pal = palCity(stilus.fal || 'okker', stilus.teto || 'cserep', stilus.lab || null);
  const m = prop(key, 0, 0, 0, s, 0);
  recolor(m, pal);
  const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3());
  const { y, lo } = alap(x, z, sz.x, sz.z, ry);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.add(m);
  m.position.set(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2);
  if (y - lo > 0.1) doboz(g, 0, (lo - y - 0.3) / 2, 0, sz.x * 0.98, y - lo + 0.3, sz.z * 0.98, LAB.szurke);
  ctx.statikus(g, layer);
  ctx.utk.obb(x, z, sz.x, sz.z, ry);
  return { g, W: sz.x, D: sz.z, H: sz.y, y };
}

/** Kerítés pontsoron. tipus: 'deszka' (Fantasy Town), 'lec' (léckerítés), 'fal' (vakolt lábazatos, lécbetétes),
 *  'drot' (betonoszlop + drótháló), 'torott' (romos). kapu: [[szakasz-index, t0, t1]] — rés a kerítésben. */
export function kerites(ctx, pts, tipus = 'lec', o = {}) {
  const g = new THREE.Group();
  const gaps = o.kapu || [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [x0, z0] = pts[k], [x1, z1] = pts[k + 1];
    const L = Math.hypot(x1 - x0, z1 - z0);
    const parts = [[0, 1]];
    for (const [gi, a, b] of gaps) if (gi === k) { const p = parts.pop(); parts.push([p[0], a], [b, p[1]]); }
    for (const [a, b] of parts) {
      const len = (b - a) * L; if (len < 0.3) continue;
      const sx = x0 + (x1 - x0) * a, sz = z0 + (z1 - z0) * a, ex = x0 + (x1 - x0) * b, ez = z0 + (z1 - z0) * b;
      const step = tipus === 'deszka' ? 2.6 : tipus === 'fal' ? 2.4 : 2.2, n = Math.max(1, Math.round(len / step));
      const ang = Math.atan2(ex - sx, ez - sz);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, mx = sx + (ex - sx) * (t0 + t1) / 2, mz = sz + (ez - sz) * (t0 + t1) / 2, l = len / n;
        const y = talaj(mx, mz);
        const s = new THREE.Group(); s.position.set(mx, y, mz); s.rotation.y = ang; g.add(s);
        if (tipus === 'deszka') { const f = prop(FK('fence'), -0.46, 0, 0, 1, 0, s); s.scale.set(2.8, 2.8, l); if (o.fa) recolor(f, palFantasy('meszel', 'cserep', o.fa)); }
        else if (tipus === 'torott') { const f = prop(FK('fence-broken'), -0.46, 0, 0, 1, 0, s); s.scale.set(2.8, 2.8, l); recolor(f, palFantasy('meszel', 'cserep', 'szurke')); }
        else if (tipus === 'lec') {
          const f = prop('nature-kit/fence_simple', 0, -0.02, 0, [l, 3.2, 3.2], Math.PI / 2, s);
          if (o.szin) recolorSolid(f, o.szin);
        } else if (tipus === 'fal') {
          doboz(s, 0, 0.3, 0, 0.3, 0.75, l, o.szin ?? 0xd9d0bc);
          doboz(s, 0, 0.7, 0, 0.34, 0.06, l + 0.02, 0x8c877d);
          doboz(s, 0, 0.62, -l / 2 + 0.15, 0.36, 1.3, 0.3, o.szin ?? 0xd9d0bc);
          for (let q = -l / 2 + 0.45; q < l / 2 - 0.2; q += 0.22) doboz(s, 0, 1.05, q, 0.05, 0.62, 0.07, o.lec ?? 0x4f6a48);
          doboz(s, 0, 1.33, 0, 0.06, 0.06, l, o.lec ?? 0x4f6a48);
        } else if (tipus === 'drot') {
          henger(s, 0, 0.75, -l / 2, 0.06, 1.5, 0x9a968e, 6);
          for (const hh of [0.35, 0.8, 1.25]) doboz(s, 0, hh, 0, 0.02, 0.02, l, 0x55585a);
          for (let q = -l / 2 + 0.25; q < l / 2; q += 0.5) doboz(s, 0, 0.8, q, 0.015, 0.9, 0.015, 0x6a6d70);
        }
        if (o.utk !== false) ctx.utk.obb(mx, mz, 0.2, l, ang, tipus === 'fal' || tipus === 'deszka' || tipus === 'lec' ? 99 : 99);
      }
    }
  }
  ctx.statikus(g, o.layer || 'kozep');
  return g;
}
/** Textúra nélküli (nature-kit) modell egyszínűre festése (közös anyaggal). */
export function recolorSolid(o, color) { o.traverse(m => { if (m.isMesh) m.material = mat(color, { roughness: 0.85 }); }); return o; }

/** Festett fatábla (felirat kézzel festett hatással). Saját anyag, ezért takarékosan. */
export function tabla(ctx, text, x, y, z, ry, w = 3, h = 0.8, o = {}) {
  const cv = document.createElement('canvas'), S = 64;
  cv.width = Math.round(w * S); cv.height = Math.round(h * S);
  const c = cv.getContext('2d');
  c.fillStyle = o.hatter || '#e9dfc4'; c.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(80,60,40,${Math.random() * 0.06})`; c.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2 + Math.random() * 12, 1 + Math.random() * 2); }
  c.strokeStyle = o.keret || '#6b4a30'; c.lineWidth = 6; c.strokeRect(3, 3, cv.width - 6, cv.height - 6);
  c.fillStyle = o.szin || '#3a2a1c'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const fs = Math.min(cv.height * 0.62, cv.width / (text.length * 0.62));
  c.font = `${o.dolt ? 'italic ' : ''}bold ${fs}px Georgia, 'Times New Roman', serif`;
  c.fillText(text, cv.width / 2, cv.height / 2 + fs * 0.05);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const lap = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), new THREE.MeshLambertMaterial({ map: tex }));
  const c2 = Math.cos(ry), s2 = Math.sin(ry);
  lap.position.set(x + s2 * 0.035, y, z + c2 * 0.035); lap.rotation.y = ry; lap.castShadow = false; lap.receiveShadow = true;
  ctx.dinamikus(lap);
  const g = new THREE.Group(); doboz(g, x, y, z, w, h, 0.06, 0x6b4a30, ry); ctx.statikus(g, 'kozep');
  return lap;
}

const ponyvaMat = new Map();
/** Csíkos vászonponyva (bolt, bódé fölé): lejtős lap a homlokzat előtt, elöl fodros szegéllyel.
 *  A csoport helyi koordinátáiban: (x, y) a felső él közepe a falon, z = a fal síkja, kifelé +z. */
export function ponyva(parent, x, y, z, w, d = 1.3, a = 0.38, szinek = ['#b8322a', '#efe6d2'], ry = 0) {
  const k = szinek.join();
  if (!ponyvaMat.has(k)) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32; const c = cv.getContext('2d');
    for (let i = 0; i < 8; i++) { c.fillStyle = szinek[i % 2]; c.fillRect(i * 16, 0, 16, 32); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1, 1);
    ponyvaMat.set(k, new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
  }
  const m = ponyvaMat.get(k), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const lap = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); lap.rotation.x = -Math.PI / 2 + a; lap.position.set(0, -Math.sin(a) * d / 2, Math.cos(a) * d / 2);
  lap.geometry.attributes.uv.array.forEach((v, i, arr) => { if (i % 2 === 0) arr[i] = v * w / 1.6; });
  lap.castShadow = true; lap.receiveShadow = true; g.add(lap);
  const fodor = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.22), m); fodor.position.set(0, -Math.sin(a) * d - 0.11, Math.cos(a) * d);
  fodor.geometry.attributes.uv.array.forEach((v, i, arr) => { if (i % 2 === 0) arr[i] = v * w / 1.6; });
  g.add(fodor);
  for (const s of [-1, 1]) { const r = new THREE.Mesh(boxGeo, mat(0x3a3a3a)); r.scale.set(0.03, 0.03, d * Math.cos(a)); r.position.set(s * w / 2, -Math.sin(a) * d / 2, Math.cos(a) * d / 2); r.rotation.x = a; g.add(r); }
  return g;
}

/** Köztéri pad a talajon: öntöttvas oldalkeret, lécezett ülőke és háttámla, 1,8 m (a helyi +z felé néz).
 *  (A furniture-kit „bench” 2,4-szeres nagyítással egy 1 m széles, 1,1 m magas, a középpontjától elcsúszott
 *  székként hatott — a bírálat „lebegő széknek” látta; ezért saját geometria.) */
export function pad(ctx, x, z, ry, layer = 'kozep') {
  const g = new THREE.Group(); g.position.set(x, talaj(x, z), z); g.rotation.y = ry;
  const vas = 0x2b3530, fa = 0x8a5a38, L = 1.8;
  for (const sx of [-L / 2 + 0.12, L / 2 - 0.12]) {
    doboz(g, sx, 0.22, 0.12, 0.06, 0.44, 0.06, vas);          // első láb
    doboz(g, sx, 0.42, -0.2, 0.06, 0.84, 0.06, vas);          // hátsó láb + támla-tartó
    doboz(g, sx, 0.43, -0.04, 0.06, 0.05, 0.42, vas);         // ülőke-tartó
    doboz(g, sx, 0.62, 0.1, 0.05, 0.05, 0.05, vas);           // kartámla vége
    const kar = doboz(g, sx, 0.62, -0.06, 0.05, 0.04, 0.34, vas); kar.rotation.x = 0;
  }
  for (let i = 0; i < 4; i++) doboz(g, 0, 0.47, 0.1 - i * 0.1, L, 0.035, 0.075, fa);          // ülőlécek
  for (let i = 0; i < 3; i++) doboz(g, 0, 0.6 + i * 0.12, -0.21 - i * 0.012, L - 0.1, 0.08, 0.03, fa);   // támla
  ctx.statikus(g, layer); ctx.utk.obb(x, z, L, 0.6, ry, 0.5);
  return g;
}

// ---------------------------------------------------------------- villanyoszlop és lámpa (instancingre kész geometriák)
let OSZLOP = null;
/** A falusi betonoszlop (keresztkar, szigetelők) egy geometriában, csúcsszínnel. */
export function oszlopGeo() {
  if (OSZLOP) return OSZLOP;
  const parts = [];
  const add = (geo, color, m) => { geo.applyMatrix4(m); const n = geo.attributes.position.count, c = new Float32Array(n * 3); const cc = new THREE.Color(color); for (let i = 0; i < n; i++) { c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.deleteAttribute('uv'); parts.push(geo.index ? geo.toNonIndexed() : geo); };
  const M = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  add(new THREE.CylinderGeometry(0.1, 0.16, 8.6, 8), 0x9c978c, M(0, 4.3, 0));
  add(new THREE.BoxGeometry(1.7, 0.1, 0.1), 0x8a857b, M(0, 8.1, 0));
  for (const x of [-0.7, 0, 0.7]) add(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 6), 0xd8d8d0, M(x, 8.27, 0));
  // lámpakar és lámpatest (a falu utcái felé)
  add(new THREE.BoxGeometry(0.06, 0.06, 1.5), 0x6c6f72, M(0, 6.6, 0.72));
  add(new THREE.BoxGeometry(0.34, 0.12, 0.5), 0x50545a, M(0, 6.54, 1.45));
  const geo = mergeSimple(parts);
  OSZLOP = [{ geo, mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }) }];
  return OSZLOP;
}
export function mergeSimple(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
