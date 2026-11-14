// Kisüsti — tartalom-id → figura. Minden vevőnek (data/tartalom.js VEVOK_TELJES, 44), terjesztőnek (TERJESZTOK, 7),
// alkalmazott-szerepnek (SZEREPEK), besúgónak (BESUGOK), beszállítónak (SUPPLIERS) és a pénzügyőrnek saját figura.
// Mező: nem f/n · kor fiatal/kozep/idos · alkat vekony/atlag/testes/pocakos · ruha (katalogus.js RUHAK) · haj (HAJAK)
// · bajusz kefe/konya · kalap svajci/kalap/tanyer · szemuveg · kendo · melleny · koteny · szinek {szerep: 0xRRGGBB}.
// Sziluett-szabály: a fajtákat a forma különbözteti meg, nem a szín — néni: kendő + otthonka + kötény, görnyedt;
// bácsi: svájcisapka/kalap + mellény + bajusz, görnyedt; városi: öltöny, fedetlen fej, egyenes; pénzügyőr: tányérsapka
// + zubbony, egyenes, hivatalos járás; fiatal: póló/pulóver, vékony, egyenes.

const H = { fekete: 0x231c18, barna: 0x4a3222, gesztenye: 0x6a3f24, szoke: 0xb08d58, voros: 0x8a3a1e, oszes: 0x8a8580, osz: 0xb9b5ae, feher: 0xdedbd4 };

export const KIOSZTAS = {
  // ------------------------------------------------ tanya és a kezdő hét
  kovacs: { nem: 'f', kor: 'idos', alkat: 'pocakos', ruha: 'kantaros', haj: 'rovid', bajusz: 'konya', kalap: 'svajci', szinek: { haj: H.osz, felso: 0x7a5a3e, also: 0x3d4f66, kalap: 0x2a2826 } },
  marika: { nem: 'n', kor: 'idos', alkat: 'testes', ruha: 'otthonka', haj: 'konty', kendo: true, szemuveg: true, szinek: { haj: H.osz, felso: 0x8a6a8a, ov: 0x8a6a8a, kendo: 0x2f4a7a, koteny: 0xe6dccb } },
  bozsi: { nem: 'n', kor: 'idos', alkat: 'testes', ruha: 'ruha', haj: 'konty', szemuveg: true, szinek: { haj: H.feher, felso: 0x3e3a4e, ov: 0x2a2630 } },
  tibi: { nem: 'f', kor: 'fiatal', alkat: 'vekony', ruha: 'pulover', haj: 'tuskes', szinek: { haj: H.barna, felso: 0x2f3f5a, also: 0x2a2e36, cipo: 0xd8d4cc, cipo2: 0xe8e4dc } },
  lajos: { nem: 'f', kor: 'kozep', alkat: 'pocakos', ruha: 'oltony', haj: 'rovid', bajusz: 'kefe', kalap: 'kalap', szinek: { haj: H.fekete, felso: 0x5a4030, also: 0x5a4030, nyakkendo: 0xa02a2a, kalap: 0x3a2e24, kalap2: 0xa02a2a } },
  kocsmaros: { nem: 'f', kor: 'kozep', alkat: 'pocakos', ruha: 'triko', haj: 'oldalt', bajusz: 'kefe', koteny: true, szinek: { haj: H.oszes, felso: 0xe0dccf, also: 0x3a3634, koteny: 0x6a4a34 } },
  orvos: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'ing', haj: 'oldalt', szemuveg: true, melleny: true, szinek: { haj: H.oszes, felso: 0xe8e6e0, melleny: 0x5a6070, also: 0x50545c } },
  sogor: { nem: 'f', kor: 'kozep', alkat: 'testes', ruha: 'oltony', haj: 'oldalt', szinek: { haj: H.fekete, felso: 0x585c64, also: 0x585c64, nyakkendo: 0x2a4a7a } },
  piroska: { nem: 'n', kor: 'kozep', alkat: 'atlag', ruha: 'polo', haj: 'felhosszu', szinek: { haj: H.gesztenye, felso: 0x3f5f8a, also: 0x2a3448 } },
  // ------------------------------------------------ falu
  pista: { nem: 'f', kor: 'idos', alkat: 'atlag', ruha: 'ing', haj: 'rovid', bajusz: 'konya', kalap: 'svajci', melleny: true, szinek: { haj: H.feher, felso: 0x9aa4b0, melleny: 0x1f2a3a, kalap: 0x1f2a3a, also: 0x2a3040 } },
  jolan: { nem: 'n', kor: 'kozep', alkat: 'testes', ruha: 'kosztum', haj: 'konty', szemuveg: true, szinek: { haj: H.barna, felso: 0x6a2a3a, also: 0x6a2a3a } },
  gabor: { nem: 'f', kor: 'kozep', alkat: 'testes', ruha: 'pulover', haj: 'rovid', szinek: { haj: H.barna, felso: 0x9a2a2a, also: 0x22262e } },
  dezso: { nem: 'f', kor: 'kozep', alkat: 'pocakos', ruha: 'triko', haj: 'bajszos', koteny: true, szinek: { haj: H.fekete, bor: 0xd49a7a, felso: 0xd9d4c4, also: 0x3a3634, koteny: 0xd8d0c0 } },
  ica: { nem: 'n', kor: 'fiatal', alkat: 'vekony', ruha: 'polo', haj: 'hosszu', szinek: { haj: H.szoke, felso: 0xc87a8a, also: 0x3a4a6a } },
  sanyi: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'ing', haj: 'oldalt', bajusz: 'kefe', melleny: true, szinek: { haj: H.fekete, felso: 0xece8e0, melleny: 0x1c1c20, also: 0x1c1c20 } },
  kati: { nem: 'n', kor: 'kozep', alkat: 'vekony', ruha: 'kosztum', haj: 'felhosszu', szemuveg: true, szinek: { haj: H.barna, felso: 0x5a6a7a, also: 0x3a4250 } },
  // ------------------------------------------------ Felvég
  irma: { nem: 'n', kor: 'idos', alkat: 'atlag', ruha: 'otthonka', haj: 'konty', kendo: true, szinek: { haj: H.osz, felso: 0x9a5a5a, ov: 0x9a5a5a, kendo: 0x3a5a3a } },
  bandi: { nem: 'f', kor: 'idos', alkat: 'vekony', ruha: 'kantaros', haj: 'szalmakalap', bajusz: 'kefe', szinek: { haj: H.osz, felso: 0x9a9070, also: 0x4a5a3a } },
  gizi: { nem: 'n', kor: 'idos', alkat: 'testes', ruha: 'ruha', haj: 'konty', szemuveg: true, szinek: { haj: H.feher, felso: 0x6a4a7a, ov: 0x3a2a40 } },
  laci: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'ing', haj: 'oldalt', szemuveg: true, szinek: { haj: H.barna, felso: 0x5f86a8, also: 0xb8a888, cipo: 0x8a6a4a } },
  margit: { nem: 'n', kor: 'kozep', alkat: 'vekony', ruha: 'tunika', haj: 'osz_hosszu', szinek: { haj: H.osz, felso: 0x5b6e4a, also: 0x3a3a30 } },
  ferenc: { nem: 'f', kor: 'idos', alkat: 'vekony', ruha: 'oltony', haj: 'osz_szakall', szemuveg: true, szinek: { haj: H.feher, felso: 0x6a5a44, also: 0x4a4034, nyakkendo: 0x3a4a3a } },
  zoli: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'zold_ing', haj: 'rovid', bajusz: 'kefe', kalap: 'kalap', szinek: { haj: H.barna, kalap: 0x4a5a3a, kalap2: 0x2a3424 } },
  eva: { nem: 'n', kor: 'fiatal', alkat: 'vekony', ruha: 'ruha', haj: 'hosszu', szinek: { haj: H.gesztenye, felso: 0x5a7aa8, ov: 0x2a3a5a } },
  // ------------------------------------------------ Szőlőhegy
  kalman: { nem: 'f', kor: 'kozep', alkat: 'pocakos', ruha: 'ing', haj: 'oldalt', bajusz: 'konya', kalap: 'kalap', melleny: true, szinek: { haj: H.oszes, felso: 0xe0dcd0, melleny: 0x2a3a2a, also: 0x2a2a2a, kalap: 0x2a2622, kalap2: 0x4a2a2a } },
  rozi: { nem: 'n', kor: 'idos', alkat: 'testes', ruha: 'otthonka', haj: 'konty', kendo: true, szinek: { haj: H.osz, felso: 0x7a8a5a, ov: 0x7a8a5a, kendo: 0x8a2f3a } },
  akos: { nem: 'f', kor: 'fiatal', alkat: 'vekony', ruha: 'zold_ing', haj: 'hosszu_szakall', szinek: { haj: H.gesztenye, felso: 0x8a5a3a, felso2: 0x6a4a30, also: 0x4a5a5a } },
  titkar: { nem: 'f', kor: 'kozep', alkat: 'testes', ruha: 'zold_ing', haj: 'rovid', bajusz: 'kefe', kalap: 'kalap', szinek: { haj: H.oszes, felso: 0x4a5a3a, felso2: 0x3a4a2e, kalap: 0x3a4a2e, kalap2: 0x6a5a3a } },
  otto: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'ing', haj: 'oldalt', melleny: true, szinek: { haj: H.fekete, felso: 0xf0ece4, melleny: 0x6a2a34, also: 0x24242a } },
  tercsi: { nem: 'n', kor: 'kozep', alkat: 'testes', ruha: 'otthonka', haj: 'konty', kendo: true, szinek: { haj: H.barna, felso: 0xa87a5a, ov: 0xa87a5a, kendo: 0xe8e0d0, koteny: 0xf0ece4 } },
  // ------------------------------------------------ Major
  geza: { nem: 'f', kor: 'idos', alkat: 'pocakos', ruha: 'oltony', haj: 'rovid', bajusz: 'konya', kalap: 'kalap', szinek: { haj: H.osz, felso: 0x5a5444, also: 0x4a4638, nyakkendo: 0x5a2a2a, kalap: 0x3a3630 } },
  bence: { nem: 'f', kor: 'kozep', alkat: 'vekony', ruha: 'ing', haj: 'hosszu_szakall', kalap: 'kalap', melleny: true, szinek: { haj: H.barna, felso: 0xd8d0c0, melleny: 0x9a8a6a, also: 0x3a3428, kalap: 0x2a2420, kalap2: 0x2a2420 } },
  szabina: { nem: 'n', kor: 'kozep', alkat: 'vekony', ruha: 'polo', haj: 'barna_hosszu', szinek: { haj: H.barna, felso: 0x3a4a5a, also: 0xc9b89a, cipo: 0x3a2a1e } },
  pityu: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'munkas', haj: 'bajszos', szinek: { haj: H.oszes, felso: 0x5a6a80, melleny: 0x2f4058, mellenycsik: 0x2f4058, also: 0x2f4058 } },
  terez: { nem: 'n', kor: 'idos', alkat: 'vekony', ruha: 'otthonka', haj: 'konty', kendo: true, szinek: { haj: H.feher, felso: 0x4a4a5a, ov: 0x4a4a5a, kendo: 0x23232c, koteny: 0x6a6a72 } },
  // ------------------------------------------------ Kisváros
  dominik: { nem: 'f', kor: 'fiatal', alkat: 'vekony', ruha: 'ing', haj: 'hosszu_szakall', szemuveg: true, szinek: { haj: H.fekete, felso: 0x2a2a2e, also: 0x3a3e4a, cipo: 0xe0dcd4, cipo2: 0xe0dcd4 } },
  szeles: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'oltony', haj: 'oldalt', szemuveg: true, szinek: { haj: H.oszes, felso: 0x2a3448, also: 0x2a3448, nyakkendo: 0x8a6a2a } },
  margo: { nem: 'n', kor: 'kozep', alkat: 'testes', ruha: 'ruha', haj: 'barna_rovid', koteny: true, szinek: { haj: H.voros, felso: 0x4a6a8a, ov: 0x4a6a8a, koteny: 0xe8e4d8 } },
  klari: { nem: 'n', kor: 'kozep', alkat: 'testes', ruha: 'kosztum', haj: 'konty', szinek: { haj: H.gesztenye, felso: 0x8a4a6a, also: 0x8a4a6a, ing: 0xf0e8e0 } },
  viktor: { nem: 'f', kor: 'fiatal', alkat: 'atlag', ruha: 'pulover', haj: 'gondor', szemuveg: true, szinek: { haj: H.barna, felso: 0x5a6a5a, also: 0x3a3e48 } },
  patikus: { nem: 'f', kor: 'idos', alkat: 'vekony', ruha: 'ing', haj: 'oldalt', szemuveg: true, melleny: true, szinek: { haj: H.feher, felso: 0xf0f0ec, melleny: 0x6a6e74, also: 0x4a4e56 } },
  robi: { nem: 'f', kor: 'kozep', alkat: 'pocakos', ruha: 'oltony', haj: 'rovid', szinek: { haj: H.fekete, felso: 0x3a3a3e, also: 0x3a3a3e, ing: 0x2a2a2e, nyakkendo: 0xb89a4a } },
  panni: { nem: 'n', kor: 'fiatal', alkat: 'vekony', ruha: 'polo', haj: 'bubi', szinek: { haj: H.fekete, felso: 0x7a9a6a, also: 0x3a3a4a } },
  ilonka: { nem: 'n', kor: 'idos', alkat: 'testes', ruha: 'otthonka', haj: 'konty', kendo: true, szinek: { haj: H.osz, felso: 0x5f8a7a, ov: 0x5f8a7a, kendo: 0x9a6a2a } },
  // ------------------------------------------------ terjesztők
  postas: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'ing', haj: 'rovid', bajusz: 'kefe', kalap: 'svajci', szinek: { haj: H.barna, felso: 0x3f5f8a, also: 0x2a3448, kalap: 0x2a3448 } },
  buszsofor: { nem: 'f', kor: 'kozep', alkat: 'pocakos', ruha: 'ing', haj: 'rovid', szemuveg: true, szinek: { haj: H.oszes, felso: 0x8aa8c8, also: 0x2e3440 } },
  hentes: { nem: 'f', kor: 'kozep', alkat: 'pocakos', ruha: 'triko', haj: 'bajszos', koteny: true, szinek: { haj: H.fekete, bor: 0xdba080, felso: 0xe8e4dc, also: 0x3a3a3a, koteny: 0xe8e4dc } },
  fodrasz: { nem: 'n', kor: 'kozep', alkat: 'atlag', ruha: 'polo', haj: 'bubi', szinek: { haj: H.voros, felso: 0xb86a8a, also: 0x2a2a34 } },
  pinceor: { nem: 'f', kor: 'idos', alkat: 'vekony', ruha: 'ing', haj: 'osz_szakall', kalap: 'kalap', melleny: true, szinek: { haj: H.feher, felso: 0xd8d2c4, melleny: 0x3a3028, also: 0x2a2622, kalap: 0x2a2420, kalap2: 0x2a2420 } },
  traktoros: { nem: 'f', kor: 'kozep', alkat: 'testes', ruha: 'kantaros', haj: 'rovid', bajusz: 'konya', kalap: 'svajci', szinek: { haj: H.barna, felso: 0x8a7a5a, also: 0x2f4a6a } },
  pultos: { nem: 'n', kor: 'fiatal', alkat: 'vekony', ruha: 'fekete', haj: 'barna_hosszu', szinek: { haj: H.fekete } },
  // ------------------------------------------------ alkalmazottak (SZEREPEK)
  unokaocs: { nem: 'f', kor: 'fiatal', alkat: 'vekony', ruha: 'pulover', haj: 'tuskes', szinek: { haj: H.szoke, felso: 0x3a6a5a, also: 0x3a4250 } },
  neni: { nem: 'n', kor: 'idos', alkat: 'testes', ruha: 'otthonka', haj: 'konty', kendo: true, szinek: { haj: H.osz, felso: 0x6f86a8, ov: 0x6f86a8, kendo: 0x6a3a6a } },
  feri: { nem: 'f', kor: 'idos', alkat: 'atlag', ruha: 'ing', haj: 'rovid', bajusz: 'konya', kalap: 'svajci', melleny: true, szinek: { haj: H.osz, felso: 0xc8c0b0, melleny: 0x4a3a2a, also: 0x3a3630 } },
  sogor_alk: { nem: 'f', kor: 'kozep', alkat: 'testes', ruha: 'munkas', haj: 'gondor', szinek: { haj: H.barna, felso: 0x7a6a5a, melleny: 0x4a5a3a, mellenycsik: 0x4a5a3a } },
  // ------------------------------------------------ a Hivatal
  penzugyor: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'egyenruha', haj: 'rovid', kalap: 'tanyer', szinek: { haj: H.barna, kalap: 0x34402f, kalap2: 0x1a1e18 }, jaras: 'setal_hivatalos' },
  penzugyor2: { nem: 'f', kor: 'fiatal', alkat: 'vekony', ruha: 'egyenruha', haj: 'rovid', kalap: 'tanyer', szinek: { haj: H.fekete, kalap: 0x34402f, kalap2: 0x1a1e18 }, jaras: 'setal_hivatalos' },
  // ------------------------------------------------ besúgók (BESUGOK, régiónként)
  besugo_tanya: { nem: 'n', kor: 'idos', alkat: 'vekony', ruha: 'otthonka', haj: 'konty', kendo: true, szemuveg: true, szinek: { haj: H.osz, felso: 0x8a8a6a, ov: 0x8a8a6a, kendo: 0x4a3a2a } },
  besugo_falu: { nem: 'f', kor: 'idos', alkat: 'pocakos', ruha: 'ing', haj: 'osz_szakall', kalap: 'svajci', szinek: { haj: H.feher, felso: 0x7a7a72, also: 0x3a3a3a } },
  besugo_felveg: { nem: 'n', kor: 'idos', alkat: 'atlag', ruha: 'ruha', haj: 'konty', szemuveg: true, szinek: { haj: H.oszes, felso: 0x5a4a5a, ov: 0x3a2a3a } },
  besugo_szolohegy: { nem: 'f', kor: 'fiatal', alkat: 'atlag', ruha: 'zold_ing', haj: 'tuskes', szinek: { haj: H.voros } },
  besugo_major: { nem: 'f', kor: 'kozep', alkat: 'testes', ruha: 'munkas', haj: 'rovid', kalap: 'svajci', szinek: { haj: H.oszes, felso: 0x6a6a6a } },
  besugo_kisvaros: { nem: 'f', kor: 'idos', alkat: 'atlag', ruha: 'oltony', haj: 'oldalt', szemuveg: true, szinek: { haj: H.osz, felso: 0x4a4e52, also: 0x4a4e52 } },
  // ------------------------------------------------ beszállítók (SUPPLIERS)
  kofa: { nem: 'n', kor: 'idos', alkat: 'pocakos', ruha: 'otthonka', haj: 'konty', kendo: true, szinek: { haj: H.osz, felso: 0xa87a5a, ov: 0xa87a5a, kendo: 0x2f4a7a } },
  gazdabolt: { nem: 'f', kor: 'kozep', alkat: 'testes', ruha: 'munkas', haj: 'oldalt', szemuveg: true, szinek: { haj: H.oszes, felso: 0x8a8a7a, melleny: 0x6a3a2a, mellenycsik: 0x6a3a2a } },
  mehesz: { nem: 'f', kor: 'idos', alkat: 'atlag', ruha: 'kantaros', haj: 'osz_szakall', kalap: 'kalap', szinek: { haj: H.feher, felso: 0xe0dcc8, also: 0xd8d0b8, kalap: 0xd8ceb0, kalap2: 0x5a4a30 } },
  erdesz: { nem: 'f', kor: 'kozep', alkat: 'atlag', ruha: 'zold_ing', haj: 'rovid', bajusz: 'kefe', kalap: 'kalap', szinek: { haj: H.barna, felso: 0x3e4e32, felso2: 0x34422a, kalap: 0x34422a, kalap2: 0x6a5a3a } },
  fuszeres: { nem: 'n', kor: 'kozep', alkat: 'testes', ruha: 'ruha', haj: 'barna_rovid', koteny: true, szinek: { haj: H.fekete, felso: 0x8a3a2a, ov: 0x8a3a2a, koteny: 0xe0d8c8 } },
  // ------------------------------------------------ a történet szereplői (data/tortenet.js SZEREPLOK; a nagyapa nem figura)
  // a közjegyző: városi (öltöny, fedetlen fej, egyenes), idős, vékony, szemüveges — a gyászhoz sötét öltöny, fekete nyakkendő
  kozjegyzo: { nem: 'f', kor: 'idos', alkat: 'vekony', ruha: 'oltony', haj: 'oldalt', szemuveg: true, szinek: { haj: H.osz, felso: 0x26282e, also: 0x26282e, nyakkendo: 0x141416 } },
  // Medve Kristóf, a Gyári embere: fiatal városi, egyenes; világos, gyári kék öltöny, a Gyári piros nyakkendője
  kristof: { nem: 'f', kor: 'fiatal', alkat: 'atlag', ruha: 'oltony', haj: 'rovid', szinek: { haj: H.szoke, felso: 0x3a5a9a, also: 0x3a5a9a, ing: 0xf2f0ea, nyakkendo: 0xc8261e, cipo: 0x6a3a22 } },
};
// Halmi Ernő maga a pénzügyőr (ugyanaz a tányérsapkás figura, hogy a járőrben is felismerd); Kovácsné a tanya besúgója.
KIOSZTAS.erno = KIOSZTAS.penzugyor;
KIOSZTAS.kovacsne = KIOSZTAS.besugo_tanya;

/** A tartalomfájl (data/tartalom.js SZEREPEK) kulcsai → kiosztás-id (a 'sogor' vevő is, alkalmazott is). */
export const SZEREP_ID = { unokaocs: 'unokaocs', neni: 'neni', feri: 'feri', sogor: 'sogor_alk' };
/** Besúgó-régió → kiosztás-id. */
export const BESUGO_ID = r => 'besugo_' + r;

/** Névtelen falusi (járókelő, árus): determinisztikus véletlen figura a sorszámból. */
export function falusi(i, regio = 'falu') {
  const varosi = regio === 'kisvaros';
  const s = { seed: 9001 + i * 7919 + (varosi ? 31 : 0) };
  if (varosi) { s.nem = i % 2 ? 'f' : 'n'; s.ruha = s.nem === 'f' ? (i % 3 ? 'oltony' : 'ing') : (i % 3 ? 'kosztum' : 'polo'); }
  return s;
}
