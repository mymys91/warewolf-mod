import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI, t, localize, phaseLabel } from '../js/i18n.js';

test('t replaces params', () => {
  assert.equal(t('deal.handoff', 'vi', { name: 'Minh' }), 'Đưa máy cho Minh');
  assert.equal(t('deal.handoff', 'en', { name: 'Minh' }), 'Pass the phone to Minh');
});

test('t returns key for unknown key', () => {
  assert.equal(t('nope', 'vi'), 'nope');
});

test('localize falls back to the other language', () => {
  assert.equal(localize({ vi: 'Sói', en: '' }, 'en'), 'Sói');
  assert.equal(localize({ vi: 'Sói' }, 'en'), 'Sói');
  assert.equal(localize({ vi: '', en: 'Wolf' }, 'vi'), 'Wolf');
  assert.equal(localize({ vi: '', en: '' }, 'vi'), '');
});

test('phaseLabel', () => {
  assert.equal(phaseLabel({ kind: 'night', number: 1 }, 'vi'), 'Đêm 1');
  assert.equal(phaseLabel({ kind: 'day', number: 2 }, 'en'), 'Day 2');
});

test('every UI key has non-empty vi and en', () => {
  for (const [k, v] of Object.entries(UI)) {
    assert.ok(v.vi?.trim(), `${k}.vi`);
    assert.ok(v.en?.trim(), `${k}.en`);
  }
});
