// UI: the only module that touches the DOM.
import { t, localize } from './i18n.js';
import { createStore } from './storage.js';
import { validateSetup, dealRoles } from './deal.js';
import { allRoles, createCustomRole, updateCustomRole } from './roles.js';
import { suggestRoles } from './suggest.js';

const store = createStore();
const PLAYER_ERRORS = ['TOO_FEW_PLAYERS', 'TOO_MANY_PLAYERS', 'EMPTY_NAME', 'DUPLICATE_NAME'];

const state = {
  lang: store.getLang(),
  screen: 'players',
  players: [],
  counts: {},
  countsFor: null,
  dealt: [],
  dealIndex: 0,
  dealView: 'handoff',
  revealLang: 'vi',
  game: null,
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
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function save() {
  store.setLang(state.lang);
  if (state.screen === 'deal' || state.screen === 'tracker') {
    store.setCurrentGame({
      stage: state.screen,
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
  toggle.replaceChildren(...langButtons(state.lang, setLang));
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

const teamBadge = (team) => el('span', { class: `badge team-${team}` }, tr(`team.${team}`));

// ---------- Screen 2: roles ----------
const expandedRoles = new Set();

function renderRoles() {
  const n = state.players.length;
  if (state.countsFor !== n) {
    state.counts = suggestRoles(n) ?? {};
    state.countsFor = n;
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
    el('button', { class: 'primary', disabled: errors.length > 0, onclick: onDeal }, tr('roles.deal')),
  );
}

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
  const errorsBox = el('div');
  const form = el('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const v = (id) => form.querySelector(`#f-${id}`).value;
      const fields = { nameVi: v('nameVi'), rulesVi: v('rulesVi'), nameEn: v('nameEn'), rulesEn: v('rulesEn'), team: v('team') };
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

const SCREENS = {
  players: renderPlayers,
  roles: renderRoles,
};

function render() {
  renderHeader();
  appEl.replaceChildren(SCREENS[state.screen]());
}

render();
