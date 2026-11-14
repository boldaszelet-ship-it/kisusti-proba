// Kisüsti UI — közös HTML-építőkockák (sor, szakasz, léptető, visszajelzés, érem). Csak szöveget ad vissza.
import { esc, monogram, hex } from './kozos.js';

/** Lista-sor gombként (fókuszálható, kattintható). */
export const sor = (a, v, bal, jobb = '', cls = '', extra = '') =>
  `<button class="ku-sor ${cls}" data-a="${esc(a)}" data-v="${esc(v)}" ${extra}><span class="ku-sor-b">${bal}</span>${jobb ? `<span class="ku-sor-j">${jobb}</span>` : ''}</button>`;
export const szakasz = (t, jobb = '') => `<div class="ku-szakasz"><span>${t}</span>${jobb ? `<i>${jobb}</i>` : ''}</div>`;
export const ures = t => `<div class="ku-ures">${t}</div>`;
/** Léptető: ←→ állítja, a ± gomb egérrel. st = {v, min, max, lepes, fmt?} */
export const lepteto = (nev, st, cimke, cls = '') =>
  `<div class="ku-lep ${cls}" data-st="${esc(nev)}" tabindex="0" role="spinbutton" aria-valuenow="${st.v}"><span class="ku-lep-c">${cimke}</span>` +
  `<button class="ku-fiz" tabindex="-1" data-a="@st-" data-v="${esc(nev)}" ${st.v <= st.min ? 'disabled' : ''}>−</button>` +
  `<b>${st.fmt ? st.fmt(st.v) : st.v}</b>` +
  `<button class="ku-fiz" tabindex="-1" data-a="@st+" data-v="${esc(nev)}" ${st.v >= st.max ? 'disabled' : ''}>+</button></div>`;
/**
 * Egy parancs eredménye után fut `f`. Egyjátékosban az Empire szinkron választ ad: `f` azonnal, ugyanabban a hívásban
 * fut (a viselkedés bitre a régi). Közös játékban a parancs ígéret (a házigazda dönt): `f` a válasz megérkezésekor fut,
 * és az ígéretet adja vissza, hogy a hívó láncolhasson.
 */
export const utana = (r, f) => (r && typeof r.then === 'function' ? r.then(f) : f(r));
/** Egy művelet eredménye a lapon (zöld/piros sáv). okText lehet függvény is (az eredményből számolt szöveg). */
export function vj(lap, r, okText) {
  if (!r) return;
  if (typeof r.then === 'function') {
    // közös játék: a gombnyomás azonnal látszik („küldve”), a végleges sáv a házigazda válaszával jön
    lap.vjel = { ok: true, t: 'Küldve…' }; lap.vjelT = performance.now();
    r.then(x => { vj(lap, x, okText); lap.ujraRajz = true; });
    return;
  }
  if (typeof okText === 'function') okText = r.ok === false ? null : okText(r);
  lap.vjel = r.ok === false || r.siker === false ? { ok: false, t: r.hiba || r.valasz || 'Nem sikerült.' } : { ok: true, t: okText ?? r.valasz ?? 'Kész.' };
  lap.vjelT = performance.now();
}
export const vjHtml = lap => lap.vjel && performance.now() - lap.vjelT < 12000
  ? `<div class="ku-vj ${lap.vjel.ok ? 'jo' : 'rossz'}" role="status">${esc(lap.vjel.t)}</div>` : '';
/** Monogramos érem a vevőkhöz; a gyűrű színe a hangulat (hűség vagy reakció). */
export function erem(nev, hangulat = 0.5, cls = '') {
  const h = Math.round(20 + hangulat * 100);
  return `<span class="ku-erem ${cls}" style="--h:${h}">${esc(monogram(nev))}</span>`;
}
export const sav = (arany, cls = '') => `<span class="ku-sav ${cls}"><i style="width:${Math.max(0, Math.min(1, arany)) * 100}%"></i></span>`;
export const cimke = (t, cls = '') => `<span class="ku-cimke ${cls}">${t}</span>`;
export const gombok = (...b) => `<div class="ku-gombok">${b.filter(Boolean).join('')}</div>`;
export const gomb = (a, v, t, cls = '', extra = '') => `<button class="ku-b ${cls}" data-a="${esc(a)}" data-v="${esc(v)}" ${extra}>${t}</button>`;
export const kv = (k, v, cls = '') => `<div class="ku-kv ${cls}"><span>${k}</span><b>${v}</b></div>`;
export { hex };
