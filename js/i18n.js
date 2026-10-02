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

  'roles.title': { vi: 'Vai trò', en: 'Roles' },
  'roles.total': { vi: '{x}/{n} vai', en: '{x}/{n} roles' },
  'roles.suggested': { vi: 'Đã gợi ý vai cho {n} người chơi. Bạn có thể chỉnh lại.', en: 'Suggested roles for {n} players. You can adjust them.' },
  'roles.noSuggest': { vi: 'Chỉ có gợi ý cho 5–20 người chơi. Hãy tự chọn số lượng vai.', en: 'Suggestions are only available for 5–20 players. Set the role counts yourself.' },
  'roles.more': { vi: 'Thêm một {name}', en: 'Add one {name}' },
  'roles.less': { vi: 'Bớt một {name}', en: 'Remove one {name}' },
  'roles.deal': { vi: 'Chia bài', en: 'Deal roles' },
  'roles.addCustom': { vi: '+ Thêm vai tùy chỉnh', en: '+ Add custom role' },
  'roles.edit': { vi: 'Sửa', en: 'Edit' },
  'roles.delete': { vi: 'Xóa', en: 'Delete' },
  'roles.deleteConfirm': { vi: 'Xóa vai "{name}"?', en: 'Delete the role "{name}"?' },
  'roles.deleteBlocked': { vi: 'Không thể xóa: vai này đang có trong ván đang chơi.', en: 'Cannot delete: this role is in the game in progress.' },
  'roles.custom': { vi: 'Tùy chỉnh', en: 'Custom' },

  'deal.progress': { vi: 'Người chơi {i}/{n}', en: 'Player {i} of {n}' },
  'deal.handoffLead': { vi: 'Đưa máy cho', en: 'Pass the phone to' },
  'deal.hint': { vi: 'Chỉ {name} được nhìn màn hình khi bấm Xem vai.', en: 'Only {name} should look at the screen after tapping See my role.' },
  'deal.see': { vi: 'Xem vai', en: 'See my role' },
  'deal.youAre': { vi: '{name}, vai của bạn là', en: '{name}, your role is' },
  'deal.hide': { vi: 'Đã xem, ẩn đi', en: 'Seen, hide it' },
  'deal.done': { vi: 'Đưa máy cho quản trò', en: 'Give the phone to the moderator' },
  'deal.doneHint': { vi: 'Mọi người đã xem vai. Chỉ quản trò được xem màn hình tiếp theo.', en: 'Everyone has seen their role. Only the moderator should see the next screen.' },
  'deal.iAmModerator': { vi: 'Tôi là quản trò', en: 'I am the moderator' },

  'tracker.title': { vi: 'Theo dõi ván', en: 'Game tracker' },
  'tracker.alive': { vi: '{n}/{total} người còn sống', en: '{n}/{total} players alive' },
  'tracker.hint': { vi: 'Chạm vào một người chơi còn sống để ghi nhận cái chết.', en: 'Tap a living player to record their death.' },
  'tracker.note': { vi: '+ Ghi chú', en: '+ Note' },
  'tracker.undo': { vi: 'Hoàn tác', en: 'Undo' },
  'tracker.next': { vi: 'Sang {phase}', en: 'Go to {phase}' },
  'tracker.end': { vi: 'Kết thúc ván', en: 'End game' },
  'tracker.howDied': { vi: '{name} chết vì?', en: 'How did {name} die?' },
  'tracker.noteTitle': { vi: 'Ghi chú cho {phase}', en: 'Note for {phase}' },
  'tracker.pickWinner': { vi: 'Ai thắng?', en: 'Who won?' },
  'tracker.suggested': { vi: '(gợi ý)', en: '(suggested)' },
  'tracker.confirm': { vi: 'Xác nhận', en: 'Confirm' },
  'tracker.keep': { vi: 'Chơi tiếp', en: 'Keep playing' },

  'causeBtn.wolf': { vi: 'Sói cắn', en: 'Killed by werewolves' },
  'causeBtn.hanged': { vi: 'Bị treo cổ', en: 'Hanged' },
  'causeBtn.poison': { vi: 'Phù Thủy đầu độc', en: 'Poisoned by the Witch' },
  'causeBtn.hunter': { vi: 'Thợ Săn bắn', en: 'Shot by the Hunter' },
  'causeBtn.lover': { vi: 'Chết theo người yêu', en: 'Died with their lover' },
  'causeBtn.other': { vi: 'Lý do khác', en: 'Other cause' },

  'cause.wolf': { vi: 'bị Sói cắn', en: 'was killed by the werewolves' },
  'cause.hanged': { vi: 'bị treo cổ', en: 'was hanged' },
  'cause.poison': { vi: 'bị Phù Thủy đầu độc', en: 'was poisoned by the Witch' },
  'cause.hunter': { vi: 'bị Thợ Săn bắn', en: 'was shot by the Hunter' },
  'cause.lover': { vi: 'chết theo người yêu', en: 'died with their lover' },
  'cause.other': { vi: 'chết (lý do khác)', en: 'died (other cause)' },

  'winner.village': { vi: 'Phe Dân', en: 'The village' },
  'winner.wolf': { vi: 'Phe Sói', en: 'The werewolves' },
  'winner.fool': { vi: 'Kẻ Ngốc', en: 'The Fool' },
  'winner.undecided': { vi: 'Không xác định', en: 'Undecided' },
  'win.village': { vi: 'Phe Dân thắng!', en: 'The village wins!' },
  'win.wolf': { vi: 'Phe Sói thắng!', en: 'The werewolves win!' },
  'win.fool': { vi: 'Kẻ Ngốc thắng!', en: 'The Fool wins!' },
  'win.undecided': { vi: 'Ván đấu kết thúc', en: 'The game is over' },

  'err.ALREADY_DEAD': { vi: 'Người này đã chết.', en: 'This player is already dead.' },
  'err.UNKNOWN_PLAYER': { vi: 'Không tìm thấy người chơi.', en: 'Player not found.' },
  'err.BAD_CAUSE': { vi: 'Lý do không hợp lệ.', en: 'Invalid cause.' },
  'err.EMPTY_NOTE': { vi: 'Ghi chú đang trống.', en: 'The note is empty.' },

  'team.wolf': { vi: 'Phe Sói', en: 'Werewolves' },
  'team.village': { vi: 'Phe Dân', en: 'Village' },
  'team.neutral': { vi: 'Trung lập', en: 'Neutral' },

  'custom.title': { vi: 'Vai tùy chỉnh', en: 'Custom role' },
  'custom.nameVi': { vi: 'Tên vai (Tiếng Việt) *', en: 'Role name (Vietnamese) *' },
  'custom.rulesVi': { vi: 'Luật chơi (Tiếng Việt) *', en: 'Rules (Vietnamese) *' },
  'custom.nameEn': { vi: 'Tên vai (Tiếng Anh, không bắt buộc)', en: 'Role name (English, optional)' },
  'custom.rulesEn': { vi: 'Luật chơi (Tiếng Anh, không bắt buộc)', en: 'Rules (English, optional)' },
  'custom.team': { vi: 'Phe', en: 'Team' },

  'err.NAME_REQUIRED': { vi: 'Hãy nhập tên vai bằng Tiếng Việt.', en: 'Enter the role name in Vietnamese.' },
  'err.RULES_REQUIRED': { vi: 'Hãy nhập luật chơi bằng Tiếng Việt.', en: 'Enter the rules in Vietnamese.' },
  'err.BAD_TEAM': { vi: 'Hãy chọn phe cho vai.', en: 'Choose a team for the role.' },

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
