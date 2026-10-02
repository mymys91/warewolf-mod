import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestRoles } from '../js/suggest.js';

const range = Array.from({ length: 16 }, (_, i) => i + 5); // 5..20
const total = (c) => Object.values(c).reduce((a, b) => a + b, 0);

test('null outside 5–20 or for non-integers', () => {
  for (const n of [4, 21, 0, 5.5, -1]) assert.equal(suggestRoles(n), null, String(n));
});

test('total equals n for 5..20', () => {
  for (const n of range) assert.equal(total(suggestRoles(n)), n, String(n));
});

test('wolf-team size is floor(n/4)', () => {
  for (const n of range) {
    const c = suggestRoles(n);
    assert.equal((c.werewolf ?? 0) + (c.wolfcub ?? 0), Math.floor(n / 4), String(n));
  }
});

test('examples from spec', () => {
  assert.deepEqual(suggestRoles(5), { werewolf: 1, seer: 1, villager: 3 });
  assert.deepEqual(suggestRoles(12),
    { werewolf: 2, wolfcub: 1, seer: 1, bodyguard: 1, witch: 1, hunter: 1, villager: 5 });
});

test('thresholds', () => {
  for (const [id, below, at] of [['bodyguard', 5, 6], ['witch', 7, 8], ['hunter', 9, 10],
    ['wolfcub', 11, 12], ['cupid', 13, 14]]) {
    assert.equal(suggestRoles(below)[id], undefined, `${id} at ${below}`);
    assert.equal(suggestRoles(at)[id], 1, `${id} at ${at}`);
  }
});

test('never suggests fool and only non-zero counts', () => {
  for (const n of range) {
    const c = suggestRoles(n);
    assert.equal(c.fool, undefined);
    for (const v of Object.values(c)) assert.ok(v > 0);
  }
});
