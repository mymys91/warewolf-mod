// UI strings in Vietnamese and English. Role text lives in roles.js.
export const UI = {
  'deal.handoff': { vi: 'Đưa máy cho {name}', en: 'Pass the phone to {name}' },
  'phase.night': { vi: 'Đêm {n}', en: 'Night {n}' },
  'phase.day': { vi: 'Ngày {n}', en: 'Day {n}' },

  'app.title': { vi: 'Ma Sói', en: 'Werewolf' },
  'common.next': { vi: 'Tiếp', en: 'Next' },
  'common.back': { vi: '← Quay lại', en: '← Back' },
  'common.cancel': { vi: 'Hủy', en: 'Cancel' },
  'common.save': { vi: 'Lưu', en: 'Save' },

  'players.title': { vi: 'Người chơi', en: 'Players' },
  'players.add': { vi: '+ Thêm người chơi', en: '+ Add player' },
  'players.placeholder': { vi: 'Tên người chơi {n}', en: 'Player {n} name' },
  'players.remove': { vi: 'Xóa người chơi', en: 'Remove player' },
  'players.count': { vi: '{n} người chơi', en: '{n} players' },

  'err.TOO_FEW_PLAYERS': { vi: 'Cần ít nhất 3 người chơi.', en: 'At least 3 players are needed.' },
  'err.TOO_MANY_PLAYERS': { vi: 'Tối đa 30 người chơi.', en: 'At most 30 players are allowed.' },
  'err.EMPTY_NAME': { vi: 'Có tên người chơi đang để trống.', en: 'A player name is empty.' },
  'err.DUPLICATE_NAME': { vi: 'Có hai người chơi trùng tên.', en: 'Two players have the same name.' },
  'err.COUNT_MISMATCH': { vi: 'Tổng số vai phải bằng số người chơi.', en: 'The number of roles must equal the number of players.' },
  'err.NO_WOLF': { vi: 'Cần ít nhất một vai phe Sói.', en: 'At least one werewolf-team role is needed.' },
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
