// Kisüsti — a világ összerakása. Az integrátor ezt hívja:
//   const V = await epitVilag(scene, { onProgress });
//   V.update(dt, ora, kameraPozicio)  — napszak, LOD, animált részek
//   V.anchors[id], V.interact, V.cimkek, V.utk (ütközők), V.talaj(x,z), V.felulet(x,z), V.vizben(x,z), V.tanya.{still, barrel, …}
import * as THREE from 'three';
import { betolt, MODELS } from './betolto.js';
import { MODELLEK } from './modellek.js';
import { Kontextus } from './kontextus.js';
import { epitTerep, talaj, felulet, vizben, vizszint, HID } from './terep.js';
import { epitUtak, epitOszlopok } from './utak.js';
import { epitTanya } from './tanya.js';
import { epitFalu } from './falu.js';
import { epitFelveg } from './felveg.js';
import { epitSzolohegy } from './szolohegy.js';
import { epitMajor } from './major.js';
import { epitKisvaros } from './kisvaros.js';
import { epitNovenyzet } from './novenyzet.js';
import { Egbolt } from './eg.js';
import { REGIONS, PROPERTIES, BUSINESSES, SUPPLIERS, BOUNDS } from '../../data/regions.js';

export { talaj, felulet, vizben, vizszint, HID };

/** A régió, amelyben a pont van (a legközelebbi középpontú, amelynek sugarán belül van), vagy null. */
export function regioNal(x, z) {
  let best = null, bd = 1e9;
  for (const r of REGIONS) { const d = Math.hypot(x - r.center[0], z - r.center[1]); if (d < r.r * 1.15 && d < bd) { bd = d; best = r; } }
  return best;
}

/**
 * A teljes világ felépítése. o: {onProgress(fazis, kesz, osszes), arnyekMeret, fenyKeszlet}
 * Visszaad: {ctx, anchors, interact, cimkek, utk, tanya, eg, update, idok, stat}
 */
export async function epitVilag(scene, o = {}) {
  const T0 = performance.now(), idok = {};
  const lap = (nev) => { idok[nev] = Math.round(performance.now() - T0); };
  await betolt(MODELLEK, (k, n) => o.onProgress?.('modellek', k, n));
  lap('modellek');
  const ctx = new Kontextus(scene);
  const terep = epitTerep(scene); lap('terep');
  const utak = epitUtak(ctx); lap('utak');
  const tanya = epitTanya(ctx); lap('tanya');
  const regiok = {};
  for (const [nev, fn] of [['falu', epitFalu], ['felveg', epitFelveg], ['szolohegy', epitSzolohegy], ['major', epitMajor], ['kisvaros', epitKisvaros]]) {
    regiok[nev] = fn(ctx); lap(nev);
  }
  epitOszlopok(ctx); lap('oszlopok');
  const noveny = epitNovenyzet(ctx); lap('novenyzet');
  // hiányzó horgonyok: minden ingatlan, üzlet, beszállító és régió kap egy pontot (ha a régióépítő nem adott)
  for (const p of PROPERTIES) if (!ctx.anchors[p.id]) ctx.horgony(p.id, p.pos[0], p.pos[1], null, { tipus: 'ingatlan' });
  for (const p of BUSINESSES) if (!ctx.anchors[p.id]) ctx.horgony(p.id, p.pos[0], p.pos[1], null, { tipus: 'uzlet' });
  for (const p of SUPPLIERS) if (!ctx.anchors[p.id]) ctx.horgony(p.id, p.pos[0], p.pos[1], null, { tipus: 'beszallito' });
  for (const r of REGIONS) if (!ctx.anchors['regio:' + r.id]) ctx.horgony('regio:' + r.id, r.center[0], r.center[1], null, { tipus: 'regio' });
  const stat = ctx.veglegesit(); lap('osszevonas');
  const eg = new Egbolt(scene, ctx, o); lap('eg');
  stat.novenyzet = noveny;
  let lodT = 1;
  const camV = new THREE.Vector3();
  return {
    ctx, anchors: ctx.anchors, interact: ctx.interact, cimkek: ctx.cimkek, utk: ctx.utk, arusok: ctx.arusok, tanya, regiok, eg, utak, terep,
    talaj, felulet, vizben, regioNal, BOUNDS, idok, stat,
    /** dt: mp; ora: 0–24; cam: Vector3 (a kamera helye); camera: opcionális (a fénykoronák a kamera felé fordulnak) */
    update(dt, ora, cam, camera) {
      lodT += dt;
      if (lodT > 0.2) { lodT = 0; ctx.lod.update(cam, eg.ej > 0.5 ? 0.8 : 1); }
      if (camera) eg.kamera(camera);
      const r = eg.set(ora, cam, dt);
      for (const f of ctx.frissitok) f(dt, ora, cam);
      return r;
    },
    /** A LOD azonnali frissítése (teleport után). */
    lodMost(cam) { ctx.lod.update(cam, eg.ej > 0.5 ? 0.8 : 1); },
  };
}
export { MODELS };
