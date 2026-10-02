// Game model for the moderator tracker (spec §8). All functions are pure.
import { getRole } from './roles.js';

export const CAUSES = ['wolf', 'hanged', 'poison', 'hunter', 'lover', 'other'];

export function newGame(dealt) {
  return {
    players: dealt.map(({ name, roleId }) => ({ name, roleId })),
    phase: { kind: 'night', number: 1 },
    events: [],
    winner: null,
  };
}

export function nextPhase(game) {
  const { kind, number } = game.phase;
  const phase = kind === 'night' ? { kind: 'day', number } : { kind: 'night', number: number + 1 };
  return { ...game, phase };
}

export function deathOf(game, name) {
  return game.events.find((e) => e.type === 'death' && e.player === name);
}

export function recordDeath(game, name, cause) {
  if (!game.players.some((p) => p.name === name)) throw new Error('UNKNOWN_PLAYER');
  if (deathOf(game, name)) throw new Error('ALREADY_DEAD');
  if (!CAUSES.includes(cause)) throw new Error('BAD_CAUSE');
  const event = { type: 'death', phase: { ...game.phase }, player: name, cause };
  return { ...game, events: [...game.events, event] };
}

export function addNote(game, text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('EMPTY_NOTE');
  return { ...game, events: [...game.events, { type: 'note', phase: { ...game.phase }, text: trimmed }] };
}

export function undo(game) {
  if (!game.events.length) return game;
  return { ...game, events: game.events.slice(0, -1) };
}

export function alivePlayers(game) {
  return game.players.filter((p) => !deathOf(game, p.name));
}

export function checkWinner(game, customRoles) {
  const foolHanged = game.events.some((e) => e.type === 'death' && e.cause === 'hanged'
    && getRole(game.players.find((p) => p.name === e.player)?.roleId, customRoles).id === 'fool');
  if (foolHanged) return 'fool';
  const alive = alivePlayers(game);
  const wolves = alive.filter((p) => getRole(p.roleId, customRoles).team === 'wolf').length;
  if (wolves === 0) return 'village';
  if (wolves >= alive.length - wolves) return 'wolf';
  return null;
}

export function endGame(game, winner) {
  return { ...game, winner };
}

export function timeline(game) {
  const groups = [];
  for (const e of game.events) {
    const last = groups.at(-1);
    if (last && last.phase.kind === e.phase.kind && last.phase.number === e.phase.number) {
      last.events.push(e);
    } else {
      groups.push({ phase: e.phase, events: [e] });
    }
  }
  return groups;
}
