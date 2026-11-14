// Kisüsti UI — HUD: idő, pénz, rang, régiós gyanú, járőr- és razziajelzés, naplósorok, interakciós felirat, gyorsjelzések.
// A kritikus szám (idő, zsebpénz, gyanú) mindig ugyanott, nagy, sötét alapon; a jelzések jönnek és mennek, de nem takarják a célkeresztet.
import { ft, ftE, esc, ora, tartam, REG, nodeRegio, clamp } from './kozos.js';
import { ikon } from './ikonok.js';
import { NODES } from '../../data/regions.js';
import { CIKKEK } from '../../data/tartalom.js';

const GYANU_SZOVEG = [
  [20, 'Csend van. A szomszéd a muskátlit locsolja.'],
  [40, 'Beszélnek rólad a kocsmában.'],
  [60, 'Éjjel benéz a pénzügyőr, ha füstöl a kémény.'],
  [100, 'Éjjel házkutatás, ha füstöl. Lassíts.'],
  [Infinity, 'Jön a Hivatal. Tüntesd el, ami látszik.'],
];

export class Hud {
  constructor(ui, root) {
    this.ui = ui;
    this.el = document.createElement('div');
    this.el.className = 'ku-hud';
    this.el.innerHTML = `
      <div class="ku-hb">
        <div class="ku-kartya ku-ido"><span class="ku-napjel"></span><b class="ku-ora">06:00</b><span class="ku-nap">1. nap</span></div>
        <div class="ku-kartya ku-penz">
          <div class="ku-zseb" title="Készpénz a zsebedben">${ikon('zseb')}<b>0 Ft</b></div>
          <div class="ku-mas"><span title="A dunyha alatt">${ikon('dunyha')}<i class="ku-dunyha">0 Ft</i></span><span title="A takarékszámlán">${ikon('szamla')}<i class="ku-szamla">0 Ft</i></span></div>
        </div>
        <div class="ku-kartya ku-rang"><div class="ku-rang-sor"><b class="ku-rangnev">Kontár I</b><span class="ku-xp">0 / 60 XP</span></div><div class="ku-xpsav"><i></i></div></div>
        <div class="ku-kuldetes"></div>
      </div>
      <div class="ku-hj">
        <div class="ku-kartya ku-gyanu">
          <div class="ku-gy-fej"><span>GYANÚ</span><span class="ku-gy-reg"></span><b class="ku-gy-szam">0</b></div>
          <div class="ku-gy-sav"><i></i><s style="left:40%"></s><s style="left:60%"></s></div>
          <div class="ku-gy-szoveg"></div>
        </div>
        <div class="ku-riaszt ku-jaror" hidden>${ikon('auto')}<span></span></div>
        <div class="ku-riaszt ku-razzia" hidden>${ikon('figyelem')}<span></span></div>
        <div class="ku-toastok" aria-live="polite"></div>
      </div>
      <div class="ku-naplo"></div>
      <div class="ku-prompt"></div>
      <div class="ku-teljel">${ikon('uzenetek')}<span><kbd>Tab</kbd> telefon</span><b class="ku-olv" hidden>0</b></div>
      <div class="ku-banner" hidden></div>`;
    root.appendChild(this.el);
    const q = s => this.el.querySelector(s);
    this.$ = { ora: q('.ku-ora'), nap: q('.ku-nap'), napjel: q('.ku-napjel'), zseb: q('.ku-zseb b'), zsebDoboz: q('.ku-zseb'), dunyha: q('.ku-dunyha'), szamla: q('.ku-szamla'),
      rang: q('.ku-rangnev'), xp: q('.ku-xp'), xpsav: q('.ku-xpsav i'), kuld: q('.ku-kuldetes'), gyReg: q('.ku-gy-reg'), gySzam: q('.ku-gy-szam'),
      gySav: q('.ku-gy-sav i'), gySzov: q('.ku-gy-szoveg'), gyanu: q('.ku-gyanu'), jaror: q('.ku-jaror'), razzia: q('.ku-razzia'), toast: q('.ku-toastok'),
      naplo: q('.ku-naplo'), prompt: q('.ku-prompt'), olv: q('.ku-olv'), banner: q('.ku-banner'), teljel: q('.ku-teljel') };
    this.kpMutat = null; this.kpCel = 0; this.gyElozo = null; this.jarorVolt = false; this.smsSor = []; this.smsIdo = 0;
    this.naploSorok = [];
  }

  // ------------------------------------------------------------ esemény → jelzés
  naplo(text, hiba = false) {
    const d = document.createElement('div');
    d.className = 'ku-ns' + (hiba ? ' hiba' : '');
    d.textContent = text;
    this.$.naplo.appendChild(d);
    this.naploSorok.push({ d, t: performance.now() });
    while (this.$.naplo.children.length > 5) this.$.naplo.firstChild.remove();
  }
  toast(html, cls = '', ms = 4200) {
    const d = document.createElement('div');
    d.className = 'ku-toast ' + cls;
    d.innerHTML = html;
    this.$.toast.prepend(d);
    while (this.$.toast.children.length > 3) this.$.toast.lastChild.remove();
    requestAnimationFrame(() => d.classList.add('be'));
    setTimeout(() => { d.classList.remove('be'); d.classList.add('ki'); setTimeout(() => d.remove(), 450); }, ms);
    return d;
  }
  /** SMS-jelzés: sűrű érkezésnél (gyorsított idő) összevonja. */
  sms(u) {
    if (this.ui.isOpen('uzenetek')) return;
    const most = performance.now();
    if (most - this.smsIdo < 1500 && this.smsToast?.isConnected) {
      this.smsSor.push(u);
      this.smsToast.querySelector('.ku-t-cim').textContent = `${this.smsSor.length} új üzenet`;
      this.smsToast.querySelector('.ku-t-szov').textContent = this.smsSor.slice(-3).map(x => x.nev).join(', ');
      return;
    }
    this.smsSor = [u]; this.smsIdo = most;
    const sz = u.szoveg.length > 70 ? u.szoveg.slice(0, 68) + '…' : u.szoveg;
    this.smsToast = this.toast(`${ikon('uzenetek', 'ku-t-ik')}<div><div class="ku-t-cim">${esc(u.nev)}</div><div class="ku-t-szov">${esc(sz)}</div></div><kbd>Tab</kbd>`, 'sms');
    this.$.teljel.classList.remove('rezeg'); void this.$.teljel.offsetWidth; this.$.teljel.classList.add('rezeg');
  }
  eladas(e) {
    const v = this.ui.S?.vevok?.find(x => x.id === e.vevo);
    const ki = e.terjeszto ? `${esc(v?.nev || '')} (terjesztőn át)` : esc(v?.nev || '');
    if (!e.terjeszto) this.toast(`${ikon('pohar', 'ku-t-ik')}<div><div class="ku-t-cim">Eladva · ${ki}</div><div class="ku-t-szov ku-t-penz">${ftE(e.ar)}</div></div>`, 'penz', 3600);
    this.penzFel(e.ar);
  }
  /** A zsebpénz mellől felszálló összeg. */
  penzFel(v) {
    const d = document.createElement('div');
    d.className = 'ku-fel' + (v < 0 ? ' minusz' : '');
    d.textContent = ftE(v);
    this.$.zsebDoboz.appendChild(d);
    setTimeout(() => d.remove(), 1700);
  }
  rang(r) {
    const b = this.$.banner;
    b.innerHTML = `<div class="ku-bn-kis">ÚJ RANG</div><div class="ku-bn-nev">${esc(r.nev)}</div><div class="ku-bn-al">„Nagyapád is így kezdte. Csak ő nem mondta el senkinek.”</div>`;
    b.hidden = false; b.classList.remove('be'); void b.offsetWidth; b.classList.add('be');
    clearTimeout(this._bt); this._bt = setTimeout(() => { b.classList.remove('be'); b.classList.add('ki'); setTimeout(() => { b.hidden = true; b.classList.remove('ki'); }, 600); }, 3600);
  }
  kuldetes(e) {
    if (e.kesz) {
      const j = e.jutalom || {};
      const jut = [j.xp ? `+${j.xp} XP` : '', j.kp ? ftE(j.kp) : '', ...Object.entries(j.cikk || {}).map(([id, db]) => `${db} × ${CIKKEK[id]?.nev || id}`)].filter(Boolean).join(' · ');
      this.toast(`${ikon('fuzet', 'ku-t-ik')}<div><div class="ku-t-cim">Kipipálva: ${esc(e.cim)}</div><div class="ku-t-szov">${esc(jut)}</div></div>`, 'kuld', 5000);
    }
  }
  szallitmany(d) {
    this.toast(`${ikon('rendeles', 'ku-t-ik')}<div><div class="ku-t-cim">Megérkezett: ${esc(d.db)} × ${esc(CIKKEK[d.tetel]?.nev || d.tetel)}</div><div class="ku-t-szov">${esc(d.helyNev)}</div></div>`, '', 5200);
  }
  nyitas(e) {
    if (e.mit === 'regio') this.toast(`${ikon('terkep', 'ku-t-ik')}<div><div class="ku-t-cim">Megnyílt: ${esc(e.nev)}</div><div class="ku-t-szov">${esc(REG[e.id]?.leiras || '')}</div></div>`, 'kuld', 6000);
  }
  prompt(text) {
    if (this._pr === text) return;
    this._pr = text;
    this.$.prompt.innerHTML = text ? esc(text).replace(/\[(.+?)\]/g, '<kbd>$1</kbd>') : '';
    this.$.prompt.classList.toggle('lat', !!text);
  }

  // ------------------------------------------------------------ frame
  update(S, dt) {
    const $ = this.$;
    // idő
    $.ora.textContent = ora(S.ido.perc);
    $.nap.textContent = `${S.ido.nap}. nap`;
    const nj = S.ido.nappal ? 'nap' : 'hold';
    if (this._nj !== nj) { this._nj = nj; $.napjel.innerHTML = ikon(nj); $.napjel.className = 'ku-napjel ' + nj; }
    // pénz: a kijelzett érték rugózva követi a valódit
    const kp = S.penz.kp;
    if (this.kpMutat == null) this.kpMutat = kp;
    if (Math.abs(kp - this.kpMutat) >= 1) this.kpMutat += (kp - this.kpMutat) * (1 - Math.exp(-dt * 7)); else this.kpMutat = kp;
    if (Math.abs(kp - this.kpMutat) < 1) this.kpMutat = kp;
    $.zseb.textContent = ft(this.kpMutat);
    $.dunyha.textContent = ft(S.penz.dunyha);
    $.szamla.textContent = ft(S.penz.szamla);
    // rang
    const r = S.rang;
    $.rang.textContent = r.nev;
    const xp0 = r.szintXp, xp1 = r.kovetkezoXp ?? r.xp;
    $.xp.textContent = r.kovetkezoXp ? `${r.xp} / ${r.kovetkezoXp} XP` : `${r.xp} XP`;
    $.xpsav.style.width = (r.kovetkezoXp ? clamp((r.xp - xp0) / Math.max(1, xp1 - xp0), 0, 1) * 100 : 100) + '%';
    const q = S.kuldetes.aktiv;
    const kt = q ? `${ikon('fuzet')}<span>${esc(q.cim)}</span><i>${q.lepes}/${q.osszes}</i>` : '';
    if (this._kt !== kt) { this._kt = kt; $.kuld.innerHTML = kt; $.kuld.hidden = !q; }
    // gyanú: a játékos régiója
    const reg = this.ui.jatekosRegio(S);
    const R = S.regiok.find(x => x.id === reg) || S.regiok[0];
    const g = R.gyanu;
    $.gyReg.textContent = R.nev;
    $.gySzam.textContent = g;
    $.gySav.style.width = clamp(g, 0, 100) + '%';
    const fok = g >= 100 ? 4 : g >= 60 ? 3 : g >= 40 ? 2 : g >= 20 ? 1 : 0;
    $.gySzov.textContent = GYANU_SZOVEG.find(([h]) => g < h)[1] + (R.besugo?.csendes ? ' A besúgó most hallgat.' : '');
    $.gyanu.dataset.fok = fok;
    if (this.gyElozo != null && fok > this.gyElozo && fok >= 2) { this.ui.hang('gyanu'); $.gyanu.classList.remove('lok'); void $.gyanu.offsetWidth; $.gyanu.classList.add('lok'); }
    this.gyElozo = fok;
    // járőr: a fehér autó a közelben, vagy a játékos régiója felé tart
    const pp = this.ui.jatekosPos(S);
    let jt = '';
    for (const j of S.jarorok || []) {
      const p = j.pos; if (!p) continue;
      const d = Math.hypot(p[0] - pp[0], p[1] - pp[1]);
      if (d < 260) { jt = `Fehér autó a közelben · ${Math.round(d / 10) * 10} m`; break; }
      if (j.regio === reg || nodeRegio(j.cel) === reg) jt = `Pénzügyőr úton ide: ${REG[nodeRegio(j.cel)]?.nev || ''}`;
    }
    $.jaror.hidden = !jt;
    if (jt) $.jaror.querySelector('span').textContent = jt;
    if (jt && !this.jarorVolt) this.ui.hang('gyanu');
    this.jarorVolt = !!jt;
    const rz = (S.razziaFigyelmeztetes || [])[0];
    $.razzia.hidden = !rz;
    if (rz) { const p = S.ingatlanok.find(x => x.id === rz.prop); $.razzia.querySelector('span').textContent = `Házkutatás jön: ${p?.nev || rz.prop}, ${ora(rz.ido)} · még ${tartam(rz.ido - S.ido.perc)}`; }
    // olvasatlan
    $.olv.hidden = !S.olvasatlan; $.olv.textContent = S.olvasatlan > 99 ? '99+' : S.olvasatlan;
    // napló halványítása
    const most = performance.now();
    for (const n of this.naploSorok) if (!n.ki && most - n.t > 9000) { n.ki = true; n.d.classList.add('ki'); setTimeout(() => n.d.remove(), 900); }
    this.naploSorok = this.naploSorok.filter(n => n.d.isConnected);
  }
  /** Telefonnyitáskor a HUD egy része halványabb (a telefon nem takar le életfontos számot). */
  halvany(b) { this.el.classList.toggle('halvany', b); }
}
export { NODES };
