// Kisüsti coop — a kapcsolat, a szoba, a játékosok és a pozíciók. Böngészőben és Node 22+ alatt is fut (globális WebSocket).
//
//   import { Coop } from './coop/coop.js';
//   const coop = new Coop({ url: 'ws://localhost:8787/ws', nev: 'Pista' });
//   const kod = await coop.hostol(null, E);          // host: a meglévő Empire-t viszi; coop.E = HostKapu
//   const E   = await coop.csatlakozik('KXQT');      // vendég: coop.E = EmpireProxy (ugyanaz az alak, mint az Empire)
//   coop.on(e => …)                                  // {type: 'jatekosok'|'kapcsolat'|'utkozes'|'meta'|'hostKiesett'|'hostVissza'|'vege'|'hiba'|'kuldve'}
//   await coop.kuld('harvest', 'tanya')              // = await coop.E.harvest('tanya')
//   coop.pozicio(x, y, z, yaw, pitch)                // minden frame-ben hívható; 15 Hz-en megy ki
//   coop.jatekosok                                   // [{id, nev, host, online, en, poz}]; a poz a többieknél interpolált
//   coop.allapot                                     // 'nincs'|'kapcsolodik'|'szoba'|'ujra'|'hostNelkul'|'vege'
//   coop.utolsoMentes()                              // mentés-szöveg (Empire.load-dal tölthető), bármikor
//   await coop.kilep()
import { Empire } from '../../sim/empire.js';
import { HANGOLAS as H } from './protokoll.js';
import { HostMag } from './host.js';
import { EmpireProxy, HostKapu } from './proxy.js';

const ora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const utf8 = s => { let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xd800 && c < 0xdc00) ? (i++, 4) : 3; } return n; };
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const szogKul = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export class Coop {
  constructor({ url, nev = '', WebSocket: WS = globalThis.WebSocket, hatterLepes = true } = {}) {
    if (!WS) throw new Error('Nincs WebSocket ebben a környezetben.');
    this.url = url; this.nev = nev; this.WS = WS; this.hatterLepes = hatterLepes;
    this.allapot = 'nincs'; this.szerep = null; this.kod = null; this.te = null; this.token = null; this.hostId = null;
    this.lista = []; this.E = null; this.meta = { berlet: null, alvas: null }; this.rtt = null;
    this.stat = { be: 0, ki: 0, deltaBajt: 0, deltaDb: 0, deltaKiBajt: 0, teljesBajt: 0, pozBe: 0, parancsRtt: [], kezdet: ora() };
    this._fuggo = new Map(); this._poz = new Map(); this._figyelok = []; this._idok = [];
    this._munkamenet = Math.random().toString(36).slice(2, 8); this._n = 0;
    this._sajatPoz = null; this._pozKi = 0; this._teljesKert = 0; this._ustN = 0;
  }

  // ------------------------------------------------------------ nyilvános
  on(fn) { this._figyelok.push(fn); return () => { this._figyelok = this._figyelok.filter(f => f !== fn); }; }
  get jatekosok() {
    return this.lista.map(j => ({ ...j, en: j.id === this.te, poz: j.id === this.te ? this._sajatPoz : this.jatekosPoz(j.id) }));
  }

  /** Szobát nyit (a kód opcionális: ha nincs, a relé ad egyet). Visszaad: a szobakód. */
  async hostol(kod = null, E = null) {
    this.szerep = 'host';
    this.Ev = E || new Empire();
    await this._kapcsol({ t: 'hostol', kod, nev: this.nev });
    this.mag = new HostMag(this, this.Ev);
    this.E = new HostKapu(this, this.Ev, this.mag);
    this._idozitok();
    this.mag.mentesFel();
    return this.kod;
  }
  /** Belép a szobába; akkor tér vissza, amikor a teljes tükör megjött (coop.E használható). */
  async csatlakozik(kod) {
    this.szerep = 'kliens';
    const tukor = new Promise((ok, hiba) => { this._tukorKesz = ok; this._tukorHiba = hiba; });
    await this._kapcsol({ t: 'csatlakozik', kod, nev: this.nev });
    const idozito = setTimeout(() => this._tukorHiba?.(new Error('A házigazda nem küldte el az állapotot.')), H.parancsTimeoutMs);
    try { await tukor; } finally { clearTimeout(idozito); }
    this._idozitok();
    return this.E;
  }
  /** Parancs a hostnak: kuld('deliver', id, tetel) vagy kuld({nev, args}). Ígéret: az Empire válasz-objektuma. */
  kuld(nev, ...args) {
    if (typeof nev === 'object') { args = nev.args || []; nev = nev.nev; }
    const id = `${this._munkamenet}.${++this._n}`;
    this._jelez({ type: 'kuldve', nev, id });
    if (this.allapot === 'vege') return Promise.resolve({ ok: false, hiba: 'Nincs kapcsolat a szobával.' });
    return new Promise(ok => {
      const p = { nev, args, ok, t0: ora() };
      this._fuggo.set(id, p);
      if (this.szerep === 'host') {
        const r = this.mag.vegrehajt(this.te, id, nev, args);
        if (r !== null) this._felold(id, r);
        return;
      }
      const ido = nev === 'sleep' ? H.alvasMs + 5000 : H.parancsTimeoutMs;
      p.idozito = setTimeout(() => this._felold(id, { ok: false, hiba: 'Nem jött válasz a házigazdától.', idotullepes: true }), ido);
      this._kuldNyers({ t: 'h', m: { t: 'c', id, n: nev, a: args } });
    });
  }
  /** A saját figura helye és nézése (minden frame-ben hívható; `pozHz`-en megy ki). */
  pozicio(x, y, z, yaw = 0, pitch = 0) {
    this._sajatPoz = { x, y, z, yaw, pitch };
    const most = ora();
    if (most - this._pozKi < 1000 / H.pozHz - 2) return;
    this._pozKi = most;
    this._kuldNyers({ t: 'p', x: r2(x), y: r2(y), z: r2(z), ya: r3(yaw), pi: r3(pitch), ts: Math.round(most) });
  }
  /** Egy másik játékos interpolált helye `interpMs`-sel a múltban; csomagvesztésnél `extrapolMaxMs`-ig előrevetít. */
  jatekosPoz(ki, most = ora()) {
    const b = this._poz.get(ki);
    if (!b || !b.minta.length) return null;
    const m = b.minta, t = most - H.interpMs - b.ofs;
    if (t <= m[0].t || m.length === 1) return { ...m[0], kor: most - b.ofs - m[0].t };
    for (let i = m.length - 1; i > 0; i--) {
      const a = m[i - 1], c = m[i];
      if (t >= a.t && t <= c.t) {
        const u = (t - a.t) / Math.max(1, c.t - a.t);
        return { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u, z: a.z + (c.z - a.z) * u,
          yaw: a.yaw + szogKul(a.yaw, c.yaw) * u, pitch: a.pitch + (c.pitch - a.pitch) * u, kor: 0 };
      }
    }
    const a = m[m.length - 2], c = m[m.length - 1], dt = Math.min(t - c.t, H.extrapolMaxMs), seb = 1 / Math.max(1, c.t - a.t);
    return { x: c.x + (c.x - a.x) * seb * dt, y: c.y, z: c.z + (c.z - a.z) * seb * dt, yaw: c.yaw, pitch: c.pitch, kor: t - c.t };
  }
  /** A legfrissebb mentés: a host saját állapota, a vendégnél a tükörből (≤ 1/deltaHz régi), a szoba zárása után a relé példánya. */
  utolsoMentes() { return this._vegMentes || this.E?.save() || null; }
  async kilep() {
    if (this.allapot === 'vege') return;
    this._kilepes = true;   // a relé erre bontja a kapcsolatot: ez nem kiesés, nem csatlakozunk vissza
    if (this.szerep === 'host') this._kuldNyers({ t: 'zar', adat: this.Ev.save() });
    else this._kuldNyers({ t: 'kilep' });
    await new Promise(ok => setTimeout(ok, 30));
    this._vege('kilepett', null);
  }

  // ------------------------------------------------------------ kapcsolat
  _kapcsol(hello) {
    this.allapot = this.allapot === 'ujra' ? 'ujra' : 'kapcsolodik';
    return new Promise((ok, hiba) => {
      const ws = new this.WS(this.url);
      this.ws = ws;
      let kesz = false;
      const vege = (f, x) => { if (kesz) return; kesz = true; clearTimeout(t); f(x); };
      const t = setTimeout(() => { vege(hiba, new Error('A relé nem válaszolt.')); try { ws.close(); } catch { /* */ } }, H.parancsTimeoutMs);
      ws.onopen = () => this._kuldNyers(hello);
      ws.onmessage = ev => {
        const s = typeof ev.data === 'string' ? ev.data : String(ev.data);
        const n = utf8(s); this.stat.be += n;
        let m; try { m = JSON.parse(s); } catch { return; }
        if (!kesz && m.t === 'hiba') { ws.onclose = null; try { ws.close(); } catch { /* */ } return vege(hiba, Object.assign(new Error(m.szoveg), { ok: m.ok })); }
        this._bejovo(m, n);
        if (!kesz && m.t === 'szoba') vege(ok, m);
      };
      ws.onclose = () => { if (!kesz) return vege(hiba, new Error('A kapcsolat megszakadt.')); if (this.ws === ws) this._megszakadt(); };
      ws.onerror = () => { /* a close jön utána */ };
    });
  }
  _kuldNyers(o) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return false;
    const s = JSON.stringify(o);
    ws.send(s);
    const n = utf8(s); this.stat.ki += n;
    if (o.t === 'm' && o.m?.t === 'd') this.stat.deltaKiBajt += n;
    return true;
  }
  async _megszakadt() {
    if (this.allapot === 'vege' || this._ujraFut || this._kilepes) return;
    this._ujraFut = true;
    this.allapot = 'ujra'; this._jelez({ type: 'kapcsolat', allapot: 'ujra' });
    const t0 = ora();
    for (let i = 0; ora() - t0 < H.ujracsatlakozasMs && this.allapot !== 'vege'; i++) {
      await new Promise(ok => setTimeout(ok, H.ujraKesleltetesMs[i] ?? 5000));
      try {
        await this._kapcsol({ t: this.szerep === 'host' ? 'hostol' : 'csatlakozik', kod: this.kod, nev: this.nev, token: this.token });
        this._ujraFut = false;
        this.allapot = 'szoba'; this._jelez({ type: 'kapcsolat', allapot: 'szoba' });
        if (this.szerep === 'host') { for (const j of this.lista) if (j.id !== this.te && j.online) this.mag.teljes(j.id); }
        else { this._teljesKer(true); this._ujraKuld(); }
        return;
      } catch (e) { if (e.ok === 'nincs' || e.ok === 'foglalt') break; }
    }
    this._ujraFut = false;
    if (this.allapot !== 'vege') this._vege('kapcsolat', null);
  }
  _ujraKuld() { for (const [id, p] of this._fuggo) this._kuldNyers({ t: 'h', m: { t: 'c', id, n: p.nev, a: p.args } }); }
  _teljesKer(most = false) {
    if (!most && ora() - this._teljesKert < 500) return;
    this._teljesKert = ora();
    this._kuldNyers({ t: 'h', m: { t: 'teljes?' } });
  }
  _felold(id, r) {
    const p = this._fuggo.get(id); if (!p) return;
    this._fuggo.delete(id); clearTimeout(p.idozito);
    if (this.szerep === 'kliens') {
      const st = this.stat.parancsRtt; st.push(ora() - p.t0); if (st.length > 500) st.shift();
      this.E?.valaszElott(p.nev, r);
    }
    p.ok(r);
  }
  _idozitok() {
    this._idok.forEach(clearInterval);
    this._idok = [
      setInterval(() => this.mag?.utem(), 1000 / H.deltaHz),
      setInterval(() => { this._kuldNyers({ t: 'ping', c: ora() }); }, H.pingMs),
      setInterval(() => {
        if (this.szerep !== 'kliens' || !this.E?.keretek?.length || this.ws?.readyState !== 1) return;
        this._kuldNyers({ t: 'h', m: { t: 'u', n: ++this._ustN, f: this.E.keretekKi() } });
      }, H.ustKeretMs),
    ];
  }
  _vege(ok, releMentes) {
    if (this.allapot === 'vege') return;
    this.allapot = 'vege';
    this._idok.forEach(clearInterval); this._idok = [];
    let helyi = null; try { helyi = this.E?.save() || null; } catch { /* nincs tükör */ }
    const perc = s => { try { return JSON.parse(s).core.minutes; } catch { return -1; } };
    let mentes = releMentes, forras = 'relé';
    // a tükör ideje kerekítve jön (delta.js), ezért csak akkor a helyi, ha legalább egy játékperccel frissebb
    if (!mentes || (helyi && perc(helyi) > perc(mentes) + 1)) { mentes = helyi; forras = 'helyi'; }
    this._vegMentes = mentes;
    for (const id of [...this._fuggo.keys()]) this._felold(id, { ok: false, hiba: 'A szoba bezárult.' });
    this.mag?.leall();
    const ws = this.ws; this.ws = null;
    try { ws?.close(); } catch { /* */ }
    this._jelez({ type: 'vege', ok, mentes, forras });
  }

  // ------------------------------------------------------------ bejövő
  _bejovo(m, n) {
    switch (m.t) {
      case 'szoba':
        this.kod = m.kod; this.te = m.te; this.token = m.token; this.hostId = m.host; this.lista = m.jatekosok;
        if (this.allapot !== 'ujra') this.allapot = 'szoba';
        this._jelez({ type: 'jatekosok', lista: this.jatekosok });
        break;
      case 'jatekosok':
        this.lista = m.lista;
        for (const k of [...this._poz.keys()]) if (!m.lista.some(j => j.id === k)) this._poz.delete(k);
        this._jelez({ type: 'jatekosok', lista: this.jatekosok });
        break;
      case 'hiba': this._jelez({ type: 'hiba', ok: m.ok, szoveg: m.szoveg }); break;
      case 'pong': { const d = ora() - m.c; this.rtt = this.rtt == null ? d : this.rtt * 0.8 + d * 0.2; break; }
      case 'p': this._pozBe(m, n); break;
      case 'hostKiesett': this.allapot = 'hostNelkul'; this._jelez({ type: 'hostKiesett', mp: m.mp }); break;
      case 'hostVissza': this.allapot = 'szoba'; this._ujraKuld(); this._jelez({ type: 'hostVissza' }); break;
      case 'szobaZarva': this._vege(m.ok, m.mentes); break;
      // host
      case 'h': if (this.mag) this._hostBe(m.ki, m.m); break;
      case 'be': this.mag?.teljes(m.ki); this.mag?.metaKi(); break;
      case 'ki': { const j = this.lista.find(x => x.id === m.ki); if (j) j.online = false; this.mag?.jatekosKi(m.ki); break; }
      // vendég
      case 'm': if (this.szerep === 'kliens') this._kliensBe(m.m, n); break;
      default: break;
    }
  }
  _hostBe(ki, m) {
    if (!m) return;
    if (m.t === 'c') { const r = this.mag.vegrehajt(ki, m.id, String(m.n), m.a); if (r !== null) this._valasz(ki, m.id, r); }
    else if (m.t === 'u') this.mag.ustKeretek(ki, m.f, m.n);
    else if (m.t === 'teljes?') this.mag.teljes(ki);
  }
  _kliensBe(m, n) {
    switch (m.t) {
      case 'teljes':
        this.stat.teljesBajt += n;
        if (!this.E) { this.E = new EmpireProxy(this, m); this._tukorKesz?.(); } else this.E.teljes(m);
        if (m.meta) this._metaHelyben(m.meta);
        break;
      case 'd': this.stat.deltaBajt += n; this.stat.deltaDb++; this.E?.delta(m); break;
      case 'v': this._felold(m.id, m.r); break;
      case 'e': this.E?.esemeny(m.e); break;
      case 'meta': this._metaHelyben(m); break;
      case 'berlet': this.E?.berlet(m); break;
      case 'ce': this._jelez(m.e); break;
      default: break;
    }
  }
  _pozBe(m, n, most = ora()) {
    this.stat.pozBe += n;
    let b = this._poz.get(m.ki);
    if (!b) this._poz.set(m.ki, b = { minta: [], ofs: most - m.ts, utolso: most });
    // óraeltolás: a legkisebb (legkevésbé késett) mintához igazodunk, és lassan engedünk, hogy az óracsúszást is kövesse
    b.ofs = Math.min(b.ofs + (most - b.utolso) * 0.001, most - m.ts); b.utolso = most;
    const mm = b.minta;
    if (mm.length && m.ts <= mm[mm.length - 1].t) return;   // sorrenden kívüli csomag
    mm.push({ t: m.ts, x: m.x, y: m.y, z: m.z, yaw: m.ya, pitch: m.pi });
    while (mm.length > 2 && mm[0].t < m.ts - 1000) mm.shift();
  }

  // ------------------------------------------------------------ a HostMag kimenetei
  _mindenkinek(o) { this._kuldNyers({ t: 'm', m: o }); }
  _neki(ki, o) {
    if (ki === this.te) { if (o.t === 'ce') this._jelez(o.e); return; }
    this._kuldNyers({ t: 'n', ki, m: o });
  }
  _relenek(o) { this._kuldNyers(o); }
  _valasz(ki, id, r) { if (ki === this.te) this._felold(id, r); else this._neki(ki, { t: 'v', id, r }); }
  _coopEsemeny(e, kiknek) { for (const k of new Set(kiknek)) { if (k === this.te) this._jelez(e); else this._neki(k, { t: 'ce', e }); } }
  _metaHelyben(m) { this.meta = { berlet: m.berlet ?? null, alvas: m.alvas ?? null }; this._jelez({ type: 'meta', ...this.meta }); }
  _jelez(e) { for (const f of this._figyelok) { try { f(e); } catch (x) { console.error('[coop]', x); } } }
}

export { HANGOLAS } from './protokoll.js';
