// Suggested role counts for 5–20 players (spec §5).
const SPECIALS = [['seer', 5], ['bodyguard', 6], ['witch', 8], ['hunter', 10], ['cupid', 14]];

export function suggestRoles(n) {
  if (!Number.isInteger(n) || n < 5 || n > 20) return null;
  const counts = {};
  const wolves = Math.max(1, Math.floor(n / 4));
  if (n >= 12) {
    counts.werewolf = wolves - 1;
    counts.wolfcub = 1;
  } else {
    counts.werewolf = wolves;
  }
  for (const [id, min] of SPECIALS) if (n >= min) counts[id] = 1;
  const used = Object.values(counts).reduce((a, b) => a + b, 0);
  counts.villager = n - used;
  return counts;
}
