import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/storage.js';
import { fakeStorage, throwingStorage } from './helpers.js';

const saved = {
  stage: 'tracker', dealIndex: 3,
  game: { players: [{ name: 'An', roleId: 'werewolf' }], phase: { kind: 'night', number: 1 }, events: [], winner: null },
};
const role = { id: 'custom-1', team: 'village', name: { vi: 'A', en: '' }, rules: { vi: 'B', en: '' }, custom: true };

test('defaults on empty storage', () => {
  const s = createStore(fakeStorage());
  assert.equal(s.getLang(), 'vi');
  assert.deepEqual(s.getLastPlayers(), []);
  assert.deepEqual(s.getCustomRoles(), []);
  assert.equal(s.getCurrentGame(), null);
  assert.equal(s.persistent, true);
});

test('round-trips every key', () => {
  const backend = fakeStorage();
  const s = createStore(backend);
  s.setLang('en'); s.setLastPlayers(['An', 'Bình']); s.setCustomRoles([role]); s.setCurrentGame(saved);
  const s2 = createStore(backend);
  assert.equal(s2.getLang(), 'en');
  assert.deepEqual(s2.getLastPlayers(), ['An', 'Bình']);
  assert.deepEqual(s2.getCustomRoles(), [role]);
  assert.deepEqual(s2.getCurrentGame(), saved);
  assert.equal(backend.getItem('ww.lang'), '"en"');
});

test('clearCurrentGame', () => {
  const s = createStore(fakeStorage());
  s.setCurrentGame(saved);
  s.clearCurrentGame();
  assert.equal(s.getCurrentGame(), null);
});

test('corrupt JSON is treated as missing', () => {
  const b = fakeStorage();
  for (const k of ['ww.lang', 'ww.lastPlayers', 'ww.customRoles', 'ww.currentGame']) b.setItem(k, '{');
  const s = createStore(b);
  assert.equal(s.getLang(), 'vi');
  assert.deepEqual(s.getLastPlayers(), []);
  assert.deepEqual(s.getCustomRoles(), []);
  assert.equal(s.getCurrentGame(), null);
});

test('wrong shapes are treated as missing', () => {
  const b = fakeStorage();
  b.setItem('ww.lang', '"fr"');
  b.setItem('ww.lastPlayers', '{}');
  b.setItem('ww.customRoles', '5');
  b.setItem('ww.currentGame', '5');
  const s = createStore(b);
  assert.equal(s.getLang(), 'vi');
  assert.deepEqual(s.getLastPlayers(), []);
  assert.deepEqual(s.getCustomRoles(), []);
  assert.equal(s.getCurrentGame(), null);
  for (const bad of ['{"stage":"x","dealIndex":0,"game":{"players":[]}}', '{"stage":"deal","dealIndex":"1","game":{"players":[]}}',
    '{"stage":"deal","dealIndex":0}', '{"stage":"deal","dealIndex":0,"game":{"players":{}}}']) {
    b.setItem('ww.currentGame', bad);
    assert.equal(createStore(b).getCurrentGame(), null, bad);
  }
  b.setItem('ww.lastPlayers', '["An", 5]');
  assert.deepEqual(createStore(b).getLastPlayers(), []);
});

test('throwing storage falls back to memory', () => {
  const s = createStore(throwingStorage());
  assert.equal(s.persistent, false);
  s.setLang('en'); s.setLastPlayers(['A']); s.setCurrentGame(saved);
  assert.equal(s.getLang(), 'en');
  assert.deepEqual(s.getLastPlayers(), ['A']);
  assert.deepEqual(s.getCurrentGame(), saved);
});

test('undefined backend falls back to memory', () => {
  const s = createStore(undefined);
  assert.equal(s.persistent, false);
  s.setCustomRoles([role]);
  assert.deepEqual(s.getCustomRoles(), [role]);
});
