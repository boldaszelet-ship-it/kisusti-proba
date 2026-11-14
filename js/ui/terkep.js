// Kisüsti UI — a térkép canvasra: régiók (nyitott/zárt), utak, folyó, ingatlanok, üzletek, beszállítók, rendelések, szállítmányok,
// a fehér autó és a játékos. Megsárgult papír, barna tinta: mintha a kesztyűtartóból került volna elő.
import { REGIONS, ROADS, NODES, PROPERTIES, BUSINESSES, SUPPLIERS, RIVER, BOUNDS } from '../../data/regions.js';
import { RANGOK } from '../../data/tartalom.js';
import { esc, ora, tartam, cikkNev } from './kozos.js';
import { sor } from './elemek.js';
import { ikon } from './ikonok.js';

const REGIO_SZIN = { tanya: [196, 140, 64], falu: [190, 96, 60], felveg: [120, 150, 90], szolohegy: [128, 78, 120], major: [130, 116, 92], kisvaros: [86, 104, 124] };
const TINTA = '#3a2414';
let papirMinta = null;

/** A térkép célpontjai listába (a telefonos és a nagy térkép oldalsávja). */
export function terkepCelok(ui) {
  const S = ui.S, most = ui.E.now(), out = [];
  for (const r of [...S.rendelesek].sort((a, b) => (b.allapot === 'elfogadva') - (a.allapot === 'elfogadva') || a.ablak[1] - b.ablak[1])) {
    out.push({ k: 'r:' + r.id, tipus: r.allapot === 'elfogadva' ? 'rend' : 'rendu', nev: r.nev, al: `${r.helyNev} · ${ora(r.ablak[0])}–${ora(r.ablak[1])}`, pos: r.pos,
      jobb: `<b data-cd="${r.ablak[1]}" data-elo=""></b>` });
  }
  for (const d of S.szallitmanyok) out.push({ k: 'd:' + d.id, tipus: 'szall', nev: `${d.db} × ${cikkNev(d.tetel)}`, al: d.helyNev, pos: d.pos, jobb: d.allapot === 'megerkezett' ? 'megjött' : ora(d.erkezes) });
  for (const p of S.ingatlanok.filter(p => p.owned)) out.push({ k: 'p:' + p.id, tipus: 'ing', nev: p.nev, al: p.fust ? 'füstöl a kémény' : 'a tiéd', pos: p.pos });
  for (const j of S.jarorok || []) out.push({ k: 'j:' + j.id, tipus: 'jaror', nev: 'Fehér autó', al: 'a pénzügyőr járőrözik', pos: j.pos });
  return out;
}

function papir(ctx) {
  if (!papirMinta) {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#e8d9b3'; g.fillRect(0, 0, 160, 160);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,90,50' : '255,250,235'},${0.04 + r() * 0.06})`; g.fillRect(r() * 160, r() * 160, 1 + r() * 2, 1 + r() * 2); }
    papirMinta = ctx.createPattern(c, 'repeat');
  }
  return papirMinta;
}

/** Rajzolás. o = {kiemel: 'r:<id>'|'p:<id>'…, kicsi: bool}. A vászon a CSS-mérete szerint, élesen (dpr). */
export function rajzolTerkep(canvas, ui, o = {}) {
  const S = ui.S, dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fs = parseFloat(getComputedStyle(canvas).fontSize) || 16;
  const pad = fs * 0.8;
  // a kis térkép a játékosra és a kiemelt/vállalt célokra nagyít (legalább 360 m), a nagy a teljes vidéket mutatja
  let B = BOUNDS;
  if (o.kicsi) {
    const pp = ui.jatekosPos(S), pts = [pp];
    const kc = o.kiemel && terkepCelok(ui).find(c => c.k === o.kiemel); if (kc?.pos) pts.push(kc.pos);
    for (const r of S.rendelesek) if (r.allapot === 'elfogadva') pts.push(r.pos);
    let x0 = Math.min(...pts.map(p => p[0])) - 70, x1 = Math.max(...pts.map(p => p[0])) + 70, z0 = Math.min(...pts.map(p => p[1])) - 70, z1 = Math.max(...pts.map(p => p[1])) + 70;
    const min = 360;
    if (x1 - x0 < min) { const c = (x0 + x1) / 2; x0 = c - min / 2; x1 = c + min / 2; }
    if (z1 - z0 < min * H / W) { const c = (z0 + z1) / 2; z0 = c - min * H / W / 2; z1 = c + min * H / W / 2; }
    B = { x0, x1, z0, z1 };
  }
  const bw = B.x1 - B.x0, bh = B.z1 - B.z0;
  const k = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
  const ox = (W - bw * k) / 2 - B.x0 * k, oz = (H - bh * k) / 2 - B.z0 * k;
  const X = x => ox + x * k, Z = z => oz + z * k;

  // papír
  ctx.fillStyle = papir(ctx); ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,55,20,0.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // régiók
  for (const R of REGIONS) {
    const reg = S.regiok.find(x => x.id === R.id), [r, g, b] = REGIO_SZIN[R.id];
    const cx = X(R.center[0]), cz = Z(R.center[1]), rr = R.r * k * 1.15;
    const gr = ctx.createRadialGradient(cx, cz, rr * 0.2, cx, cz, rr);
    const a = reg?.nyitva ? 0.42 : 0.16;
    gr.addColorStop(0, `rgba(${r},${g},${b},${a})`); gr.addColorStop(0.75, `rgba(${r},${g},${b},${a * 0.7})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cz, rr, 0, Math.PI * 2); ctx.fill();
    if (!reg?.nyitva) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cz, rr * 0.86, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(58,36,20,0.28)'; ctx.lineWidth = 1;
      for (let i = -rr * 2; i < rr * 2; i += 6) { ctx.beginPath(); ctx.moveTo(cx + i, cz - rr); ctx.lineTo(cx + i + rr * 2, cz + rr); ctx.stroke(); }
      ctx.restore();
    }
    // gyanúgyűrű (a nyitott régióké): a peremen vörösödő ív
    if (reg?.nyitva && reg.gyanu > 0) {
      ctx.strokeStyle = reg.gyanu >= 60 ? 'rgba(170,30,20,0.85)' : reg.gyanu >= 40 ? 'rgba(190,110,20,0.8)' : 'rgba(90,60,30,0.45)';
      ctx.lineWidth = Math.max(2, fs * 0.16);
      ctx.beginPath(); ctx.arc(cx, cz, rr * 0.88, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, reg.gyanu / 100)); ctx.stroke();
    }
  }
  // folyó
  ctx.strokeStyle = 'rgba(70,110,130,0.55)'; ctx.lineWidth = RIVER.width * k * 0.9; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let z = BOUNDS.z0; z <= BOUNDS.z1; z += 10) { const x = RIVER.x + Math.sin(z * 0.012) * 14; z === BOUNDS.z0 ? ctx.moveTo(X(x), Z(z)) : ctx.lineTo(X(x), Z(z)); }
  ctx.stroke();
  // utak: sötét szegély, világos belső
  for (const [w, c] of [[Math.max(3, fs * 0.36), 'rgba(58,36,20,0.75)'], [Math.max(1.5, fs * 0.18), '#f3e6c4']]) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const [a, b] of ROADS) { const p = NODES[a], q = NODES[b]; ctx.moveTo(X(p[0]), Z(p[1])); ctx.lineTo(X(q[0]), Z(q[1])); }
    ctx.stroke();
  }
  // régiónevek
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const R of REGIONS) {
    const reg = S.regiok.find(x => x.id === R.id);
    const cx = X(R.center[0]), cz = Z(R.center[1]) - R.r * k * 0.8;
    ctx.font = `600 ${fs * (o.kicsi ? 0.94 : 1.05)}px Georgia, "Iowan Old Style", serif`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(240,228,196,0.92)'; ctx.fillStyle = reg?.nyitva ? TINTA : 'rgba(58,36,20,0.6)';
    const nev = o.kicsi ? R.nev.replace('Nagyapa tanyája', 'Tanya').replace('A régi major', 'Major') : R.nev;
    ctx.strokeText(nev, cx, cz); ctx.fillText(nev, cx, cz);
    if (!reg?.nyitva && !o.kicsi) {
      ctx.font = `italic ${fs * 0.94}px Georgia, serif`;
      ctx.strokeText(`${RANGOK[R.rank]} rangtól`, cx, cz + fs * 1.15); ctx.fillText(`${RANGOK[R.rank]} rangtól`, cx, cz + fs * 1.15);
    }
  }
  const kiem = o.kiemel, kesobb = [];
  /** Felirat papírcetlin (az út és a jelek nem futnak át rajta). */
  const cetli = (t, x, y, szin, igazit = 'left') => {
    ctx.font = `600 ${fs * 0.94}px system-ui, sans-serif`;
    const w = ctx.measureText(t).width, h = fs * 1.25, x0 = igazit === 'left' ? x : x - w - fs * 0.5;
    ctx.fillStyle = '#f4e8c8'; ctx.strokeStyle = 'rgba(58,36,20,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x0, y - h / 2, w + fs * 0.5, h, fs * 0.25); ctx.fill(); ctx.stroke();
    ctx.fillStyle = szin; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x0 + fs * 0.25, y + 1);
    ctx.textAlign = 'center';
  };
  const jel = (x, z, fn, kulcs, felirat) => {
    const px = X(x), pz = Z(z), on = kiem && kiem === kulcs;
    if (on) {
      ctx.strokeStyle = '#a3241a'; ctx.lineWidth = 2.5;
      const t = (performance.now() / 600) % 1;
      ctx.globalAlpha = 1 - t; ctx.beginPath(); ctx.arc(px, pz, fs * (0.7 + t * 0.9), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(px, pz, fs * 0.75, 0, Math.PI * 2); ctx.stroke();
    }
    fn(px, pz, on);
    if (felirat && (on || (kulcs.startsWith('j:') && !o.kicsi))) kesobb.push((jx, jz) => cetli(felirat, px + fs * 0.9, Math.hypot(px - jx, pz - jz) < fs * 4 ? pz - fs * 1.7 : pz, on ? '#7a1a10' : TINTA));
  };
  const s = fs * (o.kicsi ? 0.42 : 0.5);
  // ingatlanok: ház
  for (const P of PROPERTIES) {
    const p = S.ingatlanok.find(x => x.id === P.id);
    jel(P.pos[0], P.pos[1], (x, z) => {
      ctx.beginPath(); ctx.moveTo(x - s, z + s * 0.9); ctx.lineTo(x - s, z - s * 0.1); ctx.lineTo(x, z - s * 1.1); ctx.lineTo(x + s, z - s * 0.1); ctx.lineTo(x + s, z + s * 0.9); ctx.closePath();
      ctx.fillStyle = p?.owned ? '#b8733a' : 'rgba(240,228,196,0.9)'; ctx.fill(); ctx.strokeStyle = TINTA; ctx.lineWidth = 1.6; ctx.stroke();
      if (p?.fust) { ctx.strokeStyle = 'rgba(70,60,55,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + s * 0.5, z - s); ctx.bezierCurveTo(x + s * 1.2, z - s * 2, x, z - s * 2.4, x + s * 0.9, z - s * 3.2); ctx.stroke(); }
    }, 'p:' + P.id, P.nev);
  }
  // üzletek: érme
  for (const B of BUSINESSES) {
    const b = S.uzletek.find(x => x.id === B.id);
    jel(B.pos[0], B.pos[1], (x, z) => { ctx.beginPath(); ctx.arc(x, z, s * 0.75, 0, Math.PI * 2); ctx.fillStyle = b?.sajat ? '#e0a63a' : 'rgba(240,228,196,0.9)'; ctx.fill(); ctx.strokeStyle = TINTA; ctx.lineWidth = 1.4; ctx.stroke(); }, 'b:' + B.id, B.nev);
  }
  // beszállítók: láda
  for (const SP of SUPPLIERS) jel(SP.pos[0], SP.pos[1], (x, z) => { ctx.fillStyle = 'rgba(240,228,196,0.95)'; ctx.fillRect(x - s * 0.7, z - s * 0.7, s * 1.4, s * 1.4); ctx.strokeStyle = TINTA; ctx.lineWidth = 1.4; ctx.strokeRect(x - s * 0.7, z - s * 0.7, s * 1.4, s * 1.4); ctx.beginPath(); ctx.moveTo(x - s * 0.7, z); ctx.lineTo(x + s * 0.7, z); ctx.stroke(); }, 's:' + SP.id, SP.nev);
  // szállítmányok: borostyán doboz
  for (const d of S.szallitmanyok) jel(d.pos[0], d.pos[1], (x, z) => { ctx.fillStyle = d.allapot === 'megerkezett' ? '#e8a23a' : 'rgba(232,162,58,0.45)'; ctx.fillRect(x - s * 0.8, z - s * 0.8, s * 1.6, s * 1.6); ctx.strokeStyle = TINTA; ctx.lineWidth = 1.6; ctx.strokeRect(x - s * 0.8, z - s * 0.8, s * 1.6, s * 1.6); }, 'd:' + d.id, cikkNev(d.tetel));
  // rendelések: tű (vállalt: tömör vörös, új: üres)
  for (const r of S.rendelesek) jel(r.pos[0], r.pos[1], (x, z) => {
    const v = r.allapot === 'elfogadva';
    ctx.beginPath(); ctx.moveTo(x, z); ctx.bezierCurveTo(x - s * 1.3, z - s * 1.6, x - s * 0.9, z - s * 2.9, x, z - s * 2.9); ctx.bezierCurveTo(x + s * 0.9, z - s * 2.9, x + s * 1.3, z - s * 1.6, x, z);
    ctx.fillStyle = v ? '#b0281c' : 'rgba(240,228,196,0.95)'; ctx.fill(); ctx.strokeStyle = v ? '#4a0f08' : '#b0281c'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, z - s * 1.95, s * 0.38, 0, Math.PI * 2); ctx.fillStyle = v ? '#f3e6c4' : '#b0281c'; ctx.fill();
  }, 'r:' + r.id, `${r.nev.split(',')[0]} · ${ora(r.ablak[1])}-ig`);
  // járőr: fehér autó + előtte az útja szaggatva
  for (const j of S.jarorok || []) {
    if (!j.pos) continue;
    const elore = (j.pts || []).filter((p, i) => j.t?.[i] > S.ido.perc);
    if (elore.length) { ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(160,30,20,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(j.pos[0]), Z(j.pos[1])); for (const p of elore) ctx.lineTo(X(p[0]), Z(p[1])); ctx.stroke(); ctx.setLineDash([]); }
    jel(j.pos[0], j.pos[1], (x, z) => { ctx.fillStyle = '#fbfbf6'; ctx.strokeStyle = '#7a1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - s * 1.1, z - s * 0.65, s * 2.2, s * 1.3, s * 0.35); ctx.fill(); ctx.stroke(); }, 'j:' + j.id, o.kicsi ? null : 'pénzügyőr');
  }
  // játékos
  const pp = ui.jatekosPos(S);
  const px = X(pp[0]), pz = Z(pp[1]), t = (performance.now() / 900) % 1;
  ctx.strokeStyle = `rgba(30,90,60,${0.8 * (1 - t)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, pz, s * (1.2 + t * 2), 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(px, pz, s * 0.95, 0, Math.PI * 2); ctx.fillStyle = '#2f7a4f'; ctx.fill(); ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 2.4; ctx.stroke();
  cetli('Te', px - s * 1.6, pz + s * 1.6, '#1e5a3a', 'right');
  for (const f of kesobb) f(px, pz);
  // szélrózsa és lépték
  if (!o.kicsi) {
    const cx = W - fs * 2.2, cy = fs * 2.4;
    ctx.strokeStyle = TINTA; ctx.fillStyle = TINTA; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy - fs * 1.2); ctx.lineTo(cx + fs * 0.35, cy); ctx.lineTo(cx, cy + fs * 0.9); ctx.lineTo(cx - fs * 0.35, cy); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - fs * 1.2); ctx.lineTo(cx + fs * 0.35, cy); ctx.lineTo(cx - fs * 0.35, cy); ctx.closePath(); ctx.fill();
    ctx.font = `700 ${fs}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('É', cx, cy - fs * 1.85);
    const m = 100 * k, lx = fs * 1.2, ly = H - fs * 1.3;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + m, ly); ctx.moveTo(lx, ly - 5); ctx.lineTo(lx, ly + 5); ctx.moveTo(lx + m, ly - 5); ctx.lineTo(lx + m, ly + 5); ctx.stroke();
    ctx.font = `${fs * 0.94}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('100 m', lx + m + 8, ly + 1);
  }
}

/** A nagy térkép (munkapad-keretben): bal oldalt a térkép, jobbra a célpontok és a jelmagyarázat. */
export function nagyTerkepLap(arg = {}) {
  return {
    fajta: 'panel', nev: 'terkep-nagy', cim: 'Térkép', al: 'Kisüstfalva és környéke, 1 : „ahogy nagyapa rajzolta”', kiemel: arg.kiemel || null, live: 0.5,
    html(ui) {
      const cel = terkepCelok(ui);
      const jm = [['rend', 'vállalt rendelés'], ['rendu', 'új rendelés'], ['szall', 'szállítmány'], ['ing', 'ingatlan'], ['uzl', 'üzlet'], ['besz', 'beszállító'], ['jaror', 'pénzügyőr'], ['te', 'te']];
      return `<div class="ku-nt"><div class="ku-nt-terkep"><canvas class="ku-tkp-c"></canvas></div>
        <div class="ku-nt-old"><div class="ku-gorget" data-gorget="nt">${cel.map((c, i) => sor('cel', c.k, `<span class="ku-jelzo ${c.tipus}"></span><b>${esc(c.nev)}</b><small>${esc(c.al)}</small>`, c.jobb || '', '', i === 0 ? 'data-elso' : '')).join('') || '<div class="ku-ures">Nincs kijelölt cél.</div>'}</div>
        <div class="ku-jm">${jm.map(([k, t]) => `<span><i class="ku-jelzo ${k}"></i>${t}</span>`).join('')}</div></div></div>`;
    },
    utan(ui, el) { const c = el.querySelector('canvas'); if (c) rajzolTerkep(c, ui, { kiemel: this.kiemel }); },
    tick(ui) { const c = ui.modal?.lapEl.querySelector('canvas'); if (c && this.kiemel) rajzolTerkep(c, ui, { kiemel: this.kiemel }); },
    fokusz(a, v, ui) { if (a === 'cel') { this.kiemel = v; const c = ui.modal.lapEl.querySelector('canvas'); if (c) rajzolTerkep(c, ui, { kiemel: v }); } },
    act() { return false; },
  };
}
export { ikon, tartam };
