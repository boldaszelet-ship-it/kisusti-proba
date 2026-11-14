// Kisüsti — a világépítés közös állapota: kötegelő, szórás, ütközők, célpontok, horgonyok, címkék,
// éjjeli fények (lámpák, ablakok). Minden régióépítő ezt kapja.
import * as THREE from 'three';
import { Lod, Kotegelo, Szoro, Utkozok } from './kotegelo.js';
import { talaj } from './terep.js';
import { rng } from './adat.js';

export class Kontextus {
  constructor(scene) {
    this.scene = scene;
    this.lod = new Lod(scene);
    this.kot = new Kotegelo(this.lod);
    this.szoro = new Szoro(this.lod);
    this.utk = new Utkozok(16);
    this.interact = [];      // raycast-célpontok (userData.kind)
    this.anchors = {};       // id → Object3D (ingatlanok, üzletek, beszállítók, régiók)
    this.cimkek = [];        // {obj, text, off, size} — a UI teszi ki DOM-címkének
    this.lampak = [];        // {x, y, z, r, tipus} — éjjeli fényforrás (izzó + fénytócsa + fénykészlet)
    this.ablakok = [];       // {x, y, z, w, h, ry} — éjjel világító ablak
    this.fenyek = [];        // valódi PointLight-ok, amiket a napszak kapcsol (pl. a tanya kapulámpái)
    this.kemenyek = [];      // {x, y, z} — kéménytorok (a Grafika füstje innen száll)
    this.szokokutak = [];    // {x, y, z, meret} — vízsugár kiindulópontja
    this.frissitok = [];     // (dt, ido) => void — animált részek (malomkerék, füst stb.)
    this.arusok = [];        // {x, z, ry} — álló figurák helye (árus a stand mögött, kocsmáros); az NPC-rendszer tölti meg
    this.rnd = rng(20261113);
  }
  /** Statikus objektum: a jelenetbe kerül, és a végén a kötegelő összevonja. */
  statikus(obj, layer = 'epulet') { obj.userData.layer = layer; obj.userData.statikus = true; this.scene.add(obj); return obj; }
  /** Dinamikus (nem összevonható) objektum: cellánkénti szülőcsoportba kerül (a csoport távolról rejtett,
   *  a tárgy saját .visible-je érintetlen — a játéklogika szabadon kapcsolhatja). A csoport az origóban áll. */
  dinamikus(obj) { this.lod.cell('din', obj.position.x, obj.position.z).g.add(obj); return obj; }
  tag(obj, data) { obj.userData = { ...obj.userData, ...data }; obj.traverse(o => { o.userData.root = obj; }); this.interact.push(obj); return obj; }
  cimke(obj, text, off = 2, size = 15) { const L = { obj, text, off, size }; this.cimkek.push(L); return L; }
  horgony(id, x, z, y = null, data = {}) {
    const o = new THREE.Object3D(); o.name = 'horgony:' + id;
    o.position.set(x, y ?? talaj(x, z), z); o.userData = { horgony: id, ...data };
    this.scene.add(o); this.anchors[id] = o; return o;
  }
  lampa(x, y, z, r = 9, tipus = 'utca') { this.lampak.push({ x, y, z, r, tipus }); }
  ablak(x, y, z, w, h, ry) { this.ablakok.push({ x, y, z, w, h, ry }); }
  /** A végső összevonás: minden statikus objektum → kötegek. */
  veglegesit() {
    const list = this.scene.children.filter(o => o.userData.statikus);
    for (const o of list) this.kot.add(o, o.userData.layer);
    const nb = this.kot.build(), ni = this.szoro.build();
    return { kotegek: nb, peldanyhalok: ni, peldanyok: this.szoro.count, elemek: this.kot.n };
  }
}
