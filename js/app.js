// UI: the only module that touches the DOM.
import { t, localize, phaseLabel } from './i18n.js';
import { createStore } from './storage.js';
import {
  validateSetup, dealRoles, remainingCounts, validateAssignment, assignRoles, pruneAssignments,
} from './deal.js';
import { allRoles, getRole, createCustomRole, updateCustomRole, roleIcon } from './roles.js';
import {
  newGame, nextPhase, recordDeath, addNote, undo, alivePlayers, deathOf, checkWinner, endGame, timeline, CAUSES,
} from './game.js';
import { suggestRoles } from './suggest.js';
import { createTapGuard } from './tapguard.js';

const store = createStore();
const PLAYER_ERRORS = ['TOO_FEW_PLAYERS', 'TOO_MANY_PLAYERS', 'EMPTY_NAME', 'DUPLICATE_NAME'];

const state = {
  lang: store.getLang(),
  screen: 'players',
  players: [],
  counts: {},
  countsFor: null,
  assignments: {},
  dealt: [],
  dealIndex: 0,
  dealView: 'handoff',
  revealLang: 'vi',
  flipPending: false,
  roleCheck: null,
  game: null,
  hideBanner: false,
};

const appEl = document.getElementById('app');
const tr = (key, params) => t(key, state.lang, params);

// Builds an element. String children become text nodes; innerHTML is never used.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'value') node.value = v;
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function save() {
  store.setLang(state.lang);
  const stage = { deal: 'deal', tracker: 'tracker' }[state.screen]
    ?? (state.screen === 'roleCheck' ? (state.roleCheck.from === 'assign' ? 'check' : 'tracker') : null);
  if (stage) {
    store.setCurrentGame({
      stage,
      dealIndex: state.dealIndex,
      game: state.game ?? { players: state.dealt },
    });
  }
}

function go(screen) {
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
}

function setLang(lang) {
  state.lang = lang;
  store.setLang(lang);
  render();
}

function renderHeader() {
  document.documentElement.lang = state.lang;
  document.title = tr('app.title');
  document.getElementById('app-title').textContent = tr('app.title');
  const toggle = document.getElementById('lang-toggle');
  const revealing = (state.screen === 'deal' && state.dealView === 'reveal')
    || (state.screen === 'roleCheck' && state.roleCheck.view === 'reveal');
  toggle.replaceChildren(...(revealing ? [] : langButtons(state.lang, setLang)));
}

function langButtons(current, onPick) {
  return ['vi', 'en'].map((l) => el('button', {
    class: `small${current === l ? ' active' : ''}`,
    'aria-pressed': String(current === l),
    onclick: () => onPick(l),
  }, l.toUpperCase()));
}

function errorList(codes) {
  if (!codes.length) return null;
  return el('ul', { class: 'errors', role: 'alert' }, codes.map((c) => el('li', {}, tr(`err.${c}`))));
}

// ---------- Screen 1: players ----------
function renderPlayers() {
  if (!state.players.length) {
    const last = store.getLastPlayers();
    state.players = last.length ? [...last] : ['', ''];
  }
  const errorsBox = el('div');
  const countEl = el('p', { class: 'muted' });
  const nextBtn = el('button', { class: 'primary', onclick: onNext }, tr('common.next'));

  function refresh() {
    const codes = validateSetup(state.players, {}, []).filter((c) => PLAYER_ERRORS.includes(c));
    errorsBox.replaceChildren(errorList(codes) ?? '');
    countEl.textContent = tr('players.count', { n: state.players.length });
    nextBtn.disabled = codes.length > 0;
  }

  function onNext() {
    state.players = state.players.map((p) => p.trim());
    store.setLastPlayers(state.players);
    go('roles');
  }

  const rows = state.players.map((name, i) => el('div', { class: 'row' },
    el('input', {
      class: 'grow',
      value: name,
      placeholder: tr('players.placeholder', { n: i + 1 }),
      autocomplete: 'off',
      enterkeyhint: 'next',
      oninput: (e) => { state.players[i] = e.target.value; refresh(); },
    }),
    el('button', {
      class: 'small ghost',
      'aria-label': tr('players.remove'),
      onclick: () => { state.players.splice(i, 1); render(); },
    }, '✕'),
  ));

  const addBtn = el('button', {
    onclick: () => {
      state.players.push('');
      render();
      const inputs = appEl.querySelectorAll('input');
      inputs[inputs.length - 1]?.focus();
    },
  }, tr('players.add'));

  refresh();
  return el('section', { class: 'stack' },
    store.persistent ? null : el('p', { class: 'notice' }, tr('storage.notice')),
    el('h2', {}, tr('players.title')),
    countEl,
    ...rows,
    addBtn,
    errorsBox,
    nextBtn,
  );
}

// ---------- Bottom sheet (dialogs) ----------
function openSheet(...children) {
  closeSheet();
  const sheet = el('div', { class: 'sheet', id: 'sheet', onclick: (e) => { if (e.target.id === 'sheet') closeSheet(); } },
    el('div', { class: 'sheet-body stack', role: 'dialog', 'aria-modal': 'true' }, ...children));
  document.body.append(sheet);
}

function closeSheet() {
  document.getElementById('sheet')?.remove();
}

const teamBadge = (team, lang = state.lang) => el('span', { class: `badge team-${team}` }, t(`team.${team}`, lang));

// ---------- Screen 2: roles ----------
const expandedRoles = new Set();

function renderRoles() {
  const n = state.players.length;
  if (state.countsFor !== n) {
    state.counts = suggestRoles(n) ?? {};
    state.countsFor = n;
    state.assignments = {};
  }
  const customRoles = store.getCustomRoles();
  const roles = allRoles(customRoles);
  const total = Object.values(state.counts).reduce((a, b) => a + b, 0);
  const errors = validateSetup(state.players, state.counts, customRoles);

  const setCount = (id, value) => {
    if (value > 0) state.counts[id] = value;
    else delete state.counts[id];
    render();
  };

  const rows = roles.map((role) => {
    const count = state.counts[role.id] ?? 0;
    const name = localize(role.name, state.lang);
    const open = expandedRoles.has(role.id);
    return el('div', { class: 'card role-row' },
      el('div', { class: 'row' },
        el('div', { class: 'grow' },
          el('button', {
            class: 'role-name',
            'aria-expanded': String(open),
            onclick: () => { if (open) expandedRoles.delete(role.id); else expandedRoles.add(role.id); render(); },
          }, name),
          el('div', {}, teamBadge(role.team), role.custom ? el('span', { class: 'badge' }, tr('roles.custom')) : null)),
        el('button', { class: 'small', 'aria-label': tr('roles.less', { name }), disabled: count === 0, onclick: () => setCount(role.id, count - 1) }, '−'),
        el('span', { class: 'count' }, String(count)),
        el('button', { class: 'small', 'aria-label': tr('roles.more', { name }), onclick: () => setCount(role.id, count + 1) }, '+')),
      open ? el('p', { class: 'role-rules' }, localize(role.rules, state.lang)) : null,
      open && role.custom ? el('div', { class: 'row' },
        el('button', { class: 'small', onclick: () => openCustomRoleForm(role) }, tr('roles.edit')),
        el('button', { class: 'small danger', onclick: () => deleteCustomRole(role) }, tr('roles.delete'))) : null,
    );
  });

  const onDeal = () => {
    state.dealt = dealRoles(state.players, state.counts);
    state.dealIndex = 0;
    state.dealView = 'handoff';
    state.game = null;
    go('deal');
    save();
  };

  return el('section', { class: 'stack' },
    el('button', { class: 'ghost small', onclick: () => go('players') }, tr('common.back')),
    el('h2', {}, tr('roles.title')),
    el('p', { class: 'muted' }, suggestRoles(n) ? tr('roles.suggested', { n }) : tr('roles.noSuggest')),
    el('p', { class: `total${total === n ? ' ok' : ''}` }, tr('roles.total', { x: total, n })),
    ...rows,
    el('button', { onclick: () => openCustomRoleForm(null) }, tr('roles.addCustom')),
    errorList(errors.filter((c) => c === 'COUNT_MISMATCH' || c === 'NO_WOLF')),
    el('button', { class: 'primary', disabled: errors.length > 0, onclick: onDeal }, tr('roles.dealRandom')),
    el('button', { disabled: errors.length > 0, onclick: () => go('assign') }, tr('roles.modAssign')),
  );
}

const ICON_CHOICES = ['🐺', '🦊', '🧛', '👻', '🧙', '👑', '🕵️', '👼', '💀', '🐍', '🌙', '⭐'];

function openCustomRoleForm(existing) {
  const field = (key, tag, value) => {
    const input = el(tag, { id: `f-${key}`, value: value ?? '' });
    return [el('label', { for: `f-${key}` }, tr(`custom.${key}`)), input];
  };
  const team = el('select', { id: 'f-team' },
    ['village', 'wolf', 'neutral'].map((tm) => {
      const o = el('option', { value: tm }, tr(`team.${tm}`));
      if ((existing?.team ?? 'village') === tm) o.selected = true;
      return o;
    }));
  const icon = el('input', { id: 'f-icon', maxlength: '8', value: existing?.icon ?? '' });
  const iconPicker = el('div', { class: 'icon-picker' },
    ICON_CHOICES.map((emoji) => el('button', { type: 'button', class: 'small', onclick: () => { icon.value = emoji; } }, emoji)));
  const errorsBox = el('div');
  const form = el('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const v = (id) => form.querySelector(`#f-${id}`).value;
      const fields = { nameVi: v('nameVi'), rulesVi: v('rulesVi'), nameEn: v('nameEn'), rulesEn: v('rulesEn'), team: v('team'), icon: v('icon') };
      try {
        const roles = store.getCustomRoles();
        if (existing) {
          const updated = updateCustomRole(existing, fields);
          store.setCustomRoles(roles.map((r) => (r.id === existing.id ? updated : r)));
        } else {
          store.setCustomRoles([...roles, createCustomRole(fields, Date.now())]);
        }
        closeSheet();
        render();
      } catch (err) {
        errorsBox.replaceChildren(errorList([err.message]));
      }
    },
  },
  ...field('nameVi', 'input', existing?.name.vi),
  ...field('rulesVi', 'textarea', existing?.rules.vi),
  ...field('nameEn', 'input', existing?.name.en),
  ...field('rulesEn', 'textarea', existing?.rules.en),
  el('label', { for: 'f-team' }, tr('custom.team')), team,
  el('label', { for: 'f-icon' }, tr('custom.icon')), iconPicker, icon,
  errorsBox,
  el('div', { class: 'grid-2', style: 'margin-top:16px' },
    el('button', { type: 'button', onclick: closeSheet }, tr('common.cancel')),
    el('button', { type: 'submit', class: 'primary' }, tr('common.save'))));
  openSheet(el('h2', {}, tr('custom.title')), form);
  form.querySelector('#f-nameVi').focus();
}

function deleteCustomRole(role) {
  const saved = store.getCurrentGame();
  const players = saved?.game?.players ?? [];
  if (players.some((p) => p.roleId === role.id)) {
    alert(tr('roles.deleteBlocked'));
    return;
  }
  if (!confirm(tr('roles.deleteConfirm', { name: localize(role.name, state.lang) }))) return;
  store.setCustomRoles(store.getCustomRoles().filter((r) => r.id !== role.id));
  delete state.counts[role.id];
  expandedRoles.delete(role.id);
  render();
}

// ---------- Assign roles (moderator picks each player's role) ----------

function renderAssign() {
  state.assignments = pruneAssignments(state.players.length, state.counts, state.assignments);
  const customRoles = store.getCustomRoles();
  const roles = allRoles(customRoles).filter((r) => (state.counts[r.id] ?? 0) > 0);
  const remaining = remainingCounts(state.counts, state.assignments);
  const valid = validateAssignment(state.players, state.counts, state.assignments).length === 0;

  const rows = state.players.map((name, i) => {
    const current = state.assignments[i] ?? '';
    const select = el('select', {
      'aria-label': name,
      onchange: (e) => {
        if (e.target.value) state.assignments[i] = e.target.value;
        else delete state.assignments[i];
        render();
      },
    },
    el('option', { value: '' }, tr('assign.placeholder')),
    roles.map((r) => el('option', {
      value: r.id,
      disabled: remaining[r.id] <= 0 && r.id !== current,
      selected: r.id === current,
    }, localize(r.name, state.lang))));
    return el('div', { class: 'card row assign-row' }, el('strong', { class: 'grow' }, name.trim()), select);
  });

  return el('section', { class: 'stack' },
    el('button', { class: 'ghost small', onclick: () => go('roles') }, tr('common.back')),
    el('h2', {}, tr('assign.title')),
    el('div', { class: 'assign-left' },
      roles.map((r) => el('span', { class: 'muted' }, tr('assign.left', { name: localize(r.name, state.lang), n: remaining[r.id] })))),
    ...rows,
    el('button', {
      class: 'primary',
      disabled: !valid,
      onclick: () => {
        state.game = newGame(assignRoles(state.players, state.assignments));
        openRoleCheck('assign');
      },
    }, tr('assign.continue')));
}

// ---------- Screen 3: deal ----------
// Deal buttons share one tap window, so a double tap can never land on the
// button that replaces the one tapped (next player's role, moderator view).
const dealGuard = createTapGuard(800);
// Tracker actions that can't be undone (phase change, ending the game).
const trackerGuard = createTapGuard(600);

function roleCardBack(extraClass = '') {
  return el('div', { class: `role-card ${extraClass}` },
    el('div', { class: 'role-card-inner' },
      el('div', { class: 'role-card-face role-card-back' }, el('span', {}, '🌕'))));
}

function roleCard(player, role, lang, flipped) {
  return el('div', { class: `role-card team-card-${role.team}${flipped ? ' flipped' : ''}` },
    el('div', { class: 'role-card-inner' },
      el('div', { class: 'role-card-face role-card-back' }, el('span', {}, '🌕')),
      el('div', { class: 'role-card-face role-card-front' },
        el('div', { class: 'role-icon', 'aria-hidden': 'true' }, roleIcon(role)),
        el('p', { class: 'muted' }, t('deal.youAre', lang, { name: player.name })),
        el('p', { class: `role-title team-${role.team}` }, localize(role.name, lang)),
        teamBadge(role.team, lang),
        el('p', { class: 'role-rules' }, localize(role.rules, lang)))));
}

// Hand-off and reveal views shared by the deal and the private role check.
function renderHandoff(player, progress, onSee) {
  return el('section', { class: 'stack center screen-fill' },
    progress ? el('p', { class: 'muted' }, progress) : null,
    el('p', {}, tr('deal.handoffLead')),
    el('p', { class: 'big' }, player.name),
    roleCardBack('small'),
    el('p', { class: 'muted' }, tr('deal.hint', { name: player.name })),
    el('button', {
      class: 'primary',
      onclick: dealGuard.wrap(() => {
        state.revealLang = state.lang;
        state.flipPending = true;
        onSee();
      }),
    }, tr('deal.see')));
}

function renderReveal(player, progress, onHide) {
  const lang = state.revealLang;
  const role = getRole(player.roleId, store.getCustomRoles());
  // The card flips only on the first render after "See my role", not on a language switch.
  const animate = state.flipPending && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.flipPending = false;
  const card = roleCard(player, role, lang, !animate);
  if (animate) requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('flipped')));
  return el('section', { class: 'stack' },
    el('div', { class: 'row', style: 'justify-content:space-between' },
      progress ? el('p', { class: 'muted' }, progress) : el('span'),
      el('div', { class: 'lang-toggle' }, langButtons(lang, (l) => { state.revealLang = l; render(); }))),
    card,
    el('button', { class: 'primary', onclick: dealGuard.wrap(onHide) }, t('deal.hide', lang)));
}

function renderDeal() {
  const total = state.dealt.length;
  if (state.dealView === 'done' || state.dealIndex >= total) {
    return el('section', { class: 'stack center screen-fill' },
      el('p', { class: 'big' }, tr('deal.done')),
      el('p', { class: 'muted' }, tr('deal.doneHint')),
      el('button', {
        class: 'primary',
        onclick: dealGuard.wrap(() => { state.game = newGame(state.dealt); go('tracker'); save(); }),
      }, tr('deal.iAmModerator')));
  }

  const player = state.dealt[state.dealIndex];
  if (state.dealView === 'handoff') {
    return renderHandoff(player, tr('deal.progress', { i: state.dealIndex + 1, n: total }), () => {
      state.dealView = 'reveal';
      render();
    });
  }
  return renderReveal(player, t('deal.progress', state.revealLang, { i: state.dealIndex + 1, n: total }), () => {
    if (state.dealView !== 'reveal') return;
    state.dealIndex += 1;
    state.dealView = state.dealIndex >= total ? 'done' : 'handoff';
    render();
    save();
  });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (state.screen === 'deal' && state.dealView === 'reveal') {
    state.dealView = 'handoff';
    render();
  } else if (state.screen === 'roleCheck' && state.roleCheck.view === 'reveal') {
    state.roleCheck.view = 'handoff';
    render();
  }
});

// ---------- Private role check ----------
// The moderator taps a name and hands that player the phone; the list never shows roles.
function openRoleCheck(from) {
  state.roleCheck = { view: 'list', index: 0, seen: new Set(), from };
  go('roleCheck');
  save();
}

function renderRoleCheck() {
  const rc = state.roleCheck;
  const player = state.game.players[rc.index];
  if (rc.view === 'handoff') {
    return renderHandoff(player, null, () => { rc.view = 'reveal'; render(); });
  }
  if (rc.view === 'reveal') {
    return renderReveal(player, null, () => {
      if (rc.view !== 'reveal') return;
      rc.seen.add(rc.index);
      rc.view = 'return';
      render();
    });
  }
  if (rc.view === 'return') {
    return el('section', { class: 'stack center screen-fill' },
      el('p', { class: 'big' }, tr('check.return')),
      el('button', {
        class: 'primary',
        onclick: dealGuard.wrap(() => { rc.view = 'list'; render(); }),
      }, tr('deal.iAmModerator')));
  }
  const fromAssign = rc.from === 'assign';
  return el('section', { class: 'stack' },
    el('h2', {}, tr('check.title')),
    el('p', { class: 'muted' }, tr('check.hint')),
    state.game.players.map((p, i) => el('button', {
      class: 'player',
      onclick: dealGuard.wrap(() => { rc.index = i; rc.view = 'handoff'; render(); }),
    }, el('strong', {}, p.name), rc.seen.has(i) ? ' ✓' : null)),
    el('button', {
      class: 'primary',
      onclick: dealGuard.wrap(() => { go('tracker'); if (fromAssign) save(); }),
    }, tr(fromAssign ? 'check.start' : 'check.back')));
}

// ---------- Screen 4: game tracker ----------
function applyGame(change) {
  try {
    state.game = change(state.game);
    state.hideBanner = false;
    closeSheet();
    render();
    save();
  } catch (err) {
    alert(tr(`err.${err.message}`));
  }
}

function finishGame(winner) {
  closeSheet();
  state.game = endGame(state.game, winner);
  go('recap');
}

function renderTracker() {
  const game = state.game;
  const customRoles = store.getCustomRoles();
  const alive = alivePlayers(game);
  const suggestion = checkWinner(game, customRoles);
  const upcoming = phaseLabel(nextPhase(game).phase, state.lang);

  const players = game.players.map((p) => {
    const role = getRole(p.roleId, customRoles);
    const death = deathOf(game, p.name);
    return el('button', {
      class: `player${death ? ' dead' : ''}`,
      disabled: !!death,
      onclick: () => openDeathPicker(p.name),
    },
    el('span', {}, el('strong', {}, p.name), el('br'),
      el('span', { class: `meta team-${role.team}` }, localize(role.name, state.lang))),
    death ? el('span', { class: 'meta' }, `${tr(`causeBtn.${death.cause}`)} · ${phaseLabel(death.phase, state.lang)}`) : null);
  });

  const banner = suggestion && !state.hideBanner
    ? el('div', { class: 'banner', role: 'status' },
      el('strong', {}, tr(`win.${suggestion}`)),
      el('div', { class: 'row' },
        el('button', { class: 'grow', onclick: trackerGuard.wrap(() => finishGame(suggestion)) }, tr('tracker.confirm')),
        el('button', { class: 'grow', onclick: () => { state.hideBanner = true; render(); } }, tr('tracker.keep'))))
    : null;

  return el('section', { class: 'stack' },
    el('h2', {}, `${tr('tracker.title')} · ${phaseLabel(game.phase, state.lang)}`),
    el('p', { class: 'muted' }, tr('tracker.alive', { n: alive.length, total: game.players.length })),
    banner,
    el('p', { class: 'muted' }, tr('tracker.hint')),
    ...players,
    el('button', { onclick: () => openRoleCheck('tracker') }, tr('tracker.showRole')),
    el('div', { class: 'grid-2' },
      el('button', { onclick: openNoteForm }, tr('tracker.note')),
      el('button', { disabled: !game.events.length, onclick: () => applyGame(undo) }, tr('tracker.undo'))),
    el('button', { class: 'primary', onclick: trackerGuard.wrap(() => applyGame(nextPhase)) }, tr('tracker.next', { phase: upcoming })),
    el('button', { class: 'danger', style: 'width:100%', onclick: trackerGuard.wrap(() => openWinnerPicker(suggestion)) }, tr('tracker.end')),
  );
}

function openDeathPicker(name) {
  openSheet(
    el('h2', {}, tr('tracker.howDied', { name })),
    el('div', { class: 'stack' }, CAUSES.map((cause) => el('button', {
      style: 'width:100%',
      onclick: () => applyGame((g) => recordDeath(g, name, cause)),
    }, tr(`causeBtn.${cause}`)))),
    el('button', { class: 'ghost', style: 'width:100%', onclick: closeSheet }, tr('common.cancel')),
  );
}

function openNoteForm() {
  const input = el('textarea', { id: 'note-text', 'aria-label': tr('tracker.note') });
  openSheet(
    el('h2', {}, tr('tracker.noteTitle', { phase: phaseLabel(state.game.phase, state.lang) })),
    input,
    el('div', { class: 'grid-2' },
      el('button', { onclick: closeSheet }, tr('common.cancel')),
      el('button', { class: 'primary', onclick: () => applyGame((g) => addNote(g, input.value)) }, tr('common.save'))),
  );
  input.focus();
}

function openWinnerPicker(suggestion) {
  const options = ['village', 'wolf', 'fool', 'undecided'];
  if (suggestion) options.sort((a, b) => (b === suggestion) - (a === suggestion));
  openSheet(
    el('h2', {}, tr('tracker.pickWinner')),
    el('div', { class: 'stack' }, options.map((w) => el('button', {
      class: w === suggestion ? 'primary' : '',
      style: 'width:100%',
      onclick: trackerGuard.wrap(() => finishGame(w)),
    }, tr(`winner.${w}`), w === suggestion ? ` ${tr('tracker.suggested')}` : ''))),
    el('button', { class: 'ghost', style: 'width:100%', onclick: closeSheet }, tr('common.cancel')),
  );
}

// ---------- Screen 5: recap ----------
function renderRecap() {
  store.clearCurrentGame();
  const game = state.game;
  const customRoles = store.getCustomRoles();

  const players = game.players.map((p) => {
    const role = getRole(p.roleId, customRoles);
    const death = deathOf(game, p.name);
    return el('div', { class: `player card${death ? ' dead' : ''}` },
      el('span', {}, el('strong', {}, p.name), el('br'),
        el('span', { class: `meta team-${role.team}` }, `${localize(role.name, state.lang)} · ${tr(`team.${role.team}`)}`)),
      el('span', { class: 'meta' }, death ? `${tr(`causeBtn.${death.cause}`)} · ${phaseLabel(death.phase, state.lang)}` : tr('recap.alive')));
  });

  const groups = timeline(game);
  const events = groups.length
    ? groups.map(({ phase, events: list }) => [
      el('h3', {}, phaseLabel(phase, state.lang)),
      el('ul', {}, list.map((e) => el('li', {},
        e.type === 'death' ? `${e.player} ${tr(`cause.${e.cause}`)}` : `📝 ${e.text}`))),
    ])
    : el('p', { class: 'muted' }, tr('recap.noEvents'));

  return el('section', { class: 'stack' },
    el('h2', {}, tr('recap.title')),
    el('div', { class: 'banner center big' }, tr(`win.${game.winner ?? 'undecided'}`)),
    ...players,
    el('div', { class: 'timeline' }, el('h2', {}, tr('recap.timeline')), events),
    el('button', {
      class: 'primary',
      onclick: () => {
        state.game = null;
        state.dealt = [];
        state.dealIndex = 0;
        state.countsFor = null;
        state.assignments = {};
        go('players');
      },
    }, tr('recap.newGame')));
}

// ---------- Resume prompt ----------
function renderResume() {
  const saved = store.getCurrentGame();
  if (!saved) return renderPlayers();
  const resume = () => {
    const players = saved.game.players;
    state.players = players.map((p) => p.name);
    if (saved.stage === 'deal') {
      state.dealt = players;
      state.dealIndex = Math.max(0, Math.min(saved.dealIndex, players.length));
      state.dealView = state.dealIndex >= players.length ? 'done' : 'handoff';
      state.game = null;
      go('deal');
    } else if (saved.stage === 'check') {
      state.game = { ...newGame(players), ...saved.game };
      state.roleCheck = { view: 'list', index: 0, seen: new Set(), from: 'assign' };
      go('roleCheck');
    } else {
      state.game = { ...newGame(players), ...saved.game };
      go('tracker');
    }
  };
  return el('section', { class: 'stack center screen-fill' },
    el('p', { class: 'big' }, tr('resume.title')),
    el('button', { class: 'primary', onclick: resume }, tr('resume.yes')),
    el('button', { onclick: () => { store.clearCurrentGame(); go('players'); } }, tr('resume.no')));
}

const SCREENS = {
  players: renderPlayers,
  roles: renderRoles,
  assign: renderAssign,
  roleCheck: renderRoleCheck,
  deal: renderDeal,
  tracker: renderTracker,
  recap: renderRecap,
  resume: renderResume,
};

function render() {
  renderHeader();
  appEl.replaceChildren(SCREENS[state.screen]());
}

if (store.getCurrentGame()) state.screen = 'resume';
render();
