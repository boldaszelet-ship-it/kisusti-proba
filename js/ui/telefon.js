// Kisüsti UI — a telefon: kezdőképernyő és az appok (Üzenetek, Névjegyek, Térkép, Receptkönyv, Rendelés, Terjesztők,
// Birodalom, Bank, Nagyapa füzete, Beállítások, Mentés, Napló). Minden app egy „lap”: html(), act(), és ha kell, live/tick.
import { esc, ft, ftE, l, szam, szorzo, ora, tartam, mikor, chip, gyNev, gyRovid, cikkNev, REG, tetelSor, helyNev, monogram } from './kozos.js';
import { sor, szakasz, ures, lepteto, vj, utana, vjHtml, erem, sav, cimke, gombok, gomb, kv } from './elemek.js';
import { ikon } from './ikonok.js';
import { rajzolTerkep, terkepCelok } from './terkep.js';
import { REGIONS } from '../../data/regions.js';
import { HATASOK, SZEREPEK, USTOK, USTSOR, CSIGA, KEMENYSAPKA, RANGOK, CIKKEK, KULDETESEK, HATAS_JEGYZET, BANK, JARMUVEK } from '../../data/tartalom.js';

export const APPOK = [
  ['1', 'uzenetek', 'Üzenetek'], ['2', 'nevjegyek', 'Névjegyek'], ['3', 'terkep', 'Térkép'],
  ['4', 'recept', 'Receptek'], ['5', 'rendeles', 'Rendelés'], ['6', 'terjesztok', 'Terjesztők'],
  ['7', 'birodalom', 'Birodalom'], ['8', 'bank', 'Bank'], ['9', 'fuzet', 'Füzet'],
  ['*', 'mentes-app', 'Mentés'], ['0', 'beallitasok', 'Beállítás'], ['#', 'naplo', 'Napló'],
];
const APP_IKON = { 'mentes-app': 'mentes' };
const rangNev = i => RANGOK[i] || '';

// ================================================================ kezdőképernyő
export function kezdoLap(ui) {
  return {
    nev: 'telefon', fajta: 'telefon', live: 1, softBal: 'Megnyit',
    cim: () => '',
    html(ui) {
      const S = ui.S;
      const vallalt = S.rendelesek.filter(r => r.allapot === 'elfogadva').sort((a, b) => a.ablak[1] - b.ablak[1]);
      const uj = S.rendelesek.filter(r => r.allapot === 'uj').length;
      const jelvenyek = {
        uzenetek: S.olvasatlan, rendeles: S.szallitmanyok.filter(d => d.allapot === 'megerkezett').length,
        terjesztok: S.terjesztok.filter(d => d.felveve && d.kp > 0).length, fuzet: 0,
      };
      const kov = vallalt[0];
      const fejlec = `<div class="ku-hk-fej">
        <div class="ku-hk-ora">${ora(S.ido.perc)}</div>
        <div class="ku-hk-nap">${S.ido.nap}. nap · ${S.ido.nappal ? 'nappal' : 'éjjel'}</div>
        <div class="ku-hk-info">${kov ? `${ikon('pohar')}<span>${esc(kov.nev)} · ${esc(kov.helyNev)} · <b data-cd="${kov.ablak[1]}" data-elo="még "></b></span>`
          : uj ? `${ikon('uzenetek')}<span>${uj} rendelés vár válaszra</span>` : `${ikon('fuzet')}<span>${esc(S.kuldetes.aktiv?.cim || 'Minden kipipálva.')}</span>`}</div>
      </div>`;
      const racs = APPOK.map(([k, id, nev], i) => {
        const j = jelvenyek[id];
        return `<button class="ku-app" data-a="@app" data-v="${id}" ${i === 0 ? 'data-elso' : ''}>${ikon(APP_IKON[id] || id)}<span>${nev}</span><kbd>${k}</kbd>${j ? `<b class="ku-jv">${j > 99 ? '99+' : j}</b>` : ''}</button>`;
      }).join('');
      return `<div class="ku-hk">${fejlec}<div class="ku-racs">${racs}</div></div>`;
    },
    gomb(k, ui) { const a = APPOK.find(x => x[0] === k); if (a) ui.akcio('@app', a[1]); return false; },
  };
}

// ================================================================ Üzenetek
/** Az üzenet szála: a vevő (vagy feladó) azonosítója; a saját válaszaid annak a szálába kerülnek, akinek írtad. */
export function szalKulcs(m, ui, elozo) { return m.kitol === 'en' ? (ui.szal[m.id] || elozo || 'en') : m.kitol; }
function szalak(ui) {
  const S = ui.S, msgs = ui.E.messages().slice().reverse(); // régi → új
  const map = new Map(); let elozo = null;
  for (const m of msgs) {
    const k = szalKulcs(m, ui, elozo);
    if (m.kitol !== 'en') elozo = k;
    let t = map.get(k);
    if (!t) { t = { id: k, nev: m.kitol === 'en' ? 'Te' : m.nev, msgs: [], olv: 0 }; map.set(k, t); }
    if (m.kitol !== 'en') t.nev = m.nev;
    t.msgs.push(m); t.utolso = m.ido; if (!m.olvasva && m.kitol !== 'en') t.olv++;
  }
  for (const t of map.values()) t.rend = S.rendelesek.find(r => r.vevo === t.id) || null;
  return [...map.values()].sort((a, b) => (!!b.rend - !!a.rend) || (b.rend && a.rend ? (b.rend.allapot === 'uj') - (a.rend.allapot === 'uj') : 0) || b.utolso - a.utolso);
}
function rendCimke(r, most) {
  if (!r) return '';
  if (r.allapot === 'uj') return cimke(`RENDELÉS · <b data-cd="${r.ablak[1]}" data-elo="lejár "></b>`, 'uj');
  return cimke(most < r.ablak[0] ? `VÁLLALVA · ${ora(r.ablak[0])}-tól` : `VÁLLALVA · <b data-cd="${r.ablak[1]}" data-elo="még "></b>`, 'vallalt');
}
function uzenetekLap() {
  return {
    fajta: 'telefon', cim: 'Üzenetek', live: 1,
    html(ui) {
      const sz = szalak(ui), most = ui.E.now();
      if (!sz.length) return ures('Még senki nem írt. Majd fog: a falu szomjas.');
      const ossz = sz.reduce((a, t) => a + t.msgs.length, 0);
      return `<div class="ku-gorget" data-gorget="szalak">${sz.map((t, i) => {
        const u = t.msgs[t.msgs.length - 1];
        const sn = (u.kitol === 'en' ? 'Te: ' : '') + u.szoveg;
        return `<button class="ku-szal ${t.olv ? 'olv' : ''}" data-a="szal" data-v="${esc(t.id)}" ${i === 0 ? 'data-elso' : ''}>
          ${erem(t.nev, t.rend ? 0.8 : 0.45)}
          <span class="ku-szal-k"><span class="ku-szal-f"><b>${esc(t.nev)}</b><i>${mikor(t.utolso, most)}</i></span>
          <span class="ku-szal-s">${esc(sn.length > 90 ? sn.slice(0, 88) + '…' : sn)}</span>${rendCimke(t.rend, most)}</span>
          ${t.olv ? `<b class="ku-jv">${t.olv}</b>` : ''}</button>`;
      }).join('')}<div class="ku-labjegy">${sz.length} beszélgetés · ${szam(ossz)} üzenet</div></div>`;
    },
    act(a, v, ui) { if (a === 'szal') ui.push(szalLap(v)); },
  };
}
function szalLap(id) {
  return {
    fajta: 'telefon', nev: 'uzenetek', live: 1, alku: [], softBal: 'Mehet',
    st: { ar: { v: 0, min: 0, max: 0, lepes: 100, nagy: 1000, fmt: ft } },
    cim(ui) { const t = szalak(ui).find(x => x.id === id); return esc(t?.nev || 'Üzenetek'); },
    init(ui) { this._uj = true; },
    html(ui) {
      const t = szalak(ui).find(x => x.id === id);
      if (!t) return ures('Ez a beszélgetés már nincs meg.');
      // (az olvasottság-jelzés egyszer megy ki üzenetenként: közös játékban a tükör csak a válasz után frissül)
      this._olvas ||= new Set();
      for (const m of t.msgs) if (!m.olvasva && !this._olvas.has(m.id)) { this._olvas.add(m.id); ui.E.markRead(m.id); }
      const most = ui.E.now();
      const bub = t.msgs.slice(-40).map(m => `<div class="ku-bub ${m.kitol === 'en' ? 'en' : ''} ${m.rendeles ? 'rend' : ''}"><p>${esc(m.szoveg)}</p><i>${mikor(m.ido, most)}</i></div>`).join('')
        + this.alku.map(b => `<div class="ku-bub ${b.en ? 'en' : ''} helyi"><p>${esc(b.t)}</p></div>`).join('');
      return `<div class="ku-szalnez"><div class="ku-gorget ku-buborekok" data-gorget="bub">${bub}</div>${t.rend ? rendKartya(ui, t.rend, this) : ''}${vjHtml(this)}</div>`;
    },
    utan(ui, el) { if (this._uj) { const b = el.querySelector('.ku-buborekok'); if (b) b.scrollTop = b.scrollHeight; this._uj = false; } },
    act(a, v, ui) {
      const E = ui.E, r = E.state.rendelesek.find(x => x.id === v);
      if (a === 'elfogad') { ui._enSzal = r.vevo; const x = E.acceptOrder(v); utana(x, () => { ui._enSzal = null; }); vj(this, x, 'Vállalva. Ott leszel.'); this._uj = true; }
      else if (a === 'elutasit') { vj(this, E.declineOrder(v), 'Lemondtad. Kicsit megsértődött.'); }
      else if (a === 'alku') { this.alkuNyit = true; this.st.ar.v = Math.round(r.ar * 1.15 / 100) * 100; this.st.ar.min = r.ar; this.st.ar.max = Math.round(r.ar * 2 / 100) * 100; }
      else if (a === 'ajanlat' || a === 'ellen') {
        const ar = a === 'ellen' ? +v.split('|')[1] : this.st.ar.v, oid = a === 'ellen' ? v.split('|')[0] : v;
        this.alku.push({ en: true, t: `${ft(ar)}?` });
        const kesz = utana(E.haggle(oid, ar), x => {
          this.alku.push({ en: false, t: x.valasz || x.hiba || '' });
          this.ellen = x.ellenajanlat || null;
          if (x.elfogad) { this.alkuNyit = false; this.ellen = null; vj(this, { ok: true }, `Megegyeztetek: ${ft(ar)}.`); }
          if (x.megszakadt) { this.alkuNyit = false; vj(this, { ok: false, hiba: 'Megsértődött, és lemondta.' }); }
          this._uj = true;
        });
        if (kesz) return kesz;   // közös játék: a válasz után még egy rajzolás
      }
      else if (a === 'atadas') ui.open('atadas', { rendeles: v });
      else if (a === 'terkepen') ui.push(terkepLap({ kiemel: 'r:' + v }));
    },
    enter(ui) { const r = ui.S.rendelesek.find(x => x.vevo === id); if (r && this.alkuNyit) ui.akcio('ajanlat', r.id); },
    vissza() { if (this.alkuNyit) { this.alkuNyit = false; return true; } return false; },
  };
}
function rendKartya(ui, r, lap) {
  const E = ui.E, most = E.now(), elo = most < r.ablak[0];
  const fej = `<div class="ku-rk-fej">${r.allapot === 'uj' ? 'Rendelés' : 'Vállalt rendelés'}<b>${ft(r.ar)}</b></div>`;
  const kiv = `<div class="ku-rk-kiv">${esc(E.wishText(r))}</div>`;
  const hely = `<div class="ku-rk-hely">${ikon('terkep')}<span>${esc(r.helyNev)} · ${ora(r.ablak[0])}–${ora(r.ablak[1])}</span></div>`;
  const ido = `<div class="ku-rk-ido"><span class="ku-sav idosav"><i data-cdsav="${r.ido ?? r.ablak[0]},${r.ablak[1]}"></i></span><b data-cd="${r.ablak[1]}" data-elo="${elo ? 'kezdődik ' + ora(r.ablak[0]) + ', lejár ' : 'lejár '}"></b></div>`;
  let gb;
  if (lap.alkuNyit) {
    gb = `<div class="ku-alku">${lepteto('ar', lap.st.ar, 'Ajánlatod', 'szeles')}${gombok(gomb('ajanlat', r.id, 'Megírom', 'fo', 'data-elso'), lap.ellen ? gomb('ellen', r.id + '|' + lap.ellen, `Legyen ${ft(lap.ellen)}`) : '')}</div>`;
  } else if (r.allapot === 'uj') {
    gb = gombok(gomb('elfogad', r.id, 'Elfogadom', 'fo', 'data-elso'), gomb('alku', r.id, 'Alkuszom'), gomb('elutasit', r.id, 'Nem vállalom', 'halk'));
  } else {
    const mehet = !elo && most <= r.ablak[1] && ui.kozel({ node: r.hely, pos: r.pos });
    gb = gombok(mehet ? gomb('atadas', r.id, 'Átadás most', 'fo', 'data-elso') : '', gomb('terkepen', r.id, 'Térképen', mehet ? '' : 'fo', mehet ? '' : 'data-elso'), gomb('alku', r.id, 'Alkuszom'), gomb('elutasit', r.id, 'Lemondom', 'halk'));
  }
  return `<div class="ku-rk ${r.allapot}">${fej}${kiv}${hely}${ido}${gb}</div>`;
}

// ================================================================ Névjegyek
function izlesSorok(ui, v) {
  const ism = new Set(ui.S.hatasok.map(h => h.id));
  const iz = v.izles;
  const fok = iz.minFok && iz.maxFok ? `${iz.minFok}–${iz.maxFok} fok` : iz.minFok ? `legalább ${iz.minFok} fok` : iz.maxFok ? `legfeljebb ${iz.maxFok} fok` : 'mindegy';
  const hat = (lst, ures) => lst.length ? lst.map(e => ism.has(e) ? chip(e) : `<span class="ku-chip ismeretlen"><i></i>még nem ismered</span>`).join('') : `<span class="ku-halk">${ures}</span>`;
  return kv('Gyümölcs', iz.gyumolcs ? gyNev(iz.gyumolcs) : 'bármi, ami pálinka') + kv('Erősség', fok) + kv('Minőség', `legalább ${iz.minQ} pont`)
    + `<div class="ku-kv osz"><span>Kedvenc</span><div class="ku-chipek">${hat(iz.kedvel, 'nincs különösebb')}</div></div>`
    + `<div class="ku-kv osz"><span>Utálja</span><div class="ku-chipek">${hat(iz.utal, 'semmit, ami ingyen van')}</div></div>`
    + (iz.igenyes ? kv('Igényes', 'palackot és címkét vár') : '');
}
function nevjegyekLap() {
  return {
    fajta: 'telefon', cim: 'Névjegyek',
    html(ui) {
      const S = ui.S; let elso = true;
      const out = REGIONS.map(R => {
        const vk = S.vevok.filter(v => v.regio === R.id);
        if (!vk.length) return '';
        const akt = vk.filter(v => v.allapot === 'aktiv').length;
        return szakasz(esc(R.nev), `${akt}/${vk.length} vevő`) + vk.sort((a, b) => (b.allapot === 'aktiv') - (a.allapot === 'aktiv') || b.huseg - a.huseg).map(v => {
          const tag = v.allapot !== 'aktiv' ? cimke(v.kostolhato ? 'kóstoltatható' : 'holnap kóstolhat', 'halk') : v.terjeszto ? cimke('terjesztőnél', 'halk') : v.torzs ? cimke('törzsvendég', 'arany') : '';
          const b = `${erem(v.nev, v.allapot === 'aktiv' ? v.huseg / 100 : 0.1, v.allapot !== 'aktiv' ? 'szurke' : '')}<span class="ku-nj"><b>${esc(v.nev)}</b><span>${v.allapot === 'aktiv' ? sav(v.huseg / 100, 'huseg') + `<i>${v.huseg}</i>` : '<i class="ku-halk">még nem vevőd</i>'}</span></span>`;
          const s = sor('vevo', v.id, b, tag, '', elso ? 'data-elso' : ''); elso = false; return s;
        }).join('');
      }).join('');
      return `<div class="ku-gorget" data-gorget="nj">${out || ures('Senkit nem ismersz. Kóstoltass!')}</div>`;
    },
    act(a, v, ui) { if (a === 'vevo') ui.push(vevoLap(v)); },
  };
}
function vevoLap(id) {
  return {
    fajta: 'telefon', nev: 'nevjegyek',
    cim: ui => esc(ui.S.vevok.find(v => v.id === id)?.nev || ''),
    html(ui) {
      const S = ui.S, v = S.vevok.find(x => x.id === id); if (!v) return ures('Nincs ilyen ismerős.');
      const nalad = S.tetelek.filter(t => t.hely === 'nalad' && t.l >= 0.1 && !t.erleles);
      let akc = '';
      if (v.allapot !== 'aktiv') {
        akc = szakasz('Kóstoltatás', '1 deci a nálad lévőből') + (v.kostolhato
          ? (nalad.length ? nalad.map((t, i) => sor('kostol', t.id, `<b>${esc(t.nev)}</b><small>${tetelSor(t)}</small>`, '', '', i === 0 ? 'data-elso' : '')).join('') : ures('Nincs nálad pálinka. Vegyél magadhoz a raktárból.'))
          : ures('Ma már kóstolt. Holnap próbáld újra.'));
      } else {
        const dl = S.terjesztok.filter(d => d.felveve);
        akc = szakasz('Ki viszi neki?') + sor('rendel', '', `<b>Magam viszem</b>`, v.terjeszto ? '' : '✓', v.terjeszto ? '' : 'kesz', 'data-elso')
          + dl.map(d => sor('rendel', d.id, `<b>${esc(d.nev)}</b><small>${d.vevok.length}/${d.maxVevo} vevő · jutalék ${Math.round(d.jutalek * 100)} %</small>`, v.terjeszto === d.id ? '✓' : '', v.terjeszto === d.id ? 'kesz' : '')).join('');
      }
      return `<div class="ku-gorget" data-gorget="vevo"><div class="ku-vevofej">${erem(v.nev, v.huseg / 100, 'nagy')}<div><b>${esc(v.nev)}</b><span>${esc(REG[v.regio]?.nev || '')}${v.torzs ? ' · törzsvendég' : ''}</span>
        ${v.allapot === 'aktiv' ? `<span class="ku-huseg">${sav(v.huseg / 100, 'huseg')}<i>hűség ${v.huseg}</i></span>` : ''}</div></div>
        <blockquote>„${esc(v.keres)}”</blockquote>${izlesSorok(ui, v)}${vjHtml(this)}${akc}</div>`;
    },
    act(a, v, ui) {
      if (a === 'kostol') return utana(ui.E.giveSample(id, v), r => { vj(this, r.ok ? { ok: r.siker, valasz: r.valasz } : r, r.siker ? `${r.valasz} Új vevő!` : r.valasz); });
      if (a === 'rendel') vj(this, ui.E.assign(id, v || null), v ? 'Mostantól a terjesztő viszi neki.' : 'Mostantól te viszed neki.');
    },
  };
}

// ================================================================ Térkép (a telefonon kicsiben, „nagy térkép” a teljes képernyőn)
export function terkepLap(o = {}) {
  return {
    fajta: 'telefon', nev: 'terkep', cim: 'Térkép', live: 1, kiemel: o.kiemel || null,
    html(ui) {
      const cel = terkepCelok(ui);
      return `<div class="ku-tkp"><canvas class="ku-tkp-c"></canvas></div>
        <div class="ku-gorget ku-tkp-lista" data-gorget="tkp">${gomb('nagy', '', `${ikon('terkep')} Nagy térkép`, 'szeles', 'data-elso')}
        ${cel.map(c => sor('cel', c.k, `<span class="ku-jelzo ${c.tipus}"></span><b>${esc(c.nev)}</b><small>${esc(c.al)}</small>`, c.jobb || '')).join('') || ures('Nincs kijelölt cél.')}</div>`;
    },
    utan(ui, el) { const c = el.querySelector('canvas'); if (c) rajzolTerkep(c, ui, { kiemel: this.kiemel, kicsi: true }); },
    fokusz(a, v, ui) { if (a === 'cel' && this.kiemel !== v) { this.kiemel = v; const c = ui.modal.lapEl.querySelector('canvas'); if (c) rajzolTerkep(c, ui, { kiemel: v, kicsi: true }); } },
    act(a, v, ui) { if (a === 'nagy') ui.open('terkep-nagy', { kiemel: this.kiemel }); return a !== 'cel' && undefined; },
  };
}

// ================================================================ Receptkönyv
function receptLap() {
  return {
    fajta: 'telefon', cim: 'Receptkönyv', nyit: null,
    html(ui) {
      const S = ui.S, rec = ui.E.recipes(), ism = new Set(S.hatasok.map(h => h.id));
      const ossz = Object.keys(HATASOK).length;
      const hat = Object.keys(HATASOK).map(id => ism.has(id) ? chip(id, 'kicsi') : `<span class="ku-chip kicsi ismeretlen"><i></i>?</span>`).join('');
      const lista = rec.length ? rec.map((r, i) => {
        const ny = this.nyit === r.kulcs;
        const jegyz = ny ? r.effektek.filter(e => HATAS_JEGYZET[e]).map(e => `<p class="ku-margo">${esc(HATAS_JEGYZET[e])}</p>`).join('') : '';
        return `<button class="ku-recept ${ny ? 'nyit' : ''}" data-a="rc" data-v="${esc(r.kulcs)}" ${i === 0 ? 'data-elso' : ''}>
          <span class="ku-rc-f"><b>${esc(r.nev)}</b><i class="ku-szorzo">${szorzo(r.ertekSzorzo)}</i></span>
          <span class="ku-chipek">${r.effektek.map(e => chip(e, 'kicsi')).join('')}</span>
          ${ny ? `<span class="ku-rc-lanc">${esc(gyRovid(r.gyumolcs))}${r.osszetevok.map(o => ' → ' + esc(cikkNev(o))).join('')}</span>
          <span class="ku-rc-al">Felfedezve: ${r.felfedezve}. nap${r.legjobbAr ? ` · legjobb ár ${ft(r.legjobbAr)}/l` : ''}</span>${jegyz}` : ''}</button>`;
      }).join('') : ures('Üres a füzet. A keverőasztalnál írhatsz bele.');
      return `<div class="ku-gorget" data-gorget="rc">${szakasz('Felfedezett hatások', `${ism.size} / ${ossz}`)}<div class="ku-chipek ku-hatasracs">${hat}</div>${szakasz('Receptek', `${rec.length}`)}${lista}</div>`;
    },
    act(a, v) { if (a === 'rc') this.nyit = this.nyit === v ? null : v; },
  };
}

// ================================================================ Rendelés (beszállítók és szállítmányok)
function rendelesLap() {
  return {
    fajta: 'telefon', cim: 'Rendelés', live: 1,
    html(ui) {
      const S = ui.S, E = ui.E, most = E.now();
      const szall = S.szallitmanyok.map(d => {
        const meg = d.allapot === 'megerkezett';
        const b = `<b>${d.db} × ${esc(cikkNev(d.tetel))}</b><small>${esc(d.helyNev)}</small>`;
        return meg ? sor('atvesz', d.id, b, cimke('megjött · átveszem', 'uj'), '', '') : sor('szall', d.id, b, `<b data-cd="${d.erkezes}" data-elo="" data-lejart="mindjárt"></b>`, 'halk');
      }).join('');
      const sz = E.suppliers().map((s, i) => sor(s.elerheto ? 'beszallito' : 'zart', s.id, `<b>${esc(s.nev)}</b><small>${esc(REG[s.regio]?.nev || '')} · ${s.fizetes === 'kp' ? 'készpénzért' : s.fizetes === 'szamla' ? 'átutalással' : 'kp vagy számla'}</small>`,
        s.elerheto ? '›' : `${ikon('lakat')}`, s.elerheto ? '' : 'zart', i === 0 ? 'data-elso' : '')).join('');
      return `<div class="ku-gorget" data-gorget="rend">${vjHtml(this)}${szall ? szakasz('Úton és leadva', S.szallitmanyok.length) + szall : ''}${szakasz('Beszállítók')}${sz}</div>`;
    },
    act(a, v, ui) {
      if (a === 'beszallito') ui.push(beszallitoLap(v));
      if (a === 'zart') { const s = ui.E.suppliers().find(x => x.id === v); vj(this, { ok: false, hiba: `${s.nev} még nem áll szóba veled. Majd egy rangot lépj.` }); }
      if (a === 'atvesz') {
        const d = ui.S.szallitmanyok.find(x => x.id === v);
        if (!ui.kozel({ node: d.hely, pos: d.pos })) return vj(this, { ok: false, hiba: `Menj érte: ${d.helyNev}.` });
        vj(this, ui.E.pickup(v), `Átvetted: ${d.db} × ${cikkNev(d.tetel)}.`);
      }
    },
  };
}
function beszallitoLap(id) {
  return {
    fajta: 'telefon', nev: 'rendeles', sel: null,
    st: { db: { v: 1, min: 1, max: 50, lepes: 1, nagy: 5 } },
    cim: ui => esc(ui.E.suppliers().find(s => s.id === id)?.nev || ''),
    html(ui) {
      const s = ui.E.suppliers().find(x => x.id === id), inv = ui.S.keszlet.cikkek;
      const sel = s.cikkek.find(c => c.id === this.sel);
      const kosar = sel ? `<div class="ku-kosar">${lepteto('db', this.st.db, esc(sel.nev), 'szeles')}<div class="ku-kosar-ossz"><span>Összesen</span><b>${ft(sel.ar * this.st.db.v)}</b></div>
        ${gomb('rendel', sel.id, 'Megrendelem', 'fo szeles')}</div>` : '';
      return `<div class="ku-gorget" data-gorget="besz"><div class="ku-leadas">${ikon('rendeles')}<span>Leadás: ${esc(s.leadas)}</span></div>${vjHtml(this)}${kosar}
        ${s.cikkek.map((c, i) => sor(c.elerheto ? 'valaszt' : 'zart', c.id, `<b>${esc(c.nev)}</b><small>${inv[c.id] ? `van: ${inv[c.id]}` : c.tipus === 'gyumolcs' ? `${ui.S.keszlet.gyumolcs[CIKKEK[c.id].gy]?.kg || 0} kg a kamrában` : 'nincs'}</small>`,
          c.elerheto ? ft(c.ar) : ikon('lakat'), (c.elerheto ? '' : 'zart ') + (this.sel === c.id ? 'kesz' : ''), !sel && i === 0 ? 'data-elso' : '')).join('')}</div>`;
    },
    act(a, v, ui) {
      if (a === 'valaszt') { this.sel = v; this.st.db.v = 1; setTimeout(() => ui.modal?.lapEl.querySelector('[data-st="db"]')?.focus(), 0); }
      if (a === 'zart') vj(this, { ok: false, hiba: 'Ezt még nem adja el neked. Rangot kell lépned.' });
      if (a === 'rendel') {
        return utana(ui.E.order(id, v, this.st.db.v), r => {
          vj(this, r, r.ok ? `Rendelve. Érkezik ${ora(r.erkezes)}-kor: ${r.helyNev}.` : null);
          if (r.ok) { this.sel = null; ui.hang('penz_erme'); }
        });
      }
    },
    enter(ui) { if (this.sel) ui.akcio('rendel', this.sel); },
    vissza() { if (this.sel) { this.sel = null; return true; } return false; },
  };
}

// ================================================================ Terjesztők
function terjesztokLap() {
  return {
    fajta: 'telefon', cim: 'Terjesztők',
    html(ui) {
      const S = ui.S;
      const be = S.terjesztok.reduce((a, d) => a + d.kp, 0);
      return `<div class="ku-gorget" data-gorget="terj">${be ? `<div class="ku-osszeg">${ikon('zseb')}<span>Beszedhető összesen</span><b>${ft(be)}</b></div>` : ''}
        ${S.terjesztok.map((d, i) => {
          const jobb = d.felveve ? (d.lebukva ? cimke('lapít', 'rossz') : d.kp ? cimke(ft(d.kp), 'arany') : cimke(`${d.vevok.length}/${d.maxVevo}`, 'halk')) : d.elerheto ? ft(d.felvetel) : ikon('lakat');
          return sor('terj', d.id, `${erem(d.nev, d.felveve ? 0.85 : 0.2, d.felveve ? '' : 'szurke')}<span class="ku-nj"><b>${esc(d.nev)}</b><small>${esc(REG[d.regio]?.nev || '')} · ${d.felveve ? `${l(d.keszletL)} nála` : d.elerheto ? 'felvehető' : rangNev(d.rank) + ' rangtól'}</small></span>`, jobb, d.elerheto || d.felveve ? '' : 'zart', i === 0 ? 'data-elso' : '');
        }).join('')}</div>`;
    },
    act(a, v, ui) { if (a === 'terj') ui.push(terjesztoLap(v)); },
  };
}
function terjesztoLap(id) {
  return {
    fajta: 'telefon', nev: 'terjesztok', mod: null,
    st: { l: { v: 1, min: 0.5, max: 1, lepes: 0.5, nagy: 5, fmt: l } },
    cim: ui => esc(ui.S.terjesztok.find(d => d.id === id)?.nev || ''),
    html(ui) {
      const S = ui.S, d = S.terjesztok.find(x => x.id === id);
      const fej = `<div class="ku-vevofej">${erem(d.nev, d.felveve ? 0.85 : 0.2, 'nagy')}<div><b>${esc(d.nev)}</b><span>${esc(REG[d.regio]?.nev || '')}</span></div></div><blockquote>„${esc(d.mondas)}”</blockquote>`;
      const adat = kv('Jutalék', `${Math.round(d.jutalek * 100)} %`) + kv('Vevők', `${d.vevok.length} / ${d.maxVevo}`) + kv('Lebukás esélye', `${szam(d.kockazat * 100, 0)} % naponta`)
        + (d.felveve ? kv('Készlet nála', l(d.keszletL)) + kv('Nála a pénzed', ft(d.kp)) + kv('Eddig hozott', ft(d.osszes)) : '');
      if (!d.felveve) {
        return `<div class="ku-gorget" data-gorget="t1">${fej}${adat}${vjHtml(this)}${d.elerheto ? gomb('felvesz', id, `Felveszem · ${ft(d.felvetel)} belépő`, 'fo szeles', 'data-elso') : `<div class="ku-zarva">${ikon('lakat')} ${rangNev(d.rank)} ranggal áll szóba veled.</div>`}</div>`;
      }
      if (this.mod === 'aru') {
        const t = S.tetelek.filter(x => (x.hely === 'nalad' || x.hely.startsWith('prop:') || x.hely.startsWith('rejtek:')) && !x.erleles);
        const sel = t.find(x => x.id === this.sel);
        if (sel) this.st.l.max = Math.max(0.5, Math.floor(sel.l * 2) / 2);
        return `<div class="ku-gorget" data-gorget="t2">${szakasz('Mit vigyen?', 'nálad és a raktáraidban')}${vjHtml(this)}
          ${sel ? `<div class="ku-kosar">${lepteto('l', this.st.l, 'Mennyit', 'szeles')}${gomb('tolt', sel.id, `Átadom neki: ${l(this.st.l.v)}`, 'fo szeles')}</div>` : ''}
          ${t.map((x, i) => sor('valaszt', x.id, `<b>${esc(x.nev)}</b><small>${tetelSor(x)} · ${esc(helyNev(x.hely, S.ingatlanok))}</small>`, ft(x.ertek), this.sel === x.id ? 'kesz' : '', !sel && i === 0 ? 'data-elso' : '')).join('') || ures('Nincs átadható pálinka.')}</div>`;
      }
      if (this.mod === 'vevok') {
        const vk = S.vevok.filter(v => v.allapot === 'aktiv');
        return `<div class="ku-gorget" data-gorget="t3">${szakasz('Kiket vigyen?', `${d.vevok.length}/${d.maxVevo}`)}${vjHtml(this)}
          ${vk.map((v, i) => sor('rendel', v.id, `${erem(v.nev, v.huseg / 100)}<span class="ku-nj"><b>${esc(v.nev)}</b><small>${esc(REG[v.regio]?.nev || '')}${v.terjeszto && v.terjeszto !== id ? ' · másik terjesztőnél' : ''}</small></span>`, v.terjeszto === id ? '✓' : '', v.terjeszto === id ? 'kesz' : '', i === 0 ? 'data-elso' : '')).join('') || ures('Még nincs vevőd.')}</div>`;
      }
      return `<div class="ku-gorget" data-gorget="t4">${fej}${vjHtml(this)}${gombok(d.kp ? gomb('beszed', id, `Beszedem: ${ft(d.kp)}`, 'fo', 'data-elso') : '', gomb('mod', 'aru', 'Árut viszek neki', d.kp ? '' : 'fo', d.kp ? '' : 'data-elso'), gomb('mod', 'vevok', 'Vevőket adok neki'))}${adat}</div>`;
    },
    act(a, v, ui) {
      const E = ui.E;
      if (a === 'felvesz') vj(this, E.hireDealer(id), 'Felvetted. Kezet fogtatok.');
      if (a === 'beszed') return utana(E.collect(id), r => { vj(this, r, `Leszámolt: ${ft(r.osszeg || 0)}.`); if (r.ok && r.osszeg) ui.hud.penzFel(r.osszeg); });
      if (a === 'mod') { this.mod = v; this.sel = null; }
      if (a === 'valaszt') { this.sel = v; const t = ui.S.tetelek.find(x => x.id === v); this.st.l.v = Math.max(0.5, Math.floor(t.l * 2) / 2); setTimeout(() => ui.modal?.lapEl.querySelector('[data-st="l"]')?.focus(), 0); }
      if (a === 'tolt') { const r = E.stockDealer(id, v, this.st.l.v); vj(this, r, r => `Átadtál ${l(r.l || 0)} pálinkát.`); this.sel = null; }
      if (a === 'rendel') { const d = ui.S.terjesztok.find(x => x.id === id), van = d.vevok.includes(v); vj(this, E.assign(v, van ? null : id), van ? 'Visszavetted.' : 'Mostantól ő viszi neki.'); }
    },
    enter(ui) { if (this.sel) ui.akcio('tolt', this.sel); },
    vissza() { if (this.sel) { this.sel = null; return true; } if (this.mod) { this.mod = null; return true; } return false; },
  };
}

// ================================================================ Birodalom
function birodalomLap() {
  return {
    fajta: 'telefon', cim: 'Birodalom',
    html(ui) {
      const S = ui.S;
      const own = S.ingatlanok.filter(p => p.owned).length, biz = S.uzletek.filter(b => b.sajat).length;
      const nalad = S.tetelek.filter(t => t.hely === 'nalad').reduce((a, t) => a + t.l, 0);
      const ossz = S.tetelek.reduce((a, t) => a + t.l, 0);
      return `<div class="ku-gorget" data-gorget="bir"><div class="ku-birfej"><b>${esc(S.rang.nev)}</b><span>${own} ingatlan · ${S.alkalmazottak.length} ember · ${biz} üzlet</span></div>
        ${sor('menu', 'raktar', `${ikon('hordo')}<b>Raktár és tételek</b><small>${l(ossz)} pálinka, ebből nálad ${l(nalad)}</small>`, '›', '', 'data-elso')}
        ${sor('menu', 'ingatlan', `${ikon('birodalom')}<b>Ingatlanok</b><small>${own} / ${S.ingatlanok.length} a tiéd</small>`, '›')}
        ${sor('menu', 'emberek', `${ikon('terjesztok')}<b>Alkalmazottak</b><small>${S.alkalmazottak.length ? S.alkalmazottak.map(a => a.nev).slice(0, 3).join(', ') : 'senki, egyedül csinálod'}</small>`, '›')}
        ${sor('menu', 'uzlet', `${ikon('szamla')}<b>Üzletek és pénzmosás</b><small>napi ${ft(S.penz.mosasKapacitas)} mosható · sorban ${ft(S.penz.mosasSor)}</small>`, '›')}
        ${sor('menu', 'jarmu', `${ikon('auto')}<b>Járművek</b><small>most: ${esc(JARMUVEK[S.jarmuvek.aktiv || 'gyalog']?.nev || 'gyalog')}</small>`, '›')}</div>`;
    },
    act(a, v, ui) { if (a === 'menu') ui.push(({ raktar: raktarLap, ingatlan: ingatlanokLap, emberek: emberekLap, uzlet: uzletLap, jarmu: jarmuLap })[v]()); },
  };
}
function raktarLap() {
  return {
    fajta: 'telefon', nev: 'birodalom', cim: 'Raktár',
    html(ui) {
      const S = ui.S;
      const csop = {};
      for (const t of S.tetelek) (csop[t.hely.startsWith('terjeszto:') ? 'terjeszto' : t.hely] ||= []).push(t);
      const sorrend = Object.keys(csop).sort((a, b) => (b === 'nalad') - (a === 'nalad'));
      let elso = true;
      const tet = sorrend.map(h => szakasz(esc(h === 'terjeszto' ? 'terjesztőknél' : helyNev(h, S.ingatlanok)), l(csop[h].reduce((a, t) => a + t.l, 0))) + csop[h].map(t => {
        const s = sor('tetel', t.id, `<b>${esc(t.nev)}</b><small>${tetelSor(t)}${t.erleles ? ' · érlelődik' : ''}</small><span class="ku-chipek">${t.effektek.map(e => chip(e, 'kicsi')).join('')}</span>`, ft(t.ertek), '', elso ? 'data-elso' : '');
        elso = false; return s;
      }).join('')).join('');
      const inv = ui.E.inventory().sort((a, b) => a.tipus.localeCompare(b.tipus));
      const gy = Object.entries(S.keszlet.gyumolcs).filter(([, g]) => g.kg > 0);
      return `<div class="ku-gorget" data-gorget="rak">${vjHtml(this)}${tet || ures('Nincs pálinkád. Az üst vár.')}
        ${szakasz('Kamra', gy.length ? gy.map(([k, g]) => `${g.kg} kg ${gyRovid(k)}`).join(', ') : 'üres')}
        <div class="ku-keszlet">${inv.map(c => `<span><b>${c.db}</b> ${esc(c.nev)}</span>`).join('') || '<span class="ku-halk">semmi</span>'}</div></div>`;
    },
    act(a, v, ui) { if (a === 'tetel') ui.push(tetelLap(v)); },
  };
}
function tetelLap(id) {
  return {
    fajta: 'telefon', nev: 'birodalom',
    cim: ui => esc(ui.S.tetelek.find(t => t.id === id)?.nev || 'Tétel'),
    html(ui) {
      const S = ui.S, t = S.tetelek.find(x => x.id === id);
      if (!t) return ures('Ez a tétel már nincs meg.') + vjHtml(this);
      const sajat = S.ingatlanok.filter(p => p.owned);
      const prop = t.hely.split(':')[1];
      const g = [];
      if (t.hely !== 'nalad' && !t.hely.startsWith('terjeszto:')) g.push(gomb('magadhoz', id, 'Magamhoz veszem', 'fo', 'data-elso'));
      if (t.hely === 'nalad' || t.hely.startsWith('prop:')) for (const p of sajat) g.push(gomb('rejt', p.id, `Rejtekbe: ${esc(p.nev)}`));
      if (t.hely === 'nalad') for (const p of sajat) g.push(gomb('letesz', p.id, `Leteszem: ${esc(p.nev)}`, g.length ? '' : 'fo', g.length ? '' : 'data-elso'));
      return `<div class="ku-gorget" data-gorget="tet">${kv('Hol', esc(helyNev(t.hely, S.ingatlanok)))}${kv('Mennyiség', l(t.l) + (t.palack ? ` · ${t.palack.db} üveg` : ''))}${kv('Erősség', `${szam(t.fok)} fok`)}${kv('Minőség', `${Math.round(t.q)} pont`)}
        ${kv('Értékszorzó', szorzo(t.ertekSzorzo))}${kv('Piaci érték', ft(t.ertek))}<div class="ku-chipek">${t.effektek.map(e => chip(e)).join('')}</div>${vjHtml(this)}<div class="ku-gombok osz">${g.join('')}</div>
        ${prop ? `<div class="ku-halk ku-megj">Ha szem előtt marad, házkutatásnál elviszik.</div>` : ''}</div>`;
    },
    act(a, v, ui) {
      const E = ui.E;
      if (a === 'magadhoz') vj(this, E.carry(id), 'Nálad van. A motozás 3 liter fölött büntet.');
      if (a === 'rejt') vj(this, E.hide(id, v), 'Elrejtve. A pénzügyőr ide nem néz be.');
      if (a === 'letesz') vj(this, E.store(id, v), 'Letetted.');
    },
  };
}
function ingatlanokLap() {
  return {
    fajta: 'telefon', nev: 'birodalom', cim: 'Ingatlanok',
    html(ui) {
      return `<div class="ku-gorget" data-gorget="ing">${ui.S.ingatlanok.map((p, i) => {
        const nyitva = ui.S.regiok.find(r => r.id === p.regio)?.nyitva;
        return sor('ing', p.id, `<b>${esc(p.nev)}</b><small>${esc(REG[p.regio]?.nev || '')} · ${p.ustok.length} üst · ${p.hordok.length} hordó · rejtek ${p.rejtek.kapacitas} l</small>`,
          p.owned ? cimke(p.fust ? 'füstöl' : 'a tiéd', p.fust ? 'uj' : 'arany') : nyitva ? ft(p.ar) : ikon('lakat'), p.owned || nyitva ? '' : 'zart', i === 0 ? 'data-elso' : '');
      }).join('')}</div>`;
    },
    act(a, v, ui) { if (a === 'ing') ui.push(ingatlanLap(v)); },
  };
}
function ingatlanLap(id) {
  return {
    fajta: 'telefon', nev: 'birodalom', cim: ui => esc(ui.S.ingatlanok.find(p => p.id === id)?.nev || ''),
    html(ui) {
      const S = ui.S, p = S.ingatlanok.find(x => x.id === id), rk = S.rang.rang;
      const nyitva = S.regiok.find(r => r.id === p.regio)?.nyitva;
      if (!p.owned) return `<div class="ku-gorget" data-gorget="i1">${kv('Hol', esc(REG[p.regio]?.nev || ''))}${kv('Ár', ft(p.ar) + ' készpénzben')}${kv('Ágy', p.agyak)}${kv('Üsthely', p.ustok.length)}${kv('Erjesztőhordó', p.hordok.length)}${kv('Kert', p.fak.length + ' fa')}${kv('Rejtekhely', p.rejtek.kapacitas + ' l')}
        ${vjHtml(this)}${nyitva ? gomb('vesz', id, `Megveszem · ${ft(p.ar)}`, 'fo szeles', 'data-elso') : `<div class="ku-zarva">${ikon('lakat')} ${esc(REG[p.regio]?.nev)}: ${rangNev(REG[p.regio]?.rank)} rangtól.</div>`}</div>`;
      const alk = S.alkalmazottak.filter(a => a.prop === id);
      const ustok = p.ustok.map((u, i) => {
        const kov = USTSOR[USTSOR.indexOf(u.szint) + 1];
        const all = u.pecset ? cimke('pecsét · ' + tartam(u.pecset), 'rossz') : u.allapot === 'all' ? cimke('áll', 'halk') : cimke(u.allapot === 'kezi' ? 'kézi főzés' : 'fő · ' + tartam(u.hatra), 'uj');
        return `<div class="ku-ust"><span><b>${i + 1}. ${esc(u.nev)}</b>${u.csiga ? ' · rézcsiga' : ''}</span>${all}</div>`
          + gombok(kov ? gomb('ustfej', i + '|' + kov, `${USTOK[kov].nev}: ${ft(USTOK[kov].ar)}`, rk < USTOK[kov].rank ? 'halk' : '', rk < USTOK[kov].rank ? 'disabled' : '') : '',
            !u.csiga ? gomb('csiga', i, `${CSIGA.nev}: ${ft(CSIGA.ar)}`, '', rk < CSIGA.rank ? 'disabled' : '') : '');
      }).join('');
      const fel = Object.entries(SZEREPEK).map(([k, s]) => gomb('felvesz', k, `${esc(s.nev)} · ${ft(s.ber)}/nap`, '', alk.length >= p.agyak ? 'disabled' : '')).join('');
      const fa = p.fak.filter(Boolean).length, horde = p.hordok.filter(h => h.allapot !== 'ures').length;
      return `<div class="ku-gorget" data-gorget="i2">${vjHtml(this)}
        ${szakasz('Üstök', p.fust ? 'füstöl a kémény' : '')}${ustok}
        ${!p.kemenysapka ? gombok(gomb('sapka', '', `${KEMENYSAPKA.nev}: ${ft(KEMENYSAPKA.ar)} · fele füst`, '', rk < KEMENYSAPKA.rank ? 'disabled' : '')) : kv('Kéménysapka', 'fent van, fele füst')}
        ${szakasz('Hely', '')}${kv('Kert', `${fa} / ${p.fak.length} fa`)}${kv('Erjesztőhordók', `${horde} / ${p.hordok.length} tele`)}${kv('Rejtekhely', `${l(p.rejtek.hasznalt)} / ${p.rejtek.kapacitas} l`)}${kv('Szem előtt', l(p.szemElott), p.szemElott > 3 ? 'veszely' : '')}
        ${szakasz('Emberek', `${alk.length} / ${p.agyak} ágy`)}${alk.map(a => sor('alk', a.id, `<b>${esc(a.nev)}</b><small>${esc(a.szerepNev)} · ${ft(a.ber)}/nap${a.tartozas ? ' · tartozol neki' : ''}</small>`, 'elbocsát', 'halk')).join('')}
        <div class="ku-gombok osz">${fel}</div></div>`;
    },
    act(a, v, ui) {
      const E = ui.E;
      if (a === 'vesz') return utana(E.buyProperty(id), r => { vj(this, r, 'A tiéd. A kulcsot a lábtörlő alatt találod.'); if (r.ok) ui.hang('penz_papir'); });
      if (a === 'ustfej') { const [i, sz] = v.split('|'); vj(this, E.upgradeStill(id, +i, sz), `Új üst: ${USTOK[sz].nev}.`); }
      if (a === 'csiga') vj(this, E.buyUpgrade(id, 'csiga', +v), 'Felszerelve a rézcsiga.');
      if (a === 'sapka') vj(this, E.buyUpgrade(id, 'kemenysapka'), 'Kéménysapka fent. A füst fele annyira látszik.');
      if (a === 'felvesz') vj(this, E.hire(id, v), 'Felvetted. Holnap reggel kezd.');
      if (a === 'alk') vj(this, E.fire(v), 'Elbocsátottad. Megsértődött, de érti.');
    },
  };
}
function emberekLap() {
  return {
    fajta: 'telefon', nev: 'birodalom', cim: 'Alkalmazottak',
    html(ui) {
      const S = ui.S;
      const ber = S.alkalmazottak.reduce((a, x) => a + x.ber, 0);
      return `<div class="ku-gorget" data-gorget="emb">${vjHtml(this)}${S.alkalmazottak.length ? kv('Napi bér összesen', ft(ber)) : ''}
        ${S.alkalmazottak.map((a, i) => `<div class="ku-ember"><b>${esc(a.nev)}</b><small>${esc(a.szerepNev)} · ${esc(S.ingatlanok.find(p => p.id === a.prop)?.nev || '')}</small><small class="ku-halk">${esc(a.feladat)}</small>
          ${gombok(gomb('elbocsat', a.id, `Elbocsátom (${ft(a.ber)}/nap)`, 'halk', i === 0 ? 'data-elso' : ''))}</div>`).join('') || ures('Senki nem dolgozik neked. Az ingatlanoknál vehetsz fel embert.')}</div>`;
    },
    act(a, v, ui) { if (a === 'elbocsat') vj(this, ui.E.fire(v), 'Elbocsátva.'); },
  };
}
function uzletLap() {
  return {
    fajta: 'telefon', nev: 'birodalom', cim: 'Üzletek és pénzmosás',
    st: { mos: { v: 10000, min: 1000, max: 10000, lepes: 1000, nagy: 10000, fmt: ft } },
    html(ui) {
      const S = ui.S, P = S.penz, kp = P.kp + P.dunyha;
      this.st.mos.max = Math.max(1000, Math.floor(kp / 1000) * 1000); this.st.mos.v = Math.min(this.st.mos.v, this.st.mos.max);
      const van = S.uzletek.some(b => b.sajat);
      return `<div class="ku-gorget" data-gorget="uzl">${vjHtml(this)}
        <div class="ku-mosas">${kv('Napi mosási kapacitás', ft(P.mosasKapacitas))}${kv('A kasszában vár', ft(P.mosasSor))}${kv('Díj', Math.round(BANK.mosasDij * 100) + ' %')}
        ${van ? lepteto('mos', this.st.mos, 'Kasszába', 'szeles') + gomb('mos', '', `Kasszába vele: ${ft(this.st.mos.v)}`, 'fo szeles', 'data-elso') : `<div class="ku-halk">„A pénz nem büdös, csak a forrása.” Előbb vegyél egy üzletet.</div>`}</div>
        ${szakasz('Üzletek')}${S.uzletek.map((b, i) => sor('vesz', b.id, `<b>${esc(b.nev)}</b><small>${esc(REG[b.regio]?.nev || '')} · napi ${ft(b.mosas)}</small>`, b.sajat ? cimke('a tiéd', 'arany') : b.elerheto ? ft(b.ar) : ikon('lakat'), b.sajat ? 'kesz' : b.elerheto ? '' : 'zart', !van && i === 0 ? 'data-elso' : '')).join('')}</div>`;
    },
    act(a, v, ui) {
      if (a === 'mos') vj(this, ui.E.launder(this.st.mos.v), `${ft(this.st.mos.v)} a kasszában. Éjjel a számládon lesz.`);
      if (a === 'vesz') { const b = ui.S.uzletek.find(x => x.id === v); if (!b.sajat) vj(this, ui.E.buyBusiness(v), `Megvetted: ${b.nev}.`); }
    },
    enter(ui) { ui.akcio('mos', ''); },
  };
}
function jarmuLap() {
  return {
    fajta: 'telefon', nev: 'birodalom', cim: 'Járművek',
    html(ui) {
      const J = ui.S.jarmuvek;
      return `<div class="ku-gorget" data-gorget="jar">${vjHtml(this)}
        ${sor('hasznal', 'gyalog', '<b>Gyalog</b><small>a legolcsóbb, a leglassabb</small>', J.aktiv === 'gyalog' ? '✓' : '', J.aktiv === 'gyalog' ? 'kesz' : '', 'data-elso')}
        ${J.kinalat.map(j => {
          const sajat = J.sajat.includes(j.id);
          return sor(sajat ? 'hasznal' : 'vesz', j.id, `<b>${esc(j.nev)}</b><small>rejtett csomagtér ${j.rejtett} l · ${j.sebesseg} m/s</small>`, sajat ? (J.aktiv === j.id ? '✓' : 'beülök') : j.elerheto ? ft(j.ar) : ikon('lakat'), sajat && J.aktiv === j.id ? 'kesz' : j.elerheto || sajat ? '' : 'zart');
        }).join('')}<div class="ku-halk ku-megj">Járművet csak a számládról veszel: a kereskedő nem fogad el dunyha alól előkerült pénzt.</div></div>`;
    },
    act(a, v, ui) {
      if (a === 'vesz') vj(this, ui.E.buyVehicle(v), 'A tiéd. Tankolva, de csak félig.');
      if (a === 'hasznal') { if (v === 'gyalog') { ui.E.s.jarmu = 'gyalog'; vj(this, { ok: true }, 'Gyalog mész.'); } else vj(this, ui.E.useVehicle(v), 'Beültél.'); }
    },
  };
}

// ================================================================ Bank
function bankLap() {
  return {
    fajta: 'telefon', cim: 'Bank',
    st: { o: { v: 10000, min: 1000, max: 1000000, lepes: 1000, nagy: 10000, fmt: ft } },
    html(ui) {
      const P = ui.S.penz;
      return `<div class="ku-gorget" data-gorget="bank">
        <div class="ku-bankkartyak">
          <div class="ku-bk zseb">${ikon('zseb')}<span>Zseb</span><b>${ft(P.kp)}</b></div>
          <div class="ku-bk dunyha">${ikon('dunyha')}<span>Dunyha alatt</span><b>${ft(P.dunyha)}</b></div>
          <div class="ku-bk szamla">${ikon('szamla')}<span>Takarékszámla</span><b>${ft(P.szamla)}</b></div>
        </div>${vjHtml(this)}
        ${lepteto('o', this.st.o, 'Összeg', 'szeles')}
        <div class="ku-racs2">${gomb('stash', '', 'Dunyha alá', '', 'data-elso')}${gomb('unstash', '', 'Előveszem')}${gomb('dep', '', 'Befizetem')}${gomb('wd', '', 'Felveszem')}</div>
        ${kv('Ma még befizethető', ft(P.befizetheto))}${kv('Ma még felvehető', ft(P.felveheto))}${kv('Mosásra vár', ft(P.mosasSor))}
        <div class="ku-halk ku-megj">A motozás a dunyhát nem találja. A házkutatás ${ft(BANK.dunyhaRazzia)} fölött igen. A takarék napi ${ft(BANK.napiBefizetes)} fölött kérdezni kezd.</div></div>`;
    },
    act(a, v, ui) {
      const E = ui.E, o = this.st.o.v;
      if (a === 'stash') vj(this, E.stash(o), `${ft(Math.min(o, ui.S.penz.kp))} a dunyha alatt.`);
      if (a === 'unstash') vj(this, E.unstash(o), 'Előkerült a dunyha alól.');
      if (a === 'dep') vj(this, E.deposit(o), r => `Befizetve: ${ft(r.osszeg || 0)}.`);
      if (a === 'wd') vj(this, E.withdraw(o), r => `Felvéve: ${ft(r.osszeg || 0)}.`);
    },
  };
}

// ================================================================ Nagyapa füzete
function fuzetLap() {
  return {
    fajta: 'telefon', cim: 'Nagyapa füzete',
    html(ui) {
      const q = ui.E.quests(), kesz = q.filter(x => x.allapot === 'kesz').length;
      return `<div class="ku-gorget ku-fuzet" data-gorget="fz"><div class="ku-fz-fej"><span>${kesz} / ${q.length} kipipálva</span>${sav(kesz / q.length)}</div>
        ${q.map(x => {
          const j = x.jutalom || {};
          const jut = [j.xp ? `${j.xp} XP` : '', j.kp ? ft(j.kp) : '', ...Object.entries(j.cikk || {}).map(([id, db]) => `${db} × ${cikkNev(id)}`)].filter(Boolean).join(' · ');
          if (x.allapot === 'zarolt') return `<button class="ku-fz zarolt" data-a="fz" data-v="${x.id}"><b>${esc(x.cim)}</b><small>a következő lapokon…</small></button>`;
          return `<button class="ku-fz ${x.allapot}" data-a="fz" data-v="${x.id}" ${x.allapot === 'aktiv' ? 'data-elso' : ''}><b>${esc(x.cim)}</b>${x.allapot === 'aktiv' ? `<p>${esc(x.szoveg)}</p>` : ''}<small>${esc(jut)}</small></button>`;
        }).join('')}</div>`;
    },
    act() { return false; },
  };
}

// ================================================================ Beállítások
const GRAFIKA_SZINT = ['alacsony', 'kozepes', 'magas'];
const GRAFIKA_NEV = ['alacsony (gyors)', 'közepes', 'magas (szép)'];
export function beallitasokLap(fajta = 'telefon') {
  return {
    fajta, nev: 'beallitasok', cim: 'Beállítások',
    init(ui) {
      const b = ui.beallitasok;
      this.st = {
        hangero: { v: Math.round(b.hangero * 100), min: 0, max: 100, lepes: 10, fmt: v => v ? v + ' %' : 'néma' },
        eger: { v: Math.round(b.eger * 10), min: 2, max: 30, lepes: 1, fmt: v => '×' + szam(v / 10, 1) },
        szoveg: { v: Math.round(b.szoveg * 100), min: 100, max: 130, lepes: 15, fmt: v => v + ' %' },
        mozgas: { v: b.mozgas ? 1 : 0, min: 0, max: 1, lepes: 1, fmt: v => v ? 'teljes' : 'visszafogott' },
        grafika: { v: Math.max(0, GRAFIKA_SZINT.indexOf(b.grafika || 'kozepes')), min: 0, max: 2, lepes: 1, fmt: v => GRAFIKA_NEV[v] },
      };
    },
    html(ui) {
      return `<div class="ku-gorget ku-beall" data-gorget="be">
        ${lepteto('hangero', this.st.hangero, 'Hangerő', 'szeles')}${lepteto('eger', this.st.eger, 'Egérérzékenység', 'szeles')}
        ${lepteto('szoveg', this.st.szoveg, 'Szövegméret', 'szeles')}${lepteto('mozgas', this.st.mozgas, 'Mozgás és villanás', 'szeles')}
        ${lepteto('grafika', this.st.grafika, 'Grafika', 'szeles')}
        <div class="ku-halk ku-megj"><kbd>←</kbd> <kbd>→</kbd> állítja. Azonnal érvényes, és megmarad.</div></div>`;
    },
    valtozott(n, ui) {
      const s = this.st;
      ui.beallit({ hangero: s.hangero.v / 100, eger: s.eger.v / 10, szoveg: s.szoveg.v / 100, mozgas: !!s.mozgas.v, grafika: GRAFIKA_SZINT[s.grafika.v] });
      if (n === 'hangero') ui.hang('ui_click');
    },
  };
}

// ================================================================ Napló
function naploLap() {
  return {
    fajta: 'telefon', cim: 'Napló', live: 2,
    html(ui) {
      const n = (ui.naplo || []).slice().reverse();
      return `<div class="ku-gorget" data-gorget="np">${n.map((x, i) => `<button class="ku-np ${x.hiba ? 'hiba' : ''}" data-a="np" data-v="${i}" ${i === 0 ? 'data-elso' : ''}><i>${mikor(x.ido, ui.E.now())}</i>${esc(x.t)}</button>`).join('') || ures('Még nem történt semmi. Az üst hideg.')}</div>`;
    },
    act() { return false; },
  };
}

import { mentesLap } from './menuk.js';
export const TELEFON_LAPOK = {
  telefon: ui => kezdoLap(ui),
  uzenetek: () => uzenetekLap(), szal: (ui, a) => szalLap(a.id), nevjegyek: () => nevjegyekLap(), vevo: (ui, a) => vevoLap(a.id),
  terkep: (ui, a) => terkepLap(a), recept: () => receptLap(), rendeles: () => rendelesLap(), beszallito: (ui, a) => beszallitoLap(a.id),
  terjesztok: () => terjesztokLap(), terjeszto: (ui, a) => terjesztoLap(a.id), birodalom: () => birodalomLap(), bank: () => bankLap(),
  fuzet: () => fuzetLap(), beallitasok: () => beallitasokLap('telefon'), naplo: () => naploLap(), 'mentes-app': () => mentesLap('telefon'),
};
export { monogram };
