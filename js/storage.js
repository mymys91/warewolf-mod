// localStorage wrapper with shape checks and an in-memory fallback (spec §9).
const KEYS = { lang: 'ww.lang', lastPlayers: 'ww.lastPlayers', customRoles: 'ww.customRoles', currentGame: 'ww.currentGame' };

function memoryBackend() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

function usable(backend) {
  try {
    backend.setItem('ww.probe', '1');
    backend.removeItem('ww.probe');
    return true;
  } catch {
    return false;
  }
}

const isLang = (v) => v === 'vi' || v === 'en';
const isNameList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isRoleList = (v) => Array.isArray(v) && v.every((r) => r && typeof r.id === 'string' && r.name && r.rules);
const isPlayer = (p) => p && typeof p.name === 'string' && typeof p.roleId === 'string';
const isPhase = (ph) => ph && (ph.kind === 'night' || ph.kind === 'day') && Number.isInteger(ph.number);
const isSavedGame = (v) => v && typeof v === 'object'
  && (v.stage === 'deal' || v.stage === 'check' || v.stage === 'tracker')
  && Number.isInteger(v.dealIndex)
  && v.game && Array.isArray(v.game.players) && v.game.players.every(isPlayer)
  && (v.game.events === undefined || Array.isArray(v.game.events))
  && (v.game.phase === undefined || isPhase(v.game.phase));

export function createStore(backend = globalThis.localStorage) {
  const persistent = !!backend && usable(backend);
  const store = persistent ? backend : memoryBackend();

  const read = (key, valid, fallback) => {
    try {
      const raw = store.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return valid(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try { store.setItem(key, JSON.stringify(value)); } catch { /* quota or privacy errors: ignore */ }
  };

  return {
    persistent,
    getLang: () => read(KEYS.lang, isLang, 'vi'),
    setLang: (lang) => write(KEYS.lang, lang),
    getLastPlayers: () => read(KEYS.lastPlayers, isNameList, []),
    setLastPlayers: (names) => write(KEYS.lastPlayers, names),
    getCustomRoles: () => read(KEYS.customRoles, isRoleList, []),
    setCustomRoles: (roles) => write(KEYS.customRoles, roles),
    getCurrentGame: () => read(KEYS.currentGame, isSavedGame, null),
    setCurrentGame: (saved) => write(KEYS.currentGame, saved),
    clearCurrentGame: () => {
      try { store.removeItem(KEYS.currentGame); } catch { /* ignore */ }
    },
  };
}
