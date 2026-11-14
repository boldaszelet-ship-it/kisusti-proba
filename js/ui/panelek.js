// Kisüsti UI — a munkapadok (a 3D-ben a tárgy E-re nyitja): keverőasztal, palackozó és érlelés, gyümölcsös, cefrés hordó,
// átadás a vevőnek, kóstoltatás, nagy térkép. Mind a valódi Empire-t hívja; a következmény a lapon azonnal látszik.
import { esc, ft, ftE, l, szam, szorzo, ora, tartam, chip, gyNev, gyRovid, cikkNev, tetelSor, helyNev, hatasNev, clamp, REG } from './kozos.js';
import { sor, szakasz, ures, lepteto, vj, utana, vjHtml, erem, sav, cimke, gombok, gomb, kv } from './elemek.js';
import { ikon } from './ikonok.js';
import { nagyTerkepLap } from './terkep.js';
import { OSSZETEVOK, HATASOK, HATAS_JEGYZET, CIKKEK, UVEGEK, CIMKEK, HORDOK, ADALEKOK, GYUMOLCSOK, FA } from '../../data/tartalom.js';
import { BARREL_CAP, FERMENT_MIN } from '../../sim.js';

const propNev = (ui, id) => ui.S.ingatlanok.find(p => p.id === id)?.nev || 'a tanya';
/** A munkapadon elérhető tételek: az ingatlanon szem előtt lévők és a nálad lévők. */
function tetelekItt(ui, prop, szuro = () => true) {
  return ui.S.tetelek.filter(t => (t.hely === 'nalad' || t.hely === 'prop:' + prop || t.hely === 'rejtek:' + prop) && szuro(t));
}
/** Érték-becslés egy módosított tételre (a sim saját képletével, vevő nélkül). */
function ertekMas(ui, t, patch, liter) {
  const x = { ...ui.E.tetel(t.id), ...patch };
  try { return ui.E._ertek(x, liter ?? x.l, null); } catch (e) { return Math.round(t.ertek * (patch.ertekSzorzo || 1)); }
}
const tetelGomb = (t, sel, i, extra = '') => `<button class="ku-tetel ${sel ? 'kesz' : ''}" data-a="tetel" data-v="${t.id}" ${sel ? 'data-elso' : ''} ${extra}>
  <span class="ku-uvegjel" style="--c:${t.szin ? '#c98a2e' : '#e9e2c8'}"></span><span class="ku-sor-b"><b>${esc(t.nev)}</b><small>${tetelSor(t)}</small>
  ${t.effektek.length ? `<span class="ku-chipek">${t.effektek.map(e => chip(e, 'kicsi')).join('')}</span>` : ''}</span><span class="ku-sor-j">${ft(t.ertek)}</span></button>`;

// ================================================================ Keverőasztal
function keverLap(arg) {
  const prop = arg.prop || 'tanya';
  return {
    fajta: 'panel', cim: 'Keverőasztal', al: ui => `Ágyas és ízesítés · ${esc(propNev(ui, prop))}`, sel: null, oss: null, unnep: null,
    lab: '<kbd>↑↓←→</kbd> választás <kbd>Enter</kbd> belekeverem <kbd>Esc</kbd> vissza <kbd>E</kbd> bezár',
    init(ui) { const t = tetelekItt(ui, prop, x => !x.palack && !x.erleles); this.sel = arg.tetel || t[0]?.id || null; },
    html(ui) {
      if (this.unnep) return unnepHtml(this.unnep);
      const tet = tetelekItt(ui, prop, x => !x.palack && !x.erleles);
      if (!tet.length) return `<div class="ku-pad-ures">${ikon('pohar', 'nagy')}<p>Nincs keverhető pálinka itt.</p><small>Palackozatlan, nem érlelődő tétel kell, nálad vagy az ingatlanon.</small></div>`;
      if (!tet.find(t => t.id === this.sel)) this.sel = tet[0].id;
      const inv = ui.S.keszlet.cikkek;
      const t = tet.find(x => x.id === this.sel);
      const adag = Math.max(1, Math.ceil(t.l - 1e-6));
      const oss = Object.keys(OSSZETEVOK).sort((a, b) => (!!inv[b] - !!inv[a]) || cikkNev(a).localeCompare(cikkNev(b), 'hu'));
      const racs = oss.map(o => {
        const van = inv[o] || 0, eleg = van >= adag;
        return `<button class="ku-oss ${eleg ? '' : van ? 'keves' : 'nincs'} ${this.oss === o ? 'kesz' : ''}" data-a="kever" data-v="${o}" style="--c:${'#' + (HATASOK[OSSZETEVOK[o].hatas].szin >>> 0).toString(16).padStart(6, '0')}">
          <i></i><b>${esc(cikkNev(o))}</b><small>${van ? `van ${van}` : 'nincs'}</small></button>`;
      }).join('');
      return `<div class="ku-kever">
        <div class="ku-kv-oszlop"><div class="ku-cimsor">Tétel</div><div class="ku-gorget" data-gorget="kt">${tet.map((x, i) => tetelGomb(x, x.id === this.sel, i)).join('')}</div></div>
        <div class="ku-kv-oszlop szeles"><div class="ku-cimsor">Összetevő <i>${adag} adag kell · literenként egy</i></div><div class="ku-gorget ku-ossracs" data-gorget="ko">${racs}</div></div>
        <div class="ku-kv-oszlop elonezet" data-resz="elo">${this.reszek.elo.call(this, ui)}</div></div>`;
    },
    reszek: {
      elo(ui) {
        const t = ui.S.tetelek.find(x => x.id === this.sel);
        if (!t) return '';
        if (!this.oss) return `<div class="ku-cimsor">Előnézet</div><div class="ku-elo-ures">${ikon('pohar', 'nagy')}<p>Állj egy összetevőre: itt látod, mivé lesz.</p>${t.effektek.length ? `<div class="ku-chipek">${t.effektek.map(e => chip(e)).join('')}</div>` : '<small>Még tiszta pálinka, hatás nélkül.</small>'}</div>`;
        const p = ui.E.mixPreview(t.id, this.oss);
        if (!p.ok) return '';
        const ism = new Set(ui.S.hatasok.map(h => h.id));
        const nevVagyTitok = e => ism.has(e) ? chip(e) : `<span class="ku-chip titok"><i></i>ismeretlen hatás</span>`;
        const atal = new Map(p.atalakult.map(([a, b]) => [b, a]));
        const utana = p.effektek.map(e => atal.has(e) ? `<span class="ku-atal">${chip(atal.get(e), 'athuzva')}<i>→</i>${nevVagyTitok(e)}</span>` : p.uj.includes(e) ? `<span class="ku-ujh">${nevVagyTitok(e)}<i>új</i></span>` : chip(e)).join('');
        const d = p.ertekSzorzo - p.elotte;
        const ertekE = t.ertek, ertekU = ertekMas(ui, t, { effektek: p.effektek });
        const titok = p.uj.some(e => !ism.has(e));
        const nev = titok ? '„???” ' + gyNev(t.gyumolcs) : p.ujNev;
        return `<div class="ku-cimsor">Előnézet <i>${esc(cikkNev(this.oss))}</i></div>
          <div class="ku-elo">
            <div class="ku-elo-sor"><span>Előtte</span><div class="ku-chipek">${t.effektek.map(e => chip(e)).join('') || '<small class="ku-halk">tiszta pálinka</small>'}</div></div>
            <div class="ku-elo-sor"><span>Utána</span><div class="ku-chipek">${utana || '<small class="ku-halk">nem változik</small>'}</div></div>
            <div class="ku-elo-nev ${titok ? 'titok' : ''}">${esc(nev)}${p.ismert ? '<small>már a füzetben</small>' : titok ? '<small>még senki nem főzött ilyet</small>' : '<small>új recept lesz</small>'}</div>
            <div class="ku-szorzosav"><b>${szorzo(p.elotte)}</b><span class="ku-sav nagy ${d < 0 ? 'rossz' : ''}"><i style="width:${clamp(p.elotte / 3, 0, 1) * 100}%"></i><s style="width:${clamp(p.ertekSzorzo / 3, 0, 1) * 100}%"></s></span><b class="${d > 0.001 ? 'fel' : d < -0.001 ? 'le' : ''}">${szorzo(p.ertekSzorzo)}</b></div>
            ${kv('Érték', `${ft(ertekE)} → <em class="${ertekU >= ertekE ? 'fel' : 'le'}">${ft(ertekU)}</em>`)}
            ${kv('Kell', `${p.adag} × ${esc(cikkNev(this.oss))} · ${ft(p.koltseg)}`, p.van ? '' : 'veszely')}
            ${vjHtml(this)}
            ${gomb('mehet', this.oss, p.van ? 'Belekeverem' : 'Nincs elég belőle', 'fo szeles', p.van ? '' : 'disabled')}
          </div>`;
      },
    },
    fokusz(a, v, ui) {
      if (a === 'kever' && this.oss !== v) { this.oss = v; ui.resz('elo'); ui.hang('ui_click', { pitch: 1.5, vol: 0.3 }); }
    },
    act(a, v, ui) {
      if (a === 'tetel') { this.sel = v; this.oss = null; return; }
      if (a === 'kever') { this.oss = v; setTimeout(() => ui.modal?.lapEl.querySelector('[data-a="mehet"]')?.focus(), 0); return; }
      if (a === 'mehet') return this.kever(ui, v);
      if (a === 'unnep') { this.unnep = null; return; }
    },
    kever(ui, o) {
      const E = ui.E, t = E.tetel(this.sel);
      const elotteR = E.state.receptekSzama, elotteH = new Set(E.knownEffects().map(h => h.id));
      const szorzoE = E.state.tetelek.find(x => x.id === this.sel)?.ertekSzorzo;
      return utana(E.mix(this.sel, o), r => {
        if (!r.ok) { vj(this, r); return; }
        const ujH = r.effektek.filter(e => !elotteH.has(e));
        const ujRecept = E.state.receptekSzama > elotteR;
        if (ujRecept || ujH.length) {
          this.unnep = { nev: r.ujNev, effektek: r.effektek, ujH, szorzo: r.ertekSzorzo, elotte: szorzoE, ujRecept, ritka: ujH.some(e => HATASOK[e]?.ritka) };
          ui.hang(this.unnep.ritka ? 'rangemeles' : 'uveg');
          setTimeout(() => ui.modal?.lapEl.querySelector('[data-a="unnep"]')?.focus(), 0);
        } else {
          vj(this, { ok: true }, `Belekeverve. ${szorzo(szorzoE)} → ${szorzo(r.ertekSzorzo)}.`);
          ui.hang('toltes');
        }
        this.oss = null;
      });
    },
    vissza() { if (this.unnep) { this.unnep = null; return true; } if (this.oss) { this.oss = null; return true; } return false; },
  };
}
function unnepHtml(u) {
  const jegyz = u.ujH.filter(e => HATAS_JEGYZET[e]).map(e => `<div class="ku-cetli"><b>${esc(hatasNev(e))}</b><p>${esc(HATAS_JEGYZET[e])}</p><i>— nagyapa</i></div>`).join('');
  return `<div class="ku-unnep ${u.ritka ? 'ritka' : ''}"><div class="ku-sugar"></div>
    <div class="ku-un-kis">${u.ujRecept ? 'Új recept a füzetben' : 'Új hatás'}</div>
    <div class="ku-un-nev">${esc(u.nev)}</div>
    <div class="ku-chipek kozep">${u.effektek.map(e => chip(e, u.ujH.includes(e) ? 'villan' : '')).join('')}</div>
    <div class="ku-un-szorzo"><span>${szorzo(u.elotte)}</span><i>→</i><b>${szorzo(u.szorzo)}</b></div>
    ${jegyz}
    ${gomb('unnep', '', 'Beírom a füzetbe', 'fo', 'data-elso')}</div>`;
}

// ================================================================ Palackozó és érlelés
const UVEG_RAJZ = {
  '02': 'M17 4h6v6c4 2 5 5 5 9v15c0 2-1 3-3 3H15c-2 0-3-1-3-3V19c0-4 1-7 5-9z',
  '05': 'M17 2h6v9c5 2 7 6 7 11v16c0 2-1 3-3 3H13c-2 0-3-1-3-3V22c0-5 2-9 7-11z',
  '07': 'M17 2h6v8c8 3 11 9 11 16 0 8-5 14-14 14S6 34 6 26c0-7 3-13 11-16z',
  '10': 'M17 1h6v11c5 2 6 5 6 9v19c0 2-1 3-3 3H14c-2 0-3-1-3-3V21c0-4 1-7 6-9z',
};
function uvegSvg(meret, cimkeId, szin, felirat) {
  const c = { nincs: '', kezi: 'kezi', nyomtatott: 'nyomt', arany: 'arany' }[cimkeId];
  return `<svg class="ku-uveg" viewBox="0 0 40 44" aria-hidden="true"><path d="${UVEG_RAJZ[meret]}" class="test"/><path d="${UVEG_RAJZ[meret]}" class="folyadek" style="fill:${szin}"/>
    <rect x="16.5" y="0.5" width="7" height="4" rx="1" class="dugo"/>${c ? `<rect x="11" y="24" width="18" height="9" rx="1" class="cimke ${c}"/><text x="20" y="30.4" class="cimke-t ${c}">${esc(felirat)}</text>` : ''}</svg>`;
}
function palackLap(arg) {
  const prop = arg.prop || 'tanya';
  return {
    fajta: 'panel', cim: 'Palackozó és érlelés', al: ui => esc(propNev(ui, prop)), sel: null, mod: arg.mod || 'palack', meret: '05', cimke: 'kezi', hordo: 'akac',
    init(ui) { this.sel = tetelekItt(ui, prop, x => !x.palack)[0]?.id || null; },
    html(ui) {
      const S = ui.S, inv = S.keszlet.cikkek;
      const tet = tetelekItt(ui, prop, x => !x.palack);
      const erlel = S.tetelek.filter(t => t.erleles);
      if (!tet.find(t => t.id === this.sel)) this.sel = tet[0]?.id || null;
      const t = tet.find(x => x.id === this.sel);
      const fulek = `<div class="ku-ful">${[['palack', 'Palackozás'], ['erleles', 'Hordós érlelés'], ['viz', 'Vizezés']].map(([k, n]) => gomb('mod', k, n, this.mod === k ? 'aktiv' : '')).join('')}</div>`;
      let jobb = '';
      if (!t && this.mod !== 'erleles') jobb = `<div class="ku-pad-ures">${ikon('pohar', 'nagy')}<p>Nincs palackozatlan pálinka itt.</p></div>`;
      else if (this.mod === 'palack') {
        const U = UVEGEK[this.meret], C = CIMKEK[this.cimke];
        const db = Math.floor(t.l / U.l + 1e-6), van = inv['uveg_' + this.meret] || 0, cv = C.cikk ? (inv[C.cikk] || 0) : Infinity;
        const kell = Math.min(db, van, cv);
        const ertekU = kell ? ertekMas(ui, t, { palack: { meret: this.meret, cimke: this.cimke, db: kell } }, kell * U.l) + (t.l - kell * U.l > 0.01 ? ertekMas(ui, t, {}, t.l - kell * U.l) : 0) : t.ertek;
        const meretek = ['02', '05', '07', '10'].map(k => [k, UVEGEK[k]]).map(([k, u]) => `<button class="ku-valaszto ${this.meret === k ? 'kesz' : ''}" data-a="meret" data-v="${k}">${uvegSvg(k, 'nincs', 'rgba(230,180,90,.5)', '')}<b>${esc(u.nev)}</b><small>${szam(u.l, 1)} l · van ${inv['uveg_' + k] || 0}</small></button>`).join('');
        const cimkek = Object.entries(CIMKEK).map(([k, c]) => `<button class="ku-valaszto kicsi ${this.cimke === k ? 'kesz' : ''}" data-a="cimke" data-v="${k}"><b>${esc(c.nev)}</b><small>${szorzo(c.szorzo)}${c.cikk ? ` · van ${inv[c.cikk] || 0}` : ''}</small></button>`).join('');
        jobb = `<div class="ku-palack">
          <div class="ku-cimsor">Üveg</div><div class="ku-valasztok">${meretek}</div>
          <div class="ku-cimsor">Címke</div><div class="ku-valasztok">${cimkek}</div>
          <div class="ku-pl-elo">${uvegSvg(this.meret, this.cimke, t.szin ? 'rgba(201,138,46,.85)' : 'rgba(236,228,200,.55)', gyRovid(t.gyumolcs).toUpperCase())}
            <div>${kv('Üveg', `${kell} db${kell < db ? ` <em class="le">(${db} férne, ${van < db ? 'kevés az üveg' : 'kevés a címke'})</em>` : ''}`)}${kv('Kimérve marad', l(Math.max(0, t.l - kell * U.l)))}
            ${kv('Érték', `${ft(t.ertek)} → <em class="${ertekU >= t.ertek ? 'fel' : 'le'}">${ft(ertekU)}</em>`)}${C.szoveg ? `<div class="ku-kezirat">${esc(C.szoveg)}</div>` : ''}${vjHtml(this)}
            ${gomb('palackoz', '', kell ? `Palackozom: ${kell} üveg` : 'Nincs üveg vagy címke', 'fo szeles', kell ? '' : 'disabled')}</div></div></div>`;
      } else if (this.mod === 'erleles') {
        const hordok = Object.entries(HORDOK).map(([k, h]) => `<button class="ku-valaszto ${this.hordo === k ? 'kesz' : ''}" data-a="hordo" data-v="${k}">${ikon('hordo')}<b>${esc(h.nev)}</b><small>+${h.q} pont/nap, max. +${h.maxQ} · érték max. +${Math.round(h.maxErtek * 100)} % · ${esc(h.szin)} · van ${inv['hordo_' + k] || 0}</small></button>`).join('');
        const H = HORDOK[this.hordo];
        jobb = `<div class="ku-erlel"><div class="ku-cimsor">Érlelőhordó</div><div class="ku-valasztok osz">${hordok}</div>
          ${t && !t.erleles ? `<div class="ku-halk ku-megj">A harmadik napon „${esc(hatasNev(H.hatas))}” hatást kap. Legfeljebb ${H.cap} liter fér bele.</div>${vjHtml(this)}${gomb('erlel', '', `Hordóba vele: ${esc(t.nev)}`, 'fo szeles', (inv['hordo_' + this.hordo] || 0) && t.l <= H.cap && t.hely !== 'nalad' ? '' : 'disabled')}${t.hely === 'nalad' ? '<div class="ku-halk ku-megj">Érlelni csak az ingatlanon lehet: előbb tedd le.</div>' : ''}` : vjHtml(this)}
          ${szakasz('Érlelődik', erlel.length)}${erlel.map(x => `<div class="ku-erlelo"><b>${esc(x.nev)}</b><small>${l(x.l)} · ${esc(x.erleles.hordoNev)} · ${x.erleles.napok}. nap · ${Math.round(x.q)} pont · érték +${Math.round((x.erlelesSzorzo || 0) * 100)} %</small>${gomb('kivesz', x.id, 'Kiveszem', 'halk')}</div>`).join('') || ures('Egy hordó sem dolgozik.')}</div>`;
      } else {
        const uj = Math.max(30, t.fok - 5), ujL = t.l * t.fok / uj;
        jobb = `<div class="ku-viz"><div class="ku-pad-ures">${ikon('csepp', 'nagy')}<p>„Vizezni bűn” — mondta nagyapád is, aztán vizezett.</p></div>
          ${kv('Erősség', `${szam(t.fok)} → ${szam(uj)} fok`)}${kv('Mennyiség', `${l(t.l)} → ${l(ujL)}`)}${kv('Minőség', `${Math.round(t.q)} → ${Math.max(0, Math.round(t.q) - 2)} pont`)}
          ${vjHtml(this)}${gomb('vizez', '', t.fok <= 30 ? '30 fok alá nem megy' : 'Vizezem (−5 fok)', 'fo szeles', t.fok <= 30 ? 'disabled' : '')}</div>`;
      }
      return `${fulek}<div class="ku-ket"><div class="ku-kv-oszlop"><div class="ku-cimsor">Tétel</div><div class="ku-gorget" data-gorget="pt">${tet.map((x, i) => tetelGomb(x, x.id === this.sel, i)).join('') || ures('Üres a polc.')}</div></div><div class="ku-kv-oszlop szeles">${jobb}</div></div>`;
    },
    act(a, v, ui) {
      const E = ui.E;
      if (a === 'mod') this.mod = v;
      if (a === 'tetel') this.sel = v;
      if (a === 'meret') this.meret = v;
      if (a === 'cimke') this.cimke = v;
      if (a === 'hordo') this.hordo = v;
      if (a === 'palackoz') return utana(E.bottle(this.sel, this.meret, this.cimke), r => { vj(this, r, `${r.db} üveg dugóval, címkével. Szép munka.`); if (r.ok) ui.hang('dugo'); });
      if (a === 'erlel') return utana(E.age(this.sel, this.hordo), r => { vj(this, r, 'Hordóban. Most a türelem következik.'); if (r.ok) ui.hang('hordo'); });
      if (a === 'kivesz') vj(this, E.endAging(v), r => `Kivetted: ${Math.round(r.q || 0)} pont, érték +${Math.round((r.erlelesSzorzo || 0) * 100)} %.`);
      if (a === 'vizez') vj(this, E.dilute(this.sel), 'Vizezve. Senki nem fogja észrevenni. Talán.');
    },
  };
}

// ================================================================ Gyümölcsös
function gyumolcsosLap(arg) {
  const prop = arg.prop || 'tanya';
  return {
    fajta: 'panel', cim: 'Gyümölcsös', al: ui => esc(propNev(ui, prop)), slot: 0,
    html(ui) {
      const S = ui.S, p = S.ingatlanok.find(x => x.id === prop), inv = S.keszlet.cikkek;
      if (!p?.owned) return `<div class="ku-pad-ures">${ikon('fa', 'nagy')}<p>Ez a kert nem a tiéd.</p></div>`;
      if (!p.fak.length) return `<div class="ku-pad-ures">${ikon('fa', 'nagy')}<p>Itt nincs kert. Pincében nem nő a szilva.</p></div>`;
      const fak = p.fak.map((f, i) => {
        const G = f && GYUMOLCSOK[f.gyumolcs];
        const erett = f && f.termes >= 1;
        const st = !f ? 'ures' : f.kartevo ? 'beteg' : erett ? 'erett' : f.viz < 0.3 ? 'szomjas' : '';
        const szin = G ? `color-mix(in srgb, #${(G.szin >>> 0).toString(16).padStart(6, '0')} 70%, #fff)` : 'transparent';
        return `<button class="ku-fa ${st} ${this.slot === i ? 'kesz' : ''}" data-a="slot" data-v="${i}" ${i === this.slot ? 'data-elso' : ''} style="--c:${szin}">
          ${f ? `<span class="ku-fa-ik">${ikon('fa')}${erett ? `<i class="ku-termes">${Math.floor(f.termes)}</i>` : ''}</span><b>${esc(gyRovid(f.gyumolcs))}</b>
          <span class="ku-fa-sav">${sav(f.viz, 'viz')}</span><small>${f.termo ? (erett ? `${Math.floor(f.termes)} kg érett` : 'érik') : `${f.kor}/${G.erik}. nap`}</small>`
          : `<span class="ku-fa-ik ures">+</span><b>üres</b><small>ültethető</small>`}</button>`;
      }).join('');
      const f = p.fak[this.slot];
      let det;
      if (!f) {
        const cs = Object.keys(GYUMOLCSOK).map(gy => [gy, inv['csemete_' + gy] || 0]);
        det = `<div class="ku-cimsor">${this.slot + 1}. hely · üres</div><div class="ku-halk ku-megj">Csemetét a gazdaboltban rendelhetsz (Rendelés app).</div>
          <div class="ku-gombok osz">${cs.map(([gy, n]) => gomb('ultet', gy, `${esc(gyRovid(gy))}csemete · van ${n}`, n ? '' : 'halk', n ? '' : 'disabled')).join('')}</div>`;
      } else {
        const G = GYUMOLCSOK[f.gyumolcs];
        det = `<div class="ku-cimsor">${this.slot + 1}. hely · ${esc(gyRovid(f.gyumolcs))}fa</div>
          ${kv('Kor', `${f.kor}. nap${f.termo ? ', terem' : `, ${G.erik - f.kor} nap múlva terem`}`)}
          <div class="ku-kv"><span>Víz</span><b>${sav(f.viz, 'viz')} ${Math.round(f.viz * 100)} %</b></div>
          ${kv('Trágya', f.tragya > 0 ? `még ${f.tragya} nap (+50 % termés)` : 'nincs')}${kv('Permet', f.permet > 0 ? `még ${f.permet} nap` : 'nincs')}
          ${f.kartevo ? kv('Kártevő', 'beteg, fele termés', 'veszely') : ''}${kv('Termés', `${szam(f.termes, 1)} kg · ${Math.round(f.q)} pont`)}
          ${vjHtml(this)}<div class="ku-gombok osz">${gomb('ontoz', '', `${ikon('csepp')} Megöntözöm`, f.viz < 0.6 ? 'fo' : '')}${gomb('tragyaz', '', `${ikon('tragya')} Trágyázom · van ${inv.tragya || 0}`, '', inv.tragya ? '' : 'disabled')}
          ${gomb('permetez', '', `${ikon('permet')} Permetezem · van ${inv.permet || 0}`, f.kartevo ? 'fo' : '', inv.permet ? '' : 'disabled')}${gomb('szur', '', `${ikon('kosar')} Leszedem · ${Math.floor(f.termes)} kg`, f.termes >= 1 ? 'fo' : '', f.termes >= 1 ? '' : 'disabled')}</div>`;
      }
      const gy = Object.entries(S.keszlet.gyumolcs).filter(([, g]) => g.kg > 0);
      return `<div class="ku-ket"><div class="ku-kv-oszlop szeles"><div class="ku-cimsor">A kert <i>${p.fak.filter(Boolean).length}/${p.fak.length} fa · naponta ${Math.round(FA.kiszaradas * 100)} % víz párolog</i></div>
        <div class="ku-gorget ku-kert" data-gorget="kert" style="--osz:${p.fak.length > 12 ? 6 : p.fak.length > 6 ? 4 : 3}">${fak}</div>
        <div class="ku-gombok">${gomb('mindontoz', '', `${ikon('csepp')} Mindet megöntözöm`)}${gomb('mindszur', '', `${ikon('kosar')} Mindent leszedek`)}</div>
        <div class="ku-kamra">${ikon('kosar')} Kamra: ${gy.length ? gy.map(([k, g]) => `<b>${g.kg} kg</b> ${esc(gyRovid(k))} (${g.q} pont)`).join(' · ') : 'üres'}</div></div>
        <div class="ku-kv-oszlop">${det}</div></div>`;
    },
    act(a, v, ui) {
      const E = ui.E;
      if (a === 'slot') this.slot = +v;
      if (a === 'ultet') return utana(E.plant(prop, this.slot, v), r => { vj(this, r, 'Elültetve. Most várni kell.'); if (r.ok) ui.hang('gyumolcs'); });
      if (a === 'ontoz') { vj(this, E.water(prop, this.slot), 'Megöntözve.'); ui.hang('vodor'); }
      if (a === 'mindontoz') return utana(E.water(prop, -1), r => { vj(this, r, `${r.db || 0} fa megöntözve.`); if (r.ok) ui.hang('vodor'); });
      if (a === 'tragyaz') vj(this, E.fertilize(prop, this.slot), 'Trágyázva. Három napig másfélszer annyi terem.');
      if (a === 'permetez') vj(this, E.spray(prop, this.slot), 'Lepermetezve. A kukac költözik.');
      if (a === 'szur') return utana(E.harvest(prop, this.slot), r => { vj(this, r, `${r.kg || 0} kg a kosárban.`); if (r.ok) ui.hang('gyumolcs'); });
      if (a === 'mindszur') return utana(E.harvest(prop, -1), r => { vj(this, r, `${r.kg || 0} kg a kamrában.`); if (r.ok) ui.hang('gyumolcs'); });
    },
  };
}

// ================================================================ Cefrés hordó
function hordoLap(arg) {
  const prop = arg.prop || 'tanya';
  return {
    fajta: 'panel', cim: 'Cefrés hordók', al: ui => esc(propNev(ui, prop)), idx: arg.idx ?? 0, gy: null, adalek: new Set(['eleszto']), live: 1,
    st: { kg: { v: 20, min: 1, max: BARREL_CAP, lepes: 1, nagy: 10, fmt: v => v + ' kg' } },
    html(ui) {
      const S = ui.S, p = S.ingatlanok.find(x => x.id === prop), inv = S.keszlet.cikkek;
      if (!p?.owned) return `<div class="ku-pad-ures">${ikon('hordo', 'nagy')}<p>Ez a hordó nem a tiéd.</p></div>`;
      const most = ui.E.now();
      const hordok = p.hordok.map((h, i) => {
        const tart = h.allapot === 'erjed' ? `<small><b data-cd="${h.kesz}" data-elo="kész " data-lejart="kész"></b></small><span class="ku-sav"><i data-cdsav="${h.kesz - FERMENT_MIN},${h.kesz}" class="fordit"></i></span>`
          : h.allapot === 'kesz' ? `<small>${l(h.l)} vár az üstre</small>` : '<small>üres</small>';
        return `<button class="ku-hordo ${h.allapot} ${this.idx === i ? 'val' : ''}" data-a="hordo" data-v="${i}" ${i === this.idx ? 'data-elso' : ''}>${ikon('hordo')}<b>${i + 1}. hordó${h.gyumolcs ? ' · ' + esc(gyRovid(h.gyumolcs)) : ''}</b>${tart}</button>`;
      }).join('');
      const h = p.hordok[this.idx];
      let det;
      if (h.allapot === 'ures') {
        const gy = Object.entries(S.keszlet.gyumolcs).filter(([, g]) => g.kg >= 1);
        if (!gy.find(([k]) => k === this.gy)) this.gy = gy[0]?.[0] || null;
        if (!this.gy) det = `<div class="ku-pad-ures">${ikon('kosar', 'nagy')}<p>Nincs gyümölcs a kamrában.</p><small>Szüretelj a kertben, vagy rendelj a kofától.</small></div>`;
        else {
          const g = S.keszlet.gyumolcs[this.gy];
          this.st.kg.max = Math.max(1, Math.min(BARREL_CAP, g.kg)); this.st.kg.v = clamp(this.st.kg.v, 1, this.st.kg.max);
          const kg = this.st.kg.v, adag = Math.ceil(kg / 20);
          let ido = FERMENT_MIN, q = g.q, terf = 1, kih = 1;
          for (const a of this.adalek) { const A = ADALEKOK[a]; ido *= A.ido; q += A.q; terf *= A.terfogat; kih *= A.kihozatal; }
          const hiany = [...this.adalek].filter(a => (inv[a] || 0) < adag);
          det = `<div class="ku-cimsor">${this.idx + 1}. hordó · töltés</div>
            <div class="ku-valasztok">${gy.map(([k, x]) => `<button class="ku-valaszto kicsi ${this.gy === k ? 'kesz' : ''}" data-a="gy" data-v="${k}"><b>${esc(gyRovid(k))}</b><small>${x.kg} kg · ${x.q} pont</small></button>`).join('')}</div>
            ${lepteto('kg', this.st.kg, 'Gyümölcs', 'szeles')}
            <div class="ku-cimsor">Adalék <i>${adag} adag kell (20 kg-onként egy)</i></div>
            <div class="ku-valasztok osz">${Object.entries(ADALEKOK).map(([k, A]) => `<button class="ku-valaszto kapcs ${this.adalek.has(k) ? 'kesz' : ''}" data-a="adalek" data-v="${k}"><b>${esc(A.nev)}</b><small>${A.ido !== 1 ? `${A.ido < 1 ? 'gyorsabb' : 'lassabb'} erjedés · ` : ''}${A.q ? `${A.q > 0 ? '+' : ''}${A.q} pont · ` : ''}${A.kihozatal > 1 ? `+${Math.round((A.kihozatal - 1) * 100)} % párlat · ` : ''}${A.terfogat > 1 ? `+${Math.round((A.terfogat - 1) * 100)} % cefre · ` : ''}van ${inv[k] || 0}</small></button>`).join('')}</div>
            <div class="ku-hordo-elo">${kv('Cefre', l(Math.min(BARREL_CAP * 1.25, kg * terf)))}${kv('Erjedés', tartam(ido))}${kv('Minőség', `${Math.round(clamp(q, 5, 100))} pont`)}${kih > 1 ? kv('Kihozatal', `+${Math.round((kih - 1) * 100)} %`) : ''}</div>
            ${vjHtml(this)}${gomb('tolt', '', hiany.length ? `Kevés: ${hiany.map(a => ADALEKOK[a].nev).join(', ')}` : 'Erjedjen!', 'fo szeles', hiany.length ? 'disabled' : '')}`;
        }
      } else if (h.allapot === 'erjed') {
        det = `<div class="ku-cimsor">${this.idx + 1}. hordó · erjed</div><div class="ku-pad-ures">${ikon('hordo', 'nagy')}<p>Bugyog. ${esc(gyRovid(h.gyumolcs))}cefre, ${l(h.l)}, ${Math.round(h.q)} pont.</p>
          <p class="ku-nagyszam" data-cd="${h.kesz}" data-elo="" data-lejart="kész"></p><small>${h.adalek.length ? 'Adalék: ' + h.adalek.map(a => ADALEKOK[a].nev).join(', ') : 'adalék nélkül, a régi módon'}</small></div>${vjHtml(this)}`;
      } else {
        const romlik = h.kesz + 36 * 60 - most;
        det = `<div class="ku-cimsor">${this.idx + 1}. hordó · kész cefre</div><div class="ku-pad-ures">${ikon('hordo', 'nagy')}<p>${l(h.l)} ${esc(gyRovid(h.gyumolcs))}cefre, ${Math.round(h.q)} pont. Mehet az üstbe.</p>
          <small>${romlik > 0 ? `${tartam(romlik)} múlva kezd romlani.` : 'Már romlik: óránként egy pontot veszít.'}</small></div>${vjHtml(this)}`;
      }
      return `<div class="ku-ket"><div class="ku-kv-oszlop"><div class="ku-cimsor">Hordók</div><div class="ku-gorget ku-hordok" data-gorget="ho">${hordok}</div></div><div class="ku-kv-oszlop szeles">${det}</div></div>`;
    },
    act(a, v, ui) {
      if (a === 'hordo') { this.idx = +v; this.vjel = null; }
      if (a === 'gy') this.gy = v;
      if (a === 'adalek') this.adalek.has(v) ? this.adalek.delete(v) : this.adalek.add(v);
      if (a === 'tolt') return utana(ui.E.fillBarrel(prop, this.idx, { gyumolcs: this.gy, kg: this.st.kg.v, adalek: [...this.adalek] }), r => { vj(this, r, `Lefedve. ${tartam(r.kesz - ui.E.now())} múlva kész.`); if (r.ok) ui.hang('hordo_fedel'); });
    },
    enter(ui) { ui.akcio('tolt', ''); },
  };
}

// ================================================================ Átadás a vevőnek
function megfelel(r, t) {
  return [
    ['Gyümölcs', !r.gyumolcs || t.gyumolcs === r.gyumolcs, r.gyumolcs ? gyRovid(r.gyumolcs) : 'bármi'],
    ['Erősség', (!r.minFok || t.fok + 1e-4 >= r.minFok) && (!r.maxFok || t.fok - 1e-4 <= r.maxFok), `${szam(t.fok)} fok`],
    ['Minőség', t.q + 1e-4 >= r.minQ, `${Math.round(t.q)} / ${r.minQ} pont`],
    ...(r.hatas ? [['Hatás', t.effektek.includes(r.hatas), hatasNev(r.hatas)]] : []),
    ['Mennyiség', t.l + 1e-6 >= r.l, `${l(t.l)} / ${l(r.l)}`],
  ];
}
function atadasLap(arg) {
  return {
    fajta: 'panel', cim: 'Átadás', al: ui => { const r = ui.S.rendelesek.find(x => x.id === arg.rendeles); return r ? `${esc(r.helyNev)} · ${ora(r.ablak[0])}–${ora(r.ablak[1])}` : ''; },
    sel: null, hangulat: 0.55, reakcio: null, ellen: null, kesz: null, live: 1,
    st: { ar: { v: 0, min: 0, max: 0, lepes: 100, nagy: 1000, fmt: ft } },
    init(ui) {
      const r = ui.S.rendelesek.find(x => x.id === arg.rendeles); if (!r) return;
      this.r0 = { ...r };
      this.st.ar.v = r.ar; this.st.ar.min = Math.round(r.ar * 0.5 / 100) * 100;
      const jo = this.tetelek(ui, r).find(t => megfelel(r, t).every(x => x[1]));
      this.sel = (jo || this.tetelek(ui, r)[0])?.id || null;
      this.hangulat = clamp(0.35 + (ui.S.vevok.find(v => v.id === r.vevo)?.huseg || 0) / 200, 0.3, 0.85);
    },
    tetelek(ui, r) { return ui.S.tetelek.filter(t => !t.erleles && (t.hely === 'nalad' || ((t.hely.startsWith('prop:') || t.hely.startsWith('rejtek:')) && ui.S.ingatlanok.find(p => p.id === t.hely.split(':')[1])?.regio === r.regio))); },
    html(ui) {
      const S = ui.S, E = ui.E;
      const r = S.rendelesek.find(x => x.id === arg.rendeles) || (this.kesz ? this.r0 : null);
      if (!r) return `<div class="ku-pad-ures">${ikon('pohar', 'nagy')}<p>Ez a rendelés már nem él.</p></div>`;
      const v = S.vevok.find(x => x.id === r.vevo) || { nev: r.nev, keres: '', huseg: 0 };
      const bal = `<div class="ku-vevo-old">${erem(v.nev, this.hangulat, 'oriasi')}<b class="ku-vv-nev">${esc(v.nev)}</b>
        <div class="ku-hangulat">${['sértett', 'gyanakvó', 'vár', 'elégedett', 'boldog'][clamp(Math.floor(this.hangulat * 5), 0, 4)]}</div>
        <blockquote class="${this.reakcio ? 'reakcio' : ''}">${esc(this.reakcio || `„${v.keres}”`)}</blockquote>
        <div class="ku-rk-kiv">${esc(E.wishText(r))}</div>
        ${this.kesz ? '' : `<div class="ku-rk-ido"><span class="ku-sav idosav"><i data-cdsav="${r.ido ?? r.ablak[0]},${r.ablak[1]}"></i></span><b data-cd="${r.ablak[1]}" data-elo="lejár "></b></div>`}
        ${v.izles ? `<div class="ku-vv-info"><div class="ku-kv"><span>Hűség</span><b>${sav(v.huseg / 100, 'huseg')} ${v.huseg}</b></div>
          <div class="ku-kv osz"><span>Szereti</span><div class="ku-chipek">${v.izles.kedvel.map(e => ui.S.hatasok.some(h => h.id === e) ? chip(e) : '<span class="ku-chip ismeretlen"><i></i>még nem ismered</span>').join('') || '<small class="ku-halk">a jó pálinkát</small>'}</div></div></div>` : ''}</div>`;
      if (this.kesz) {
        const k = this.kesz, gyU = S.regiok.find(x => x.id === r.regio)?.gyanu ?? k.gy0, hU = v.huseg ?? k.h0;
        return `<div class="ku-atadas">${bal}<div class="ku-atad-jobb ku-fizetve"><div class="ku-fz-kis">Fizetett</div><div class="ku-fz-osszeg">${ft(k.fizetett)}</div>
          ${k.fizetett > r.ar ? `<div class="ku-fz-plusz">${ftE(k.fizetett - r.ar)} a kért árhoz képest</div>` : ''}
          <div class="ku-kovetkezmeny">${kv('Hűség', `${k.h0} → <em class="fel">${hU}</em>${hU >= 80 && k.h0 < 80 ? ' · törzsvendég lett' : ''}`)}${kv('Tapasztalat', `<em class="fel">+${Math.max(0, S.rang.xp - k.xp0)} XP</em>`)}
          ${kv(`Gyanú · ${esc(REG[r.regio]?.nev || '')}`, `${k.gy0} → <em class="le">${gyU}</em>`)}</div>${gomb('@bezar', '', 'Kezet fogtunk', 'fo', 'data-elso')}</div></div>`;
      }
      const tet = this.tetelek(ui, r);
      const t = tet.find(x => x.id === this.sel);
      const lista = tet.map((x, i) => {
        const m = megfelel(r, x), ok = m.every(y => y[1]);
        const hiba = m.find(y => !y[1]);
        const ok_ = { Gyümölcs: 'más gyümölcs', Erősség: r.maxFok && x.fok > r.maxFok ? 'túl erős' : 'túl gyenge', Minőség: 'gyenge minőség', Hatás: 'hiányzik a hatás', Mennyiség: 'kevés' }[hiba?.[0]];
        return `<button class="ku-tetel ${x.id === this.sel ? 'kesz' : ''} ${ok ? '' : 'rossz'}" data-a="tetel" data-v="${x.id}"><span class="ku-uvegjel"></span><span class="ku-sor-b"><b>${esc(x.nev)}</b><small>${tetelSor(x)}</small></span><span class="ku-sor-j">${ok ? cimke('megfelel', 'jo') : cimke(ok_, 'rossz')}</span></button>`;
      }).join('');
      let jobb = '';
      if (t) {
        const m = megfelel(r, t);
        const lAt = t.palack ? Math.ceil(r.l / UVEGEK[t.palack.meret].l - 1e-6) * UVEGEK[t.palack.meret].l : r.l;
        const ertek = E.value(t.id, lAt, r.vevo);
        this.st.ar.max = Math.max(this.st.ar.v, Math.round(Math.max(r.ar, ertek) * 1.8 / 100) * 100);
        jobb = `<div class="ku-ellenor">${m.map(([k, ok, s]) => `<div class="${ok ? 'jo' : 'rossz'}"><i>${ok ? '✓' : '✗'}</i><span>${k}</span><b>${esc(s)}</b></div>`).join('')}</div>
          ${kv('Átadod', `${l(lAt)}${t.palack ? ` · ${Math.round(lAt / UVEGEK[t.palack.meret].l)} üveg` : ''}`)}${kv('Kért ár', ft(r.ar))}${kv('A szemében ennyit ér', '≈ ' + ft(ertek), ertek > r.ar ? 'fel' : '')}
          ${lepteto('ar', this.st.ar, 'Ennyit kérsz', 'szeles nagy')}${vjHtml(this)}
          ${this.ellen ? gombok(gomb('atad', this.ellen, `Legyen ${ft(this.ellen)}`, 'fo', 'data-elso'), gomb('atad', '', `Kitartok: ${ft(this.st.ar.v)}`)) : gombok(gomb('atad', '', `Átadom: ${ft(this.st.ar.v)}`, 'fo', 'data-elso'))}`;
      } else jobb = `<div class="ku-pad-ures">${ikon('pohar', 'nagy')}<p>Nincs nálad pálinka.</p><small>Előbb vedd magadhoz: Birodalom → Raktár.</small></div>`;
      return `<div class="ku-atadas">${bal}<div class="ku-atad-jobb"><div class="ku-cimsor">Mit adsz át?</div><div class="ku-gorget ku-atad-lista" data-gorget="al">${lista || ures('Nincs nálad semmi.')}</div>${jobb}</div></div>`;
    },
    act(a, v, ui) {
      const E = ui.E;
      if (a === 'tetel') { this.sel = v; this.ellen = null; return; }
      if (a === 'atad') {
        const r = ui.S.rendelesek.find(x => x.id === arg.rendeles); if (!r) return;
        const ar = v ? +v : this.st.ar.v;
        const t = E.tetel(this.sel);
        const lAt = t?.palack ? Math.ceil(r.l / UVEGEK[t.palack.meret].l - 1e-6) * UVEGEK[t.palack.meret].l : r.l;
        if (!ui.kozel({ node: r.hely, pos: r.pos })) { vj(this, { ok: false, hiba: `Nem vagy ott: ${r.helyNev}.` }); return; }
        const S0 = ui.S, h0 = S0.vevok.find(v => v.id === r.vevo)?.huseg ?? 0, gy0 = S0.regiok.find(g => g.id === r.regio)?.gyanu ?? 0, xp0 = S0.rang.xp;
        return utana(E.deliver(r.id, this.sel, lAt, ar), x => {
          this.reakcio = x.valasz;
          if (x.ok) { this.kesz = { ...x, h0, gy0, xp0 }; this.hangulat = 0.95; ui.hang('koszones'); setTimeout(() => ui.modal?.lapEl.querySelector('[data-a="@bezar"]')?.focus(), 0); }
          else if (x.alku) { this.ellen = x.ellenajanlat; this.st.ar.v = x.ellenajanlat; this.hangulat = Math.max(0.2, this.hangulat - 0.18); }
          else { this.hangulat = Math.max(0.05, this.hangulat - 0.25); vj(this, { ok: false, hiba: 'Nem fogadta el.' }); }
        });
      }
    },
    enter(ui) { ui.akcio('atad', ''); },
  };
}

// ================================================================ Kóstoltatás (találkozáskor egy idegennel)
function kostoloLap(arg) {
  return {
    fajta: 'panel', cim: 'Kóstoltatás', al: '1 deci a nálad lévőből, ingyen. Az első pohár a hagyomány.', valasz: null, siker: null,
    html(ui) {
      const S = ui.S, v = S.vevok.find(x => x.id === arg.vevo);
      if (!v) return `<div class="ku-pad-ures"><p>Nincs ilyen ember.</p></div>`;
      const nalad = S.tetelek.filter(t => t.hely === 'nalad' && t.l >= 0.1 && !t.erleles);
      const bal = `<div class="ku-vevo-old">${erem(v.nev, this.siker == null ? 0.5 : this.siker ? 0.95 : 0.15, 'oriasi')}<b class="ku-vv-nev">${esc(v.nev)}</b><blockquote class="${this.valasz ? 'reakcio' : ''}">${esc(this.valasz || `„${v.keres}”`)}</blockquote></div>`;
      if (this.siker) return `<div class="ku-atadas">${bal}<div class="ku-atad-jobb ku-fizetve"><div class="ku-fz-kis">Új vevő</div><div class="ku-fz-osszeg">${esc(v.nev)}</div><div class="ku-halk">Hamarosan ír. A Névjegyekben látod, mit szeret.</div>${gomb('@bezar', '', 'Egészségére', 'fo', 'data-elso')}</div></div>`;
      return `<div class="ku-atadas">${bal}<div class="ku-atad-jobb"><div class="ku-cimsor">Mit kóstoltatsz?</div>${vjHtml(this)}
        ${v.allapot === 'aktiv' ? ures('Már a vevőd.') : !v.kostolhato ? ures('Ma már kóstolt. Holnap.') : nalad.map((t, i) => tetelGomb(t, false, i)).join('') || ures('Nincs nálad pálinka.')}</div></div>`;
    },
    act(a, v, ui) {
      if (a !== 'tetel') return;
      return utana(ui.E.giveSample(arg.vevo, v), r => {
        if (!r.ok) { vj(this, r); return; }
        this.valasz = r.valasz; this.siker = r.siker;
        if (!r.siker) vj(this, { ok: false, hiba: `Nem jött be (${r.esely} % esélye volt). Holnap próbáld mással.` });
        ui.hang(r.siker ? 'uveg' : 'ui_click');
      });
    },
  };
}

export const PANELEK = {
  kever: (ui, a) => keverLap(a), palack: (ui, a) => palackLap(a), gyumolcsos: (ui, a) => gyumolcsosLap(a), hordo: (ui, a) => hordoLap(a),
  atadas: (ui, a) => atadasLap(a), kostolo: (ui, a) => kostoloLap(a), 'terkep-nagy': (ui, a) => nagyTerkepLap(a),
};
export { cikkNev, CIKKEK };
