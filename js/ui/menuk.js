// Kisüsti UI — a teljes képernyős menük: napi összesítő (Kisüstfalvi Hírmondó), szünet, mentés és betöltés, bírság (a Hivatal
// határozata a halál és a lebukás helyett), irányítás. A mentés localStorage-ba megy, négy hellyel (automatikus + 3 kézi).
import { esc, ft, ftE, l, szam, REG } from './kozos.js';
import { sor, szakasz, ures, vj, vjHtml, gomb, gombok, kv, sav } from './elemek.js';
import { ikon } from './ikonok.js';
import { beallitasokLap } from './telefon.js';

const kartya = (cim, html, cls = '') => `<div class="ku-mk ${cls}"><div class="ku-mk-fej">${cim}</div>${html}</div>`;
const IDOJARAS = ['Reggel köd, délután szomjúság.', 'Napos idő, a cefre jól halad.', 'Szeles nap: a füst gyorsan elszáll. Ajánlott.', 'Eső várható. A pénzügyőr is otthon marad.',
  'Fagyos éjszaka, meleg kupicák.', 'Változékony: hol esik, hol iszunk.', 'Kánikula. A Gyári sörre vált, mi nem.'];

// ================================================================ Napi összesítő
function napLap(arg) {
  return {
    fajta: 'menu', cim: '',
    lab: '<kbd>Enter</kbd> új nap <kbd>Esc</kbd> bezár',
    html(ui) {
      const o = arg.osszesito || ui.S.osszesito;
      if (!o || !o.nap) return kartya('Napi összesítő', `${ures('Még nem aludtál egyet sem.')}${gomb('@bezar', '', 'Vissza', 'fo', 'data-elso')}`);
      const merleg = o.bevetel + (o.terjesztoBevetel || 0) - o.kiadas - o.birsag;
      const cim = o.birsag > 0 ? `Bírság a környéken: a pénzügyőr „bizonyítéknak” vitt el ezt-azt`
        : o.bevetel >= 50000 ? `Pezsgő pálinkapiac: ${ft(o.bevetel)} cserélt gazdát egyetlen nap alatt`
        : o.ujVevok ? `${o.ujVevok} új ínyenc a környéken: „csak a szívemre egy gyűszűnyit”`
        : o.fozesek ? `Füstölt a kémény: ${o.fozesek} főzés, a szomszéd szerint „kolbászt sütöttek”`
        : 'Csendes nap: a falu a muskátlit locsolta, és nem kérdezett semmit';
      const regiok = ui.S.regiok.filter(r => r.nyitva);
      const gy = regiok.map(r => { const v = o.gyanu?.[r.id] ?? r.gyanu; return `<div class="ku-ujs-gy"><span>${esc(r.nev)}</span>${sav(v / 100, v >= 60 ? 'rossz' : v >= 40 ? 'kozep' : '')}<b>${v}</b></div>`; }).join('');
      const esem = (o.esemenyek || []).slice(0, 6).map(e => `<li>${esc(e)}</li>`).join('');
      return `<div class="ku-ujsag">
        <div class="ku-ujs-fej"><span>${o.nap}. nap · ára: egy kupica</span><h1>Kisüstfalvi Hírmondó</h1><span>A falu egyetlen lapja, mert a másikat a kocsmáros olvasta fel</span></div>
        <h2 class="ku-ujs-cim">${esc(cim)}</h2>
        <div class="ku-ujs-has">
          <div><h3>Kassza</h3>${kv('Bevétel', ft(o.bevetel))}${o.terjesztoBevetel ? kv('Terjesztőktől', ft(o.terjesztoBevetel)) : ''}${kv('Kiadás', ft(o.kiadas))}${o.birsag ? kv('Bírság', ft(o.birsag), 'veszely') : ''}${o.mosott ? kv('Tisztára mosva', ft(o.mosott)) : ''}
            <div class="ku-ujs-merleg ${merleg >= 0 ? 'fel' : 'le'}"><span>A nap mérlege</span><b>${ftE(merleg)}</b></div></div>
          <div><h3>Termelés</h3>${kv('Főzés', o.fozesek + ' alkalom')}${kv('Eladva', l(o.eladottL))}${kv('Új vevő', o.ujVevok + ' fő')}<h3>Vagyon</h3>${kv('Zseb', ft(o.kp))}${kv('Dunyha', ft(o.dunyha))}${kv('Számla', ft(o.szamla))}${kv('Rang', esc(o.rang))}</div>
          <div><h3>Mit beszélnek?</h3>${gy}<p class="ku-ujs-kis">Alvás után minden régióban 20-szal kisebb. A falu felejt.</p>${esem ? `<h3>Rendőrségi hírek</h3><ul>${esem}</ul>` : ''}<h3>Időjárás</h3><p class="ku-ujs-kis">${IDOJARAS[o.nap % IDOJARAS.length]}</p></div>
        </div>
        <div class="ku-ujs-lab">${ui.opts.autoMentes !== false ? '<span>Automatikusan mentve.</span>' : '<span></span>'}${gomb('@bezar', '', 'Jó reggelt, falu', 'fo', 'data-elso')}</div></div>`;
    },
    enter(ui) { ui.close(); },
  };
}

// ================================================================ Szünet
function szunetLap() {
  return {
    fajta: 'menu', cim: '',
    html(ui) {
      const S = ui.S;
      return `<div class="ku-szunet"><div class="ku-sz-cim">KISÜSTI</div><div class="ku-sz-al">${S.ido.nap}. nap · ${esc(S.ido.szoveg.split(/\s+/).pop())} · ${esc(S.rang.nev)}</div>
        <div class="ku-sz-menu">${gomb('@bezar', '', 'Folytatás', 'fo', 'data-elso')}${gomb('ment', '', 'Mentés')}${gomb('tolt', '', 'Betöltés')}${gomb('beall', '', 'Beállítások')}${gomb('irany', '', 'Irányítás')}${ui.opts.onQuit ? gomb('kilep', '', 'Kilépés a címlapra', 'halk') : ''}</div>
        <div class="ku-sz-lab">„A pálinkát nem siettetjük. A játékot se.”</div></div>`;
    },
    act(a, v, ui) {
      if (a === 'ment') ui.push(mentesLap('menu', 'ment'));
      if (a === 'tolt') ui.push(mentesLap('menu', 'tolt'));
      if (a === 'beall') { const l = beallitasokLap('menu'); const h = l.html; l.html = u => kartya('Beállítások', h.call(l, u)); ui.push(l); }
      if (a === 'irany') ui.push(iranyitasLap());
      if (a === 'kilep') { ui.close(); ui.opts.onQuit?.(); }
    },
  };
}
function iranyitasLap() {
  const s = [['W A S D', 'mozgás'], ['egér', 'nézelődés'], ['E', 'használat, munkapad'], ['Tab vagy F', 'telefon'], ['Esc', 'szünet, vissza'],
    ['nyilak', 'választás a menükben'], ['Enter / szóköz', 'mehet'], ['← →', 'számok állítása'], ['1–9, *, 0, #', 'gyorsgombok a telefonon']];
  return {
    fajta: 'menu', cim: '',
    html: () => kartya('Irányítás', `<div class="ku-irany">${s.map(([k, t]) => `<div><kbd>${k}</kbd><span>${t}</span></div>`).join('')}</div>${gomb('@vissza', '', 'Vissza', 'fo', 'data-elso')}`),
  };
}

// ================================================================ Mentés és betöltés (a telefonon és a szünetmenüben is)
export function mentesLap(fajta = 'telefon', mod = null) {
  return {
    fajta, nev: fajta === 'telefon' ? 'mentes-app' : 'mentes', cim: 'Mentés', sel: null, megerosit: null, mod,
    html(ui) {
      const lista = ui.mentesLista();
      const sorok = lista.map((m, i) => {
        const nev = m.id === 'auto' ? 'Automatikus (alváskor)' : `${m.id}. befőttesüveg`;
        const al = m.meta?.hibas ? 'sérült mentés' : m.meta ? `${m.meta.nap}. nap ${esc(m.meta.ora || '')} · ${esc(m.meta.rang)} · ${ft(m.meta.kp + (m.meta.szamla || 0))} · ${m.meta.receptek || 0} recept` : 'üres';
        const mikor = m.meta?.mentve ? new Date(m.meta.mentve).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return sor('hely', m.id, `${ikon('mentes')}<b>${nev}</b><small>${al}</small>`, mikor, this.sel === m.id ? 'kesz' : '', i === (this.mod === 'ment' ? 1 : 0) && !this.sel ? 'data-elso' : '');
      }).join('');
      const m = lista.find(x => x.id === this.sel);
      let akc = '';
      if (m) {
        const tud = this.mod !== 'tolt' && m.id !== 'auto', tolt = this.mod !== 'ment' && m.meta && !m.meta.hibas;
        akc = gombok(tud ? gomb('ment', m.id, this.megerosit === 'ment' ? 'Biztos? Felülírja' : 'Mentés ide', 'fo', 'data-elso') : '',
          tolt ? gomb('tolt', m.id, this.megerosit === 'tolt' ? 'Biztos? A mostani elvész' : 'Betöltés', tud ? '' : 'fo', tud ? '' : 'data-elso') : '');
      }
      const html = `<div class="ku-gorget" data-gorget="ment"><div class="ku-halk ku-megj">Ami befőttesüvegben van, az megmarad. Ebben a böngészőben, ezen a gépen.</div>${vjHtml(this)}${sorok}${akc}</div>`;
      return fajta === 'menu' ? kartya(this.mod === 'tolt' ? 'Betöltés' : this.mod === 'ment' ? 'Mentés' : 'Mentés és betöltés', html + gomb('@vissza', '', 'Vissza', 'halk')) : html;
    },
    act(a, v, ui) {
      if (a === 'hely') { this.sel = v; this.megerosit = null; setTimeout(() => ui.modal?.lapEl.querySelector('[data-a="ment"],[data-a="tolt"]')?.focus(), 0); return; }
      const m = ui.mentesLista().find(x => x.id === v);
      if (a === 'ment') {
        if (m.meta && this.megerosit !== 'ment') { this.megerosit = 'ment'; return; }
        const r = ui.ment(v); vj(this, r, `Elmentve: ${r.meta?.nap}. nap.`); this.megerosit = null; if (r.ok) ui.hang('dugo');
      }
      if (a === 'tolt') {
        if (this.megerosit !== 'tolt') { this.megerosit = 'tolt'; return; }
        const r = ui.betolt(v); this.megerosit = null;
        if (r.ok) { ui.close(); ui.hud.toast(`${ikon('mentes', 'ku-t-ik')}<div><div class="ku-t-cim">Betöltve</div><div class="ku-t-szov">${esc(ui.E.state.ido.szoveg)}</div></div>`, 'kuld'); ui.hang('dugo_ki'); return false; }
        vj(this, r);
      }
    },
    vissza() { if (this.sel) { this.sel = null; this.megerosit = null; return true; } return false; },
  };
}

// ================================================================ Bírság: a Hivatal határozata
function birsagLap(arg) {
  return {
    fajta: 'menu', cim: '',
    lab: '<kbd>Enter</kbd> tudomásul veszem',
    html(ui) {
      const S = ui.S, raz = arg.tipus === 'razzia';
      const p = raz ? S.ingatlanok.find(x => x.id === arg.prop) : null;
      const ugy = `KÜ-${S.ido.nap}/${String((S.stat.birsag || 1) * 37 + S.ido.nap * 11).padStart(4, '0')}`;
      const okok = (arg.okok || []).map(o => `<li>${esc(o)}</li>`).join('');
      return `<div class="ku-hatarozat">
        <div class="ku-hz-fej"><div class="ku-hz-cimer">${ikon('szamla')}</div><div><b>A HIVATAL</b><span>Helyi Kirendeltség, Kisváros, Állomás utca, a vasúti átjáró után</span></div><div class="ku-hz-ugy">Ügyszám: ${ugy}</div></div>
        <h1>HATÁROZAT</h1>
        <div class="ku-hz-targy">Tárgy: ${raz ? `házkutatás, ${esc(p?.nev || '')}` : `motozás az úton, ${esc(REG[ui.jatekosRegio()]?.nev || '')}`}</div>
        <p>A pénzügyőr ${raz ? 'a helyszínen' : 'az ellenőrzés során'} az alábbiakat állapította meg:</p><ul>${okok}</ul>
        <div class="ku-hz-tetelek">
          ${arg.elkobzottL ? kv('Elkobozva', `${l(arg.elkobzottL)} pálinka`) : ''}${arg.elkobzottKp ? kv('Lefoglalt készpénz', ft(arg.elkobzottKp)) : ''}
          ${raz && (arg.okok || []).some(o => /üst/.test(o)) ? kv('Az üstökön', 'pecsét, 24 órán át') : ''}
          ${kv('Bírság', ft(arg.birsag || 0), 'birsag')}
        </div>
        <p class="ku-hz-kis">A bírságot a Hivatal a zsebből, a dunyha alól és a számláról (ebben a sorrendben) azonnal behajtotta. A lefoglalt pálinkát bizonyítékként kezeli, és a karácsonyi ünnepségig megőrzi.</p>
        <div class="ku-hz-maradt"><span>Maradt:</span>${kv('Zseb', ft(S.penz.kp))}${kv('Dunyha', ft(S.penz.dunyha))}${kv('Számla', ft(S.penz.szamla))}</div>
        <div class="ku-hz-tanacs">${ikon('fuzet')}<span>Nagyapa a margón: „${raz ? 'Rejtekhely, kéménysapka, és ne főzz, amikor a falu már suttog.' : 'Három liternél többet ne vigyél. A dunyha nem jár veled, de nem is motozzák.'}”</span></div>
        <div class="ku-hz-lab"><div class="ku-pecset">LEFOGLALVA</div><div class="ku-alairas"><i>olvashatatlan aláírás</i><span>pénzügyőr</span></div>${gomb('@bezar', '', 'Tudomásul veszem', 'fo', 'data-elso')}</div>
      </div>`;
    },
    enter(ui) { ui.close(); },
  };
}

export const MENUK = {
  nap: (ui, a) => napLap(a), szunet: () => szunetLap(), mentes: (ui, a) => mentesLap('menu', a.mod || null), birsag: (ui, a) => birsagLap(a),
  'beallitasok-menu': () => { const l = beallitasokLap('menu'); const h = l.html; l.html = u => kartya('Beállítások', h.call(l, u) + gomb('@vissza', '', 'Kész', 'halk')); return l; },
};
export { szam };
