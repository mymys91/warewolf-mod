import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_ROLES, allRoles, getRole, createCustomRole, updateCustomRole,
} from '../js/roles.js';

const valid = { nameVi: 'Già Làng', rulesVi: 'Sống 2 mạng', nameEn: '', rulesEn: '', team: 'village' };

test('every built-in role has non-empty vi/en name and rules', () => {
  for (const r of BUILTIN_ROLES) {
    for (const f of ['name', 'rules']) {
      assert.ok(r[f].vi?.trim(), `${r.id}.${f}.vi`);
      assert.ok(r[f].en?.trim(), `${r.id}.${f}.en`);
    }
    assert.equal(r.custom, false);
  }
});

test('built-in ids, teams and Vietnamese names', () => {
  assert.deepEqual(BUILTIN_ROLES.map((r) => r.id),
    ['werewolf', 'wolfcub', 'villager', 'seer', 'bodyguard', 'witch', 'hunter', 'cupid', 'fool']);
  assert.deepEqual(BUILTIN_ROLES.map((r) => r.name.vi),
    ['Ma Sói', 'Sói Con', 'Dân Làng', 'Tiên Tri', 'Bảo Vệ', 'Phù Thủy', 'Thợ Săn', 'Thần Tình Yêu', 'Kẻ Ngốc']);
  for (const r of BUILTIN_ROLES) {
    const team = ['werewolf', 'wolfcub'].includes(r.id) ? 'wolf' : r.id === 'fool' ? 'neutral' : 'village';
    assert.equal(r.team, team, r.id);
  }
});

test('allRoles lists built-ins then customs', () => {
  const c = createCustomRole(valid, 1);
  const all = allRoles([c]);
  assert.equal(all.length, BUILTIN_ROLES.length + 1);
  assert.equal(all.at(-1), c);
});

test('getRole finds built-in and custom roles', () => {
  const c = createCustomRole(valid, 7);
  assert.equal(getRole('seer', []).name.vi, 'Tiên Tri');
  assert.equal(getRole('custom-7', [c]), c);
});

test('getRole returns unknown role for missing id', () => {
  const r = getRole('custom-999', []);
  assert.equal(r.id, 'unknown');
  assert.equal(r.team, 'neutral');
  assert.equal(r.name.vi, 'Vai không xác định');
  assert.equal(r.name.en, 'Unknown role');
});

test('createCustomRole trims and builds', () => {
  const r = createCustomRole({ ...valid, nameVi: ' Già Làng ', nameEn: ' Elder ' }, 1700);
  assert.deepEqual(r, {
    id: 'custom-1700', team: 'village',
    name: { vi: 'Già Làng', en: 'Elder' }, rules: { vi: 'Sống 2 mạng', en: '' }, custom: true,
  });
});

test('createCustomRole rejects bad input', () => {
  assert.throws(() => createCustomRole({ ...valid, nameVi: '  ' }, 1), /NAME_REQUIRED/);
  assert.throws(() => createCustomRole({ ...valid, rulesVi: '' }, 1), /RULES_REQUIRED/);
  assert.throws(() => createCustomRole({ ...valid, team: 'x' }, 1), /BAD_TEAM/);
});

test('updateCustomRole keeps id and validates', () => {
  const r = createCustomRole(valid, 5);
  const u = updateCustomRole(r, { ...valid, nameVi: 'Trưởng Làng', team: 'neutral' });
  assert.equal(u.id, 'custom-5');
  assert.equal(u.name.vi, 'Trưởng Làng');
  assert.equal(u.team, 'neutral');
  assert.throws(() => updateCustomRole(r, { ...valid, nameVi: '' }), /NAME_REQUIRED/);
});
