import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSetup, nameKey, dealRoles, cryptoRandom } from '../js/deal.js';
import { createCustomRole } from '../js/roles.js';
import { seededRng } from './helpers.js';

const five = ['An', 'Bình', 'Chi', 'Dũng', 'Em'];
const ok = { werewolf: 1, villager: 4 };
const names = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

test('valid setup returns []', () => {
  assert.deepEqual(validateSetup(five, ok, []), []);
});

test('TOO_FEW_PLAYERS', () => {
  assert.deepEqual(validateSetup(['A', 'B'], { werewolf: 1, villager: 1 }, []), ['TOO_FEW_PLAYERS']);
});

test('TOO_MANY_PLAYERS', () => {
  assert.deepEqual(validateSetup(names(31), { werewolf: 1, villager: 30 }, []), ['TOO_MANY_PLAYERS']);
});

test('EMPTY_NAME', () => {
  assert.deepEqual(validateSetup(['An', '  ', 'Chi', 'Dũng', 'Em'], ok, []), ['EMPTY_NAME']);
});

test('DUPLICATE_NAME', () => {
  assert.deepEqual(validateSetup(['An', 'An', 'Chi', 'Dũng', 'Em'], ok, []), ['DUPLICATE_NAME']);
});

test('duplicates across case, spaces and Unicode form', () => {
  assert.deepEqual(validateSetup(['Minh', ' MINH ', 'Chi', 'Dũng', 'Em'], ok, []), ['DUPLICATE_NAME']);
  assert.deepEqual(validateSetup(['Đức', 'Đức'.normalize('NFD'), 'Chi', 'Dũng', 'Em'], ok, []), ['DUPLICATE_NAME']);
  assert.equal(nameKey(' ĐỨC '), nameKey('đức'.normalize('NFD')));
});

test('COUNT_MISMATCH', () => {
  assert.deepEqual(validateSetup(five, { werewolf: 1, villager: 3 }, []), ['COUNT_MISMATCH']);
});

test('NO_WOLF', () => {
  assert.deepEqual(validateSetup(five, { seer: 1, villager: 4 }, []), ['NO_WOLF']);
});

test('custom wolf role satisfies NO_WOLF', () => {
  const c = { ...createCustomRole({ nameVi: 'Sói Đầu Đàn', rulesVi: 'x', team: 'wolf' }, 1) };
  assert.deepEqual(validateSetup(five, { 'custom-1': 1, villager: 4 }, [c]), []);
});

test('errors come in spec order, each once', () => {
  assert.deepEqual(validateSetup(['A', 'a'], {}, []),
    ['TOO_FEW_PLAYERS', 'DUPLICATE_NAME', 'COUNT_MISMATCH', 'NO_WOLF']);
});

test('dealRoles matches counts and keeps entry order', () => {
  const counts = { werewolf: 2, seer: 1, villager: 9 };
  const dealt = dealRoles(names(12), counts, seededRng(3));
  assert.deepEqual(dealt.map((d) => d.name), names(12));
  const tally = {};
  for (const d of dealt) tally[d.roleId] = (tally[d.roleId] ?? 0) + 1;
  assert.deepEqual(tally, counts);
});

test('dealRoles trims names', () => {
  const dealt = dealRoles([' An ', 'Bình', 'Chi'], { werewolf: 1, villager: 2 }, seededRng(1));
  assert.equal(dealt[0].name, 'An');
});

test('dealRoles is deterministic per seed', () => {
  const counts = { werewolf: 3, seer: 1, witch: 1, hunter: 1, villager: 6 };
  const ids = (s) => dealRoles(names(12), counts, seededRng(s)).map((d) => d.roleId);
  assert.deepEqual(ids(42), ids(42));
  assert.notDeepEqual(ids(1), ids(2));
});

test('cryptoRandom is in [0, 1)', () => {
  for (let i = 0; i < 1000; i++) {
    const x = cryptoRandom();
    assert.ok(x >= 0 && x < 1);
  }
});
