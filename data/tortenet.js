// Kisüsti — történet, intró, tutorial, történeti jelenetek, vevői párbeszédek. Csak adat és tiszta függvény
// (DOM és three nélkül, Node alatt is importálható). Tulajdonos: narratíva. Történet-biblia: ../../TORTENET.md
//
// VÁZLAT (draft, 2026-11-13): minden itt bevezetett új szereplő és lore (Fekete Gáspár, Halmi Ernő pénzügyőr,
// a közjegyző, Medve Kristóf a Gyáritól, a szakadt füzetlapok, a befejezések) tulajdonosi jóváhagyásra vár.
//
// Szöveg-konvenció: a sorok idézőjel NÉLKÜL állnak; a megjelenítő teszi köréjük a „…” jelet. A sorokon belüli
// idézet ezért »…«. Egy felirat legfeljebb 2 sor (~90 karakter), a tutorial-utasítás legfeljebb 8 szó.
// Szatíra: azon nevetünk, amit a magyar ivási kultúráról mondunk, nem azon, aki iszik. A gyászon nem nevetünk.
//
// Koordináták: regions.js (x kelet, z dél, y fel, méter). A tanya tárgyai a js/vilag/tanya.js és a
// js/szereplok.js elrendezéséből: üst (6.2, -7.6), hordó (9.4, -7.9), keverőasztal (9.7, -5.4), palackozó (4.0, -5.6),
// pinceajtó (-3.2, -2.4), kút (-11, 3), házajtó (-8, -4.3), kapu (0, 13.4), fák (-7, 5) (-2.5, 8.5) (4.5, 6.5),
// kerti asztal (-9.4, 8.2). Hangjel-id-k: js/hang.js SHOTS és LOOPS (ellenőrizve). Animációk: a Kenney
// mini-characters klipjei (idle, walk, sit, emote-yes, emote-no, holding-right, interact-right, pick-up).

// ================================================================== szereplők (új, VÁZLAT)
export const SZEREPLOK = {
  nagyapa:   { nev: 'Fekete Gáspár', becenev: 'Gazsi bácsi', leiras: 'A nagyapa. Ötven évig főzött, harminc évig kerülte a pénzügyőrt. Csak a füzetében és a cetlijein szól.' },
  unoka:     { nev: 'az unoka', becenev: 'a kis Gazsi', leiras: 'A játékos. Pestről jött a torra, egy hétre. Maradt.' },
  erno:      { nev: 'Halmi Ernő', becenev: 'Ernő, a pénzügyőr', modell: 'character-male-c', leiras: 'A Hivatal embere. Pontos, udvarias, szolgálatban nem iszik. Harminc évig kereste nagyapa üstjét.' },
  kozjegyzo: { nev: 'a közjegyző', modell: 'character-male-e', leiras: 'Kisvárosból jön, felolvassa a végakaratot, és nem kér pálinkát. Egyedül ő nem.' },
  kristof:   { nev: 'Medve Kristóf', becenev: 'a Gyári embere', modell: 'character-male-b', leiras: 'A Gyári területi képviselője. Ingyenes kóstoló, szlogen, névjegykártya.' },
  kovacsne:  { nev: 'Kovácsné', leiras: 'A szomszéd a kerítés mögül, a tanya besúgója (tartalom.js BESUGOK.tanya). Csak a muskátlit locsolja.' },
};

// ================================================================== 1. INTRÓ (hideg nyitány: a tor)
/**
 * Lejátszó-szerződés (az integrátor írja meg, lásd TORTENET.md, „Horgok”):
 * - csak új játéknál indul, a sim indítása ELŐTT; a látvány órája `latvanyOra` (a sim ideje nem változik);
 * - `kamera[]`: kulcskockák {t, pos:[x,y,z], nez:[x,y,z], fov?, ease}; két kulcskocka között ease-in-out
 *   (soha lineáris), `vagas: true` = kemény vágás (nincs átmenet az előzőből);
 * - `szereplok[]`: a jelenet idejére lerakott figurák (modell: a szerepre illő Kenney-figura, NEM rendőregyenruhás);
 * - `anim[]`: {t, ki, anim, nez?} — a figura klipje, opcionálisan fordulás egy pont felé;
 * - `feliratok[]`: {t, ig, ki|null, szoveg, tipus:'sor'|'cim'|'cetli'} — 'sor': beszélő neve + szöveg alul;
 *   'cim': középen, nagy betű; 'cetli': nagyapa kézírása (papírlap) középen;
 * - `hang[]`: {t, id, tipus:'play'|'loop'|'stop'|'ambient', pos?, vol?, ut?} — `ut`: a hangforrás mozgása;
 * - `auto[]`: a fehér szolgálati autó útja a Fő úton (a világ járőr-modellje), {t, x, z};
 * - kihagyás: bármely billentyű megmutatja a „Tartsd lenyomva: kihagyás” jelet, 1 mp nyomva tartás átugorja.
 */
export const INTRO = {
  id: 'tor',
  hossz: 86,
  kihagyhato: true,
  kihagyasTartas: 1.0,
  latvanyOra: 18.4,
  ambient: { napszak: 0.77, regio: 'tanya' },
  szereplok: [
    { ki: 'kovacs',    pos: [-10.6, 7.3],  ry: 0,          anim: 'sit' },
    { ki: 'marika',    pos: [-9.4, 7.3],   ry: 0,          anim: 'sit' },
    { ki: 'orvos',     pos: [-8.2, 7.3],   ry: 0,          anim: 'sit' },
    { ki: 'kocsmaros', pos: [-10.6, 9.2],  ry: Math.PI,    anim: 'sit' },
    { ki: 'piroska',   pos: [-9.4, 9.2],   ry: Math.PI,    anim: 'sit' },
    { ki: 'sogor',     pos: [-8.2, 9.2],   ry: Math.PI,    anim: 'sit' },
    { ki: 'lajos',     pos: [-11.6, 8.2],  ry: Math.PI / 2, anim: 'sit' },
    { ki: 'kozjegyzo', pos: [-12.6, 8.0],  ry: Math.PI / 2, anim: 'idle', rejtve: true },  // 56 mp-nél áll fel a háttérből
    { ki: 'kovacsne',  pos: [-16.2, 5.2],  ry: Math.PI / 2, anim: 'idle' },              // a kerítés mögött (x = -14)
  ],
  kamera: [
    // A — sötét, harangszó (a kamera már az első beállításban áll, a kép fekete)
    { t: 0,    pos: [30, 9, 30],     nez: [-4, 1.5, 2],    fov: 55, vagas: true, elsotet: 1 },
    // B — nyitókép: a tanya alkonyatkor az útról, lassú közelítés
    { t: 6,    pos: [30, 9, 30],     nez: [-4, 1.5, 2],    fov: 55, elsotet: 0 },
    { t: 14,   pos: [-4, 4, 14],     nez: [-9.43, 1.0, 8.43], fov: 50 },   // 2026-11-14: a régi sugár a (-2,5; 8,5) szilvafán ment át → a kamera a lombba húzódott (tools/intro_takaras.py)
    // C — az asztal: lassú kocsizás a hosszanti oldal mentén, a beszélők felé
    { t: 14.5, pos: [-13.08, 2.0, 10.85], nez: [-10.64, 1.0, 7.5], fov: 42, vagas: true },   // 2026-11-14: a túloldali sarokból Kovács szemből; a régi út a (-7; 5) szilvafán ment át (18–20,6 mp: 100 % takarás)
    { t: 29,   pos: [-7.0, 1.6, 11.4], nez: [-10.0, 1.0, 8.8], fov: 42 },
    { t: 44,   pos: [-8.6, 1.6, 11.6], nez: [-11.6, 1.0, 8.2], fov: 40 },
    // D — Lajos az út felé néz: a fehér autó lassan elhalad, nem áll meg; aztán a kerítés, Kovácsné
    // (integrátor, 11-13: a pásztázás az autót követi — a régi [-4 → 6] irány előtt járt, a kocsi nem került képbe)
    { t: 49.5, pos: [-10.4, 1.5, 9.6], nez: [-28, 1.0, 16.5], fov: 48, vagas: true },
    { t: 54,   pos: [-10.4, 1.5, 9.6], nez: [8, 1.0, 16.5],   fov: 48 },
    { t: 55,   pos: [-12.0, 1.6, 6.8], nez: [-16.2, 1.4, 5.2], fov: 38, vagas: true },
    // E — a közjegyző feláll; ellenbeállítás: a vendégek a kamerára (az unokára) néznek
    { t: 58,   pos: [-6.6, 1.4, 8.2],  nez: [-12.6, 1.5, 8.0], fov: 45, vagas: true },
    { t: 66,   pos: [-6.8, 1.4, 8.2],  nez: [-11.0, 1.2, 8.2], fov: 50 },
    // F — a pajta: be a hordóhoz, rajta a cetli
    { t: 71,   pos: [4.0, 2.4, -1.5],  nez: [8.6, 1.0, -7.6],  fov: 50, vagas: true },
    { t: 78,   pos: [8.2, 1.7, -5.9],  nez: [9.4, 1.0, -7.9],  fov: 40 },
    // G — elsötétül, reggel; a végén átadja a kamerát a játékosnak: jatek.js kezdőpontja (2, 2.5), yaw -22°, pitch -5°
    { t: 79,   pos: [8.2, 1.7, -5.9],  nez: [9.4, 1.0, -7.9],  fov: 40, elsotet: 1 },
    { t: 82,   pos: [2, 1.7, 2.5],     nez: [5.2, 1.4, -5.4],  fov: 60, vagas: true, elsotet: 1, latvanyOra: 8.0 },
    { t: 84,   pos: [2, 1.7, 2.5],     nez: [5.2, 1.4, -5.4],  fov: 60, elsotet: 0 },
  ],
  anim: [
    { t: 14.5, ki: 'kovacs',    anim: 'holding-right' },
    { t: 19.5, ki: 'marika',    anim: 'interact-right' },
    { t: 24.5, ki: 'orvos',     anim: 'emote-no' },
    { t: 29.5, ki: 'kocsmaros', anim: 'holding-right' },
    { t: 34.5, ki: 'piroska',   anim: 'emote-yes' },
    { t: 39.5, ki: 'sogor',     anim: 'interact-left' },
    { t: 44.5, ki: 'lajos',     anim: 'holding-right' },
    { t: 49.5, ki: 'lajos',     anim: 'idle', nez: [0, 1, 16.5] },
    { t: 55,   ki: 'kovacsne',  anim: 'interact-right' },
    { t: 57,   ki: 'kozjegyzo', anim: 'walk', cel: [-12.0, 8.2] },
    { t: 58.5, ki: 'kozjegyzo', anim: 'idle' },
    { t: 64.5, ki: '*asztal',   anim: 'idle', nez: [-7.2, 1.2, 8.2] },   // mind az unokára néz
    { t: 67,   ki: 'marika',    anim: 'emote-yes' },
  ],
  feliratok: [
    { t: 1.5,  ig: 5.5,  ki: null,        tipus: 'cim',   szoveg: 'Kisüstfalva' },
    { t: 7,    ig: 12.5, ki: null,        tipus: 'cim',   szoveg: 'Gazsi bácsi tora. Este hat.' },
    { t: 14.5, ig: 19,   ki: 'kovacs',    tipus: 'sor',   szoveg: 'Negyven évig reggeliztünk együtt. Egy kupicát. A gyomrunknak.' },
    { t: 19.5, ig: 24,   ki: 'marika',    tipus: 'sor',   szoveg: 'Mindig mondta: ez orvosság. Én elhittem neki.' },
    { t: 24.5, ig: 29,   ki: 'orvos',     tipus: 'sor',   szoveg: 'Orvosként nem ajánlottam. Barátként: nyugodjon békében.' },
    { t: 29.5, ig: 34,   ki: 'kocsmaros', tipus: 'sor',   szoveg: 'Nálam az ő pálinkája volt a »házi«. Most mi lesz a házival?' },
    { t: 34.5, ig: 39,   ki: 'piroska',   tipus: 'sor',   szoveg: 'Harminc évig vittem neki a nyugdíjat. Mindig kínált mellé egyet.' },
    { t: 39.5, ig: 44,   ki: 'sogor',     tipus: 'sor',   szoveg: 'A sógorom üzeni: a hagyományt ápolni kell. Lehetőleg számla nélkül.' },
    { t: 44.5, ig: 49,   ki: 'lajos',     tipus: 'sor',   szoveg: 'Minden lagzimon az ő pálinkája szólt. Hangosabban, mint a zenekar.' },
    { t: 49.5, ig: 54,   ki: 'lajos',     tipus: 'sor',   szoveg: 'Nézd, Ernő is eljött. Csak nem szállt ki.' },
    { t: 55,   ig: 57.5, ki: 'kovacsne',  tipus: 'sor',   szoveg: 'Én csak a muskátlit locsolom.' },
    { t: 58.5, ig: 61.5, ki: 'kozjegyzo', tipus: 'sor',   szoveg: 'Fekete Gáspár végakarata.' },
    { t: 61.5, ig: 64.5, ki: 'kozjegyzo', tipus: 'sor',   szoveg: 'Unokámra hagyom a tanyát, a pajtát…' },
    { t: 64.5, ig: 67,   ki: 'kozjegyzo', tipus: 'sor',   szoveg: '…és ami benne van.' },
    { t: 67,   ig: 70.5, ki: 'marika',    tipus: 'sor',   szoveg: 'Na, aranyom. Akkor holnap jövünk.' },
    { t: 74,   ig: 78.5, ki: 'nagyapa',   tipus: 'cetli', szoveg: 'Az utolsó hordóm. Kész.\nNe hagyd megecetesedni. — Nagyapa' },
    { t: 82.5, ig: 86,   ki: null,        tipus: 'cim',   szoveg: 'Másnap reggel nyolc.' },
  ],
  hang: [
    { t: 0.2,  id: 'harang', tipus: 'play', pos: [254, 18, -5.5], vol: 0.9 },     // óratorony a falu terén (falu.js horgony)
    { t: 3.0,  id: 'harang', tipus: 'play', pos: [254, 18, -5.5], vol: 0.8 },
    { t: 5.5,  tipus: 'ambient', napszak: 0.77, regio: 'tanya' },
    { t: 9.0,  id: 'kutya',  tipus: 'play', pos: [-40, 1, -30], vol: 0.35 },
    { t: 14.6, id: 'uveg',   tipus: 'play', pos: [-10.6, 1, 7.6], vol: 0.6 },
    { t: 29.6, id: 'toltes', tipus: 'play', pos: [-10.6, 1, 8.8], vol: 0.5 },
    { t: 44.0, id: 'motor_penzugyor', tipus: 'loop', pos: [-90, 0.6, 16.5], vol: 0.55, ut: 'auto' },
    { t: 46.0, id: 'uveg',   tipus: 'play', pos: [-11.6, 1, 8.2], vol: 0.5 },
    { t: 67.0, id: 'motor_penzugyor', tipus: 'stop' },
    { t: 72.0, id: 'lepes_fa', tipus: 'play', pos: [5, 0, -5], vol: 0.5 },
    { t: 75.0, id: 'hordo',  tipus: 'play', pos: [9.4, 0.8, -7.9], vol: 0.7 },
    { t: 82.2, tipus: 'ambient', napszak: 0.34, regio: 'tanya' },
    { t: 82.6, id: 'kakas',  tipus: 'play', pos: [-25, 1, -10], vol: 0.8 },
  ],
  // a fehér szolgálati autó: 8 m/s-mal halad el a Fő úton nyugatról keletre, nem lassít le
  // (integrátor, 11-13: a kapu előtt 51,7 mp-nél halad el, a D-beállítás közepén; a pásztázás 2–15°-kal követi)
  auto: [{ t: 44, x: -72, z: 16.5 }, { t: 54, x: 8, z: 16.5 }, { t: 66, x: 104, z: 16.5 }],
  // ha a játékos kihagyja: ez a cetli jelenik meg egyszer, hogy a lényeg megmaradjon
  kihagyasCetli: 'Az utolsó hordóm a pajtában. Kész.\nNe hagyd megecetesedni. — Nagyapa',
};

// ================================================================== 2. TUTORIAL („Nagyapa cetlijei”)
/**
 * Szerződés:
 * - A lépések sorban élesednek, de NEM zárnak: a játékos szabadon mozog, és ha egy lépés feltétele már teljesül,
 *   a lépés csendben elkészül (az ügyes játékost nem tanítjuk).
 * - `turelem` (mp): a lépés élesedése után ennyi ideig csak a célpont halvány jelölője látszik; az `utasitas`
 *   csak akkor jelenik meg, ha addig nem teljesült (adaptív segítség). A `cetli` a lépés élesedésekor egyszer,
 *   nagyapa kézírásával, 6 mp-ig (kattintás nélkül eltűnik, a telefon Füzet-appjában visszaolvasható).
 * - `cel`: {kind, prop?, slot?} — a célzható tárgy (interakcio.js kind), vagy {pos:[x,z]}, vagy {ui:'…'} HUD-elem.
 * - `mikor(S, ctx)`: további élesedési feltétel (pl. napszak); `kesz(S, ev, ctx)`: elkészült-e; `ev` a sim
 *   eseménye (vagy null, ha csak állapotot ellenőrzünk); `ctx` = {flag, mp, jatekosPos, nalad, ...} a futtatótól.
 * - Kikapcsolás: Beállítások → „Nagyapa cetlijei” (alap: be). Kikapcsolva nincs jelölő, utasítás és cetli,
 *   a `beallitas` időszorzója sem él; az intró és a történeti jelenetek megmaradnak.
 */
const tav = (p, x, z) => (p ? Math.hypot(p.x - x, p.z - z) : 1e9);
const regioGyanu = (S, id) => S.regiok?.find(r => r.id === id)?.gyanu ?? 0;
const vanRendelesTole = (S, vevo, allapot) => S.rendelesek?.some(r => r.vevo === vevo && (!allapot || r.allapot === allapot));

export const TUTORIAL = {
  // az első nap ütemezése (bírálat, KRITIKA-v3: első pénz 5:00 előtt, ≥ 1 döntés / 30 mp, 10:00 körül alvás)
  beallitas: {
    idoSzorzo: { ertek: 0.2, amig: 't_alvas' },           // a sim TIME_SCALE ×0,2 az első estéig: 1 valós mp ≈ 1,2 játékperc
    kezdoCefre: { prop: 'tanya', idx: 0, gyumolcs: 'szilva', l: 30, q: 62 },  // nagyapa utolsó hordója: kész cefre
    csendesKezdes: { amig: 't_alvas', kivetel: ['kovacs', 'kocsmaros'] },     // a többi kezdő vevő csak a 2. naptól ír
    elsoVevo: { vevo: 'kovacs', l: 0.5, hely: 'kapu', mikor: 'fozes_utan' },   // a kapuban áll, SMS nélkül
    elsoSms: { vevo: 'kocsmaros', l: 1, hely: 'kapu', mikor: 'elso_eladas_utan', kesleltetes: 20 },
    elhajtas: { mikor: 't_rejtek', ut: [[-140, 16.5], [160, 16.5]], sebesseg: 9, megall: false },
  },
  fejezetek: [
    { id: 1, cim: 'Az első nap', leiras: 'A tanya: főzés, első vevő, telefon, szedés, hordó, pince, alvás.' },
    { id: 2, cim: 'A második nap', leiras: 'Második főzés, ágyas, palack, gyanú, motozás.' },
  ],
  lepesek: [
    // ---------------------------------------------------------- 1. fejezet (az első ~10 perc)
    { id: 't_pajta', fejezet: 1, cel: { kind: 'barrel', prop: 'tanya', pos: [9.4, -7.9] }, turelem: 6,
      utasitas: 'WASD: séta. Irány a pajta!',
      cetli: 'A hordóban az utolsó főzetem.\nKész, csak le kell főzni.',
      kesz: (S, ev, c) => tav(c.jatekosPos, 9.4, -7.9) < 3.5 || !!S.keziUst },
    { id: 't_ust', fejezet: 1, cel: { kind: 'still', prop: 'tanya', pos: [6.2, -7.6] }, turelem: 8,
      utasitas: 'Az üstnél E: indul a főzés.',
      cetli: 'Az üst nem kapkod. Te se.',
      kesz: S => !!S.keziUst || (S.stat?.fozes ?? 0) >= 1 },
    { id: 't_ho', fejezet: 1, cel: { ui: 'ust-homero' }, turelem: 6, tartMp: 3,
      utasitas: 'W/S: tűz. Tartsd 88–94 fokon.',
      cetli: 'Ha úgy forr, mint a pletyka,\nvegyél vissza a tűzből.',
      kesz: S => (S.stat?.fozes ?? 0) >= 1 || (!!S.keziUst && S.keziUst.homerseklet >= 88 && S.keziUst.homerseklet <= 94) },
    { id: 't_vagas', fejezet: 1, cel: { ui: 'ust-edeny' }, turelem: 4,
      utasitas: 'Csöpög az eleje. SPACE: vágás!',
      cetli: 'Az eleje a macskának se kell.\nNeked se.',
      kesz: S => (S.stat?.fozes ?? 0) >= 1 || (!!S.keziUst && S.keziUst.edeny !== 'elo') },
    { id: 't_vege', fejezet: 1, cel: { ui: 'ust-edeny' }, turelem: 10,
      utasitas: 'Gyengül? SPACE, aztán Q: kész.',
      cetli: 'Aki a végét is akarja,\naz kozmást iszik.',
      kesz: S => (S.stat?.fozes ?? 0) >= 1 },
    { id: 't_kapu', fejezet: 1, cel: { kind: 'vevo', pos: [0, 13.4] }, turelem: 15, horog: 'elsoVevo',
      utasitas: 'Kovács bácsi a kapuban. E: átadás.',
      cetli: 'Kovácsnak ne adj gyengét.\nMegsértődik, és igaza van.',
      kesz: (S, ev) => ev?.type === 'sale' || (S.stat?.eladas ?? 0) >= 1 },
    { id: 't_telefon', fejezet: 1, cel: { ui: 'telefon' }, turelem: 8, horog: 'elsoSms',
      utasitas: 'Rezeg a zsebed. Tab: telefon.',
      cetli: 'A falu már nem kiabál át a kerítésen.\nÍr.',
      kesz: (S, ev, c) => !!c.flag.telefonNyitva || vanRendelesTole(S, 'kocsmaros', 'elfogadva') },
    { id: 't_rendeles', fejezet: 1, cel: { ui: 'telefon' }, turelem: 15,
      utasitas: 'Vállald el a kocsmáros rendelését.',
      cetli: 'A kocsmáros úgyis vizezi.\nEz az ő titka. Meg az egész falué.',
      kesz: (S, ev) => vanRendelesTole(S, 'kocsmaros', 'elfogadva') || (ev?.type === 'sale' && ev.vevo === 'kocsmaros') },
    { id: 't_vizez', fejezet: 1, cel: { kind: 'well', pos: [-11, 3] }, turelem: 20,
      utasitas: 'Kútnál E: vizezés. Több lesz.',
      cetli: 'Vizezni bűn. Mondtam én is.\nAztán vizeztem.',
      kesz: S => (S.stat?.vizezes ?? 0) >= 1 },
    { id: 't_szedes', fejezet: 1, cel: { kind: 'fruit', prop: 'tanya', slot: 2, pos: [4.5, 6.5] }, turelem: 15,
      utasitas: 'Érett a barack. E: szedés.',
      cetli: 'A fa nem kérdezi, mire kell.\nNe is mondd meg neki.',
      kesz: S => Object.values(S.keszlet?.gyumolcs || {}).some(g => g.kg > 0) || (S.stat?.cefre ?? 0) >= 1 },
    { id: 't_hordo', fejezet: 1, cel: { kind: 'barrel', prop: 'tanya', pos: [9.4, -7.9] }, turelem: 15,
      utasitas: 'Gyümölcs a hordóba. Élesztővel.',
      cetli: 'Fél nap. Ne nézegesd,\nattól se lesz gyorsabb.',
      kesz: S => (S.stat?.cefre ?? 0) >= 1 },
    { id: 't_rejtek', fejezet: 1, cel: { kind: 'cellar', prop: 'tanya', pos: [-3.2, -2.4] }, turelem: 3, horog: 'elhajtas',
      mikor: S => (S.stat?.eladas ?? 0) >= 1,
      utasitas: 'Fehér autó! R a pincénél: elrejted.',
      cetli: 'Amit Ernő nem lát,\narról nem ír jegyzőkönyvet.',
      kesz: (S, ev, c) => (S.stat?.rejtes ?? 0) >= 1 || !!c.flag.elhajtasVege },
    { id: 't_alvas', fejezet: 1, cel: { kind: 'house', pos: [-8, -4.3] }, turelem: 25,
      mikor: S => S.ido.ora >= 19 || S.ido.ora < 5,
      utasitas: 'Este van. A háznál E: alvás.',
      cetli: 'Aludj rá egyet.\nA cefre is ezt csinálja.',
      kesz: (S, ev) => ev?.type === 'dayEnd' },
    // ---------------------------------------------------------- 2. fejezet (csak a hibázónak szól: hosszú türelem)
    { id: 't2_foz', fejezet: 2, cel: { kind: 'still', prop: 'tanya', pos: [6.2, -7.6] }, turelem: 60,
      mikor: S => S.ingatlanok?.find(p => p.id === 'tanya')?.hordok.some(h => h.allapot === 'kesz'),
      utasitas: 'Kész a cefre. Üst, tűz, vágás.',
      cetli: 'A második főzés a nehezebb.\nAz elsőnél még szerencséd van.',
      kesz: S => (S.stat?.fozes ?? 0) >= 2 },
    { id: 't2_kever', fejezet: 2, cel: { kind: 'kever', prop: 'tanya', pos: [9.7, -5.4] }, turelem: 30, horog: 'marikaMeze',
      utasitas: 'Keverőasztal: mézet a pálinkába.',
      cetli: 'Egy kanál méz. Nagyanyád szerint kettő.\nŐ tudta jobban.',
      kesz: S => (S.stat?.keveres ?? 0) >= 1 },
    { id: 't2_palack', fejezet: 2, cel: { kind: 'palack', prop: 'tanya', pos: [4.0, -5.6] }, turelem: 45,
      utasitas: 'Palackozó: töltsd félliteres üvegbe.',
      cetli: 'A pesti a címkét issza meg.\nA falusi a tartalmát.',
      kesz: S => (S.stat?.palack ?? 0) > 0 },
    { id: 't2_gyanu', fejezet: 2, cel: { ui: 'gyanu' }, turelem: 0,
      mikor: S => regioGyanu(S, 'tanya') >= 45,
      utasitas: 'Nő a gyanú. Oltsd el, aludj.',
      cetli: 'Ernő nem gonosz. Csak pontos.\nA pontosság ellen a türelem segít.',
      kesz: (S, ev) => regioGyanu(S, 'tanya') < 30 || (ev?.type === 'raid' && !ev.talalt) },
    { id: 't2_motozas', fejezet: 2, cel: { ui: 'nalad' }, turelem: 0, ismetelheto: true,
      mikor: S => (S.nalad ?? 0) > 3,
      utasitas: 'Három liternél többet ne vigyél!',
      cetli: 'Az úton motoznak.\nA zsebedben legfeljebb három liter férjen.',
      kesz: S => (S.nalad ?? 0) <= 3 },
  ],
};

// ================================================================== 3. TÖRTÉNETI JELENETEK (12)
/**
 * Szerződés:
 * - `mikor`: {esemeny?, felt(S, ev, ctx)} — élesíti a jelenetet (egyszer). Ha van `hely`, a jelenet akkor
 *   indul, amikor a játékos `r` méteren belül van; addig a térképen és a telefon Füzet-appjában jelölve vár.
 *   `hely.jon: true`: a szereplő a játékos tanyájának kapujához jön (a világ odasétáltatja/odahajtja).
 * - A jelenet nem vágójelenet: a játékos mozoghat, a beszélők a helyükön állnak, a feliratok alul futnak
 *   (sorok közt 0,6 mp). A kamera nem vált, legfeljebb finoman a beszélő felé fordítja a fejet, ha a játékos
 *   2 mp-ig nem mozgatja az egeret.
 * - `dontes.opciok[]`: {szoveg (≤ 6 szó), feltetel?(S, ctx), valasz[], hatas[]}. Gomb: 1/2/3; 20 mp után az
 *   első opció NEM választódik ki magától: a jelenet megvárja a játékost, elsétálva pedig elhalasztja.
 * - `hatas[]`: {api, args} csak meglévő sim-hívás (SIM-API.md) · {flag, ertek} · {horog, ...} = integrátori
 *   kód kell (a TORTENET.md „Horgok” listája). '$tetel05' = a játékosnál lévő ≥ 0,5 l-es tétel id-je.
 * - `hirmondo`: a következő napi Hírmondó egyik címe (ha a jelenet lefutott).
 */
export const JELENETEK = [
  {
    id: 'j01_erno', cim: 'Ernő a kapuban', felvonas: 1,
    mikor: { felt: S => S.ido.nap >= 2 && S.ido.ora >= 9 && S.ido.ora < 17 && regioGyanu(S, 'tanya') >= 20 },
    hely: { pos: [0, 13.4], r: 18, jon: true, jarmu: 'penzugyor' },
    szereplok: ['erno'],
    hangjel: [{ id: 'jelenet:penzugyor' }],
    sorok: [
      { ki: 'erno', anim: 'idle', szoveg: 'Halmi Ernő, pénzügyőr. Részvétem.' },
      { ki: 'erno', szoveg: 'Nagyapádat harminc évig kerestem. Az üstjét sose találtam meg.' },
      { ki: 'erno', szoveg: 'Pedig füstölt a kémény. Azt mondta, kolbászt füstöl. Harminc évig ugyanazt.' },
    ],
    dontes: {
      opciok: [
        { szoveg: 'Egy kupicát, Ernő úr?', feltetel: S => (S.nalad ?? 0) >= 0.1,
          valasz: [{ ki: 'erno', anim: 'emote-no', szoveg: 'Szolgálatban nem iszom. De elteszem. Bizonyítéknak.' }],
          hatas: [{ api: 'addSuspicion', args: ['tanya', 15] }, { flag: 'erno', ertek: 'kupica' }] },
        { szoveg: 'Egy kávét?',
          valasz: [{ ki: 'erno', anim: 'emote-yes', szoveg: 'Kávét elfogadok. A kávé nem bizonyíték.' }],
          hatas: [{ api: 'addSuspicion', args: ['tanya', -10] }, { flag: 'erno', ertek: 'kave' }] },
        { szoveg: 'Itt nincs semmi, Ernő úr.',
          valasz: [{ ki: 'erno', szoveg: 'Nagyapád is ezt mondta. Pont ezzel a hangsúllyal.' }],
          hatas: [{ flag: 'erno', ertek: 'tagad' }] },
      ],
    },
    hirmondo: 'Pénzügyőr a tanyán: kávé vagy kupica? Lapunk tudja, de nem árulja el.',
  },
  {
    id: 'j02_postas', cim: 'A postás táskája', felvonas: 1,
    mikor: { esemeny: 'rankUp', felt: (S, ev) => ev.rang >= 1 },
    hely: { pos: [0, 13.4], r: 18, jon: true },
    szereplok: ['postas'],
    hangjel: [{ id: 'bicikli_csengo', pos: [0, 1, 14] }],
    sorok: [
      { ki: 'postas', szoveg: 'Nagyapád is velem küldte a csomagjait. Mindig »gyógyteát«.' },
      { ki: 'postas', szoveg: 'A táskámban hat üveg elfér. A kérdéseket meg nem hallom.' },
    ],
    dontes: {
      opciok: [
        { szoveg: 'Felveszlek. Húszezer.',
          valasz: [{ ki: 'postas', anim: 'emote-yes', szoveg: 'Holnaptól a nyugdíj mellé a te üvegedet is viszem.' }],
          hatas: [{ api: 'hireDealer', args: ['postas'] }, { flag: 'postas', ertek: 'felveve' }],
          kudarc: [{ ki: 'postas', szoveg: 'Ha lesz rá pénzed, szólj. Én ráérek, a nyugdíjasok nem.' }] },
        { szoveg: 'Még egyedül csinálom.',
          valasz: [{ ki: 'postas', szoveg: 'Ahogy akarod. A falu nagy, a lábad csak kettő.' }],
          hatas: [{ flag: 'postas', ertek: 'kesobb' }] },
      ],
    },
    hirmondo: 'Rangot lépett a tanya. A falu szerint Főzőlegény. A Hivatal szerint gyanús.',
  },
  {
    id: 'j03_lakodalom', cim: 'Húsz liter szombatra', felvonas: 2,
    mikor: { felt: (S, ev, c) => (S.rang?.rang ?? 0) >= 1 && S.ido.nap >= 4 && !!c.flag.postas },
    hely: { pos: [0, 13.4], r: 18, jon: true },
    szereplok: ['lajos'],
    hangjel: [{ id: 'koszones', pos: [0, 1, 14] }],
    sorok: [
      { ki: 'lajos', anim: 'holding-right', szoveg: 'Szombaton lagzi! Kétszáz vendég, és mind csak egy pohárral.' },
      { ki: 'lajos', szoveg: 'Húsz liter kell, hatvan fok fölött. Ami alatta van, az üdítő.' },
    ],
    dontes: {
      opciok: [
        { szoveg: 'Vállalom. Szombatra meglesz.',
          valasz: [{ ki: 'lajos', anim: 'emote-yes', szoveg: 'Kezet rá! A vőfély már írja rólad a rímet.' }],
          hatas: [{ horog: 'nagyRendeles', vevo: 'lajos', l: 20, minFok: 60, hataridoNap: 3, hataridoOra: 18, arSzorzo: 1.25, utanaGyanu: { regio: 'falu', ertek: 20 } }, { flag: 'lakodalom', ertek: 'vallalt' }] },
        { szoveg: 'Ennyit nem bírok.',
          valasz: [{ ki: 'lajos', anim: 'emote-no', szoveg: 'Akkor a Gyáriból veszem. Bocsáss meg, a lagzi nem várhat.' }],
          hatas: [{ horog: 'gyariErosodik', ertek: 0.1 }, { flag: 'lakodalom', ertek: 'gyari' }] },
      ],
    },
    // a teljesítés vagy a lejárat után (a nagyRendeles horog jelzi): rövid SMS-zárás
    utana: {
      siker: { sms: { kitol: 'lajos', szoveg: 'A menyasszonytánc hajnalig tartott. A híred is. A vőfély rímet írt rólad, sajnos.' }, hirmondo: 'Lagzi Kisüstfalván: kétszáz vendég, négyszáz pohár, egy fáradt zenekar.' },
      kudarc: { sms: { kitol: 'lajos', szoveg: 'A vendégek a Gyárit itták. Senki nem táncolt. A vőfély se rímelt.' }, hirmondo: 'Csendes lagzi a faluban. A zenekar korán hazament.' },
    },
    hirmondo: 'Nagy lagzira készül a falu. A násznagy szerint a pálinka megvan. Ő tudja, honnan.',
  },
  {
    id: 'j04_gyari', cim: 'Gyári íz, gyári ár', felvonas: 2,
    mikor: { esemeny: 'sms', felt: (S, ev) => ev.uzenet?.kitol === 'gyari' },
    hely: { pos: [230, 16.5], r: 30 },
    szereplok: ['kristof', 'kovacs'],
    sorok: [
      { ki: 'kristof', anim: 'interact-right', szoveg: 'Medve Kristóf, a Gyári területi képviselője. Kóstolják meg!' },
      { ki: 'kristof', szoveg: 'Pálinka-jellegű szeszesital. Gyári íz, gyári ár.' },
      { ki: 'kovacs', anim: 'emote-no', szoveg: 'Ettől a gyomrom felmondott. Írásban.' },
      { ki: 'kristof', szoveg: 'Maga a kisüstis? Majd beszélünk. Mi mindenkivel beszélünk. Egyszer.' },
    ],
    hirmondo: 'Megjött a Gyári: két liter 1 990 forintért. Kovács bácsi nem nyilatkozott, csak köpött.',
  },
  {
    id: 'j05_besugo', cim: 'A sarokasztal', felvonas: 2,
    mikor: { felt: S => regioGyanu(S, 'falu') >= 50 },
    hely: { pos: [213, 6.4], r: 14 },
    szereplok: ['kocsmaros', 'besugo_falu'],
    hangjel: [{ id: 'kocsma', tipus: 'ambient' }],
    sorok: [
      { ki: 'kocsmaros', szoveg: 'Látod a sarokasztalt? Ő mindent lát. Aztán mindent elmond.' },
      { ki: 'besugo_falu', szoveg: 'Én nem láttam semmit. Egyelőre.' },
    ],
    dontes: {
      opciok: [
        { szoveg: 'Fél liter a csendért.', feltetel: S => (S.nalad ?? 0) >= 0.5,
          valasz: [{ ki: 'besugo_falu', anim: 'emote-yes', szoveg: 'Én nem láttam semmit. Ha még egyet hozol, akkor sem.' }],
          hatas: [{ api: 'appease', args: ['falu', '$tetel05'] }, { flag: 'besugo_falu', ertek: 'csend' }] },
        { szoveg: 'A csendért nem fizetek.',
          valasz: [{ ki: 'besugo_falu', szoveg: 'Akkor mesélek. Jó hangosan, hogy a hátsó asztal is hallja.' }],
          hatas: [{ api: 'addSuspicion', args: ['falu', 10] }, { flag: 'besugo_falu', ertek: 'harag' }] },
      ],
    },
    hirmondo: 'A kocsma sarokasztala ma szokatlanul hallgatag volt.',
  },
  {
    id: 'j06_kovacs', cim: 'Kovács bácsi gyomra', felvonas: 2,
    mikor: { felt: S => S.ido.nap >= 6 && (S.vevok?.find(v => v.id === 'kovacs')?.huseg ?? 0) >= 60 },
    hely: { pos: [0, 13.4], r: 18, jon: true },
    szereplok: ['orvos', 'kovacs'],
    sorok: [
      { ki: 'orvos', szoveg: 'Kovács úr, megjöttek a leletei. A gyomra üzeni: elég volt.' },
      { ki: 'kovacs', szoveg: 'A gyomrom negyven évig nem panaszkodott.' },
      { ki: 'orvos', szoveg: 'Most panaszkodik. Én csak tolmácsolom.' },
      { ki: 'kovacs', szoveg: 'Fiam… ma mit adsz?' },
    ],
    dontes: {
      opciok: [
        { szoveg: 'Ma szódát, Kovács bácsi.',
          valasz: [{ ki: 'kovacs', szoveg: 'Szódát. Nagyapád is ezt mondta volna. Csak ő sosem mondta.' },
                   { ki: 'orvos', anim: 'emote-yes', szoveg: 'Ezt felírom. Magának is, Kovács úr.' }],
          hatas: [{ horog: 'vevoSzunet', vevo: 'kovacs', nap: 3, utanaHuseg: 15 }, { flag: 'kovacs', ertek: 'szoda' }] },
        { szoveg: 'Egy kupicát. Az orvos ne lássa.',
          valasz: [{ ki: 'orvos', szoveg: 'Láttam. Nem vagyok pénzügyőr, de látok.' },
                   { ki: 'kovacs', szoveg: 'Holnap nem jövök. Pihenek. A feleségem is ezt akarja.' }],
          hatas: [{ horog: 'vevoSzunet', vevo: 'kovacs', nap: 2 }, { flag: 'kovacs', ertek: 'kupica' }] },
      ],
    },
    hirmondo: 'Kovács bácsi két napig nem jött a kapuhoz. A felesége szerint pihen. A gyomra szerint végre.',
  },
  {
    id: 'j07_hegy', cim: 'Ahol nagyapa kezdte', felvonas: 2,
    mikor: { esemeny: 'rankUp', felt: (S, ev) => ev.rang >= 2 },
    hely: { pos: [-100, -100], r: 20 },
    szereplok: ['pinceor'],
    hangjel: [{ id: 'szel', tipus: 'ambient' }],
    sorok: [
      { ki: 'pinceor', szoveg: 'Nagyapád itt kezdte, a hegyen. Az első présház az övé volt.' },
      { ki: 'pinceor', szoveg: 'Eladta, amikor a Hivatal szaglászni kezdett. Most megint eladó.' },
      { ki: 'pinceor', szoveg: 'A pince mély, a szomszéd messze. Gondold meg, fiam.' },
    ],
    hatas: [{ horog: 'jelol', mit: 'ingatlan', id: 'preshaz' }, { flag: 'hegy', ertek: 'latta' }],
    hirmondo: 'Üstmester a faluban? A Szőlőhegyen állítólag újra füstölnek a présházak.',
  },
  {
    id: 'j08_razzia', cim: 'Bizonyítéknak', felvonas: 2,
    mikor: { esemeny: 'raid', felt: () => true },   // az első házkutatás, bármelyik ingatlanon
    hely: { aktualis: true },                // a házkutatás helyszínén, azonnal
    szereplok: ['erno'],
    valtozatok: {
      tiszta: { felt: (S, ev) => !ev.talalt, sorok: [
        { ki: 'erno', szoveg: 'Szép rend van itt. Gyanúsan szép.' },
        { ki: 'erno', szoveg: 'Nagyapád is ilyen rendet tartott. Pont ezért gyanakodtam rá.' } ] },
      talalt: { felt: (S, ev) => !!ev.talalt, sorok: [
        { ki: 'erno', anim: 'pick-up', szoveg: 'Bizonyítéknak.' },
        { ki: 'erno', szoveg: 'Ne haragudj. Nagyapádtól harminc évig semmit nem foglaltam le. Most elkezdtem.' } ] },
    },
    utana: { masnapReggel: { ki: 'marika', szoveg: 'Hoztam pogácsát, aranyom. Ernőnek nem adtam.', hely: [0, 13.4] } },
    hirmondo: 'Házkutatás a faluban. A pénzügyőr szerint »rutineljárás«. A falu szerint »a szokásos«.',
  },
  {
    id: 'j09_verseny', cim: 'Járási pálinkaverseny', felvonas: 3,
    mikor: { felt: S => ((S.rang?.rang ?? 0) >= 2 && (S.rang?.alfok ?? 0) >= 2) || S.ido.nap >= 12 },
    hely: { pos: [230, 16.5], r: 30 },
    szereplok: ['jolan'],
    sorok: [
      { ki: 'jolan', anim: 'interact-right', szoveg: 'Járási pálinkaverseny a Kisvárosban! Nevezni egy üveggel lehet.' },
      { ki: 'jolan', szoveg: 'Aranyérem, oklevél, és fénykép a Hírmondóban. Név szerint.' },
    ],
    dontes: {
      opciok: [
        { szoveg: 'Saját néven nevezek.',
          valasz: [{ ki: 'jolan', anim: 'emote-yes', szoveg: 'Bátor. A zsűri szereti a bátrakat. A Hivatal is.' }],
          hatas: [{ horog: 'verseny', nev: 'sajat', minQ: 80, nyeremeny: { cimke: 'arany', arSzorzo: 1.15, nap: 5 } }, { api: 'addSuspicion', args: ['kisvaros', 30] }, { flag: 'verseny', ertek: 'sajat' }] },
        { szoveg: 'A sógor nevén.',
          valasz: [{ ki: 'jolan', szoveg: 'A sógor kapja a fényképet. Te a pénzt. Így szokás.' }],
          hatas: [{ horog: 'verseny', nev: 'sogor', minQ: 80, nyeremeny: { cimke: 'arany', arSzorzo: 1.05, nap: 5 } }, { flag: 'verseny', ertek: 'sogor' }] },
        { szoveg: 'Nem nevezek.',
          valasz: [{ ki: 'jolan', szoveg: 'Kár. Idén is a Gyári nyer. Ők neveztek.' }],
          hatas: [{ flag: 'verseny', ertek: 'nem' }] },
      ],
    },
    hirmondo: 'Aranyérem a járási versenyen. A nyertes nevét a zsűri és a Hivatal is felírta.',
  },
  {
    id: 'j10_major', cim: 'Jegyzőkönyv szerint gépolaj', felvonas: 3,
    mikor: { esemeny: 'rankUp', felt: (S, ev) => ev.rang >= 3 },
    hely: { pos: [-180, 16.5], r: 20 },
    szereplok: ['geza'],
    sorok: [
      { ki: 'geza', anim: 'holding-right', szoveg: 'A major kulcsa. Hivatalosan elveszett. Nem hivatalosan itt van.' },
      { ki: 'geza', szoveg: 'A csarnokban főtt a fél megye pálinkája. Jegyzőkönyv szerint gépolaj.' },
      { ki: 'geza', szoveg: 'A terv százhúsz százalék volt. A gépolajból is.' },
    ],
    hatas: [{ horog: 'jelol', mit: 'ingatlan', id: 'major' }, { flag: 'major', ertek: 'latta' }],
    hirmondo: 'Pálinkabáró a járásban? A régi majorban állítólag kigyulladt a villany.',
  },
  {
    id: 'j11_gyari_ajanlat', cim: 'Az ajánlat', felvonas: 3,
    mikor: { felt: S => !!S.gyari?.legyozve },
    hely: { pos: [0, 13.4], r: 18, jon: true },
    szereplok: ['kristof'],
    sorok: [
      { ki: 'kristof', szoveg: 'A cégvezetés ajánlatot tesz. A receptjeiért.' },
      { ki: 'kristof', szoveg: 'Szép összeg. És a nevét se írjuk az üvegre. Senkiét se szoktuk.' },
    ],
    dontes: {
      opciok: [
        { szoveg: 'Nem eladó.',
          valasz: [{ ki: 'kristof', szoveg: 'Akkor a polcon találkozunk. Ott mi vagyunk a nagyobbak.' }],
          hatas: [{ flag: 'gyari', ertek: 'nem' }] },
        { szoveg: 'A vizezett receptet eladom.',
          valasz: [{ ki: 'kristof', anim: 'emote-yes', szoveg: 'Kiváló. Pont ilyet gyártunk eddig is.' }],
          hatas: [{ horog: 'penz', osszeg: 300000 }, { horog: 'gyariErosodik', ertek: 0.05 }, { flag: 'gyari', ertek: 'vizes' }] },
      ],
    },
    hirmondo: 'A Gyári új receptet ígér. A falu szerint ugyanazt, csak drágábban.',
  },
  {
    id: 'j12_kiraly', cim: 'Elévülés', felvonas: 3, befejezes: true,
    mikor: { esemeny: 'rankUp', felt: (S, ev) => ev.rang >= 4 },
    hely: { pos: [0, 13.4], r: 18, jon: true, jarmu: 'penzugyor', ora: [18, 21] },
    szereplok: ['erno'],
    hangjel: [{ id: 'jelenet:penzugyor' }],
    sorok: [
      { ki: 'erno', anim: 'holding-right', szoveg: 'Ezt harminc éve foglaltam le nagyapádtól. Bizonyítéknak.' },
      { ki: 'erno', szoveg: 'Az ügy elévült. Én meg jövőre nyugdíjba megyek.' },
      { ki: 'erno', szoveg: 'Visszaadom. Ez már nem bizonyíték. Emlék.' },
      { ki: 'erno', szoveg: 'A Hivatal azt kérdezi, mi lesz veled. Mondd meg, mit írjak.' },
    ],
    dontes: {
      opciok: [
        { szoveg: 'Kiváltom az engedélyt.',
          valasz: [{ ki: 'erno', anim: 'emote-yes', szoveg: 'Akkor pecsételek. Életemben először örömmel.' }],
          hatas: [{ horog: 'gyanuMindenhol', ertek: -100 }, { flag: 'befejezes', ertek: 'legalis' }, { horog: 'epilogus', id: 'legalis' }] },
        { szoveg: 'Maradok, ami vagyok.',
          valasz: [{ ki: 'erno', szoveg: 'Akkor az utódom keres majd. Nem lesz könnyű dolga. Az enyém se volt.' }],
          hatas: [{ flag: 'befejezes', ertek: 'kiraly' }, { horog: 'epilogus', id: 'kiraly' }] },
        { szoveg: 'Átadom a füzetet.',
          valasz: [{ ki: 'erno', szoveg: 'Szóval lesz utánad is valaki. Akkor az utódomnak is lesz dolga.' }],
          hatas: [{ flag: 'befejezes', ertek: 'atadas' }, { horog: 'epilogus', id: 'atadas' }] },
      ],
    },
    tovabbJatszhato: true,
  },
];

/** Az epilógusok: a befejező döntés után cetlik sora (3 × 5 mp), aztán a játék folytatódik. */
export const EPILOGUSOK = {
  legalis: [
    'Kisüstfalvi Főzde. Papíron is.',
    'Ernő nyugdíjba ment. Minden pénteken eljön egy kávéra.',
    'A pálinka ugyanaz. Csak most adót is fizet.',
  ],
  kiraly: [
    'A falu Kisüsti Királynak hív. A Hivatal másképp.',
    'Ernő utódja fiatal, szorgalmas, és nem iszik kávét.',
    'Nagyapa füzete betelt. Kezdtél egy újat.',
  ],
  atadas: [
    'Az unokaöcs egy hónap alatt megtanulta. Majdnem.',
    'Ernő nyugdíjas. A kerítésnél áll, és figyel. Csak megszokásból.',
    'A füzet első oldalára új cetli került: »Vigyázz a pénzügyőrre.«',
  ],
};

// ================================================================== szakadt füzetlapok (gyűjthetők, VÁZLAT)
/** Nagyapa füzetének szakadt lapjai a világban. Felvéve: a receptkönyvben a tipp megjelenik (felfedezés felfedezéssel).
 *  A kombinációk a tartalom.js OSSZETEVOK átalakításaiból (ellenőrizve). */
export const LAPOK = [
  { id: 'lap1', regio: 'tanya',     pos: [4.3, -9.0],    hely: 'a pajtában, a farakás mögött', szoveg: 'Előbb méz, aztán fahéj.\nNagyanyád titka. Nekem sose mondta el.', hatas: 'nagymama' },
  { id: 'lap2', regio: 'falu',      pos: [216, 9.5],     hely: 'a kocsma sörkertjében, egy asztal alatt', szoveg: 'Kávé, aztán csili.\nA kerítés nem tehet róla.', hatas: 'keritesszaggato' },
  { id: 'lap3', regio: 'felveg',    pos: [233, -187],    hely: 'a felvégi kút káváján', szoveg: 'Méz után propolisz.\nMinden bajra jó, csak a bajt kell megtalálni.', hatas: 'csodaszer' },
  { id: 'lap4', regio: 'szolohegy', pos: [-102, -97],    hely: 'a kilátópad deszkája alatt', szoveg: 'Akác után tölgy.\nPályázni kéne vele. De akkor kiderül, ki főzte.', hatas: 'hungarikum' },
  { id: 'lap5', regio: 'szolohegy', pos: [-166, -226],   hely: 'a pincesoron, egy ajtórésben', szoveg: 'Kökény, aztán paprika.\nHajnali hatkor, a perzselés előtt.', hatas: 'disznovagasi' },
  { id: 'lap6', regio: 'major',     pos: [-266, 136],    hely: 'a silók tövében, egy bádogdobozban', szoveg: 'Aranyfüst, aztán méz.\nEttől a vőfély is rímekben beszél.', hatas: 'lakodalmas' },
  { id: 'lap7', regio: 'kisvaros',  pos: [527, 266],     hely: 'a vasútállomás padján', szoveg: 'Tölgy, aztán vanília.\nA fővárosban ezt négy centiben mérik.', hatas: 'pesti' },
];

// ================================================================== Hírmondó: az első szám és a tutorial címei
/** Az első reggel (a t_alvas után) a napi összesítő Hírmondója ezekből válogat: a `ha` a tutorial-ctx flagjeire néz. */
export const HIRMONDO_ELSO = [
  { ha: null,            cim: 'Gazsi bácsi unokája átvette a tanyát. A kémény már az első nap füstölt.' },
  { ha: 'eladasKovacs',  cim: 'Kovács bácsi reggel elégedetten köszönt. A gyomra nem nyilatkozott.' },
  { ha: 'vizezett',      cim: 'A tanya kútjának vize ismét keresett cikk Kisüstfalván.' },
  { ha: 'elrejtette',    cim: 'A fehér autó lassított a tanyánál. Aztán gyorsított.' },
  { ha: 'nemRejtette',   cim: 'A fehér autó lassított a tanyánál. A pénzügyőr jegyzetelt valamit.' },
  { ha: null,            cim: 'Apróhirdetés: elveszett egy kupica. A becsületes megtaláló igya meg.', tipus: 'apro' },
  { ha: null,            cim: 'Statisztika: a faluban mindenki iszik, de alkoholista senki. Kérdezze meg bármelyiküket.', tipus: 'apro' },
];

// ================================================================== 4. VEVŐI PÁRBESZÉD-SABLONOK (44 figura)
/**
 * Alkalmak: uj (köszönés, hűség < 30) · torzs (köszönés, hűség ≥ 70) · alku (ellenajánlat/alku) ·
 * csalodott (rossz áru, késés) · figyelmeztet (a házkutatás előtti SMS, a sim razziaFigyelmeztetes-éhez).
 * Az elégedett sor a tartalom.js `koszon` mezője (változatlan), a rendelés a `keres` mező.
 */
export const VEVO_SOROK = {
  kovacs:    { uj: 'Jó reggelt. A gyomrom már kérdezte, hol késel.', torzs: 'Na, fiam. Mint nagyapáddal: egy kupica, egy szó.', alku: 'Nagyapád ennyiért adta. Igaz, az régen volt.', csalodott: 'Ezt a gyomrom nem fogadja el. Én se.', figyelmeztet: 'Fiam, a fehér autó a kocsmánál kérdezősködött. Rólad. Két óra.' },
  marika:    { uj: 'Aranyom, csak egy gyűszűnyit. Gyógyászati célra.', torzs: 'Hoztam pogácsát. A vérnyomásomnak nem jó, a tiédnek igen.', alku: 'Nyugdíjból élek, aranyom. Meg a pogácsából.', csalodott: 'Ezt a háziorvos se írná fel. Pedig ő mindent felír.', figyelmeztet: 'Aranyom, Ernő a postán a te nevedet betűzte. Pakolj el, két óra.' },
  bozsi:     { uj: 'A keresztfiam nevében jöttem. Ő nem tud róla.', torzs: 'Nagyanyád szeme van rajtad. A keze is, ha főzöl.', alku: 'Keresztanyának kedvezmény jár. Íratlan szabály.', csalodott: 'Ezt nagyanyád meg se kóstolta volna. Én is csak udvariasságból.', figyelmeztet: 'Fiam, a fehér autó az óratoronynál fordult. Feléd.' },
  tibi:      { uj: 'Szia. Pesten ezt kézművesnek hívják. Itt pálinkának.', torzs: 'A haverok már kérdezik, ki a »beszállítóm«. Titok.', alku: 'Pesten ennek a felét se kérik. Jó, a felét se adják.', csalodott: 'Ezt nem tudom sztoriként eladni. Ennek nincs sztorija.', figyelmeztet: 'Figyi, a szolgálati autó a kocsma előtt áll. Nem sört iszik. Hozzád jön.' },
  lajos:     { uj: 'Násznagy vagyok. Nálam minden hétvégén lagzi van.', torzs: 'Na, a falu legjobb főzője! A vőfély is ezt mondja.', alku: 'Tíz literből egy ajándék. Így szokás. Most találtam ki.', csalodott: 'Ezzel a menyasszonytánc fél óra alatt véget ér. Szégyen.', figyelmeztet: 'Komám, két óra múlva nálad a fehér autó. Ne kérdezd, honnan tudom.' },
  kocsmaros: { uj: 'Kocsma. Ennyi a bemutatkozás, a többit a vendég mondja.', torzs: 'A törzsvendégek már a te pálinkádat kérik. Név szerint.', alku: 'Úgyis vizezem. Miért fizessek a vízért?', csalodott: 'Ezt még a hétfő reggeli vendég is visszaküldené.', figyelmeztet: 'A sarokasztal ma nagyon fülelt. Ernő meg nagyon kérdezett. Két óra.' },
  orvos:     { uj: 'Jó napot. Fertőtlenítésre. Ezt írja a recept.', torzs: 'Kovács úrnak ma inkább szódát adjon. Orvosi javaslat.', alku: 'A betegeim is alkudnak. Rajtam. Mindig.', csalodott: 'Ezt nem írnám fel. Még magamnak se.', figyelmeztet: 'Diagnózis: két óra múlva házkutatás. Kezelés: pince.' },
  sogor:     { uj: 'A sógorom küldött. Hivatalosan nem.', torzs: 'A sógorom kérdezte, ki főzi. Mondtam: senki. Megnyugodott.', alku: 'Reprezentációra van keret. Csak nem ennyi.', csalodott: 'Ezt nem tehetem a sógorom asztalára. A sajátomra se.', figyelmeztet: 'A Hivatalból szóltak a sógornak, a sógor nekem. Két óra.' },
  piroska:   { uj: 'Postás vagyok. Mindent kézbesítek, ezt is.', torzs: 'A nyugdíjasok már téged várnak, nem a nyugdíjat.', alku: 'A csekkek mellé nem fér több. A pénztárcámba se.', csalodott: 'Ezt nem viszem a nyugdíj mellé. Megsértődnének.', figyelmeztet: 'Hivatalos levél ment ki a nevedre. Két óra, és jönnek.' },
  pista:     { uj: 'Mozdonyvezető voltam. Menetrendem: egy kupica, egy alvás.', torzs: 'Ez a pálinka pontos, mint a régi vonatok. Azok nem voltak.', alku: 'Nyugdíjas kedvezmény? A vasúton volt.', csalodott: 'Ez kisiklott, fiam. Visszatolatunk.', figyelmeztet: 'Fütyülök, fiam: két óra, és a fehér autó a kapudnál.' },
  jolan:     { uj: 'Kultúrház. Ma bál, holnap takarítás. Közte ez.', torzs: 'A bálon kérdezték, ki a szponzor. Mondtam: a kultúra.', alku: 'A kultúrára sosincs keret. Erre se nagyon.', csalodott: 'Ettől a zenekar is hamisan játszana. Hamisabban.', figyelmeztet: 'A bálon Ernő nem táncolt, csak figyelt. Ma hozzád indul.' },
  gabor:     { uj: 'Edző vagyok. A taktika: győzelem után, vereség után.', torzs: 'A csapat a te pálinkádra játszik. Nem a pályán, utána.', alku: 'Ha nyerünk, fizetek többet. Nem szoktunk nyerni.', csalodott: 'Ez gyenge, mint a védelmünk. Pedig az nagyon gyenge.', figyelmeztet: 'Piros lap közeleg: a fehér autó a pályánál áll. Két óra.' },
  dezso:     { uj: 'Hajnalban vágunk. A kupica előbb jön, mint a disznó.', torzs: 'Neked jár a legszebb kolbász. Meg a második legszebb is.', alku: 'Fizetek kolbásszal? Nem? Akkor kevesebb pénzzel.', csalodott: 'Ezzel a disznó se hinné el, hogy komoly a dolog.', figyelmeztet: 'Ernő ma nálam vett kolbászt. Meg rólad kérdezett. Két óra.' },
  ica:       { uj: 'Leánybúcsúra kell. Valami édes, de ne túl ártatlan.', torzs: 'A menyasszony téged is meghívott. A vőlegény még nem tudja.', alku: 'A boltban ennyiért három üveget kapok. Igaz, azt senki se inná.', csalodott: 'Ettől a koszorúslányok sírva fakadnának. Rossz értelemben.', figyelmeztet: 'Apu boltjában Ernő kávét vett, és rólad kérdezett. Két óra.' },
  sanyi:     { uj: 'Prímás vagyok. Hajnali négykor csak a pálinka hangol.', torzs: 'Írtam rólad egy csárdást. Szöveg nincs, csak koccintás.', alku: 'A zenekar négyfelé osztozik. A pálinkán nem.', csalodott: 'Ettől a hegedű is hamis lesz. Pedig ő nem iszik.', figyelmeztet: 'Hangold le magad: a fehér autó a lagzi felől hozzád indult.' },
  kati:      { uj: 'Tanítónő vagyok. Csak a tantestületnek. Szigorúan.', torzs: 'Jeles, csillagos. Az igazgató is így osztályozta.', alku: 'Pedagógusbérből? A harmadát kérem.', csalodott: 'Elégséges. Pirossal aláhúzva.', figyelmeztet: 'Rendkívüli óra: két óra múlva ellenőrzés nálad. Készülj.' },
  irma:      { uj: 'Irma vagyok, a muskátlik mögül. Mindent látok, aranyom.', torzs: 'A függöny mögül szurkolok neked. A szomszédnak ne mondd.', alku: 'A szomszédasszony olcsóbban kapja? Akkor én is.', csalodott: 'Ezt még a muskátlimra se önteném.', figyelmeztet: 'A függöny mögül láttam: a fehér autó feléd fordult.' },
  bandi:     { uj: 'Kiskertes vagyok. A paradicsom vízzel nő, én ezzel.', torzs: 'Hoztam paprikát. A pálinkához nem illik, a barátsághoz igen.', alku: 'Fizetek paradicsommal is. Most nagyon terem.', csalodott: 'Ettől még a csiga is otthagyná a salátát.', figyelmeztet: 'A kerítésen át hallottam: Ernő hozzád megy. Két óra.' },
  gizi:      { uj: 'A nyugdíjasklub nevében. Hetvenen vagyunk, mind szomjasak.', torzs: 'A klub tiszteletbeli tagja lettél. Szavazati jog nélkül.', alku: 'A klubkasszában ennyi van. Meg két gomb.', csalodott: 'Ezt a klub nem szavazza meg. Én se.', figyelmeztet: 'Rendkívüli klubülés: a fehér autó hozzád tart. Két óra.' },
  laci:      { uj: 'Hétvégi telkes vagyok. A pesti haverok azt hiszik, én főzöm.', torzs: 'A neten tízezren látták az üvegedet. A kezedet senki.', alku: 'Pesten ez a fele. Jó, nem. Pesten ez a dupla.', csalodott: 'Ezt a pesti haverok kiköpnék. Udvariasan, de kiköpnék.', figyelmeztet: 'A dűlőúton szembejött a fehér autó. A te kapud volt beírva.' },
  margit:    { uj: 'Gyógyfüves vagyok. Ez is gyógyfű, csak folyékony.', torzs: 'Neked kenőcsöt is csinálok belőle. Belsőleg.', alku: 'A kamilla ingyen nő. Ez miért nem?', csalodott: 'Ezt még a csalán is visszautasítaná.', figyelmeztet: 'A kártyám szerint jön a fehér autó. A szomszéd szerint is.' },
  ferenc:    { uj: 'Nyugalmazott tanár. Egy ujjnyit kérek. Az én ujjamból.', torzs: 'Jeles. Ha így folytatod, év végén dicséret.', alku: 'Az ár túlzás. Nyelvtanilag is.', csalodott: 'Elégtelen. Javítóvizsga a jövő héten.', figyelmeztet: 'Nem házi feladat: két óra múlva ellenőrzés.' },
  zoli:      { uj: 'Horgász vagyok. Hajnalban a stégen ez a takaróm.', torzs: 'Kifogtam a harcsát. Mondtam neki: a te pálinkád fogta.', alku: 'Horgászengedélyem van. Alkuengedélyem is.', csalodott: 'Ettől még a csali is elúszna.', figyelmeztet: 'Kapás van: a fehér autó rád horgászik. Két óra.' },
  eva:       { uj: 'Keresztlány vagyok. Diplomaosztóra kell, szép üvegben.', torzs: 'A tanszékvezető kérdezte, ki főzi. Mondtam: családi kutatócsoport.', alku: 'Ösztöndíjból élek. Abból is csak a felét kapom meg.', csalodott: 'Ezzel nem mehetek a tanszékre. Megbuktatnának.', figyelmeztet: 'Utánanéztem: Ernő ma hozzád megy. Forrás: Irma néni.' },
  kalman:    { uj: 'Pincegazda vagyok. A borom mellé valami komolyat.', torzs: 'A vendégeim már a te pálinkádért jönnek. A borom megsértődött.', alku: 'A borom évjáratos. Az árad ne legyen az.', csalodott: 'Ez a borom mellett szégyenkezik. Joggal.', figyelmeztet: 'A pincesoron fehér autó jár. Nem bort kóstol. Két óra.' },
  rozi:      { uj: 'Szüretre kell. A szedők enélkül csak nézik a tőkét.', torzs: 'A szedők már a nevedet éneklik. Rossz dallamra, de szívből.', alku: 'Fizetek musttal? Nem? Akkor kevesebb pénzzel.', csalodott: 'Ettől a szőlő is megsavanyodna.', figyelmeztet: 'Fiam, a hegyről lefelé jön a fehér autó. Most ne főzz.' },
  akos:      { uj: 'Túrázó vagyok. Napfelkeltére kell, a kilátóba.', torzs: 'A kilátóból koccintottam rád. A szél vitte a hírt.', alku: 'A hátizsákomban hely van. A pénztárcámban kevés.', csalodott: 'Ettől a kilátás is elhomályosul. Rossz értelemben.', figyelmeztet: 'A kilátóból látom: fehér autó kanyarog feléd. Két óra.' },
  titkar:    { uj: 'A vadásztársaságtól jöttem. A vadászbálra. Vadat nem hozok.', torzs: 'A társaság tiszteletbeli tagja vagy. Puska nélkül.', alku: 'A tagdíjból nem futja többre. A vadász amúgy is spórol.', csalodott: 'Ettől még a vaddisznó is kinevetne.', figyelmeztet: 'Hajtás indul: a fehér autó a dombon jön. Te vagy a vad.' },
  otto:      { uj: 'Borkóstoltató vagyok. A csoportnak háromszáz éves recept lesz.', torzs: 'A japán csoport négyszer fényképezte le az üvegedet.', alku: 'A csoport borravalóból él. Én a csoportból.', csalodott: 'Ezt a külföldi csoport is észrevenné. Pedig ők semmit.', figyelmeztet: 'Ernő tolmács nélkül is mindent ért. Két óra, rejts el mindent.' },
  tercsi:    { uj: 'Szüreti szakácsnő vagyok. Mellé kell, nem bele.', torzs: 'Neked mindig jut a pörköltből. A legjobb darab.', alku: 'A só ingyen van a pörkölthöz. Ehhez miért nincs kedvezmény?', csalodott: 'Ettől a pörkölt is leégne. Szégyenében.', figyelmeztet: 'A konyhaablakból látom: a fehér autó a hegyre fordul.' },
  geza:      { uj: 'Volt téeszelnök. Akkor is főztünk, csak gépolajnak hívtuk.', torzs: 'Ez, fiam, a terv százhúsz százaléka.', alku: 'Tervgazdaság: én mondom az árat, te bólintasz.', csalodott: 'Selejt. Régen ezért még jutalmat is adtak.', figyelmeztet: 'Régi kapcsolatom szólt: két óra, és ellenőrzés. Tűnj el.' },
  bence:     { uj: 'Juhász vagyok. A birkák nem kérdeznek. Én se.', torzs: 'A kutyám már farkat csóvál, ha jössz. Nekem soha.', alku: 'Birkával fizetnék. Nem? Pedig szép birka.', csalodott: 'Ezt még a birka se inná meg. Pedig ő a pocsolyából is iszik.', figyelmeztet: 'A legelőről látom: a fehér autó a major felé jön.' },
  szabina:   { uj: 'Lovarda. A zsűrinek kell. A ló vizet kap.', torzs: 'A zsűri a lovaimra tízest ad, rád tizenegyet.', alku: 'A lovak drágák. Te is az vagy.', csalodott: 'Ezzel a zsűri még a pónit is lepontozná.', figyelmeztet: 'Vágtass haza: a fehér autó a major felé kanyarodott.' },
  pityu:     { uj: 'Lakatos. Előbb a vas, aztán a kupica. Harminc éve.', torzs: 'A kapudra ingyen hegesztek zsanért. Holnap. Vagy holnapután.', alku: 'Hegesztek érte valamit. Mondjuk egy kisebb árat.', csalodott: 'Ennek rozsdaíze van. Én értek hozzá.', figyelmeztet: 'A fehér autó nálam volt szervizen. Rólad kérdeztek. Két óra.' },
  terez:     { uj: 'A major utolsó lakója vagyok. Meg a köszvényem.', torzs: 'Ha nem jössz, a köszvényem is hiányol.', alku: 'Egyedül élek. A számolás is egyedül megy.', csalodott: 'Ettől a köszvény se táncol. Csak ül.', figyelmeztet: 'Egyedül élek, de mindent hallok: jön a fehér autó.' },
  dominik:   { uj: 'Kézműves bár. Nálunk ez »artisan párlat«.', torzs: 'A táblára már a nevedet írom. Pontosabban a beceneved.', alku: 'A haszonkulcsom szent. A te árad nem.', csalodott: 'Ez nem artisan. Ez csak rossz.', figyelmeztet: 'A Hivatal portása nálunk iszik. Azt mondta: két óra.' },
  szeles:    { uj: 'Dr. Szeles. Ügyfélajándékba. A számlát hagyjuk.', torzs: 'Ha valaha ügyvéd kell, tudod, hol találsz. Kedvezménnyel.', alku: 'Jogilag az ár tárgyalható. Erkölcsileg is.', csalodott: 'Erre jogi kifogásom van. Ízlésbeli is.', figyelmeztet: 'Nem jogi tanács, de két óra múlva házkutatás lesz nálad.' },
  margo:     { uj: 'Vasúti büfé. Az utolsó vonat előtti »vonatpótlóhoz«.', torzs: 'A vonat késik, a pálinkád soha. Ezért szeretünk.', alku: 'A büfé áraival nem lehet nyerni. Az enyémmel se.', csalodott: 'Ezzel még a vonatpótló busz is lekési magát.', figyelmeztet: 'Ernő jegyet vett a ti falutokba. Két óra.' },
  klari:     { uj: 'Kétszáz vendég, mind csak egy pohárral. Négyszáz pohár.', torzs: 'A lányom esküvője óta te vagy a család főzője.', alku: 'Az esküvő drága. Legalább te ne legyél az.', csalodott: 'Ezzel az anyós is elégedetlen lenne. Én vagyok az anyós.', figyelmeztet: 'A násznép egyik unokaöccse pénzügyőr. Szólt: két óra.' },
  viktor:    { uj: 'Újságíró. Tényfeltárás. Belülről.', torzs: 'A cikkben a neved nem szerepel. A pálinkád a főszereplő.', alku: 'A lap nem fizet. Én se nagyon.', csalodott: 'Erről negatív kritikát írnék. Névvel.', figyelmeztet: 'Forrásom szerint két óra múlva razzia nálad. Forrásvédelem.' },
  patikus:   { uj: 'Patikus. Nem gyógyszer, de azért ne tagadjuk le.', torzs: 'A szirupok mögött áll, a legjobb helyen. Mögött.', alku: 'A gyógyszer támogatott. Ez sajnos nem.', csalodott: 'Ennek mellékhatása van. Főhatása nincs.', figyelmeztet: 'Vényre írom: két óra múlva ellenőrzés. Adagolás: azonnal.' },
  robi:      { uj: 'Vállalkozó. Nálam az üzlet aranyfüsttel köttetik.', torzs: 'Partner. Nálam ez sokat jelent. Számlát nem.', alku: 'Mondok egy számot. Te mondasz egy nagyobbat. Én egy kisebbet.', csalodott: 'Ezzel nem szerződést kötök, csak haragot.', figyelmeztet: 'Az üzletfelem a Hivatalban dolgozik. Két óra. Nem én mondtam.' },
  panni:     { uj: 'Kolibulira kell. Ha anyu kérdezi, szilvás tea.', torzs: 'A koliban legenda lettél. Névtelenül.', alku: 'Diákkedvezmény? Van diákigazolványom.', csalodott: 'Ezt még a koliban se innák meg. Pedig ott mindent.', figyelmeztet: 'A csoportban írták: a fehér autó felétek megy. Két óra.' },
  ilonka:    { uj: 'Halotti torra. A megboldogult is ezt kérte volna.', torzs: 'Nagyapádat is így szolgáltam ki. Most te szolgálsz ki engem.', alku: 'A tor drága. A gyász ingyen van.', csalodott: 'Ezt a megboldogult se kérte volna. Pedig mindent kért.', figyelmeztet: 'Ernő a nagypiacon nem vett semmit, csak kérdezett. Rólad.' },
};

/** Hangulat szerinti közös sorok: a figura saját sora helyett vagy után, ha a helyzet ezt kéri. */
export const VEVO_HANGULAT = {
  gyari: [  // a régióban a Gyári akciózik, de a vevő hozzád jött
    'Láttam a Gyári akcióját. Láttam, és itt vagyok.',
    'A Gyári olcsóbb. A Gyári nem köszön vissza.',
    'A sógorom a Gyárit issza. Azóta nem beszélünk. Ő nem tud.',
  ],
  keses: [  // a rendelés ablaka végén, vagy lejárt rendelés után az első új rendelésben
    'Vártalak. A falu az ilyet megjegyzi.',
    'Már azt hittem, a pénzügyőr ért ide előbb.',
  ],
  bizalmas: [  // hűség ≥ 90: a figyelmeztetés mellé, ritkán
    'Te már családtag vagy. Csak ezt a családnak ne mondd.',
    'Nagyapád is így kezdte. Aztán ő lett a falu. Te is az leszel.',
  ],
};

/** Tiszta segédfüggvény: a vevő mondata az alkalomhoz és a hangulathoz. `r` = 0–1 közti véletlen (determinisztikushoz a sim r()-je). */
export function vevoSor(id, alkalom, { huseg = 0, gyari = false, keses = false } = {}, r = Math.random) {
  const v = VEVO_SOROK[id];
  if (!v) return '';
  const pick = a => a[Math.floor(r() * a.length) % a.length];
  if (alkalom === 'koszon') {
    if (keses) return pick(VEVO_HANGULAT.keses);
    if (gyari && r() < 0.5) return pick(VEVO_HANGULAT.gyari);
    return huseg >= 70 ? v.torzs : v.uj;
  }
  if (alkalom === 'figyelmeztet' && huseg >= 90 && r() < 0.25) return v.figyelmeztet + ' ' + pick(VEVO_HANGULAT.bizalmas);
  return v[alkalom] || '';
}

/** Ellenőrzés a próbához: minden vevőnek minden alkalomra van sora (a tartalom.js VEVOK_TELJES id-jeivel vetendő össze). */
export const VEVO_ALKALMAK = ['uj', 'torzs', 'alku', 'csalodott', 'figyelmeztet'];
