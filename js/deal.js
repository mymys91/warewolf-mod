// Setup validation and shuffled dealing (spec §6).
import { getRole } from './roles.js';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 30;

export function nameKey(name) {
  return name.normalize('NFC').trim().toLocaleLowerCase('vi');
}

export function validateSetup(players, counts, customRoles) {
  const errors = [];
  if (players.length < MIN_PLAYERS) errors.push('TOO_FEW_PLAYERS');
  if (players.length > MAX_PLAYERS) errors.push('TOO_MANY_PLAYERS');
  const keys = players.map(nameKey);
  if (keys.some((k) => !k)) errors.push('EMPTY_NAME');
  const filled = keys.filter(Boolean);
  if (new Set(filled).size !== filled.length) errors.push('DUPLICATE_NAME');
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total !== players.length) errors.push('COUNT_MISMATCH');
  const hasWolf = Object.entries(counts)
    .some(([id, n]) => n > 0 && getRole(id, customRoles).team === 'wolf');
  if (!hasWolf) errors.push('NO_WOLF');
  return errors;
}

export function cryptoRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

export function dealRoles(players, counts, rng = cryptoRandom) {
  const pool = Object.entries(counts).flatMap(([id, n]) => Array(n).fill(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return players.map((name, i) => ({ name: name.trim(), roleId: pool[i] }));
}

// Moderator-assigned roles. Assignments map player index → role id.
export function remainingCounts(counts, assignments) {
  const left = { ...counts };
  for (const id of Object.values(assignments)) {
    if (id in left) left[id] -= 1;
  }
  return left;
}

export function validateAssignment(players, counts, assignments) {
  const errors = [];
  if (players.some((_, i) => !assignments[i])) errors.push('UNASSIGNED');
  const used = {};
  for (const id of Object.values(assignments)) {
    if (id) used[id] = (used[id] ?? 0) + 1;
  }
  if (Object.entries(used).some(([id, n]) => n > (counts[id] ?? 0))) errors.push('OVER_ASSIGNED');
  return errors;
}

export function assignRoles(players, assignments) {
  return players.map((name, i) => ({ name: name.trim(), roleId: assignments[i] }));
}

// Drops assignments that no longer fit; lower player indexes keep their role.
export function pruneAssignments(playerCount, counts, assignments) {
  const used = {};
  const kept = {};
  const indexes = Object.keys(assignments).map(Number).sort((a, b) => a - b);
  for (const i of indexes) {
    const id = assignments[i];
    if (i >= playerCount || !id) continue;
    if ((used[id] ?? 0) >= (counts[id] ?? 0)) continue;
    used[id] = (used[id] ?? 0) + 1;
    kept[i] = id;
  }
  return kept;
}
