import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTapGuard } from '../js/tapguard.js';

function clock() {
  let now = 1000;
  const c = () => now;
  c.advance = (ms) => { now += ms; };
  return c;
}

test('a second tap within the lock window is ignored', () => {
  const c = clock();
  const guard = createTapGuard(800, c);
  let calls = 0;
  const tap = guard.wrap(() => { calls++; });
  tap(); c.advance(100); tap();
  assert.equal(calls, 1);
});

test('a tap after the window runs', () => {
  const c = clock();
  const guard = createTapGuard(800, c);
  let calls = 0;
  const tap = guard.wrap(() => { calls++; });
  tap(); c.advance(800); tap();
  assert.equal(calls, 2);
});

test('wrapped handlers share one window (tap lands on the next button)', () => {
  const c = clock();
  const guard = createTapGuard(800, c);
  const log = [];
  const hide = guard.wrap(() => log.push('hide'));
  const moderator = guard.wrap(() => log.push('moderator'));
  hide(); c.advance(50); moderator();
  assert.deepEqual(log, ['hide']);
});

test('wrapped handler receives arguments', () => {
  const guard = createTapGuard(800, clock());
  let got;
  guard.wrap((e) => { got = e; })('evt');
  assert.equal(got, 'evt');
});
