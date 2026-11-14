// Kisüsti — Node-betöltő a szereplő-építéshez: a böngésző importmap-jét utánozza ('three', 'three/addons/…' → vendor).
// Használat: node --import ./game/js/szereplok/node_three.js game/js/szereplok/atvitel.js …  (a tools/szereplo_epit.py hívja)
import { register } from 'node:module';
const VENDOR = new URL('../../vendor/three/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return next(${JSON.stringify(VENDOR + 'three.module.js')}, ctx);
  if (spec.startsWith('three/addons/')) return next(${JSON.stringify(VENDOR + 'addons/')} + spec.slice(13), ctx);
  return next(spec, ctx);
}`));
