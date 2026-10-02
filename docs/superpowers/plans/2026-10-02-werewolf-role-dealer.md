# Werewolf Role Dealer & Moderator Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-only, bilingual (VI/EN) static web app that deals secret Werewolf roles by passing one phone around, lets a non-playing moderator track deaths and notes, and shows everyone a recap at the end.

**Architecture:** Static site, no build step. Pure ES modules (`i18n`, `roles`, `suggest`, `deal`, `game`, `storage`) hold all logic and are unit-tested with Node's built-in runner; `app.js` is the only module that touches the DOM and is verified manually in a mobile viewport.

**Tech Stack:** HTML, CSS, JavaScript ES modules; Node 22 `node:test` + `node:assert/strict` for tests; GitHub Pages for hosting.

**Spec:** `docs/superpowers/specs/2026-10-02-werewolf-role-dealer-design.md`

## Global Constraints

- No runtime dependencies and no dev dependencies. No build step.
- Every asset path and module import is relative (`./js/app.js`), never `/`-rooted (served from `/warewolf-mod/`).
- Only `js/app.js` touches the DOM. All other `js/*.js` modules must import cleanly in Node.
- All user-visible text comes from `i18n.js` (UI) or role objects (role text). Vietnamese is the default language.
- Text fallback: if the requested language is empty, show the other one.
- User-entered text (player names, notes, custom roles) is inserted with `textContent` / `value`, never `innerHTML`.
- Touch targets ≥ 44px. Phone layout only (target ~390px wide).
- localStorage keys: `ww.lang`, `ww.lastPlayers`, `ww.customRoles`, `ww.currentGame`.
- Test command: `npm test` (runs `node --test`).

## Review Focus

1. Vietnamese names typed with different Unicode compositions (NFC vs NFD) or case ("Minh" / "MINH" / " minh ") must count as duplicates → test in Task 4.
2. A saved game or role count referencing a role id that no longer exists (custom role deleted, old data) must render as an "unknown role" instead of crashing → test in Task 2.
3. Saved localStorage values with valid JSON but the wrong shape (e.g. `ww.lastPlayers = "{}"`, `ww.currentGame = 5`) must be treated as missing → test in Task 6.
4. A double tap on "Đã xem, ẩn đi" must advance exactly one player, never skip someone's reveal → manual check in Task 9.
5. Going back from Roles to Players and changing the player count must re-suggest counts for the new size, not keep a stale total → manual check in Task 8.

---

## File Structure

```
package.json            {"type": "module", "scripts": {"test": "node --test"}}; lets Node load js/*.js as ESM
index.html              single page; <main id="app">; loads ./js/app.js as module
css/style.css           mobile styles
js/i18n.js              UI dictionary, t(), localize(), phaseLabel()
js/roles.js             built-in roles, role lookup, custom role creation
js/suggest.js           suggestRoles(n)
js/deal.js              validateSetup(), dealRoles(), cryptoRandom()
js/game.js              game model: phases, events, undo, win check, timeline
js/storage.js           createStore(backend)
js/app.js               state, screens, rendering, event wiring
tests/helpers.js        seededRng(seed), fakeStorage(), throwingStorage()
tests/*.test.js         one file per logic module
```

---

### Task 1: Project scaffold and i18n

**Files:**
- Create: `package.json`, `js/i18n.js`, `tests/i18n.test.js`, `.gitignore` (`node_modules/`)

**Interfaces:**
- Produces:
  - `UI: { [key: string]: { vi: string, en: string } }`
  - `t(key: string, lang: 'vi'|'en', params?: object) -> string`: replaces `{name}`-style placeholders with `params` values; unknown key returns the key itself.
  - `localize(text: {vi?: string, en?: string}, lang) -> string`: requested language, falling back to the other when empty/missing; `''` if both empty.
  - `phaseLabel(phase: {kind, number}, lang) -> string`: `Đêm 1` / `Night 1`, `Ngày 1` / `Day 1`.

- [ ] **Step 1: Write the failing tests** in `tests/i18n.test.js`

```js
test('t replaces params', () => {
  assert.equal(t('deal.handoff', 'vi', { name: 'Minh' }), 'Đưa máy cho Minh');
  assert.equal(t('deal.handoff', 'en', { name: 'Minh' }), 'Pass the phone to Minh');
});
test('t returns key for unknown key', () => assert.equal(t('nope', 'vi'), 'nope'));
test('localize falls back', () => {
  assert.equal(localize({ vi: 'Sói', en: '' }, 'en'), 'Sói');
  assert.equal(localize({ vi: 'Sói' }, 'en'), 'Sói');
  assert.equal(localize({ vi: '', en: 'Wolf' }, 'vi'), 'Wolf');
});
test('phaseLabel', () => {
  assert.equal(phaseLabel({ kind: 'night', number: 1 }, 'vi'), 'Đêm 1');
  assert.equal(phaseLabel({ kind: 'day', number: 2 }, 'en'), 'Day 2');
});
test('every UI key has non-empty vi and en', () => {
  for (const [k, v] of Object.entries(UI)) {
    assert.ok(v.vi?.trim(), `${k}.vi`); assert.ok(v.en?.trim(), `${k}.en`);
  }
});
```

- [ ] **Step 2: Run** `npm test` (after creating `package.json`). Expected: FAIL, cannot find `../js/i18n.js`.

- [ ] **Step 3: Implement `js/i18n.js`.** Start `UI` with keys `deal.handoff` (`Đưa máy cho {name}` / `Pass the phone to {name}`), `phase.night` (`Đêm {n}` / `Night {n}`), `phase.day` (`Ngày {n}` / `Day {n}`). Later tasks add their own keys; the "every key" test keeps them complete.

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: scaffold project and add i18n module`

---

### Task 2: Roles

**Files:**
- Create: `js/roles.js`, `tests/roles.test.js`

**Interfaces:**
- Consumes: none (role text is `{vi, en}` objects; display uses `localize` from Task 1).
- Produces:
  - `Role = { id, team: 'wolf'|'village'|'neutral', name: {vi, en}, rules: {vi, en}, custom: boolean }`
  - `BUILTIN_ROLES: Role[]` in this order: `werewolf, wolfcub, villager, seer, bodyguard, witch, hunter, cupid, fool`
  - `allRoles(customRoles: Role[]) -> Role[]`: built-ins then customs.
  - `getRole(id, customRoles) -> Role`: unknown id returns `UNKNOWN_ROLE` (`id: 'unknown'`, team `'neutral'`, name `Vai không xác định` / `Unknown role`, rules `''`).
  - `createCustomRole({nameVi, rulesVi, nameEn, rulesEn, team}, now: number) -> Role`: trims all text; throws `Error('NAME_REQUIRED')` / `Error('RULES_REQUIRED')` when trimmed VI name/rules are empty, `Error('BAD_TEAM')` for any other team; id `custom-<now>`; `custom: true`.
  - `updateCustomRole(role, fields) -> Role`: same validation, keeps `id`.

- [ ] **Step 1: Write the failing tests**
  - `every built-in role has non-empty vi/en name and rules` (loop over `BUILTIN_ROLES`)
  - `built-in ids and teams`: `werewolf`/`wolfcub` → `wolf`, `fool` → `neutral`, the other 6 → `village`; Vietnamese names exactly `Ma Sói, Sói Con, Dân Làng, Tiên Tri, Bảo Vệ, Phù Thủy, Thợ Săn, Thần Tình Yêu, Kẻ Ngốc`
  - `getRole finds custom roles` and `getRole('custom-999', [])` → `id === 'unknown'` (Review Focus 2)
  - `createCustomRole trims and builds`: `({nameVi:' Già Làng ', rulesVi:'Sống 2 mạng', nameEn:'', rulesEn:'', team:'village'}, 1700)` → `{id:'custom-1700', name:{vi:'Già Làng', en:''}, custom:true, ...}`
  - `createCustomRole rejects`: blank name → `/NAME_REQUIRED/`, blank rules → `/RULES_REQUIRED/`, team `'x'` → `/BAD_TEAM/`
  - `updateCustomRole keeps id`

- [ ] **Step 2: Run** `npm test`. Expected: FAIL, missing module.

- [ ] **Step 3: Implement `js/roles.js`.** Write full rules text in both languages from the spec §4 table (one or two sentences each, same meaning as the summaries).

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: add built-in and custom roles`

---

### Task 3: Role suggestion

**Files:**
- Create: `js/suggest.js`, `tests/suggest.test.js`

**Interfaces:**
- Produces: `suggestRoles(n: number) -> { [roleId]: number } | null`. Only non-zero counts are present. `null` when `n < 5`, `n > 20`, or not an integer.

- [ ] **Step 1: Write the failing tests**
  - `null outside 5–20`: `4, 21, 0, 5.5`
  - `total equals n for 5..20`
  - `wolf-team size is floor(n/4)` for 5..20 (`werewolf + wolfcub`)
  - `examples from spec`:
    - `suggestRoles(5)` deep-equals `{werewolf:1, seer:1, villager:3}`
    - `suggestRoles(12)` deep-equals `{werewolf:2, wolfcub:1, seer:1, bodyguard:1, witch:1, hunter:1, villager:5}`
  - `thresholds`: bodyguard absent at 5, present at 6; witch at 7 vs 8; hunter at 9 vs 10; wolfcub at 11 vs 12; cupid at 13 vs 14
  - `never suggests fool` for 5..20

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `suggestRoles`** per spec §5.

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: suggest balanced role counts`

---

### Task 4: Setup validation and dealing

**Files:**
- Create: `js/deal.js`, `tests/helpers.js`, `tests/deal.test.js`

**Interfaces:**
- Consumes: `getRole(id, customRoles)` from Task 2.
- Produces:
  - `validateSetup(players: string[], counts: {[roleId]: number}, customRoles: Role[]) -> string[]`: error codes from spec §6, each at most once, in this order: `TOO_FEW_PLAYERS, TOO_MANY_PLAYERS, EMPTY_NAME, DUPLICATE_NAME, COUNT_MISMATCH, NO_WOLF`. (The spec's signature gains `customRoles` because the wolf check needs custom roles' teams.)
  - `nameKey(name) -> string`: `name.normalize('NFC').trim().toLocaleLowerCase('vi')`; used for duplicate detection.
  - `cryptoRandom() -> number` in `[0, 1)` from `crypto.getRandomValues(new Uint32Array(1))[0] / 2**32`.
  - `dealRoles(players: string[], counts, rng = cryptoRandom) -> {name, roleId}[]`: expand counts to a list (in `Object.keys(counts)` order), Fisher–Yates shuffle with `rng`, pair with players by index. Names are stored trimmed.
- `tests/helpers.js` produces `seededRng(seed) -> () => number` (mulberry32), `fakeStorage()` (Map-backed `getItem/setItem/removeItem`), `throwingStorage()` (every method throws).

- [ ] **Step 1: Write the failing tests**
  - one test per error code, each with an otherwise-valid setup (e.g. 5 players `['An','Bình','Chi','Dũng','Em']`, counts `{werewolf:1, villager:4}`)
  - `valid setup returns []`
  - `custom wolf role satisfies NO_WOLF`: counts `{'custom-1':1, villager:4}` with a custom role of team `wolf`
  - `duplicates across case, spaces and Unicode form` (Review Focus 1): `['Minh', ' MINH ']` and `['Đức', 'Đức'.normalize('NFD')]` both give `DUPLICATE_NAME`
  - `dealRoles matches counts`: role multiset of the result equals the counts; names in entry order
  - `dealRoles is deterministic with seededRng(42)` and `differs for seeds 1 and 2` (12 players)
  - `cryptoRandom in range` (1000 samples in `[0,1)`)

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `js/deal.js`** and `tests/helpers.js`.

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: validate setup and deal roles`

---

### Task 5: Game model

**Files:**
- Create: `js/game.js`, `tests/game.test.js`

**Interfaces:**
- Consumes: `getRole` from Task 2.
- Produces (all pure; never mutate the input):
  - `newGame(dealt: {name, roleId}[]) -> Game` with `phase {kind:'night', number:1}`, `events []`, `winner null`.
  - `nextPhase(game) -> Game`
  - `recordDeath(game, name, cause) -> Game`: throws `Error('ALREADY_DEAD')`, `Error('UNKNOWN_PLAYER')`, `Error('BAD_CAUSE')` (causes: `wolf, hanged, poison, hunter, lover, other`). Event `phase` is a copy of the current phase.
  - `addNote(game, text) -> Game`: trims; throws `Error('EMPTY_NOTE')`.
  - `undo(game) -> Game`
  - `alivePlayers(game) -> {name, roleId}[]`
  - `deathOf(game, name) -> DeathEvent | undefined`
  - `checkWinner(game, customRoles) -> 'fool'|'village'|'wolf'|null` (spec §8 order)
  - `endGame(game, winner: 'village'|'wolf'|'fool'|'undecided') -> Game`
  - `timeline(game) -> {phase, events}[]`: groups events by phase in event order; phases without events do not appear.

- [ ] **Step 1: Write the failing tests** (use a 6-player game: An `werewolf`, Bình `wolfcub`, Chi `seer`, Dũng `villager`, Em `villager`, Giang `fool`)
  - `starts at night 1`; `nextPhase sequence`: night1 → day1 → night2
  - `recordDeath stores phase copy`: after `nextPhase`, mutating the game's phase later does not change the event's phase
  - `recordDeath rejects` dead player, unknown player, cause `'fire'`
  - `addNote trims and rejects blank`
  - `undo removes last event`; `undo on empty is no-op`
  - `inputs are not mutated` (deep-equal the original after each function)
  - `checkWinner`:
    - `null` at start
    - `'fool'` when Giang `hanged` (even if wolves also all dead)
    - Giang killed by `wolf` → not `'fool'`
    - `'village'` when An and Bình dead
    - `'wolf'` when alive wolves 2 vs others 2
    - a custom role with team `wolf` counts as a wolf
  - `timeline groups and skips empty phases`: events in night 1 and night 2 only → 2 groups, no day 1
  - `endGame sets winner`

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `js/game.js`.**

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: add game model with win check and timeline`

---

### Task 6: Storage

**Files:**
- Create: `js/storage.js`, `tests/storage.test.js`

**Interfaces:**
- Consumes: `fakeStorage`, `throwingStorage` from `tests/helpers.js`.
- Produces: `createStore(backend = globalThis.localStorage) -> Store`, where
  - `getLang() -> 'vi'|'en'` (default `'vi'`), `setLang(lang)`
  - `getLastPlayers() -> string[]` (default `[]`), `setLastPlayers(names)`
  - `getCustomRoles() -> Role[]` (default `[]`), `setCustomRoles(roles)`
  - `getCurrentGame() -> {stage:'deal'|'tracker', dealIndex:number, game:Game} | null`, `setCurrentGame(saved)`, `clearCurrentGame()`
  - `persistent: boolean`: `false` when the in-memory fallback is used
- Behaviour: probe the backend once (`setItem('ww.probe','1')` + `removeItem`); if it throws or `backend` is undefined, use an in-memory Map. Every read parses JSON in try/catch and checks shape (lang is `'vi'|'en'`; arrays are arrays; current game is an object with valid `stage`, numeric `dealIndex`, and `game.players` array). Anything else returns the default.

- [ ] **Step 1: Write the failing tests**
  - round-trip for each getter/setter on `fakeStorage()`
  - defaults on empty storage
  - corrupt JSON (`'{'`) in each key → default
  - wrong shape (Review Focus 3): `ww.lang = '"fr"'`, `ww.lastPlayers = '{}'`, `ww.customRoles = '5'`, `ww.currentGame = '5'` and `'{"stage":"x"}'` → defaults
  - `throwingStorage()`: `persistent === false`, setters do not throw, values round-trip in memory
  - `createStore(undefined)` works the same way (Node has no localStorage)
  - `clearCurrentGame` → `getCurrentGame() === null`

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `js/storage.js`.**

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: add localStorage wrapper with fallback`

---

### Task 7: App shell and Players screen

**Files:**
- Create: `index.html`, `css/style.css`, `js/app.js`
- Modify: `js/i18n.js` (add keys)

**Interfaces:**
- Consumes: `t`, `localize` (Task 1); `createStore` (Task 6); `nameKey`, `validateSetup` (Task 4).
- Produces (inside `app.js`, used by Tasks 8–11):
  - `state = { lang, screen: 'players'|'roles'|'deal'|'tracker'|'recap', players: string[], counts: {}, countsFor: number|null, dealt: [], dealIndex: 0, dealView: 'handoff'|'reveal'|'done', revealLang, game: null }`
  - `render()`: clears `#app` and calls the renderer for `state.screen`.
  - `el(tag, attrs?, ...children) -> HTMLElement`: string children become text nodes; never sets `innerHTML`.
  - `go(screen)`: sets `state.screen`, calls `render()`, scrolls to top.
  - `save()`: writes `state.lang`, and, when screen is `deal`/`tracker`, `currentGame`.

- [ ] **Step 1: Build `index.html`.** `<html lang="vi">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<title>Ma Sói</title>`, `./css/style.css`, `<header>` with the title and a VI | EN toggle, `<main id="app">`, `<script type="module" src="./js/app.js">`.

- [ ] **Step 2: Write `css/style.css`.** CSS variables for colors; system font stack; body max-width 480px centered; buttons and inputs min-height 44px; full-width primary button; `.dead` greyed out; team colors (wolf red, village green, neutral amber); respect `env(safe-area-inset-*)`.

- [ ] **Step 3: Implement the Players screen.** Name inputs prefilled from `getLastPlayers()` (or two empty rows), "+ Thêm người chơi / Add player", ✕ per row, player count shown, inline errors for `EMPTY_NAME`, `DUPLICATE_NAME`, `TOO_FEW_PLAYERS`, `TOO_MANY_PLAYERS` from `validateSetup(players, {}, [])` (ignore the role errors). "Tiếp / Next" is disabled while any of those exist; on Next, store the trimmed names with `setLastPlayers`, then `go('roles')`. The header language toggle sets `state.lang`, calls `setLang`, re-renders.

- [ ] **Step 4: Run** `npm test`. Expected: PASS (the i18n key test covers the new keys).

- [ ] **Step 5: Manual check.** Run `npx serve .`, open it in Chrome DevTools device mode (iPhone 12 Pro, 390px). Check:
  - adding/removing players works and the language toggle switches all text
  - a duplicate name and a blank name each show an error and disable Next
  - a name of `<b>Hi</b>` displays literally
  - no horizontal scroll
  - after a reload, the names entered last time are prefilled

- [ ] **Step 6: Commit** `feat: add app shell and players screen`

---

### Task 8: Roles screen and custom roles

**Files:**
- Modify: `js/app.js`, `js/i18n.js`, `css/style.css`

**Interfaces:**
- Consumes: `suggestRoles` (Task 3); `allRoles`, `getRole`, `createCustomRole`, `updateCustomRole` (Task 2); `validateSetup` (Task 4); `getCustomRoles`/`setCustomRoles`/`getCurrentGame` (Task 6).

- [ ] **Step 1: Counts.** On entering the screen, if `state.countsFor !== state.players.length`, set `state.counts = suggestRoles(n) ?? {}` and `state.countsFor = n` (Review Focus 5). Show a line explaining when no suggestion is available (outside 5–20).

- [ ] **Step 2: Role list.** One row per role from `allRoles(customRoles)`: localized name, team badge, − count +, tap the name to expand its rules. Total `x/n` turns green when equal. Errors `COUNT_MISMATCH`, `NO_WOLF` are shown inline; "Chia bài / Deal" is disabled while `validateSetup` returns anything. "← Quay lại / Back" goes to players.

- [ ] **Step 3: Custom role form.** "Thêm vai tùy chỉnh / Add custom role" opens fields: Tên (VI)*, Luật (VI)*, Name (EN), Rules (EN), team select. Save calls `createCustomRole(fields, Date.now())` and appends via `setCustomRoles`. Thrown codes map to i18n messages. Custom rows get Edit (same form, `updateCustomRole`) and Delete. Delete is refused with a message when `getCurrentGame()?.game.players` uses that id; otherwise it removes the role from storage and from `state.counts`.

- [ ] **Step 4: Deal.** "Chia bài / Deal" sets `state.dealt = dealRoles(players, counts)`, `dealIndex = 0`, `dealView = 'handoff'`, then `go('deal')` and `save()`.

- [ ] **Step 5: Run** `npm test`. Expected: PASS.

- [ ] **Step 6: Manual check.**
  - 8 players gives 2 Ma Sói, Tiên Tri, Bảo Vệ, Phù Thủy, 3 Dân Làng.
  - Go back, change to 12 players, come forward: the counts re-suggest for 12.
  - 4 players gives all zeros plus the explanation; setting counts by hand enables Deal.
  - Removing all wolves shows the error.
  - Create, edit and delete a custom role; the custom role survives a reload.

- [ ] **Step 7: Commit** `feat: add roles screen with custom roles`

---

### Task 9: Deal screen

**Files:**
- Modify: `js/app.js`, `js/i18n.js`, `css/style.css`

**Interfaces:**
- Consumes: `getRole`, `localize`, `t`; state fields from Task 7.

- [ ] **Step 1: Hand-off view.** Big "Đưa máy cho **{name}**" (the name is a separate text node, not HTML) with progress `3/12`, and a "Xem vai / See role" button. Pressing it sets `dealView = 'reveal'` and `revealLang = state.lang`.

- [ ] **Step 2: Reveal view.** Role name, team badge, rules from `getRole(roleId, customRoles)`, plus its own VI | EN toggle (changes `revealLang` only) and "Đã xem, ẩn đi / Seen, hide". The hide handler only acts when `dealView === 'reveal'` (guards double taps, Review Focus 4). It increments `dealIndex`, sets `dealView` to `'handoff'` (or `'done'` after the last player) and calls `save()`.

- [ ] **Step 3: Hiding on tab switch.** Add a `visibilitychange` listener: when hidden while `screen === 'deal'` and `dealView === 'reveal'`, set `dealView = 'handoff'` and re-render (same player).

- [ ] **Step 4: Done view.** "Đưa máy cho quản trò / Give the phone to the moderator" plus "Tôi là quản trò / I am the moderator". Pressing it sets `state.game = newGame(state.dealt)`, calls `go('tracker')` and `save()`.

- [ ] **Step 5: Run** `npm test`. Expected: PASS.

- [ ] **Step 6: Manual check.**
  - Deal 5 players; each reveal shows a role and the VI/EN toggle works per player, resetting for the next.
  - Double-tapping "Seen, hide" quickly advances exactly one player.
  - Switching tabs during a reveal returns to the hand-off for the same player.
  - The roles shown match the summary on the tracker.

- [ ] **Step 7: Commit** `feat: add pass-the-phone deal screen`

---

### Task 10: Game tracker

**Files:**
- Modify: `js/app.js`, `js/i18n.js`, `css/style.css`

**Interfaces:**
- Consumes: `nextPhase`, `recordDeath`, `addNote`, `undo`, `alivePlayers`, `deathOf`, `checkWinner`, `endGame` (Task 5); `phaseLabel` (Task 1).
- Produces: i18n keys `cause.wolf|hanged|poison|hunter|lover|other` with timeline wording (`bị Sói cắn` / `was killed by the werewolves`, `bị treo cổ` / `was hanged`, `bị Phù Thủy đầu độc` / `was poisoned by the Witch`, `bị Thợ Săn bắn` / `was shot by the Hunter`, `chết theo người yêu` / `died with their lover`, `chết (lý do khác)` / `died (other cause)`) and `winner.village|wolf|fool|undecided`; Task 11 reuses them.

- [ ] **Step 1: Layout.** The header shows `phaseLabel(game.phase, lang)` plus alive count. The player list shows name, role and team colour. Dead players are greyed out with the cause and phase.

- [ ] **Step 2: Actions.**
  - Tapping a living player opens a cause picker (6 buttons + cancel), which calls `recordDeath`.
  - "+ Ghi chú / Note" opens a textarea, then calls `addNote`.
  - "Hoàn tác / Undo" calls `undo` (disabled with no events).
  - "Sang phase tiếp / Next phase" calls `nextPhase`.
  - Every action replaces `state.game`, calls `save()` and re-renders. Errors thrown by the game model show as a message and never crash.

- [ ] **Step 3: Win banner.** After each action, run `checkWinner(game, customRoles)`. When it is not `null`, a banner names the winner with "Xác nhận / Confirm" (`endGame(game, winner)`, then `go('recap')`) and "Chơi tiếp / Keep playing" (hides the banner until the next action).

- [ ] **Step 4: End game.** "Kết thúc ván / End game" with no current suggestion asks the moderator to pick Village, Werewolves, Fool or Undecided, then calls `endGame` and `go('recap')`. With a suggestion, it behaves like Confirm.

- [ ] **Step 5: Run** `npm test`. Expected: PASS.

- [ ] **Step 6: Manual check.**
  - Record a night kill and a day hanging, add a note, undo the note; the phase labels advance correctly.
  - Killing all wolves shows the village banner; Keep playing hides it.
  - Hanging the Fool shows the Fool banner.
  - Reload mid-game; it resumes after Task 11 (skip until then).

- [ ] **Step 7: Commit** `feat: add moderator game tracker`

---

### Task 11: Recap, resume prompt and deployment

**Files:**
- Modify: `js/app.js`, `js/i18n.js`, `css/style.css`
- Create: `README.md` (what it is, `npm test`, `npx serve .`, the live URL)

**Interfaces:**
- Consumes: `timeline` (Task 5); cause/winner keys (Task 10); `getCurrentGame`, `clearCurrentGame` (Task 6).

- [ ] **Step 1: Recap screen.** On entering it, call `clearCurrentGame()`. The screen shows:
  - the winner banner
  - all players with their role (localized), team, and alive/dead (cause and phase)
  - the timeline from `timeline(game)`: per group a `phaseLabel` heading, then lines `{name} {cause text}` or the note text
  - a VI | EN toggle (switches `state.lang` for this screen) and "Ván mới / New game", which resets the game state and goes to `players` with names still prefilled

- [ ] **Step 2: Resume prompt.** On startup, if `getCurrentGame()` is not null, show "Tiếp tục ván đang chơi? / Continue the current game?" with Yes and No:
  - **Yes** restores `dealt`/`dealIndex` and `game`, then opens `deal` (hand-off view at `dealIndex`, or the done view if past the end) or `tracker`.
  - **No** calls `clearCurrentGame()` and goes to `players`.

  Show a small notice when `store.persistent === false`: "Trình duyệt không lưu được dữ liệu / This browser can't save data".

- [ ] **Step 3: Run** `npm test`. Expected: PASS.

- [ ] **Step 4: Full manual check (spec §10).** In a 390px viewport, play a full game in Vietnamese and another in English: players, then roles, then deal, then tracker, then recap. Also check:
  - reload mid-deal and mid-game, then resume
  - switch tabs during a reveal
  - open a private window (the notice shows and the app still works)
  - grep that `index.html` and `js/` contain no `src="/`, `href="/` or `from '/'`

- [ ] **Step 5: Commit and push** `feat: add recap screen and resume prompt`, then `git push`.

- [ ] **Step 6: Deployment check.** The user enables GitHub Pages (Settings → Pages → Deploy from branch `main`, `/ (root)`; repository public). Then open `https://mymys91.github.io/warewolf-mod/` on a real phone and run through a 5-player game.
