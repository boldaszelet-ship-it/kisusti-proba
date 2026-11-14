// Kisüsti coop — a protokoll közös része: hangolható számok, a metódusok besorolása és az ütközési kulcsok.
// Minden időzítés itt van, máshol a coop-kódban nincs szám-literál időre vagy frekvenciára.

export const HANGOLAS = {
  deltaHz: 10,              // állapotdelta a hostról (5–10 Hz a szerződés szerint)
  pozHz: 15,                // játékospozíció és -nézés
  interpMs: 100,            // a többiek figurája ennyivel a múltban, két minta között interpolálva (~1,5 pozíciócsomag)
  extrapolMaxMs: 150,       // csomagvesztésnél legfeljebb ennyit vetítünk előre, aztán megáll
  ustKeretMs: 50,           // a bérelt üst fűtés/vágás-sorát ennyi időnként küldjük a hostnak
  berletArvaMs: 2000,       // ha a bérlőtől ennyi ideig nem jön üst-keret, a host átveszi (fűtés 0: hűl, nem fut ki)
  fogasMs: 1500,            // egy sikeres parancs után ennyi ideig a játékosé a tárgy (hordó, üst, tétel, rendelés)
  alvasMs: 60000,           // az alvás-szavazás ennyi után elévül
  parancsTimeoutMs: 10000,  // válasz nélküli parancs ennyi után hibával zárul
  pingMs: 2000,             // körülfordulás-mérés a reléig
  mentesMp: 30,             // a host ennyi másodpercenként a relére is feltölti a mentést (ha a host gépe elszáll)
  hatterLepesMs: 500,       // ha a host fő hurka ennyi ideig nem léptet (háttérfül), a coop lépteti a szimulációt
  hatterPlafonMp: 60,       // a háttér-léptetés egy ütemben legfeljebb ennyi valós mp-et hoz be
  ujraKesleltetesMs: [250, 500, 1000, 2000, 3000, 5000],   // újracsatlakozási kísérletek (aztán 5 mp-enként, 30 mp-ig)
  ujracsatlakozasMs: 30000, // ennyi ideig tartja a relé a lecsatlakozott játékos helyét
  maxJatekos: 4,
};

/** Olvasó metódusok: a kliens a tükörből, szinkron válaszolja meg őket (a tiszta-ság mérve: tools/probe_coop.mjs). */
export const OLVASO = [
  'now', 'day', 'hour', 'isDay', 'clock', 'save', 'tetel', 'tetelekItt', 'literItt', 'mixPreview', 'recipes', 'knownEffects',
  'value', 'wishText', 'customers', 'messages', 'orders', 'dealers', 'suppliers', 'deliveries', 'suspicionAt', 'patrols',
  'inventory', 'cash', 'launderCapacity', 'employees', 'rankIdx', 'rangNev', 'rankInfo', 'regionOpen', 'regionName', 'quests',
  'activeQuest', 'fustol', 'ft', 'aNev',
];

/** Parancsok: a hosthoz mennek, a válasz ígéret. Bármelyik játékos küldheti. */
export const PARANCS = [
  'carry', 'merge', 'split', 'store', 'plant', 'water', 'fertilize', 'spray', 'harvest', 'fillBarrel', 'startStill', 'setHeat',
  'cut', 'finishStill', 'upgradeStill', 'buyUpgrade', 'dilute', 'age', 'endAging', 'bottle', 'setAutoBottle', 'mix', 'giveSample',
  'markRead', 'acceptOrder', 'declineOrder', 'haggle', 'deliver', 'hireDealer', 'assign', 'stockDealer', 'collect', 'order',
  'pickup', 'searchPlayer', 'hide', 'appease', 'stash', 'unstash', 'deposit', 'withdraw', 'launder', 'buyBusiness', 'buyProperty',
  'hire', 'fire', 'setNightShift', 'buyVehicle', 'useVehicle', 'sleep', 'buyFruit', 'payFare',
];

/** Csak a host hívhatja (próba, bot, belső): kliensről elutasítva. */
export const CSAK_HOST = ['advance', 'travelTo', 'raid', 'addSuspicion', 'addXp'];

/**
 * Melyik tárgyat fogja meg a parancs. Ha egy tárgyat más játékos fogott az utolsó `fogasMs`-ben (vagy az üstöt bérli),
 * a host ütközésnek veszi: nem hajtja végre, és mindkét félnek jelzi, ki fogja.
 */
export function kulcsok(nev, a) {
  const t = id => (id == null ? [] : ['tetel:' + id]);
  const r = id => (id == null ? [] : ['rendeles:' + id]);
  switch (nev) {
    case 'fillBarrel': return [`hordo:${a[0]}:${a[1]}`];
    case 'startStill': return [`ust:${a[0]}:${a[1]}`, `hordo:${a[0]}:${a[2]}`];
    case 'upgradeStill': return [`ust:${a[0]}:${a[1]}`];
    case 'buyUpgrade': return a[1] === 'csiga' ? [`ust:${a[0]}:${a[2] ?? 0}`] : [`ingatlan:${a[0]}`];
    case 'plant': case 'water': case 'fertilize': case 'spray': case 'harvest': return [`fak:${a[0]}`];
    case 'carry': case 'split': case 'store': case 'dilute': case 'age': case 'endAging': case 'bottle': case 'mix': case 'hide':
      return t(a[0]);
    case 'merge': return [...t(a[0]), ...t(a[1])];
    case 'giveSample': return t(a[1]);
    case 'appease': return t(a[1]);
    case 'acceptOrder': case 'declineOrder': case 'haggle': return r(a[0]);
    case 'deliver': return [...r(a[0]), ...t(a[1])];
    case 'stockDealer': return [`terjeszto:${a[0]}`, ...t(a[1])];
    case 'hireDealer': case 'collect': return [`terjeszto:${a[0]}`];
    case 'pickup': return [`szallitmany:${a[0]}`];
    case 'buyProperty': return [`ingatlan:${a[0]}`];
    case 'hire': case 'setNightShift': case 'setAutoBottle': return [`ingatlan:${a[0]}`];
    case 'fire': return [`alkalmazott:${a[0]}`];
    default: return [];
  }
}

/** Egyértelműen olvasható, könnyen bediktálható szobakód (nincs I/O/0/1). */
export const KOD_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const KOD_HOSSZ = 4;
