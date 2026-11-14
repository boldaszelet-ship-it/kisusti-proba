// Kisüsti — interakció: mire néz a játékos (sugár a célkeresztből), mit ír ki a felirat, mi történik E-re (és R-re),
// valamint az üst kézi kezelése (a minigame: fűtés, vágás, a panel és a kamera). A világ tárgyait a vilag/tanya.js
// és a szereplok.js jelöli meg (userData.kind); a sim műveleteit az Empire adja, a felületeket a UI.
import * as THREE from 'three';
import { FORE_END, HEART_END, DRINKS, hu, ft } from '../sim.js';
import { GYUMOLCSOK, CIKKEK, USTOK } from '../data/tartalom.js';
import { utana } from './ui/elemek.js';

const HANGOLAS = {
  celTav: 3.4,            // m: ennyiről lehet használni valamit
  futesSeb: 0.55,         // a tűz ereje / mp (W/S nyomva)
  vagasRugas: 0.035,      // rad: kamerarúgás vágáskor
  rugasLecseng: 9,        // 1/mp
  kifutRazas: 0.06,       // rad: kamerarázás kifutáskor
  megerositesIdo: 3.5,    // mp: vásárlásnál a második E-re ennyit vár
  nalaVihetoL: 3,         // l: az E ennyit vesz magadhoz (a motozás e fölött büntet), Shift+E mindent
};
export { HANGOLAS };

const gyNev = gy => GYUMOLCSOK[gy]?.gyumolcs || gy;
const ido = p => { p = Math.max(0, Math.ceil(p)); const o = Math.floor(p / 60), m = p % 60; return o ? `${o} ó ${String(m).padStart(2, '0')} p` : `${m} p`; };

export class Interakcio {
  constructor(J) {
    this.J = J;
    this.ray = new THREE.Raycaster(); this.ray.far = HANGOLAS.celTav;
    this.cel = null;
    this.megerosit = null;          // {kulcs, ig}: kétlépcsős vásárlás
    this.ust = null;                // {propId, ustIdx, pos}: kézi üstmód
    this.rugas = 0; this.razas = 0;
    this._v = new THREE.Vector2(0, 0);
    this.$ = id => document.getElementById(id);
  }
  get E() { return this.J.E; }

  // ------------------------------------------------------------ célzás
  celzott() {
    const J = this.J;
    J.camera.updateMatrixWorld();
    this.ray.setFromCamera(this._v, J.camera);
    const lista = [...J.V.interact, ...J.celok].filter(o => o.visible && o.userData.kind && o.userData.kind !== 'gone');
    const hits = this.ray.intersectObjects(lista, true);
    for (const h of hits) {
      let o = h.object, lathato = true;
      for (let p = o; p; p = p.parent) if (!p.visible) { lathato = false; break; }
      const r = o.userData.root || o;
      if (lathato && r.userData.kind && r.userData.kind !== 'gone') return r;
    }
    return null;
  }

  // ------------------------------------------------------------ felirat
  /** A célzott tárgy felirata (E – …, illetve R – … a második sorban). Max. ~8 szó soronként. */
  szoveg(n) {
    // a HUD a [X] jelölést billentyűként rajzolja; két lehetőség egy sorban, középponttal elválasztva
    return this._szoveg(n).replace(/^E – /, '[E] ').replace(/^Shift\+E – /, '[Shift+E] ').replace(/^E még egyszer:/, '[E] még egyszer:').replace(/\n(Shift\+E|R) – /g, ' · [$1] ').replace(/\n/g, ' · ');
  }
  _szoveg(n) {
    if (this.ust) return '';
    if (!n) return this.J.jarmuvek.sugo() || '';
    const E = this.E, S = this.J.S, d = n.userData, k = d.kind, prop = d.prop || 'tanya';
    const P = S.ingatlanok.find(p => p.id === prop);
    switch (k) {
      case 'fruit': case 'fa': {
        const f = P?.fak[d.slot];
        if (!P?.owned) return 'Nem a te kerted.';
        if (!f) return 'E – üres hely: ültetés';
        if (f.termes >= 0.5) return `E – szüret: ${Math.floor(f.termes)} kg ${gyNev(f.gyumolcs)}`;
        if (!f.termo) return `E – ${gyNev(f.gyumolcs)}csemete · ${GYUMOLCSOK[f.gyumolcs].erik - f.kor} nap`;
        return `E – ${gyNev(f.gyumolcs)}fa ápolása${f.viz < 0.3 ? ' · szomjas' : ''}`;
      }
      case 'barrel': case 'hordo2': {
        if (!P?.owned) return '';
        const kesz = P.hordok.filter(h => h.allapot === 'kesz').reduce((a, h) => a + h.l, 0);
        const erj = P.hordok.filter(h => h.allapot === 'erjed').sort((a, b) => a.hatra - b.hatra)[0];
        const ures = P.hordok.some(h => h.allapot === 'ures');
        const gy = Object.values(S.keszlet.gyumolcs).reduce((a, g) => a + g.kg, 0);
        if (kesz > 0) return `Kész cefre: ${hu(kesz, 0)} l · az üstbe vele`;
        if (ures && gy >= 1) return `E – cefre a hordóba (${gy} kg gyümölcs)`;
        if (erj) return `Erjed még ${ido(erj.hatra)} · E – hordók`;
        return ures ? 'Üres hordó. Gyümölcs kell bele.' : 'E – hordók';
      }
      case 'still': case 'ust': {
        const ui = d.ustIdx ?? 0, u = P?.ustok[ui];
        if (!u) return '';
        if (u.pecset > 0) return `Pecsét az üstön · még ${ido(u.pecset)}`;
        if (S.keziUst && S.keziUst.propId === prop && S.keziUst.ustIdx === ui) return 'E – az üst kezelése';
        if (u.allapot === 'auto') return `Magától fő · még ${ido(u.hatra)}`;
        if (S.keziUst) return 'Egyszerre csak egy üstöt kezelhetsz.';
        const h = P.hordok.find(x => x.allapot === 'kesz');
        return h ? `E – ${hu(Math.min(h.l, USTOK[u.szint].cap), 0)} l ${gyNev(h.gyumolcs)}cefre az üstbe` : 'Az üst üres. Kész cefre kell.';
      }
      case 'well': {
        const t = this._vizezheto();
        return t ? `E – vizezés: ${hu(t.fok, 0)} → ${hu(Math.max(30, t.fok - 5), 0)} fok, több lesz` : 'Kút. Ide jön az ember, ha sok a pálinka és kevés a lelkiismeret.';
      }
      case 'cellar': case 'pince2': {
        const fent = E.literItt('prop:' + prop), lent = E.literItt('rejtek:' + prop), nalad = S.nalad;
        const fel = fent + lent, hely = Math.max(0, HANGOLAS.nalaVihetoL - nalad);
        const sor = [];
        if (fel > 0.005) sor.push(hely > 0.005 ? `E – magadhoz: ${hu(Math.min(hely, fel), 1)} l` : `Shift+E – mind magadhoz (${hu(fel, 1)} l)`);
        if (fent + nalad > 0.005) sor.push(`R – mind a pincébe (${hu(fent + nalad, 1)} l)`);
        if (!sor.length) return 'A pince üres. Ide bújik a pálinka.';
        return sor.join('\n');
      }
      case 'house': {
        const h = S.ido.ora;
        if (S.keziUst) return 'Előbb fejezd be a főzést.';
        return h >= 19 || h < 5 ? 'E – alvás reggelig' : 'E – ledőlsz egy órára';
      }
      case 'market': {
        const c = CIKKEK['gyumolcs_' + d.tipus];
        return `E – 10 kg ${DRINKS[d.tipus]?.gyumolcs || d.tipus}, ${ft(c.ar)}`;
      }
      case 'kever': return P?.owned ? 'E – keverőasztal (ágyas, ízesítés)' : '';
      case 'palack': return P?.owned ? 'E – palackozó és érlelés' : '';
      case 'vevo': {
        const r = S.rendelesek.find(x => x.id === d.rendeles);
        if (!r) return '';
        const most = S.ido.perc;
        if (most < r.ablak[0]) return `${r.nev} · korán jöttél`;
        return `E – átadás: ${r.nev}`;
      }
      case 'kostolo': return `E – megkínálod: ${d.nev}`;
      case 'szallitmany': return `E – átveszed: ${d.felirat}`;
      case 'terjeszto': {
        const t = S.terjesztok.find(x => x.id === d.id);
        if (!t) return '';
        if (!t.elerheto) return `${t.nev} · még nem áll szóba veled`;
        return t.felveve ? `E – ${t.nev}: áru, elszámolás` : `E – ${t.nev}: felvétel`;
      }
      case 'beszallito': return `E – rendelés: ${d.nev}`;
      case 'ingatlan': {
        const p = S.ingatlanok.find(x => x.id === d.id);
        if (!p || p.owned) return '';
        if (!S.regiok.find(r => r.id === p.regio)?.nyitva) return `${p.nev} · még nem a te vidéked`;
        return this._megerositVar('ingatlan:' + d.id) ? `E még egyszer: megveszed (${ft(p.ar)})` : `E – ELADÓ: ${p.nev}, ${ft(p.ar)}`;
      }
      case 'uzlet': {
        const b = S.uzletek.find(x => x.id === d.id);
        if (!b || b.sajat) return '';
        if (!b.elerheto) return `${b.nev} · még nem a te vidéked`;
        return this._megerositVar('uzlet:' + d.id) ? `E még egyszer: megveszed (${ft(b.ar)})` : `E – ELADÓ: ${b.nev}, ${ft(b.ar)}`;
      }
      case 'busz': return 'E – busz (menetrend)';
      case 'jarmu_elado': return 'Eladó kisautó · telefon → Birodalom → Járművek';
    }
    return '';
  }

  _megerositVar(kulcs) { return this.megerosit && this.megerosit.kulcs === kulcs && performance.now() < this.megerosit.ig; }

  /** A legjobb vizezhető tétel: palackozatlan, nem érlelődő, nálad vagy a tanyán, 35 fok fölött. */
  _vizezheto() {
    const S = this.J.S;
    return S.tetelek.filter(t => !t.palack && !t.erleles && t.fok >= 35 && (t.hely === 'nalad' || t.hely === 'prop:tanya')).sort((a, b) => b.fok - a.fok)[0] || null;
  }

  // ------------------------------------------------------------ végrehajtás
  /** gomb: 'E' | 'R' (pince: elrejtés) ; shift: Shift+E (mindent magadhoz). Visszaad true-t, ha elnyelte a gombot. */
  vegrehajt(n, gomb = 'E', shift = false) {
    if (!n) return false;
    const J = this.J, E = this.E, ui = J.ui, S = J.S, d = n.userData, k = d.kind, prop = d.prop || 'tanya';
    const P = S.ingatlanok.find(p => p.id === prop);
    if (gomb === 'R') {
      if (k !== 'cellar' && k !== 'pince2') return false;
      const tetelek = [...E.tetelekItt('nalad'), ...E.tetelekItt('prop:' + prop)];
      if (!tetelek.length) return true;
      const rs = tetelek.map(t => E.hide(t.id, prop));
      const kesz = rs2 => { if (rs2.some(r => r.ok)) { J.hang.play('hordo_fedel', { pos: n }); J.uzen(`Lent a pincében. A pénzügyőr ide nem néz be.`); } };
      if (rs.some(r => typeof r?.then === 'function')) Promise.all(rs).then(kesz); else kesz(rs);
      return true;
    }
    switch (k) {
      case 'fruit': case 'fa': {
        if (!P?.owned) return true;
        const f = P.fak[d.slot];
        if (f && f.termes >= 0.5) {
          utana(E.harvest(prop, d.slot), r => { if (r.ok) { J.uzen(`Szüret: ${r.kg} kg ${gyNev(f.gyumolcs)}.`); J.sz.szuretEffekt(prop, d.slot); } });
        } else ui.open('gyumolcsos', { prop, slot: d.slot });
        return true;
      }
      case 'barrel': case 'hordo2': {
        if (!P?.owned) return true;
        const idx = Math.max(0, P.hordok.findIndex(h => h.allapot === 'ures'));
        ui.open('hordo', { prop, idx });
        J.hang.play('hordo_fedel', { pos: n, vol: 0.6 });
        return true;
      }
      case 'still': case 'ust': this.ustBe(prop, d.ustIdx ?? 0, n); return true;
      case 'well': {
        const t = this._vizezheto();
        if (!t) return true;
        utana(E.dilute(t.id), r => { if (r.ok) J.hang.play('vodor', { pos: n }); });
        return true;
      }
      case 'cellar': case 'pince2': this._magadhoz(prop, shift); return true;
      case 'house': {
        if (S.keziUst) { J.uzen('Előbb fejezd be a főzést: az üstöt nem hagyod magára.', true); return true; }
        const h = S.ido.ora;
        if (h >= 19 || h < 5) J.alvas();
        else if (J.coop) J.uzen('Közös játékban napközben nem dőlhetsz le: az idő mindenkinek telik.', true);
        else J.fade(() => { E.advance(60); J.uzen('Ledőltél egy órára. A tücskök nem zavartak.'); J.idougras(); });
        return true;
      }
      case 'market': {
        // a piaci vásárlás parancs (sim: buyFruit), hogy közös játékban is a házigazda könyvelje
        const c = CIKKEK['gyumolcs_' + d.tipus];
        utana(E.buyFruit(d.tipus), r => {
          if (!r.ok) { J.uzen(`Nincs ${ft(c.ar)} a zsebedben.`, true); return; }
          J.uzen(`Vettél 10 kg ${DRINKS[d.tipus].gyumolcsot} (${ft(c.ar)}).`);
          J.hang.play('gyumolcs', { pos: n }); J.hang.play('penz_erme', { pos: n, vol: 0.7 });
        });
        return true;
      }
      case 'kever': if (P?.owned) ui.open('kever', { prop }); return true;
      case 'palack': if (P?.owned) { ui.open('palack', { prop }); J.hang.play('uveg', { pos: n, vol: 0.5 }); } return true;
      case 'vevo': {
        const r = S.rendelesek.find(x => x.id === d.rendeles);
        if (r) { ui.open('atadas', { rendeles: r.id }); J.hang.play('koszones', { pos: n, vol: 0.5 }); }
        return true;
      }
      case 'kostolo': ui.open('kostolo', { vevo: d.vevo }); return true;
      case 'szallitmany': {
        utana(E.pickup(d.id), r => { if (r.ok) { J.hang.play(CIKKEK[r.tetel]?.tipus === 'gyumolcs' ? 'gyumolcs' : 'hordo_fedel', { pos: n }); J.uzen(`Átvetted: ${d.felirat}.`); J.sz.ladaFel(d.id); } });
        return true;
      }
      case 'terjeszto': {
        const t = S.terjesztok.find(x => x.id === d.id);
        if (t?.elerheto) ui.open('terjeszto', { id: d.id });
        return true;
      }
      case 'beszallito': ui.open('beszallito', { id: d.id }); return true;
      case 'ingatlan': case 'uzlet': {
        const kulcs = k + ':' + d.id;
        if (!this._megerositVar(kulcs)) { this.megerosit = { kulcs, ig: performance.now() + HANGOLAS.megerositesIdo * 1000 }; J.hang.play('ui_click'); return true; }
        this.megerosit = null;
        utana(k === 'ingatlan' ? E.buyProperty(d.id) : E.buyBusiness(d.id), r => { if (r.ok) { J.hang.play('penz_papir'); J.hang.play('kapu', { pos: n, vol: 0.7 }); J.sz.vasarlas(k, d.id); } });
        return true;
      }
      case 'busz': J.sz.buszMenu(d.megallo); return true;
      case 'jarmu_elado': ui.open('birodalom'); return true;
    }
    return false;
  }

  /** E a pincénél: a szem előtt és a pincében lévő pálinkát magadhoz veszed, legfeljebb 3 literig (Shift: mindent). */
  _magadhoz(prop, minden) {
    const J = this.J, E = this.E;
    const tetelek = [...E.tetelekItt('prop:' + prop), ...E.tetelekItt('rejtek:' + prop)].sort((a, b) => (b.palack ? 1 : 0) - (a.palack ? 1 : 0) || b.l - a.l);
    if (!tetelek.length) return;
    let hely = minden ? 1e9 : HANGOLAS.nalaVihetoL - E.literItt('nalad'), vitt = 0;
    if (hely <= 0.005) { J.uzen('Nálad már 3 liter van. Shift+E: a többi is (a motozás büntet).', true); return; }
    const vett = r => { if (r.ok) { hely -= r.l; vitt += r.l; } };
    // egymás után: a következő adag a maradék helytől függ (közös játékban a válaszokat sorban várjuk meg)
    const lep = i => {
      for (; i < tetelek.length; i++) {
        const t = tetelek[i];
        if (hely <= 0.005) break;
        let l = Math.min(t.l, hely);
        if (t.palack) { const egy = t.l / Math.max(1, t.palack.db); l = Math.floor(l / egy + 1e-6) * egy; if (l < egy - 1e-6) continue; }
        const r = E.carry(t.id, l >= t.l - 1e-6 ? undefined : l);
        if (typeof r?.then === 'function') return r.then(x => { vett(x); return lep(i + 1); });
        vett(r);
      }
      if (vitt > 0) { J.uzen(`Nálad: ${hu(E.literItt('nalad'), 1)} l pálinka.`); J.hang.play('uveg', { vol: 0.6 }); }
    };
    lep(0);
  }

  // ------------------------------------------------------------ az üst kézi kezelése
  ustBe(prop, ustIdx, obj) {
    const J = this.J, E = this.E, S = J.S;
    const P = S.ingatlanok.find(p => p.id === prop), u = P?.ustok[ustIdx];
    if (!u || !P.owned) return;
    if (u.pecset > 0) { J.uzen('Az üstön a Hivatal pecsétje. Most nem.', true); return; }
    const ezAzUst = S.keziUst && S.keziUst.propId === prop && S.keziUst.ustIdx === ustIdx;
    const belep = () => {
      const pos = new THREE.Vector3(); obj.getWorldPosition(pos);
      this.ust = { prop, ustIdx, pos, t: 0, hint: '' };
      J.jatekos.zarolva = true;
      this.$('ust').classList.add('be');
    };
    // közös játék: egyszerre egy kézi üst van, és azé, aki bérli; a gazdátlant (kiesett bérlő) bárki átveheti
    const b = J.coop?.meta.berlet;
    if (J.coop && ezAzUst && !this.sajatBerlet()) {
      if (!b?.arva) { J.uzen(`${J.coop.jatekosok.find(j => j.id === b?.ki)?.nev || 'Valaki'} főz rajta. Majd ha végzett.`, true); return; }
      return utana(E.ustAtvesz(), r => { if (r.ok) belep(); else if (r.hiba) J.uzen(r.hiba, true); });
    }
    if (!ezAzUst) {
      if (S.keziUst) { J.uzen(J.coop ? 'Egyszerre csak egy üst főhet kézzel (közösen is).' : 'Egyszerre csak egy üstöt kezelhetsz kézzel.', true); return; }
      if (u.allapot === 'auto') return;
      const bi = P.hordok.findIndex(h => h.allapot === 'kesz');
      if (bi < 0) { J.uzen('Nincs kész cefre. Előbb a hordó, aztán az erjedés.', true); return; }
      return utana(E.startStill(prop, ustIdx, bi, 'kezi'), r => { if (r.ok) belep(); else if (J.coop && r.hiba) J.uzen(r.hiba, true); });
    }
    belep();
  }
  /** Közös játékban: az enyém-e a kézi üst bérlete (egyjátékosban mindig igen). */
  sajatBerlet() {
    const c = this.J.coop; if (!c) return true;
    if (c.szerep === 'kliens') return !!this.E.sajatBerlet;
    const b = c.meta.berlet; return !!(b && b.ki === c.te && !b.arva);
  }
  ustKi() {
    if (!this.ust) return;
    this.ust = null;
    this.J.jatekos.zarolva = false;
    this.$('ust').classList.remove('be');
  }
  /** Kifutáskor: rázás és gőz (a jatek.js hívja a sim üzenetére). */
  kifutott() { this.razas = 1; }
  /** Üstmódban minden képkockán: bemenet (W/S fűtés, SPACE vágás, Q kiolt, E vissza), kamera, panel. */
  ustUpdate(dt) {
    const J = this.J, E = this.E, I = J.bemenet;
    this.rugas *= Math.max(0, 1 - dt * HANGOLAS.rugasLecseng);
    this.razas = Math.max(0, this.razas - dt * 2.5);
    if (!this.ust) return;
    const S = J.S, k = S.keziUst;
    if (!k || !k.futo || !this.sajatBerlet()) { this._vege(); return; }
    const c = E.core.still;
    if (I.van('KeyW', 'ArrowUp')) E.setHeat(c.heat + HANGOLAS.futesSeb * dt);
    if (I.van('KeyS', 'ArrowDown')) E.setHeat(c.heat - HANGOLAS.futesSeb * dt);
    if (I.most('Space')) {
      const elotte = c.vessel;
      E.cut();
      if (c.vessel !== elotte) { this.rugas = HANGOLAS.vagasRugas; J.hang.play('uveg', { pos: this.ust.pos, vol: 0.8 }); this._villan('ust-edeny'); }
    }
    if (I.most('KeyQ')) { E.finishStill(); this._vege(); return; }
    if (I.most('KeyE') || I.most('Escape')) { I.lenyomva.delete('KeyE'); this.ustKi(); return; }
    // kamera: az üstre néz (ease-out fordulás), vágáskor kis rúgás, kifutáskor rázás
    const j = J.jatekos, p = this.ust.pos, cam = J.camera.position;
    const dx = p.x - cam.x, dy = p.y + 1.1 - cam.y, dz = p.z - cam.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    let dyaw = yaw - j.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const a = 1 - Math.exp(-dt * 10);
    j.yaw += dyaw * a; j.pitch += (pitch - j.pitch) * a;
    const rz = (Math.random() - 0.5) * this.razas * HANGOLAS.kifutRazas;
    J.camera.rotation.set(j.pitch + this.rugas + rz, j.yaw + rz, 0, 'YXZ');
    this.panel(S.keziUst, c);
  }
  _vege() {
    this.ustKi();
  }
  _villan(id) { const el = this.$(id); if (!el) return; el.classList.remove('villan'); void el.offsetWidth; el.classList.add('villan'); }
  /** Az üst panelje (index.html #ust). */
  panel(k, c) {
    const $ = this.$, pct = v => Math.max(0, Math.min(100, (v - 20) / 90 * 100));
    $('ust-cim').textContent = `${gyNev(c.tipus)}cefre · ${hu(k.toltet ?? c.charge, 0)} l`;
    const t = c.temp;
    $('ust-hofok').textContent = `${hu(t, 0)} °C`;
    const tb = $('ust-ho-i'); tb.style.width = pct(t) + '%'; tb.className = t < 86 ? 'hideg' : t > 96 ? 'forro' : 'jo';
    $('ust-sav').style.left = pct(88) + '%'; $('ust-sav').style.width = (pct(94) - pct(88)) + '%';
    $('ust-tuz-i').style.width = Math.round(c.heat * 100) + '%';
    $('ust-tuz').textContent = Math.round(c.heat * 100) + ' %';
    $('ust-p').style.left = (c.p * 100) + '%';
    $('ust-elo').style.width = FORE_END * 100 + '%'; $('ust-kozep').style.width = (HEART_END - FORE_END) * 100 + '%';
    const ed = { elo: ['MOSLÉK', 'elo'], sziv: ['PALACK', 'sziv'], uto: ['MOSLÉK', 'uto'] }[c.vessel];
    const edEl = $('ust-edeny'); edEl.textContent = ed[0]; edEl.dataset.e = ed[1];
    $('ust-fazis').textContent = `Most jön: ${E_fazis(c.p)}`;
    $('ust-termek').textContent = `${hu(c.prodL, 2)} l · ${hu(c.prodL > 1e-4 ? c.prodAlc / c.prodL : 0, 0)} fok · ${this.E.core.qualityPreview()} pont`;
    // adaptív tipp: csak ha épp kell (max. 8 szó)
    let tip = '';
    if (t > 96) tip = 'Túl forró! Vegyél vissza: S';
    else if (c.vessel === 'elo' && c.p >= FORE_END) tip = 'Jön a középpárlat. Vágj: SPACE';
    else if (c.vessel === 'sziv' && c.p >= HEART_END) tip = 'Kozmás jön. Vágj: SPACE';
    else if (t < 80) tip = 'Fűts fel: W';
    else if (c.vessel === 'elo') tip = 'Az előpárlat a moslékba megy.';
    else if (t < 88) tip = 'Kicsit több tűz: W';
    else tip = 'Tartsd 88–94 °C között.';
    const tEl = $('ust-tipp');
    if (tEl.textContent !== tip) { tEl.textContent = tip; tEl.classList.toggle('surgos', /Vágj|forró/.test(tip)); }
  }
}
function E_fazis(p) { return p < FORE_END ? 'előpárlat' : p < HEART_END ? 'középpárlat' : 'utópárlat'; }
