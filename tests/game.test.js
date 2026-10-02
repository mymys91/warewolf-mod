import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, nextPhase, recordDeath, addNote, undo, alivePlayers, deathOf,
  checkWinner, endGame, timeline,
} from '../js/game.js';
import { createCustomRole } from '../js/roles.js';

const dealt = [
  { name: 'An', roleId: 'werewolf' }, { name: 'Bình', roleId: 'wolfcub' },
  { name: 'Chi', roleId: 'seer' }, { name: 'Dũng', roleId: 'villager' },
  { name: 'Em', roleId: 'villager' }, { name: 'Giang', roleId: 'fool' },
];
const kill = (g, ...pairs) => pairs.reduce((acc, [n, c]) => recordDeath(acc, n, c), g);

test('starts at night 1 with no events and no winner', () => {
  const g = newGame(dealt);
  assert.deepEqual(g.phase, { kind: 'night', number: 1 });
  assert.deepEqual(g.events, []);
  assert.equal(g.winner, null);
  assert.equal(g.players.length, 6);
});

test('nextPhase sequence', () => {
  const g1 = nextPhase(newGame(dealt));
  assert.deepEqual(g1.phase, { kind: 'day', number: 1 });
  assert.deepEqual(nextPhase(g1).phase, { kind: 'night', number: 2 });
});

test('recordDeath stores a copy of the phase', () => {
  const g = recordDeath(nextPhase(newGame(dealt)), 'Dũng', 'hanged');
  assert.deepEqual(g.events[0], { type: 'death', phase: { kind: 'day', number: 1 }, player: 'Dũng', cause: 'hanged' });
  assert.notEqual(g.events[0].phase, g.phase);
  assert.deepEqual(deathOf(g, 'Dũng'), g.events[0]);
  assert.equal(deathOf(g, 'Em'), undefined);
});

test('recordDeath rejects dead, unknown players and bad causes', () => {
  const g = recordDeath(newGame(dealt), 'Chi', 'wolf');
  assert.throws(() => recordDeath(g, 'Chi', 'poison'), /ALREADY_DEAD/);
  assert.throws(() => recordDeath(g, 'Zed', 'wolf'), /UNKNOWN_PLAYER/);
  assert.throws(() => recordDeath(g, 'Em', 'fire'), /BAD_CAUSE/);
});

test('addNote trims and rejects blank', () => {
  const g = addNote(newGame(dealt), '  Bảo Vệ cứu Lan ');
  assert.deepEqual(g.events[0], { type: 'note', phase: { kind: 'night', number: 1 }, text: 'Bảo Vệ cứu Lan' });
  assert.throws(() => addNote(g, '   '), /EMPTY_NOTE/);
});

test('undo removes last event; no-op when empty', () => {
  const g = addNote(recordDeath(newGame(dealt), 'Chi', 'wolf'), 'x');
  assert.equal(undo(g).events.length, 1);
  assert.equal(undo(g).events[0].player, 'Chi');
  const empty = newGame(dealt);
  assert.deepEqual(undo(empty), empty);
});

test('alivePlayers excludes the dead', () => {
  const g = kill(newGame(dealt), ['Chi', 'wolf'], ['An', 'hanged']);
  assert.deepEqual(alivePlayers(g).map((p) => p.name), ['Bình', 'Dũng', 'Em', 'Giang']);
});

test('inputs are not mutated', () => {
  const g = newGame(dealt);
  const snap = structuredClone(g);
  nextPhase(g); recordDeath(g, 'Chi', 'wolf'); addNote(g, 'x'); endGame(g, 'wolf');
  undo(recordDeath(g, 'Em', 'wolf'));
  assert.deepEqual(g, snap);
  assert.equal(dealt[0].name, 'An');
});

test('checkWinner: null at start', () => {
  assert.equal(checkWinner(newGame(dealt), []), null);
});

test('checkWinner: fool hanged wins first', () => {
  const g = kill(newGame(dealt), ['An', 'hanged'], ['Bình', 'hanged'], ['Giang', 'hanged']);
  assert.equal(checkWinner(g, []), 'fool');
});

test('checkWinner: fool killed by wolves is not a fool win', () => {
  assert.equal(checkWinner(kill(newGame(dealt), ['Giang', 'wolf']), []), null);
});

test('checkWinner: village when all wolves dead', () => {
  assert.equal(checkWinner(kill(newGame(dealt), ['An', 'hanged'], ['Bình', 'poison']), []), 'village');
});

test('checkWinner: wolf when wolves >= others', () => {
  const g = kill(newGame(dealt), ['Chi', 'wolf'], ['Dũng', 'hanged']);
  assert.equal(checkWinner(g, []), 'wolf');
});

test('checkWinner: custom role with wolf team counts as wolf', () => {
  const c = createCustomRole({ nameVi: 'Sói Già', rulesVi: 'x', team: 'wolf' }, 9);
  const g = newGame([{ name: 'A', roleId: 'custom-9' }, { name: 'B', roleId: 'villager' }, { name: 'C', roleId: 'villager' }]);
  assert.equal(checkWinner(g, [c]), null);
  assert.equal(checkWinner(kill(g, ['B', 'wolf']), [c]), 'wolf');
  assert.equal(checkWinner(kill(g, ['A', 'hanged']), [c]), 'village');
});

test('timeline groups by phase and skips empty phases', () => {
  let g = recordDeath(newGame(dealt), 'Chi', 'wolf');
  g = addNote(g, 'n1');
  g = nextPhase(nextPhase(g));
  g = recordDeath(g, 'Em', 'wolf');
  const tl = timeline(g);
  assert.equal(tl.length, 2);
  assert.deepEqual(tl[0].phase, { kind: 'night', number: 1 });
  assert.equal(tl[0].events.length, 2);
  assert.deepEqual(tl[1].phase, { kind: 'night', number: 2 });
});

test('endGame sets winner', () => {
  assert.equal(endGame(newGame(dealt), 'undecided').winner, 'undecided');
});
