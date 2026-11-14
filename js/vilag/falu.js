// Kisüsti — Kisüstfalva (230, 20): fésűs beépítésű parasztházak a Fő út két oldalán (utcára néző oromfal,
// udvar felőli tornác), kocsma sörkerttel, vegyesbolt, posta, óratorony (vallási jelkép nélkül), piactér
// standokkal és lángosossal, gazdabolt, buszmegálló, nyomós kút, padok, helységnévtáblák.
import * as THREE from 'three';
import { prop } from './betolto.js';
import { recolor, mat, palFantasy, PAL } from './paletta.js';
import { haz, kerites, doboz, henger, tabla, pad, alap, vilagba, T, ponyva } from './epulet.js';
import { talaj } from './terep.js';
import { fruitObj } from './tanya.js';

const FK = n => 'fantasy-town-kit/' + n;
export const STILUSOK = [
  { fal: 'meszel', teto: 'cserep', fa: 'zold' }, { fal: 'kekes', teto: 'barna', fa: 'kek' }, { fal: 'okker', teto: 'cserep', fa: 'barna' },
  { fal: 'sarga', teto: 'moha', fa: 'zold' }, { fal: 'rozsa', teto: 'cserep', fa: 'szurke' }, { fal: 'meszel', teto: 'barna', fa: 'barna' },
  { fal: 'zold', teto: 'cserep', fa: 'barna' }, { fal: 'barack', teto: 'piros', fa: 'zold' },
];
/** Fésűs ház: az oromfal az utca felé néz (n: az úttól a ház felé mutató egységvektor). */
export const fesusRy = (nx, nz) => Math.atan2(-nz, nx);

/** Egy parasztporta: ház (utcára néző oromfallal), utcai kerítés kapuval, előkert fával, pad a kerítés előtt,
 *  hátul fészer és farakás. ux,uz: az utca iránya; nx,nz: az utcától befelé; s: a telek közepe az utca mentén. */
export function porta(ctx, o) {
  const R = ctx.rnd;
  const { px, pz, ux, uz, nx, nz, utcaTav = 4.4, szeles = 20 } = o;
  const st = o.stilus || STILUSOK[Math.floor(R() * STILUSOK.length)];
  const hossz = o.hossz || (3 + Math.floor(R() * 3));           // 3–5 rácselem: 7,8–13 m
  const W = hossz * T, D = 2 * T, kertMely = 3 + R() * 2.5;
  // a ház a telek egyik oldalán, az udvar a másikon (a tornác az udvar felé)
  const oldal = o.oldal ?? (R() < 0.5 ? 1 : -1);
  const along = oldal * (szeles / 2 - D / 2 - 1.2);
  const hx = px + ux * along + nx * (utcaTav + kertMely + W / 2), hz = pz + uz * along + nz * (utcaTav + kertMely + W / 2);
  let ry = fesusRy(nx, nz);
  // a tornácnak az udvar felé kell néznie: a helyi +z világirányát összevetjük az udvar irányával
  const sx = Math.sin(ry), sz = Math.cos(ry);
  const udvarX = -ux * oldal, udvarZ = -uz * oldal;
  const tukor = sx * udvarX + sz * udvarZ < 0;
  if (tukor) ry += Math.PI; // ekkor a helyi x fordul: az oromfal az utca felé a helyi +x lesz
  const ut = tukor ? 'e' : 'w', hat = tukor ? 'w' : 'e';
  const falak = {
    [ut]: ['wall-window-shutters', 'wall-window-shutters'],
    [hat]: [R() < 0.5 ? 'wall' : 'wall-window-small', 'wall'],
    n: [...Array(hossz)].map((_, i) => i % 2 ? 'wall-window-small' : 'wall'),
    s: [...Array(hossz)].map((_, i) => i === 1 ? 'wall-door' : i === hossz - 1 && R() < 0.5 ? 'wall-door' : 'wall-window-shutters'),
  };
  if (tukor) { falak.s = [...falak.s].reverse(); }
  const H = haz(ctx, { x: hx, z: hz, ry, nx: hossz, nz: 2, stilus: st, falak, tornac: R() < 0.65 ? 1.8 : 0, oromfa: R() < 0.4, lab: R() < 0.3 ? 'tegla' : 'szurke', kemenyX: tukor ? -(W / 2 - T * 0.75) : undefined });
  // utcai kerítés kapuval (a kapu az udvar felőli részen)
  const fz = utcaTav, a0 = -szeles / 2, a1 = szeles / 2;
  const p0 = [px + ux * a0 + nx * fz, pz + uz * a0 + nz * fz], p1 = [px + ux * a1 + nx * fz, pz + uz * a1 + nz * fz];
  const tip = o.kerites || ['lec', 'fal', 'deszka', 'lec', 'fal'][Math.floor(R() * 5)];
  const kapuT = oldal > 0 ? 0.18 : 0.62;
  kerites(ctx, [p0, p1], tip, { kapu: [[0, kapuT, kapuT + 0.2]], szin: [0xe8dcc6, 0xd6cbb2, 0xece4d0, 0xc9d3c0][Math.floor(R() * 4)], lec: [0x4f6a48, 0x5a4636, 0x3e5868][Math.floor(R() * 3)] });
  // oldalkerítés (drót vagy léc) a szomszéd felé
  if (o.oldalKerites !== false) for (const a of [a0, a1]) kerites(ctx, [[px + ux * a + nx * fz, pz + uz * a + nz * fz], [px + ux * a + nx * (fz + 26), pz + uz * a + nz * (fz + 26)]], R() < 0.6 ? 'drot' : 'lec');
  // pad a kerítés előtt (a falu társasági élete)
  if (R() < 0.45) { const b = -oldal * szeles * 0.22; pad(ctx, px + ux * b + nx * (fz - 0.9), pz + uz * b + nz * (fz - 0.9), Math.atan2(-nx, -nz) + Math.PI); }
  // előkert: gyümölcsfa vagy orgona, virágok
  { const b = -oldal * szeles * 0.25, x = px + ux * b + nx * (fz + 2.6), z = pz + uz * b + nz * (fz + 2.6);
    ctx.szoro.add('nature-kit/' + (R() < 0.6 ? 'tree_fat' : 'tree_default'), x, talaj(x, z) - 0.05, z, 2.8 + R(), R() * 6, { layer: 'fa' }); ctx.utk.kor(x, z, 0.35);
    for (let k = 0; k < 2; k++) { const fx = x + (R() - 0.5) * 4, fzz = z + (R() - 0.5) * 2; ctx.szoro.addKlaszter(k ? 'virag' : 'bokor', fx, talaj(fx, fzz) - 0.03, fzz, 0.9, R() * 6); }
  }
  // hátul: fészer, farakás
  if (o.feszer !== false) {
    const b = -oldal * (szeles / 2 - 3.2), d = utcaTav + kertMely + W + 4 + R() * 3;
    const x = px + ux * b + nx * d, z = pz + uz * b + nz * d;
    haz(ctx, { x, z, ry: ry + (R() < 0.5 ? 0 : Math.PI / 2), nx: 2, nz: 1, fa: true, kemeny: false, lab: null, ablakFeny: 0, stilus: { fal: 'meszel', teto: R() < 0.5 ? 'barna' : 'hullam' },
      falak: { s: ['wall-wood-door', 'wall-wood'], n: ['wall-wood', 'wall-wood'], w: ['wall-wood'], e: ['wall-wood'] } });
    const lx = x + ux * oldal * 3, lz = z + uz * oldal * 3, g = new THREE.Group(); g.position.set(lx, talaj(lx, lz), lz);
    prop('nature-kit/log_stack', 0, 0, 0, 2.6, ry, g); ctx.statikus(g, 'kozep'); ctx.utk.kor(lx, lz, 1);
  }
  return H;
}

export function epitFalu(ctx) {
  const R = ctx.rnd, out = {};
  const Z = 16.5;
  // ---------------- porták a Fő út mentén
  for (const x of [148, 170, 192, 290, 312, 334]) porta(ctx, { px: x, pz: Z, ux: 1, uz: 0, nx: 0, nz: -1 });
  for (const x of [148, 170, 274, 296, 318, 340]) porta(ctx, { px: x, pz: Z, ux: 1, uz: 0, nx: 0, nz: 1 });
  // a Felvég felé vezető utca eleje
  for (const z of [-14, -36]) {
    porta(ctx, { px: 230, pz: z, ux: 0, uz: -1, nx: -1, nz: 0, utcaTav: 3.8 });
    if (z < -20) porta(ctx, { px: 230, pz: z, ux: 0, uz: -1, nx: 1, nz: 0, utcaTav: 3.8 });
  }

  // ---------------- kocsma: a Rozsdás Kancsó (tornác, sörkert, festett cégtábla)
  {
    const H = haz(ctx, { x: 213, z: 1.2, nx: 4, nz: 2, stilus: { fal: 'okker', teto: 'cserep', fa: 'barna' }, tornac: 2.2, lab: 'tegla', ablakFeny: 0.95,
      falak: { s: ['wall-window-shutters', 'wall-door', 'wall-window-shutters', 'wall-window-shutters'] } });
    tabla(ctx, 'ROZSDÁS KANCSÓ', 213, H.y + 2.95, 1.2 + T + 2.2 + 0.05, 0, 4.6, 0.75, { hatter: '#2f3a2c', szin: '#e8d39a', keret: '#c9a85a', dolt: true });
    const g = new THREE.Group();
    for (const [x, z] of [[207.5, 8.6], [212.5, 9.2], [218, 8.7]]) {
      prop('furniture-kit/tableCloth', x, talaj(x, z), z, 2.4, R() * 0.4, g);
      prop('furniture-kit/bench', x - 0.2, talaj(x, z), z - 1.4, 2.4, R() * 0.2, g);
      prop('furniture-kit/bench', x + 0.2, talaj(x, z), z + 1.4, 2.4, Math.PI + R() * 0.2, g);
      prop('food-kit/wine-red', x + 0.3, talaj(x, z) + 0.8, z, 0.9, 0, g);
      ctx.utk.obb(x, z, 2, 3.4, 0, 0.9);
    }
    prop('survival-kit/barrel', 219.6, talaj(219.6, 5.6), 5.6, 3.6, 0, g); prop('survival-kit/barrel', 220.4, talaj(220.4, 6.6), 6.6, 3.6, 0.5, g);
    ctx.statikus(g, 'kozep'); ctx.utk.kor(220, 6.1, 1.1);
    // sörkert fölött égősor-lámpák (éjjel)
    for (const x of [207.5, 213, 218.5]) ctx.lampa(x, talaj(x, 7) + 2.9, 7.0, 6, 'kocsma');
    out.kocsma = H;
    ctx.arusok.push({ x: 216.5, z: 6.6, ry: 0 });   // a kocsmáros a tornác előtt
    ctx.horgony('kocsma', 213, 6.4, null, { tipus: 'uzlet' });
  }
  // ---------------- buszmegálló (beton fülke, pad, menetrendtábla)
  {
    const x = 222.6, z = 11.4, y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    const beton = 0xb8b2a6;
    doboz(g, 0, 1.2, -0.9, 3.6, 2.4, 0.18, beton); doboz(g, -1.75, 1.2, -0.1, 0.16, 2.4, 1.6, beton); doboz(g, 1.75, 1.2, -0.1, 0.16, 2.4, 1.6, beton);
    const r = doboz(g, 0, 2.5, -0.1, 4.0, 0.14, 2.2, 0x6c4b36); r.rotation.x = 0.1;
    doboz(g, 0, 0.45, -0.55, 3.0, 0.08, 0.5, 0x7b5a3c); for (const sx of [-1.2, 1.2]) doboz(g, sx, 0.22, -0.55, 0.1, 0.45, 0.4, 0x5a5a5a);
    henger(g, 2.6, 1.3, 0.4, 0.04, 2.6, 0x7a7d80, 8);
    doboz(g, 2.6, 2.55, 0.4, 0.55, 0.42, 0.04, 0x2f6f3a);
    ctx.statikus(g, 'kozep'); ctx.utk.obb(x, z - 0.6, 3.8, 0.6, 0); ctx.utk.obb(x - 1.75, z - 0.1, 0.3, 1.6, 0); ctx.utk.obb(x + 1.75, z - 0.1, 0.3, 1.6, 0);
    // a hátfal két oldalán csempemozaik (a hatvanas-hetvenes évek buszvárói): napraforgó-motívum, felirat nélkül
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const c = cv.getContext('2d');
    const T2 = 8; for (let yy = 0; yy < 160; yy += T2) for (let xx = 0; xx < 256; xx += T2) { const cx = xx - 128, cy = yy - 70, r = Math.hypot(cx, cy);
      let col = r < 22 ? '#6a4a22' : r < 46 && Math.abs(Math.sin(Math.atan2(cy, cx) * 7)) > 0.35 ? '#e8b82a' : yy > 120 ? '#3f7a3a' : '#7fb0c8';
      if (yy > 96 && Math.abs(cx + 6 * Math.sin(yy / 12)) < 5) col = '#3f7a3a';
      c.fillStyle = col; c.fillRect(xx + 0.5, yy + 0.5, T2 - 1, T2 - 1); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(xx + 1, yy + 1, 3, 2); }
    const mt = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv) }); mt.map.colorSpace = THREE.SRGBColorSpace;
    for (const sz of [-0.8, -1.0]) { const lap = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.05), mt); lap.position.set(x, y + 1.25, z + sz + (sz > -0.9 ? 0.0 : 0)); lap.rotation.y = sz > -0.9 ? 0 : Math.PI; lap.position.z = z - 0.9 + (sz > -0.9 ? 0.1 : -0.1); ctx.dinamikus(lap); }
    tabla(ctx, 'BUSZ', x + 2.6, y + 2.56, z + 0.43, 0, 0.5, 0.36, { hatter: '#2f6f3a', szin: '#f2f2e8', keret: '#2f6f3a' });
    ctx.horgony('buszmegallo', x, z + 1.2, null, { tipus: 'pont' });
  }
  // ---------------- vegyesbolt és posta az utca északi oldalán
  {
    const B = haz(ctx, { x: 244, z: 4.6, nx: 3, nz: 2, stilus: { fal: 'barack', teto: 'barna', fa: 'barna' }, lab: 'sotet', ablak: 'wall-window-glass', ablakFeny: 1,
      falak: { s: ['wall-window-glass', 'wall-door', 'wall-window-glass'] } });
    tabla(ctx, 'VEGYESBOLT', 244, B.y + 2.25, 4.6 + T + 0.06, 0, 4.2, 0.6, { hatter: '#f1e6c8', szin: '#7a2c1c' });
    const g = new THREE.Group(); const y = talaj(244, 9);
    ponyva(g, 244, B.y + 2.05, 4.6 + T + 0.1, 7.4, 1.5, 0.38, ['#2f6a3a', '#efe6d2']);
    prop('survival-kit/box', 240.6, y, 8.4, 2.6, 0.2, g); prop('survival-kit/box', 241.3, y, 8.6, 2.6, -0.1, g); prop('survival-kit/box', 240.9, y + 0.65, 8.5, 2.4, 0.4, g);
    ctx.statikus(g, 'kozep');
    pad(ctx, 248.6, 8.4, Math.PI);
    const P = haz(ctx, { x: 268, z: 4.6, nx: 3, nz: 2, stilus: { fal: 'sarga', teto: 'cserep', fa: 'zold' }, lab: 'szurke', ablakFeny: 0.8,
      falak: { s: ['wall-window-shutters', 'wall-door', 'wall-window-shutters'] } });
    tabla(ctx, 'POSTA', 268, P.y + 2.3, 4.6 + T + 0.06, 0, 2.4, 0.55, { hatter: '#f4efe0', szin: '#3a3226' });
    { const g2 = new THREE.Group(), y2 = talaj(272.6, 9.2); g2.position.set(272.6, y2, 9.2);
      henger(g2, 0, 0.6, 0, 0.05, 1.2, 0x50545a, 8); doboz(g2, 0, 1.45, 0, 0.5, 0.62, 0.36, 0xb8322a); doboz(g2, 0, 1.78, 0, 0.54, 0.06, 0.4, 0x8e231d);
      ctx.statikus(g2, 'kozep'); ctx.utk.kor(272.6, 9.2, 0.3); }
    ctx.horgony('vegyesbolt_falu', 244, 9.0, null, { tipus: 'pont' }); ctx.horgony('posta', 268, 9.0, null, { tipus: 'pont' });
  }
  // ---------------- óratorony a kis téren (vallási jelkép nélkül: óra, zsalus harangablak, csúcssisak gömbbel)
  {
    const x = 254, z = -10, y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    const fal = 0xece3cf, parkany = 0xb9ad94;
    doboz(g, 0, 0.5, 0, 5.2, 1.2, 5.2, 0x8c877d);
    doboz(g, 0, 6.2, 0, 4.6, 11.2, 4.6, fal);
    for (const h of [4.2, 10.6, 15.1]) doboz(g, 0, h, 0, 4.95, 0.3, 4.95, parkany);
    doboz(g, 0, 13.0, 0, 4.2, 4.2, 4.2, fal);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, ox = Math.sin(a), oz = Math.cos(a);
      // zsalus nyílás és óralap
      const z1 = doboz(g, ox * 2.12, 13.2, oz * 2.12, 1.2, 2.2, 0.1, 0x3b3128, a);
      for (let q = 0; q < 6; q++) doboz(g, ox * 2.16, 12.3 + q * 0.34, oz * 2.16, 1.16, 0.06, 0.08, 0x6b4a30, a).rotation.x = 0.4;
      doboz(g, ox * 2.33, 2.0, oz * 2.33, 0.9, 1.4, 0.06, 0x3b3128, a);       // keskeny ablak a toronytestben
      doboz(g, ox * 2.33, 7.0, oz * 2.33, 0.6, 1.1, 0.06, 0x3b3128, a);
    }
    const sisak = prop(FK('roof-point'), 0, 15.25, 0, [4.9 / 1.1 * 1.05, 6.4 / 0.5, 4.9 / 1.1 * 1.05], Math.PI / 4, g);
    recolor(sisak, { nev: 'sisak', rules: [[(r, gg, b) => gg > r + 50 && gg > b + 8, [72, 112, 96], [86, 180, 156]], [(r, gg, b) => b > r + 15 && b > gg + 10 && r > 110, [70, 64, 58], [160, 168, 201]]] });
    henger(g, 0, 21.9, 0, 0.05, 1.6, 0x8a7a4a, 8); const gomb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(0xc9a24a, { roughness: 0.35, metalness: 0.7 })); gomb.position.set(0, 21.9, 0); g.add(gomb);
    ctx.statikus(g, 'epulet'); ctx.utk.obb(x, z, 5.4, 5.4, 0);
    // óralapok (külön anyag: a mutató állása a napszakot követheti)
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    const rajz = (ora) => {
      c.clearRect(0, 0, 256, 256); c.fillStyle = '#f3efe2'; c.beginPath(); c.arc(128, 128, 120, 0, 7); c.fill();
      c.lineWidth = 10; c.strokeStyle = '#2a2622'; c.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.lineWidth = i % 3 ? 4 : 9; c.beginPath(); c.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); c.lineTo(128 + Math.sin(a) * 112, 128 - Math.cos(a) * 112); c.stroke(); }
      const ha = (ora % 12) / 12 * Math.PI * 2, ma = (ora % 1) * Math.PI * 2;
      c.lineCap = 'round'; c.lineWidth = 11; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(ha) * 58, 128 - Math.cos(ha) * 58); c.stroke();
      c.lineWidth = 7; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(ma) * 90, 128 - Math.cos(ma) * 90); c.stroke();
    };
    rajz(10.2);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const om = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6 });
    const og = new THREE.CircleGeometry(0.85, 28);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, me = new THREE.Mesh(og, om); me.position.set(x + Math.sin(a) * 2.32, y + 9.0, z + Math.cos(a) * 2.32); me.rotation.y = a; ctx.dinamikus(me);
    }
    let utolso = -1;
    ctx.frissitok.push((dt, ora) => { if (ora == null) return; const p = Math.floor(ora * 12); if (p !== utolso) { utolso = p; rajz(ora); tex.needsUpdate = true; } });
    // a tér: padok, hársfák, virágágyás
    for (const [bx, bz, r] of [[247, -2.5, 0], [261, -2.5, 0], [246, -16, Math.PI], [262, -16, Math.PI]]) pad(ctx, bx, bz, r);
    for (const [tx, tz] of [[244.5, -6], [263.5, -6], [244.5, -14.5], [263.5, -14.5]]) { ctx.szoro.add('nature-kit/tree_default', tx, talaj(tx, tz) - 0.05, tz, 4.6, R() * 6, { layer: 'fa' }); ctx.utk.kor(tx, tz, 0.4); }
    ctx.horgony('torony', x, z + 3.5, null, { tipus: 'pont' });
  }
  // ---------------- piactér: kofa, lángosos, standok, napernyők, nyomós kút, padok
  {
    const y0 = talaj(240, 36);
    // a standok két sorban, mind észak felé (az út felől jönnek a vevők); mögöttük áll az árus
    const tps = ['szilva', 'barack', 'korte'];
    const stand = (x, z, key, aru, dinamikus = false) => {
      const g = new THREE.Group(); g.position.set(x, talaj(x, z), z);
      prop(FK(key), 0, 0, 0, key === 'cart' ? 2.3 : 2.6, Math.PI, g);
      const top = key === 'cart' ? 1.08 : 0.98;
      aru(g, top);
      if (dinamikus) ctx.dinamikus(g); else ctx.statikus(g, 'kozep');
      ctx.utk.box(x - 1.6, x + 1.6, z - 1.25, z + 1.25);
      if (key !== 'cart') ctx.arusok.push({ x, z: z + 1.25, ry: Math.PI });
      return g;
    };
    const lada = (g, x, y, z, fn) => { prop('survival-kit/box', x, y, z, 2.2, ctx.rnd() * 0.3, g); fn(x, y + 0.42, z); };
    const gyumolcsok = (g, top, sorok = 2) => { for (let k = 0; k < 10; k++) fruitObj(ctx, tps[k % 3], -1.0 + (k % 5) * 0.48, top, -0.42 + Math.floor(k / 5) * 0.32, 1.25, g); };
    const termes = (g, key, x, y, z, s = 2.2) => prop('nature-kit/' + key, x, y, z, s, ctx.rnd() * 6, g, false);
    // Erzsi néni, a kofa: gyümölcs a pulton és ládákban (célozható csoport: a sim beszállítója)
    const kofa = stand(238, 30.8, 'stall-red', (g, top) => {
      gyumolcsok(g, top);
      for (const [bx, bz] of [[-1.7, -0.9], [1.7, -0.9]]) lada(g, bx, 0, bz, (x, y, z) => { for (let k = 0; k < 4; k++) fruitObj(ctx, tps[(k + (bx > 0 ? 1 : 0)) % 3], x - 0.3 + (k % 2) * 0.3, y, z - 0.12 + Math.floor(k / 2) * 0.24, 1.15, g); });
    });
    ctx.horgony('kofa', 238, 28.6, null, { tipus: 'beszallito' });
    // zöldséges: tök, dinnye, sárgarépa, karalábé
    stand(227, 30.8, 'stall-green', (g, top) => {
      for (let k = 0; k < 4; k++) termes(g, ['crop_carrot', 'crop_turnip'][k % 2], -0.9 + k * 0.6, top - 0.05, -0.2, 2.0);
      lada(g, -1.8, 0, -1.0, (x, y, z) => { for (let k = 0; k < 2; k++) termes(g, 'crop_pumpkin', x - 0.2 + k * 0.4, y - 0.1, z, 1.8); });
      for (let k = 0; k < 3; k++) termes(g, 'crop_melon', 1.4 + (k % 2) * 0.5, 0, -1.2 + k * 0.35, 2.4);
    });
    // virágos: cserepes virágok
    stand(232.5, 30.8, 'stall-red', (g, top) => {
      for (let k = 0; k < 5; k++) { termes(g, 'pot_large', -1.0 + k * 0.5, top, -0.25, 1.6); termes(g, ['flower_redA', 'flower_yellowA', 'flower_purpleA'][k % 3], -1.0 + k * 0.5, top + 0.35, -0.25, 1.6); }
      for (let k = 0; k < 4; k++) { termes(g, 'pot_large', -1.3 + k * 0.85, 0, -1.25, 2.0); termes(g, ['flower_purpleA', 'flower_redA'][k % 2], -1.3 + k * 0.85, 0.45, -1.25, 2.2); }
    });
    // házi bor és méz
    stand(243.5, 30.8, 'stall-green', (g, top) => {
      for (let k = 0; k < 6; k++) prop(k % 2 ? 'food-kit/wine-red' : 'food-kit/bottle-oil', -1.0 + k * 0.4, top, -0.25 + (k % 2) * 0.12, 1.0, 0, g);
      prop('survival-kit/barrel', 1.8, 0, -0.6, 3.2, 0, g);
    });
    // déli sor: paprika és paradicsom, tojás és sajt (ládák), szekér dinnyével
    stand(229, 42.6, 'stall-green', (g, top) => { for (let k = 0; k < 3; k++) lada(g, -1.0 + k * 1.0, top - 0.05, -0.1, (x, y, z) => { for (let q = 0; q < 3; q++) fruitObj(ctx, k === 1 ? 'barack' : 'szilva', x - 0.2 + q * 0.2, y, z, 1.0, g); }); });
    stand(234.5, 42.6, 'cart', (g, top) => { for (let k = 0; k < 7; k++) termes(g, 'crop_melon', -0.8 + (k % 4) * 0.5, top - 0.1, -0.3 + Math.floor(k / 4) * 0.45, 2.2); });
    stand(240.5, 42.6, 'stall-red', (g, top) => {
      for (let k = 0; k < 8; k++) termes(g, k % 2 ? 'crop_carrot' : 'crops_leafsStageA', -1.1 + k * 0.32, top - 0.05, -0.2, 1.8);
      lada(g, 1.8, 0, -1.0, (x, y, z) => termes(g, 'crop_pumpkin', x, y - 0.1, z, 2.2));
    });
    // lángosos bódé: deszkafal, kiszolgálóablak, ponyva, magas asztalok
    {
      const x = 251, z = 41, g = new THREE.Group(); g.position.set(x, talaj(x, z), z);
      haz(ctx, { x, z, ry: Math.PI, nx: 2, nz: 2, fa: true, stilus: { fal: 'meszel', teto: 'piros', fa: 'vilagos' }, kemeny: true, lab: 'sotet', ablakFeny: 1, utk: false,
        falak: { s: ['wall-wood-window-glass', 'wall-wood-window-glass'], n: ['wall-wood', 'wall-wood-door'], w: ['wall-wood', 'wall-wood'], e: ['wall-wood', 'wall-wood'] } });
      ponyva(g, 0, 2.15, -2.66, 5.0, 1.4, 0.4, ['#c8402a', '#f2e2b0'], Math.PI);
      ctx.statikus(g, 'epulet'); ctx.utk.obb(x, z, 5.4, 5.4, 0);
      tabla(ctx, 'LÁNGOS', x, talaj(x, z) + 2.95, z - 2.66, Math.PI, 2.6, 0.6, { hatter: '#f7d24a', szin: '#7a2a12', keret: '#7a2a12' });
      ctx.arusok.push({ x, z: z - 1.0, ry: Math.PI });
      const t2 = new THREE.Group();
      for (const [tx, tz] of [[247.6, 35.4], [252.8, 35.0]]) { henger(t2, tx, talaj(tx, tz) + 0.55, tz, 0.06, 1.1, 0x5a5d60, 8); henger(t2, tx, talaj(tx, tz) + 1.12, tz, 0.45, 0.05, 0x8a6a4a, 16); ctx.utk.kor(tx, tz, 0.45, 1.1); }
      for (const [tx, tz] of [[247.6, 35.4], [252.8, 35.0]]) prop('city-kit-commercial/detail-parasol-a', tx, talaj(tx, tz), tz, 7, ctx.rnd() * 6, t2);
      ctx.statikus(t2, 'kozep');
      ctx.horgony('langos', 251, 36.8, null, { tipus: 'uzlet' });
    }
    // nyomós kút (zöld öntöttvas)
    { const x = 229.5, z = 36, k = new THREE.Group(); k.position.set(x, talaj(x, z), z);
      doboz(k, 0, 0.08, 0, 1.6, 0.16, 1.6, 0x8c877d); henger(k, 0, 0.75, 0, 0.16, 1.3, 0x2f5a3a, 12); henger(k, 0, 1.45, 0, 0.2, 0.14, 0x2f5a3a, 12);
      const kar = doboz(k, 0.35, 1.32, 0, 0.9, 0.07, 0.07, 0x2f5a3a); kar.rotation.z = -0.35;
      const cs = henger(k, 0, 0.95, 0.28, 0.05, 0.4, 0x2f5a3a, 8); cs.rotation.x = Math.PI / 2;
      doboz(k, 0, 0.22, 0.55, 0.7, 0.12, 0.5, 0x6e6a62);
      ctx.statikus(k, 'kozep'); ctx.utk.kor(x, z, 0.5); ctx.horgony('kozkut', x, z + 1.2, null, { tipus: 'pont' }); }
    for (const [bx, bz, r] of [[236, 46, 0], [244, 46, 0], [256, 32, -Math.PI / 2]]) pad(ctx, bx, bz, r);
    for (const [tx, tz] of [[224.5, 26.5], [255.5, 26.5], [224.5, 46], [256, 46.5]]) { ctx.szoro.add('nature-kit/tree_oak', tx, talaj(tx, tz) - 0.05, tz, 4.4, ctx.rnd() * 6, { layer: 'fa' }); ctx.utk.kor(tx, tz, 0.4); }
    // térvilágítás
    for (const [x, z] of [[232, 26.2], [248, 26.2], [240, 46.6]]) lampaOszlop(ctx, x, z);
  }
  // ---------------- kultúrház a piactér déli oldalán (tornácos, emeletes középrész nélkül; festett tábla)
  {
    const H = haz(ctx, { x: 240, z: 57, ry: Math.PI, nx: 6, nz: 3, stilus: { fal: 'sarga', teto: 'cserep', fa: 'barna' }, tornac: 2.2, lab: 'tegla', ablakFeny: 0.7,
      falak: { s: ['wall-window-shutters', 'wall-window-shutters', 'wall-doorway-round', 'wall-doorway-round', 'wall-window-shutters', 'wall-window-shutters'] } });
    tabla(ctx, 'KULTÚRHÁZ', 240, H.y + 2.95, 57 - 3 * T / 2 - 2.2 - 0.06, Math.PI, 4.4, 0.66, { hatter: '#f2ead2', szin: '#5a2a1a' });
    for (const tx of [224, 256]) { ctx.szoro.add('nature-kit/tree_oak', tx, talaj(tx, 52) - 0.05, 52, 5, ctx.rnd() * 6, { layer: 'fa' }); ctx.utk.kor(tx, 52, 0.45); }
    for (const bx of [231, 249]) pad(ctx, bx, 49.4, Math.PI);
    ctx.horgony('kulturhaz', 240, 50.6, null, { tipus: 'pont' });
  }
  // ---------------- gazdabolt: hullámlemez tető, zsákok, raklap, szerszámok
  {
    const H = haz(ctx, { x: 204, z: 38.4, ry: Math.PI, nx: 4, nz: 2, stilus: { fal: 'kopott', teto: 'hullam', fa: 'zold' }, lab: 'sotet', ablakFeny: 0.4,
      falak: { s: ['wall-window-glass', 'wall-door', 'wall-window-glass', 'wall'] } });
    tabla(ctx, 'GAZDABOLT', 204, H.y + 2.3, 38.4 - T - 0.06, Math.PI, 4.0, 0.62, { hatter: '#e7e2cf', szin: '#2f5a2a', keret: '#2f5a2a' });
    const g = new THREE.Group(), y = talaj(200, 33.4);
    prop(FK('planks'), 198.6, y, 33.6, [2.6, 2, 2.2], 0, g);
    for (let k = 0; k < 5; k++) { const s = doboz(g, 197.9 + (k % 3) * 0.7, y + 0.28 + Math.floor(k / 3) * 0.42, 33.5 + (k % 2) * 0.12, 0.62, 0.42, 0.9, 0xd9ccaa); s.rotation.y = (ctx.rnd() - 0.5) * 0.3; }
    prop('survival-kit/tool-shovel', 208.2, y, 34.4, 2.6, 0.3, g).rotation.z = 0.25;
    prop('survival-kit/bucket', 207.4, y, 33.5, 3, 0, g); prop('survival-kit/barrel', 209.3, y, 33.8, 3.4, 0, g);
    prop(FK('cart-high'), 213.5, talaj(213.5, 34), 33.8, 2.2, Math.PI / 2, g);
    ctx.statikus(g, 'kozep'); ctx.utk.box(197.4, 200.2, 32.8, 34.6); ctx.utk.box(212, 215, 32.6, 35);
    ctx.horgony('gazdabolt', 204, 33.0, null, { tipus: 'beszallito' });
  }
  // ---------------- helységnévtáblák a falu két végén
  for (const [x, s] of [[136, 1], [358, -1]]) {
    const z = Z - s * 0 + 4.6 * (s > 0 ? 1 : -1), y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    henger(g, 0, 1.0, 0, 0.04, 2.0, 0x7a7d80, 8); ctx.statikus(g, 'kozep');
    tabla(ctx, 'Kisüstfalva', x, y + 2.05, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, 2.2, 0.55, { hatter: '#f4f4ee', szin: '#1c1c1c', keret: '#1c1c1c' });
  }
  ctx.horgony('falu', 230, 22, null, { tipus: 'regio' });
  return out;
}

/** Kandeláber a tereken (öntöttvas oszlop, búra). */
export function lampaOszlop(ctx, x, z, h = 4.2) {
  const y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z);
  henger(g, 0, 0.25, 0, 0.16, 0.5, 0x2c3236, 10); henger(g, 0, h / 2, 0, 0.07, h, 0x2c3236, 8);
  henger(g, 0, h + 0.05, 0, 0.26, 0.1, 0x2c3236, 10); henger(g, 0, h + 0.3, 0, 0.2, 0.42, 0xf3e4c0, 10, 0.24);
  const k = henger(g, 0, h + 0.58, 0, 0.3, 0.16, 0x2c3236, 10, 0.05);
  ctx.statikus(g, 'kozep'); ctx.utk.kor(x, z, 0.2);
  ctx.lampa(x, y + h + 0.4, z, 9, 'ter');
}
