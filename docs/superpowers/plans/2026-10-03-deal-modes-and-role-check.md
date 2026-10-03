# Deal Modes & Private Role Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "moderator assigns" deal mode and a private role check screen that the moderator can open after assigning roles or at any time from the tracker.

**Architecture:** The pure assignment logic goes in `js/deal.js` and is unit-tested with `node:test`. All DOM work stays in `js/app.js`: two new screens (`assign`, `roleCheck`), and the hand-off and reveal views pulled out of `renderDeal` so the deal and role check screens share them. `js/storage.js` accepts one more saved stage, `'check'`.

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
3. **A refresh during the role check started from the tracker.** It must resume to the tracker with the game intact, not to the role check. Manual check in Task 5, step 6.
4. **The tab is hidden while a player is looking at their role on the role check screen.** It must go back to the hand-off view for the same player. Manual check in Task 5, step 6.
5. **A double tap on "Seen, hide" or "I am the moderator" during the role check.** It must not skip the return view or open the next player. These buttons use `dealGuard`; manual check in Task 5, step 6.

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

### Task 3: Pull the shared hand-off and reveal views out of `renderDeal`

This is a pure refactor and the deal screen must behave exactly as before. There are no unit tests because the code is DOM-only, so it is verified by hand.

**Files:**
- Modify: `js/app.js` (`renderDeal`, about lines 299–351)

**Interfaces:**
- Produces:
  - `renderHandoff(player: {name}, progress: string | null, onSee: () => void) → HTMLElement`: the current hand-off section. The progress line is left out when `progress` is `null`. The "See my role" button runs `dealGuard.wrap(() => { state.revealLang = state.lang; onSee(); })`.
  - `renderReveal(player: {name, roleId}, progress: string | null, onHide: () => void) → HTMLElement`: the current reveal section, including the VI | EN toggle on `state.revealLang`. `progress` is already localized by the caller; `renderDeal` passes `t('deal.progress', state.revealLang, …)`. The "Seen, hide" button runs `dealGuard.wrap(onHide)`.
- `renderDeal` keeps its own guard `if (state.dealView !== 'reveal') return;` inside the `onHide` it passes.

- [ ] **Step 1: Pull the two functions out and make `renderDeal` call them.** The DOM output must stay the same.

- [ ] **Step 2: Run the tests**

Run: `npm test`
Expected: all tests pass, 0 fail.

- [ ] **Step 3: Check the deal by hand**

Run `npx serve .`, add 5 players, and deal. Check:
- The progress line reads "Player 1 of 5".
- The VI/EN toggle works on the reveal view.
- Switching tabs on the reveal view goes back to the hand-off view.
- Double-tapping "Seen, hide" moves on by only one player.
- The final "I am the moderator" opens the tracker.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "refactor: share hand-off and reveal views"
```

---

### Task 4: The two deal buttons on Roles and the Assign screen

**Files:**
- Modify: `js/app.js` (`state`, `renderRoles`, the new `renderAssign`, `SCREENS`, the recap "New game" handler)
- Modify: `js/i18n.js`

**Interfaces:**
- Consumes: `remainingCounts`, `validateAssignment`, `assignRoles` and `pruneAssignments` from Task 1, and `newGame` from `game.js`.
- Produces:
  - `state.assignments` (initially `{}`)
  - the screen key `'assign'`
  - `openRoleCheck(from: 'assign' | 'tracker')`, which **Task 5 defines**. For this task, leave a temporary `openRoleCheck = () => go('tracker')` so Continue can be tested; Task 5 replaces it.

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

### Task 5: The role check screen, the tracker button, saving and resume

**Files:**
- Modify: `js/app.js` (`state`, `openRoleCheck`, the new `renderRoleCheck`, `SCREENS`, `renderTracker`, `save`, `renderResume`, the `visibilitychange` handler)
- Modify: `js/i18n.js`

**Interfaces:**
- Consumes:
  - `renderHandoff` and `renderReveal` from Task 3
  - `state.game`, created by the Continue button in Task 4
  - the stage `'check'` from Task 2
- Produces:
  - `state.roleCheck = { view: 'list' | 'handoff' | 'reveal' | 'return', index: number, seen: Set<number>, from: 'assign' | 'tracker' }`
  - `openRoleCheck(from)`: sets `state.roleCheck = { view: 'list', index: 0, seen: new Set(), from }`, runs `go('roleCheck')`, then `save()`. It replaces the temporary version from Task 4.

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
