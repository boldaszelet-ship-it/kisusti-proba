// Kisüsti v0.3 — a térkép közös adatai (a szimuláció és a világ is innen olvas).
// Koordináták méterben: x kelet, z dél, y fel. A tanya udvarának közepe (0,0), a Fő út a z = 16,5 vonalon fut.
// Az azonosítók (id) szerződés: a sim, a világ és a UI ezekre hivatkozik. Pozíciót finomítani szabad, id-t átnevezni nem.

export const BOUNDS = { x0: -420, x1: 720, z0: -420, z1: 460 };

/** Régiók: rang szerint nyílnak (rank = a szükséges rangszint indexe a sim RANKS tömbjében). */
export const REGIONS = [
  { id: 'tanya',     nev: 'Nagyapa tanyája',  center: [0, 0],       r: 40,  rank: 0, leiras: 'Az udvar, a pajta, az üst. Innen indulsz.' },
  { id: 'falu',      nev: 'Kisüstfalva',      center: [230, 20],    r: 90,  rank: 0, leiras: 'Kocsma, vegyesbolt, posta, piactér, buszmegálló.' },
  { id: 'felveg',    nev: 'Felvég',           center: [230, -190],  r: 80,  rank: 1, leiras: 'Kertes házak, nyugdíjasok, kíváncsi szomszédok.' },
  { id: 'szolohegy', nev: 'Szőlőhegy',        center: [-170, -230], r: 110, rank: 2, leiras: 'Présházak a dombon, pincesor, kilátás mindenre.' },
  { id: 'major',     nev: 'A régi major',     center: [-270, 140],  r: 90,  rank: 3, leiras: 'Elhagyott közös gazdaság: nagy csarnok, kevés szem.' },
  { id: 'kisvaros',  nev: 'Kisváros',         center: [530, 270],   r: 130, rank: 4, leiras: 'Vasútállomás, nagypiac, a Hivatal, a pénzes vevők.' },
];

/** Megvehető ingatlanok. slots: alkalmazotti ágyak; ustok: üsthely; hordo: erjesztő hordóhely; rejtek: rejtekhely (l). */
export const PROPERTIES = [
  { id: 'tanya',    regio: 'tanya',     nev: 'Nagyapa tanyája',      pos: [0, 0],        ar: 0,       slots: 1, ustok: 1, hordo: 2,  rejtek: 30,  kert: 6 },
  { id: 'preshaz',  regio: 'szolohegy', nev: 'Présház a hegyen',     pos: [-150, -240],  ar: 380000,  slots: 2, ustok: 2, hordo: 4,  rejtek: 120, kert: 10 },
  { id: 'major',    regio: 'major',     nev: 'A régi major csarnoka', pos: [-281.4, 123.9],  ar: 1600000, slots: 5, ustok: 4, hordo: 10, rejtek: 400, kert: 24 },
  { id: 'pince',    regio: 'kisvaros',  nev: 'Kisvárosi pince',      pos: [500, 300],    ar: 2400000, slots: 3, ustok: 2, hordo: 6,  rejtek: 600, kert: 0 },
];

/** Tisztességes üzletek a pénzmosáshoz (napi tisztára mosható összeg = mosas). */
export const BUSINESSES = [
  { id: 'kocsma',   regio: 'falu',     nev: 'A Rozsdás Kancsó kocsma', pos: [213, 6.4],   ar: 450000,  mosas: 40000 },
  { id: 'langos',   regio: 'falu',     nev: 'Lángossütő a piacon',     pos: [251, 36.8],  ar: 260000,  mosas: 25000 },
  { id: 'bolt',     regio: 'felveg',   nev: 'Felvégi vegyesbolt',      pos: [220.6, -176], ar: 700000, mosas: 60000 },
  { id: 'autoszer', regio: 'kisvaros', nev: 'Gumis és autómosó',       pos: [560, 236], ar: 1300000, mosas: 110000 },
];

/** Beszállítók (rendelés a telefonról, leadás a megadott ponton). */
export const SUPPLIERS = [
  { id: 'kofa',     regio: 'falu',      nev: 'Erzsi néni, a kofa',    pos: [238, 28.6],   kinal: ['gyumolcs'] },
  { id: 'gazdabolt', regio: 'falu',     nev: 'Gazdabolt',             pos: [204, 33],   kinal: ['csemete', 'trágya', 'élesztő', 'enzim', 'palack', 'címke'] },
  { id: 'mehesz',   regio: 'felveg',    nev: 'A méhész',              pos: [258, -210.6], kinal: ['méz', 'propolisz'] },
  { id: 'erdesz',   regio: 'szolohegy', nev: 'Az erdész',             pos: [-119, -272.6], kinal: ['tölgyforgács', 'akácforgács', 'gyógynövény', 'dió'] },
  { id: 'fuszeres', regio: 'kisvaros',  nev: 'Fűszeres a nagypiacon', pos: [548, 285.6],  kinal: ['fahéj', 'csili', 'ánizs', 'vanília', 'kávé'] },
];

/** Csomópontok és utak: a járművek, a járőr és a gyalogos NPC-k ezen közlekednek. */
export const NODES = {
  kapu: [0, 16.5], fout_ny: [-420, 16.5], fout_k: [720, 16.5], falu_kp: [230, 16.5],
  hid_ny: [370, 16.5], hid_k: [400, 16.5], kv_be: [470, 120], kv_kp: [530, 270],
  felveg_le: [230, -60], felveg_kp: [230, -190],
  hegy_lab: [-60, 16.5], hegy_ut1: [-100, -100], hegy_kp: [-170, -230],
  major_le: [-180, 16.5], major_kp: [-270, 140],
};
export const ROADS = [
  ['fout_ny', 'major_le'], ['major_le', 'hegy_lab'], ['hegy_lab', 'kapu'], ['kapu', 'falu_kp'], ['falu_kp', 'hid_ny'],
  ['hid_ny', 'hid_k'], ['hid_k', 'fout_k'], ['hid_k', 'kv_be'], ['kv_be', 'kv_kp'],
  ['falu_kp', 'felveg_le'], ['felveg_le', 'felveg_kp'],
  ['hegy_lab', 'hegy_ut1'], ['hegy_ut1', 'hegy_kp'], ['major_le', 'major_kp'],
];
/** A folyó (észak–dél) és a híd a Fő úton. */
export const RIVER = { x: 385, width: 22 };

/** A v0.3 lapos domborzata — már senki nem hívja. A v4 óta a forrás a game/js/vilag/domborzat.js (dombvidék,
 *  út-szelvények, horhosok, töltés); a talajmagasság a vilag/terep.js talaj()/terepY() függvényén át érhető el. */
export function height(x, z) {
  const flat = (cx, cz, r) => Math.max(0, 1 - Math.hypot(x - cx, z - cz) / r);
  let h = 2.2 * Math.sin(x * 0.011) * Math.cos(z * 0.013) + 1.4 * Math.sin((x + z) * 0.023);
  h += 34 * Math.exp(-((x + 170) ** 2 + (z + 250) ** 2) / (2 * 95 ** 2));          // Szőlőhegy
  h -= 6 * Math.exp(-((x - RIVER.x) ** 2) / (2 * 18 ** 2));                       // folyóvölgy
  // síkra húzott helyek: tanya, falu, kisváros, major, utak környéke
  const k = Math.max(flat(0, 0, 60), flat(230, 20, 120), flat(530, 270, 160), flat(-270, 140, 110), Math.max(0, 1 - Math.abs(z - 16.5) / 14));
  return h * (1 - Math.min(1, k * 1.4));
}
