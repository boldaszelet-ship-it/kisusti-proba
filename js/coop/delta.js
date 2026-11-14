// Kisüsti coop — állapotdelta. Tiszta függvények (DOM nélkül, Node alatt is fut).
//
// A host nem a 35 KB-os `E.state` nézetet küldi, hanem a mentés nyers adatát ({s, core}), és abból is csak a változást:
// a kliens így ugyanazt az `Empire`-t tudja helyben, árnyékként tartani, és MINDEN olvasó metódus (mixPreview, value,
// recipes, state…) szinkron, pontosan, hálózat nélkül válaszol.
//
//   const alap = klonoz(elo);                 // host: az utoljára elküldött állapot
//   const ops = kulonbseg(elo, alap);         // host: a változások; az `alap` közben az élőhöz igazodik
//   alkalmaz(tukor, ops);                     // kliens: ugyanaz a változás a tükrön
//
// Műveletek (tömör JSON):
//   [ut, ertek]            beállítás          [ut]               kulcs törlése
//   [ut, k, 's']           tömb elejéről k elem le (pl. az SMS-lista 250-nél vág)
//   [ut, n, 'l']           tömb csonkítása n hosszra
//   [ut, [elemek], 'a']    tömb végére fűzés
// Az `ut` '/'-rel tagolt kulcslánc (a kulcsban a '~' → '~0', a '/' → '~1', mint a JSON Pointerben).
//
// Számok: PONTOSAN mennek (kerekítés nélkül), hogy a tükörből számolt származtatott érték (pl. a tétel ára) fillérre
// ugyanaz legyen, mint a hoston (mérve: 4 tizedesre kerekítve 21 099 ≠ 21 100 Ft). Törtszámot csak akkor küldünk újra,
// ha legalább TURES-nyit változott: a lassan csorgó mezők (a fák vize, termése) így nem mennek minden tickben, és a
// tükörben legfeljebb ennyivel maradnak le. A tűrés ABSZOLÚT: relatív tűréssel a 15 000 perces óra 1,5 percet csúszott.

export const TURES = 1e-3;   // 0,001 perc, 0,001 Ft, 1 ml, 0,001 víz

const kerekit = x => x;

/** Mély másolat kerekített törtszámokkal (az `undefined` mezők kimaradnak, mint a JSON-ban). */
export function klonoz(v) {
  if (typeof v === 'number') return kerekit(v);
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => (x === undefined ? null : klonoz(x)));
  const o = {};
  for (const k in v) { const x = v[k]; if (x !== undefined && typeof x !== 'function') o[k] = klonoz(x); }
  return o;
}

const szamEgyezik = (a, b) => {
  if (a === b) return true;
  if (Number.isInteger(a) && Number.isInteger(b)) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Object.is(a, b);
  return Math.abs(a - b) <= TURES;
};
const kulcsKod = k => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
const kulcsDekod = k => k.replace(/~1/g, '/').replace(/~0/g, '~');
const objektum = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Ugyanaz az elem-e (a tömb-eltolás felismeréséhez): azonosítós objektumnál az id dönt, különben a JSON. */
function azonos(a, b) {
  if (objektum(a) && objektum(b) && a.id !== undefined) return a.id === b.id;
  return JSON.stringify(a) === JSON.stringify(klonoz(b));
}

/** A különbség az `elo` és az `alap` között; az `alap`-ot helyben az élőhöz igazítja. */
export function kulonbseg(elo, alap, ut = '', ops = []) {
  for (const k in elo) {
    const a = elo[k];
    if (a === undefined || typeof a === 'function') continue;
    const p = ut + kulcsKod(k);
    if (!(k in alap)) { const c = klonoz(a); alap[k] = c; ops.push([p, c]); continue; }
    ertekKul(a, alap, k, p, ops);
  }
  for (const k in alap) {
    if (elo[k] === undefined || typeof elo[k] === 'function') { delete alap[k]; ops.push([ut + kulcsKod(k)]); }
  }
  return ops;
}

function ertekKul(a, szulo, k, p, ops) {
  const b = szulo[k];
  if (typeof a === 'number' && typeof b === 'number') {
    if (!szamEgyezik(a, b)) { const c = kerekit(a); szulo[k] = c; ops.push([p, c]); }
  } else if (objektum(a) && objektum(b)) {
    kulonbseg(a, b, p + '/', ops);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    tombKul(a, b, p, ops);
  } else if (a !== b) {
    const c = klonoz(a === undefined ? null : a); szulo[k] = c; ops.push([p, c]);
  }
}

function tombKul(a, b, p, ops) {
  // eltolás: az élő tömb eleje az alap k-adik eleme (az SMS-lista vágása, az összesítők shift-je)
  if (a.length && b.length > 1 && !azonos(a[0], b[0])) {
    for (let k = 1; k <= Math.min(16, b.length - 1); k++) {
      if (azonos(a[0], b[k])) { b.splice(0, k); ops.push([p, k, 's']); break; }
    }
  }
  if (a.length < b.length) { b.length = a.length; ops.push([p, a.length, 'l']); }
  const n = b.length;
  for (let i = 0; i < n; i++) ertekKul(a[i] === undefined ? null : a[i], b, i, p + '/' + i, ops);
  if (a.length > n) { const uj = a.slice(n).map(x => (x === undefined ? null : klonoz(x))); b.push(...uj); ops.push([p, uj, 'a']); }
}

/** A műveletsor alkalmazása a tükrön. `kihagy(ut)` → true: az adott utat nem írjuk (pl. a saját bérelt üst). */
export function alkalmaz(gyoker, ops, kihagy = null) {
  for (const op of ops) {
    const ut = op[0];
    if (kihagy && kihagy(ut)) continue;
    const reszek = ut.split('/').map(kulcsDekod);
    let o = gyoker;
    for (let i = 0; i < reszek.length - 1; i++) {
      o = o[reszek[i]];
      if (o === undefined || o === null) throw new Error(`delta: nincs ilyen út a tükörben: ${ut}`);
    }
    const k = reszek[reszek.length - 1];
    if (op.length === 1) { if (Array.isArray(o)) o[k] = null; else delete o[k]; continue; }
    if (op.length === 3) {
      const t = o[k];
      if (!Array.isArray(t)) throw new Error(`delta: nem tömb: ${ut}`);
      if (op[2] === 's') t.splice(0, op[1]);
      else if (op[2] === 'l') t.length = op[1];
      else if (op[2] === 'a') t.push(...op[1]);
      continue;
    }
    o[k] = op[1];
  }
}

/** Két állapot eltérése a tűrésen belül (próbához): az első eltérő út, vagy null. */
export function elteres(a, b, ut = '') {
  if (typeof a === 'number' && typeof b === 'number') return szamEgyezik(a, b) ? null : `${ut}: ${a} ≠ ${b}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${ut}: hossz ${a.length} ≠ ${b.length}`;
    for (let i = 0; i < a.length; i++) { const e = elteres(a[i], b[i], ut + '/' + i); if (e) return e; }
    return null;
  }
  if (objektum(a) && objektum(b)) {
    const kulcsok = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of kulcsok) {
      if (a[k] === undefined && b[k] === undefined) continue;
      const e = elteres(a[k] ?? null, b[k] ?? null, ut + '/' + k); if (e) return e;
    }
    return null;
  }
  return a === b ? null : `${ut}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}
