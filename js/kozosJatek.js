// Kisüsti — a közös játék bekötése a játékba (a hálózati réteg a coop/ mappában van, ez csak a játékos felé eső rész):
//   • releCim()       — a relé címe: ?rele= → RELE_ALAP → ha az oldalt maga a relé szolgálja ki, annak /ws-e
//   • kezdoPanel()    — a kezdőképernyő „Közös játék” panelje (név, szobanyitás kóddal, belépés kóddal)
//   • KozosJatek      — játék közben: a saját helyünk kiküldése, a többiek figurája névvel, a coop-események a képernyőn
//
// A szimuláció a házigazda gépén fut (host-autoritatív); a vendég gépén a tükör (EmpireProxy) él. Lásd server/BEKOTES.md.
import { szereplo, ANYAG } from './szereplok/szereplo.js';

/** A nyilvános relé címe (wss://…/ws). null, amíg a hosztolásról nincs tulajdonosi döntés (server/README.md). */
export const RELE_ALAP = null;
const NEV_KULCS = 'kisusti.coop.nev';
/** A vendég a szoba bezárásakor ide menti a közös állást — a saját egyjátékos-mentéséhez (kisusti.mentes.*) nem nyúl. */
export const COOP_MENTES = 'kisusti.coop.utolso';

/** Hangolható értékek (játékérzet). */
export const HC = {
  cimkeTav: 70,          // m: a társ neve eddig látszik (a falusiaké 14 m)
  cimkeMagas: 2.05,      // m: a név a figura talpa fölött
  fordulas: 9,           // 1/s: a figura fordulásának simítása (exp. közelítés)
  halvany: 0.35,         // a kiesett (offline) társ átlátszósága
  futasPlafon: 6,        // m/s: e fölött (jármű) a futás-animáció nem gyorsul tovább
  haladSim: 8,           // 1/s: a sebesség simítása (az interpolált minták közti lépcső ne rángassa az animációt)
  releProbaMs: 800,      // ms: ennyit várunk a /allapot válaszára (az oldalt a relé szolgálja-e ki)
  uzenetMp: 6,           // mp: a coop-szalag (házigazda kiesett, alvás) legalább ennyi ideig látszik
};

const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A relé címe; null, ha nincs (a panel ezt kiírja). */
export async function releCim(Q = new URLSearchParams(location.search)) {
  if (Q.get('rele')) return Q.get('rele');
  if (RELE_ALAP) return RELE_ALAP;
  if (!/^https?:$/.test(location.protocol)) return null;
  try {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), HC.releProbaMs);
    const r = await fetch('/allapot', { signal: ac.signal, cache: 'no-store' }); clearTimeout(t);
    if (r.ok && 'szobak' in await r.json()) return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  } catch (e) { /* nem a relé szolgálja ki az oldalt */ }
  return null;
}

/** A társ figurája: a valós arányú szereplők közül, az azonosítóból determinisztikusan (mindenki ugyanazt látja). */
function tarsSpec(id) {
  const h = hashStr(String(id)), nem = h & 1 ? 'n' : 'f';
  const ruhak = nem === 'f' ? ['pulover', 'ing', 'munkas', 'zold_ing', 'kantaros'] : ['polo', 'munkas', 'ruha', 'tunika'];
  return { nem, kor: (h >> 1) % 3 ? 'fiatal' : 'kozep', ruha: ruhak[(h >> 3) % ruhak.length], seed: h };
}

// ================================================================ kezdőképernyő
/**
 * A „Közös játék” panel a #start-ban. A hívó adja a műveleteket:
 *   nyit(url, nev) → szobakód (a szoba él, a játék még nem indult) · indul() · megse() · belep(url, kod, nev) · hostInfo() → szöveg
 */
export function kezdoPanel(start, { nyit, indul, megse, belep, hostInfo }) {
  const el = document.createElement('div');
  el.id = 'coop'; el.className = 'coop'; el.hidden = true;
  el.innerHTML = `
    <h2>Közös játék</h2>
    <div class="coop-al">2–4 fő, egy birodalom. A falu a házigazda gépén él.</div>
    <div class="coop-nincs" hidden>A közös játék szervere még nincs bekapcsolva.<small>Helyben: <code>node server/relay.mjs</code>, aztán <code>localhost:8787</code>.</small></div>
    <label class="coop-nev">Neved <input id="coop-nev" maxlength="16" autocomplete="nickname" spellcheck="false"></label>
    <div class="coop-ket">
      <section><h3>Házigazda</h3><button id="coop-nyit">Szobát nyitok<small id="coop-nyit-al"></small></button></section>
      <section><h3>Vendég</h3><input id="coop-kod" maxlength="4" placeholder="KÓD" autocomplete="off" spellcheck="false" aria-label="Szobakód"><button id="coop-belep">Belépek</button></section>
    </div>
    <div class="coop-szoba" hidden>
      <div class="coop-kodcim">Szobakód — add meg a többieknek</div>
      <div class="coop-kodsor"><input id="coop-kodki" readonly aria-label="Szobakód"><button id="coop-masol" class="kicsi">Másolás</button></div>
      <ul id="coop-lista"></ul>
      <button id="coop-indul">Indulunk</button>
    </div>
    <div class="coop-allapot" id="coop-all" role="status"></div>
    <button class="halk kicsi" id="coop-vissza">Vissza</button>`;
  start.appendChild(el);
  const $ = s => el.querySelector(s), gombok = start.querySelector('.gombok');
  const nevMez = $('#coop-nev'), kodMez = $('#coop-kod');
  nevMez.value = localStorage.getItem(NEV_KULCS) || '';
  let url = null, fut = false, szoba = null;
  const allapot = (t, hiba = false) => { $('#coop-all').textContent = t || ''; $('#coop-all').classList.toggle('hiba', hiba); };
  const nev = () => { const n = nevMez.value.trim().slice(0, 16) || 'Pálinkás'; localStorage.setItem(NEV_KULCS, n); return n; };
  const zarol = b => { fut = b; for (const g of el.querySelectorAll('button, input')) if (g.id !== 'coop-vissza' && g.id !== 'coop-kodki') g.disabled = b || (!url && g.id !== 'coop-nev'); };

  async function mutat() {
    el.hidden = false; gombok.hidden = true; allapot('');
    $('#coop-nyit-al').textContent = hostInfo();
    url = await releCim();
    $('.coop-nincs').hidden = !!url;
    zarol(false);
    (url ? (nevMez.value ? $('#coop-nyit') : nevMez) : $('#coop-vissza')).focus({ preventScroll: true });
  }
  function rejt() { el.hidden = true; gombok.hidden = false; $('.coop-szoba').hidden = true; el.querySelector('.coop-ket').hidden = false; szoba = null; }
  function lista(js) {
    $('#coop-lista').innerHTML = js.map(j => `<li class="${j.online ? '' : 'ki'}"><i></i>${esc(j.nev)}${j.host ? ' <small>házigazda</small>' : ''}${j.en ? ' <small>te</small>' : ''}</li>`).join('');
  }

  $('#coop-nyit').addEventListener('click', async () => {
    if (fut || !url) return;
    zarol(true); allapot('Szobát nyitunk…');
    try {
      szoba = await nyit(url, nev(), lista);
      el.querySelector('.coop-ket').hidden = true; $('.coop-szoba').hidden = false;
      $('#coop-kodki').value = szoba; allapot('');
      zarol(false); $('#coop-indul').focus({ preventScroll: true });
    } catch (e) { allapot(`Nem sikerült: ${e.message}`, true); zarol(false); }
  });
  $('#coop-masol').addEventListener('click', async () => {
    const k = $('#coop-kodki').value;
    try { await navigator.clipboard.writeText(k); }
    catch (e) { $('#coop-kodki').select(); document.execCommand?.('copy'); }   // nem biztonságos (http, helyi háló) oldalon
    allapot(`Vágólapon: ${k}`);
  });
  $('#coop-indul').addEventListener('click', async () => { if (fut) return; zarol(true); try { await indul(); rejt(); } catch (e) { allapot(e.message, true); } zarol(false); });
  const belepes = async () => {
    if (fut || !url) return;
    const kod = kodMez.value.trim().toUpperCase();
    if (kod.length !== 4) { allapot('A szobakód 4 betű.', true); kodMez.focus(); return; }
    zarol(true); allapot('Belépés…');
    try { await belep(url, kod, nev()); rejt(); allapot(''); }
    catch (e) { allapot(e.ok === 'nincs' ? 'Nincs ilyen szoba. Nézd meg a kódot.' : e.ok === 'tele' ? 'A szoba tele van (4 fő).' : `Nem sikerült: ${e.message}`, true); }
    zarol(false);
  };
  $('#coop-belep').addEventListener('click', belepes);
  kodMez.addEventListener('input', () => { kodMez.value = kodMez.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  kodMez.addEventListener('keydown', e => { if (e.key === 'Enter') belepes(); });
  $('#coop-vissza').addEventListener('click', async () => { if (szoba) await megse(); rejt(); start.querySelector('#uj')?.focus({ preventScroll: true }); });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') $('#coop-vissza').click(); });
  return { mutat, rejt, allapot, el };
}

// ================================================================ játék közben
export class KozosJatek {
  /** J: a közös állapot (jatek.js); coop: a Coop példány; onVege(e): a szoba bezárult. */
  constructor(J, coop, { onVege } = {}) {
    this.J = J; this.coop = coop; this.onVege = onVege;
    this.tarsak = new Map();      // id → {sz, obj, cimke, nev, online, halv, v, ry}
    this.ismert = new Map(coop.jatekosok.map(j => [j.id, j.nev]));
    this.jel = document.createElement('div'); this.jel.className = 'coop-jel'; document.body.appendChild(this.jel);
    this.szalag = document.createElement('div'); this.szalag.className = 'coop-szalag'; document.body.appendChild(this.szalag);
    this._szalagT = 0; this._jelKulcs = null;
    this.le = coop.on(e => this.esemeny(e));
    this.rajzJel();
  }
  nevE(id) { return this.coop.jatekosok.find(j => j.id === id)?.nev || this.ismert.get(id) || 'Valaki'; }
  uzen(t, hiba = false) { this.J.uzen(t, hiba); }
  mutatSzalag(t) { this.szalag.textContent = t || ''; this.szalag.classList.toggle('be', !!t); this._szalagT = t ? HC.uzenetMp : 0; }

  esemeny(e) {
    const c = this.coop;
    switch (e.type) {
      case 'jatekosok': {
        for (const j of e.lista) {
          if (j.en) continue;
          const volt = this.ismert.get(j.id);
          if (volt == null) this.uzen(`${j.nev} belépett a szobába.`);
          this.ismert.set(j.id, j.nev);
        }
        for (const [id, nev] of this.ismert) if (!e.lista.some(j => j.id === id)) { this.uzen(`${nev} kilépett.`); this.ismert.delete(id); }
        this.rajzJel();
        break;
      }
      case 'utkozes':
        // a host nem hajtotta végre: más fogta a tárgyat (hordó, üst, rendelés…) az utolsó másfél másodpercben
        if (e.ki === c.te) this.uzen(`${e.kieNev || this.nevE(e.kie)} épp ezt fogja. Várj egy pillanatot.`, true);
        else this.uzen(`${e.kiNev || this.nevE(e.ki)} is nyúlt hozzá, de nálad volt.`);
        break;
      case 'meta': {
        const a = e.alvas, b = e.berlet;
        if (a) {
          const en = a.igen.includes(c.te);
          this.mutatSzalag(en ? `Lefeküdtél · ${a.igen.length}/${a.kell.length} alszik · E az ágyon: mégse`
            : `${a.igen.map(id => this.nevE(id)).join(', ')} lefeküdt (${a.igen.length}/${a.kell.length}). Ha te is, reggel lesz.`);
          this._alvasVolt = true;
        } else if (this._alvasVolt) { this._alvasVolt = false; this.mutatSzalag(''); }
        if (b?.arva && !this._arvaVolt) this.uzen(`${this.nevE(b.ki)} üstje gazdátlan, hűl. Állj oda, és vedd át (E).`, true);
        this._arvaVolt = !!b?.arva;
        this.rajzJel();
        break;
      }
      case 'hostKiesett': this.mutatSzalag(`A házigazda kiesett — ${e.mp} mp-ig várunk rá.`); this._szalagT = e.mp + 1; break;
      case 'hostVissza': this.mutatSzalag(''); this.uzen('A házigazda visszajött.'); break;
      case 'kapcsolat': this.mutatSzalag(e.allapot === 'ujra' ? 'Megszakadt a kapcsolat — újracsatlakozás…' : ''); if (e.allapot === 'ujra') this._szalagT = 1e9; this.rajzJel(); break;
      case 'hiba': if (e.szoveg) this.uzen(e.szoveg, true); break;
      case 'vege': this.onVege?.(e); break;
    }
  }

  /** A sarokjelvény: szobakód, a játékosok (pont: online), a kapcsolat. */
  rajzJel() {
    const c = this.coop, js = c.jatekosok, b = c.meta.berlet;
    const kulcs = JSON.stringify([c.kod, c.allapot, js.map(j => [j.id, j.nev, j.online]), b?.ki, b?.arva]);
    if (kulcs === this._jelKulcs) return; this._jelKulcs = kulcs;
    const all = { szoba: '', ujra: 'újracsatlakozás…', hostNelkul: 'házigazda nélkül', kapcsolodik: 'kapcsolódás…', vege: 'vége' }[c.allapot] ?? c.allapot;
    this.jel.innerHTML = `<div class="coop-jel-fej"><span>Szoba</span><b>${esc(c.kod || '—')}</b>${all ? `<em>${esc(all)}</em>` : ''}</div>` +
      js.map(j => `<div class="coop-jel-sor ${j.online ? '' : 'ki'}"><i></i>${esc(j.nev)}${j.en ? ' <small>te</small>' : j.host ? ' <small>házigazda</small>' : ''}${b && b.ki === j.id ? ` <small>${b.arva ? 'üst gazdátlan' : 'üstnél'}</small>` : ''}</div>`).join('');
  }

  /** Minden frame-ben (a fő hurok, coopban): a saját hely ki, a többiek figurája be. */
  update(dt) {
    const J = this.J, c = this.coop;
    if (c.allapot === 'vege') return;
    const p = J.jatekosPoz();
    c.pozicio(p.x, p.y, p.z, J.jatekos.yaw, J.jatekos.pitch);
    const latott = new Set();
    for (const j of c.jatekosok) {
      if (j.en) continue;
      latott.add(j.id);
      let t = this.tarsak.get(j.id);
      if (!t) t = this._uj(j);
      if (t.online !== j.online) this._halvany(t, !j.online);
      const q = c.jatekosPoz(j.id);
      t.obj.visible = !!q;
      if (!q) continue;
      const y = J.V.talaj(q.x, q.z);
      const dx = q.x - t.obj.position.x, dz = q.z - t.obj.position.z, ugras = Math.hypot(dx, dz);
      // sebesség a lépésből (elsimítva); nagy ugrás (busz, újracsatlakozás) = teleport, nem rohanás
      const v = ugras > 25 || !t.van ? 0 : ugras / Math.max(dt, 1e-3);
      t.v += (v - t.v) * Math.min(1, dt * HC.haladSim);
      t.obj.position.set(q.x, y, q.z); t.van = true;
      // nézés: mozgás közben a haladás iránya (jármű), állva a kamera iránya (-sin yaw, -cos yaw)
      const cel = t.v > 0.6 && ugras > 1e-4 ? Math.atan2(dx, dz) : q.yaw + Math.PI;
      let d = cel - t.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      t.obj.rotation.y += d * (1 - Math.exp(-dt * HC.fordulas));
      t.sz.halad(Math.min(t.v, HC.futasPlafon));
      t.sz.update(dt);
      const nev = j.nev + (j.online ? '' : ' · kiesett');
      if (t.cimke.text !== nev) t.cimke.text = nev;
    }
    for (const [id, t] of this.tarsak) if (!latott.has(id)) this._torol(id, t);
    if (this._szalagT > 0) { this._szalagT -= dt; if (this._szalagT <= 0) this.mutatSzalag(''); }
    this.rajzJel();
  }
  _uj(j) {
    const J = this.J, sz = szereplo(tarsSpec(j.id));
    sz.obj.name = 'tars:' + j.id;
    sz.obj.userData.tars = j.id;
    J.scene.add(sz.obj);
    J.G?.kontakt(sz.obj, 0.42, 0.42);
    const cimke = J.cimke(sz.obj, j.nev, HC.cimkeMagas, 16);
    cimke.tav = HC.cimkeTav; cimke.cls = 'tars';
    cimke.el?.classList.add('tars');
    const t = { sz, obj: sz.obj, cimke, online: true, v: 0, van: false };
    this.tarsak.set(j.id, t);
    return t;
  }
  /** Kiesett társ: áttetsző (saját anyagpéldány, a közös ANYAG-hoz nem nyúlunk). */
  _halvany(t, be) {
    t.online = !be;
    if (be) { t.sz.mesh.material = ANYAG.clone(); t.sz.mesh.material.transparent = true; t.sz.mesh.material.opacity = HC.halvany; t.sz.mesh.material.depthWrite = false; }
    else if (t.sz.mesh.material !== ANYAG) { t.sz.mesh.material.dispose(); t.sz.mesh.material = ANYAG; }
    t.sz.mesh.castShadow = !be;
    t.cimke.el?.classList.toggle('ki', be);
  }
  _torol(id, t) {
    const J = this.J;
    J.G?.kontaktTorol?.(t.obj);
    J.cimkeTorol(t.cimke);
    if (t.sz.mesh.material !== ANYAG) t.sz.mesh.material.dispose();
    t.sz.dispose();
    this.tarsak.delete(id);
  }
  /** Lebontás (kilépés, a szoba vége): figurák, feliratok, jelvény. */
  lebont() {
    this.le?.();
    for (const [id, t] of [...this.tarsak]) this._torol(id, t);
    this.jel.remove(); this.szalag.remove();
  }
  /** Tesztkampó: a társ-figurák állapota. */
  allapot() {
    return [...this.tarsak].map(([id, t]) => ({ id, nev: this.nevE(id), lathato: t.obj.visible && !!t.obj.parent, online: t.online,
      x: +t.obj.position.x.toFixed(2), z: +t.obj.position.z.toFixed(2), anim: t.sz.aktNev, cimke: t.cimke.text, cimkeLatszik: t.cimke.el?.style.display !== 'none' }));
  }
}
