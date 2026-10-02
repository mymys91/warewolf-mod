// Built-in roles and custom role helpers. Text is { vi, en }.
const role = (id, team, nameVi, nameEn, rulesVi, rulesEn) => ({
  id, team, name: { vi: nameVi, en: nameEn }, rules: { vi: rulesVi, en: rulesEn }, custom: false,
});

export const BUILTIN_ROLES = [
  role('werewolf', 'wolf', 'Ma Sói', 'Werewolf',
    'Mỗi đêm, phe Sói cùng thức dậy và chọn một người để giết. Phe Sói thắng khi số Sói còn sống bằng hoặc nhiều hơn số người còn lại.',
    'Each night, the werewolves wake up together and choose one player to kill. The werewolves win when they equal or outnumber everyone else alive.'),
  role('wolfcub', 'wolf', 'Sói Con', 'Wolf Cub',
    'Bạn là một Ma Sói và thức dậy cùng phe Sói. Nếu bạn bị giết, đêm tiếp theo phe Sói được giết hai người.',
    'You are a werewolf and wake up with the werewolves. If you are killed, the werewolves kill two players the following night.'),
  role('villager', 'village', 'Dân Làng', 'Villager',
    'Bạn không có khả năng đặc biệt. Ban ngày, hãy thảo luận và bỏ phiếu để tìm ra Ma Sói.',
    'You have no special power. During the day, discuss and vote to find the werewolves.'),
  role('seer', 'village', 'Tiên Tri', 'Seer',
    'Mỗi đêm, chọn một người. Quản trò sẽ ra hiệu cho bạn biết người đó có phải là Sói hay không.',
    'Each night, choose one player. The moderator signals whether that player is a werewolf.'),
  role('bodyguard', 'village', 'Bảo Vệ', 'Bodyguard',
    'Mỗi đêm, chọn một người để bảo vệ khỏi Sói. Không được bảo vệ cùng một người hai đêm liên tiếp.',
    'Each night, choose one player to protect from the werewolves. You cannot protect the same player two nights in a row.'),
  role('witch', 'village', 'Phù Thủy', 'Witch',
    'Bạn có một bình thuốc cứu (cứu người bị Sói cắn) và một bình thuốc độc (giết một người). Mỗi bình chỉ dùng được một lần trong cả ván.',
    'You have one healing potion (save the werewolves\' victim) and one poison potion (kill one player). Each potion can be used once per game.'),
  role('hunter', 'village', 'Thợ Săn', 'Hunter',
    'Khi bạn chết, bạn được bắn ngay một người khác chết cùng.',
    'When you die, you immediately shoot one other player, who dies with you.'),
  role('cupid', 'village', 'Thần Tình Yêu', 'Cupid',
    'Đêm đầu tiên, chọn hai người làm cặp đôi. Nếu một người chết, người kia cũng chết theo.',
    'On the first night, choose two players to become lovers. If one of them dies, the other dies too.'),
  role('fool', 'neutral', 'Kẻ Ngốc', 'Fool',
    'Bạn thắng nếu bị dân làng bỏ phiếu treo cổ vào ban ngày.',
    'You win if the village votes to hang you during the day.'),
];

export const UNKNOWN_ROLE = {
  id: 'unknown', team: 'neutral',
  name: { vi: 'Vai không xác định', en: 'Unknown role' }, rules: { vi: '', en: '' }, custom: false,
};

const TEAMS = ['wolf', 'village', 'neutral'];

export function allRoles(customRoles = []) {
  return [...BUILTIN_ROLES, ...customRoles];
}

export function getRole(id, customRoles = []) {
  return allRoles(customRoles).find((r) => r.id === id) ?? UNKNOWN_ROLE;
}

function buildFields({ nameVi = '', rulesVi = '', nameEn = '', rulesEn = '', team }) {
  const name = { vi: nameVi.trim(), en: nameEn.trim() };
  const rules = { vi: rulesVi.trim(), en: rulesEn.trim() };
  if (!name.vi) throw new Error('NAME_REQUIRED');
  if (!rules.vi) throw new Error('RULES_REQUIRED');
  if (!TEAMS.includes(team)) throw new Error('BAD_TEAM');
  return { team, name, rules };
}

export function createCustomRole(fields, now) {
  const { team, name, rules } = buildFields(fields);
  return { id: `custom-${now}`, team, name, rules, custom: true };
}

export function updateCustomRole(existing, fields) {
  return { ...existing, ...buildFields(fields) };
}
