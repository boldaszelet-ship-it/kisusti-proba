// Kisüsti — A régi major (-270, 140): elhagyott közös gazdaság. Hosszú betoncsarnok ablaksorral, hiányos
// hullámlemez tetővel és látszó rácsos tartókkal (ez a megvehető ingatlan), a félig összedőlt második csarnok,
// rozsdás silópár, víztorony, rozsdás traktor és platós teherautó, gumik, olajos hordók, gaz a betonon,
// dőlt kerítés. Kevés szem: senki sem jár erre.
import * as THREE from 'three';
import { prop } from './betolto.js';
import { recolor, isRed, isTeal, isBlue, mat } from './paletta.js';
import { doboz, henger, kerites, vilagba } from './epulet.js';
import { talaj } from './terep.js';

const rozsdaCache = new Map();
/** Rozsdás anyag: a textúra szorozva rozsdabarnával (a szürke-lila Kenney-traktor színei így fakóak, vörösesek). */
function rozsdaMat(m) { if (!rozsdaCache.has(m.uuid)) { const c = m.clone(); c.color = new THREE.Color(0xc88a62); rozsdaCache.set(m.uuid, c); } return rozsdaCache.get(m.uuid); }
const BETON = 0xa49f92, BETON2 = 0x8f8a7e, ROZSDA = 0x8a5236, PALA = 0x9c9a92;

/** Betoncsarnok helyi koordinátákban (hossz x mentén). romos: 0..1 (fal- és tetőhiány). */
function csarnok(ctx, cx, cz, ry, L, W, H, romos, kapu = true) {
  const R = ctx.rnd;
  const y0 = Math.min(talaj(cx, cz), ...[[-L / 2, -W / 2], [L / 2, -W / 2], [-L / 2, W / 2], [L / 2, W / 2]].map(([a, b]) => { const [x, z] = vilagba(cx, cz, ry, a, b); return talaj(x, z); }));
  const g = new THREE.Group(); g.position.set(cx, y0, cz); g.rotation.y = ry;
  const n = Math.round(L / 4), seg = L / n;
  doboz(g, 0, -0.3, 0, L + 0.6, 0.9, W + 0.6, BETON2);   // alaplemez
  // hosszfalak: pillér + mellvéd + szemöldök, közte ablaknyílás (néhol befalazva)
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + seg * (i + 0.5), z = s * W / 2;
      const kapuHely = kapu && s > 0 && i === Math.floor(n / 2);
      const hh = romos && R() < romos * 0.5 ? H * (0.3 + R() * 0.5) : H;
      doboz(g, x - seg / 2 + 0.3, hh / 2, z, 0.6, hh, 0.35, BETON);
      if (kapuHely) { doboz(g, x, H - 0.6, z, seg - 0.6, 1.2, 0.35, BETON); continue; }
      doboz(g, x, 0.6, z, seg - 0.6, 1.2, 0.3, BETON2);
      if (hh >= H) doboz(g, x, H - 0.5, z, seg - 0.6, 1.0, 0.3, BETON);
      if (R() < 0.25) doboz(g, x, 2.3, z, seg - 0.6, 2.2, 0.28, 0x9a8f80);   // befalazott ablak (más téglaszín)
      else if (R() < 0.3) doboz(g, x, 2.3, z - s * 0.05, seg - 0.7, 2.1, 0.04, 0x2a2e30);   // megmaradt sötét üveg
    }
    doboz(g, L / 2 * s, H / 2, 0, 0.35, H, W + 0.35, BETON);   // oromfal-lábazat
  }
  // oromfalak háromszöggel (W szélesség, a tető gerince x mentén)
  const RISE = W * 0.22;
  const sh = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, RISE)]);
  const og = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false });
  for (const s of [-1, 1]) { const tri = new THREE.Mesh(og, mat(BETON)); tri.position.set(s * L / 2 - (s > 0 ? 0.15 : -0.15), H, 0); tri.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; tri.castShadow = tri.receiveShadow = true; g.add(tri); }
  // rácsos tartók 4 m-enként és a hullámlemez tető (hiányzó, elcsúszott táblák)
  const slope = Math.atan2(RISE, W / 2), lenS = Math.hypot(RISE, W / 2);
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + seg * i;
    for (const s of [-1, 1]) { const b = doboz(g, x, H + RISE / 2, s * W / 4, 0.18, 0.18, lenS, 0x6e6a62); b.rotation.x = s * slope; }
    doboz(g, x, H + 0.1, 0, 0.16, 0.16, W, 0x6e6a62);
    for (const t of [-0.25, 0.25]) doboz(g, x, H + RISE * 0.25, t * W, 0.1, RISE * 0.5, 0.1, 0x6e6a62);
  }
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) for (let q = 0; q < 2; q++) {
    if (R() < romos * 0.55) continue;
    const x = -L / 2 + seg * (i + 0.5), t = (q + 0.5) / 2;
    const p = doboz(g, x + (R() < romos * 0.2 ? (R() - 0.5) * 1.2 : 0), H + RISE * (1 - t) + 0.12, s * W / 2 * t, seg - 0.05, 0.06, lenS / 2 + 0.05, PALA);
    p.rotation.x = s * slope + (R() < romos * 0.15 ? (R() - 0.5) * 0.3 : 0);
  }
  ctx.statikus(g, 'epulet');
  // ütközők: a hosszfalak és oromfalak (a kapunyílás szabad)
  for (const s of [-1, 1]) {
    const [ex, ez] = vilagba(cx, cz, ry, s * L / 2, 0); ctx.utk.obb(ex, ez, 0.5, W, ry);
    if (s < 0 || !kapu) { const [wx, wz] = vilagba(cx, cz, ry, 0, s * W / 2); ctx.utk.obb(wx, wz, L, 0.5, ry); }
    else {
      const half = L / 2 - seg * (Math.floor(n / 2)) - 0.3;
      for (const t of [-1, 1]) { const [wx, wz] = vilagba(cx, cz, ry, t * (L / 4 + seg / 4), W / 2); ctx.utk.obb(wx, wz, L / 2 - seg / 2, 0.5, ry); }
    }
  }
  return { g, y0, kapu: vilagba(cx, cz, ry, -L / 2 + seg * (Math.floor(n / 2) + 0.5), W / 2 + 2) };
}

export function epitMajor(ctx) {
  const R = ctx.rnd, out = {};
  const ry = 0.06;
  // ---- A: a fő csarnok (a megvehető ingatlan)
  const A = csarnok(ctx, -284, 114, ry, 56, 16, 5.2, 0.35, true);
  // rozsdás tolókapu félig nyitva
  { const [x, z] = vilagba(-284, 114, ry, -56 / 2 + 56 / 14 * 7.5 + 1.2, 8.45); const g = new THREE.Group(); g.position.set(x, A.y0, z); g.rotation.y = ry;
    doboz(g, 0, 2.1, 0, 3.4, 4.0, 0.12, ROZSDA); for (let q = 0; q < 6; q++) doboz(g, 0, 0.4 + q * 0.7, 0.07, 3.4, 0.08, 0.04, 0x6a3c26);
    ctx.statikus(g, 'kozep'); }
  ctx.horgony('major', A.kapu[0], A.kapu[1], null, { tipus: 'ingatlan' });
  // ---- a csarnok belseje (a bírálat: „üres csarnok”): egykori tehenészet — középen betonvályú, két oldalán
  // állás-korlát (helyenként kidőlve), az északi falnál szalmabála-rakások, a kapu mellett munkapad, ládák,
  // hordók és egy kerekeit vesztett pótkocsi. A kapu vonala (helyi x ≈ 2) szabad marad.
  {
    const g = new THREE.Group(); g.position.set(-284, A.y0 + 0.15, 114); g.rotation.y = ry;
    const CS = 0x6e6a62, SZALMA = 0xb09656;
    for (const [x0, x1] of [[-25, -1], [5, 25]]) {
      const cx = (x0 + x1) / 2, L = x1 - x0;
      doboz(g, cx, 0.3, 0, L, 0.6, 1.0, BETON2); doboz(g, cx, 0.58, 0, L - 0.2, 0.06, 0.6, 0x4e4a42);
      for (const s of [-1, 1]) {
        for (let x = x0; x <= x1 + 0.01; x += 2.4) { if (R() < 0.12) continue; doboz(g, x, 0.65, s * 1.6, 0.07, 1.3, 0.07, CS); }
        for (const hh of [0.75, 1.2]) {
          let a = x0;
          while (a < x1) { const b = Math.min(x1, a + 2.4 * (1 + Math.floor(R() * 3))); if (R() > 0.15) { const p = doboz(g, (a + b) / 2, hh, s * 1.6, b - a, 0.06, 0.06, CS); if (R() < 0.12) { p.rotation.z = (R() - 0.5) * 0.5; p.position.y -= 0.3; } } a = b + (R() < 0.2 ? 2.4 : 0); }
        }
        const [ux, uz] = vilagba(-284, 114, ry, cx, s * 1.6); ctx.utk.obb(ux, uz, L, 0.2, ry, 1.4);
      }
      const [vx, vz] = vilagba(-284, 114, ry, cx, 0); ctx.utk.obb(vx, vz, L, 1.0, ry, 0.6);
    }
    // szalmabála-rakások (kis szögletes bálák, néhány leborulva)
    for (const sx of [-21, -9, 13, 20]) {
      const n = 2 + Math.floor(R() * 2);
      for (let k = 0; k < n; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        if (k === n - 1 && R() < 0.35) continue;
        const b = doboz(g, sx + i * 1.25 + (R() - 0.5) * 0.1, 0.27 + k * 0.52, -6.4 + j * 0.62, 1.2, 0.5, 0.58, SZALMA);
        b.rotation.y = (R() - 0.5) * 0.08;
      }
      doboz(g, sx + 4.1, 0.25, -5.3, 1.2, 0.5, 0.58, SZALMA, 0.6);
      const [bx, bz] = vilagba(-284, 114, ry, sx + 1.3, -6.1); ctx.utk.obb(bx, bz, 4, 1.4, ry);
    }
    // munkapad, ládák, hordók a kapu mellett
    prop('survival-kit/workbench', 7.5, 0, 6.6, 3.2, Math.PI, g);
    for (const [x, z, r] of [[10.2, 6.8, 0.1], [10.9, 5.9, 0.6], [10.4, 6.7, 0.3]]) prop('survival-kit/box-large', x, x === 10.4 ? 0.65 : 0, z, 2.6, r, g);
    for (const [x, z] of [[-6, 6.5], [-5.3, 6.9], [-5.7, 6.0]]) prop('survival-kit/barrel', x, 0, z, 3.4, R() * 6, g);
    { const [wx, wz] = vilagba(-284, 114, ry, 9, 6.4); ctx.utk.obb(wx, wz, 5, 1.6, ry, 1.2); }
    // pótkocsi: plató, oldalfalak, vonórúd; az egyik oldalon bakon áll, a kerék mellette hever
    {
      const t = new THREE.Group(); t.position.set(-16, 0, 5.2); t.rotation.y = 0.08; g.add(t);
      doboz(t, 0, 0.95, 0, 5.2, 0.14, 2.2, 0x5f6a4e);
      for (const s of [-1, 1]) doboz(t, 0, 1.3, s * 1.06, 5.2, 0.6, 0.08, 0x6b7656);
      doboz(t, -2.56, 1.3, 0, 0.08, 0.6, 2.2, 0x6b7656); doboz(t, 2.56, 1.3, 0, 0.08, 0.6, 2.2, 0x6b7656);
      doboz(t, 0, 0.8, 0, 4.6, 0.16, 0.2, 0x3a3a36); doboz(t, 3.4, 0.55, 0, 1.8, 0.08, 0.08, 0x3a3a36).rotation.z = 0.25;
      for (const x of [-1.6, 1.6]) { const w = prop('car-kit/wheel-default', x, 0.55, 1.2, 1.8, Math.PI / 2, t); w.rotation.y = 0; }
      doboz(t, -1.6, 0.35, -0.9, 0.5, 0.7, 0.5, 0x6a5040);
      const kw = prop('car-kit/wheel-default', 0.6, 0.18, -2.0, 1.8, 0, t); kw.rotation.z = Math.PI / 2;
      const [tx, tz] = vilagba(-284, 114, ry, -16, 5.2); ctx.utk.obb(tx, tz, 5.4, 2.6, ry + 0.08);
    }
    ctx.statikus(g, 'kozep');
  }
  // ---- B: félig összedőlt második csarnok
  csarnok(ctx, -238, 170, ry + Math.PI / 2 * 0, 40, 12, 4.6, 0.85, false);
  // ---- silópár (rozsdás hullámlemez, kúpos tető, létra)
  for (const [x, z] of [[-326, 162], [-326, 172]]) {
    const y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    henger(g, 0, 7, 0, 3.0, 14, 0x8c6c52, 20);
    for (let h = 1; h < 14; h += 1.6) henger(g, 0, h, 0, 3.05, 0.12, 0x6e4c36, 20);
    henger(g, 0, 15.1, 0, 3.1, 2.2, 0x7a5a44, 20, 0.35);
    for (let h = 0.3; h < 14; h += 0.45) doboz(g, 3.15, h, 0, 0.06, 0.05, 0.6, 0x4a3a2e);
    doboz(g, 3.1, 7, -0.3, 0.06, 14, 0.06, 0x4a3a2e); doboz(g, 3.1, 7, 0.3, 0.06, 14, 0.06, 0x4a3a2e);
    ctx.statikus(g, 'epulet'); ctx.utk.kor(x, z, 3.1);
  }
  // ---- víztorony (betonszár, gomba alakú tartály)
  { const x = -208, z = 98, y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    henger(g, 0, 9, 0, 1.6, 18, 0xb0aba0, 16);
    henger(g, 0, 19.6, 0, 5.2, 3.2, 0xa8a398, 20, 1.8);
    henger(g, 0, 22.3, 0, 5.2, 2.2, 0xb6b1a6, 20);
    henger(g, 0, 23.7, 0, 5.4, 0.6, 0x8a857a, 20, 3.5);
    for (let h = 0.5; h < 18; h += 0.45) doboz(g, 1.65, h, 0, 0.05, 0.05, 0.5, 0x4a4a4a);
    doboz(g, 0, 21.2, 5.2, 1.4, 0.08, 0.6, 0x4a4a4a);
    ctx.statikus(g, 'epulet'); ctx.utk.kor(x, z, 1.7); }
  // ---- az udvar (a bírálat: „gépiesen rácsba rendezett”, „zöld rácsvonalak a betonon”): a beton már nem egy
  // 120 × 74 m-es tábla, hanem a használat nyoma — csarnokelő, a kaputól bevezető betonút, a B csarnok és a silók
  // betonja (adat.js TEREK); köztük visszafoglalt gyep. A tárgyak munkafolyamat szerint állnak: a kapunál
  // terelőelemek és betongyűrűk, az út mentén kazal-szín bálákkal és trágyadomb, a csarnokelőn raklapok és
  // hordók, a B csarnok mellett gázolajtartály, a silók előtt silótér fóliával és gumikkal. Semmi sem áll sorban.
  const Wd = (cx, cz, r, lx, lz) => vilagba(cx, cz, r, lx, lz);
  {
    const g = new THREE.Group();
    // rozsdás traktor a bevezető út mellett, a platós teherautó a gyepen, félrecsúszva
    const tr = prop('car-kit/tractor', -247, talaj(-247, 128), 128, 1.9, 2.55, g);
    tr.traverse(m => { if (m.isMesh) m.material = rozsdaMat(m.material); });
    tr.rotation.z = 0.05;
    const tk = prop('car-kit/truck-flat', -297, talaj(-297, 147), 147, 1.7, -1.25, g);
    recolor(tk, { nev: 'rozsda2', rules: [[isRed, [104, 92, 80], [232, 97, 71]], [isBlue, [88, 96, 104], [101, 142, 214]], [isTeal, [92, 100, 84], [79, 184, 130]]] });
    tk.rotation.z = -0.07;
    // gumikupac: egymásra dobva, néhány az oldalán, egy a kupacnak dőlve (nem 3 × 3-as rács)
    const GK = [[0, 0, 0, 0], [0.15, 0.42, 0.1, 0], [-0.1, 0.84, -0.05, 0], [1.25, 0, 0.4, 0], [1.3, 0.42, 0.5, 0], [-1.1, 0.1, 0.9, 1.25], [0.6, 0, -1.3, 0], [2.4, 0.25, -0.4, 1.4], [-0.4, 0, 1.6, 0]];
    for (const [dx, dy, dz, rz] of GK) {
      const x = -251 + dx, z = 150 + dz, t = prop('car-kit/debris-tire', x, talaj(x, z) + dy, z, 2.6, R() * 6, g);
      if (rz) { t.rotation.z = rz; t.position.y += 0.3; }
    }
    // hordók a csarnokelő nyugati végén: csoportban, egy felborulva, egy nyitott
    const HK = [[-306.5, 129.2, 0], [-305.6, 129.9, 0], [-306.2, 130.7, 0], [-304.4, 130.4, 1], [-303.2, 128.6, 2]];
    for (const [x, z, t] of HK) {
      const b = prop(t === 2 ? 'survival-kit/barrel-open' : 'survival-kit/barrel', x, talaj(x, z), z, 3.4, R() * 6, g);
      if (t === 1) { b.rotation.z = Math.PI / 2; b.position.y += 0.45; }
    }
    prop('fantasy-town-kit/planks', -281, talaj(-281, 151) + 0.1, 151, [2.4, 3, 2], 0.5, g);
    { const mp = prop('survival-kit/metal-panel', -243.5, talaj(-243.5, 133), 133, [6, 6, 6], 0.8, g); mp.rotation.x = -1.3; mp.traverse(m => { if (m.isMesh) m.material = rozsdaMat(m.material); }); }   // a fehér Kenney-lemez rozsdásan
    ctx.statikus(g, 'kozep');
    ctx.utk.obb(-247, 128, 2.3, 3.6, 2.55); ctx.utk.obb(-297, 147, 2.4, 4.5, -1.25); ctx.utk.kor(-250.6, 150, 1.9); ctx.utk.kor(-305.3, 129.8, 1.6);
  }
  // a nyílt udvaron: gazba süllyedt borona és egy kerekét vesztett lovaskocsi (a téesz előtti időkből)
  {
    const g = new THREE.Group();
    { const b = new THREE.Group(), x = -259, z = 146.5; b.position.set(x, talaj(x, z) + 0.06, z); b.rotation.set(0.04, 0.45, -0.03); g.add(b);
      for (const q of [-0.75, -0.25, 0.25, 0.75]) doboz(b, 0, 0.05, q, 2.4, 0.06, 0.06, ROZSDA);
      for (const q of [-1.15, -0.55, 0, 0.55, 1.15]) doboz(b, q, 0.1, 0, 0.06, 0.06, 1.6, 0x6a3c26);
      for (const q of [-1.1, 0, 1.1]) doboz(b, q, -0.04, 0.82, 0.04, 0.16, 0.04, 0x4a3a2e);
      ctx.utk.obb(x, z, 2.4, 1.6, 0.45, 0.2); }
    { const k = new THREE.Group(), x = -233, z = 151, FA = 0x7d6a50, FA2 = 0x5e4e3a; k.position.set(x, talaj(x, z) - 0.3, z); k.rotation.set(-0.36, -0.7, 0, 'YXZ'); g.add(k);   // a kerék nélküli oldal a tengelyvégen fekszik
      for (let q = 0; q < 6; q++) doboz(k, 0, 0.82, -0.62 + q * 0.25, 3.0, 0.05, 0.22, q === 3 ? FA2 : FA);
      for (const s2 of [-1, 1]) { doboz(k, 0, 1.05, s2 * 0.74, 3.0, 0.4, 0.05, FA); doboz(k, 0, 0.7, s2 * 0.5, 3.0, 0.1, 0.1, FA2); }
      const kr = henger(k, 0.4, 0.62, 0.86, 0.62, 0.08, FA2, 14); kr.rotation.x = Math.PI / 2;
      henger(k, 0.4, 0.62, 0.86, 0.14, 0.14, 0x3a3a36, 8).rotation.x = Math.PI / 2;
      henger(g, x - 1.6, talaj(x - 1.6, z - 1.2) + 0.04, z - 1.2, 0.62, 0.08, FA2, 14);   // a leesett kerék a fűben
      const r = doboz(k, 2.6, 0.45, 0, 2.6, 0.08, 0.08, FA2); r.rotation.z = 0.32;
      ctx.utk.obb(x, z, 3.4, 1.9, -0.7, 1.2); }
    ctx.statikus(g, 'kozep');
  }
  // raklaprakások a csarnokelőn (egy raklap: három deszka, három talpgerenda), eltérő magasság és elfordulás
  {
    const g = new THREE.Group(), FA = 0x9a7a52, FA2 = 0x7d6244;
    const raklap = (p, y) => { for (const q of [-0.45, 0, 0.45]) doboz(p, 0, y + 0.06, q, 1.2, 0.1, 0.12, FA2); for (const q of [-0.5, -0.25, 0, 0.25, 0.5]) doboz(p, q, y + 0.135, 0, 0.1, 0.03, 1.0, FA); };
    for (const [lx, lz, n, r] of [[-12, 13.5, 5, 0.05], [-10.6, 13.8, 3, 0.25], [-11.4, 15.6, 1, 0.9], [9, 14.2, 4, -0.1]]) {
      const [x, z] = Wd(-284, 114, ry, lx, lz), p = new THREE.Group(); p.position.set(x, talaj(x, z) + 0.02, z); p.rotation.y = ry + r; g.add(p);
      for (let k = 0; k < n; k++) raklap(p, k * 0.15);
      ctx.utk.obb(x, z, 1.3, 1.1, ry + r, n * 0.15);
    }
    ctx.statikus(g, 'kozep');
  }
  // gázolajtartály két betonnyergen a B csarnok nyugati vége előtt, kiszolgáló lépcsővel és kútoszloppal
  {
    const x = -262.5, z = 158, r = ry, g = new THREE.Group(); g.position.set(x, talaj(x, z), z); g.rotation.y = r;
    for (const sx of [-1.8, 1.8]) doboz(g, sx, 0.4, 0, 0.5, 0.8, 1.6, BETON2);
    const t = henger(g, 0, 1.55, 0, 0.95, 5.6, 0x6c7468, 18); t.rotation.z = Math.PI / 2;
    for (const sx of [-2.8, 2.8]) { const v = henger(g, sx, 1.55, 0, 0.96, 0.08, 0x585e56, 18); v.rotation.z = Math.PI / 2; }
    for (const sx of [-1.2, 1.2]) { const v = henger(g, sx, 1.55, 0, 0.97, 0.1, ROZSDA, 18); v.rotation.z = Math.PI / 2; }
    henger(g, 0.6, 2.6, 0, 0.22, 0.25, 0x585e56, 10);
    doboz(g, 3.6, 0.65, 0.2, 0.3, 1.3, 0.3, 0x8a3a2a); doboz(g, 3.6, 1.35, 0.2, 0.36, 0.14, 0.36, 0x585e56);
    const c = henger(g, 3.2, 1.0, 0.2, 0.025, 1.0, 0x1a1a18, 6); c.rotation.z = 0.7;
    ctx.statikus(g, 'kozep'); ctx.utk.obb(x, z, 6.0, 2.2, r);
  }
  // silótér a silók előtt: két támfal, a maradék siló fekete fóliával letakarva, a fólián nehezéknek gumik
  {
    const x = -303, z = 166, r = ry, g = new THREE.Group(); g.position.set(x, talaj(x, z) - 0.05, z); g.rotation.y = r;
    for (const s2 of [-1, 1]) { doboz(g, 0, 1.1, s2 * 4.2, 20, 2.2, 0.4, BETON); doboz(g, 0, 2.24, s2 * 4.2, 20, 0.08, 0.5, BETON2); }
    doboz(g, -2, 0.05, 0, 20, 0.1, 8, BETON2);
    const f = henger(g, 1.5, 0.15, 0, 3.6, 13, 0x1e2220, 14); f.rotation.z = Math.PI / 2; f.scale.set(1.25, 13, 3.8);
    for (let k = 0; k < 9; k++) { const t = prop('car-kit/debris-tire', -4 + k * 1.45 + (R() - 0.5) * 0.4, 1.25 + (R() - 0.5) * 0.1, (R() - 0.5) * 3.2, 2.6, R() * 6, g); t.rotation.x = (R() - 0.5) * 0.25; }
    ctx.statikus(g, 'kozep');
    for (const s2 of [-1, 1]) { const [a, b] = Wd(x, z, r, 0, s2 * 4.2); ctx.utk.obb(a, b, 20, 0.5, r); }
    const [a, b] = Wd(x, z, r, 1.5, 0); ctx.utk.obb(a, b, 13, 6.4, r, 1.3);
  }
  // nyitott szín (kazal-szín) a bevezető út keleti oldalán: oszlopok, féloldalas hullámlemez tető, körbálák
  {
    const x = -214, z = 140, r = ry + Math.PI / 2, g = new THREE.Group(); g.position.set(x, talaj(x, z), z); g.rotation.y = r;
    const OS = 0x5e4a36, SZ = 0xb39a5c, SZ2 = 0x8f7a46;
    for (const lx of [-6, -2, 2, 6]) for (const [lz, h] of [[-3, 4.2], [3, 3.4]]) doboz(g, lx, h / 2, lz, 0.22, h, 0.22, OS);
    for (const [lz, h] of [[-3, 4.15], [3, 3.35]]) doboz(g, 0, h, lz, 12.4, 0.18, 0.18, OS);
    const tt = doboz(g, 0, 3.9, 0, 13, 0.06, 6.9, PALA); tt.rotation.x = Math.atan2(0.8, 6);
    const hi = doboz(g, 4.3, 3.95, -1.5, 3.2, 0.065, 3.3, 0x7a7a72); hi.rotation.x = Math.atan2(0.8, 6) + 0.02;   // kicserélt, fakóbb tábla
    const BALA = [[-4.5, 0, -1, 0], [-3.1, 0, -1, 0], [-1.7, 0, -1, 0], [-4.5, 0, 1.2, 0], [-3.1, 0, 1.2, 0], [-3.8, 1.25, -1, 0], [-2.4, 1.25, -1, 0], [-3.8, 1.25, 1.2, 0], [1.4, 0, 0.4, 1], [4.6, 0, -1.6, 0]];
    for (const [lx, ly, lz, k] of BALA) {
      const b = henger(g, lx, 0.62 + ly, lz, 0.62, 1.2, k ? SZ2 : SZ, 16); b.rotation.x = Math.PI / 2; if (k) b.rotation.z = 0.5;
      for (const e of [-0.61, 0.61]) { const v = henger(g, lx, 0.62 + ly, lz + e, 0.56, 0.02, SZ2, 16); v.rotation.x = Math.PI / 2; }
    }
    ctx.statikus(g, 'kozep');
    ctx.utk.obb(x, z, 6.4, 13, ry);
  }
  // trágyadomb / földkupac a szín mellett, betongyűrűk és terelőelemek a kapu közelében
  {
    const g = new THREE.Group();
    { const x = -224, z = 126, y = talaj(x, z); henger(g, x, y + 0.55, z, 3.2, 1.1, 0x5a4632, 12, 1.6); henger(g, x + 0.6, y + 1.3, z - 0.3, 1.6, 0.5, 0x4e3c2a, 10, 0.5); ctx.utk.kor(x, z, 2.6, 1.0); }
    for (const [x, z, ly] of [[-229.5, 105, 0], [-228.2, 106.1, 0], [-229.0, 105.5, 0.9], [-226.9, 104.6, 0]]) {
      const y = talaj(x, z) + ly; henger(g, x, y + 0.45, z, 0.68, 0.9, 0xa29d92, 16); henger(g, x, y + 0.455, z, 0.56, 0.91, 0x3a3832, 16);
    }
    ctx.utk.kor(-228.5, 105.4, 1.8);
    for (const [x, z, a] of [[-247.5, 100.5, 0.15], [-249.8, 101.2, 0.45], [-246.2, 103.4, 1.4]]) {
      const p = new THREE.Group(); p.position.set(x, talaj(x, z), z); p.rotation.y = a; g.add(p);
      doboz(p, 0, 0.15, 0, 2.0, 0.3, 0.6, 0xb4ad9c); doboz(p, 0, 0.55, 0, 2.0, 0.5, 0.3, 0xb4ad9c); doboz(p, 0, 0.84, 0, 2.0, 0.08, 0.2, 0xa8a196);
      doboz(p, -0.7, 0.55, 0.16, 0.3, 0.12, 0.02, 0xb8322a); doboz(p, 0.4, 0.55, 0.16, 0.3, 0.12, 0.02, 0xb8322a);
      ctx.utk.obb(x, z, 2.0, 0.6, a, 0.9);
    }
    ctx.statikus(g, 'kozep');
  }
  // reflektor a csarnok kapuja fölött: este ez jelzi a megvehető ingatlan bejáratát (az egyetlen fény az udvaron)
  { const [lx, lz] = vilagba(-284, 114, ry, -56 / 2 + 56 / 14 * 7.5, 8.75), g = new THREE.Group(); g.position.set(lx, A.y0 + 4.2, lz); g.rotation.y = ry;
    doboz(g, 0, 0, 0, 0.08, 0.08, 0.6, 0x2c3236); doboz(g, 0, -0.05, 0.32, 0.36, 0.2, 0.18, 0x3a4044);
    ctx.statikus(g, 'kozep'); ctx.lampa(lx, A.y0 + 4.0, lz + 0.4, 10, 'utca'); }
  // ---- őrbódé a bejáratnál, dőlt kerítés körben, kapuoszlopok
  { const x = -224, z = 102, y = talaj(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = 0.2;
    doboz(g, 0, 1.2, 0, 2.6, 2.4, 2.2, 0xb4ad9c); doboz(g, 0, 2.5, 0, 3.0, 0.16, 2.6, 0x6a665e);
    doboz(g, 1.31, 1.45, 0, 0.04, 0.8, 1.2, 0x2a2e30); doboz(g, 0, 1.0, 1.11, 0.9, 2.0, 0.04, 0x5a4636);
    ctx.statikus(g, 'kozep'); ctx.utk.obb(x, z, 2.7, 2.3, 0.2); }
  const kor = [[-200, 114], [-200, 182], [-336, 186], [-338, 96], [-200, 96]];
  for (let i = 0; i < kor.length - 1; i++) kerites(ctx, [kor[i], kor[i + 1]], 'torott', { kapu: i === 3 ? [[0, 0.62, 0.78]] : [], utk: true });
  for (const x of [-252, -229]) { const g = new THREE.Group(), y = talaj(x, 96); g.position.set(x, y, 96); doboz(g, 0, 1.3, 0, 0.5, 2.6, 0.5, BETON); ctx.statikus(g, 'kozep'); ctx.utk.kor(x, 96, 0.3); }
  // ---- gaz: ahol a valóságban nő — a falak tövében, a kerítés mentén, a beton szélén, a sarkokban sűrűbben, és
  // néhány elszórt hézag-szakaszban; a betontáblák közepén nem. (Korábban 7 m-es rácsra igazítva: „zöld rácsvonalak”.)
  const gaz = (x, z, s, tip) => { if (!ctx.utk.inside(x, z, 0.25)) ctx.szoro.addKlaszter(tip || (R() < 0.55 ? 'fu2' : R() < 0.75 ? 'fu' : 'bokor'), x, talaj(x, z), z, s, R() * 6); };
  const falTo = (cx, cz, r, L, W, n, kihagy) => {
    for (let q = 0; q < n; q++) {
      const side = Math.floor(R() * 4), t = R() - 0.5, off = 0.5 + R() * 0.7;
      const [lx, lz] = side < 2 ? [t * L, (side ? 1 : -1) * (W / 2 + off)] : [(side === 2 ? 1 : -1) * (L / 2 + off), t * W];
      if (kihagy && kihagy(lx, lz)) continue;
      const [x, z] = Wd(cx, cz, r, lx, lz); gaz(x, z, 0.5 + R() * 0.4);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let k = 0; k < 4; k++) {   // sarkok: bokor + magasabb gaz
      const [x, z] = Wd(cx, cz, r, sx * (L / 2 + 0.6 + R() * 1.4), sz * (W / 2 + 0.6 + R() * 1.4)); gaz(x, z, 0.7 + R() * 0.5, k === 0 ? 'bokor' : null);
    }
  };
  falTo(-284, 114, ry, 56, 16, 70, (lx, lz) => lz > 0 && Math.abs(lx - 2) < 5);   // a kapu előtt letaposva
  falTo(-238, 170, ry, 40, 12, 46);
  falTo(-303, 166, ry, 20, 8.8, 22);
  for (let i = 0; i < kor.length - 1; i++) {
    const [ax, az] = kor[i], [bx, bz] = kor[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let q = 0; q < L / 3.2; q++) { const t = R(); if (i === 3 && t > 0.58 && t < 0.82) continue; const o = (R() - 0.5) * 1.6; gaz(ax + (bx - ax) * t - (bz - az) / L * o, az + (bz - az) * t + (bx - ax) / L * o, 0.6 + R() * 0.5); }
    for (let k = 0; k < 5; k++) gaz(ax + (R() - 0.5) * 3, az + (R() - 0.5) * 3, 0.8 + R() * 0.4, k < 2 ? 'bokor' : null);
  }
  // hézag-szakaszok: néhány 1–3 m-es darab a csarnokelő hézagaiban (7 m-es táblák, helyi rács), nem az összes
  for (let q = 0; q < 14; q++) {
    const vert = R() < 0.5, k = Math.floor(R() * 8) - 4, t0 = (R() - 0.5) * 50, len = 1 + R() * 2;
    for (let u = 0; u < len; u += 0.5 + R() * 0.4) {
      const [lx, lz] = vert ? [k * 7, 9 + R() * 0.2 + (t0 + 25) / 50 * 10 + u] : [t0 + u, 13 + (k & 1) * 7];
      const [x, z] = Wd(-284, 114, ry, lx, lz); gaz(x, z, 0.35 + R() * 0.25, 'fu2');
    }
  }
  // fiatal fák és bokrok a sarkokban és a kerítés tövében (a nyílt udvaron nem)
  const FAK = [[-333, 99], [-331, 104], [-334, 182], [-327, 183], [-204, 179], [-207, 183], [-203, 117], [-312, 101], [-318, 99], [-262, 183], [-252, 181], [-216, 160]];
  for (const [fx, fz] of FAK) {
    const x = fx + (R() - 0.5) * 2, z = fz + (R() - 0.5) * 2;
    if (ctx.utk.inside(x, z, 1.2)) continue;
    ctx.szoro.add('nature-kit/' + (R() < 0.6 ? 'tree_small' : 'tree_tall'), x, talaj(x, z) - 0.05, z, 2.6 + R() * 1.6, R() * 6, { layer: 'fa' }); ctx.utk.kor(x, z, 0.3);
    gaz(x + 1, z + 0.6, 0.9, 'bokor');
  }
  ctx.horgony('major_regio', -270, 140, null, { tipus: 'regio' });
  return out;
}
