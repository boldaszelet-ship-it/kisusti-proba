// Kisüsti — Nagyapa tanyája (0,0): az index.html v0.2-es udvara modulba emelve, ugyanazzal az elrendezéssel és
// interakciós célpontokkal (tag kind: house, cellar, well, still, barrel, fruit, market). A célzott tárgyak dinamikusak
// (raycastolhatók), a többi statikus (összevonva).
import * as THREE from 'three';
import { prop } from './betolto.js';
import { recolor, PAL, mat } from './paletta.js';
import { haz, kerites, doboz, henger, T } from './epulet.js';
import { talaj } from './terep.js';
import { loca } from '../szereplok/kiegeszitok.js';
import { DRINKS, TYPES, ft } from '../../sim.js';

export const ROAD_Z = 16.5;
export const GATE = new THREE.Vector3(0, 0, 13.4);
const FK = n => 'fantasy-town-kit/' + n;

function mesh(geo, m, x, y, z, parent) { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; parent.add(me); return me; }
/** Láthatatlan, de célozható gömb a kicsi tárgyak köré. */
export function hitProxy(parent, r, y = 0) {
  const h = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  h.position.y = y; parent.add(h); return h;
}
const FRUIT_MODEL = { szilva: ['food-kit/apple', PAL.szilva, [1, 1.12, 1]], barack: ['food-kit/apple', PAL.barack, [1, 1, 1]], korte: ['food-kit/pear', null, [1, 1, 1]] };
/** Gyümölcs (palettacserés alma/körte). */
export function fruitObj(ctx, t, x, y, z, s = 1.5, parent = null) {
  const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); else ctx.dinamikus(g);
  const [key, pal, sh] = FRUIT_MODEL[t];
  const m = prop(key, 0, -0.14, 0, sh.map(v => v * s), ctx.rnd() * 6, g); if (pal) recolor(m, pal);
  return g;
}

export function epitTanya(ctx) {
  const R = ctx.rnd, st = (o, l = 'kozep') => ctx.statikus(o, l);
  const S = { add: (...o) => o.forEach(x => (x.isLight ? ctx.scene.add(x) : ctx.dinamikus(x))) };   // a fények a jelenet gyökerében maradnak
  const out = { fruits: [], gateLights: [], piac: [] };

  // ---- ház: 3 × 2 rács, ajtó középen (az ajtóelem célozható, ezért külön), zsalugáteres ablakok
  const H = haz(ctx, {
    x: -8, z: -5.6, nx: 3, nz: 2, stilus: { fal: 'meszel', teto: 'cserep', fa: 'zold' },
    falak: { n: ['wall', 'wall-window-shutters', 'wall'], s: ['wall-window-shutters', null, 'wall-window-shutters'], w: ['wall-window-shutters', 'wall'], e: ['wall', 'wall-window-shutters'] },
    ablakFeny: 0.9,
  });
  // a falelem a cella közepéhez képest a szélén ül: a homlokzat középső cellájának közepe (-8, -4.3)
  const door = recolor(prop(FK('wall-door'), -8, H.y, -4.3, T, -Math.PI / 2), H.pal);
  S.add(door);
  ctx.tag(door, { kind: 'house' }); ctx.cimke(door, 'HÁZ', 2.4);
  out.door = door;
  { const g = new THREE.Group(); prop('furniture-kit/bench', -11.4, 0, -2.1, 2.4, 0, g); st(g); }
  // pinceajtó, kút
  const hatch = mesh(new THREE.BoxGeometry(1.6, 0.25, 1.2), mat(0x4a3320), -3.2, 0.12, -2.4, S);
  ctx.tag(hatch, { kind: 'cellar' }); ctx.cimke(hatch, 'PINCE', 0.8); out.hatch = hatch;
  const well = new THREE.Group(); well.position.set(-11, 0, 3); S.add(well);
  mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.9, 20), mat(0x8d8a83), 0, 0.45, 0, well);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), mat(0x5a3a1e), -0.7, 1.3, 0, well); mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), mat(0x5a3a1e), 0.7, 1.3, 0, well);
  const wr = mesh(new THREE.BoxGeometry(1.8, 0.08, 1.3), mat(0x7a3a24), 0, 2.25, 0, well); wr.rotation.z = 0.05;
  prop('survival-kit/bucket', 0.45, 0.9, 0.2, 3.2, 0, well);
  ctx.utk.kor(-11, 3, 0.8);
  ctx.tag(well, { kind: 'well' }); ctx.cimke(well, 'KÚT', 2.6); out.well = well;

  // ---- pajta: 3 × 2 rács, fa falak, elöl nyitott, deszkatető
  // a pajta padlószintje a lejtő legmagasabb sarka + 4 cm (epulet.js alap); minden, ami benne áll (üst, hordó, munkapad,
  // farakás, palackozó), ehhez kerül (out.pajtaY). 2026-11-14: lab: null = valóban nincs lábazat (addig 0,42 m-es betontömb volt).
  const pajta = haz(ctx, { x: 7, z: -7.2, nx: 3, nz: 2, fa: true, teto: 'nincs', kemeny: false, lab: null, ablakFeny: 0, utk: false,
    falak: { n: ['wall-wood', 'wall-wood-window-small', 'wall-wood'], s: [], w: ['wall-wood', 'wall-wood'], e: ['wall-wood', 'wall-wood'] } });
  ctx.utk.push({ x0: 3.1, x1: 10.9, z0: -9.8, z1: -9.55 }, { x0: 3.1, x1: 3.35, z0: -9.8, z1: -4.6 }, { x0: 10.65, x1: 10.9, z0: -9.8, z1: -4.6 });
  {
    out.pajtaY = pajta.y;
    const g = new THREE.Group(); g.position.y = pajta.y;
    const roof = doboz(g, 7, 2.75, -7.2, 8.3, 0.16, 5.9, 0x6b4a30); roof.rotation.x = -0.08;
    for (const x of [3.3, 10.7]) henger(g, x, 1.4, -4.75, 0.09, 2.8, 0x4a3420, 8);
    prop('nature-kit/log_stack', 4.3, 0, -9.0, 2.6, Math.PI / 2, g);
    prop('survival-kit/workbench', 9.7, 0, -5.4, 3.0, -Math.PI / 2, g);
    prop('survival-kit/tool-axe', 9.6, 0.88, -5.3, 2.4, 0.4, g);
    prop('survival-kit/barrel-open', 10.2, 0, -9.1, 3.4, 0, g);
    prop('food-kit/wine-red', 9.9, 0.88, -5.6, 1.1, 0, g);
    st(g);
  }
  // ---- üst (saját modell: a játék főszereplője)
  const still = new THREE.Group(); still.position.set(6.2, pajta.y, -7.6); S.add(still);
  const copper = new THREE.MeshStandardMaterial({ color: 0xc8763f, roughness: 0.35, metalness: 0.75 });
  mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), mat(0x5b5651), 0, 0.25, 0, still);
  mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.9, 20), copper, 0, 0.95, 0, still);
  mesh(new THREE.SphereGeometry(0.55, 20, 14), copper, 0, 1.42, 0, still).scale.y = 0.75;
  mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 20), copper, 0, 1.95, 0, still);
  const pipe = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 20), copper, 0.75, 2.12, 0, still); pipe.rotation.z = Math.PI / 2 - 0.15;
  mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 20), mat(0x6f747a), 1.55, 0.6, 0, still);
  mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 20), mat(0x2b2b2b), 0, 3.2, -0.5, still);
  ctx.utk.kor(6.2, -7.6, 0.9); ctx.utk.kor(7.75, -7.6, 0.45);
  ctx.tag(still, { kind: 'still' }); out.stillLbl = ctx.cimke(still, 'ÜST', 2.5); out.still = still;
  // a tűz fénye a jelenet gyökerében (ha a távolsági csoporttal együtt eltűnne, a fényszám változna: minden shader újrafordulna)
  const fire = new THREE.PointLight(0xff7a26, 0, 5, 1.5); fire.position.set(6.2, 0.35, -6.75); ctx.scene.add(fire); out.fire = fire;
  const fireGlow = mesh(new THREE.BoxGeometry(0.7, 0.18, 0.05), new THREE.MeshBasicMaterial({ color: 0xff6a1a }), 0, 0.22, 0.76, still);
  fireGlow.visible = false; out.fireGlow = fireGlow;
  // füst
  out.smoke = [];
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xcfcfcf, transparent: true, opacity: 0.35, depthWrite: false });
  const sg = new THREE.SphereGeometry(0.35, 8, 6);
  for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(sg, smokeMat.clone()); s.visible = false; s.userData.t = i / 18; S.add(s); out.smoke.push(s); }
  // hordó
  const barrel = new THREE.Group(); barrel.position.set(9.4, pajta.y, -7.9); S.add(barrel);
  prop('survival-kit/barrel', 0, 0, 0, 3.8, 0, barrel);
  ctx.utk.kor(9.4, -7.9, 0.5);
  ctx.tag(barrel, { kind: 'barrel' }); out.barrelLbl = ctx.cimke(barrel, 'HORDÓ', 1.7); out.barrel = barrel;

  // ---- gyümölcsfák (a gyümölcs célozható)
  const TREES = [{ x: -7, z: 5, t: 'szilva' }, { x: -2.5, z: 8.5, t: 'szilva' }, { x: 4.5, z: 6.5, t: 'barack' }];
  for (const Tr of TREES) {
    const g = new THREE.Group(); prop('nature-kit/tree_fat', Tr.x, 0, Tr.z, 3.3, R() * 6, g); st(g, 'epulet');
    ctx.utk.kor(Tr.x, Tr.z, 0.3);
    const anchor = new THREE.Object3D(); anchor.position.set(Tr.x, 0, Tr.z); S.add(anchor);
    ctx.cimke(anchor, { szilva: 'SZILVAFA', barack: 'BARACKFA' }[Tr.t], 4.2, 13);
    for (const a of [0.6, 2.7, 4.6]) {
      const f = fruitObj(ctx, Tr.t, Tr.x + Math.cos(a) * 1.2, 1.9 + R() * 0.35, Tr.z + Math.sin(a) * 1.1);
      hitProxy(f, 0.32);
      ctx.tag(f, { kind: 'fruit', tipus: Tr.t }); out.fruits.push(f);
    }
  }
  // a kerti asztal (a tor asztala is): a modell origója a sarka (helyi x 0…2,02, z −1,08…0). Körülötte valódi méretű
  // lócák a két hosszanti oldalon és a fejnél — az intró ülő vendégeinek csípője pontosan ezekre esik (tortenet/intro.js).
  // (2026-11-14: a Kenney-pad 2,4×-esen 1,1 m magas volt, az olajosüveg 50 cm-es — a tor babaháznak látszott.)
  { const g = new THREE.Group(); prop('furniture-kit/tableCloth', -9.4, 0, 8.2, 2.4, 0.2, g);
    const a = new THREE.Group(); a.position.set(-9.4, 0, 8.2); a.rotation.y = 0.2; g.add(a);
    for (const [x, z, h, ry] of [[1.01, -1.66, 2.5, 0], [1.01, 0.58, 2.5, 0], [-1.41, -0.54, 0.8, Math.PI / 2]]) { const l = loca(h); l.position.set(x, 0, z); l.rotation.y = ry; a.add(l); }
    st(g); }

  // ---- kerítés (elemekből), kapu lámpásokkal
  kerites(ctx, [[-14, -12], [14, -12]], 'deszka'); kerites(ctx, [[-14, -12], [-14, 12]], 'deszka'); kerites(ctx, [[14, -12], [14, 12]], 'deszka');
  kerites(ctx, [[-14, 12], [-2, 12]], 'deszka'); kerites(ctx, [[2, 12], [14, 12]], 'deszka');
  for (const x of [-2.3, 2.3]) {
    const g = new THREE.Group(); prop(FK('lantern'), x, 0, 12.2, 1.9, 0, g); st(g); ctx.utk.kor(x, 12.2, 0.2);
    const L = new THREE.PointLight(0xffc77a, 0, 9, 1.6); L.position.set(x, 2.75, 12.2); S.add(L); out.gateLights.push(L);
    ctx.fenyek.push({ light: L, ejjel: 14 });
  }
  const yardLamp = new THREE.PointLight(0xffd59a, 0, 22, 1.4); yardLamp.position.set(0, 3.6, -2.6); S.add(yardLamp);
  ctx.fenyek.push({ light: yardLamp, ejjel: 26 }); out.yardLamp = yardLamp;

  // ---- piac: két stand és egy szekér az út túloldalán (a szélesebb út miatt 0,8 m-rel délebbre)
  const PZ = 20.6;
  const MARKET = { szilva: [FK('stall-red'), 3.0], barack: [FK('cart'), 6.4], korte: [FK('stall-green'), 9.8] };
  for (const t of TYPES) {
    if (!MARKET[t]) continue;
    const [key, x] = MARKET[t];
    const sg2 = new THREE.Group(); sg2.position.set(x, talaj(x, PZ), PZ); S.add(sg2);
    prop(key, 0, 0, 0, key.endsWith('cart') ? 2.2 : 2.4, Math.PI, sg2);
    const top = key.endsWith('cart') ? 1.05 : 0.9;
    for (let k = 0; k < 5; k++) fruitObj(ctx, t, -0.7 + k * 0.35, top + 0.14, -0.55 + (k % 2) * 0.18, 1.3, sg2);
    ctx.utk.box(x - 1.2, x + 1.2, PZ - 1.2, PZ + 1.2);
    hitProxy(sg2, 1.0, 0.9);
    ctx.tag(sg2, { kind: 'market', tipus: t });
    ctx.cimke(sg2, `PIAC · ${DRINKS[t].gyumolcs}\n${ft(DRINKS[t].piac)} / 10 kg`, 3.2, 13);
    out.piac.push(sg2);
  }

  // ---- a szomszédok (a régi elrendezés helyén, de mind más: szín, tornác, kerítés, tájolás az út felé)
  haz(ctx, { x: -23.1, z: -3.4, nx: 3, nz: 2, stilus: { fal: 'kekes', teto: 'barna', fa: 'kek' }, tornac: 1.8, oromfa: true });
  haz(ctx, { x: 22.9, z: -3.4, nx: 4, nz: 2, stilus: { fal: 'okker', teto: 'cserep', fa: 'barna' }, lab: 'tegla' });
  haz(ctx, { x: -20.1, z: 28.6, ry: Math.PI, nx: 3, nz: 2, stilus: { fal: 'meszel', teto: 'moha', fa: 'zold' }, tornac: 1.6 });
  haz(ctx, { x: 21.6, z: 28.6, ry: Math.PI, nx: 3, nz: 2, stilus: { fal: 'rozsa', teto: 'cserep', fa: 'szurke' }, oromfa: true });
  kerites(ctx, [[-31, 22], [-10, 22]], 'lec', { kapu: [[0, 0.45, 0.6]] }); kerites(ctx, [[13, 22], [32, 22]], 'fal', { szin: 0xe8d6c0, kapu: [[0, 0.4, 0.55]] });
  kerites(ctx, [[-33, -12], [-33, 8]], 'lec'); kerites(ctx, [[34, -12], [34, 8]], 'drot');

  // ---- közvetlen környék: fák a kerítésen kívül, fűcsomók, virágok (az udvaron és az úton nincs)
  const outside = (x, z, m = 0) => (Math.abs(x) > 14.8 + m || z < -12.8 - m || z > 12.6 + m) && Math.abs(z - ROAD_Z) > 4.2 + m && !(z > 18 && z < 22.5 && x > 1 && x < 11.5);
  const houses = [[-23.1, -3.4, 6, 4], [22.9, -3.4, 7, 4], [-20.1, 28.6, 6, 4], [21.6, 28.6, 6, 4]];
  const nearHouse = (x, z) => houses.some(([hx, hz, w, d]) => Math.abs(x - hx) < w && Math.abs(z - hz) < d + 1.5);
  for (let k = 0, n = 0; n < 26 && k < 600; k++) {
    const x = (R() - 0.5) * 70, z = (R() - 0.5) * 70;
    if (!outside(x, z, 3) || Math.hypot(x, z) < 19 || nearHouse(x, z)) continue;
    ctx.szoro.add('nature-kit/' + ['tree_oak', 'tree_default', 'tree_fat'][n % 3], x, talaj(x, z) - 0.05, z, 4 + R() * 1.5, R() * 6, { layer: 'fa' }); n++;
  }
  for (let k = 0, n = 0; n < 90 && k < 3000; k++) {
    const x = (R() - 0.5) * 70, z = (R() - 0.5) * 70;
    if (!outside(x, z) || nearHouse(x, z)) continue;
    ctx.szoro.addKlaszter(['fu', 'fu2', 'virag', 'bokor', 'fu'][Math.floor(R() * 5)], x, talaj(x, z) - 0.03, z, 0.8 + R() * 0.4, R() * 6); n++;
  }
  for (const [x, z] of [[-13, -10.5], [-12.6, 10.6], [13, 10.8], [12.6, -10.6], [-1, -10.8], [1.5, 10.8]]) ctx.szoro.add('nature-kit/grass_large', x, 0, z, 2.6, R() * 6, { layer: 'kis', shadow: false });

  ctx.horgony('tanya', 0, 13.4, null, { tipus: 'ingatlan' });
  out.GATE = GATE; out.ROAD_Z = ROAD_Z;
  return out;
}
