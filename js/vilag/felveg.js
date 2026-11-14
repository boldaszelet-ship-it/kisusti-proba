// Kisüsti — Felvég (230, -190): a falu újabb fele. Kádár-kockák sátortetővel, külvárosi típusházak
// palettacserével, betonlábazatos kerítés, előkert, hátul veteményes és gyümölcsfák. Felvégi vegyesbolt,
// a méhész színes kaptársora és méhészkocsija. Közte a falu felé gyümölcsös.
import * as THREE from 'three';
import { prop } from './betolto.js';
import { recolor, mat, palCity } from './paletta.js';
import { haz, cityHaz, kerites, doboz, henger, tabla, pad, T, vilagba, ponyva } from './epulet.js';
import { talaj, utTav } from './terep.js';
import { porta, STILUSOK, lampaOszlop } from './falu.js';

const KADAR = [{ fal: 'okker', teto: 'cserep' }, { fal: 'kopott', teto: 'pala' }, { fal: 'barack', teto: 'barna' }, { fal: 'szurke', teto: 'cserep' }, { fal: 'sarga', teto: 'pala' }, { fal: 'zold', teto: 'barna' }];
const SUB = ['a', 'b', 'c', 'd', 'e', 'f', 'h', 'k', 'l', 'm', 'n'];

/** Kertes ház az x = 230-as utca mentén. oldal: -1 nyugat, 1 kelet. */
function kertesHaz(ctx, z, oldal, i) {
  const R = ctx.rnd, ux = 0, uz = -1, nx = oldal, nz = 0;
  const elo = 7 + R() * 3;                         // előkert mélysége
  const fx = 230 + oldal * 3.6;                    // a kerítés vonala
  const tipus = i % 3;
  let H;
  if (tipus === 0) {
    // Kádár-kocka: 3 × 3 rács, sátortető, a homlokzat az utcára néz, két-három ablak
    const st = KADAR[Math.floor(R() * KADAR.length)];
    const ry = oldal > 0 ? Math.PI / 2 : -Math.PI / 2;     // a helyi +z (homlokzat) az utca felé
    const hx = fx + oldal * (elo + 3.9);
    H = haz(ctx, { x: hx, z, ry, nx: 3, nz: 3, teto: 'sator', rise: 2.3, stilus: { ...st, fa: R() < 0.5 ? 'barna' : 'szurke' }, ablak: 'wall-window-glass', lab: R() < 0.5 ? 'sotet' : 'tegla',
      falak: { s: ['wall-window-glass', 'wall-window-glass', 'wall-window-glass'], n: ['wall', 'wall-window-small', 'wall'], w: ['wall-window-glass', 'wall', 'wall-door'], e: ['wall', 'wall-window-small', 'wall'] }, ajtoOldal: 'w' });
    // kocsibeálló a ház mellett
    const g = new THREE.Group(), bx = fx + oldal * (elo + 2), bz = z + (oldal > 0 ? -1 : 1) * 7.2;
    g.position.set(bx, talaj(bx, bz), bz);
    for (const [px, pz] of [[-2, -2.6], [2, -2.6], [-2, 2.6], [2, 2.6]]) henger(g, px, 1.2, pz, 0.07, 2.4, 0x6a6d70, 8);
    doboz(g, 0, 2.45, 0, 4.6, 0.1, 5.8, 0x8e9190);
    ctx.statikus(g, 'kozep');
  } else {
    // külvárosi típusház (City Kit Suburban) palettacserével
    const key = 'city-kit-suburban/building-type-' + SUB[Math.floor(R() * SUB.length)];
    const st = { fal: ['meszel', 'okker', 'barack', 'kekes', 'sarga'][Math.floor(R() * 5)], teto: ['cserep', 'barna', 'piros'][Math.floor(R() * 3)], lab: 'pala' };
    const ry = oldal > 0 ? -Math.PI / 2 : Math.PI / 2;
    H = cityHaz(ctx, key, fx + oldal * (elo + 5.5), z, ry, 8.2, st);
  }
  // utcai kerítés: betonlábazat + léc / drót, kapuval
  kerites(ctx, [[fx, z - 10], [fx, z + 10]], R() < 0.6 ? 'fal' : 'drot', { kapu: [[0, 0.62, 0.8]], szin: [0xdcd4c4, 0xc8c2b6, 0xe2d6bc][Math.floor(R() * 3)], lec: [0x4a4f55, 0x5a4636, 0x40604a][Math.floor(R() * 3)] });
  for (const dz of [-10, 10]) kerites(ctx, [[fx, z + dz], [fx + oldal * 34, z + dz]], 'drot');
  // előkert: díszfa, rózsa, pad
  const ex = fx + oldal * 2.5, ez = z + (R() - 0.5) * 8;
  ctx.szoro.add('nature-kit/' + (R() < 0.5 ? 'tree_small' : 'tree_tall'), ex, talaj(ex, ez) - 0.05, ez, 3 + R(), R() * 6, { layer: 'fa' }); ctx.utk.kor(ex, ez, 0.3);
  ctx.szoro.addKlaszter('virag', fx + oldal * 1.4, talaj(fx + oldal * 1.4, z + 4), z + 4, 1, R() * 6);
  if (R() < 0.35) pad(ctx, fx - oldal * 0.9, z - 4, oldal > 0 ? -Math.PI / 2 : Math.PI / 2);
  // hátul: veteményes sorokban, gyümölcsfák, fészer
  const kx = fx + oldal * (elo + 16), kz = z;
  const kert = new THREE.Group(); kert.position.set(kx, talaj(kx, kz), kz);
  const NOV = ['crops_leafsStageB', 'crop_carrot', 'crops_cornStageC', 'crop_pumpkin', 'crops_leafsStageA', 'crop_turnip'];
  for (let r = 0; r < 5; r++) {
    const n = NOV[(i + r) % NOV.length];
    for (let k = 0; k < 7; k++) prop('nature-kit/' + n, (r - 2) * 1.2, -0.05, (k - 3) * 1.1, 2.6, R() * 6, kert, false);
  }
  doboz(kert, 0, 0.0, 0, 6.4, 0.08, 8.6, 0x5f4a34);
  ctx.statikus(kert, 'kozep');
  for (let k = 0; k < 2; k++) { const tx = fx + oldal * (elo + 24 + k * 4), tz = z + (k ? 5 : -5); ctx.szoro.add('nature-kit/tree_fat', tx, talaj(tx, tz) - 0.05, tz, 3.4 + R(), R() * 6, { layer: 'fa' }); ctx.utk.kor(tx, tz, 0.3); }
  return H;
}

export function epitFelveg(ctx) {
  const R = ctx.rnd, out = {};
  // ---- a falu felé: gyümölcsös (szilva, kajszi) sorokban az utca két oldalán
  for (const oldal of [-1, 1]) for (let r = 0; r < 6; r++) for (let z = -62; z > -116; z -= 6) {
    const x = 230 + oldal * (14 + r * 6), zz = z + (r % 2) * 3;
    if (utTav(x, zz) < 4) continue;
    ctx.szoro.add('nature-kit/tree_fat', x, talaj(x, zz) - 0.05, zz, 2.9 + R() * 0.5, R() * 6, { layer: 'fa', color: new THREE.Color().setHSL(0.22, 0.3, 0.86 + R() * 0.12).getHex() });
    ctx.utk.kor(x, zz, 0.25);
  }
  // ---- kertes házak a Felvég utcájában
  let i = 0;
  for (let z = -132; z > -262; z -= 21) {
    for (const o of [-1, 1]) {
      if (o < 0 && Math.abs(z - -176) < 14) continue;     // a bolt helye
      if (o > 0 && z < -190 && z > -244) continue;         // a méhész telke
      kertesHaz(ctx, z, o, i++);
    }
  }
  // ---- felvégi vegyesbolt: lapos tetős üzlet ponyvával, előtte kis parkoló és pad
  {
    const H = haz(ctx, { x: 216.6, z: -176, ry: Math.PI / 2, nx: 4, nz: 2, teto: 'lapos', stilus: { fal: 'meszel', teto: 'pala', fa: 'barna' }, ablak: 'wall-window-glass', lab: 'sotet', ablakFeny: 1,
      falak: { s: ['wall-window-glass', 'wall-door', 'wall-window-glass', 'wall-window-glass'], n: ['wall', 'wall', 'wall', 'wall'] } });
    tabla(ctx, 'VEGYESBOLT', 216.6 + T + 0.08, H.y + 2.55, -176, Math.PI / 2, 5, 0.66, { hatter: '#f6efda', szin: '#2b4f7a', keret: '#2b4f7a' });
    const g = new THREE.Group(), y = talaj(222, -176);
    ponyva(g, 216.6 + T + 0.1, H.y + 2.05, -176, 9.6, 1.6, 0.38, ['#2b4f7a', '#efe6d2'], Math.PI / 2);
    for (let k = 0; k < 3; k++) prop('survival-kit/box', 220.4, y, -180.5 + k * 0.7, 2.4, R(), g);
    prop('city-kit-roads/dumpster', 219.8, y, -170.2, 6, Math.PI / 2, g);
    ctx.statikus(g, 'kozep'); ctx.utk.box(219.6, 221.4, -181, -178.6); ctx.utk.obb(219.8, -170.2, 2.4, 1.8, Math.PI / 2);
    pad(ctx, 221, -173.2, -Math.PI / 2);
    lampaOszlop(ctx, 224.6, -184);
    ctx.horgony('bolt', 220.6, -176, null, { tipus: 'uzlet' });
  }
  // ---- a méhész: ház, színes kaptársor (rakodós kaptárak állványon), méhészkocsi, akácfák
  {
    const H = haz(ctx, { x: 274, z: -206, ry: -Math.PI / 2, nx: 3, nz: 2, stilus: { fal: 'sarga', teto: 'barna', fa: 'zold' }, tornac: 1.8, oromfa: true });
    const KAPTAR = [0x3f7fb0, 0xd6a536, 0x4f8a4a, 0xc85a3a, 0xe6e0cc, 0x6a8fb8, 0xb8a24a];
    const g = new THREE.Group();
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
      const x = 252 + k * 1.7, z = -224 + r * 4.2, y = talaj(x, z);
      doboz(g, x, y + 0.25, z, 1.3, 0.08, 0.9, 0x6b4a30);
      for (const [px, pz] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) doboz(g, x + px, y + 0.12, z + pz, 0.07, 0.25, 0.07, 0x5a3e28);
      const c = KAPTAR[(r * 6 + k) % KAPTAR.length], em = 1 + Math.floor(R() * 2);
      for (let e = 0; e < em; e++) doboz(g, x, y + 0.5 + e * 0.42, z, 0.62, 0.4, 0.62, c);
      const teto = doboz(g, x, y + 0.32 + em * 0.42 + 0.06, z, 0.74, 0.07, 0.74, 0x7a7d80); teto.rotation.z = 0.04;
      doboz(g, x, y + 0.36, z + 0.32, 0.3, 0.04, 0.02, 0x2a2420);   // kijáró
    }
    ctx.statikus(g, 'kozep'); ctx.utk.box(251, 262, -225, -214);
    // méhészkocsi (vándorkaptáros pótkocsi, színes fiókokkal)
    {
      const x = 264, z = -228, y = talaj(x, z), k = new THREE.Group(); k.position.set(x, y, z); k.rotation.y = 0.3;
      doboz(k, 0, 1.6, 0, 2.2, 1.9, 4.6, 0xd9cdb0);
      for (let q = 0; q < 6; q++) for (const s of [-1, 1]) doboz(k, s * 1.11, 1.25 + (q % 2) * 0.6, -1.7 + Math.floor(q / 2) * 1.2 + 0.3, 0.04, 0.42, 0.9, KAPTAR[(q + (s > 0 ? 3 : 0)) % KAPTAR.length]);
      const tt = doboz(k, 0, 2.62, 0, 2.4, 0.12, 4.9, 0x7a5a3a);
      for (const zz of [-1.4, 1.4]) for (const s of [-1, 1]) { const w = henger(k, s * 1.15, 0.38, zz, 0.36, 0.22, 0x222222, 14); w.rotation.z = Math.PI / 2; }
      doboz(k, 0, 0.62, 2.9, 0.12, 0.12, 1.4, 0x3a3a3a);
      ctx.statikus(k, 'kozep'); ctx.utk.obb(x, z, 2.4, 4.8, 0.3);
    }
    for (const [x, z] of [[250, -232], [266, -236], [247, -210]]) { ctx.szoro.add('nature-kit/tree_oak', x, talaj(x, z) - 0.05, z, 4.6, R() * 6, { layer: 'fa' }); ctx.utk.kor(x, z, 0.4); }
    tabla(ctx, 'MÉZ', 258, talaj(258, -209) + 1.3, -209.4, 0, 1.0, 0.45, { hatter: '#f2d27a', szin: '#5a3a12' });
    { const s = new THREE.Group(); s.position.set(258, talaj(258, -209.3), -209.3); henger(s, -0.45, 0.6, 0, 0.04, 1.2, 0x6b4a30, 6); henger(s, 0.45, 0.6, 0, 0.04, 1.2, 0x6b4a30, 6); ctx.statikus(s, 'kozep'); }
    ctx.horgony('mehesz', 258, -210.6, null, { tipus: 'beszallito' });
  }
  ctx.horgony('felveg', 230, -190, null, { tipus: 'regio' });
  return out;
}
