# Deal Modes & Private Role Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "moderator assigns" deal mode, a private role check screen (opened after assigning or at any time from the tracker), and show the revealed role as a flipping playing card with an emoji icon.

**Architecture:** The pure assignment logic goes in `js/deal.js` and is unit-tested with `node:test`. All DOM work stays in `js/app.js`: two new screens (`assign`, `roleCheck`), and the hand-off and reveal views pulled out of `renderDeal` so the deal and role check screens share them and render the flipping card. Role icons live in `js/roles.js`. `js/storage.js` accepts one more saved stage, `'check'`.

**Tech Stack:** Vanilla ES modules, no build step and no dependencies; tests run with `node --test` (Node 20+).

**Spec:** `docs/superpowers/specs/2026-10-03-deal-modes-and-role-check-design.md` (it extends `docs/superpowers/specs/2026-10-02-werewolf-role-dealer-design.md`).

## Global Constraints

- No dependencies and no build step. Only `js/app.js` touches the DOM; `deal.js` and `storage.js` stay pure.
- All UI text comes from `js/i18n.js` with both `vi` and `en`. Never use `innerHTML`; build elements with `el(...)`.
- Assignments are an object that maps the player index (0-based, a number) to a role id. A key read back from the object is a string, so convert it with `Number(key)` before comparing.
- `assignRoles` output must have the same shape as `dealRoles`: `{ name: string (trimmed), roleId: string }[]`.
- Resume must never land on a reveal view.
- Opening the role check from the tracker must not change the saved stage; it stays `'tracker'`.
- Commit messages follow the repo's style (`feat: …`, `refactor: …`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The moderator lowers a count after assigning roles.** Going back to Roles, lowering "Ma Sói" from 2 to 1 and returning should keep the assignment for the lower-index player and drop the higher one. Pinned by the `pruneAssignments` tests in Task 1.
2. **A role is set back to the placeholder.** Choosing "— Choose a role —" again must remove the key, not store `''`. An empty string would count as assigned and could let Continue through. Pinned by the `validateAssignment` test "empty string role counts as unassigned" in Task 1.
3. **A refresh during the role check started from the tracker.** It must resume to the tracker with the game intact, not to the role check. Manual check in Task 6, step 6.
4. **The tab is hidden while a player is looking at their role on the role check screen.** It must go back to the hand-off view for the same player. Manual check in Task 6, step 6.
5. **A double tap on "Seen, hide" or "I am the moderator" during the role check.** It must not skip the return view or open the next player. These buttons use `dealGuard`; manual check in Task 6, step 6.

---

### Task 1: Assignment logic in `deal.js`

**Files:**
- Modify: `js/deal.js` (append the new exports)
- Test: `tests/deal.test.js` (append tests; extend the import line)

**Interfaces:**
- Produces:
  - `remainingCounts(counts: {[roleId]: number}, assignments: {[index]: roleId}) → {[roleId]: number}`: one entry per key in `counts`, the count minus the number of times that role is assigned. Values can be negative.
  - `validateAssignment(players: string[], counts, assignments) → string[]`: a subset of `['UNASSIGNED', 'OVER_ASSIGNED']`, each code at most once and in that order.
    - `UNASSIGNED`: some index `0..players.length-1` has no role, or its role is `''`.
    - `OVER_ASSIGNED`: some role is assigned more often than `counts[role] ?? 0`.
  - `assignRoles(players: string[], assignments) → {name, roleId}[]`: `players.map((name, i) => ({ name: name.trim(), roleId: assignments[i] }))`.
  - `pruneAssignments(playerCount: number, counts, assignments) → assignments`: returns a new object and never mutates its input. It drops:
    - keys `>= playerCount`
    - keys whose role is `''`
    - for each role, assignments past `counts[role] ?? 0`, keeping the lowest indexes

- [ ] **Step 1: Write the failing tests** (extend the import to `{ validateSetup, nameKey, dealRoles, cryptoRandom, remainingCounts, validateAssignment, assignRoles, pruneAssignments }`)

```js
const counts = { werewolf: 1, seer: 1, villager: 3 };
const full = { 0: 'werewolf', 1: 'seer', 2: 'villager', 3: 'villager', 4: 'villager' };

test('remainingCounts: none, partial, full, over', () => {
  assert.deepEqual(remainingCounts(counts, {}), counts);
  assert.deepEqual(remainingCounts(counts, { 0: 'villager', 1: 'werewolf' }), { werewolf: 0, seer: 1, villager: 2 });
  assert.deepEqual(remainingCounts(counts, full), { werewolf: 0, seer: 0, villager: 0 });
  assert.deepEqual(remainingCounts(counts, { ...full, 1: 'werewolf' }), { werewolf: -1, seer: 1, villager: 0 });
});

test('validateAssignment: complete assignment is valid', () => {
  assert.deepEqual(validateAssignment(five, counts, full), []);
});
test('validateAssignment: missing index is UNASSIGNED', () => {
  const { 4: _, ...partial } = full;
  assert.deepEqual(validateAssignment(five, counts, partial), ['UNASSIGNED']);
});
test('validateAssignment: empty string role counts as unassigned', () => {
  assert.deepEqual(validateAssignment(five, counts, { ...full, 4: '' }), ['UNASSIGNED']);
});
test('validateAssignment: OVER_ASSIGNED', () => {
  assert.deepEqual(validateAssignment(five, counts, { ...full, 1: 'werewolf' }), ['OVER_ASSIGNED']);
});
test('validateAssignment: role not in counts is OVER_ASSIGNED', () => {
  assert.deepEqual(validateAssignment(five, counts, { ...full, 4: 'hunter' }), ['OVER_ASSIGNED']);
});
test('validateAssignment: both errors', () => {
  assert.deepEqual(validateAssignment(five, counts, { 0: 'werewolf', 1: 'werewolf' }), ['UNASSIGNED', 'OVER_ASSIGNED']);
});
test('validateAssignment: custom role ids', () => {
  const c = { werewolf: 1, 'custom-abc': 1, villager: 3 };
  assert.deepEqual(validateAssignment(five, c, { ...full, 1: 'custom-abc' }), []);
});

test('assignRoles matches dealRoles shape, trimmed, in order', () => {
  const out = assignRoles([' An ', ...five.slice(1)], full);
  assert.deepEqual(out[0], { name: 'An', roleId: 'werewolf' });
  assert.deepEqual(out.map((p) => p.name), five);
  assert.deepEqual(Object.keys(out[0]).sort(), Object.keys(dealRoles(five, counts, seededRng(1))[0]).sort());
});

test('pruneAssignments: drops out-of-range indexes and empty roles', () => {
  assert.deepEqual(pruneAssignments(3, counts, { 0: 'werewolf', 2: '', 4: 'seer' }), { 0: 'werewolf' });
});
test('pruneAssignments: lowered count keeps lowest indexes', () => {
  const a = { 0: 'werewolf', 1: 'villager', 3: 'werewolf' };
  assert.deepEqual(pruneAssignments(5, { werewolf: 1, villager: 4 }, a), { 0: 'werewolf', 1: 'villager' });
});
test('pruneAssignments: role with count 0 is dropped; input not mutated', () => {
  const a = { 0: 'seer', 1: 'werewolf' };
  assert.deepEqual(pruneAssignments(5, { werewolf: 1, villager: 4 }, a), { 1: 'werewolf' });
  assert.deepEqual(a, { 0: 'seer', 1: 'werewolf' });
});
```

- [ ] **Step 2: Run the tests and check that they fail**

Run: `node --test tests/deal.test.js`
Expected: FAIL, with a SyntaxError saying the requested module does not provide an export named `remainingCounts`.

- [ ] **Step 3: Implement the four functions in `js/deal.js`**

`pruneAssignments` has to walk the keys in ascending numeric order (`Object.keys(...).map(Number).sort((a, b) => a - b)`) while keeping a running count per role. That is what makes it keep the lowest indexes.

- [ ] **Step 4: Run all the tests and check that they pass**

Run: `npm test`
Expected: all tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/deal.js tests/deal.test.js
git commit -m "feat: validate and apply moderator role assignments"
```

---

### Task 2: Accept stage `'check'` in saved games

**Files:**
- Modify: `js/storage.js` (`isSavedGame`)
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces: `store.setCurrentGame({ stage: 'check', dealIndex: 0, game })` round-trips through `store.getCurrentGame()`.

- [ ] **Step 1: Write the failing test**

```js
test('stage check round-trips; unknown stage still rejected', () => {
  const store = createStore(fakeStorage());
  const saved = { stage: 'check', dealIndex: 0, game: { players: [{ name: 'An', roleId: 'werewolf' }] } };
  store.setCurrentGame(saved);
  assert.deepEqual(store.getCurrentGame(), saved);
  store.setCurrentGame({ ...saved, stage: 'assign' });
  assert.equal(store.getCurrentGame(), null);
});
```

(Use the file's existing imports for `createStore` and `fakeStorage`.)

- [ ] **Step 2: Run it and check that it fails**

Run: `node --test tests/storage.test.js`
Expected: FAIL. `getCurrentGame()` returns `null` for stage `'check'`.

- [ ] **Step 3: In `isSavedGame`, allow `v.stage === 'check'` next to `'deal'` and `'tracker'`.**

- [ ] **Step 4: Run all the tests and check that they pass**

Run: `npm test`
Expected: all tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: accept role-check stage in saved games"
```

---

### Task 3: Role icons and the icon field on custom roles

**Files:**
- Modify: `js/roles.js` (the `role()` helper, `BUILTIN_ROLES`, `UNKNOWN_ROLE`, `buildFields`, `createCustomRole`, `updateCustomRole`, the new `roleIcon`)
- Modify: `js/app.js` (`openCustomRoleForm`)
- Modify: `js/i18n.js`, `css/style.css`
- Test: `tests/roles.test.js`

**Interfaces:**
- Produces:
  - `role.icon?: string` on every role object
  - `roleIcon(role) → string`, exported from `roles.js`: `role.icon` when it is non-empty, otherwise `'❓'`
  - `fields.icon` (optional string), accepted by `createCustomRole(fields, now)` and `updateCustomRole(existing, fields)`

**Icons** (exact values): werewolf `🐺`, wolfcub `🐾`, villager `🧑‍🌾`, seer `🔮`, bodyguard `🛡️`, witch `🧪`, hunter `🏹`, cupid `💘`, fool `🤡`, `UNKNOWN_ROLE` `❓`. The picker row in the form: `🐺 🦊 🧛 👻 🧙 👑 🕵️ 👼 💀 🐍 🌙 ⭐`.

- [ ] **Step 1: Write the failing tests** (add `roleIcon` to the import; `valid` is the existing fixture)

```js
test('every built-in role has an icon', () => {
  for (const r of BUILTIN_ROLES) assert.ok(r.icon && r.icon.trim(), r.id);
  assert.equal(getRole('werewolf').icon, '🐺');
});
test('createCustomRole keeps a trimmed icon, omits an empty one', () => {
  assert.equal(createCustomRole({ ...valid, icon: ' 🦊 ' }, 1).icon, '🦊');
  assert.equal('icon' in createCustomRole({ ...valid, icon: '  ' }, 1), false);
  assert.equal('icon' in createCustomRole(valid, 1), false);
});
test('updateCustomRole replaces and clears the icon', () => {
  const r = createCustomRole({ ...valid, icon: '🦊' }, 1);
  assert.equal(updateCustomRole(r, { ...valid, icon: '👻' }).icon, '👻');
  assert.equal('icon' in updateCustomRole(r, { ...valid, icon: '' }), false);
});
test('roleIcon falls back to ❓', () => {
  assert.equal(roleIcon(createCustomRole(valid, 1)), '❓');
  assert.equal(roleIcon(getRole('custom-404', [])), '❓');
  assert.equal(roleIcon(getRole('seer')), '🔮');
});
```

- [ ] **Step 2: Run the tests and check that they fail**

Run: `node --test tests/roles.test.js`
Expected: FAIL, with a SyntaxError saying there is no export named `roleIcon`.

- [ ] **Step 3: Implement the changes in `js/roles.js`**
  - Add `icon` as the first parameter after `team` in the `role()` helper. Use the icon values above.
  - In `buildFields`, return `icon` only when `(fields.icon ?? '').trim()` is non-empty.
  - Make `updateCustomRole` drop the old `icon` before merging, so clearing the icon removes it: `const { icon, ...rest } = existing; return { ...rest, ...buildFields(fields) };`

- [ ] **Step 4: Run all the tests and check that they pass**

Run: `npm test`
Expected: all tests pass, 0 fail.

- [ ] **Step 5: Add the icon field to the custom role form**
  - Add the i18n key `custom.icon`: vi `Biểu tượng`, en `Icon`.
  - In `openCustomRoleForm`, after the team select, add:
    - a label
    - a `div.icon-picker` holding 12 `button type="button" class="small"`; each one sets the input's value to its emoji
    - `input#f-icon` with `maxlength="8"` and value `existing?.icon ?? ''`
  - Add `icon: v('icon')` to `fields`.
  - CSS: `.icon-picker { display: flex; flex-wrap: wrap; gap: 6px; }`, with each button about 1.4rem in font size.

- [ ] **Step 6: Check by hand**

Run `npx serve .`.
- Create a custom role by tapping 🦊, save it, and reopen Edit: the input shows 🦊.
- Clear the input and save: no error.
- An older custom role (saved before this change) still loads.

- [ ] **Step 7: Commit**

```bash
git add js/roles.js js/app.js js/i18n.js css/style.css tests/roles.test.js
git commit -m "feat: add role icons and custom role icon picker"
```

---

### Task 4: Shared hand-off and reveal views with the flipping role card

Pull the hand-off and reveal views out of `renderDeal` and turn the reveal into a flipping card. The deal screen's flow (steps, guards, the tab-switch reset) must not change. The code is DOM-only, so it is checked by hand.

**Files:**
- Modify: `js/app.js` (`state`, `renderDeal`, about lines 299–351)
- Modify: `css/style.css` (replace the `.reveal-card` rules, about lines 99–101)

**Interfaces:**
- Consumes: `roleIcon` from Task 3.
- Produces:
  - `renderHandoff(player: {name}, progress: string | null, onSee: () => void) → HTMLElement`
    - It shows the current hand-off content, plus `roleCardBack()` under the name.
    - The progress line is left out when `progress` is `null`.
    - The "See my role" button runs `dealGuard.wrap(() => { state.revealLang = state.lang; state.flipPending = true; onSee(); })`.
  - `renderReveal(player: {name, roleId}, progress: string | null, onHide: () => void) → HTMLElement`
    - It shows the VI | EN toggle (on `state.revealLang`), then `roleCard(player, role, lang)`, then the "Seen, hide" button, which runs `dealGuard.wrap(onHide)`.
    - `progress` is already localized by the caller; `renderDeal` passes `t('deal.progress', state.revealLang, …)`.
  - `state.flipPending: boolean`, initially `false`
- `renderDeal` keeps its own guard `if (state.dealView !== 'reveal') return;` inside the `onHide` it passes.

**Card markup** (built with `el`):

```
div.role-card.team-card-{team}[.flipped]
  div.role-card-inner
    div.role-card-face.role-card-back    → span 🌕
    div.role-card-face.role-card-front   → .role-icon (roleIcon), p.muted deal.youAre,
                                           p.role-title.team-{team}, teamBadge, p.role-rules
```

- `roleCardBack()` is the same wrapper with only the back face, and it is never flipped.

**Flip rule:**
- When `renderReveal` runs with `state.flipPending === true`:
  - set `state.flipPending = false`
  - if `matchMedia('(prefers-reduced-motion: reduce)').matches`, render the card with `.flipped`
  - otherwise render it without `.flipped` and add the class in `requestAnimationFrame(() => requestAnimationFrame(...))`. The double frame makes sure the transition actually runs.
- In every other case (the VI/EN toggle re-rendering), render the card with `.flipped` straight away.

**CSS** (values from spec §11):
- `.role-card`: `width: min(100%, 340px); aspect-ratio: 5 / 7; margin: 0 auto; perspective: 1000px`.
- `.role-card-inner`: `position: relative; height: 100%; transform-style: preserve-3d; transition: transform 0.5s`.
- `.flipped .role-card-inner`: `transform: rotateY(180deg)`.
- Faces:
  - `position: absolute; inset: 0; backface-visibility: hidden; border: 3px solid var(--team); border-radius: 16px; display: flex; flex-direction: column; align-items: center; padding: 16px`
  - The front also has `transform: rotateY(180deg)`.
  - In the front, `.role-rules` gets `flex: 1; overflow-y: auto; min-height: 0`.
- `.team-card-wolf`, `.team-card-village` and `.team-card-neutral` set `--team` to `var(--wolf)`, `var(--village)` and `var(--neutral)`.
- The face background is `color-mix(in srgb, var(--team) 10%, var(--surface))`.
- The back face uses `repeating-linear-gradient(45deg, …)` dark stripes, with the 🌕 at 72px.
- `.role-icon`: `font-size: 96px; line-height: 1`.
- `@media (prefers-reduced-motion: reduce) { .role-card-inner { transition: none; } }`.

- [ ] **Step 1: Pull out `renderHandoff` and `renderReveal`, add `roleCard` and `roleCardBack`, and make `renderDeal` call them.**

- [ ] **Step 2: Replace the `.reveal-card` CSS with the card CSS above.** Remove `.reveal-card` if nothing else uses it.

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: all tests pass, 0 fail.

- [ ] **Step 4: Check the deal by hand**

Run `npx serve .`, add 5 players, and deal. Check:
- The hand-off view shows the card back. "See my role" flips it to the front.
- The progress line reads "Player 1 of 5".
- The VI/EN toggle switches the language **without** flipping the card again.
- The Witch's rules scroll inside the card, and "Seen, hide" stays visible at 320px wide.
- A custom role without an icon shows ❓.
- With reduce motion switched on (in the OS, or emulated in DevTools), the front appears with no animation.
- Switching tabs on the reveal view goes back to the hand-off view, with the card face down.
- Double-tapping "Seen, hide" moves on by only one player.
- The final "I am the moderator" opens the tracker.

- [ ] **Step 5: Commit**

```bash
git add js/app.js css/style.css
git commit -m "feat: share hand-off and reveal views as a flipping role card"
```

---

### Task 5: The two deal buttons on Roles and the Assign screen

**Files:**
- Modify: `js/app.js` (`state`, `renderRoles`, the new `renderAssign`, `SCREENS`, the recap "New game" handler)
- Modify: `js/i18n.js`

**Interfaces:**
- Consumes: `remainingCounts`, `validateAssignment`, `assignRoles` and `pruneAssignments` from Task 1, and `newGame` from `game.js`.
- Produces:
  - `state.assignments` (initially `{}`)
  - the screen key `'assign'`
  - `openRoleCheck(from: 'assign' | 'tracker')`, which **Task 6 defines**. For this task, leave a temporary `openRoleCheck = () => go('tracker')` so Continue can be tested; Task 6 replaces it.

**i18n keys** (exact copy):

| key | vi | en |
|---|---|---|
| `roles.dealRandom` | Chia ngẫu nhiên | Deal randomly |
| `roles.modAssign` | Quản trò chọn vai | Moderator assigns |
| `assign.title` | Phân vai | Assign roles |
| `assign.placeholder` | — Chọn vai — | — Choose a role — |
| `assign.left` | {name}: {n} còn lại | {name}: {n} left |
| `assign.continue` | Tiếp tục | Continue |

Remove `roles.deal` if nothing else uses it (check with grep).

- [ ] **Step 1: Add the i18n keys.** Run `npm test`. Expected: pass. (`tests/i18n.test.js` checks that every key has both languages.)

- [ ] **Step 2: Update the Roles screen**
  - Replace the single Deal button with two buttons, both `disabled: errors.length > 0`:
    - `roles.dealRandom`, class `primary`, runs the existing `onDeal`.
    - `roles.modAssign` runs `go('assign')`.
  - Where `renderRoles` resets the counts (`state.countsFor !== n`), also set `state.assignments = {}`.
  - In the recap "New game" handler, also reset `state.assignments = {}`.

- [ ] **Step 3: Write `renderAssign()` and register it in `SCREENS` as `assign`**
  - On entry, set `state.assignments = pruneAssignments(state.players.length, state.counts, state.assignments)`.
  - Layout, from top to bottom:
    - a Back button (`common.back`) that goes to `'roles'`
    - an `h2` with `assign.title`
    - one muted line per role with a count above 0: `assign.left` with the localized role name and the `remainingCounts` value
    - one `card` row per player: the name, then a `<select>`
    - the Continue button
  - The `<select>`:
    - The first option is `value=""` with the text `assign.placeholder`.
    - Then one option per role with `counts[id] > 0`, in `allRoles(customRoles)` order.
    - An option is `disabled` when `remaining[id] <= 0` and it is not this player's current role.
    - The player's current role is `selected`.
    - On `change`, set `state.assignments[i] = value`, or `delete` the key when `value === ''`, then call `render()`.
  - Continue (`assign.continue`, class `primary`):
    - It is disabled unless `validateAssignment(...)` returns `[]`.
    - On click: `state.game = newGame(assignRoles(state.players, state.assignments)); openRoleCheck('assign');`

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all tests pass, 0 fail.

- [ ] **Step 5: Check the Assign screen by hand** (`npx serve .`, 6 players, VI and then EN)
  - "Deal randomly" still deals as before.
  - On the Assign screen:
    - A role is disabled in the other dropdowns once its copies run out.
    - The "left" lines update.
    - Continue is enabled only when every player has a role.
    - Setting a dropdown back to the placeholder disables Continue again.
  - Go back to Roles and lower Ma Sói by 1. On returning, the later Ma Sói assignment is cleared.

- [ ] **Step 6: Commit**

```bash
git add js/app.js js/i18n.js
git commit -m "feat: add moderator-assigns deal mode"
```

---

### Task 6: The role check screen, the tracker button, saving and resume

**Files:**
- Modify: `js/app.js` (`state`, `openRoleCheck`, the new `renderRoleCheck`, `SCREENS`, `renderTracker`, `save`, `renderResume`, the `visibilitychange` handler)
- Modify: `js/i18n.js`

**Interfaces:**
- Consumes:
  - `renderHandoff` and `renderReveal` from Task 4
  - `state.game`, created by the Continue button in Task 5
  - the stage `'check'` from Task 2
- Produces:
  - `state.roleCheck = { view: 'list' | 'handoff' | 'reveal' | 'return', index: number, seen: Set<number>, from: 'assign' | 'tracker' }`
  - `openRoleCheck(from)`: sets `state.roleCheck = { view: 'list', index: 0, seen: new Set(), from }`, runs `go('roleCheck')`, then `save()`. It replaces the temporary version from Task 5.

**i18n keys** (exact copy):

| key | vi | en |
|---|---|---|
| `check.title` | Xem vai riêng | Private role check |
| `check.hint` | Chạm vào tên, rồi đưa máy cho người đó. | Tap a name, then pass the phone to that person. |
| `check.start` | Bắt đầu ván | Start game |
| `check.back` | Quay lại ván | Back to game |
| `check.return` | Đưa máy lại cho quản trò | Give the phone back to the moderator |
| `tracker.showRole` | Xem vai riêng | Show a role privately |

- [ ] **Step 1: Add the i18n keys.** Run `npm test`. Expected: pass.

- [ ] **Step 2: Write `renderRoleCheck()` and register it as `roleCheck`.** Let `rc = state.roleCheck` and `player = state.game.players[rc.index]`.

  - **`list`** view:
    - an `h2` with `check.title`, and a muted line with `check.hint`
    - one `button.player` per game player, showing the name only plus `' ✓'` when `rc.seen.has(i)`. Dead players are included and not disabled. Tapping one runs `dealGuard.wrap(...)`, which sets `index = i` and `view = 'handoff'`, then calls `render()`. The guard is there so the second tap of a double tap on "I am the moderator" can't open a player.
    - at the bottom, a `primary` button:
      - When `from === 'assign'`, it shows `check.start` and runs `go('tracker'); save();`.
      - Otherwise it shows `check.back` and runs `go('tracker')`.
  - **`handoff`** view: `renderHandoff(player, null, () => { rc.view = 'reveal'; render(); })`
  - **`reveal`** view: `renderReveal(player, null, () => { if (rc.view !== 'reveal') return; rc.seen.add(rc.index); rc.view = 'return'; render(); })`
  - **`return`** view: the same layout as the deal's done view, with the text `check.return` and a `primary` button `deal.iAmModerator` that runs `dealGuard.wrap(() => { rc.view = 'list'; render(); })`.

- [ ] **Step 3: Wire it into the rest of the app**
  - **Header:** `renderHeader` hides things while `revealing`. Extend that condition to `|| (state.screen === 'roleCheck' && state.roleCheck.view === 'reveal')`.
  - **visibilitychange:** if the page is hidden while on `roleCheck` with `view === 'reveal'`, set `view = 'handoff'` and call `render()`.
  - **Tracker:** add a button `tracker.showRole` right after the player list. It runs `openRoleCheck('tracker')`.
  - **`save()`:** decide the saved stage like this, and write nothing for any other screen:
    - screen `deal` → `'deal'`
    - screen `tracker` → `'tracker'`
    - screen `roleCheck` → `'check'` when `from === 'assign'`, otherwise `'tracker'`

    Keep `dealIndex: state.dealIndex` and `game: state.game ?? { players: state.dealt }`.
  - **`renderResume`:** when `saved.stage === 'check'`:
    - `state.game = { ...newGame(players), ...saved.game }`
    - `state.roleCheck = { view: 'list', index: 0, seen: new Set(), from: 'assign' }`
    - `go('roleCheck')`

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all tests pass, 0 fail.

- [ ] **Step 5: Update the README.** In step 3 of the flow list, mention both modes and the private role check (one line).

- [ ] **Step 6: Run the manual checks** (`npx serve .`, in VI and then EN)
  1. **Random deal:**
     - Kill one player in the tracker.
     - Open "Show a role privately" and check a living player: hand-off → reveal → return → I am the moderator → list with ✓.
     - Check the dead player the same way.
     - "Back to game" returns to the tracker with its state unchanged.
  2. **Assign roles**, then Continue:
     - The role check list shows names only.
     - Check two players, then press Start game.
     - The tracker shows the assigned roles.
  3. **Refreshes:**
     - Refresh on the role check list from the assign path → Resume → you land on the role check list. The ✓ marks are cleared.
     - Refresh during a role check opened from the tracker → Resume → you land on the tracker.
     - Refresh on a reveal view → Resume → you never land on a reveal view.
  4. **Tab switching:** switch tabs on a role check reveal → you are back at the hand-off view for the same player.
  5. **Double taps:** double-tap "Seen, hide" → you land on the return view, not the list. Double-tap "I am the moderator" → the list, with no player opened.

- [ ] **Step 7: Commit**

```bash
git add js/app.js js/i18n.js README.md
git commit -m "feat: add private role check screen"
```
