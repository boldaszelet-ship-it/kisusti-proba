// Kisüsti — Kisváros (530, 270): főtér szökőkúttal, a Hivatal (oszlopos, timpanonos épület, felirat és embléma
// nélkül), nagypiac fedett csarnoka, fűszeres stand, kétszintes polgári házak, három-öt szintes városi házak,
// panelházak, vasútállomás peronnal és álló motorvonattal, gumis és autómosó, kisvárosi pince.
import * as THREE from 'three';
import { prop } from './betolto.js';
import { recolor, isRed, isTeal, isBlue, isWhite, isLavender, mat, palCity, FAL, rgb } from './paletta.js';
import { haz, cityHaz, kerites, doboz, henger, tabla, pad, T, vilagba, alap } from './epulet.js';
import { talaj, PLATFORMOK, utTav } from './terep.js';
import { VASUT } from './adat.js';
import { lampaOszlop } from './falu.js';

const POLGARI = [{ fal: 'okker', teto: 'cserep', fa: 'barna' }, { fal: 'sarga', teto: 'pala', fa: 'zold' }, { fal: 'rozsa', teto: 'cserep', fa: 'szurke' }, { fal: 'barack', teto: 'barna', fa: 'barna' }, { fal: 'kekes', teto: 'pala', fa: 'kek' }, { fal: 'zold', teto: 'cserep', fa: 'barna' }];
const BELVAROS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** Kétszintes polgári ház a fantasy-kit elemeiből (földszint: üzletportál / kapu, emelet: üvegezett ablakok). */
function polgari(ctx, x, z, ry, nx, st) {
  const R = ctx.rnd;
  return haz(ctx, { x, z, ry, nx, nz: 2, emelet: 2, stilus: st, lab: 'sotet', ablak: 'wall-window-glass', ablak2: R() < 0.5 ? 'wall-window-round' : 'wall-window-glass', ablakFeny: 0.6,
    falak: { s: [...Array(nx)].map((_, i) => i === Math.floor(nx / 2) ? 'wall-doorway-round' : 'wall-window-glass'), n: [...Array(nx)].map((_, i) => i % 2 ? 'wall-window-small' : 'wall'), w: ['wall', 'wall'], e: ['wall', 'wall'] },
    falak2: { n: [...Array(nx)].map(() => 'wall-window-glass'), w: ['wall', 'wall'], e: ['wall', 'wall'] } });
}
/** Belvárosi ház (City Kit Commercial) palettacserével. */
function varosiHaz(ctx, x, z, ry, key, st, s = 9.5) { return cityHaz(ctx, 'city-kit-commercial/building-' + key, x, z, ry, s, st); }
/** Kandeláber helyett modern utcai lámpa (City Kit Roads), a kar az út felé. */
function utcaiLampa(ctx, x, z, ry) {
  const y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  prop('city-kit-roads/light-curved', 0, 0, 0, [6, 11, 11], 0, g);
  ctx.statikus(g, 'kozep'); ctx.utk.kor(x, z, 0.2);
  const [lx, lz] = vilagba(x, z, ry, 0, -0.19 * 11);
  ctx.lampa(lx, y + 0.62 * 11, lz, 12, 'varos');
}

export function epitKisvaros(ctx) {
  const R = ctx.rnd, out = {};
  // ---------------- főtér: szökőkút, padok, hársfák, kandeláberek
  {
    const x = 545, z = 274, g = new THREE.Group(); g.position.set(x, talaj(x, z), z);
    // a Kenney-kút lilás vakolata kőszínre (mészkő)
    const KO_PAL = { nev: 'kokut', rules: [[isLavender, [186, 178, 162], [160, 168, 201]], [isWhite, [204, 198, 184], [222, 222, 234]]] };
    recolor(prop('fantasy-town-kit/fountain-round', 0, 0, 0, 4.2, 0, g), KO_PAL);
    recolor(prop('fantasy-town-kit/fountain-center', 0, 0, 0, 4.2, 0, g), KO_PAL);
    // a medence közepén kőoszlop felső tállal; a tálból vízsugár hull vissza (a Grafika részecskéi)
    const ko = 0xb9b2a4, ko2 = 0x9c958a;
    henger(g, 0, 0.55, 0, 0.75, 1.1, ko2, 16);
    henger(g, 0, 1.55, 0, 0.32, 1.3, ko, 12, 0.24);
    henger(g, 0, 2.28, 0, 1.15, 0.22, ko, 20, 0.55);
    henger(g, 0, 2.42, 0, 1.05, 0.08, mat(0x5d7f84, { roughness: 0.2 }), 20);
    henger(g, 0, 2.62, 0, 0.12, 0.45, ko, 10, 0.07);
    ctx.szokokutak.push({ x, y: g.position.y + 2.85, z, meret: 1 });
    ctx.statikus(g, 'kozep'); ctx.utk.kor(x, z, 4.1);
    // ---- a tér berendezése (a bírálat: „a főtér üres”): emlékmű, virágdézsák, pavilon, szemetesek, kerékpártartó
    const szabad = (px, pz, r = 1.5) => utTav(px, pz) > r && !ctx.utk.inside(px, pz, r * 0.5);
    {
      // hősi emlékmű: lépcsős talapzat, gránit obeliszk, koszorú
      const ex = 518, ez = 274, e = new THREE.Group(); e.position.set(ex, talaj(ex, ez), ez);
      doboz(e, 0, 0.15, 0, 4.2, 0.3, 4.2, 0x8f8a80); doboz(e, 0, 0.42, 0, 3.2, 0.26, 3.2, 0x9e988c); doboz(e, 0, 1.15, 0, 1.6, 1.2, 1.6, 0x7d786f);
      doboz(e, 0, 1.82, 0, 1.8, 0.14, 1.8, 0x8f8a80);
      henger(e, 0, 3.6, 0, 0.62, 3.4, 0x6f6b66, 4, 0.3).rotation.y = Math.PI / 4;
      henger(e, 0, 5.5, 0, 0.3, 0.4, 0x6f6b66, 4, 0.02).rotation.y = Math.PI / 4;
      doboz(e, 0.81, 1.2, 0, 0.04, 0.5, 0.9, 0x5a5048);   // emléktábla (felirat nélkül)
      const k = henger(e, 0.86, 0.75, 0, 0.32, 0.1, 0x3f6a34, 14); k.rotation.z = Math.PI / 2;    // koszorú
      henger(e, 0.9, 0.75, 0.12, 0.06, 0.3, 0xb8322a, 6).rotation.z = 0.4;                     // szalag
      ctx.statikus(e, 'kozep'); ctx.utk.obb(ex, ez, 4.2, 4.2, 0, 1.2);
      for (const [dx, dz] of [[-2.9, -2.9], [-2.9, 2.9], [2.9, -2.9], [2.9, 2.9]]) ctx.utk.obb(ex + dx, ez + dz, 1.5, 1.5, 0, 0.3);
      // négy kőszegélyes virágágy a talapzat sarkainál (földdel, sűrű virággal)
      for (const [dx, dz] of [[-2.9, -2.9], [-2.9, 2.9], [2.9, -2.9], [2.9, 2.9]]) {
        doboz(e, dx, 0.14, dz, 1.5, 0.28, 1.5, 0x9e988c); doboz(e, dx, 0.27, dz, 1.3, 0.04, 1.3, 0x4a3626);
        for (const [qx, qz] of [[-0.3, -0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, 0.3]]) ctx.szoro.addKlaszter('virag', ex + dx + qx, talaj(ex + dx, ez + dz) + 0.28, ez + dz + qz, 0.5, R() * 6);
      }
    }
    // virágdézsák a szökőkút körül (terrakotta, muskátli)
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.26, px = x + Math.cos(a) * 6.4, pz = z + Math.sin(a) * 6.4;
      if (!szabad(px, pz)) continue;
      const d = new THREE.Group(); d.position.set(px, talaj(px, pz), pz);
      henger(d, 0, 0.3, 0, 0.42, 0.6, 0xa65a3a, 12, 0.5); henger(d, 0, 0.62, 0, 0.47, 0.06, 0x8c4a30, 12);
      henger(d, 0, 0.66, 0, 0.4, 0.04, 0x4a3626, 12);
      ctx.statikus(d, 'kozep'); ctx.utk.kor(px, pz, 0.5, 0.7);
      ctx.szoro.addKlaszter(i % 2 ? 'virag' : 'fu2', px, talaj(px, pz) + 0.62, pz, 0.42, R() * 6);
    }
    // újságos pavilon: hatszögű, zöld, kúpos tető
    {
      const px = 553, pz = 289.5;
      if (szabad(px, pz, 2)) {
        const p = new THREE.Group(); p.position.set(px, talaj(px, pz), pz);
        henger(p, 0, 0.2, 0, 1.35, 0.4, 0x6f6a62, 6); henger(p, 0, 1.3, 0, 1.2, 1.8, 0x3e6a4c, 6);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; doboz(p, Math.cos(a) * 1.08, 1.45, Math.sin(a) * 1.08, 0.9, 0.7, 0.05, 0xd8d0b8, -a + Math.PI / 2); }
        henger(p, 0, 2.35, 0, 1.55, 0.3, 0x2f4f3a, 6); henger(p, 0, 2.95, 0, 1.45, 0.9, 0x2f4f3a, 6, 0.08); henger(p, 0, 3.5, 0, 0.08, 0.3, 0xb89a4a, 8);
        ctx.statikus(p, 'kozep'); ctx.utk.kor(px, pz, 1.4);
      }
    }
    // szemetesek és kerékpártartó
    for (const [px, pz] of [[538.5, 263.5], [551.5, 284.5], [523, 280], [540, 291]]) {
      if (!szabad(px, pz, 1)) continue;
      const s = new THREE.Group(); s.position.set(px, talaj(px, pz), pz);
      henger(s, 0, 0.5, 0, 0.04, 1.0, 0x2b3530, 6); henger(s, 0, 0.72, 0.18, 0.2, 0.5, 0x2f4a3a, 10); henger(s, 0, 0.98, 0.18, 0.21, 0.04, 0x22302a, 10);
      ctx.statikus(s, 'kozep'); ctx.utk.kor(px, pz + 0.1, 0.25, 1);
    }
    {
      const px = 527, pz = 266;
      if (szabad(px, pz, 1.5)) {
        const k = new THREE.Group(); k.position.set(px, talaj(px, pz), pz);
        for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 6, 16, Math.PI), mat(0x8a8f92, { metalness: 0.6, roughness: 0.4 })); t.position.set(-1 + i * 0.5, 0.05, 0); t.rotation.y = Math.PI / 2; t.castShadow = true; k.add(t); }
        doboz(k, 0, 0.02, 0, 2.4, 0.04, 0.12, 0x6f6a62);
        ctx.statikus(k, 'kozep'); ctx.utk.obb(px, pz, 2.4, 0.3, 0, 0.5);
      }
    }
    for (const [bx, bz, r] of [[536, 266, Math.PI / 2], [536, 282, Math.PI / 2], [554, 266, -Math.PI / 2], [554, 282, -Math.PI / 2], [545, 289, Math.PI]]) pad(ctx, bx, bz, r);
    for (const [tx, tz] of [[506, 256], [506, 288], [558, 256], [528, 290], [512, 272]]) { ctx.szoro.add('nature-kit/tree_default', tx, talaj(tx, tz) - 0.05, tz, 5, R() * 6, { layer: 'fa' }); ctx.utk.kor(tx, tz, 0.45); }
    for (const [lx, lz] of [[530, 258], [560, 258], [530, 290], [560, 291], [502, 272]]) lampaOszlop(ctx, lx, lz, 4.4);
    // ---- a tér élete (a bírálat: „a főtér kopár”): cukrászda-terasz napernyőkkel az északi házsor előtt, előtetős
    // kirakatok, plakátoszlop, fával ültetett virágládák a parkoló autók és a tér között, a Hivatal bejáratát két
    // kandeláber keretezi (este ez a tér legvilágosabb pontja). A járókelők tengelyei (a bevezető út — a kút — a
    // Hivatal, az Állomás utca, a nyugati és a keleti utca) szabadon maradnak.
    terTartozekok(ctx);
    ctx.horgony('foter', 540, 270, null, { tipus: 'pont' });
  }
  // ---------------- a Hivatal: a tér keleti oldalán, emeletes, oszlopos-timpanonos középrizalit, felirat és embléma nélkül
  {
    const x = 570, z = 278, ry = -Math.PI / 2, nx = 6, nz = 3;
    const H = haz(ctx, { x, z, ry, nx, nz, emelet: 2, stilus: { fal: 'sarga', teto: 'pala', fa: 'barna' }, lab: 'ko', ablak: 'wall-window-glass', ablak2: 'wall-window-glass', ablakFeny: 0.35, kemeny: false,
      falak: { s: ['wall-window-glass', 'wall-window-glass', 'wall-doorway-round', 'wall-doorway-round', 'wall-window-glass', 'wall-window-glass'] } });
    const g = new THREE.Group(); g.position.set(x, H.y, z); g.rotation.y = ry;
    const D = nz * T, zc = D / 2 + 1.7, fal = rgb(FAL.sarga), feher = 0xefe8d8;
    for (const px of [-3.1, -1.05, 1.05, 3.1]) {
      prop('fantasy-town-kit/pillar-stone', px, 0.45, zc, [3.4, 2 * T - 0.45, 3.4], 0, g).traverse(m => { if (m.isMesh) m.material = mat(feher, { roughness: 0.7 }); });
      doboz(g, px, 0.38, zc, 0.7, 0.14, 0.7, feher);
    }
    doboz(g, 0, 2 * T + 0.22, D / 2 + 1.1, 7.6, 0.44, 2.6, feher);
    const sh = new THREE.Shape([new THREE.Vector2(-3.9, 0), new THREE.Vector2(3.9, 0), new THREE.Vector2(0, 1.7)]);
    const tri = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }), mat(fal)); tri.position.set(0, 2 * T + 0.44, D / 2 - 0.1); tri.castShadow = tri.receiveShadow = true; g.add(tri);
    const tri2 = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-4.2, 0), new THREE.Vector2(4.2, 0), new THREE.Vector2(0, 1.86)]), { depth: 0.2, bevelEnabled: false }), mat(feher)); tri2.position.set(0, 2 * T + 0.4, D / 2 + 2.3); g.add(tri2);
    for (let q = 0; q < 4; q++) doboz(g, 0, 0.1 + q * 0.12, D / 2 + 3.0 + q * -0.35 + 0.6, 8.2 - q * 0.3, 0.24, 1.0, 0xc8c0b0);
    doboz(g, 0, T + 0.05, 0, nx * T + 0.4, 0.3, D + 0.4, feher);
    ctx.statikus(g, 'epulet');
    for (const px of [-3.1, -1.05, 1.05, 3.1]) { const [a, b] = vilagba(x, z, ry, px, zc); ctx.utk.kor(a, b, 0.35); }
    const [ax, az] = vilagba(x, z, ry, 0, D / 2 + 4.6);
    ctx.horgony('hivatal', ax, az, null, { tipus: 'pont' });
  }
  // ---------------- nagypiac: fedett csarnok oszlopokon, alatta standok; a fűszeres a csarnok előtt
  {
    const x = 548, z = 303, g = new THREE.Group(), y = talaj(x, z); g.position.set(x, y, z);
    const L = 28, W = 18, H = 5.2;
    for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) { henger(g, -L / 2 + i * L / 4, H / 2, s * W / 2, 0.22, H, 0x3d4a52, 10); }
    for (const s of [-1, 1]) { const r = doboz(g, 0, H + 1.4, s * W / 4, L + 1.6, 0.14, W / 2 / Math.cos(0.3) + 0.8, 0x8a4434); r.rotation.x = -s * 0.3; }
    doboz(g, 0, H + 0.05, 0, L + 0.4, 0.3, W + 0.4, 0x3d4a52);
    for (let i = 0; i <= 4; i++) doboz(g, -L / 2 + i * L / 4, H + 0.7, 0, 0.2, 1.3, W, 0x3d4a52);
    const ST = ['stall-red', 'stall-green', 'stall', 'stall-red', 'stall-green', 'stall'];
    for (let i = 0; i < 6; i++) {
      const px = -9 + (i % 3) * 9, pz = i < 3 ? -4 : 4;
      prop('fantasy-town-kit/' + ST[i], px, 0, pz, ST[i] === 'stall' ? 3.2 : 2.5, i < 3 ? 0 : Math.PI, g);
      for (let k = 0; k < 4; k++) prop(['nature-kit/crop_pumpkin', 'nature-kit/crop_melon', 'survival-kit/box', 'nature-kit/crop_turnip'][(i + k) % 4], px - 1.2 + k * 0.8, 0, pz + (i < 3 ? 1.6 : -1.6), 2.2, R() * 6, g);
    }
    ctx.statikus(g, 'epulet');
    for (let i = 0; i < 6; i++) { const px = x - 9 + (i % 3) * 9, pz = z + (i < 3 ? -4 : 4); ctx.utk.box(px - 1.5, px + 1.5, pz - 1.3, pz + 1.3); }
    for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) ctx.utk.kor(x - L / 2 + i * L / 4, z + s * W / 2, 0.3);
    // fűszeres: piros stand színes zsákokkal (paprika, kurkuma, fahéj, ánizs)
    const f = new THREE.Group(); f.position.set(548, talaj(548, 288), 288); ctx.statikus(f, 'kozep');
    prop('fantasy-town-kit/stall-red', 0, 0, 0, 2.6, 0, f);
    const ZS = [0xb8321e, 0xd9a32a, 0x7a4a2a, 0x9a7a4a, 0x5a3a22, 0xc8562a];
    for (let k = 0; k < 6; k++) { const zs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 10), mat(0xd8c9a4)); zs.position.set(-1.0 + k * 0.4, 0.98, 0.15 + (k % 2) * 0.22); f.add(zs); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 10), mat(ZS[k])); t.position.set(zs.position.x, 1.2, zs.position.z); f.add(t); }
    ctx.utk.box(546.4, 549.6, 286.8, 289.4);
    tabla(ctx, 'FŰSZER', 548, talaj(548, 288) + 2.25, 287.2, 0, 1.6, 0.42, { hatter: '#7a2a1a', szin: '#f6e2b0', keret: '#f6e2b0' });
    ctx.horgony('fuszeres', 548, 285.6, null, { tipus: 'beszallito' });
    ctx.horgony('nagypiac', 548, 292, null, { tipus: 'pont' });
  }
  // ---------------- a tér házai: északi oldal (az út két oldalán) és nyugati oldal polgári házai
  polgari(ctx, 508, 243.6, 0, 3, POLGARI[0]);
  polgari(ctx, 544, 243.6, 0, 4, POLGARI[1]);
  varosiHaz(ctx, 561, 244, 0, 'c', { fal: 'okker', teto: 'cserep', lab: 'barna' });
  for (const [z, i] of [[256, 2], [270, 3]]) polgari(ctx, 492, z, Math.PI / 2, 2 + (i % 2), POLGARI[i]);
  // ---------------- kisvárosi pince: emeletes ház, előtte pincelejáró
  {
    const H = polgari(ctx, 504, 309, Math.PI, 4, POLGARI[4]);
    const x = 500, z = 302.4, g = new THREE.Group(); g.position.set(x, talaj(x, z), z); g.rotation.y = Math.PI;
    doboz(g, -0.9, 0.5, 0, 0.22, 1.0, 2.6, 0xc8c0b0); doboz(g, 0.9, 0.5, 0, 0.22, 1.0, 2.6, 0xc8c0b0);
    doboz(g, 0, 0.02, 0, 1.6, 0.06, 2.6, 0x15110e);
    for (let q = 0; q < 6; q++) doboz(g, 0, -0.1 - q * 0.0, -1.0 + q * 0.38, 1.5, 0.08, 0.3, 0x6e665c);
    henger(g, -0.9, 1.3, 0, 0.03, 0.6, 0x2c3236, 6); henger(g, 0.9, 1.3, 0, 0.03, 0.6, 0x2c3236, 6);
    ctx.statikus(g, 'kozep'); ctx.utk.obb(x, z, 2.2, 2.8, 0);
    ctx.horgony('pince', x, z - 2.2, null, { tipus: 'ingatlan' });
  }
  // ---------------- Állomás utca (x = 520) két oldala: városi és polgári házak
  const SZ = [{ fal: 'okker', teto: 'cserep' }, { fal: 'kekes', teto: 'pala' }, { fal: 'rozsa', teto: 'cserep' }, { fal: 'zold', teto: 'barna' }, { fal: 'meszel', teto: 'pala' }, { fal: 'tegla', teto: 'cserep' }];
  let q = 0;
  for (let z = 322; z < 350; z += 13) {
    varosiHaz(ctx, 506.5, z, Math.PI / 2, BELVAROS[q % 8], { ...SZ[q % 6], lab: 'barna' }); q++;
    if (z < 345) { varosiHaz(ctx, 533.5, z + 4, -Math.PI / 2, BELVAROS[(q + 3) % 8], { ...SZ[(q + 2) % 6], lab: 'barna' }); q++; }
  }
  // keleti utca: városi házak, panelház
  for (let x = 590; x < 650; x += 15) {
    varosiHaz(ctx, x, 250.5, 0, BELVAROS[q % 8], { ...SZ[q % 6], lab: 'barna' }); q++;
    varosiHaz(ctx, x + 4, 274, Math.PI, BELVAROS[(q + 2) % 8], { ...SZ[(q + 1) % 6], lab: 'barna' }); q++;
  }
  for (const [x, z, ry] of [[462, 314, 0], [462, 340, 0], [612, 300, Math.PI / 2]]) varosiHaz(ctx, x, z, ry, 'j', { fal: ['kopott', 'barack', 'szurke'][q++ % 3], teto: 'pala', lab: 'pala' }, 8.6);
  // nyugati utca (z = 284) polgári házai
  for (let x = 470; x < 498; x += 13) { polgari(ctx, x, 293.6, Math.PI, 3, POLGARI[q++ % 6]); if (x < 485) polgari(ctx, x, 274.4, 0, 3, POLGARI[q++ % 6]); }
  // a bevezető út mente (külvárosi házak kerttel)
  {
    const A = [470, 120], B = [530, 270], L = Math.hypot(60, 150), ux = 60 / L, uz = 150 / L;
    for (let s = 40; s < 125; s += 18) for (const side of [-1, 1]) {
      const nx = -uz * side, nz = ux * side, off = 14;
      const x = A[0] + ux * s + nx * off, z = A[1] + uz * s + nz * off;
      const key = 'city-kit-suburban/building-type-' + ['a', 'c', 'd', 'f', 'h', 'k', 'm'][(q++) % 7];
      cityHaz(ctx, key, x, z, Math.atan2(-nx, -nz), 8.2, { fal: ['meszel', 'okker', 'barack', 'sarga', 'kekes'][q % 5], teto: ['cserep', 'barna', 'pala'][q % 3], lab: 'pala' });
      const fx = A[0] + ux * s + nx * 5.5, fz = A[1] + uz * s + nz * 5.5;
      kerites(ctx, [[fx - ux * 8, fz - uz * 8], [fx + ux * 8, fz + uz * 8]], q % 2 ? 'fal' : 'drot', { kapu: [[0, 0.4, 0.55]], szin: 0xd6cfc0, lec: 0x40464c });
    }
  }
  // ---------------- gumis és autómosó
  {
    const H = haz(ctx, { x: 574, z: 233, ry: -Math.PI / 2, nx: 4, nz: 3, teto: 'lapos', stilus: { fal: 'kopott', teto: 'pala', fa: 'szurke' }, lab: 'sotet', ablakFeny: 0.3,
      falak: { s: ['wall-window-glass', 'wall-doorway-square', 'wall-doorway-square', 'wall-window-glass'] } });
    tabla(ctx, 'GUMIS · AUTÓMOSÓ', 574 - 3.9 - 0.1, H.y + 2.95, 233, -Math.PI / 2, 6.4, 0.7, { hatter: '#1f3f6a', szin: '#f2f2ea', keret: '#d8d8d0' });
    const g = new THREE.Group(), y = talaj(555, 238); g.position.set(555, y, 238);
    for (const [px, pz] of [[-3, -4], [3, -4], [-3, 4], [3, 4]]) henger(g, px, 1.9, pz, 0.12, 3.8, 0xd8d8d0, 10);
    doboz(g, 0, 3.9, 0, 7.2, 0.3, 9.4, 0x1f3f6a); doboz(g, 0, 4.12, 0, 7.4, 0.14, 9.6, 0xd8d8d0);
    for (const s of [-1, 1]) doboz(g, s * 3, 2.6, 0, 0.3, 0.3, 7.6, 0x6a7a8a);
    doboz(g, 0, 0.04, 0, 6.4, 0.08, 9, 0x5a5e62);
    ctx.statikus(g, 'kozep'); for (const [px, pz] of [[-3, -4], [3, -4], [-3, 4], [3, 4]]) ctx.utk.kor(555 + px, 238 + pz, 0.2);
    const t = new THREE.Group(), yt = talaj(566, 222); t.position.set(566, yt, 222);
    for (let k = 0; k < 4; k++) for (let h = 0; h < 4 - (k % 2); h++) prop('car-kit/debris-tire', (k % 2) * 1.4, h * 0.42, Math.floor(k / 2) * 1.4, 2.8, R() * 6, t);
    ctx.statikus(t, 'kozep'); ctx.utk.box(565, 568.4, 221, 224.4);
    const car = prop('car-kit/sedan', 0, 0, 0, 1.25); recolor(car, { nev: 'kv-kek', rules: [[isRed, [70, 98, 140], [232, 97, 71]]] });
    const cg = new THREE.Group(); cg.position.set(555, y, 239); cg.rotation.y = 0.1; cg.add(car); ctx.statikus(cg, 'kozep'); ctx.utk.obb(555, 239, 2, 3.4, 0.1);
    ctx.horgony('autoszer', 560, 236, null, { tipus: 'uzlet' });
  }
  // ---------------- vasútállomás: kétszintes felvételi épület, peron, ütközőbak, álló motorvonat
  {
    const x = 520, z = 369.5;
    const H = haz(ctx, { x, z, ry: 0, nx: 6, nz: 2, emelet: 2, stilus: { fal: 'okker', teto: 'cserep', fa: 'barna' }, lab: 'tegla', ablak: 'wall-window-glass', ablak2: 'wall-window-round', ablakFeny: 0.7,
      falak: { s: ['wall-window-glass', 'wall-doorway-round', 'wall-window-glass', 'wall-window-glass', 'wall-doorway-round', 'wall-window-glass'], n: ['wall-window-glass', 'wall-window-glass', 'wall-doorway-round', 'wall-doorway-round', 'wall-window-glass', 'wall-window-glass'] } });
    tabla(ctx, 'KISVÁROS', x, H.y + 2.4, z - T - 0.08, Math.PI, 3.6, 0.6, { hatter: '#f4efe0', szin: '#1c2a44', keret: '#1c2a44' });
    tabla(ctx, 'KISVÁROS', x, H.y + 2.4, z + T + 0.08, 0, 3.6, 0.6, { hatter: '#f4efe0', szin: '#1c2a44', keret: '#1c2a44' });
    const g = new THREE.Group(), y = talaj(x, 378); g.position.set(0, 0, 0);
    // peron: magasított, sárga biztonsági sáv, előtető oszlopokon
    const pz0 = 373.2, pz1 = VASUT.z - 1.8, pzc = (pz0 + pz1) / 2;
    doboz(g, 505, y + 0.28, pzc, 90, 0.56, pz1 - pz0, 0xa8a296);
    doboz(g, 505, y + 0.57, pz1 - 0.35, 90, 0.02, 0.18, 0xd8b83a);
    for (let k = 0; k < 6; k++) henger(g, 500 + k * 4, y + 2.1, pzc - 0.4, 0.1, 3.2, 0x3d4a52, 8);
    const et = doboz(g, 510, y + 3.75, pzc - 0.4, 24, 0.14, 4.6, 0x7a3a2a); et.rotation.x = 0.06;
    ctx.statikus(g, 'epulet');
    PLATFORMOK.push([460, 550, pz0, pz1, y + 0.57]);   // a peron járható (a gyalogos fellép rá)
    for (const px of [495, 525]) pad(ctx, px, pzc - 1.5, Math.PI);
    for (const px of [480, 506, 534]) utcaiLampa(ctx, px, pzc + 0.4, 0);
    // motorvonat: piros-krém dízel + két kocsi a sínen (Kenney Train Kit)
    const v = new THREE.Group(); const S = 2.25, ty = talaj(560, VASUT.z) + 0.32;
    const nyers = [['train-kit/train-diesel-b', 0], ['train-kit/train-electric-city-a', 5.6], ['train-kit/train-electric-city-a', 11.2]];
    for (const [key, dx] of nyers) {
      const m = prop(key, 562 + dx, ty, VASUT.z, S, -Math.PI / 2, v);
      recolor(m, { nev: 'vonat', rules: [[isBlue, [176, 48, 40], [103, 148, 217]], [isTeal, [176, 48, 40], [97, 203, 139]]] });
    }
    ctx.statikus(v, 'epulet'); ctx.utk.box(555, 580, VASUT.z - 1.6, VASUT.z + 1.6);
    // az állomás előtti tér: virágágyások fával, padok, kerékpártároló, parkoló autók, kandeláberek
    const t = new THREE.Group();
    for (const px of [478, 498, 542, 562]) {
      const yy = talaj(px, 357); doboz(t, px, yy + 0.25, 357, 4.2, 0.5, 2.6, 0xb4ad9c); doboz(t, px, yy + 0.47, 357, 3.8, 0.08, 2.2, 0x5e4a34);
      ctx.szoro.add('nature-kit/tree_default', px, yy + 0.4, 357, 4.4, R() * 6, { layer: 'fa' }); ctx.szoro.addKlaszter('virag', px - 1.2, yy + 0.45, 357, 0.7, R() * 6); ctx.utk.box(px - 2.1, px + 2.1, 355.7, 358.3);
    }
    for (const px of [488, 552]) pad(ctx, px, 359.5, Math.PI);
    for (let k = 0; k < 6; k++) { const px = 506 + k * 0.9, yy = talaj(px, 361); henger(t, px, yy + 0.42, 361, 0.03, 0.84, 0x5a5d60, 6).rotation.x = Math.PI / 2; }
    for (const [px, c] of [[470, [196, 60, 44]], [474, [70, 98, 140]], [566, [210, 200, 170]]]) {
      const m = prop('car-kit/sedan', px, talaj(px, 352), 352, 1.25, 0, t); recolor(m, { nev: 'park' + c.join(), rules: [[isRed, c, [232, 97, 71]]] }); ctx.utk.obb(px, 352, 1.9, 3.4, 0);
    }
    ctx.statikus(t, 'kozep');
    for (const px of [486, 520, 554]) lampaOszlop(ctx, px, 362.6, 4.4);
    ctx.horgony('allomas', x, z - T - 2, null, { tipus: 'pont' });
  }
  // ---------------- utcai lámpák, parkoló autók
  for (const [x, z, r] of [[516, 300, Math.PI / 2], [516, 326, Math.PI / 2], [516, 352, Math.PI / 2], [524, 313, -Math.PI / 2], [524, 339, -Math.PI / 2], [580, 266, Math.PI], [610, 266, Math.PI], [640, 266, Math.PI], [485, 280.5, 0], [460, 280.5, 0], [520, 226, -Math.PI / 2 + 0.38], [505, 190, -Math.PI / 2 + 0.38], [490, 152, -Math.PI / 2 + 0.38]])
    utcaiLampa(ctx, x, z, r);
  {
    const g = new THREE.Group();
    const PARK = [['car-kit/sedan', 505, 262, Math.PI / 2, [120, 120, 118]], ['car-kit/hatchback-sports', 505, 279, Math.PI / 2, [196, 60, 44]], ['car-kit/van', 560, 247, 0, null], ['car-kit/sedan', 597, 265, 0, [210, 200, 170]], ['car-kit/hatchback-sports', 526, 330, 0, [60, 90, 130]]];
    for (const [key, x, z, ry, c] of PARK) {
      const m = prop(key, x, talaj(x, z), z, 1.25, ry, g);
      if (c) recolor(m, { nev: 'park' + c.join(), rules: [[isRed, c, [232, 97, 71]], [isTeal, c, [79, 184, 130]]] });
      ctx.utk.obb(x, z, 1.9, 3.4, ry);
    }
    ctx.statikus(g, 'kozep');
  }
  ctx.horgony('kisvaros', 530, 270, null, { tipus: 'regio' });
  return out;
}

/** Előtető (csíkos ponyva) egy homlokzat elé: helyi x mentén w széles, d mélyen kiáll, a homlokzat síkja z = 0. */
function eloteto(g, x, y, w, d, c1, c2) {
  const n = Math.max(3, Math.round(w / 0.42)), a = 0.38;
  for (let i = 0; i < n; i++) { const p = doboz(g, x - w / 2 + (i + 0.5) * w / n, y - Math.sin(a) * d / 2, Math.cos(a) * d / 2, w / n + 0.002, 0.03, d, i % 2 ? c2 : c1); p.rotation.x = a; }
  for (let i = 0; i < n; i++) doboz(g, x - w / 2 + (i + 0.5) * w / n, y - Math.sin(a) * d - 0.1, Math.cos(a) * d, w / n + 0.002, 0.2, 0.02, i % 2 ? c2 : c1);   // lelógó fodor
  for (const s of [-1, 1]) { const k = doboz(g, x + s * w / 2, y - Math.sin(a) * d / 2, Math.cos(a) * d / 2, 0.03, 0.03, d + 0.05, 0x2c3236); k.rotation.x = a; }
}
/** Plakátok a hirdetőoszlopra (vászon): helyi események, egy leszakadt sarok. */
function plakatTex() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = '#d8d0b8'; c.fillRect(0, 0, 1024, 256);
  const P = [['#b8322a', '#f4e8c8', 'SZÜRETI', 'BÁL'], ['#1c2a44', '#f0d070', 'MOZI', 'PÉNTEK'], ['#e9dfc4', '#7a2a1a', 'NAGY', 'VÁSÁR'], ['#3e6a4c', '#f4efe0', 'TŰZOLTÓ', 'BÁL'], ['#d9a32a', '#2a1c12', 'PÁLINKA', 'VERSENY'], ['#6a3a6a', '#f4e8c8', 'CIRKUSZ', 'SZOMBAT']];
  P.forEach(([bg, fg, a, b], i) => {
    const x = 6 + i * 170, y = 10 + (i % 2) * 14, w = 160, h = 222;
    c.fillStyle = bg; c.fillRect(x, y, w, h); c.strokeStyle = fg; c.lineWidth = 3; c.strokeRect(x + 6, y + 6, w - 12, h - 12);
    c.fillStyle = fg; c.textAlign = 'center'; c.font = 'bold 30px Georgia, serif'; c.fillText(a, x + w / 2, y + 74, w - 20);
    c.font = 'bold 40px Georgia, serif'; c.fillText(b, x + w / 2, y + 124, w - 20);
    c.globalAlpha = 0.55; for (let k = 0; k < 3; k++) c.fillRect(x + 26, y + 150 + k * 16, w - 52 - (k % 2) * 30, 5); c.globalAlpha = 1;
    if (i % 3 === 1) { c.fillStyle = 'rgba(216,208,184,0.95)'; c.beginPath(); c.moveTo(x + w, y + h); c.lineTo(x + w - 40, y + h); c.lineTo(x + w, y + h - 34); c.fill(); }   // leszakadt sarok
  });
  for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(60,50,40,${Math.random() * 0.08})`; c.fillRect(Math.random() * 1024, Math.random() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** A főtér berendezése (a bírálat: „a főtér kopár”). Minden elem a járókelő-tengelyeken kívül. */
function terTartozekok(ctx) {
  const R = ctx.rnd, VAS = 0x2b3530;
  // cukrászda: a (544, 243,6) polgári ház földszintje; előtetők a kirakatok fölött, terasz három asztallal
  {
    const fz = 243.6 + T + 0.02, g = new THREE.Group(); g.position.set(544, talaj(544, fz), fz);
    for (const lx of [-3.9, -1.3, 3.9]) eloteto(g, lx, 2.55, 2.3, 1.15, 0xefe6d0, 0xa8322a);
    eloteto(g, 1.3, 2.75, 2.3, 0.8, 0xefe6d0, 0xa8322a);
    ctx.statikus(g, 'kozep');
    tabla(ctx, 'CUKRÁSZDA', 544 + 1.3, talaj(544, fz) + 3.3, fz + 0.06, 0, 2.6, 0.5, { hatter: '#2f4f3a', szin: '#f4e8c8', keret: '#c8a858' });
    const t = new THREE.Group();
    const ERNYO = [[0xefe6d0, 0xa8322a], [0xefe6d0, 0x2f4f3a], [0xefe6d0, 0xa8322a]];
    [[539.6, 251.4], [544.4, 252.4], [548.9, 251.2]].forEach(([x, z], i) => {
      const y = talaj(x, z), a = R() * 0.6;
      henger(t, x, y + 0.36, z, 0.03, 0.72, VAS, 6); henger(t, x, y + 0.02, z, 0.22, 0.04, VAS, 10); henger(t, x, y + 0.735, z, 0.4, 0.03, 0xe8e2d4, 16);
      henger(t, x, y + 1.25, z, 0.025, 1.6, 0xd8d0c0, 6);
      const [c1, c2] = ERNYO[i];
      henger(t, x, y + 2.1, z, 1.35, 0.42, c1, 8, 0.03); henger(t, x, y + 1.875, z, 1.36, 0.06, c2, 8);
      const n = i === 1 ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const b = a + k / n * Math.PI * 2 + (R() - 0.5) * 0.3, cx = x + Math.sin(b) * 0.72, cz = z + Math.cos(b) * 0.72, ch = new THREE.Group();
        ch.position.set(cx, talaj(cx, cz), cz); ch.rotation.y = b + (R() - 0.5) * 0.4; t.add(ch);
        for (const [sx, sz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) doboz(ch, sx, 0.22, sz, 0.03, 0.44, 0.03, VAS);
        doboz(ch, 0, 0.46, 0, 0.42, 0.04, 0.42, 0x8a5a38);
        for (const sx of [-0.18, 0.18]) doboz(ch, sx, 0.68, 0.19, 0.03, 0.46, 0.03, VAS);
        doboz(ch, 0, 0.78, 0.19, 0.4, 0.16, 0.025, 0x8a5a38);
      }
      ctx.utk.kor(x, z, 1.05, 0.9);
    });
    // a terasz szegélye a tér felé: két alacsony virágláda, középen átjáró
    for (const [x0, x1] of [[537.2, 542.2], [546.2, 551.2]]) {
      const x = (x0 + x1) / 2, z = 254.9, y = talaj(x, z);
      doboz(t, x, y + 0.28, z, x1 - x0, 0.56, 0.5, 0x2f4f3a); doboz(t, x, y + 0.57, z, x1 - x0 + 0.06, 0.05, 0.56, 0x6e5a3e); doboz(t, x, y + 0.55, z, x1 - x0 - 0.1, 0.04, 0.4, 0x3e2c1e);
      for (let q = 0; q < 6; q++) ctx.szoro.addKlaszter(q % 2 ? 'virag' : 'fu2', x0 + 0.4 + q * (x1 - x0 - 0.8) / 5, y + 0.55, z, 0.38, R() * 6);
      ctx.utk.box(x0, x1, z - 0.25, z + 0.25, 0.6);
    }
    ctx.statikus(t, 'kozep');
  }
  // órásbolt a (508, 243,6) ház földszintjén: előtető és cégtábla
  {
    const fz = 243.6 + T + 0.02, g = new THREE.Group(); g.position.set(508, talaj(508, fz), fz);
    for (const lx of [-2.6, 2.6]) eloteto(g, lx, 2.55, 2.3, 1.0, 0xe9dfc4, 0x1f3f6a);
    ctx.statikus(g, 'kozep');
    tabla(ctx, 'ÓRÁS · ÉKSZERÉSZ', 508, talaj(508, fz) + 3.2, fz + 0.06, 0, 3.4, 0.46, { hatter: '#1c2a44', szin: '#f0d070', keret: '#f0d070' });
  }
  // plakátoszlop (Morris-oszlop) a tér nyugati felén
  {
    const x = 512.5, z = 262.5, y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    henger(g, 0, 0.12, 0, 0.66, 0.24, 0x2f4a3a, 16); henger(g, 0, 0.3, 0, 0.6, 0.14, 0x2f4a3a, 16);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 1.9, 24, 1, true), new THREE.MeshStandardMaterial({ map: plakatTex(), roughness: 0.9 }));
    pl.position.y = 1.32; pl.castShadow = pl.receiveShadow = true; g.add(pl);
    henger(g, 0, 1.31, 0, 0.545, 1.9, 0x2f4a3a, 16);
    henger(g, 0, 2.32, 0, 0.66, 0.12, 0x2f4a3a, 16); henger(g, 0, 2.6, 0, 0.62, 0.45, 0x2f4a3a, 16, 0.1); henger(g, 0, 2.9, 0, 0.06, 0.25, 0xb89a4a, 8);
    ctx.statikus(g, 'kozep'); ctx.utk.kor(x, z, 0.7);
  }
  // kőszegély-gyűrűk a kút körül és sötétebb gránitsáv a kúttól a Hivatal lépcsőjéig: a burkolat rajzolata
  // tagolja a nagy teret, és a játékost a tér fontos épületéhez vezeti
  {
    const y = talaj(545, 274) + 0.075, gm = new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const gm2 = new THREE.MeshStandardMaterial({ color: 0x938e84, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const g = new THREE.Group();
    for (const [r0, r1, m] of [[7.6, 8.3, gm], [8.3, 8.6, gm2], [4.35, 4.7, gm]]) { const r = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64, 1), m); r.rotation.x = -Math.PI / 2; r.position.set(545, y, 274); r.receiveShadow = true; g.add(r); }
    const sav = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 2.6), gm); sav.rotation.x = -Math.PI / 2; sav.position.set(557.8, y, 278); sav.receiveShadow = true; g.add(sav);
    for (const s2 of [-1, 1]) { const sz = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 0.3), gm2); sz.rotation.x = -Math.PI / 2; sz.position.set(557.8, y + 0.002, 278 + s2 * 1.45); g.add(sz); }
    ctx.statikus(g, 'kozep');
  }
  // fával ültetett kőládák a parkoló autók és a tér között (nyugati szél)
  {
    const g = new THREE.Group();
    for (const z of [257.5, 270.5, 284.5]) {
      const x = 508.6, y = talaj(x, z);
      doboz(g, x, y + 0.3, z, 1.3, 0.6, 1.3, 0x9e988c); doboz(g, x, y + 0.6, z, 1.42, 0.06, 1.42, 0x8f8a80); doboz(g, x, y + 0.58, z, 1.1, 0.04, 1.1, 0x4a3626);
      ctx.szoro.add('nature-kit/tree_default', x, y + 0.55, z, 3.2, R() * 6, { layer: 'fa' });
      for (const [qx, qz] of [[-0.35, 0.35], [0.35, -0.35]]) ctx.szoro.addKlaszter('virag', x + qx, y + 0.6, z + qz, 0.35, R() * 6);
      ctx.utk.box(x - 0.7, x + 0.7, z - 0.7, z + 0.7);
    }
    ctx.statikus(g, 'kozep');
  }
  // a Hivatal bejáratát keretező két kandeláber és két pad a lépcső előtt
  for (const z of [271.6, 284.4]) lampaOszlop(ctx, 560.6, z, 4.4);
  pad(ctx, 557.2, 270.4, -Math.PI / 2 + 0.05); pad(ctx, 557.2, 285.6, -Math.PI / 2 - 0.05);
  // parkoló kisautó a cukrászda sarkánál (a bevezető úttól keletre, a járda szélén)
  {
    const g = new THREE.Group(), m = prop('car-kit/hatchback-sports', 532.4, talaj(532.4, 252.2), 252.2, 1.25, Math.PI / 2 + 0.06, g);
    recolor(m, { nev: 'park-krem', rules: [[isRed, [214, 200, 160], [232, 97, 71]], [isTeal, [214, 200, 160], [79, 184, 130]]] });
    ctx.statikus(g, 'kozep'); ctx.utk.obb(532.4, 252.2, 1.9, 3.4, Math.PI / 2 + 0.06);
  }
}
