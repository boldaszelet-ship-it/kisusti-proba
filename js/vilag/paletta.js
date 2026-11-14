// Kisüsti — palettacsere a Kenney-textúrán (colormap.png). A szorzásos tint() a piros almát csak pirosas-lilára
// festi; a recolor() valódi célszínt ad, a textúra fényerő-árnyalatát megtartva.
import * as THREE from 'three';

// pixelpróbák (a Kenney-paletták színcsoportjai, uvszin-méréssel azonosítva 2026-11-13)
export const isRed = (r, g, b) => r > 150 && r > g + 70 && r > b + 70;                 // alma héja, piros karosszéria
export const isTeal = (r, g, b) => g > r + 50 && g > b + 8;                            // zöldeskék cserép, zöld tető/karosszéria
export const isLavender = (r, g, b) => b > r + 15 && b > g + 10 && r > 110;            // lilás vakolat (fantasy-kit)
export const isWhite = (r, g, b) => r > 196 && g > 196 && b > 196 && b - r < 22;       // fehér fal (city-kit)
export const isSlate = (r, g, b) => r > 80 && r < 100 && b > r + 18 && b < 130;        // palaszürke (city-kit tető, lábazat)
export const isWood = (r, g, b) => r > 140 && r - g > 40 && g - b > 28 && g < 150 && !(r < 165 && g < 100);   // fa keret, zsalu (fantasy-kit, betöltéskor barnított)
export const isWoodWall = (r, g, b) => r > 125 && r < 165 && r - g > 45 && g - b > 12 && g < 100; // deszkafal
export const isBlue = (r, g, b) => b > r + 60 && b > g + 30;                           // kék karosszéria, a fantasy-tető gerince

/** Falszínek (a magyar falu: meszelt fehér, okker, „Mária Terézia-sárga”, halvány rózsa, kékítős fehér, zöldes). */
export const FAL = {
  meszel: [236, 228, 208], kekes: [214, 224, 232], okker: [226, 184, 116], sarga: [240, 212, 132],
  rozsa: [230, 182, 162], zold: [190, 206, 170], szurke: [184, 182, 176], barack: [238, 196, 150],
  tegla: [168, 90, 62], kopott: [196, 186, 166],
};
/** Tetőszínek. */
export const TETO = {
  cserep: [178, 74, 44], barna: [126, 70, 46], pala: [82, 86, 96], moha: [118, 98, 72], piros: [192, 64, 46],
  hullam: [150, 152, 148], sotet: [70, 58, 52],
};
/** Fa (zsalu, keret, tornácoszlop) színek. */
export const FA = { barna: [150, 96, 62], zold: [70, 112, 74], kek: [70, 104, 140], szurke: [128, 120, 110], vilagos: [196, 150, 100] };

const base = c => c;   // a célszín (r,g,b) — a forrás fényereje adja az árnyalatot

/** Palettaszabály-készítők kitenként. Visszaad: {nev, rules}. */
export function palFantasy(fal = 'meszel', teto = 'cserep', fa = null) {
  const r = [[isTeal, TETO[teto], [86, 180, 156]], [isLavender, FAL[fal], [160, 168, 201]]];
  if (fa) r.push([isWood, FA[fa], [170, 120, 82]]);
  return { nev: `ft:${fal}:${teto}:${fa || '-'}`, rules: r };
}
/** Tetőelemek palettája: a cserép (türkiz) és a gerinc kékje a tetőszínre, az alsó (lilás) deszka sötét fára. */
export function palTeto(teto = 'cserep') {
  const c = TETO[teto], d = c.map(v => Math.round(v * 0.72));
  return { nev: `tt:${teto}`, rules: [[isTeal, c, [86, 180, 156]], [isBlue, c.map(v => Math.round(v * 0.9)), [103, 148, 217]], [(r, g, b) => b > r + 8 && b > g + 6, [92, 66, 48], [125, 130, 156]]] };
}
export function palCity(fal = 'okker', teto = 'cserep', lab = null) {
  const r = [[isTeal, TETO[teto], [79, 184, 130]], [isWhite, FAL[fal], [222, 222, 234]]];
  if (lab) r.push([isSlate, TETO[lab], [90, 95, 119]]);
  return { nev: `ck:${fal}:${teto}:${lab || '-'}`, rules: r };
}
export const PAL = {
  szilva: { nev: 'szilva', rules: [[isRed, [92, 44, 150], [244, 103, 67]]] },          // hamvas kéklila
  barack: { nev: 'barack', rules: [[isRed, [250, 158, 62], [244, 103, 67]]] },         // narancssárga
  cserep: { nev: 'cserep', rules: [[isTeal, [178, 74, 44], [69, 160, 135]], [isLavender, [96, 66, 46], [125, 130, 156]]] },
  meszel: { nev: 'meszel', rules: [[isLavender, [236, 228, 208], [173, 181, 217]]] },
};

const cache = new Map();
/** Palettacsere: a Kenney-textúra adott színcsoportjának pixeleit kicseréli, a fényerő-árnyalatot megtartja.
 *  pal: {nev, rules:[[pixelpróba(r,g,b), [cél r,g,b], [alap r,g,b]]]} — az alapszín fényereje adja a 100%-ot.
 *  Anyagonként és palettánként egyszer számol; az eredmény közös anyag (a kötegelő így összevonhatja). */
export function recolor(o, pal, rulesCompat) {
  if (typeof pal === 'string') pal = { nev: pal, rules: rulesCompat };
  o.traverse(m => {
    if (!m.isMesh || !m.material.map) return;
    m.material = recolorMaterial(m.material, pal);
  });
  return o;
}
export function recolorMaterial(src, pal) {
  const key = pal.nev + '|' + src.uuid;
  if (cache.has(key)) return cache.get(key);
  const img = src.map.image;
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    for (const [test, to, bs] of pal.rules) {
      if (!test(r, g, b)) continue;
      const k = Math.min(1.35, (r + g + b) / (bs[0] + bs[1] + bs[2]));
      p[i] = Math.min(255, to[0] * k); p[i + 1] = Math.min(255, to[1] * k); p[i + 2] = Math.min(255, to[2] * k);
      break;
    }
  }
  cx.putImageData(d, 0, 0);
  // a Texture.clone() a Source-ot közösen tartja: új Source kell, különben az utolsó palettacsere minden textúrát felülír
  const tex = src.map.clone(); tex.source = new (THREE.TextureSource || THREE.Source)(cv); tex.needsUpdate = true;
  const mt = src.clone(); mt.map = tex; mt.userData = { ...src.userData, pal: pal.nev };
  cache.set(key, mt);
  return mt;
}

/** Színezés szorzással (a gyümölcsfajtákhoz régen ezt használtuk; csak egyszerű esetekre). */
export function tint(o, color) { o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.set(color); } }); return o; }

const matCache = new Map();
/** Közös egyszínű anyag (szín + érdesség szerint gyorsítótárazva, hogy a kötegelő összevonhassa). */
export function mat(c, o = {}) {
  const key = c + '|' + JSON.stringify(o);
  if (!matCache.has(key)) {
    // fémes / érdesség-függő anyag marad Standard; a többi Lambert (olcsóbb árnyalás, gyorsabb fordítás),
    // és a kötegelő csúcsszínként vonja össze (egy rajzhívás sok színre)
    const std = o.metalness || (o.roughness != null && o.roughness < 0.6) || o.emissive;
    const { roughness, metalness, ...lo } = o;
    const m = std ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o }) : new THREE.MeshLambertMaterial({ color: c, ...lo });
    if (!std && !o.transparent) m.userData.vc = 'lambert';
    matCache.set(key, m);
  }
  return matCache.get(key);
}
export const rgb = a => (a[0] << 16) | (a[1] << 8) | a[2];
