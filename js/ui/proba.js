// Kisüsti UI — forgatókönyvek a próbaoldalhoz (ui-proba.html): valódi Empire, a szimuláció saját API-jával felpörgetve.
// Csak próbára: a játék ezt nem tölti be.
import { Empire } from '../../sim/empire.js';
import { OSSZETEVOK } from '../../data/tartalom.js';

/** A rendelésnek pontosan megfelelő tétel (a bot „főzte”). */
function megfeleloTetel(E, r, hely = 'nalad') {
  const fok = r.minFok ? r.minFok + 2 : r.maxFok ? r.maxFok - 2 : 52;
  return E._ujTetel({ gyumolcs: r.gyumolcs || 'szilva', l: r.l, q: Math.min(98, r.minQ + 12), fok, effektek: r.hatas ? [r.hatas] : [], hely });
}
/** Egy játéknapnyi élet: rendelések elfogadása, átadás az ablakban, néha elutasítás és lejárat (a szálakhoz). */
function eletNap(E, napok, o = {}) {
  const veg = E.now() + napok * 1440;
  let i = 0;
  while (E.now() < veg) {
    E.advance(30);
    for (const r of E.orders()) {
      const h = (r.id.charCodeAt(r.id.length - 1) + i) % 10;
      if (r.allapot === 'uj' && E.now() - r.ido > 40) { if (h < 7) E.acceptOrder(r.id); else if (h < 8) E.declineOrder(r.id); }
      if (r.allapot === 'elfogadva' && E.now() >= r.ablak[0] + 20 && h < (o.atad ?? 8)) { const t = megfeleloTetel(E, r); E.deliver(r.id, t.id); }
    }
    i++;
  }
}

export function forgatokonyv(nev, seed = 2026) {
  const E = new Empire(seed);
  if (nev === 'ures') return E;
  // reggel fél nyolc, a kezdő vevők már írnak
  E.advance(90);
  E._ujTetel({ gyumolcs: 'szilva', l: 3, q: 74, fok: 52, hely: 'nalad' });
  E._ujTetel({ gyumolcs: 'barack', l: 4.5, q: 68, fok: 44, hely: 'prop:tanya' });
  E._ad('mez', 6); E._ad('meggy', 4); E._ad('dio', 3); E._ad('fahej', 5); E._ad('gyogynoveny', 2); E._ad('csemete_szilva', 2); E._ad('permet', 1);
  E.s.gyumolcs.szilva = { kg: 34, q: 70 }; E.s.gyumolcs.barack = { kg: 12, q: 66 };
  E.fillBarrel('tanya', 0, { gyumolcs: 'szilva', kg: 30, adalek: ['eleszto'] });
  if (nev === 'kezdo') { E.advance(200); return E; }

  // középhaladó: pár nap élet, rang, présház, emberek, terjesztő, receptek, érlelés, szállítmány
  eletNap(E, 3);
  E.core.money += 1400000; E.s.szamla += 420000;
  E.addXp(720);
  E.buyProperty('preshaz');
  E.hire('tanya', 'unokaocs'); E.hire('preshaz', 'feri'); E.hire('preshaz', 'neni');
  E.buyBusiness('kocsma'); E.buyVehicle('bicikli'); E.buyVehicle('kocka');
  E.hireDealer('postas'); E.hireDealer('buszsofor');
  const aktiv = E.customers().filter(v => v.allapot === 'aktiv').map(v => v.id);
  aktiv.slice(0, 3).forEach(id => E.assign(id, 'postas'));
  for (const [k, n] of Object.entries({ mez: 8, fahej: 6, dio: 6, tolgyforgacs: 4, akacforgacs: 4, csili: 4, kave: 4, vanilia: 3, propolisz: 3, cukor: 6, bodza: 3, paprika: 3,
    uveg_05: 24, uveg_02: 12, uveg_07: 6, cimke_nyomtatott: 20, hordo_akac: 2, tragya: 4, permet: 3, eleszto: 6, enzim: 4, csemete_barack: 2, csemete_korte: 1 })) E._ad(k, n);
  // receptek a füzetbe: méz → fahéj (Nagymama titka), dió, tölgyforgács
  for (const lanc of [['mez', 'fahej'], ['dio'], ['tolgyforgacs', 'akacforgacs'], ['meggy', 'vanilia'], ['csili']]) {
    const t = E._ujTetel({ gyumolcs: lanc[0] === 'meggy' ? 'barack' : 'szilva', l: 1, q: 80, fok: 50, hely: 'prop:tanya' });
    E._ad(lanc[0], 2); for (const o of lanc) { E._ad(o, 1); E.mix(t.id, o); }
  }
  const erl = E._ujTetel({ gyumolcs: 'korte', l: 6, q: 78, fok: 50, hely: 'prop:preshaz' });
  E.age(erl.id, 'akac');
  E._ujTetel({ gyumolcs: 'szilva', l: 8, q: 83, fok: 51, hely: 'prop:tanya' });
  const dt = E._ujTetel({ gyumolcs: 'szilva', l: 6, q: 76, fok: 50, hely: 'prop:tanya' }); E.stockDealer('postas', dt.id, 4);
  E._ujTetel({ gyumolcs: 'barack', l: 2, q: 71, fok: 44, effektek: ['mezes'], hely: 'nalad' });
  E.fillBarrel('preshaz', 0, { gyumolcs: 'barack', kg: 12, adalek: ['eleszto', 'enzim'] });
  eletNap(E, 2);
  E.order('gazdabolt', 'uveg_05', 12); E.order('kofa', 'gyumolcs_szilva', 3);
  E.s.gyanu.falu = 47; E.s.gyanu.tanya = 28;
  E.advance(150);
  return E;
}
export { megfeleloTetel, OSSZETEVOK };
