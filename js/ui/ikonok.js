// Kisüsti UI — saját vonalas ikonok (24×24, currentColor). Semmi átvett jelkép, semmi valódi márka.
const P = {
  uzenetek: '<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  nevjegyek: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.6"/><path d="M5 17c.8-2.2 2.2-3 4-3s3.2.8 4 3M15 9h3M15 12h3"/>',
  terkep: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/><circle cx="12" cy="11" r="1.4"/>',
  recept: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M12 6.5c1.6 1.9 2.2 3 2.2 3.8a2.2 2.2 0 0 1-4.4 0c0-.8.6-1.9 2.2-3.8z"/>',
  rendeles: '<path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v9M7.5 6l9 4"/>',
  terjesztok: '<circle cx="8" cy="8" r="2.6"/><circle cx="16.5" cy="9" r="2.2"/><path d="M3.5 19c.6-3.2 2.3-4.6 4.5-4.6s3.9 1.4 4.5 4.6M13.2 18.5c.5-2.4 1.7-3.4 3.3-3.4s2.8 1 3.3 3.4"/>',
  birodalom: '<path d="M3 11l9-6 9 6"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/><path d="M15 6V3.5h2.4V8"/>',
  bank: '<path d="M3 15c0-2.2 3-3.2 9-3.2s9 1 9 3.2-3 3.5-9 3.5-9-1.3-9-3.5z"/><path d="M5.5 12.6c.4-1.6 2.6-2.4 6.5-2.4s6.1.8 6.5 2.4"/><rect x="9" y="3" width="6" height="5.5" rx="1"/><path d="M12 4.6v2.3"/>',
  fuzet: '<rect x="5" y="3" width="13" height="18" rx="1.5"/><path d="M8 3v18M11 8h4M11 11h4"/><path d="M20 6l-3.5 9.5-1 1.6.2-1.9z"/>',
  beallitasok: '<circle cx="7" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="17" r="2"/><path d="M9 7h11M4 7h1M18 12h2M4 12h10M11 17h9M4 17h3"/>',
  mentes: '<path d="M8 3h8v3H8z"/><path d="M7 6h10l1 3v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"/><path d="M6.5 12h11"/><path d="M10 15.5c.6.8 1.3 1.2 2 1.2s1.4-.4 2-1.2"/>',
  naplo: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 10.5h6M9 14h6M9 17.5h3"/>',
  // HUD
  nap: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  hold: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  zseb: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4zM6 7l9-3 1.5 3"/>',
  dunyha: '<path d="M3 9c3-2 15-2 18 0v8c-3 2-15 2-18 0z"/><path d="M7 9.4v9M12 8.6v10.2M17 9.4v9"/>',
  szamla: '<path d="M3 9l9-5 9 5"/><path d="M5 9v8M9.5 9v8M14.5 9v8M19 9v8M3 20h18"/>',
  auto: '<path d="M4 15v-3l2-5h12l2 5v3"/><path d="M3 15h18v3H3z"/><circle cx="7.5" cy="18" r="1.6"/><circle cx="16.5" cy="18" r="1.6"/><path d="M6.5 11.5h11"/>',
  figyelem: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 17.6v.2"/>',
  pohar: '<path d="M7 3h10l-1.5 9a3.5 3.5 0 0 1-7 0z"/><path d="M12 15.5V20M8.5 21h7M8 7h8"/>',
  fa: '<circle cx="12" cy="9" r="6"/><path d="M12 15v6M9 21h6M10 9.5l2 2 2.5-3"/>',
  hordo: '<path d="M6 3h12c1.2 3 1.2 15 0 18H6C4.8 18 4.8 6 6 3z"/><path d="M5 8h14M5 16h14"/>',
  csepp: '<path d="M12 3c4 5 6 8 6 10.5a6 6 0 0 1-12 0C6 11 8 8 12 3z"/>',
  tragya: '<path d="M5 9h14l-1.5 11h-11z"/><path d="M8 9c0-2 1.8-3.5 4-3.5S16 7 16 9M9 14h6"/>',
  permet: '<rect x="7" y="9" width="8" height="12" rx="2"/><path d="M11 9V6h6M17 4.5v3M19.5 5l-1 1M19.5 8l-1-1"/>',
  kosar: '<path d="M3 10h18l-2 10H5z"/><path d="M7 10l4-6M17 10l-4-6M8 14v3M12 14v3M16 14v3"/>',
  csillag: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  lakat: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5"/>',
};
export function ikon(nev, cls = '') {
  return `<svg class="ku-i ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[nev] || ''}</svg>`;
}
