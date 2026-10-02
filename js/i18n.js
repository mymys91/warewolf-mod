// UI strings in Vietnamese and English. Role text lives in roles.js.
export const UI = {
  'deal.handoff': { vi: 'Đưa máy cho {name}', en: 'Pass the phone to {name}' },
  'phase.night': { vi: 'Đêm {n}', en: 'Night {n}' },
  'phase.day': { vi: 'Ngày {n}', en: 'Day {n}' },
};

export function t(key, lang, params = {}) {
  const entry = UI[key];
  if (!entry) return key;
  return localize(entry, lang).replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m));
}

export function localize(text, lang) {
  const other = lang === 'vi' ? 'en' : 'vi';
  return text?.[lang] || text?.[other] || '';
}

export function phaseLabel(phase, lang) {
  return t(phase.kind === 'night' ? 'phase.night' : 'phase.day', lang, { n: phase.number });
}
