// Kisüsti — hangmotor (WebAudio). Tulajdonos: A (Audio Lead), lásd TERV-v3.md.
//
// Minden hang procedurális: a hangmintákat a böngésző számolja ki első használatkor (mintaszintű DSP:
// modális rezonátorok, Minnaert-buborékok, szűrt zajszemcsék, harmonikus források formánsokkal), a hurkok
// élő WebAudio-gráfok és ütemezett szemcsék. Külső hangfájl nincs, licenckockázat nincs.
//
// API (az integrátor köti be):
//   import { Hang } from './js/hang.js';
//   const H = new Hang();            H.unlock()                 // első kattintásra
//   H.play(id, {pos, vol, pitch})    → {stop()}                 // egyszeri hang
//   H.loop(id, {pos, vol, pitch, …}) → handle                   // handle.set({vol, pitch, pos, …}), handle.stop()
//   H.listener(camera)                                          // térbeli hallgató (matrixWorld-ből olvas)
//   H.ambient({napszak:0..1, regio, eso:false})                 // környezeti réteg; napszak 0 = éjfél, 0.5 = dél
//   H.master(vol) · H.mute(bool) · H.esemeny(evt)              // evt: a sim eseménye ({type:'sfx', id, pos?} stb.)
//   H.lepes(felulet, {pos})          felulet: 'fu' | 'fold' | 'aszfalt' | 'fa'
//   H.jelenet('penzugyor', {pos, from})                         // közeledő autó, fékezés, motor le, ajtó, lépések
//
// pos: [x, y, z] méterben, [x, z] (y = 1,2 m), {x, y, z} (THREE.Vector3) vagy Object3D (a világmátrixát követi).

const TAU = Math.PI * 2;
const LOOK = 0.2;                        // ütemezési előretekintés (s)
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const dB = d => Math.pow(10, d / 20);
const sm = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };

export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ───────────────────────── mintaszintű DSP ─────────────────────────

const B = (sr, sec) => new Float32Array(Math.max(1, Math.ceil(sec * sr)));

function coef(type, f, Q, sr) {
  const w = TAU * Math.min(Math.max(f, 10), sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }                          // sáváteresztő, 0 dB csúcs
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function filt(x, type, f, Q, sr) {
  const [b0, b1, b2, a1, a2] = coef(type, f, Q || 0.707, sr);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i], y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
function add(out, x, n0, g = 1) {
  for (let i = 0; i < x.length; i++) { const j = n0 + i; if (j >= 0 && j < out.length) out[j] += g * x[i]; }
}
function fadeOut(x, sr, sec) {
  const m = Math.min(x.length, Math.ceil(sec * sr));
  for (let i = 0; i < m; i++) x[x.length - 1 - i] *= i / m;
}
function rmsOf(x, n = x.length) { let s = 0; for (let i = 0; i < n; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, n)); }

/** Csillapodó szinusz (megütött tárgy egy módusa). */
function ring(out, sr, t0, f, amp, tau, att = 0.0006, ph0 = 0) {
  const n0 = Math.floor(t0 * sr); if (n0 >= out.length || f >= sr * 0.47) return;
  const len = Math.min(out.length - n0, Math.ceil(tau * 7 * sr)), w = TAU * f / sr, k = Math.exp(-1 / (tau * sr)), na = Math.max(1, att * sr);
  let e = amp;
  for (let i = 0; i < len; i++) { if (n0 + i >= 0) out[n0 + i] += (i < na ? i / na : 1) * e * Math.sin(w * i + ph0); e *= k; }
}
/** Mélyülő hangmagasságú puffanás (test, ajtó, dob). */
function thump(out, sr, t0, f0, f1, amp, tau) {
  const n0 = Math.floor(t0 * sr); if (n0 < 0 || n0 >= out.length) return;
  const len = Math.min(out.length - n0, Math.ceil(tau * 7 * sr)), k = Math.exp(-1 / (tau * sr)), na = Math.max(1, 0.001 * sr);
  let ph = 0, e = amp;
  for (let i = 0; i < len; i++) {
    const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t / (tau * 0.5));
    ph += TAU * f / sr; out[n0 + i] += (i < na ? i / na : 1) * e * Math.sin(ph); e *= k;
  }
}
/** Minnaert-buborék: emelkedő hangmagasságú csillapodó szinusz (víz, forrás, csepp, eső). */
function bubble(out, sr, t0, f0, amp, tau, rise) {
  const n0 = Math.floor(t0 * sr); if (n0 < 0 || n0 >= out.length) return;
  const len = Math.min(out.length - n0, Math.ceil(tau * 6 * sr)), k = Math.exp(-1 / (tau * sr)), na = Math.max(1, 0.0004 * sr);
  let ph = 0, e = amp;
  for (let i = 0; i < len; i++) {
    const f = f0 * (1 + rise * (i / sr) / tau); if (f > sr * 0.45) break;
    ph += TAU * f / sr; out[n0 + i] += (i < na ? i / na : 1) * e * Math.sin(ph); e *= k;
  }
}
/** Szűrt zajlöket. Az amp a szűrés utáni, a szűrés előttire visszaskálázott szint (így a szűrő nem halkít). */
function burstF(out, sr, R, t0, dur, amp, tau, filters = [], att = 0.0004) {
  const n = Math.ceil(Math.max(dur, tau * 6) * sr), pad = Math.ceil(0.006 * sr), x = new Float32Array(n + pad);
  const na = Math.max(1, att * sr), k = Math.exp(-1 / (tau * sr));
  let e = 1; for (let i = 0; i < n; i++) { x[i] = (R() * 2 - 1) * e * (i < na ? i / na : 1); e *= k; }
  shapeFilters(x, n, filters, sr); fadeOut(x, sr, 0.004); add(out, x, Math.floor(t0 * sr), amp);
}
/** Hann-ablakos zajszemcse (zizegés, ropogás, kavics). */
function grainF(out, sr, R, t0, dur, amp, filters = []) {
  const n = Math.max(8, Math.ceil(dur * sr)), pad = Math.ceil(0.006 * sr), x = new Float32Array(n + pad);
  for (let i = 0; i < n; i++) { const w = Math.sin(Math.PI * i / n); x[i] = (R() * 2 - 1) * w * w; }
  shapeFilters(x, n, filters, sr); fadeOut(x, sr, 0.004); add(out, x, Math.floor(t0 * sr), amp);
}
function shapeFilters(x, n, filters, sr) {
  if (!filters.length) return;
  const r0 = rmsOf(x, n);
  for (const [ty, f, Q] of filters) filt(x, ty, f, Q, sr);
  const r1 = rmsOf(x, n);
  if (r1 > 1e-9) { const g = Math.min(20, r0 / r1); for (let i = 0; i < x.length; i++) x[i] *= g; }
}
/** Rezonátor (kétpólusú) gerjesztésre — a nyikorgáshoz, brekegéshez, zsivajhoz. out += amp · rez(x) */
function reson(x, f, tau, sr, out, amp = 1) {
  const r = Math.exp(-1 / (tau * sr)), w = TAU * f / sr, c1 = 2 * r * Math.cos(w), c2 = -r * r, g = Math.sin(w) * amp;
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = x[i] + c1 * y1 + c2 * y2; y2 = y1; y1 = y; out[i] += g * y; }
}
/** Sávkorlátos harmonikus forrás változó alaphanggal (hang, rézfúvós, ugatás). */
function harm(sr, dur, f0fn, ampfn, o = {}) {
  const n = Math.ceil(dur * sr), out = new Float32Array(n), maxH = o.maxH || 20, tilt = o.tilt ?? 1;
  const w = new Float32Array(maxH + 1); for (let h = 1; h <= maxH; h++) w[h] = 1 / Math.pow(h, tilt);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = f0fn(t); ph += TAU * f / sr; if (ph > TAU) ph -= TAU;
    const a = ampfn(t); if (a <= 0) continue;
    const H = Math.min(maxH, Math.floor(sr * 0.45 / f)); let s = 0;
    for (let h = 1; h <= H; h++) s += Math.sin(h * ph) * w[h];
    out[i] = a * s;
  }
  return out;
}
function formants(x, sr, list) {
  const out = new Float32Array(x.length);
  for (const [f, Q, g] of list) { const y = Float32Array.from(x); filt(y, 'bp', f, Q, sr); for (let i = 0; i < x.length; i++) out[i] += g * y[i]; }
  return out;
}
/** Tiszta hang csúszó magassággal (madár, tücsök, telefon). */
function tone(out, sr, t0, len, f0, f1, amp, o = {}) {
  const n0 = Math.floor(t0 * sr), n = Math.ceil(len * sr), edge = o.edge ? Math.max(1, o.edge * sr) : 0;
  let ph = 0;
  for (let i = 0; i < n && n0 + i < out.length; i++) {
    const u = i / n, t = i / sr;
    let f = f0 * Math.pow(f1 / f0, u); if (o.vib) f *= 1 + (o.vd || 0.02) * Math.sin(TAU * o.vib * t);
    ph += TAU * f / sr;
    const e = edge ? Math.min(1, i / edge, (n - i) / edge) : Math.pow(Math.sin(Math.PI * u), 0.7);
    if (n0 + i >= 0) out[n0 + i] += amp * e * (Math.sin(ph) + (o.h2 || 0) * Math.sin(2 * ph));
  }
}
/** Néhány tompított, késleltetett visszaverődés (udvar, terem, távolság). */
function echoes(x, sr, taps, lpf) {
  const src = Float32Array.from(x); filt(src, 'lp', lpf, 0.7, sr);
  for (const [d, g] of taps) { const n0 = Math.round(d * sr); for (let i = 0; i + n0 < x.length; i++) x[i + n0] += g * src[i]; }
}
/** Hurokvarrat: a puffer vége folytonosan fut át az elejébe (egyenletes teljesítményű áttűnés). */
function seamless(x, sr, D, XF) {
  const N = Math.round(D * sr), F = Math.round(XF * sr), y = new Float32Array(N);
  for (let i = 0; i < N; i++) y[i] = x[i];
  for (let i = 0; i < F; i++) { const w = (i / F) * Math.PI / 2; y[i] = x[i] * Math.sin(w) + x[N + i] * Math.cos(w); }
  return y;
}
function trim(x, sr) {
  let last = x.length - 1; while (last > 0 && Math.abs(x[last]) < 1e-4) last--;
  return x.slice(0, Math.min(x.length, last + Math.ceil(0.01 * sr)));
}
export function makeNoise(kind, sr, R) {
  const D = 6, XF = 0.3, n = Math.ceil((D + XF) * sr) + 1, x = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = R() * 2 - 1;
    if (kind === 'white') x[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else { last = (last + 0.02 * w) / 1.02; x[i] = last * 3.5; }
  }
  const g = 0.25 / Math.max(1e-6, rmsOf(x)); for (let i = 0; i < n; i++) x[i] *= g;
  return seamless(x, sr, D, XF);
}

/** Szintre hozás: a legerősebb 100 ms-os ablak RMS-e = a kategória célja; csúcs ≤ -1,2 dBFS.
 *  Ha a cél csúcsban többe kerülne, legfeljebb 4 dB-t lágy telítés (tanh) vesz el a tranziensből. */
const PEAK_CAP = 0.87;
function levelize(x, sr, targetDb, loop = false) {
  let peak = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  if (peak < 1e-9) return x;
  if (targetDb == null) { const g = PEAK_CAP / peak; for (let i = 0; i < x.length; i++) x[i] *= g; }
  else {
    const w = Math.max(1, Math.round(0.1 * sr)); let s = 0, best = 0;
    for (let i = 0; i < x.length; i++) { s += x[i] * x[i]; if (i >= w) s -= x[i - w] * x[i - w]; if (s > best) best = s; }
    const rms = Math.sqrt(Math.max(best / w, 1e-12));
    let g = dB(targetDb) / rms; const over = g * peak / PEAK_CAP;
    if (over <= 1) { for (let i = 0; i < x.length; i++) x[i] *= g; }
    else {
      const ov = Math.min(over, 1.585); g = g * ov / over;
      const th = Math.tanh(ov);
      for (let i = 0; i < x.length; i++) x[i] = PEAK_CAP * Math.tanh(g * x[i] / PEAK_CAP) / th;
    }
  }
  if (!loop) fadeOut(x, sr, 0.008);
  return x;
}

// ───────────────────────── hanggenerátorok ─────────────────────────
// Mindegyik: (sr, R, k) → Float32Array (monó). R: determinisztikus véletlen, k: változat sorszáma.

const VOW = [[730, 1100], [530, 1850], [300, 2250], [570, 850], [350, 750], [660, 1700], [450, 1500]];

const GEN = {
  // ── kezelőfelület ──
  ui_click(sr, R) {
    const x = B(sr, 0.07); let ph = 0; const na = 0.0004 * sr;
    for (let i = 0; i < x.length; i++) {
      const t = i / sr, f = 1900 - 650 * Math.min(1, t / 0.018); ph += TAU * f / sr;
      x[i] = 0.6 * Math.sin(ph) * Math.exp(-t / 0.006) * Math.min(1, i / na);
    }
    burstF(x, sr, R, 0, 0.004, 0.35, 0.0012, [['hp', 3000, 0.7]]);
    ring(x, sr, 0, 480 + R() * 40, 0.25, 0.01);
    return x;
  },

  // ── üveg, palack, ital ──
  uveg(sr, R) {   // két pálinkáspohár koccan: két, kissé eltérő hangolású üveg lebeg együtt
    const x = B(sr, 2.0), f0 = 2500 + R() * 700, r = [1, 2.32, 4.25, 6.63], a = [1, 0.45, 0.22, 0.1], tu = [0.36, 0.18, 0.09, 0.05];
    for (let k = 0; k < 4; k++) ring(x, sr, 0, f0 * r[k] * (1 + (R() - 0.5) * 0.01), a[k], tu[k] * (0.8 + 0.4 * R()), 0.0004, R() * TAU);
    const f1 = f0 * (1.05 + R() * 0.06), dt = 0.0015 * R();
    for (let k = 0; k < 4; k++) ring(x, sr, dt, f1 * r[k], a[k] * 0.7, tu[k] * 0.9, 0.0004, R() * TAU);
    burstF(x, sr, R, 0, 0.003, 0.5, 0.001, [['hp', 2500, 0.7]]);
    fadeOut(x, sr, 0.3);
    return x;
  },
  dugo(sr, R) {   // a dugó csikorogva becsúszik a nyakba, aztán tompán a helyére ül
    const x = B(sr, 0.5), n = Math.ceil(0.2 * sr), sq = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, f = 780 + 520 * (t / 0.2) + 40 * Math.sin(TAU * 31 * t); ph += TAU * f / sr;
      const am = Math.pow(0.5 + 0.5 * Math.sin(TAU * 52 * t + R() * 0.3), 2), env = Math.sin(Math.PI * t / 0.2);
      sq[i] = (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.25 * (R() * 2 - 1)) * am * env;
    }
    filt(sq, 'bp', 1150, 2.5, sr); add(x, sq, 0, 2.0);
    const t1 = 0.21;
    ring(x, sr, t1, 150, 0.9, 0.03, 0.001); ring(x, sr, t1, 410 + R() * 40, 0.35, 0.035, 0.001);
    burstF(x, sr, R, t1, 0.03, 0.6, 0.006, [['lp', 2200, 0.7]]);
    return x;
  },
  dugo_ki(sr, R) {   // dugó ki: Helmholtz-pukkanás
    const x = B(sr, 0.3); let ph = 0; const na = 0.0003 * sr;
    for (let i = 0; i < 0.12 * sr; i++) {
      const t = i / sr, f = 950 * Math.exp(-t / 0.02) + 340; ph += TAU * f / sr;
      x[i] += 0.9 * Math.sin(ph) * Math.exp(-t / 0.022) * Math.min(1, i / na);
    }
    burstF(x, sr, R, 0, 0.008, 0.6, 0.002, [['lp', 4000, 0.7]]);
    burstF(x, sr, R, 0.004, 0.12, 0.18, 0.03, [['bp', 620, 3]]);
    return x;
  },
  toltes(sr, R) {   // töltés pohárba: sugár + buborékok, a hangmagasság a telítődéssel emelkedik
    const D = 1.7, x = B(sr, D + 0.35), st = new Float32Array(x.length);
    for (let i = 0; i < st.length; i++) st[i] = R() * 2 - 1;
    filt(st, 'bp', 1900, 1.0, sr); filt(st, 'lp', 4500, 0.7, sr);
    for (let i = 0; i < st.length; i++) {
      const t = i / sr, e = t < 0.06 ? t / 0.06 : t < D - 0.15 ? 1 : Math.max(0, (D - t) / 0.15);
      st[i] *= e * (0.75 + 0.25 * Math.sin(TAU * 7 * t + Math.sin(TAU * 2.3 * t)));
    }
    add(x, st, 0, 0.5);
    let t = 0.02;
    while (t < D - 0.05) {
      const fill = t / D, f0 = (700 + R() * 900) * (1 + 0.7 * fill), tau = 0.012 * Math.pow(900 / f0, 0.7) + 0.003 * R();
      bubble(x, sr, t, f0, 0.25 + 0.75 * R() * R(), tau, 0.15); t += -Math.log(1 - R()) / 40;
    }
    for (let k = 0; k < 3; k++) bubble(x, sr, D + 0.03 + k * 0.07 + R() * 0.03, 1800 + R() * 500, 0.3, 0.008, 0.4);
    return x;
  },
  vodor(sr, R) {   // fémvödör fogója koccan, a víz kizúdul, buborékok, utócseppek
    const x = B(sr, 1.9), mf = [780, 1870, 3240];
    for (let k = 0; k < 3; k++) ring(x, sr, 0, mf[k] * (1 + 0.02 * (R() - 0.5)), [0.35, 0.2, 0.1][k], [0.12, 0.08, 0.05][k], 0.0006, R() * TAU);
    const g = new Float32Array(x.length); for (let i = 0; i < g.length; i++) g[i] = R() * 2 - 1;
    filt(g, 'lp', 1600, 0.6, sr); filt(g, 'hp', 120, 0.7, sr);
    for (let i = 0; i < g.length; i++) { const t = i / sr; g[i] *= t < 0.12 ? 0 : t < 0.3 ? (t - 0.12) / 0.18 : Math.exp(-(t - 0.3) / 0.45); }
    add(x, g, 0, 1.6);
    let t = 0.13;
    while (t < 1.4) {
      const dens = t < 0.35 ? 90 : 90 * Math.exp(-(t - 0.35) / 0.35) + 6;
      bubble(x, sr, t, 220 + R() * 700, 0.2 + 0.8 * R() * R(), 0.02 + 0.02 * R(), 0.12); t += -Math.log(1 - R()) / dens;
    }
    for (let k = 0; k < 4; k++) bubble(x, sr, 1.3 + k * 0.11 + R() * 0.05, 1200 + R() * 900, 0.25, 0.009, 0.4);
    fadeOut(x, sr, 0.4);
    return x;
  },

  // ── kert, pince ──
  gyumolcs(sr, R) {   // levélzizegés, a kocsány pattan, a szem a tenyérbe/kosárba puffan
    const x = B(sr, 0.6);
    for (let k = 0; k < 14; k++) grainF(x, sr, R, R() * 0.22, 0.008 + R() * 0.02, 0.15 + 0.25 * R(), [['hp', 1800, 0.7], ['lp', 7000, 0.7]]);
    burstF(x, sr, R, 0.13, 0.005, 0.9, 0.0012, [['bp', 2800, 1.2]]);
    burstF(x, sr, R, 0.137, 0.004, 0.45, 0.001, [['bp', 3600, 1.2]]);
    const tt = 0.33 + R() * 0.04;
    thump(x, sr, tt, 115, 80, 0.5, 0.03);
    burstF(x, sr, R, tt, 0.05, 0.35, 0.012, [['lp', 500, 0.7]]);
    return x;
  },
  hordo(sr, R) {   // üres tölgyhordó kongása bütyökkel; egy vagy két koppintás
    const x = B(sr, 1.6), f0 = 92 + R() * 12, r = [1, 1.58, 2.13, 2.92, 3.61, 5.07], a = [1, 0.6, 0.42, 0.3, 0.18, 0.1], tu = [0.3, 0.22, 0.15, 0.1, 0.07, 0.04];
    const hits = R() < 0.5 ? [0] : [0, 0.17 + R() * 0.04];
    hits.forEach((h, j) => {
      const A = j ? 0.75 : 1;
      for (let k = 0; k < 6; k++) ring(x, sr, h, f0 * r[k], a[k] * A, tu[k], 0.001, R() * TAU);
      burstF(x, sr, R, h, 0.02, 0.5 * A, 0.004, [['lp', 2400, 0.7]]);
    });
    fadeOut(x, sr, 0.3);
    return x;
  },
  hordo_fedel(sr, R) {   // fafedél csúszik a peremen, aztán a helyére koppan
    const x = B(sr, 0.75), n = Math.ceil(0.3 * sr), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / sr; s[i] = (R() * 2 - 1) * Math.sin(Math.PI * t / 0.3) * (0.6 + 0.4 * Math.sin(TAU * (18 + 10 * t) * t)) * (0.7 + 0.3 * R()); }
    filt(s, 'bp', 650, 1.6, sr); filt(s, 'lp', 2500, 0.7, sr);
    add(x, s, 0, 3.0);
    const t1 = 0.32, wf = [165, 305, 540, 880];
    for (let k = 0; k < 4; k++) ring(x, sr, t1, wf[k] * (1 + 0.03 * (R() - 0.5)), [0.9, 0.5, 0.3, 0.15][k], [0.07, 0.05, 0.035, 0.02][k], 0.0008, R() * TAU);
    burstF(x, sr, R, t1, 0.04, 0.6, 0.008, [['lp', 1800, 0.7]]);
    return x;
  },
  kapu(sr, R) {   // vaskapu: súrlódó pánt (tapadó–csúszó impulzussor rezonátorokon), a végén a retesz csattan
    const D = 1.15, x = B(sr, 3.4), ex = new Float32Array(Math.ceil(D * sr)); let ph = 0;
    for (let i = 0; i < ex.length; i++) {
      const t = i / sr, u = t / D;
      const rate = (140 + 300 * Math.sin(Math.PI * Math.pow(u, 0.8)) + 40 * Math.sin(TAU * 3.1 * t)) * (1 + 0.08 * (R() - 0.5));
      ph += rate / sr;
      if (ph >= 1) { ph -= 1; ex[i] = (0.7 + 0.3 * R()) * Math.sin(Math.PI * Math.min(1, u * 1.05)); }
    }
    const cr = new Float32Array(ex.length), rf = [640, 1180, 1720, 2650, 3400], ra = [1, 0.8, 0.5, 0.35, 0.2];
    for (let k = 0; k < 5; k++) reson(ex, rf[k] * (1 + 0.02 * (R() - 0.5)), 0.025, sr, cr, ra[k]);
    const g = 1 / Math.max(1e-6, rmsOf(cr)) * 0.12; for (let i = 0; i < cr.length; i++) cr[i] *= g;
    add(x, cr, 0, 1);
    const tc = D + 0.05, mf = [310, 745, 1360, 2190, 3120], ma = [1, 0.7, 0.5, 0.3, 0.15], mt = [0.5, 0.36, 0.24, 0.14, 0.08];
    for (let k = 0; k < 5; k++) ring(x, sr, tc, mf[k] * (1 + 0.01 * (R() - 0.5)), ma[k] * 0.5, mt[k], 0.0005, R() * TAU);
    burstF(x, sr, R, tc, 0.01, 0.5, 0.004, [['bp', 2500, 0.8]]);
    [0.035, 0.06].forEach((d, j) => {
      for (let k = 0; k < 3; k++) ring(x, sr, tc + d, mf[k + 1] * 1.01, 0.12 / (j + 1), 0.05, 0.0005, R() * TAU);
      burstF(x, sr, R, tc + d, 0.004, 0.2 / (j + 1), 0.0015, [['bp', 3000, 1]]);
    });
    fadeOut(x, sr, 0.4);
    return x;
  },

  // ── vevő, pénz ──
  koszones(sr, R) {   // a kapu húzócsengője: kis sárgaréz csengő, három-négy ütés
    const x = B(sr, 3.2), f0 = 1150 + R() * 120, r = [1, 1.98, 2.74, 3.83, 5.4], a = [1, 0.35, 0.5, 0.22, 0.15], tu = [0.8, 0.5, 0.42, 0.26, 0.17];
    const hits = [0, 0.12 + R() * 0.03, 0.25 + R() * 0.04, 0.42 + R() * 0.05];
    hits.forEach((h, j) => {
      const A = [1, 0.8, 0.65, 0.4][j];
      for (let k = 0; k < 5; k++) ring(x, sr, h, f0 * r[k], a[k] * A, tu[k], 0.0006, R() * TAU);
      burstF(x, sr, R, h, 0.002, 0.25 * A, 0.0008, [['hp', 3000, 0.7]]);
    });
    fadeOut(x, sr, 0.6);
    return x;
  },
  penz_papir(sr, R) {   // bankjegyek: zizegő papírszemcsék, a végén pattintás
    const x = B(sr, 0.55);
    for (let k = 0; k < 28; k++) grainF(x, sr, R, R() * 0.36, 0.003 + R() * 0.01, Math.pow(R(), 1.8) * 0.8 + 0.05, [['bp', 2000 + R() * 4500, 1.4]]);
    const n = Math.ceil(0.4 * sr), w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = (R() * 2 - 1) * Math.pow(Math.sin(Math.PI * i / n), 2);
    filt(w, 'lp', 1500, 0.7, sr); filt(w, 'hp', 300, 0.7, sr); add(x, w, 0, 0.6);
    burstF(x, sr, R, 0.4, 0.004, 0.8, 0.003, [['bp', 1400, 0.9]]);
    burstF(x, sr, R, 0.402, 0.003, 0.4, 0.0015, [['hp', 4000, 0.7]]);
    return x;
  },
  penz_erme(sr, R) {   // 3–5 érme a tenyérbe/asztalra, pattanásokkal
    const x = B(sr, 1.1), nC = 3 + Math.floor(R() * 3); let t = 0.002;
    for (let c = 0; c < nC; c++) {
      const f0 = 3000 + R() * 1800, r = [1, 1.71, 2.46, 3.13], a = [1, 0.6, 0.4, 0.25], tu = [0.14, 0.1, 0.07, 0.045];
      const A = 0.5 + 0.5 * R(), nb = 1 + Math.floor(R() * 2);
      for (let b = 0; b < nb; b++) {
        const tb = t + b * (0.035 + R() * 0.02), Ab = A * Math.pow(0.45, b);
        for (let k = 0; k < 4; k++) ring(x, sr, tb, f0 * r[k], a[k] * Ab, tu[k] * (b ? 0.6 : 1), 0.0003, R() * TAU);
        burstF(x, sr, R, tb, 0.002, 0.4 * Ab, 0.0008, [['hp', 2500, 0.7]]);
      }
      t += 0.04 + R() * 0.07;
    }
    fadeOut(x, sr, 0.2);
    return x;
  },

  // ── lépések: egy lépés = sarok + talp ──
  lepes_fu(sr, R) {
    const x = B(sr, 0.3), hv = 0.8 + 0.2 * R();
    thump(x, sr, 0, 95, 70, 0.35 * hv, 0.03);
    burstF(x, sr, R, 0, 0.06, 0.4 * hv, 0.018, [['lp', 350, 0.7]]);
    for (let k = 0; k < 18; k++) {
      const t = k < 11 ? R() * 0.1 : 0.065 + R() * 0.12;
      grainF(x, sr, R, t, 0.006 + R() * 0.02, (0.08 + 0.25 * R() * R()) * (k < 11 ? 1 : 0.7), [['hp', 2200, 0.7], ['lp', 7500, 0.7]]);
    }
    burstF(x, sr, R, 0.07, 0.04, 0.2 * hv, 0.012, [['lp', 400, 0.7]]);
    return x;
  },
  lepes_fold(sr, R) {
    const x = B(sr, 0.25);
    thump(x, sr, 0, 110, 75, 0.5, 0.028);
    burstF(x, sr, R, 0, 0.05, 0.55, 0.014, [['lp', 450, 0.7]]);
    for (let k = 0; k < 12; k++) grainF(x, sr, R, R() * 0.06 + (k > 7 ? 0.06 : 0), 0.002 + R() * 0.005, 0.15 + 0.35 * R() * R(), [['bp', 1100 + R() * 1800, 1.2]]);
    thump(x, sr, 0.065, 120, 85, 0.25, 0.02);
    burstF(x, sr, R, 0.065, 0.04, 0.3, 0.01, [['lp', 600, 0.7]]);
    return x;
  },
  lepes_aszfalt(sr, R) {
    const x = B(sr, 0.25);
    burstF(x, sr, R, 0, 0.012, 0.8, 0.004, [['bp', 1500, 0.8]]);
    thump(x, sr, 0, 100, 80, 0.35, 0.02);
    burstF(x, sr, R, 0.012, 0.08, 0.12, 0.03, [['bp', 3200, 0.7]]);              // csoszogás
    for (let k = 0; k < 4; k++) grainF(x, sr, R, R() * 0.05, 0.002, 0.15 * R(), [['hp', 3000, 0.7]]);   // apró kavics
    const tt = 0.075 + R() * 0.02;
    burstF(x, sr, R, tt, 0.01, 0.5, 0.0035, [['bp', 1800, 0.9]]);
    thump(x, sr, tt, 110, 90, 0.2, 0.015);
    return x;
  },
  lepes_fa(sr, R) {
    const x = B(sr, 0.35), md = [128, 243, 412, 690], mt = [0.07, 0.05, 0.035, 0.02], ma = [1, 0.6, 0.4, 0.2];
    for (let k = 0; k < 4; k++) ring(x, sr, 0, md[k] * (1 + 0.04 * (R() - 0.5)), ma[k] * 0.6, mt[k], 0.001, R() * TAU);
    burstF(x, sr, R, 0, 0.01, 0.6, 0.003, [['lp', 2000, 0.7]]);
    const tt = 0.07 + R() * 0.02;
    for (let k = 0; k < 4; k++) ring(x, sr, tt, md[k] * 1.05, ma[k] * 0.3, mt[k] * 0.8, 0.001, R() * TAU);
    burstF(x, sr, R, tt, 0.01, 0.35, 0.0025, [['lp', 2400, 0.7]]);
    if (R() < 0.3) {   // néha nyikordul egy deszka
      const n = Math.ceil(0.14 * sr), ex = new Float32Array(n), cr = new Float32Array(n); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; ph += (170 + 90 * t / 0.14) / sr; if (ph >= 1) { ph -= 1; ex[i] = Math.sin(Math.PI * t / 0.14); } }
      reson(ex, 860, 0.02, sr, cr, 1); reson(ex, 1480, 0.015, sr, cr, 0.6);
      const g = 0.05 / Math.max(1e-6, rmsOf(cr)); for (let i = 0; i < n; i++) cr[i] *= g;
      add(x, cr, Math.floor(0.11 * sr), 1);
    }
    fadeOut(x, sr, 0.08);
    return x;
  },

  // ── járművek ──
  fek(sr, R) {   // a szolgálati autó lassan fékez a kapu előtti kavicson, a végén a karosszéria bólint
    const x = B(sr, 1.5); let t = 0;
    while (t < 1.0) {
      const d = 1 - t;
      grainF(x, sr, R, t, 0.002 + R() * 0.006, (0.1 + 0.3 * R()) * d, [['bp', 900 + R() * 2200, 1.1]]);
      t += -Math.log(1 - R()) / (140 * d + 10);
    }
    const n = Math.ceil(1.05 * sr), rn = new Float32Array(n);
    for (let i = 0; i < n; i++) { const tt = i / sr; rn[i] = (R() * 2 - 1) * Math.pow(Math.max(0, 1 - tt / 1.05), 0.7) * Math.min(1, tt / 0.05); }
    filt(rn, 'lp', 700, 0.7, sr); add(x, rn, 0, 1.0);
    const m = Math.ceil(0.9 * sr), sq = new Float32Array(m); let ph = 0;
    for (let i = 0; i < m; i++) {
      const tt = i / sr, f = 2150 + 60 * Math.sin(TAU * 6.5 * tt) + 80 * tt; ph += TAU * f / sr;
      sq[i] = Math.sin(ph) * Math.pow(Math.sin(Math.PI * tt / 0.9), 1.5) * (0.8 + 0.2 * Math.sin(TAU * 23 * tt));
    }
    add(x, sq, Math.floor(0.25 * sr), 0.06);
    thump(x, sr, 1.08, 70, 50, 0.6, 0.07);
    burstF(x, sr, R, 1.08, 0.08, 0.3, 0.03, [['lp', 300, 0.7]]);
    for (let k = 0; k < 3; k++) ring(x, sr, 1.1 + 0.05 * k, [340, 520, 710][k], 0.08, 0.06, 0.001, R() * TAU);
    return x;
  },
  ajto_csapas(sr, R) {   // autóajtó: zárnyelv, mély puffanás, lemezcsengés, üveg zörren a keretben
    const x = B(sr, 0.7);
    burstF(x, sr, R, 0, 0.003, 0.6, 0.0015, [['bp', 3800, 1]]);
    const t1 = 0.012;
    thump(x, sr, t1, 68, 52, 1, 0.07); thump(x, sr, t1, 125, 100, 0.5, 0.045);
    burstF(x, sr, R, t1, 0.09, 0.7, 0.035, [['lp', 900, 0.7]]);
    const pf = [262, 474, 835, 1290, 1720];
    for (let k = 0; k < 5; k++) ring(x, sr, t1, pf[k] * (1 + 0.03 * (R() - 0.5)), 0.44 / (k + 1), 0.12 / (1 + k * 0.4), 0.0008, R() * TAU);
    for (let k = 0; k < 5; k++) grainF(x, sr, R, t1 + 0.02 + R() * 0.08, 0.004, 0.1, [['bp', 2500 + R() * 2500, 2]]);
    return x;
  },
  kisauto_indit(sr, R) {   // önindító zúg a kompresszió ütemére, aztán néhány gyújtás — onnan a motor_kisauto hurok viszi
    const x = B(sr, 1.6), D = 0.85, n = Math.ceil(D * sr); let ph = 0, pc = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, f = 310 + 40 * Math.sin(TAU * 6 * t); ph += TAU * f / sr; pc += TAU * 6.5 / sr;
      const comp = 0.55 + 0.45 * Math.sin(pc), env = Math.min(1, t / 0.03, (D - t) / 0.02);
      x[i] += 0.25 * (Math.sin(ph) + 0.5 * Math.sin(2 * ph + 0.3)) * comp * env;
    }
    const cr = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / sr; cr[i] = (R() * 2 - 1) * (0.5 + 0.5 * Math.pow(Math.sin(TAU * 6.5 * t), 2)) * Math.min(1, t / 0.03, (D - t) / 0.02); }
    filt(cr, 'bp', 600, 1, sr); add(x, cr, 0, 0.9);
    for (let k = 0; k < 5; k++) {
      const t = D + k * 0.06;
      thump(x, sr, t, 55, 40, 0.9 * (1 - k * 0.12), 0.05);
      burstF(x, sr, R, t, 0.05, 0.5, 0.015, [['lp', 900, 0.7]]);
    }
    return x;
  },
  bicikli_csengo(sr, R) {   // biciklicsengő: két „trrring" a hüvelykujjas karral
    const x = B(sr, 2.6), f0 = 2950 + R() * 200, r = [1, 1.47, 2.09, 2.56], a = [1, 0.5, 0.35, 0.2], tu = [0.55, 0.38, 0.24, 0.15];
    [0, 0.45].forEach(b => {
      for (let j = 0; j < 6; j++) { const h = b + j / 28; for (let k = 0; k < 4; k++) ring(x, sr, h, f0 * r[k], a[k] * (0.6 + 0.4 * R()) * 0.5, tu[k], 0.0004, R() * TAU); }
    });
    fadeOut(x, sr, 0.5);
    return x;
  },

  // ── jelzések ──
  sms(sr) {   // saját négyhangos dallam FM-csengővel, telefonhangszóróra szűrve (A5 – E6 – C#6 – A6)
    const x = B(sr, 0.8), notes = [[0, 880], [0.1, 1318.5], [0.2, 1108.73], [0.3, 1760]];
    notes.forEach(([t0, f], j) => {
      const len = j === 3 ? 0.42 : 0.14, n0 = Math.floor(t0 * sr), n = Math.ceil(len * sr); let pc = 0, pm = 0;
      for (let i = 0; i < n && n0 + i < x.length; i++) {
        const t = i / sr; pm += TAU * f * 2 / sr; pc += TAU * f / sr;
        const I = 1.6 * Math.exp(-t / 0.05), e = Math.min(1, t / 0.003) * Math.exp(-t / (j === 3 ? 0.16 : 0.07)) * Math.min(1, (len - t) / 0.01);
        x[n0 + i] += 0.5 * e * Math.sin(pc + I * Math.sin(pm));
      }
    });
    filt(x, 'hp', 500, 0.7, sr); filt(x, 'lp', 6000, 0.7, sr);
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh(1.6 * x[i]);
    return x;
  },
  rangemeles(sr, R) {   // rövid saját fanfár: G4–C5–E5 felfutás, C-dúr akkord G5-tel, üstdob, csillogás
    const x = B(sr, 2.4);
    const brass = (t0, len, f, amp) => {
      const n0 = Math.floor(t0 * sr), n = Math.ceil(len * sr), H = Math.min(14, Math.floor(sr * 0.4 / f)); let ph = 0;
      for (let i = 0; i < n && n0 + i < x.length; i++) {
        const t = i / sr, att = Math.min(1, t / 0.035), rel = Math.max(0, Math.min(1, (len - t) / 0.08));
        const b = 0.25 + 0.75 * Math.min(1, t / 0.06) * (t > 0.5 ? 0.85 : 1), vib = t > 0.45 ? 1 + 0.005 * Math.sin(TAU * 5.5 * t) : 1;
        ph += TAU * f * vib / sr; let s = 0;
        for (let h = 1; h <= H; h++) s += Math.sin(h * ph) * Math.exp(-(h - 1) / (1.2 + 6 * b)) / Math.sqrt(h);
        x[n0 + i] += amp * att * rel * s;
      }
    };
    brass(0, 0.16, 392, 0.5); brass(0.15, 0.16, 523.25, 0.5); brass(0.3, 0.16, 659.26, 0.5);
    brass(0.45, 1.25, 783.99, 0.6); brass(0.45, 1.25, 523.25, 0.35); brass(0.45, 1.25, 659.26, 0.35); brass(0.45, 1.25, 261.63, 0.3);
    thump(x, sr, 0.45, 98, 92, 0.8, 0.3);
    burstF(x, sr, R, 0.45, 0.15, 0.3, 0.05, [['lp', 600, 0.7]]);
    for (let k = 0; k < 6; k++) ring(x, sr, 0.46 + k * 0.03, 2093 * (1 + 0.5 * (k % 3)), 0.06, 0.4, 0.001, R() * TAU);
    echoes(x, sr, [[0.043, 0.25], [0.071, 0.2], [0.113, 0.15], [0.167, 0.1], [0.229, 0.07]], 3500);
    fadeOut(x, sr, 0.3);
    return x;
  },
  gyanu(sr, R) {   // gyanú: két tompa szívdobbanás és egy halk, súrlódó kis szekund
    const x = B(sr, 1.2);
    [0, 0.3].forEach((h, j) => {
      thump(x, sr, h, 62, 45, 0.9 * (j ? 0.8 : 1), 0.12); thump(x, sr, h, 124, 95, 0.3, 0.06);
      burstF(x, sr, R, h, 0.03, 0.3, 0.008, [['lp', 500, 0.7]]);
    });
    const n = Math.ceil(1.0 * sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr, e = Math.pow(Math.sin(Math.PI * t / 1.0), 2);
      x[i] += 0.09 * e * (Math.sin(TAU * 622.25 * t) + 0.3 * Math.sin(TAU * 1244.5 * t) + 0.8 * Math.sin(TAU * 659.26 * t));
    }
    return x;
  },

  // ── távoli élőlények, harang ──
  kutya(sr, R) {   // távoli ugatás: harmonikus forrás emelkedő–eső alaphanggal, formánsok, udvarvisszhang
    const x = B(sr, 1.7), nb = 1 + Math.floor(R() * 3), base = 380 + R() * 120;
    for (let b = 0; b < nb; b++) {
      const t0 = 0.01 + b * (0.27 + R() * 0.08), len = 0.13 + R() * 0.05, fb = base * (1 + 0.06 * (R() - 0.5));
      const v = harm(sr, len,
        t => { const u = t / len; return fb * (1 + 0.35 * Math.sin(Math.PI * Math.min(1, u * 1.6))) * (u > 0.6 ? 1 - (u - 0.6) * 0.5 : 1); },
        t => { const u = t / len; return Math.min(1, t / 0.006) * Math.pow(u < 0.5 ? 1 : Math.max(0, 1 - (u - 0.5) / 0.5), 1.5) * (0.8 + 0.2 * R()); },
        { maxH: 24, tilt: 0.9 });
      for (let i = 0; i < v.length; i++) v[i] += (R() * 2 - 1) * 0.6 * Math.max(0, 1 - i / v.length);
      add(x, formants(v, sr, [[700, 5, 1], [1350, 6, 0.7], [2600, 7, 0.35]]), Math.floor(t0 * sr), 1);
    }
    filt(x, 'lp', 2200, 0.7, sr);
    echoes(x, sr, [[0.06, 0.3], [0.11, 0.22], [0.19, 0.15], [0.31, 0.1], [0.45, 0.06]], 1800);
    return x;
  },
  kakas(sr, R) {   // kukorékolás a szomszédból: négy szótag, az utolsó hosszú, érdes, lecsengő
    const x = B(sr, 1.9), sh = 1 + (R() - 0.5) * 0.08;
    const syl = [[0.01, 0.11, 560, 600, 'u'], [0.15, 0.11, 640, 690, 'u'], [0.3, 0.12, 720, 780, 'i'], [0.47, 0.85, 820, 560, 'u']];
    const FM = { u: [[450, 4, 1], [1000, 5, 0.5], [2400, 6, 0.25]], i: [[500, 4, 1], [1900, 5, 0.6], [2800, 6, 0.3]] };
    syl.forEach(([t0, len, fa, fb, vw], j) => {
      const last = j === 3;
      const v = harm(sr, len,
        t => {
          const u = t / len;
          const base = last ? (u < 0.25 ? fa + 60 * u / 0.25 : (fa + 60) - (fa + 60 - fb) * Math.pow((u - 0.25) / 0.75, 1.3)) : fa + (fb - fa) * u;
          return base * sh * (1 + 0.02 * Math.sin(TAU * 22 * t));
        },
        t => {
          const u = t / len, env = Math.min(1, t / 0.012) * Math.min(1, (len - t) / (last ? 0.25 : 0.03));
          return Math.max(0, env) * (0.7 + 0.3 * Math.sin(TAU * 31 * t)) * (0.9 + 0.1 * R());
        },
        { maxH: 18, tilt: 1.15 });
      add(x, formants(v, sr, FM[vw]), Math.floor(t0 * sr), 1);
    });
    filt(x, 'lp', 3000, 0.7, sr);
    echoes(x, sr, [[0.07, 0.25], [0.13, 0.18], [0.22, 0.12], [0.35, 0.07]], 2000);
    return x;
  },
  harang(sr, R) {   // toronyóra ütése: templomharang-részhangok (hum, prím, kis terc, kvint, nominál…) lebegő párokkal
    const D = 9, x = B(sr, D), p = 330 + R() * 20;
    const r = [0.5, 1, 1.183, 1.506, 2, 2.514, 2.662, 3.011, 4.166, 5.433];
    const a = [0.5, 0.7, 0.55, 0.22, 0.9, 0.28, 0.33, 0.22, 0.14, 0.07];
    const tu = [5.0, 3.2, 2.5, 1.8, 1.6, 1.0, 0.9, 0.7, 0.4, 0.25];
    for (let k = 0; k < r.length; k++) {
      const f = p * r[k], d = 0.4 + R() * 0.8;
      ring(x, sr, 0, f, a[k] * 0.6, tu[k], 0.002, R() * TAU);
      ring(x, sr, 0, f + d, a[k] * 0.45, tu[k] * 0.95, 0.002, R() * TAU);
    }
    burstF(x, sr, R, 0, 0.03, 0.4, 0.008, [['bp', 2000, 0.6]]);
    filt(x, 'lp', 4000, 0.7, sr);
    fadeOut(x, sr, 2.5);
    return x;
  },

  // ── szemcsék a hurkokhoz (csúcsra normálva) ──
  g_ropog(sr, R) {   // parázs ropogása: 1–5 mikropattanás egy csomóban
    const x = B(sr, 0.07), n = 1 + Math.floor(R() * R() * 5); let t = 0.001;
    for (let j = 0; j < n; j++) { burstF(x, sr, R, t, 0.004, j ? 0.3 + 0.7 * R() : 1, 0.0006 + R() * 0.0018, [['bp', 1000 + R() * 4500, 0.8 + R() * 1.5]]); t += 0.002 + R() * 0.012; }
    if (R() < 0.35) ring(x, sr, 0.001, 1800 + R() * 2500, 0.25, 0.003 + R() * 0.003);
    return x;
  },
  g_pattan(sr, R) {   // nagyobb pattanás: a fában szétfeszülő gőz
    const x = B(sr, 0.15);
    burstF(x, sr, R, 0.001, 0.02, 1, 0.003, [['lp', 3000, 0.7]]);
    ring(x, sr, 0.001, 450 + R() * 450, 0.5, 0.012); thump(x, sr, 0.001, 180, 120, 0.4, 0.015);
    for (let j = 0; j < 4; j++) burstF(x, sr, R, 0.01 + R() * 0.08, 0.003, 0.3 * R(), 0.0008, [['bp', 2500 + R() * 3000, 1.5]]);
    return x;
  },
  g_buborek(sr, R) {   // forrásbuborék a sűrű cefrében
    const f0 = 170 + R() * R() * 800, tau = 0.03 * Math.pow(350 / f0, 0.8), x = B(sr, tau * 6 + 0.01);
    bubble(x, sr, 0.0005, f0, 1, tau, 0.12);
    return x;
  },
  g_csepp(sr, R) {   // csepp a palackba: kis koppanás + „plink" + halk üvegtest
    const x = B(sr, 0.08);
    bubble(x, sr, 0.002, 1400 * (0.96 + 0.08 * R()), 1, 0.007, 0.35);
    burstF(x, sr, R, 0, 0.002, 0.25, 0.0005, [['hp', 3000, 0.7]]);
    ring(x, sr, 0.002, 520, 0.15, 0.02);
    return x;
  },
  g_racsni(sr, R) {   // szabadonfutó racsni egy kattanása
    const x = B(sr, 0.02);
    ring(x, sr, 0, 3900 + R() * 400, 0.6, 0.0025); ring(x, sr, 0, 6100, 0.3, 0.0018);
    burstF(x, sr, R, 0, 0.001, 0.4, 0.0004, [['hp', 3000, 0.7]]);
    return x;
  },
  g_tucsok(sr, R) {   // tücsökcirpelés: 3–4 tiszta impulzus, felhang nélkül (nincs magas sistergés)
    const x = B(sr, 0.11), f = 4500 + R() * 300, np = 3 + Math.floor(R() * 2);
    for (let j = 0; j < np; j++) tone(x, sr, 0.004 + j * 0.022, 0.013, f, f * 0.995, 1, { edge: 0.0015 });
    return x;
  },
  g_beka(sr, R) {   // „brekeke": impulzussor két rezonátoron
    const x = B(sr, 0.9), nc = 2 + Math.floor(R() * 3), base = 24 + R() * 10, fr = [480 + R() * 120, 1050 + R() * 200];
    let t = 0.01;
    for (let j = 0; j < nc; j++) {
      const len = j === 0 ? 0.22 : 0.12, n = Math.ceil(len * sr), pad = Math.ceil(0.06 * sr), ex = new Float32Array(n + pad); let ph = 0;
      for (let i = 0; i < n; i++) { const u = i / n; ph += base * (1 + 0.2 * u) / sr; if (ph >= 1) { ph -= 1; ex[i] = Math.sin(Math.PI * u); } }
      const y = new Float32Array(ex.length);
      reson(ex, fr[0], 0.012, sr, y, 1); reson(ex, fr[1], 0.007, sr, y, 0.5);
      add(x, y, Math.floor(t * sr), 1); t += len + 0.05 + R() * 0.04;
    }
    return x;
  },
  g_madar(sr, R, k) {   // három „faj": cinege-szerű kéttagú, pinty-szerű trilla, rigó-szerű fuvolázás
    const x = B(sr, 2.2), sp = k % 3;
    if (sp === 0) {
      const fa = 4800 + R() * 700, fb = 3300 + R() * 500, n = 3 + Math.floor(R() * 3); let t = 0.01;
      for (let j = 0; j < n; j++) { tone(x, sr, t, 0.045, fa * 1.04, fa, 0.9); t += 0.06; tone(x, sr, t, 0.07, fb, fb * 0.97, 0.7); t += 0.11 + R() * 0.02; }
    } else if (sp === 1) {
      const n = 8 + Math.floor(R() * 7), f0 = 5600 + R() * 800; let t = 0.01;
      for (let j = 0; j < n; j++) { const f = f0 * (1 - 0.012 * j); tone(x, sr, t, 0.028, f, f * 0.62, 0.8); t += 0.062 - 0.0015 * j; }
      tone(x, sr, t + 0.03, 0.12, 3200, 4600, 0.9);
    } else {
      const n = 4 + Math.floor(R() * 4); let t = 0.01;
      for (let j = 0; j < n; j++) { const len = 0.08 + R() * 0.14, f = 1700 + R() * 1500; tone(x, sr, t, len, f, f * (0.85 + 0.3 * R()), 0.9, { vib: 18 + R() * 20, vd: 0.02, h2: 0.08 }); t += len + 0.03 + R() * 0.08; }
    }
    return trim(x, sr);
  },
  g_eso(sr, R) {   // esőcsepp
    const x = B(sr, 0.03);
    bubble(x, sr, 0.001, 2200 + R() * 2800, 1, 0.0025 + R() * 0.002, 0.5);
    burstF(x, sr, R, 0, 0.002, 0.3, 0.0006, [['hp', 3000, 0.7]]);
    return x;
  },
  g_nevetes(sr, R) {   // nevetés a kocsmában, beszédhang nélkül: „ha-ha-ha" szótagok
    const n = 4 + Math.floor(R() * 3), f0 = 210 + R() * 90, x = B(sr, 0.2 * n + 0.4);
    for (let j = 0; j < n; j++) {
      const len = 0.11 + R() * 0.04, t0 = 0.03 + j * (0.17 + R() * 0.03), fb = f0 * (1.15 - 0.05 * j);
      burstF(x, sr, R, t0, 0.03, 0.15, 0.012, [['bp', 1500, 1]]);
      const v = harm(sr, len, t => fb * (1 - 0.15 * t / len), t => Math.min(1, t / 0.01) * Math.pow(Math.max(0, 1 - t / len), 0.8) * (0.85 + 0.15 * R()), { maxH: 20, tilt: 1.1 });
      add(x, formants(v, sr, [[800, 4, 1], [1250, 5, 0.6], [2600, 6, 0.25]]), Math.floor((t0 + 0.02) * sr), 1);
    }
    filt(x, 'lp', 2500, 0.7, sr);
    return x;
  },
  b_kocsma(sr, R) {   // 8 s-os, varrat nélküli kocsmazsivaj: 7 érthetetlen „hang" szótagokkal, falon át tompítva
    const D = 8, XF = 0.6, N = Math.ceil((D + XF) * sr) + 1, out = new Float32Array(N);
    for (let v = 0; v < 7; v++) {
      const f0 = 95 + R() * 150, vg = 0.35 + 0.65 * R(), ph0 = R() * TAU;
      let t = R() * 0.6;
      while (t < D + XF) {
        if (R() < 0.1) { t += 0.5 + R() * 1.5; continue; }
        const len = 0.09 + R() * 0.17, n = Math.ceil(len * sr), pad = Math.ceil(0.03 * sr), ex = new Float32Array(n + pad); let ph = 0;
        for (let i = 0; i < n; i++) {
          const tt = t + i / sr, f = f0 * (1 + 0.12 * Math.sin(TAU * 0.35 * tt + ph0) + 0.05 * Math.sin(TAU * 2.1 * tt));
          ph += f / sr; if (ph >= 1) { ph -= 1; ex[i] = Math.pow(Math.sin(Math.PI * i / n), 0.6); }
        }
        const [F1, F2] = VOW[Math.floor(R() * VOW.length)], y = new Float32Array(ex.length);
        reson(ex, F1 * (0.95 + 0.1 * R()), 0.006, sr, y, 1); reson(ex, F2 * (0.95 + 0.1 * R()), 0.004, sr, y, 0.5); reson(ex, 2700, 0.003, sr, y, 0.15);
        if (R() < 0.45) burstF(y, sr, R, 0, 0.03, 0.25 * rmsOf(y) * 3, 0.012, [['hp', 2500, 0.7]]);
        add(out, y, Math.floor(t * sr), vg);
        t += len + 0.015 + R() * 0.05;
      }
    }
    filt(out, 'lp', 2400, 0.6, sr);
    echoes(out, sr, [[0.023, 0.35], [0.041, 0.3], [0.067, 0.22], [0.093, 0.18], [0.131, 0.12], [0.177, 0.08]], 1800);
    return seamless(out, sr, D, XF);
  },
};

// ───────────────────────── katalógus ─────────────────────────

/** Kategóriacél: a legerősebb 100 ms-os ablak RMS-e (dBFS). null = csúcsra normálás (szemcsék). */
const CAT = { ui: -20, foley: -16, lepes: -20, jarmu: -14, jelzes: -15, kornyezet: -14, szemcse: null, agy: -20 };

const SHOTS = {
  ui_click:       { nev: 'UI-kattintás', cat: 'ui', v: 3, dur: 0.07, spread: 0.04 },
  uveg:           { nev: 'Üvegkoccanás', cat: 'foley', v: 5, dur: 2.0, ref: 1.2, spektro: true },
  dugo:           { nev: 'Dugózás', cat: 'foley', v: 3, dur: 0.5, ref: 1.2 },
  dugo_ki:        { nev: 'Dugó ki (pukkanás)', cat: 'foley', v: 3, dur: 0.3, ref: 1.2 },
  toltes:         { nev: 'Töltés pohárba', cat: 'foley', v: 3, dur: 2.05, ref: 1.2, spektro: true },
  vodor:          { nev: 'Vödör víz', cat: 'foley', v: 3, dur: 1.9, ref: 1.5 },
  gyumolcs:       { nev: 'Gyümölcsszedés', cat: 'foley', v: 5, dur: 0.6, ref: 1.2 },
  hordo:          { nev: 'Hordó kongása', cat: 'foley', v: 4, dur: 1.6, ref: 1.5 },
  hordo_fedel:    { nev: 'Hordófedél', cat: 'foley', v: 3, dur: 0.75, ref: 1.5 },
  kapu:           { nev: 'Vaskapu nyikorgása', cat: 'foley', v: 3, dur: 3.4, ref: 2.5, spektro: true },
  penz_papir:     { nev: 'Bankjegyek', cat: 'foley', v: 4, dur: 0.55, ref: 1 },
  penz_erme:      { nev: 'Érmék', cat: 'foley', v: 4, dur: 1.1, ref: 1 },
  lepes_fu:       { nev: 'Lépés – fű', cat: 'lepes', v: 8, dur: 0.3, ref: 1, spread: 0.05 },
  lepes_fold:     { nev: 'Lépés – föld', cat: 'lepes', v: 8, dur: 0.25, ref: 1, spread: 0.05 },
  lepes_aszfalt:  { nev: 'Lépés – aszfalt', cat: 'lepes', v: 8, dur: 0.25, ref: 1, spread: 0.05 },
  lepes_fa:       { nev: 'Lépés – fapadló', cat: 'lepes', v: 8, dur: 0.35, ref: 1, spread: 0.05 },
  fek:            { nev: 'Fékezés kavicson', cat: 'jarmu', v: 2, dur: 1.5, ref: 5 },
  ajto_csapas:    { nev: 'Autóajtó-csapódás', cat: 'jarmu', v: 3, dur: 0.7, ref: 3, spektro: true },
  kisauto_indit:  { nev: 'Kisautó indítása', cat: 'jarmu', v: 2, dur: 1.6, ref: 3 },
  koszones:       { nev: 'Kapucsengő (a vevő köszön)', cat: 'jelzes', v: 3, dur: 3.2, ref: 3, spektro: true },
  bicikli_csengo: { nev: 'Biciklicsengő', cat: 'jelzes', v: 2, dur: 2.6, ref: 2 },
  sms:            { nev: 'SMS-csengés', cat: 'jelzes', v: 1, dur: 0.8, spread: 0, spektro: true },
  rangemeles:     { nev: 'Rangemelés (fanfár)', cat: 'jelzes', v: 1, dur: 2.4, spread: 0, spektro: true },
  gyanu:          { nev: 'Gyanú-figyelmeztetés', cat: 'jelzes', v: 1, dur: 1.2, spread: 0 },
  kutya:          { nev: 'Kutyaugatás (távol)', cat: 'kornyezet', v: 5, dur: 1.7, ref: 20, spektro: true },
  kakas:          { nev: 'Kakaskukorékolás', cat: 'kornyezet', v: 3, dur: 1.9, ref: 20, spektro: true },
  harang:         { nev: 'Óraütés (harang)', cat: 'kornyezet', v: 2, dur: 9, ref: 60, spread: 0.004, spektro: true },
};
const GRAINS = {
  g_ropog: { cat: 'szemcse', v: 24 }, g_pattan: { cat: 'szemcse', v: 8 }, g_buborek: { cat: 'szemcse', v: 24 },
  g_csepp: { cat: 'szemcse', v: 10 }, g_racsni: { cat: 'szemcse', v: 4 }, g_tucsok: { cat: 'szemcse', v: 4 },
  g_beka: { cat: 'szemcse', v: 6 }, g_madar: { cat: 'szemcse', v: 18 }, g_eso: { cat: 'szemcse', v: 16 },
  g_nevetes: { cat: 'szemcse', v: 4 }, b_kocsma: { cat: 'agy', v: 1, loop: true },
};
const ALIAS = {
  click: 'ui_click', kattintas: 'ui_click', uveg_koccanas: 'uveg', koccintas: 'uveg', dugozas: 'dugo',
  bankjegy: 'penz_papir', penz: 'penz_papir', erme: 'penz_erme', csengo: 'koszones', kapucsengo: 'koszones',
  rang: 'rangemeles', rankUp: 'rangemeles', ajto: 'ajto_csapas', fekezes: 'fek', harangszo: 'harang', orautes: 'harang',
  szedes: 'gyumolcs', viz: 'vodor', fedel: 'hordo_fedel',
};

// ───────────────────────── WebAudio-segédek ─────────────────────────

function gn(c, v) { const g = c.createGain(); g.gain.value = v; return g; }
function bq(c, type, f, Q) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; }
function tanhCurve(drive) { const n = 1024, c = new Float32Array(n), th = Math.tanh(drive); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(drive * x) / th; } return c; }
function toV(p) {
  if (!p) return null;
  if (p.matrixWorld) { const e = p.matrixWorld.elements; return { x: e[12], y: e[13], z: e[14] }; }
  if (Array.isArray(p)) return p.length === 2 ? { x: p[0], y: 1.2, z: p[1] } : { x: p[0], y: p[1], z: p[2] };
  if (typeof p.x === 'number') return { x: p.x, y: p.y ?? 0, z: p.z ?? 0 };
  return null;
}

// ───────────────────────── hurkok ─────────────────────────
// build(H, out, P, t) → { srcs:[…], update?(P, t), pump?(t0, t1) }

function engine(cfg) {
  return {
    nev: cfg.nev, gain: cfg.gain, ref: cfg.ref,
    params: [{ k: 'rpm', nev: 'Fordulat', def: 0.15 }, { k: 'gaz', nev: 'Gáz', def: 0.3 }],
    build(H, out, P, t) {
      const c = H.ctx, st = { rpm: P.rpm ?? 0.15, gaz: P.gaz ?? 0.3, dop: 1, pitch: P.pitch ?? 1 };
      const osc = c.createOscillator(); osc.setPeriodicWave(H._wave(cfg.nev, cfg.cyl));
      const sub = c.createOscillator(); sub.type = 'sine';
      const pre = gn(c, 1), subG = gn(c, cfg.sub);
      osc.connect(pre); sub.connect(subG); subG.connect(pre);
      const sh = c.createWaveShaper(); sh.curve = tanhCurve(cfg.drive); sh.oversample = '2x';
      const lp = bq(c, 'lowpass', 800, 0.9), ex = bq(c, 'peaking', cfg.exhaust, 1.1); ex.gain.value = 7;
      const body = gn(c, 0.5);
      pre.connect(sh); sh.connect(lp); lp.connect(ex); ex.connect(body); body.connect(out);
      // szelepzörgés, kipufogó-szörcsögés: zaj, a gyújtás ütemére modulálva (egyenirányított AM)
      const nz = H._bed('white', t), nbp = bq(c, 'bandpass', cfg.raspF, 0.9), am = gn(c, 0), depth = gn(c, 0);
      osc.connect(depth); depth.connect(am.gain); nz.connect(nbp); nbp.connect(am); am.connect(out);
      osc.start(t); sub.start(t);
      const apply = (t, tau = 0.07) => {
        const r = clamp01(st.rpm), g = clamp01(st.gaz);
        const f = (cfg.idle + (cfg.max - cfg.idle) * r) / (cfg.cyl === 2 ? 60 : 30) * st.dop * st.pitch;
        osc.frequency.setTargetAtTime(f, t, tau); sub.frequency.setTargetAtTime(f / 2, t, tau);
        lp.frequency.setTargetAtTime(220 + cfg.bright * (0.25 + 0.75 * g) * (0.35 + 0.65 * r), t, 0.1);
        body.gain.setTargetAtTime(0.45 + 0.4 * g + 0.15 * r, t, 0.1);
        const d = cfg.rasp * (0.5 + 0.8 * g);
        am.gain.setTargetAtTime(d, t, 0.1); depth.gain.setTargetAtTime(d, t, 0.1);
      };
      apply(t, 0.005);
      return { srcs: [osc, sub, nz], update(o, t) { for (const k of ['rpm', 'gaz', 'dop', 'pitch']) if (o[k] != null) st[k] = o[k]; apply(t); } };
    },
  };
}

const LOOPS = {
  tuz: {
    nev: 'Tűz az üst alatt', gain: -8, ref: 1.5, params: [{ k: 'ero', nev: 'Tűz ereje', def: 0.6 }],
    build(H, out, P, t) {
      const c = H.ctx, st = { ero: clamp01(P.ero ?? 0.6) };
      const roar = H._bed('brown', t), roarLP = bq(c, 'lowpass', 300, 0.5), roarG = gn(c, 0);
      roar.connect(roarLP); roarLP.connect(roarG); roarG.connect(out);
      const fl = H._bed('pink', t), flBP = bq(c, 'bandpass', 800, 0.45), flG = gn(c, 0);
      fl.connect(flBP); flBP.connect(flG); flG.connect(out);
      const crG = gn(c, 1); crG.connect(out);
      let next = t, nextPop = t + 0.5, nextGust = t;
      const apply = t => { const e = st.ero; roarLP.frequency.setTargetAtTime(160 + 520 * e, t, 0.3); flBP.frequency.setTargetAtTime(600 + 700 * e, t, 0.3); };
      apply(t);
      return {
        srcs: [roar, fl],
        update(o, t) { if (o.ero != null) { st.ero = clamp01(o.ero); apply(t); } },
        pump(t0, t1) {
          const e = st.ero;
          while (nextGust < t1) {   // a láng lobog: lassú, véletlen hullámzás
            const g = 0.55 + 0.45 * H.rnd();
            roarG.gain.setTargetAtTime(0.35 * Math.pow(e, 1.2) * g, nextGust, 0.12);
            flG.gain.setTargetAtTime(0.05 * e * g, nextGust, 0.12);
            nextGust += 0.12 + H.rnd() * 0.25;
          }
          const lam = 1.5 + 24 * Math.pow(e, 1.3);
          while (next < t1) { if (e > 0.02) H._grain('g_ropog', crG, next, { vol: 0.06 + 0.5 * Math.pow(H.rnd(), 2.5), rate: 0.85 + 0.3 * H.rnd() }); next += H._exp(lam); }
          while (nextPop < t1) { if (e > 0.15) H._grain('g_pattan', crG, nextPop, { vol: 0.25 + 0.35 * H.rnd(), rate: 0.8 + 0.4 * H.rnd() }); nextPop += H._exp(0.08 + 0.5 * e); }
        },
      };
    },
  },
  forras: {
    nev: 'Forrás az üstben', gain: -16, ref: 1.5, params: [{ k: 'ho', nev: 'Hőfok', def: 0.75 }],
    build(H, out, P, t) {
      const c = H.ctx, st = { ho: clamp01(P.ho ?? 0.75) };
      const lid = bq(c, 'lowpass', 2400, 0.6); lid.connect(out);
      const rum = H._bed('brown', t), rLP = bq(c, 'lowpass', 140, 0.6), rG = gn(c, 0);
      rum.connect(rLP); rLP.connect(rG); rG.connect(lid);
      const bG = gn(c, 1); bG.connect(lid);
      let next = t;
      const apply = t => rG.gain.setTargetAtTime(0.35 * sm(0.55, 1, st.ho), t, 0.4);
      apply(t);
      return {
        srcs: [rum],
        update(o, t) { if (o.ho != null) { st.ho = clamp01(o.ho); apply(t); } },
        pump(t0, t1) {
          const h = st.ho, s = sm(0.35, 1, h), lam = 1 + 70 * Math.pow(s, 1.4);
          while (next < t1) {
            if (h > 0.3 || H.rnd() < h * 2) H._grain('g_buborek', bG, next, { vol: (0.1 + 0.9 * H.rnd() * H.rnd()) * (0.3 + 0.7 * s), rate: (0.75 + 0.5 * H.rnd()) * (h < 0.5 ? 1.6 : 1) });
            next += H._exp(lam);
          }
        },
      };
    },
  },
  csepeges: {
    nev: 'Csepegés a palackba', gain: -10, ref: 1, params: [{ k: 'seb', nev: 'Csepegés sebessége', def: 0.5 }, { k: 'tele', nev: 'Palack telítettsége', def: 0.3 }],
    build(H, out, P, t) {
      const c = H.ctx, st = { seb: clamp01(P.seb ?? 0.5), tele: clamp01(P.tele ?? 0.3) };
      const s = H._bed('pink', t), sBP = bq(c, 'bandpass', 2500, 2), sG = gn(c, 0);
      s.connect(sBP); sBP.connect(sG); sG.connect(out);
      let next = t;
      const apply = t => { sBP.frequency.setTargetAtTime(2000 + 1500 * st.tele, t, 0.3); sG.gain.setTargetAtTime(0.12 * clamp01((st.seb - 0.7) / 0.3), t, 0.3); };
      apply(t);
      return {
        srcs: [s],
        update(o, t) { if (o.seb != null) st.seb = clamp01(o.seb); if (o.tele != null) st.tele = clamp01(o.tele); apply(t); },
        pump(t0, t1) {
          while (next < t1) {
            const lam = 0.4 + 9 * Math.pow(st.seb, 1.5);
            if (st.seb > 0.01) H._grain('g_csepp', out, next, { vol: 0.6 + 0.4 * H.rnd(), rate: (1100 + 900 * st.tele) / 1400 * (0.95 + 0.1 * H.rnd()) });
            next += (1 / lam) * (0.85 + 0.3 * H.rnd());
          }
        },
      };
    },
  },
  motor_penzugyor: engine({ nev: 'Pénzügyőr autójának motorja', cyl: 4, idle: 800, max: 6000, sub: 0.25, drive: 2.2, exhaust: 110, bright: 2400, raspF: 1400, rasp: 0.10, gain: -8, ref: 5 }),
  motor_kisauto:   engine({ nev: 'Saját kisautó motorja', cyl: 2, idle: 950, max: 5200, sub: 0.45, drive: 3.0, exhaust: 150, bright: 2000, raspF: 1100, rasp: 0.18, gain: -8, ref: 3 }),
  bicikli: {
    nev: 'Bicikli', gain: -10, ref: 1.5, params: [{ k: 'seb', nev: 'Sebesség', def: 0.5 }, { k: 'teker', nev: 'Teker (1) / gurul (0)', def: 1, step: 1 }],
    build(H, out, P, t) {
      const c = H.ctx, st = { seb: clamp01(P.seb ?? 0.5), teker: !!(P.teker ?? true) };
      const ty = H._bed('pink', t), tBP = bq(c, 'bandpass', 500, 0.6), tG = gn(c, 0);
      ty.connect(tBP); tBP.connect(tG); tG.connect(out);
      const ch = H._bed('white', t), cBP = bq(c, 'bandpass', 1700, 4), cG = gn(c, 0);
      ch.connect(cBP); cBP.connect(cG); cG.connect(out);
      const tick = gn(c, 1); tick.connect(out);
      let nt = t, np = t;
      const apply = t => { const s = st.seb; tG.gain.setTargetAtTime(0.5 * Math.pow(s, 1.4), t, 0.15); tBP.frequency.setTargetAtTime(300 + 600 * s, t, 0.2); };
      apply(t);
      return {
        srcs: [ty, ch],
        update(o, t) { if (o.seb != null) st.seb = clamp01(o.seb); if (o.teker != null) st.teker = !!o.teker; apply(t); },
        pump(t0, t1) {
          const s = st.seb;
          while (nt < t1) {   // szabadonfutó racsni: csak gurulás közben
            const roll = !st.teker && s > 0.04;
            if (roll) H._grain('g_racsni', tick, nt, { vol: 0.35, rate: 0.95 + 0.1 * H.rnd() });
            nt += roll ? 1 / (8 + 45 * s) : 0.05;
          }
          while (np < t1) {   // lánc: a pedálütemre suhog
            const cad = 0.6 + 1.4 * s;
            if (st.teker && s > 0.04) { cG.gain.setTargetAtTime(0.10 * s, np, 0.05); cG.gain.setTargetAtTime(0.03 * s, np + 0.25 / cad, 0.08); }
            else cG.gain.setTargetAtTime(0, np, 0.1);
            np += 0.5 / cad;
          }
        },
      };
    },
  },
  kocsma: {
    nev: 'Kocsmazsivaj', gain: -10, ref: 8, params: [],
    build(H, out, P, t) {
      const c = H.ctx, s = c.createBufferSource(); s.buffer = H._bank('b_kocsma')[0]; s.loop = true;
      const lp = bq(c, 'lowpass', 2600, 0.6); s.connect(lp); lp.connect(out); s.start(t, H.rnd() * 7);
      const ev = gn(c, 0.7); ev.connect(out);
      let nl = t + 2 + H.rnd() * 4, nc = t + 1;
      return {
        srcs: [s],
        pump(t0, t1) {
          while (nl < t1) { H._grain('g_nevetes', ev, nl, { vol: 0.3 + 0.4 * H.rnd(), rate: 0.9 + 0.2 * H.rnd() }); nl += 4 + H.rnd() * 9; }
          while (nc < t1) { H._grain('uveg', ev, nc, { vol: 0.06 + 0.08 * H.rnd(), rate: 0.95 + 0.1 * H.rnd() }); nc += 1.5 + H.rnd() * 5; }
        },
      };
    },
  },
  eso: {
    nev: 'Eső', gain: -8, ref: 10, params: [{ k: 'int', nev: 'Erősség', def: 1 }],
    build(H, out, P, t) {
      const c = H.ctx, st = { int: clamp01(P.int ?? 1) };
      const b = H._bed('pink', t), hp = bq(c, 'highpass', 500, 0.6), lp = bq(c, 'lowpass', 4200, 0.6), bG = gn(c, 0);
      b.connect(hp); hp.connect(lp); lp.connect(bG); bG.connect(out);
      const r = H._bed('brown', t), rLP = bq(c, 'lowpass', 350, 0.6), rG = gn(c, 0);
      r.connect(rLP); rLP.connect(rG); rG.connect(out);
      const pans = H._panBus(out);
      let next = t;
      const apply = t => { bG.gain.setTargetAtTime(0.30 * st.int, t, 0.8); rG.gain.setTargetAtTime(0.35 * st.int, t, 0.8); };
      apply(t);
      return {
        srcs: [b, r],
        update(o, t) { if (o.int != null) { st.int = clamp01(o.int); apply(t); } },
        pump(t0, t1) {
          while (next < t1) {
            if (st.int > 0.01) H._grain('g_eso', pans[Math.floor(H.rnd() * pans.length)], next, { vol: 0.05 + 0.3 * Math.pow(H.rnd(), 2), rate: 0.8 + 0.4 * H.rnd() });
            next += H._exp(150 * Math.max(st.int, 0.05));
          }
        },
      };
    },
  },
  szel: {
    nev: 'Szél', gain: -6, ref: 10, params: [{ k: 'ero', nev: 'Erősség', def: 0.6 }],
    build(H, out, P, t) {
      const c = H.ctx, st = { ero: clamp01(P.ero ?? 0.6) };
      const w = H._bed('pink', t), bp = bq(c, 'bandpass', 400, 0.45), wG = gn(c, 0);
      w.connect(bp); bp.connect(wG); wG.connect(out);
      const l = H._bed('pink', t), lhp = bq(c, 'highpass', 1500, 0.6), llp = bq(c, 'lowpass', 4500, 0.6), lG = gn(c, 0);
      l.connect(lhp); lhp.connect(llp); llp.connect(lG); lG.connect(out);
      let ng = t;
      return {
        srcs: [w, l],
        update(o) { if (o.ero != null) st.ero = clamp01(o.ero); },
        pump(t0, t1) {
          while (ng < t1) {   // széllökések: lassan, simán változó erő és szín
            const g = 0.35 + 0.65 * Math.pow(H.rnd(), 1.5), base = 0.25 + 0.75 * st.ero;
            wG.gain.setTargetAtTime(0.9 * base * g, ng, 0.9);
            bp.frequency.setTargetAtTime(280 + 450 * g, ng, 1.0);
            lG.gain.setTargetAtTime(0.05 * base * g * g, ng, 0.7);
            ng += 1.5 + H.rnd() * 2.5;
          }
        },
      };
    },
  },
};

const AMB_LAYERS = [
  ['szel', 'Szél', 1.0], ['madar', 'Madarak', 0.35], ['tucsok', 'Tücskök', 0.12], ['beka', 'Békák', 0.3],
  ['kutya', 'Kutyák', 0.5], ['kakas', 'Kakas', 0.5], ['harang', 'Toronyóra', 1.0], ['kocsma', 'Kocsma', 1.0],
  ['varos', 'Város zúgása', 0.3], ['eso', 'Eső', 1.0],
];
const AMB_DB = -6;

// ───────────────────────── a motor ─────────────────────────

export class Hang {
  /** opts: {ctx?: OfflineAudioContext, seed?, limiter?: true, flat?: false} */
  constructor(opts = {}) {
    this.rnd = rng(opts.seed ?? (Date.now() & 0x7fffffff));
    this._vol = 1; this._muted = false;
    this._loops = new Set(); this._scenes = []; this._banks = new Map(); this._noise = {}; this._waves = {};
    this._lp = { x: 0, y: 1.7, z: 0 }; this._cam = null; this._amb = null; this._warned = new Set();
    this._helyek = { kocsma: [214, 1.5, 2], torony: [232, 18, 24] };
    this._limiter = opts.limiter ?? true; this._flat = !!opts.flat;
    this._offline = !!opts.ctx; this._virt = 0;
    this.ctx = null;
    if (opts.ctx) { this.ctx = opts.ctx; this._graph(); }
  }

  // ── életciklus ──
  _ensure() {
    if (this.ctx) return true;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this._graph();
    this._timer = setInterval(() => this._tick(), 25);
    return true;
  }
  _graph() {
    const c = this.ctx;
    this.out = gn(c, this._muted ? 0 : this._vol);
    this.sfxBus = gn(c, 1); this.ambBus = gn(c, dB(AMB_DB));
    this.sfxBus.connect(this.out); this.ambBus.connect(this.out);
    if (this._limiter) {   // biztonsági határoló: sok egyidejű hang se lépje át a 0 dBFS-t
      const L = c.createDynamicsCompressor();
      L.threshold.value = -6; L.knee.value = 4; L.ratio.value = 12; L.attack.value = 0.002; L.release.value = 0.12;
      this.out.connect(L); L.connect(c.destination);
    } else this.out.connect(c.destination);
  }
  /** Első felhasználói gesztusra hívd. Promise-t ad vissza. */
  unlock() {
    if (!this._ensure()) return Promise.resolve(false);
    const c = this.ctx;
    try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, c.sampleRate); s.connect(c.destination); s.start(); } catch (e) { /* régi Safari */ }
    this._prewarm();
    return c.state === 'running' ? Promise.resolve(true) : c.resume().then(() => true, () => false);
  }
  now() { return this._offline ? this._virt : this.ctx ? this.ctx.currentTime : 0; }
  _ready() { if (!this._ensure()) return false; return this._offline || this.ctx.state === 'running'; }
  master(vol) { this._vol = Math.max(0, vol); if (this.ctx && !this._muted) this.out.gain.setTargetAtTime(this._vol, this.now(), 0.05); }
  mute(b) { this._muted = !!b; if (this.ctx) this.out.gain.setTargetAtTime(this._muted ? 0 : this._vol, this.now(), 0.05); }
  /** A kocsma és a toronyóra helye a világban (a V finomíthat). */
  helyek(o) { Object.assign(this._helyek, o); }

  // ── bankok ──
  _bank(id) {
    let b = this._banks.get(id); if (b) return b;
    const def = SHOTS[id] || GRAINS[id], c = this.ctx, sr = c.sampleRate; b = [];
    for (let k = 0; k < def.v; k++) {
      const x = levelize(GEN[id](sr, rng(hash(id) + k * 7919), k), sr, CAT[def.cat], def.loop);
      const buf = c.createBuffer(1, x.length, sr); buf.copyToChannel(x, 0); b.push(buf);
    }
    this._banks.set(id, b); return b;
  }
  _prewarm() {
    if (this._pw) return; this._pw = true;
    const ids = [...Object.keys(GRAINS).filter(k => k !== 'b_kocsma'), ...Object.keys(SHOTS)];
    const idle = typeof requestIdleCallback === 'function' ? f => requestIdleCallback(f, { timeout: 500 }) : f => setTimeout(f, 16);
    const step = () => { const id = ids.shift(); if (!id) return; this._bank(id); idle(step); };
    idle(step);
  }
  _bed(kind, t) {
    const c = this.ctx; let b = this._noise[kind];
    if (!b) { const x = makeNoise(kind, c.sampleRate, rng(hash('zaj-' + kind))); b = c.createBuffer(1, x.length, c.sampleRate); b.copyToChannel(x, 0); this._noise[kind] = b; }
    const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(t ?? this.now(), this.rnd() * b.duration * 0.9); return s;
  }
  _wave(nev, cyl) {
    if (this._waves[nev]) return this._waves[nev];
    const N = 40, re = new Float32Array(N), im = new Float32Array(N), R = rng(hash(nev));
    for (let n = 1; n < N; n++) { let a = 1 / Math.pow(n, 0.85); if (cyl === 2 && n % 2 === 0) a *= 0.6; if (cyl === 4 && n % 2 === 0) a *= 1.3; im[n] = a * (R() < 0.5 ? -1 : 1); }
    return (this._waves[nev] = this.ctx.createPeriodicWave(re, im));
  }
  _grain(id, dest, t, o = {}) {
    if (t < this.now() - 0.03) return;   // lemaradt esemény (háttérbe tett lap): eldobjuk, nem torlódik
    const c = this.ctx, bufs = this._bank(id), s = c.createBufferSource();
    s.buffer = bufs[Math.floor(this.rnd() * bufs.length)]; s.playbackRate.value = o.rate ?? 1;
    const g = gn(c, o.vol ?? 1); s.connect(g); g.connect(dest); s.start(t);
    s.onended = () => g.disconnect();
  }
  _panBus(dest) {
    return [-0.85, -0.4, 0, 0.4, 0.85].map(p => { const sp = this.ctx.createStereoPanner(); sp.pan.value = p; sp.connect(dest); return sp; });
  }
  _exp(lam) { return -Math.log(1 - this.rnd()) / Math.max(lam, 1e-3); }

  // ── térbeliség ──
  listener(camera) { this._cam = camera; }
  _updListener(t) {
    const e = this._cam.matrixWorld && this._cam.matrixWorld.elements; if (!e) return;
    const L = this.ctx.listener, p = { x: e[12], y: e[13], z: e[14] };
    let fx = -e[8], fy = -e[9], fz = -e[10]; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    let ux = e[4], uy = e[5], uz = e[6]; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    this._lp = p;
    if (L.positionX) {
      const tau = 0.02;
      L.positionX.setTargetAtTime(p.x, t, tau); L.positionY.setTargetAtTime(p.y, t, tau); L.positionZ.setTargetAtTime(p.z, t, tau);
      L.forwardX.setTargetAtTime(fx, t, tau); L.forwardY.setTargetAtTime(fy, t, tau); L.forwardZ.setTargetAtTime(fz, t, tau);
      L.upX.setTargetAtTime(ux, t, tau); L.upY.setTargetAtTime(uy, t, tau); L.upZ.setTargetAtTime(uz, t, tau);
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fx, fy, fz, ux, uy, uz); }
  }
  _chain(o, def, bus) {
    const c = this.ctx; bus = bus || this.sfxBus;
    if (!o.pos || this._flat) return { input: bus, p: null };
    const air = bq(c, 'lowpass', 18000, 0.5), p = c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = def.ref ?? 1.5; p.rolloffFactor = def.roll ?? 1; p.maxDistance = 10000;
    air.connect(p); p.connect(bus);
    const ch = { input: air, p, air, pos: o.pos };
    this._place(ch, this.now(), true);
    return ch;
  }
  _place(ch, t, first) {
    const v = toV(ch.pos); if (!v) return;
    const p = ch.p;
    if (p.positionX) {
      if (first) { p.positionX.setValueAtTime(v.x, t); p.positionY.setValueAtTime(v.y, t); p.positionZ.setValueAtTime(v.z, t); }
      else { p.positionX.setTargetAtTime(v.x, t, 0.04); p.positionY.setTargetAtTime(v.y, t, 0.04); p.positionZ.setTargetAtTime(v.z, t, 0.04); }
    } else p.setPosition(v.x, v.y, v.z);
    const d = Math.hypot(v.x - this._lp.x, v.y - this._lp.y, v.z - this._lp.z); ch.d = d;
    const f = Math.max(1500, Math.min(18000, 18000 * Math.exp(-d / 140)));   // levegőelnyelés: a messzi hang tompább
    if (first) ch.air.frequency.setValueAtTime(f, t); else ch.air.frequency.setTargetAtTime(f, t, 0.1);
  }

  // ── egyszeri hangok ──
  play(id, o = {}) {
    id = ALIAS[id] || id;
    const def = SHOTS[id] || GRAINS[id];
    if (!def) { this._warn(id); return null; }
    if (!this._ready()) return null;
    const c = this.ctx, t = o.when != null ? o.when : this.now() + 0.003;
    const bufs = this._bank(id), s = c.createBufferSource();
    s.buffer = bufs[Math.floor(this.rnd() * bufs.length)];
    const sp = def.spread ?? 0.03; s.playbackRate.value = (o.pitch ?? 1) * (1 + (this.rnd() * 2 - 1) * sp);
    const g = gn(c, (o.vol ?? 1) * dB(def.gain ?? 0)), ch = this._chain(o, def, o.bus);
    s.connect(g); g.connect(ch.input); s.start(t);
    s.onended = () => { try { g.disconnect(); if (ch.p) { ch.p.disconnect(); ch.air.disconnect(); } } catch (e) { /* már leválasztva */ } };
    return { stop: (f = 0.05) => { const n = this.now(); g.gain.setTargetAtTime(0, n, f / 3); try { s.stop(n + f + 0.05); } catch (e) { /* már leállt */ } } };
  }
  lepes(felulet, o = {}) { return this.play('lepes_' + (felulet || 'fold'), o); }
  _warn(id) { if (!this._warned.has(id)) { this._warned.add(id); console.warn('[hang] ismeretlen hang:', id); } }

  // ── hurkok ──
  loop(id, o = {}) {
    id = ALIAS[id] || id;
    const def = LOOPS[id];
    const dummy = { set() { return dummy; }, stop() {}, alive: false };
    if (!def) { this._warn(id); return dummy; }
    if (!this._ensure()) return dummy;
    const c = this.ctx, t = this.now() + 0.01, H = this;
    const P = {}; for (const p of def.params || []) P[p.k] = p.def; Object.assign(P, o);
    const L = { id, o: { ...o }, alive: true, dop: 1 };
    const vol = () => (L.o.vol ?? 1) * dB(def.gain ?? 0);
    const vg = gn(c, 0), ch = this._chain(o, def, o.bus);
    vg.connect(ch.input);
    vg.gain.setValueAtTime(0, t); vg.gain.setTargetAtTime(vol(), t, (o.fade ?? 0.15) / 3);
    const inst = def.build(this, vg, P, t);
    Object.assign(L, { vg, ch, inst });
    this._loops.add(L);
    const handle = {
      set(p = {}) {
        if (!L.alive) return handle;
        const t = H.now(); Object.assign(L.o, p);
        if (p.vol != null) vg.gain.setTargetAtTime(vol(), t, 0.08);
        if (p.pos) L.ch.pos = p.pos;
        if (inst.update) inst.update(p, t);
        return handle;
      },
      stop(fade = 0.3) {
        if (!L.alive) return; L.alive = false; H._loops.delete(L);
        const t = H.now(); vg.gain.setTargetAtTime(0, t, Math.max(0.01, fade / 4));
        for (const s of inst.srcs) { try { s.stop(t + fade + 0.1); } catch (e) { /* már leállt */ } }
        if (!H._offline) setTimeout(() => { try { vg.disconnect(); if (ch.p) { ch.p.disconnect(); ch.air.disconnect(); } } catch (e) { /* kész */ } }, (fade + 0.4) * 1000);
      },
      get alive() { return L.alive; },
    };
    return handle;
  }

  // ── ütemező ──
  _tick() {
    if (!this.ctx) return;
    const t = this.now(), t1 = t + LOOK;
    if (this._cam && !this._flat) this._updListener(t);
    for (const L of this._loops) {
      if (L.ch.p) {
        this._place(L.ch, t, false);
        if (L.o.doppler) {   // Doppler: a forrás sugárirányú sebességéből (a PannerNode ezt már nem tudja)
          if (L.dPrev != null && t - L.tPrev > 0.001) {
            const vr = (L.ch.d - L.dPrev) / (t - L.tPrev), f = Math.max(0.8, Math.min(1.25, 343 / (343 + vr)));
            L.dop = L.dop * 0.6 + f * 0.4; if (L.inst.update) L.inst.update({ dop: L.dop }, t);
          }
          L.dPrev = L.ch.d; L.tPrev = t;
        }
      }
      if (L.inst.pump) L.inst.pump(t, t1);
    }
    this._scenes = this._scenes.filter(sc => sc.step(t));
    if (this._amb) this._ambPump(t, t1);
  }

  // ── környezeti réteg ──
  ambient(o = {}) {
    if (!this._ensure()) return;
    const A = this._amb || this._buildAmb(), t = this.now();
    if (o.napszak != null) {
      const hNew = (((o.napszak % 1) + 1) % 1) * 24, a = A.hPrev;
      if (a != null) {   // egész óra elmúlt → a toronyóra üt
        const crossed = (hNew > a && hNew - a < 1.5 && Math.floor(hNew) !== Math.floor(a)) || (hNew < a && a - hNew > 22.5);
        if (crossed) { const n = (Math.floor(hNew) % 12) || 12; for (let i = 0; i < n; i++) A.strikes.push(t + 0.8 + i * 2.4); }
      }
      A.hPrev = hNew;
    }
    Object.assign(A.st, o);
    this._ambTargets(t);
  }
  /** Keverő: rétegenkénti szorzó (0..2), pl. {madar: 0.5}. */
  ambientMix(m) { if (!this._amb) this.ambient({}); Object.assign(this._amb.mix, m); this._ambTargets(this.now()); }
  ambientSzintek() { return this._amb ? { ...this._amb.lv } : {}; }
  ambientStop() {
    const A = this._amb; if (!A) return;
    for (const g of Object.values(A.g)) g.gain.setTargetAtTime(0, this.now(), 0.3);
    A.off = true;
  }
  _buildAmb() {
    const c = this.ctx, t = this.now(), R = this.rnd;
    const A = { st: { napszak: 0.5, regio: 'tanya', eso: false }, mix: {}, lv: {}, g: {}, pan: {}, hPrev: null, strikes: [], cr: [] };
    for (const [k] of AMB_LAYERS) { A.mix[k] = 1; A.lv[k] = 0; A.g[k] = gn(c, 0); A.g[k].connect(this.ambBus); A.pan[k] = this._panBus(A.g[k]); }
    A.szel = this.loop('szel', { bus: A.g.szel });
    const vs = this._bed('brown', t), vl = bq(c, 'lowpass', 260, 0.6); vs.connect(vl); vl.connect(A.g.varos);
    for (let i = 0; i < 5; i++) A.cr.push({ next: t + R() * 2, per: 0.42 + R() * 0.33, vol: 0.3 + 0.7 * R(), rate: 0.96 + 0.08 * R(), pan: A.pan.tucsok[i] });
    A.next = { madar: t + 0.5, beka: t + 1.5, kutya: t + 3 + R() * 6, kakas: t + 2 + R() * 3 };
    this._amb = A; return A;
  }
  _ambTargets(t) {
    const A = this._amb, s = A.st, h = (((s.napszak % 1) + 1) % 1) * 24, rg = s.regio, rain = s.eso ? 1 : 0;
    A.off = false;
    const day = sm(4.8, 6.8, h) * (1 - sm(19.3, 21.3, h)), night = 1 - day;
    const dawn = Math.exp(-((h - 6.2) ** 2) / (2 * 0.8 ** 2));
    const L = {
      szel: (0.5 + (rg === 'szolohegy' ? 0.5 : 0)) * (0.7 + 0.3 * day) + 0.3 * rain,
      madar: day * (0.6 + 0.6 * dawn) * (1 - 0.8 * rain),
      tucsok: night * (1 - 0.7 * rain) * (rg === 'kisvaros' ? 0.3 : 1),
      beka: night * (rg === 'falu' || rg === 'major' ? 1 : 0.5) * (1 - 0.5 * rain),
      kutya: rg === 'kisvaros' ? 0.4 : 1,
      kakas: rg === 'kisvaros' ? 0 : 1,
      harang: 1,
      kocsma: rg === 'falu' ? (h >= 10 ? 0.35 + 0.65 * sm(17, 20, h) : h < 1 ? 0.6 : 0) : 0,
      varos: rg === 'kisvaros' ? 0.5 + 0.5 * day : 0,
      eso: rain,
    };
    for (const [k, , base] of AMB_LAYERS) {
      const v = clamp01(L[k]) * (A.mix[k] ?? 1);
      A.lv[k] = v; A.g[k].gain.setTargetAtTime(v * base, t, 1.0);
    }
    if (rain && !A.eso) A.eso = this.loop('eso', { bus: A.g.eso });
    if (A.eso) A.eso.set({ int: rain });
    if (L.kocsma > 0 && !A.kocsma) A.kocsma = this.loop('kocsma', { bus: A.g.kocsma, pos: this._helyek.kocsma });
  }
  _ambPump(t0, t1) {
    const A = this._amb, R = this.rnd, h = (((A.st.napszak % 1) + 1) % 1) * 24;
    const pick = a => a[Math.floor(R() * a.length)], on = k => !A.off && A.lv[k] > 0.02;
    const nxt = (k, lam, fire) => {
      if (!on(k)) { A.next[k] = Math.max(A.next[k], t1); return; }
      while (A.next[k] < t1) { fire(A.next[k]); A.next[k] += this._exp(lam); }
    };
    nxt('madar', 0.15 + 0.55 * A.lv.madar, tt => this._grain('g_madar', pick(A.pan.madar), tt, { vol: 0.25 + 0.75 * R(), rate: 0.94 + 0.12 * R() }));
    for (const cr of A.cr) {
      if (!on('tucsok')) { cr.next = Math.max(cr.next, t1); continue; }
      while (cr.next < t1) { this._grain('g_tucsok', cr.pan, cr.next, { vol: cr.vol, rate: cr.rate }); cr.next += cr.per * (0.97 + 0.06 * R()); if (R() < 0.02) cr.next += 2 + R() * 5; }
    }
    nxt('beka', 0.35 * A.lv.beka + 0.05, tt => this._grain('g_beka', pick(A.pan.beka), tt, { vol: 0.4 + 0.6 * R(), rate: 0.85 + 0.3 * R() }));
    const nightish = h < 5 || h > 21;
    nxt('kutya', (nightish ? 1 / 12 : 1 / 28) * A.lv.kutya, tt => this.play('kutya', { when: tt, bus: pick(A.pan.kutya), vol: 0.4 + 0.6 * R() }));
    if (h >= 4.6 && h <= 7.8) nxt('kakas', 1 / 30, tt => this.play('kakas', { when: tt, bus: pick(A.pan.kakas), vol: 0.4 + 0.5 * R() }));
    else A.next.kakas = Math.max(A.next.kakas, t1);
    while (A.strikes.length && A.strikes[0] < t1) this.play('harang', { when: A.strikes.shift(), pos: this._helyek.torony, bus: A.g.harang });
  }

  // ── jelenetek ──
  /** 'penzugyor': az autó a Fő úton közeledik, lassít, fékez a kapu előtt, a motor leáll, ajtó csapódik, lépések. */
  jelenet(nev, o = {}) {
    if (nev !== 'penzugyor' || !this._ensure()) return null;
    const H = this, t0 = this.now(), vol = o.vol ?? 1;
    const stop = toV(o.pos) || { x: 0, y: 0.7, z: 17.5 }, from = toV(o.from) || { x: stop.x - 160, y: stop.y, z: stop.z };
    const kapu = toV(o.kapu) || { x: stop.x, y: 0, z: stop.z - 5 };
    const T = o.ido ?? 7.5, car = { ...from };
    const h = this.loop('motor_penzugyor', { pos: car, rpm: 0.55, gaz: 0.5, doppler: true, vol });
    const ev = [
      [T - 1.25, () => H.play('fek', { pos: { ...stop }, vol })],
      [T, () => h.set({ rpm: 0.03, gaz: 0.1 })],
      [T + 1.4, () => h.stop(0.5)],
      [T + 2.1, () => H.play('ajto_csapas', { pos: { ...stop }, vol })],
    ];
    for (let i = 0; i < 5; i++) {
      const u = (i + 1) / 5;
      ev.push([T + 2.8 + i * 0.55, () => H.play('lepes_aszfalt', { pos: { x: stop.x + (kapu.x - stop.x) * u, y: 0, z: stop.z + (kapu.z - stop.z) * u }, vol })]);
    }
    const sc = {
      step(t) {
        const u = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - u, 2.2);
        car.x = from.x + (stop.x - from.x) * e; car.y = from.y + (stop.y - from.y) * e; car.z = from.z + (stop.z - from.z) * e;
        if (u < 1) h.set({ rpm: 0.12 + 0.45 * Math.pow(1 - u, 1.2), gaz: u < 1 - 1.25 / T ? 0.45 : 0.05 });
        while (ev.length && t >= t0 + ev[0][0]) ev.shift()[1]();
        return ev.length > 0;
      },
    };
    this._scenes.push(sc);
    return { stop() { h.stop(); ev.length = 0; } };
  }

  // ── a szimuláció eseményei ──
  esemeny(evt) {
    if (!evt) return;
    switch (evt.type) {
      case 'sfx': return this.play(evt.id, { pos: evt.pos, vol: evt.vol });
      case 'sms': return this.play('sms');
      case 'rankUp': return this.play('rangemeles');
      case 'sale': return this.play('penz_papir', { pos: evt.pos });
      case 'search': case 'raid': return this.play('gyanu');
      default: return null;
    }
  }

  // ── mérés, bemutató ──
  static ids() {
    return {
      egyszeri: Object.entries(SHOTS).map(([id, d]) => ({ id, nev: d.nev, cat: d.cat })),
      hurok: Object.entries(LOOPS).map(([id, d]) => ({ id, nev: d.nev, params: d.params || [] })),
      retegek: AMB_LAYERS.map(([id, nev]) => ({ id, nev })),
      alias: { ...ALIAS },
    };
  }
  /** A mérőeszköz (tools/hang_meres.py) ezt rendereli végig. */
  static katalogus() {
    const L = [];
    for (const [id, d] of Object.entries(SHOTS)) L.push({ nev: id, kind: 'play', id, dur: d.dur + 0.25, kat: d.cat, szint: 'max100', spektro: !!d.spektro });
    for (const s of ['fu', 'fold', 'aszfalt', 'fa']) L.push({ nev: `lepes_${s}_seta`, kind: 'seta', id: `lepes_${s}`, n: 8, koz: 0.52, dur: 4.7, spektro: true });
    const lp = (nev, id, params, o = {}) => L.push({ nev, kind: 'loop', id, params, dur: 7, skip: 1.5, szint: 'rms', folyamatos: true, ...o });
    // A ropogás, az esőcsepp és a racsni szándékos tranziens: rájuk a kattanás-kapu nem vonatkozik
    // (a hurokvarratukat a varratok() méri, a zajágyuk egybefüggő).
    const tz = { sulypont: [400, 5000], tonus: 20, folyamatos: false };
    lp('tuz_gyenge', 'tuz', { ero: 0.2 }, tz); lp('tuz_kozepes', 'tuz', { ero: 0.6 }, { ...tz, kat: 'ust', spektro: true }); lp('tuz_eros', 'tuz', { ero: 1 }, { ...tz, spektro: true });
    lp('forras_langyos', 'forras', { ho: 0.3 }); lp('forras_forro', 'forras', { ho: 0.75 }, { kat: 'ust', spektro: true, sulypont: [120, 2000] }); lp('forras_tombolo', 'forras', { ho: 1 });
    const cs = { folyamatos: false };
    lp('csepeges_lassu', 'csepeges', { seb: 0.2, tele: 0.1 }, cs); lp('csepeges_kozepes', 'csepeges', { seb: 0.6, tele: 0.5 }, { ...cs, kat: 'ust', spektro: true }); lp('csepeges_gyors', 'csepeges', { seb: 1, tele: 0.9 }, cs);
    const ramp = [[2, { rpm: 0.9, gaz: 1 }], [5, { rpm: 0.3, gaz: 0.2 }], [7, { rpm: 0.05, gaz: 0.1 }]];
    lp('motor_penzugyor_felporges', 'motor_penzugyor', { rpm: 0.05, gaz: 0.2 }, { dur: 9, skip: 0.5, timeline: ramp, spektro: true, sulypont: [60, 2500] });
    lp('motor_kisauto_felporges', 'motor_kisauto', { rpm: 0.05, gaz: 0.2 }, { dur: 9, skip: 0.5, timeline: ramp, spektro: true, sulypont: [60, 2500] });
    lp('motor_penzugyor_alapjarat', 'motor_penzugyor', { rpm: 0.05, gaz: 0.15 }, { kat: 'motor' });
    lp('motor_kisauto_alapjarat', 'motor_kisauto', { rpm: 0.05, gaz: 0.15 }, { kat: 'motor' });
    lp('bicikli_teker', 'bicikli', { seb: 0.6, teker: true }); lp('bicikli_gurul', 'bicikli', { seb: 0.6, teker: false }, { spektro: true, folyamatos: false });
    lp('kocsma', 'kocsma', {}, { dur: 10, spektro: true }); lp('eso', 'eso', {}, { spektro: true, folyamatos: false }); lp('szel', 'szel', {}, { dur: 10, spektro: true, sulypont: [150, 1500], tonus: 20 });
    const am = (nev, params, o = {}) => L.push({ nev, kind: 'ambient', params, dur: 12, skip: 3.5, szint: 'rms', folyamatos: true, hallgato: [0, 1.7, 0], ...o });
    am('kornyezet_ejjel_csend', { napszak: 0.95, regio: 'tanya', eso: false }, { spektro: true, hfmax: -60 });
    am('kornyezet_hajnal', { napszak: 0.26, regio: 'tanya' }, { spektro: true, dur: 20 });
    am('kornyezet_del', { napszak: 0.5, regio: 'tanya' }, { hfmax: -60 });
    am('kornyezet_falu_este', { napszak: 0.85, regio: 'falu' }, { hallgato: [214, 1.7, 12], spektro: true });
    am('kornyezet_eso', { napszak: 0.55, regio: 'tanya', eso: true }, { folyamatos: false });
    am('orautes_3', { napszak: 2.97 / 24, regio: 'tanya' }, { dur: 18, skip: 1, timeline: [[3, { napszak: 3.02 / 24 }]], spektro: true });
    L.push({ nev: 'penzugyor_jelenet', kind: 'jelenet', id: 'penzugyor', params: { pos: [0, 0.7, 17.5] }, dur: 14, szint: 'rms', spektro: true, hallgato: [0, 1.7, 8] });
    return L;
  }
  /** Egy katalógus-tétel offline renderje (OfflineAudioContext, sztereó). */
  static async render(spec, { sampleRate = 48000 } = {}) {
    const c = new OfflineAudioContext(2, Math.ceil(spec.dur * sampleRate), sampleRate);
    const spatial = spec.kind === 'ambient' || spec.kind === 'jelenet';
    const H = new Hang({ ctx: c, seed: spec.seed ?? 7, limiter: false, flat: !spatial });
    const start = 0.05; H._virt = start;
    if (spec.hallgato) { const [x, y, z] = spec.hallgato; H.listener({ matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1] } }); H._updListener(start); }
    let handle = null;
    if (spec.kind === 'play') H.play(spec.id, { ...(spec.params || {}), when: start });
    else if (spec.kind === 'seta') for (let k = 0; k < spec.n; k++) H.play(spec.id, { when: start + k * spec.koz });
    else if (spec.kind === 'loop') handle = H.loop(spec.id, spec.params || {});
    else if (spec.kind === 'ambient') H.ambient(spec.params || {});
    else if (spec.kind === 'jelenet') H.jelenet(spec.id, spec.params || {});
    const tl = (spec.timeline || []).slice().sort((a, b) => a[0] - b[0]); let li = 0;
    for (let t = start; t < spec.dur; t += 0.025) {
      H._virt = t;
      while (li < tl.length && tl[li][0] <= t) { const p = tl[li++][1]; if (spec.kind === 'ambient') H.ambient(p); else if (handle) handle.set(p); }
      H._tick();
    }
    return c.startRendering();
  }
  /** Hurokvarratok: zajpufferek és a kocsmazsivaj vége→eleje ugrása a tipikus mintakülönbséghez mérve. */
  static varratok(sr = 48000) {
    const out = [];
    const check = (nev, x) => {
      let s = 0; for (let i = 1; i < x.length; i++) { const d = x[i] - x[i - 1]; s += d * d; }
      const typ = Math.sqrt(s / (x.length - 1)), jump = Math.abs(x[0] - x[x.length - 1]);
      out.push({ nev, ugras: jump, tipikus: typ, arany: jump / Math.max(typ, 1e-12) });
    };
    for (const k of ['white', 'pink', 'brown']) check('zaj_' + k, makeNoise(k, sr, rng(hash('zaj-' + k))));
    check('kocsma_zsivaj', GEN.b_kocsma(sr, rng(hash('b_kocsma'))));
    return out;
  }
  /** Csonkolás-próba: minden egyszeri hang minden változatának utolsó 30 ms-a (a kifutó 8 ms előtt) a csúcshoz mérve. */
  static vegek(sr = 48000) {
    const out = [];
    for (const [id, def] of Object.entries(SHOTS)) {
      let worst = -200;
      for (let k = 0; k < def.v; k++) {
        const x = levelize(GEN[id](sr, rng(hash(id) + k * 7919), k), sr, CAT[def.cat]);
        let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
        const e = x.length - Math.ceil(0.008 * sr), b = Math.max(0, e - Math.ceil(0.03 * sr));
        let s = 0; for (let i = b; i < e; i++) s += x[i] * x[i];
        const db = 20 * Math.log10(Math.sqrt(s / Math.max(1, e - b)) / Math.max(pk, 1e-9) + 1e-12);
        worst = Math.max(worst, db);
      }
      out.push({ id, farok_db: worst });
    }
    return out;
  }
}

export default Hang;
