// UI: the only module that touches the DOM.
import { t } from './i18n.js';
import { createStore } from './storage.js';
import { validateSetup } from './deal.js';

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

const SCREENS = {
  players: renderPlayers,
};

function render() {
  renderHeader();
  appEl.replaceChildren(SCREENS[state.screen]());
}

render();
