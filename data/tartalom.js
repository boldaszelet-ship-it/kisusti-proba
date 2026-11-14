// Kisüsti v0.3 — a birodalmi szimuláció tartalma: számok és szövegek egy helyen.
// Tervezői hangolás itt történik, a game/sim/*.js csak a szabályokat tartalmazza.
// Szatíra: azon nevetünk, amit a magyar ivási kultúráról mondunk, nem azon, aki iszik.
// Kitalált falu, kitalált szereplők; valódi márka, hatóság, személy nincs benne.

// ------------------------------------------------------------------ gyümölcs és fa
/** ar: a pálinka literenkénti alapára; piac: 10 kg ára a kofánál; erik: napok a termőre fordulásig; kg: napi termés. */
export const GYUMOLCSOK = {
  szilva: { nev: 'szilvapálinka', gyumolcs: 'szilva', gyumolcsot: 'szilvát', ar: 8000,  piac: 1500, erik: 3, kg: 7, rank: 0, szin: 0x4b2470 },
  barack: { nev: 'barackpálinka', gyumolcs: 'barack', gyumolcsot: 'barackot', ar: 10000, piac: 2500, erik: 4, kg: 6, rank: 0, szin: 0xe39a3b },
  korte:  { nev: 'körtepálinka',  gyumolcs: 'körte',  gyumolcsot: 'körtét',  ar: 9000,  piac: 2000, erik: 4, kg: 6, rank: 0, szin: 0xb7c24a },
  alma:   { nev: 'almapálinka',   gyumolcs: 'alma',   gyumolcsot: 'almát',   ar: 6500,  piac: 1000, erik: 3, kg: 8, rank: 0, szin: 0xc8423a },
  birs:   { nev: 'birspálinka',   gyumolcs: 'birs',   gyumolcsot: 'birset',  ar: 13000, piac: 4000, erik: 5, kg: 5, rank: 2, szin: 0xd9c040 },
};
export const FAJTAK = Object.keys(GYUMOLCSOK);
/** A piac árszintje: minden vevői ár (rendelés, érték, terjesztő) ezzel szorzódik. A fő gazdasági hangolókar
 *  (a probe_birodalom.mjs botja ezzel méri: első ingatlan 4–8., major 12–22. nap). */
export const PIAC_SZORZO = 2.2;

/** A fa napi vízvesztése, a trágya és a permet hatásideje (nap), a kártevő napi esélye permet nélkül. */
export const FA = { kiszaradas: 0.45, tragyaNap: 3, permetNap: 3, kartevo: 0.12, maxTermesNap: 3 };

// ------------------------------------------------------------------ cefre, üst, érlelés, palack
/** A cefre adalékai: 1 adag 20 l cefrére. */
export const ADALEKOK = {
  eleszto: { nev: 'fajélesztő', ido: 0.6, q: 4, terfogat: 1, kihozatal: 1 },
  enzim:   { nev: 'pektinbontó enzim', ido: 1, q: 1, terfogat: 1, kihozatal: 1.15 },
  cukor:   { nev: 'kristálycukor', ido: 1.1, q: -8, terfogat: 1.25, kihozatal: 1 },
};
/** A túlerjedt cefre ennyi óra után kezd ecetesedni (óránként −1 pont). */
export const CEFRE_ROMLIK_ORA = 36;

/** Üstszintek. cap: töltet (l), q/fok: bónusz, kihozatal: szorzó, auto: magától fut (fűtő nélkül is), ido: auto főzés (perc).
 *  Ár: készpénzből vagy számláról (a gazdabolt mindkettőt elfogadja). */
export const USTOK = {
  kisusti:  { nev: 'kisüst',        cap: 30, q: 0, fok: 0,  kihozatal: 1.0,  auto: false, ido: 300, ar: 0,      rank: 0 },
  dupla:    { nev: 'dupla üst',     cap: 60, q: 6, fok: 5,  kihozatal: 0.95, auto: false, ido: 300, ar: 150000, rank: 1 },
  oszlopos: { nev: 'oszlopos üst',  cap: 120, q: 4, fok: 12, kihozatal: 1.1, auto: true,  ido: 200, ar: 650000, rank: 3 },
};
export const USTSOR = ['kisusti', 'dupla', 'oszlopos'];
export const CSIGA = { nev: 'rézcsiga-hűtő', ar: 40000, kihozatal: 1.1, rank: 1 };
export const KEMENYSAPKA = { nev: 'kéménysapka', ar: 30000, fust: 0.5, rank: 1 };
/** Ennyi liter pálinka lesz 1 l cefréből az automata főzésnél (a kézi főzés a meglévő minigame-ből jön). */
export const AUTO_KIHOZATAL = 0.065;

/** Érlelőhordók (30 l). q: napi pont, maxQ; ertek: napi értékszorzó-növekmény, maxErtek; hatas: 3 nap után hozzáadott hatás. */
export const HORDOK = {
  akac:   { nev: 'akáchordó',   q: 2, maxQ: 12, ertek: 0.03, maxErtek: 0.20, szin: 'halvány arany', hatas: 'aranylo', cap: 30 },
  tolgy:  { nev: 'tölgyhordó',  q: 3, maxQ: 15, ertek: 0.05, maxErtek: 0.35, szin: 'borostyán',     hatas: 'hordos',  cap: 30 },
  eperfa: { nev: 'eperfahordó', q: 2, maxQ: 10, ertek: 0.06, maxErtek: 0.40, szin: 'mélyarany',     hatas: 'aranylo', cap: 30 },
};

/** Palackok: a demizsonból kimért pálinka 0,92-es szorzót kap, a palackozott ezt. */
export const UVEGEK = {
  '02': { l: 0.2, nev: 'pikoló',     szorzo: 1.12 },
  '05': { l: 0.5, nev: 'félliteres', szorzo: 1.08 },
  '07': { l: 0.7, nev: 'díszüveg',   szorzo: 1.15 },
  '10': { l: 1.0, nev: 'literes',    szorzo: 1.0 },
};
export const DEMIZSON_SZORZO = 0.92;
export const CIMKEK = {
  nincs:      { nev: 'címke nélkül', szorzo: 1.0, cikk: null },
  kezi:       { nev: 'kézírásos', szorzo: 1.03, cikk: null, szoveg: '„SZILVA 2026 — NE IDD MEG, NAGYAPÁÉ”' },
  nyomtatott: { nev: 'nyomtatott', szorzo: 1.10, cikk: 'cimke_nyomtatott' },
  arany:      { nev: 'aranyozott', szorzo: 1.22, cikk: 'cimke_arany' },
};

// ------------------------------------------------------------------ beszállítók és cikkek
/** A beszállítók a regions.js SUPPLIERS-éhez: elérhetőség rangja, leadási pont (NODES-id), fizetés, szállítási idő (perc). */
export const SZALLITOK = {
  kofa:      { rank: 0, hely: 'hegy_lab',  fizetes: 'kp',      ido: [30, 90],   leadas: 'a hegy lába, a kidőlt akác alatt (a kofa unokája hozza biciklin)' },
  gazdabolt: { rank: 0, hely: 'kapu',      fizetes: 'barmely', ido: [90, 180],  leadas: 'a tanya kapuja (házhoz hozzák)' },
  mehesz:    { rank: 1, hely: 'felveg_kp', fizetes: 'kp',      ido: [60, 180],  leadas: 'a felvégi kút káváján' },
  erdesz:    { rank: 1, hely: 'hegy_ut1',  fizetes: 'kp',      ido: [120, 240], leadas: 'a kilátópad a hegyi úton' },
  fuszeres:  { rank: 2, hely: 'falu_kp',   fizetes: 'szamla',  ido: [240, 480], leadas: 'a falusi buszmegálló (a busz hozza)' },
};
/** Szállítmány ennyi perc után eltűnik a leadási pontról („elvitte valaki”). */
export const SZALLITMANY_ELVESZ = 36 * 60;

/** Minden megrendelhető cikk. tipus: gyumolcs (10 kg / db), csemete, adalek, osszetevo, uveg, cimke, hordo, eszkoz. */
export const CIKKEK = {
  gyumolcs_szilva: { nev: '10 kg szilva',  tipus: 'gyumolcs', gy: 'szilva', ar: 1500, sz: 'kofa', q: 65 },
  gyumolcs_barack: { nev: '10 kg barack',  tipus: 'gyumolcs', gy: 'barack', ar: 2500, sz: 'kofa', q: 65 },
  gyumolcs_korte:  { nev: '10 kg körte',   tipus: 'gyumolcs', gy: 'korte',  ar: 2000, sz: 'kofa', q: 65 },
  gyumolcs_alma:   { nev: '10 kg alma',    tipus: 'gyumolcs', gy: 'alma',   ar: 1000, sz: 'kofa', q: 62 },
  gyumolcs_birs:   { nev: '10 kg birs',    tipus: 'gyumolcs', gy: 'birs',   ar: 4000, sz: 'kofa', q: 68, rank: 2 },
  csemete_szilva:  { nev: 'szilvacsemete', tipus: 'csemete', gy: 'szilva', ar: 3000, sz: 'gazdabolt' },
  csemete_barack:  { nev: 'barackcsemete', tipus: 'csemete', gy: 'barack', ar: 4500, sz: 'gazdabolt' },
  csemete_korte:   { nev: 'körtecsemete',  tipus: 'csemete', gy: 'korte',  ar: 4000, sz: 'gazdabolt' },
  csemete_alma:    { nev: 'almacsemete',   tipus: 'csemete', gy: 'alma',   ar: 2500, sz: 'gazdabolt' },
  csemete_birs:    { nev: 'birscsemete',   tipus: 'csemete', gy: 'birs',   ar: 8000, sz: 'gazdabolt', rank: 2 },
  tragya:   { nev: 'zsák érett trágya', tipus: 'eszkoz', ar: 800,  sz: 'gazdabolt' },
  permet:   { nev: 'permetszer',        tipus: 'eszkoz', ar: 1200, sz: 'gazdabolt' },
  eleszto:  { nev: 'fajélesztő',        tipus: 'adalek', ar: 600,  sz: 'gazdabolt' },
  enzim:    { nev: 'pektinbontó enzim', tipus: 'adalek', ar: 900,  sz: 'gazdabolt' },
  cukor:    { nev: 'kristálycukor (1 kg)', tipus: 'osszetevo', ar: 400, sz: 'gazdabolt' },
  uveg_02:  { nev: 'pikolós üveg',      tipus: 'uveg', ar: 120, sz: 'gazdabolt' },
  uveg_05:  { nev: 'félliteres üveg',   tipus: 'uveg', ar: 180, sz: 'gazdabolt' },
  uveg_07:  { nev: 'díszüveg',          tipus: 'uveg', ar: 650, sz: 'gazdabolt', rank: 1 },
  uveg_10:  { nev: 'literes üveg',      tipus: 'uveg', ar: 220, sz: 'gazdabolt' },
  cimke_nyomtatott: { nev: 'nyomtatott címke', tipus: 'cimke', ar: 60,  sz: 'gazdabolt' },
  cimke_arany:      { nev: 'aranyozott címke', tipus: 'cimke', ar: 350, sz: 'gazdabolt', rank: 2 },
  hordo_akac:   { nev: 'akác érlelőhordó',   tipus: 'hordo', ar: 25000, sz: 'erdesz' },
  hordo_tolgy:  { nev: 'tölgy érlelőhordó',  tipus: 'hordo', ar: 40000, sz: 'erdesz', rank: 2 },
  hordo_eperfa: { nev: 'eperfa érlelőhordó', tipus: 'hordo', ar: 90000, sz: 'erdesz', rank: 3 },
  // összetevők (ágyas, ízesítés) — 1 adag 1 liter pálinkára
  meggy:       { nev: 'meggy',          tipus: 'osszetevo', ar: 500,  sz: 'kofa' },
  bodza:       { nev: 'bodzavirág',     tipus: 'osszetevo', ar: 300,  sz: 'kofa' },
  csipkebogyo: { nev: 'csipkebogyó',    tipus: 'osszetevo', ar: 350,  sz: 'kofa' },
  paprika:     { nev: 'őrölt paprika',  tipus: 'osszetevo', ar: 300,  sz: 'kofa' },
  mez:         { nev: 'akácméz',        tipus: 'osszetevo', ar: 900,  sz: 'mehesz' },
  propolisz:   { nev: 'propolisz',      tipus: 'osszetevo', ar: 1400, sz: 'mehesz' },
  dio:         { nev: 'zöld dió',       tipus: 'osszetevo', ar: 600,  sz: 'erdesz' },
  tolgyforgacs:{ nev: 'tölgyforgács',   tipus: 'osszetevo', ar: 700,  sz: 'erdesz' },
  akacforgacs: { nev: 'akácforgács',    tipus: 'osszetevo', ar: 500,  sz: 'erdesz' },
  gyogynoveny: { nev: 'gyógynövény',    tipus: 'osszetevo', ar: 450,  sz: 'erdesz' },
  kokeny:      { nev: 'kökény',         tipus: 'osszetevo', ar: 300,  sz: 'erdesz' },
  fenyorugy:   { nev: 'fenyőrügy',      tipus: 'osszetevo', ar: 400,  sz: 'erdesz' },
  fahej:       { nev: 'fahéj',          tipus: 'osszetevo', ar: 700,  sz: 'fuszeres' },
  csili:       { nev: 'csili',          tipus: 'osszetevo', ar: 500,  sz: 'fuszeres' },
  anizs:       { nev: 'ánizs',          tipus: 'osszetevo', ar: 600,  sz: 'fuszeres' },
  vanilia:     { nev: 'vanília',        tipus: 'osszetevo', ar: 1600, sz: 'fuszeres' },
  kave:        { nev: 'kávé',           tipus: 'osszetevo', ar: 800,  sz: 'fuszeres' },
  szegfuszeg:  { nev: 'szegfűszeg',     tipus: 'osszetevo', ar: 500,  sz: 'fuszeres' },
  aranyfust:   { nev: 'ehető aranyfüst', tipus: 'osszetevo', ar: 3500, sz: 'fuszeres', rank: 3 },
};

// ------------------------------------------------------------------ keverés: hatások és átalakulások
/** Hatások. ertek: az értékszorzóhoz adott rész (negatív is lehet). alap: ezt adja az összetevő; a többi csak átalakulással jön létre. */
export const HATASOK = {
  mezes:    { nev: 'Mézes', ertek: 0.20, szin: 0xe8b84a },
  gyogy:    { nev: 'Gyógyhatású (állítólag)', ertek: 0.25, szin: 0x7fb069 },
  dios:     { nev: 'Diós', ertek: 0.15, szin: 0x6b4a2b },
  hordos:   { nev: 'Hordós', ertek: 0.25, szin: 0x9a5b2a },
  aranylo:  { nev: 'Aranyló', ertek: 0.18, szin: 0xe0b040 },
  fuves:    { nev: 'Füves', ertek: 0.12, szin: 0x5f8f3a },
  fahejas:  { nev: 'Fahéjas', ertek: 0.15, szin: 0xa0522d },
  tuzes:    { nev: 'Tüzes', ertek: 0.15, szin: 0xd03a20 },
  anizsos:  { nev: 'Ánizsos', ertek: 0.10, szin: 0xcfcfa8 },
  vanilias: { nev: 'Vaníliás', ertek: 0.20, szin: 0xf2e2b0 },
  ebreszto: { nev: 'Ébresztő', ertek: 0.12, szin: 0x4a3020 },
  meggyes:  { nev: 'Meggyes', ertek: 0.18, szin: 0x9b1b30 },
  bodzas:   { nev: 'Bodzás', ertek: 0.10, szin: 0xf4f0d0 },
  csipkes:  { nev: 'Csipkés', ertek: 0.12, szin: 0xd2491e },
  fanyar:   { nev: 'Fanyar', ertek: 0.05, szin: 0x4a3a6a },
  szegfus:  { nev: 'Szegfűszeges', ertek: 0.10, szin: 0x7a3b2e },
  fenyves:  { nev: 'Fenyves', ertek: 0.10, szin: 0x2f6b3a },
  edes:     { nev: 'Édes', ertek: 0.06, szin: 0xfff0f0 },
  paprikas: { nev: 'Paprikás', ertek: 0.08, szin: 0xc0301a },
  csillogo: { nev: 'Csillogó', ertek: 0.30, szin: 0xffd700 },
  // csak átalakulással
  nagymama:        { nev: 'Nagymama titka', ertek: 0.55, szin: 0xb87333, ritka: true },
  lakodalmas:      { nev: 'Lakodalmas', ertek: 0.60, szin: 0xffe4e1, ritka: true },
  keritesszaggato: { nev: 'Kerítésszaggató', ertek: 0.45, szin: 0x8b0000, ritka: true },
  karacsonyi:      { nev: 'Karácsonyi', ertek: 0.40, szin: 0xb22222, ritka: true },
  orvosi:          { nev: 'Orvosi rendelvény', ertek: 0.50, szin: 0xe0f0ff, ritka: true },
  disznovagasi:    { nev: 'Disznóvágási', ertek: 0.35, szin: 0xc06050, ritka: true },
  hungarikum:      { nev: 'Hungarikum-gyanús', ertek: 0.50, szin: 0x2e8b57, ritka: true },
  pesti:           { nev: 'Pesti kézműves', ertek: 0.65, szin: 0x303030, ritka: true },
  vadasz:          { nev: 'Vadászpálinka', ertek: 0.35, szin: 0x556b2f, ritka: true },
  nasznagyi:       { nev: 'Násznagyi', ertek: 0.40, szin: 0xffc0cb, ritka: true },
  polgarmesteri:   { nev: 'Polgármesteri', ertek: 0.70, szin: 0xdaa520, ritka: true },
  gyomorerosito:   { nev: 'Gyomorerősítő', ertek: 0.30, szin: 0x6b8e23, ritka: true },
  csodaszer:       { nev: 'Csodaszer', ertek: 0.45, szin: 0x9acd32, ritka: true },
  vernyomas:       { nev: 'Vérnyomásra jó', ertek: 0.35, szin: 0xdc143c, ritka: true },
  udvarlo:         { nev: 'Udvarló', ertek: 0.40, szin: 0xff69b4, ritka: true },
  hetfo:           { nev: 'Hétfő reggeli', ertek: -0.25, szin: 0x808080, ritka: true },
  kozmas:          { nev: 'Kozmás', ertek: -0.30, szin: 0x505050, ritka: true },
};
export const MAX_HATAS = 8;

/** Összetevő → az alap hatása, és amit a meglévő hatásokból csinál ([miből, mivé]). */
export const OSSZETEVOK = {
  mez:          { hatas: 'mezes',    atalakit: [['csillogo', 'lakodalmas'], ['fanyar', 'csipkes'], ['gyogy', 'csodaszer']] },
  propolisz:    { hatas: 'gyogy',    atalakit: [['mezes', 'csodaszer'], ['fuves', 'orvosi'], ['edes', 'gyogy']] },
  dio:          { hatas: 'dios',     atalakit: [['lakodalmas', 'nasznagyi'], ['kozmas', 'dios'], ['fahejas', 'karacsonyi']] },
  tolgyforgacs: { hatas: 'hordos',   atalakit: [['aranylo', 'hungarikum'], ['fenyves', 'vadasz'], ['anizsos', 'kozmas']] },
  akacforgacs:  { hatas: 'aranylo',  atalakit: [['hordos', 'hungarikum'], ['mezes', 'aranylo'], ['kozmas', 'fanyar']] },
  gyogynoveny:  { hatas: 'fuves',    atalakit: [['fanyar', 'gyomorerosito'], ['gyogy', 'orvosi'], ['edes', 'fuves']] },
  fahej:        { hatas: 'fahejas',  atalakit: [['mezes', 'nagymama'], ['szegfus', 'karacsonyi'], ['paprikas', 'kozmas']] },
  csili:        { hatas: 'tuzes',    atalakit: [['ebreszto', 'keritesszaggato'], ['vanilias', 'kozmas'], ['fenyves', 'vadasz']] },
  anizs:        { hatas: 'anizsos',  atalakit: [['fuves', 'gyomorerosito'], ['meggyes', 'kozmas'], ['csipkes', 'vernyomas']] },
  vanilia:      { hatas: 'vanilias', atalakit: [['hordos', 'pesti'], ['meggyes', 'udvarlo'], ['tuzes', 'edes']] },
  kave:         { hatas: 'ebreszto', atalakit: [['tuzes', 'keritesszaggato'], ['vanilias', 'pesti'], ['edes', 'hetfo']] },
  meggy:        { hatas: 'meggyes',  atalakit: [['vanilias', 'udvarlo'], ['gyogy', 'vernyomas']] },
  bodza:        { hatas: 'bodzas',   atalakit: [['gyogy', 'vernyomas'], ['kozmas', 'bodzas'], ['hetfo', 'csipkes']] },
  csipkebogyo:  { hatas: 'csipkes',  atalakit: [['hetfo', 'gyogy'], ['paprikas', 'fanyar']] },
  kokeny:       { hatas: 'fanyar',   atalakit: [['edes', 'fanyar'], ['dios', 'gyomorerosito']] },
  szegfuszeg:   { hatas: 'szegfus',  atalakit: [['fahejas', 'karacsonyi'], ['fenyves', 'kozmas']] },
  fenyorugy:    { hatas: 'fenyves',  atalakit: [['tuzes', 'vadasz'], ['mezes', 'gyogy']] },
  cukor:        { hatas: 'edes',     atalakit: [['ebreszto', 'hetfo'], ['meggyes', 'edes'], ['nagymama', 'mezes']] },
  paprika:      { hatas: 'paprikas', atalakit: [['fanyar', 'disznovagasi'], ['tuzes', 'disznovagasi'], ['vanilias', 'kozmas']] },
  aranyfust:    { hatas: 'csillogo', atalakit: [['edes', 'lakodalmas'], ['nagymama', 'polgarmesteri'], ['hungarikum', 'polgarmesteri']] },
};

/** Új hatás felfedezésekor a receptkönyv bejegyzése (nagyapa margójegyzete). */
export const HATAS_JEGYZET = {
  nagymama: '„Ezt nagyanyád csinálta így. Nekem sosem mondta el, hogyan.”',
  lakodalmas: '„Ettől a vőfély is rímekben beszél.”',
  keritesszaggato: '„Óvatosan. A kerítés nem tehet róla.”',
  karacsonyi: '„Szenteste után a második legszebb ünnep: a december huszonhatodika.”',
  orvosi: '„Recept nélkül kapható. Recepttel is.”',
  disznovagasi: '„Hajnali hatkor, a perzselés előtt. Ez a rend.”',
  hungarikum: '„Pályázni kéne vele. De akkor kiderül, ki főzte.”',
  pesti: '„A fővárosban ezt négy centiben mérik, és a pohárnak neve van.”',
  vadasz: '„A vad megmenekül, a vadász megvigasztalódik.”',
  nasznagyi: '„A násznagynak külön üveg jár. Ez az.”',
  polgarmesteri: '„Reprezentációs célra. A számlát ne keresd.”',
  gyomorerosito: '„Evés előtt, evés után, és ha nincs evés, akkor helyette.”',
  csodaszer: '„Minden bajra jó, csak a bajt kell megtalálni hozzá.”',
  vernyomas: '„Az orvos azt mondta, mérsékelten. Mérsékelten töltöttem.”',
  udvarlo: '„Nagyanyádat is ezzel kértem meg. Igent mondott, aztán főzni tanított.”',
  hetfo: '„Ezt ne add el. Ezt a hétfő reggel adja el neked.”',
  kozmas: '„Na, ezt elrontottad, fiam. A kútba vele.”',
};

// ------------------------------------------------------------------ találkozóhelyek (NODES-id)
export const TALALKOZOK = {
  kapu:      { nev: 'a tanya kapuja', regio: 'tanya' },
  hegy_lab:  { nev: 'a hegy lába, a kidőlt akác', regio: 'tanya' },
  falu_kp:   { nev: 'a piactér', regio: 'falu' },
  hid_ny:    { nev: 'a híd a Fő úton', regio: 'falu' },
  felveg_le: { nev: 'a dűlőút sarka', regio: 'felveg' },
  felveg_kp: { nev: 'a felvégi kút', regio: 'felveg' },
  hegy_ut1:  { nev: 'a kilátópad', regio: 'szolohegy' },
  hegy_kp:   { nev: 'a pincesor', regio: 'szolohegy' },
  major_le:  { nev: 'a major bejárója', regio: 'major' },
  major_kp:  { nev: 'a silók mögött', regio: 'major' },
  kv_be:     { nev: 'a benzinkút parkolója', regio: 'kisvaros' },
  kv_kp:     { nev: 'a vasútállomás', regio: 'kisvaros' },
};
export const REGIO_TALALKOZOK = {
  tanya: ['kapu'], falu: ['falu_kp', 'hid_ny'], felveg: ['felveg_kp', 'felveg_le'],
  szolohegy: ['hegy_kp', 'hegy_ut1'], major: ['major_kp', 'major_le'], kisvaros: ['kv_kp', 'kv_be'],
};

// ------------------------------------------------------------------ vevők (44)
// l: [min, max]; kedvel/utal: hatás-id-k; ajanlo: aki bemutat (null = a régió megnyílásakor kóstoltatható);
// hely: fix találkozó (a kezdő hét a kapuhoz jön); igenyes: palackot és címkét vár; kezd: az első naptól vevő.
const V = (id, nev, regio, o, keres, koszon, extra = {}) => ({ id, nev, regio, tipus: null, l: [0.5, 1], minQ: 40, szorzo: 1, kedvel: [], utal: [], ajanlo: null, hely: null, igenyes: false, ...o, keres, koszon, ...extra });
export const VEVOK_TELJES = [
  // tanya és a kezdő hét (a GDD figurái, a kapuhoz jönnek)
  V('kovacs', 'Kovács bácsi', 'tanya', { tipus: 'szilva', l: [0.5, 1], minFok: 50, minQ: 40, kedvel: ['ebreszto', 'gyomorerosito'], hely: 'kapu', kezd: true },
    'Egy kupicát reggelire. A gyomornak. Az orvos is mondta.', 'Ez a gyomornak való. Meg a szívnek. Meg a hétfőnek.', { gyenge: 'Ezzel a gyomrot nem lehet fertőtleníteni, fiam.' }),
  V('marika', 'Marika néni', 'tanya', { tipus: 'barack', l: [0.5, 0.5], maxFok: 45, minQ: 50, kedvel: ['mezes', 'vernyomas'], utal: ['tuzes'], hely: 'kapu', kezd: true },
    'A vérnyomásomra, aranyom. Szigorúan gyógyászati célra.', 'Napi egy gyűszűnyi. Gyógyszertári adag.', { eros: 'Ettől még a kanárim is berúgna! Gyengébbet, aranyom.' }),
  V('bozsi', 'Bözsi néni, a keresztanya', 'tanya', { tipus: 'barack', l: [0.5, 1], maxFok: 48, minQ: 55, kedvel: ['mezes', 'nagymama'], ajanlo: 'marika' },
    'Csak a szívemre egy gyűszűnyit. Meg a keresztfiam szívére is, ő messze lakik, majd én megiszom helyette.', 'Ilyet főzött a nagyanyád is. Csak az övé erősebb volt, de ezt ne mondd el neki.'),
  V('tibi', 'Tibi, a szomszéd fia Pestről', 'tanya', { l: [0.5, 1], minQ: 70, szorzo: 1.3, igenyes: true, kedvel: ['pesti', 'hordos'], ajanlo: 'kovacs' },
    'Pesten ezt kóstolópohárban adják, nyolcszorosáért. Én csak a sztorit viszem hozzá.', 'Ezt otthon úgy mutatom be, hogy „családi recept”. Gyakorlatilag az.'),
  V('lajos', 'Lajos, a násznagy', 'falu', { l: [1.5, 3], minFok: 60, minQ: 30, kedvel: ['lakodalmas', 'nasznagyi'], hely: 'kapu', kezd: true },
    'Lagzi lesz! Ami hatvan fok alatt van, az üdítő.', 'Ezzel a menyasszonytánc is két órával tovább tart.', { gyenge: 'Ez fröccs, nem pálinka. A vőfély ki fog nevetni.' }),
  V('kocsmaros', 'a kocsmáros', 'falu', { tipus: 'szilva', l: [1.5, 2], minQ: 30, szorzo: 0.7, hely: 'kapu', kezd: true },
    'A törzsvendégeknek. Úgyis vizezem, de ezt ne mondd el senkinek.', 'A törzsvendégek nem kérdezik, honnan van. Az ő titkuk, hogy miért.'),
  V('orvos', 'a körzeti orvos', 'falu', { tipus: 'korte', l: [1, 1], minFok: 50, minQ: 60, kedvel: ['gyogy', 'orvosi'], hely: 'kapu', kezd: true },
    'Fertőtlenítésre. Belsőleg.', 'Kitűnő. Felírom magamnak.', { gyenge: 'Ezzel a bacilus is csak koccintana.' }),
  V('sogor', 'a polgármester sógora', 'falu', { tipus: 'barack', l: [1, 1], minFok: 50, minQ: 75, szorzo: 1.3, kedvel: ['polgarmesteri', 'csillogo'], hely: 'kapu', kezd: true },
    'Reprezentációs célra. Számlát nem kérek.', 'A sógorom nevében köszönöm. Ő nem tud róla, és ez így van jól.'),
  V('piroska', 'Piroska, a postás', 'falu', { tipus: 'korte', l: [0.5, 1], minQ: 40, kedvel: ['mezes'], hely: 'kapu', kezd: true },
    'A nyugdíjasoknak viszem a nyugdíj mellé. Hagyomány.', 'A nyugdíj elfogy, ez nem. Ez a különbség.'),
  // falu
  V('pista', 'Pista bácsi, a nyugdíjas mozdonyvezető', 'falu', { tipus: 'szilva', l: [0.5, 1], minFok: 55, minQ: 45, kedvel: ['tuzes'], ajanlo: 'kovacs' },
    'Negyven évig fütyültem a mozdonyon. Most már a fütyülős jár nekem.', 'Ez igen. Ettől a sorompó is felnyílik magától.'),
  V('jolan', 'Jolán, a kultúrház vezetője', 'falu', { tipus: 'barack', l: [1, 2], minQ: 55, kedvel: ['vanilias', 'udvarlo'], ajanlo: 'piroska' },
    'Szüreti bálra. A zenekar szárazon nem játszik, a közönség szárazon nem táncol.', 'A kultúra támogatásáért hálás köszönet. Ezt nem írom a beszámolóba.'),
  V('gabor', 'Gábor, a focicsapat edzője', 'falu', { tipus: 'korte', l: [1, 1.5], minFok: 50, minQ: 45, kedvel: ['ebreszto', 'keritesszaggato'], ajanlo: 'lajos' },
    'A meccs utánra. Ha nyerünk, ünneplünk. Ha kikapunk, vigasztalódunk. Döntetlennél mindkettő.', 'Ezzel a tizenegyesek is bemennek. Legalábbis utólag úgy meséljük.'),
  V('dezso', 'Dezső, a disznóvágó', 'falu', { tipus: 'szilva', l: [1, 1.5], minFok: 55, minQ: 40, kedvel: ['disznovagasi', 'paprikas', 'tuzes'], ajanlo: 'kocsmaros' },
    'Disznóvágáskor hajnali hatkor kell egy kupica, különben a disznó sem hiszi el, hogy komoly a dolog.', 'A hurka is jobb lesz tőle. Nem bele, mellé.'),
  V('ica', 'Ica, a vegyesboltos lánya', 'falu', { tipus: null, l: [0.5, 1], maxFok: 45, minQ: 50, kedvel: ['meggyes', 'edes', 'udvarlo'], utal: ['kozmas'], ajanlo: 'piroska' },
    'Leánybúcsúra. Valami édeset, amitől nem lesz baja senkinek. Na jó, kicsit.', 'A menyasszony azt mondta, ilyen az esküvőn is legyen. A vőlegény is azt mondta.'),
  V('sanyi', 'Sanyi, a lakodalmas prímás', 'falu', { l: [1, 2], minFok: 60, minQ: 40, kedvel: ['lakodalmas', 'keritesszaggato'], ajanlo: 'lajos' },
    'Hajnali négykor a prímás már csak pálinkára húzza. A bőgős már semmire.', 'Erre még egy csárdást rávágunk. Meg még egyet.'),
  V('kati', 'Kati, a tanítónő', 'falu', { tipus: 'korte', l: [0.5, 1], maxFok: 46, minQ: 60, kedvel: ['bodzas', 'mezes'], ajanlo: 'orvos' },
    'A tantestületi évzáróra. Mindenki hoz valamit, én az orvosságot.', 'Jeles. Csillagos.'),
  // Felvég
  V('irma', 'Irma néni a muskátlik mögül', 'felveg', { tipus: 'barack', l: [0.5, 0.5], maxFok: 42, minQ: 55, kedvel: ['mezes', 'vernyomas'] },
    'A szomszédasszonynak ne szólj. Ő is ilyet kér, de én kértem előbb.', 'Ezt a függöny mögül is látom, hogy jó.'),
  V('bandi', 'Bandi bácsi, a kiskertes', 'felveg', { tipus: 'szilva', l: [0.5, 1], minFok: 50, minQ: 45, kedvel: ['fuves', 'gyomorerosito'], ajanlo: 'irma' },
    'Permetezés után kell. Belsőleg. Hogy a vegyszer ne bántson.', 'A paradicsom is jobban terem, ha a gazdája jókedvű.'),
  V('gizi', 'Gizi néni, a nyugdíjasklub elnöke', 'felveg', { tipus: 'korte', l: [1.5, 2], maxFok: 48, minQ: 50, kedvel: ['mezes', 'gyogy', 'csodaszer'], ajanlo: 'irma' },
    'A klub születésnapjára. Hetvenen vagyunk, és mind egészségesek. Ennek köszönhetően.', 'Ezt felírom a klub krónikájába. Jelszóval.'),
  V('laci', 'Laci, a hétvégi telkes pesti', 'felveg', { tipus: 'barack', l: [0.5, 1], minQ: 70, szorzo: 1.3, igenyes: true, kedvel: ['hordos', 'pesti', 'aranylo'], ajanlo: 'bandi' },
    'Ugye ez bio? A pesti barátaim azt hiszik, én főztem.', 'Ezt a borospincémbe teszem. Igen, van borospincém. Egy polc.'),
  V('margit', 'Margit, a gyógyfüves asszony', 'felveg', { l: [0.5, 1], minQ: 55, kedvel: ['fuves', 'gyogy', 'orvosi'], ajanlo: 'gizi' },
    'Belsőleg, kívülről, dörzsölésre. Ez minden bajra jó, aranyom, csak a bajt kell megtalálni hozzá.', 'Ebből kenőcs lesz. Meg ami a kenőcsből kimarad.'),
  V('ferenc', 'Ferenc, a nyugalmazott tanár', 'felveg', { tipus: 'korte', l: [0.5, 1], minFok: 45, minQ: 70, kedvel: ['hordos', 'dios'], ajanlo: 'gizi' },
    'Egy ujjnyit esténként. Az egészségre. Az ujjam vastagságát ne kérdezd.', 'Tantárgyi dicséret.'),
  V('zoli', 'Zoli, a horgász', 'felveg', { tipus: 'szilva', l: [0.5, 1], minFok: 55, minQ: 40, kedvel: ['tuzes', 'fenyves'], ajanlo: 'bandi' },
    'Hajnalban a stégre. A hal nem harap, de legalább nekem melegem van.', 'Ha kifogom a harcsát, ezzel ünneplek. Ha nem, ezzel is.'),
  V('eva', 'Éva, a keresztlány', 'felveg', { tipus: 'barack', l: [0.5, 1], minQ: 65, igenyes: true, kedvel: ['udvarlo', 'meggyes'], ajanlo: 'irma' },
    'Diplomaosztóra, ajándékba a tanszékvezetőnek. A bácsikám szerint így szokás.', 'Ha ezt kibontja, a szakdolgozatomat is újraolvassa. Jóindulattal.'),
  // Szőlőhegy
  V('kalman', 'Kálmán, a pincegazda', 'szolohegy', { l: [1, 2], minQ: 75, szorzo: 1.2, igenyes: true, kedvel: ['hordos', 'hungarikum'] },
    'A borom mellé kell valami komolyabb. A vendég a második pohár után már pálinkát kér, a harmadik után a nótát.', 'Ez a borom mellett sem szégyenkezik. A borom szégyenkezik mellette.'),
  V('rozi', 'Rozi néni a présház mellől', 'szolohegy', { tipus: 'szilva', l: [1, 2], minQ: 45, kedvel: ['mezes', 'dios'], ajanlo: 'kalman' },
    'Szüretkor a szedőknek. A munka csak pálinkával indul, különben a szőlő megsértődik.', 'A szedők már énekelnek. Pedig még csak tíz óra.'),
  V('akos', 'Ákos, a túrázó', 'szolohegy', { tipus: 'barack', l: [0.5, 0.5], minQ: 60, kedvel: ['fenyves', 'csipkes'], ajanlo: 'kalman' },
    'Fönt a kilátónál, napfelkeltére. A kilátás szebb, ha az ember fel is melegszik.', 'Innen az egész megye látszik. Ezzel kettő.'),
  V('titkar', 'a vadásztársaság titkára', 'szolohegy', { tipus: 'szilva', l: [1.5, 2.5], minFok: 55, minQ: 50, kedvel: ['vadasz', 'fenyves', 'tuzes'], ajanlo: 'rozi' },
    'A vadászbálra. A vaddisznót úgysem lőjük le, legalább koccintsunk.', 'A trófea a falra kerül, ez meg a fejünkbe.'),
  V('otto', 'Ottó, a borkóstoltató', 'szolohegy', { l: [1, 1.5], minQ: 75, szorzo: 1.4, igenyes: true, kedvel: ['aranylo', 'hordos', 'hungarikum'], ajanlo: 'kalman' },
    'A külföldi csoportnak. Elmondom nekik, hogy háromszáz éves recept. Ne javíts ki.', 'Ezt a japán csoport is megtapsolja. A német csoport kétszer kér.'),
  V('tercsi', 'Tercsi, a szüreti szakácsnő', 'szolohegy', { tipus: 'korte', l: [1, 1], minQ: 50, kedvel: ['dios', 'mezes', 'nagymama'], ajanlo: 'rozi' },
    'A pörköltbe nem teszek. Mellé. Mellé kell.', 'Ettől a pörkölt is jobban sikerül. Senki nem tudja, miért.'),
  // Major
  V('geza', 'Géza, a volt téeszelnök', 'major', { tipus: 'szilva', l: [1.5, 2.5], minFok: 50, minQ: 45, kedvel: ['hordos', 'karacsonyi'] },
    'A régi szép időkre. Akkor is főztünk, csak jegyzőkönyvbe vettük, hogy gépolaj.', 'Ez a tervet százhúsz százalékra teljesíti.'),
  V('bence', 'Bence, a juhász', 'major', { tipus: 'szilva', l: [0.5, 1], minFok: 55, minQ: 40, kedvel: ['tuzes', 'fuves'], ajanlo: 'geza' },
    'A birkák nem szólnak. Én se. Ez a mi megállapodásunk.', 'A kutyám rám néz. Rosszallóan. De ő nem iszik.'),
  V('szabina', 'Szabina, a lovarda tulajdonosa', 'major', { tipus: 'barack', l: [1, 1.5], minQ: 70, szorzo: 1.3, igenyes: true, kedvel: ['aranylo', 'csillogo'], ajanlo: 'geza' },
    'A lovasnapon a zsűrinek. A ló vizet kap, a zsűri ezt.', 'A zsűri ma nagyon elnéző lesz. Minden lónak tízes.'),
  V('pityu', 'Pityu, a lakatos', 'major', { tipus: 'korte', l: [0.5, 1], minFok: 50, minQ: 40, kedvel: ['ebreszto', 'keritesszaggato'], ajanlo: 'bence' },
    'Munka után. Előtte a vas, utána a kupica. Ez a sorrend, harminc éve.', 'Erre a kapura még egy zsanért ráhegesztek. Holnap.'),
  V('terez', 'Teréz néni, a major utolsó lakója', 'major', { tipus: 'alma', l: [0.5, 1], maxFok: 45, minQ: 45, kedvel: ['gyogy', 'csodaszer', 'mezes'], ajanlo: 'geza' },
    'A vénasszonyok nyarára. Meg télire. Meg a kettő közé.', 'Ettől a köszvényem is táncra perdül. Én nem, csak a köszvény.'),
  // Kisváros
  V('dominik', 'Dominik, a kézműves bár tulajdonosa', 'kisvaros', { l: [1, 2], minQ: 85, szorzo: 1.8, igenyes: true, kedvel: ['pesti', 'hordos', 'hungarikum'], utal: ['edes'] },
    'Nálunk ez „artisan nemzeti párlat”, négy centi, centije hatszáz forint. Ne mondd el, mennyiért vettem.', 'Kraft. Autentikus. Terroáros. Ezt írom ki a táblára.'),
  V('szeles', 'dr. Szeles, az ügyvéd', 'kisvaros', { tipus: 'barack', l: [0.7, 1.4], minQ: 80, szorzo: 1.6, igenyes: true, kedvel: ['aranylo', 'polgarmesteri'], ajanlo: 'dominik' },
    'Ügyfélajándék. Többet mond, mint egy szerződés, és nem kell aláírni.', 'Erre nincs jogi kifogásom. Egyre sincs.'),
  V('margo', 'Margó, a vasúti büfés', 'kisvaros', { tipus: 'szilva', l: [1.5, 2], minQ: 40, szorzo: 0.9, kedvel: ['ebreszto'] },
    'Az utolsó vonat előtt mindig van, aki kér egy „vonatpótlót”.', 'A menetrend úgyis csak ajánlás.'),
  V('klari', 'Klári, a menyasszony anyja', 'kisvaros', { l: [2, 4], minFok: 55, minQ: 60, szorzo: 1.2, kedvel: ['lakodalmas', 'nasznagyi', 'udvarlo'], ajanlo: 'margo' },
    'Kétszáz vendég, és mind azt mondja, hogy ő csak egy pohárral iszik. Számoltam: négyszáz pohár.', 'A lányom boldog lesz. A vőlegény családja meg irigy. Mindkettő kell.'),
  V('viktor', 'Viktor, a helyi lap újságírója', 'kisvaros', { tipus: 'korte', l: [0.5, 1], minQ: 65, kedvel: ['ebreszto', 'hungarikum'], ajanlo: 'margo' },
    'A cikkhez kell. Tényfeltáró riport. Belülről.', 'A cikk címe: „Rejtélyes eredetű, kiváló minőségű”. Név nélkül.'),
  V('patikus', 'a kisvárosi patikus', 'kisvaros', { tipus: 'korte', l: [0.5, 1], minQ: 80, szorzo: 1.3, igenyes: true, kedvel: ['orvosi', 'gyogy', 'csodaszer'], ajanlo: 'szeles' },
    'Nem gyógyszer. De ha valaki megkérdezi, azért ne tagadjuk le.', 'Ezt a polcra teszem, a köhögés elleni szirupok mögé. Mögé.'),
  V('robi', 'Robi, a vállalkozó', 'kisvaros', { l: [1.5, 3], minQ: 75, szorzo: 1.5, igenyes: true, kedvel: ['csillogo', 'polgarmesteri', 'lakodalmas'], ajanlo: 'dominik' },
    'Üzleti vacsora. Ha a pálinkán aranyfüst van, a szerződés már alá is van írva.', 'Ezt a projektet ezzel adtam el. A projektet még nem tudom, mi.'),
  V('panni', 'Panni, a hazajáró egyetemista', 'kisvaros', { tipus: 'barack', l: [0.5, 1], maxFok: 45, minQ: 50, kedvel: ['meggyes', 'udvarlo', 'edes'], ajanlo: 'viktor' },
    'Kollégiumi bulira. Ha anyu kérdezi, ez szilvás tea.', 'A kolesz legendája leszek. Meg a tiéd.'),
  V('ilonka', 'Ilonka néni a nagypiacról', 'kisvaros', { tipus: 'korte', l: [1, 1.5], minQ: 55, kedvel: ['mezes', 'karacsonyi'], ajanlo: 'margo' },
    'Halotti torra. A megboldogult is ezt itta volna, ha kéri. Mindig kérte.', 'Szép volt. A megboldogult is mondaná.'),
];
/** A kóstoltatás válaszai. */
export const KOSTOL = {
  igen: ['„Ez orvosság, fiam. Hozz még.”', '„Na, ezt hívom én pálinkának. A többi csak gyümölcslé volt.”', '„Ettől kinyílt a szemem. Meg a pénztárcám.”', '„Megyek, szólok a sógornak is.”'],
  nem: ['„Köszönöm, de én a megszokottnál maradok.”', '„Erős? Gyenge? Inkább más.”', '„Majd ha jobban sikerül, fiam.”', '„Ettől a kutya is elbújik.”'],
};

// ------------------------------------------------------------------ terjesztők
/** felvetel: belépő (kp); jutalek: a bevételből; maxVevo; kockazat: napi lebukási alapesély. */
export const TERJESZTOK = [
  { id: 'postas',    nev: 'Laci, a postás',             regio: 'falu',      rank: 1, felvetel: 20000,  jutalek: 0.20, maxVevo: 6,  kockazat: 0.03, mondas: 'A nyugdíj mellé, a csekkek közé. Senki nem nézi meg, mi van a táskámban.' },
  { id: 'buszsofor', nev: 'Csaba, a buszsofőr',         regio: 'falu',      rank: 1, felvetel: 30000,  jutalek: 0.15, maxVevo: 8,  kockazat: 0.04, mondas: 'A busz megáll minden faluban. A csomagtartó is.' },
  { id: 'hentes',    nev: 'Imre, a felvégi hentes',     regio: 'felveg',    rank: 2, felvetel: 45000,  jutalek: 0.18, maxVevo: 8,  kockazat: 0.03, mondas: 'A kolbász mellé jár egy kis gyógyszer. Így szokás.' },
  { id: 'fodrasz',   nev: 'Teca, a fodrász',            regio: 'felveg',    rank: 2, felvetel: 35000,  jutalek: 0.22, maxVevo: 10, kockazat: 0.06, mondas: 'Nálam mindenki mindent elmond. Hát még ha kap is valamit.' },
  { id: 'pinceor',   nev: 'Vince, a pincesor öregje',   regio: 'szolohegy', rank: 2, felvetel: 60000,  jutalek: 0.15, maxVevo: 8,  kockazat: 0.02, mondas: 'Ötven éve ülök a pince előtt. Engem már a fal is ismer.' },
  { id: 'traktoros', nev: 'Józsi, a traktoros',         regio: 'major',     rank: 3, felvetel: 90000,  jutalek: 0.12, maxVevo: 12, kockazat: 0.03, mondas: 'A pótkocsiban szalma van. Alatta meg az, ami alatta van.' },
  { id: 'pultos',    nev: 'Dorina, a kisvárosi pultos', regio: 'kisvaros',  rank: 4, felvetel: 150000, jutalek: 0.25, maxVevo: 12, kockazat: 0.05, mondas: 'A pult alatt mindig van egy üveg „házi”. Most már több.' },
];

// ------------------------------------------------------------------ alkalmazottak
export const SZEREPEK = {
  unokaocs: { nev: 'Unokaöcs', feladat: 'kertész – öntöz, trágyáz, szed', ber: 3000, nevek: ['Peti', 'Bence', 'Marci', 'Dani'] },
  neni:     { nev: 'Szomszéd néni', feladat: 'cefréz és palackoz', ber: 3500, nevek: ['Juci néni', 'Erzsike néni', 'Manci néni'] },
  feri:     { nev: 'Feri bácsi', feladat: 'főzőmester – magától üzemelteti az üstöt, és ha nincs néni, a cefrét is megcsinálja', ber: 6000, nevek: ['Feri bácsi', 'Laci bácsi', 'Gyula bácsi'] },
  sogor:    { nev: 'Sógor', feladat: 'fuvaros – átveszi a szállítmányt, elrejti a pálinkát, tölti a terjesztőket és beszedi tőlük a pénzt', ber: 5000, nevek: ['a sógor', 'a kisebbik sógor', 'a koma'] },
};
/** Ha nincs pénz a bérre, egy fél liter pálinkával is beérik; két kifizetetlen nap után felmondanak. */
export const BER_UVEG_L = 0.5;

// ------------------------------------------------------------------ rang és XP
export const RANGOK = ['Kontár', 'Főzőlegény', 'Üstmester', 'Pálinkabáró', 'Kisüsti Király'];
/** Szintek: [rangindex, alfokozat, kezdő XP]. */
export const SZINTEK = [
  [0, 1, 0], [0, 2, 60], [0, 3, 150],
  [1, 1, 260], [1, 2, 380], [1, 3, 520],
  [2, 1, 680], [2, 2, 900], [2, 3, 1150],
  [3, 1, 1450], [3, 2, 2000], [3, 3, 2700],
  [4, 1, 3600], [4, 2, 5200], [4, 3, 7200], [4, 4, 9800], [4, 5, 13000],
];
export const XP = { eladasFt: 1 / 1500, fozes: 10, ujVevo: 25, ujRecept: 8, ujHatas: 10, terjesztoFt: 1 / 3000 };

// ------------------------------------------------------------------ pénz, járművek
/** dunyhaRazzia: házkutatáskor (ha találtak valamit) a dunyha alatti pénzből ennyi fölött mindent elvisznek. */
export const BANK = { napiBefizetes: 30000, napiFelvetel: 150000, mosasDij: 0.05, kezdoSzamla: 50000, dunyhaRazzia: 300000 };
/** sebesseg m/s (valós), rejtett: csomagtér-rejtek literben, ar számláról. */
export const JARMUVEK = {
  gyalog:  { nev: 'gyalog', sebesseg: 6, rejtett: 0, ar: 0, rank: 0 },
  bicikli: { nev: 'nagyapa biciklije, felújítva', sebesseg: 10, rejtett: 1, ar: 25000, rank: 0 },
  kocka:   { nev: 'a kis kockaautó', sebesseg: 22, rejtett: 8, ar: 180000, rank: 1 },
  traktor: { nev: 'traktor pótkocsival', sebesseg: 13, rejtett: 40, ar: 600000, rank: 2 },
  furgon:  { nev: 'fehér furgon „HŰTŐTT ÁRU” felirattal', sebesseg: 20, rejtett: 80, ar: 1400000, rank: 4 },
};

// ------------------------------------------------------------------ törvény
export const TORVENY = {
  fustOra: 2.2,          // üstönként óránként ennyi gyanú a füstből
  ejjeliFust: 1.3,       // éjjel a füst kevésbé látszik, de a fény igen: szorzó
  eladas: 3.5,           // eladásonként (a hűséges vevő fele ennyit pletykál)
  terjesztoEladas: 1.2,
  kifutas: 15,
  csokkenOra: 1.6,       // óránkénti felejtés
  alvas: 20,
  besugoSzorzo: 1.5,
  hazkutatasKuszob: 100,
  razziaFigyelmeztetes: 120,  // perc: ennyivel előbb szól a hűséges vevő
  birsagAlap: 50000, birsagLiter: 6000, birsagUst: 30000, pecsetPerc: 24 * 60,
  motozasLiter: 3, motozasKp: 150000, motozasBirsag: 30000,
  jarorSebesseg: 15,     // m/s
};
/** Régiónként egy besúgó. A csendje egy üveggel megvehető. */
export const BESUGOK = {
  tanya:     { nev: 'Kovácsné a kerítés mögül', csend: 'Egy üveg, és három napig nem látott semmit. „Én csak a muskátlit locsolom.”' },
  falu:      { nev: 'a kocsma sarokasztalánál ülő nyugdíjas', csend: '„Én nem láttam semmit. De ha még egy ilyet hozol, akkor sem.”' },
  felveg:    { nev: 'Irénke a függöny mögött', csend: '„A függönyt mostantól behúzom. Három napig.”' },
  szolohegy: { nev: 'a hegyőr unokaöccse', csend: '„A hegyen sok minden füstöl. Például a kolbász.”' },
  major:     { nev: 'a silóőr', csend: '„A siló üres, a szemem csukva. Ez a munkaköröm.”' },
  kisvaros:  { nev: 'a Hivatal portása', csend: '„A portán nem látni semmit. Ezért portás.”' },
};

// ------------------------------------------------------------------ rivális
export const GYARI = {
  nev: 'a Gyári',
  leiras: 'Nagyüzemi kommersz főzde a Kisvárosban: „gyári íz, gyári ár”.',
  kezdNap: 7, akcioNap: 2, arSzorzo: 0.85, gyakorisag: 0.7, husegVedelem: 70,
  szlogenek: [
    'A Gyári: két liter kommersz 1 990 forintért. „Gyári íz, gyári ár.”',
    'A Gyári: „Pálinka? Nálunk az is van. Valami ahhoz hasonló.”',
    'A Gyári: most 30 % kedvezmény! „Ami hatvan fok alatt van, az nálunk akciós.”',
    'A Gyári: „Nem kell tudni, miből készült. Elég, ha olcsó.”',
  ],
};

// ------------------------------------------------------------------ Nagyapa füzete (küldetéssor)
/** cel: a kuldetes.js ellenőrzőjének kulcsa; jutalom: {xp, kp, cikk:{id:db}}. */
export const KULDETESEK = [
  { id: 'k01', cim: 'Az első cefre', cel: 'cefre', szoveg: '„A gyümölcs a hordóba, a fedél rá, a türelem melléd. Fél nap.”', jutalom: { xp: 30, cikk: { eleszto: 2 } } },
  { id: 'k02', cim: 'Az első főzés', cel: 'fozes60', szoveg: '„Az előpárlat a macskának se kell. Vágd le, aztán figyeld a csepegést.”', jutalom: { xp: 50, kp: 3000 } },
  { id: 'k03', cim: 'Az első vevő', cel: 'eladas', szoveg: '„Kovács bácsi reggel jön, a gyomrára hivatkozik. Ne vitatkozz vele.”', jutalom: { xp: 50, cikk: { uveg_05: 6 } } },
  { id: 'k04', cim: 'Ültess fát', cel: 'ultetes', szoveg: '„Aki fát ültet, az a jövőnek főz. Aki nem, az a kofának fizet.”', jutalom: { xp: 40, cikk: { tragya: 2 } } },
  { id: 'k05', cim: 'Az első ágyas', cel: 'keveres', szoveg: '„Egy kanál méz, egy marék meggy. A recept fejben van, a többi kísérletezés.”', jutalom: { xp: 60, cikk: { meggy: 2 } } },
  { id: 'k06', cim: 'Kóstoltass!', cel: 'kostolo', szoveg: '„Az első pohár ingyen van. A második már hagyomány.”', jutalom: { xp: 60 } },
  { id: 'k07', cim: 'A rejtekhely', cel: 'rejtes', szoveg: '„A pince alatt van még egy pince. Arról nem tud senki. Most már te is.”', jutalom: { xp: 50 } },
  { id: 'k08', cim: 'Az első terjesztő', cel: 'terjeszto', szoveg: '„Egyedül nem győzöd. Laci, a postás amúgy is mindenkihez becsönget.”', jutalom: { xp: 80, kp: 10000 } },
  { id: 'k09', cim: 'Présház a hegyen', cel: 'preshaz', szoveg: '„A hegyen a présházak mélyek, a szomszédok messze. Ott lehet igazán főzni.”', jutalom: { xp: 120 } },
  { id: 'k10', cim: 'Hordós érlelés', cel: 'erleles3', szoveg: '„A hordó a türelem iskolája. Három nap alatt is látszik, mit tanult.”', jutalom: { xp: 100 } },
  { id: 'k11', cim: 'Feri bácsi', cel: 'feri', szoveg: '„Feri bácsi negyven éve főz. Józanul is tud, de nem szereti.”', jutalom: { xp: 100 } },
  { id: 'k12', cim: 'A tiszta pénz', cel: 'mosas', szoveg: '„A pénz nem büdös. Csak a forrása. Egy kocsma mindent kiszellőztet.”', jutalom: { xp: 150 } },
  { id: 'k13', cim: 'Nagymama titka', cel: 'nagymama', szoveg: '„Nagyanyád mindig mézet tett bele, aztán valami barnát. Kitalálod.”', jutalom: { xp: 150, cikk: { mez: 3 } } },
  { id: 'k14', cim: 'A régi major', cel: 'major', szoveg: '„A major csarnokában egykor a fél megye pálinkája főtt. Jegyzőkönyv szerint gépolaj.”', jutalom: { xp: 250 } },
  { id: 'k15', cim: 'Kisvárosi vevő', cel: 'kisvaros', szoveg: '„A városiak a címkét is megisszák. Szép üveget vigyél.”', jutalom: { xp: 200 } },
  { id: 'k16', cim: 'A Gyári ellen', cel: 'gyari', szoveg: '„A Gyári olcsó. Te jobb vagy. A falu ezt tudja, csak emlékeztetni kell.”', jutalom: { xp: 300, kp: 50000 } },
  { id: 'k17', cim: 'Kisüsti Király', cel: 'kiraly', szoveg: '„Na, fiam. Most már te vagy, akiről a falu beszél. Nagyapád büszke. A Hivatal kevésbé.”', jutalom: { xp: 500 } },
];

// ------------------------------------------------------------------ indulás
export const KEZDES = {
  szamla: BANK.kezdoSzamla,
  cikkek: { eleszto: 4, uveg_05: 10, tragya: 1 },
  fak: [['szilva', 'erett'], ['szilva', 'erett'], ['barack', 'erett']],
  nyitoUzenet: 'Nagyapa füzete, első oldal: „A pajtában az üst, a kertben a fa, a faluban a vevő. A többit megtanulod. Vigyázz a pénzügyőrre.”',
};
