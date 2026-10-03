# Deal Modes & Private Role Check — Design

Extends [2026-10-02-werewolf-role-dealer-design.md](2026-10-02-werewolf-role-dealer-design.md)
(§6 setup and dealing, §7 screens, §9 storage). Everything not mentioned here
is unchanged.

## 1. Goal

- Two ways to deal roles after the Players and Roles screens:
  1. **Deal randomly**: the current pass-the-phone shuffle, unchanged.
  2. **Moderator assigns**: the moderator picks the role for each player.
     Players cannot choose.
- A **private role check**: the moderator taps a player's name, hands them the
  phone, and only that player sees their role. Used after the moderator assigns
  roles, and during the game when someone forgets their role (in either mode).
- The role is shown as a **playing card** with an emoji icon that flips over
  when it is revealed (§11).

Success: a moderator can run a game in either mode, and any player can see
their own role privately at any time during the game without seeing anyone
else's.

## 2. Flow

```
Players → Roles ──[Deal randomly]──────→ Deal (pass around) → Tracker
                └─[Moderator assigns]─→ Assign → Role check → Tracker
                                                       ↑         │
                                   "Show a role privately" ──────┘
```

## 3. Roles screen

The single "Chia bài / Deal roles" button is replaced by two buttons, both
disabled while `validateSetup` returns errors:

- "Chia ngẫu nhiên / Deal randomly": the current `onDeal` behaviour.
- "Quản trò chọn vai / Moderator assigns": opens the Assign screen.

## 4. Assign screen (`assign`)

- "Back" (to Roles), title "Phân vai / Assign roles".
- A remaining-roles summary: each role whose count is above zero with how many
  copies are left, e.g. "Ma Sói: 1 còn lại / 1 left".
- One row per player, in entry order: the name and a native `<select>`.
  - The first option is an empty placeholder ("— Chọn vai — / — Choose a role —").
  - The options are the roles with a count above zero. A role with no copies
    left is `disabled`, unless it is the player's current choice.
- "Tiếp tục / Continue" is enabled only when `validateAssignment` returns `[]`.
  It calls `newGame(assignRoles(players, assignments))`, saves with stage
  `'check'`, and opens the Role check screen with `from: 'assign'`.
- State: `state.assignments` is an object that maps the player index (0-based)
  to a role id. It is kept while moving between Roles and Assign. When the
  Assign screen renders, it removes:
  - assignments for indexes that no longer exist
  - assignments to roles whose count is now 0
  - per role, assignments past that role's count, dropping the highest
    player indexes first
- `state.assignments` is reset to `{}` when the player list changes (the same
  condition that resets suggested counts: `countsFor !== n`), and when a new
  game starts from the recap.
- The assignments are not saved until Continue, the same as the role counts.

## 5. Role check screen (`roleCheck`)

The state is `state.roleCheck = { view, index, seen, from }`:

- `view`: `'list' | 'handoff' | 'reveal' | 'return'`
- `index`: the selected player's index in `game.players`
- `seen`: a `Set` of indexes that have seen their role on this screen. It is
  kept in memory only.
- `from`: `'assign' | 'tracker'`

Views:

- **list** (only the moderator looks at it): title "Xem vai riêng / Private
  role check", hint "Chạm vào tên, rồi đưa máy cho người đó. / Tap a name,
  then pass the phone to that person." The screen shows one button per player
  with the name only, never the role, and a ✓ for indexes in `seen`. Dead
  players are listed too. At the bottom:
  - `from: 'assign'` → "Bắt đầu ván / Start game" goes to the Tracker and
    saves with stage `'tracker'`. It is always enabled.
  - `from: 'tracker'` → "Quay lại ván / Back to game" goes to the Tracker.
- **handoff**: the shared hand-off view (§6), without a progress line.
  "See my role" → `reveal`.
- **reveal**: the shared reveal view (§6). "Seen, hide" adds `index` to `seen`
  and moves to `return`.
- **return**: "Đưa máy lại cho quản trò / Give the phone back to the moderator"
  plus the button "Tôi là quản trò / I am the moderator" → `list`.

The tracker gets a button "Xem vai riêng / Show a role privately". It opens
this screen with `{ view: 'list', from: 'tracker', seen: new Set() }`.

## 6. Shared hand-off and reveal views

The hand-off and reveal markup moves out of `renderDeal` into:

- `renderHandoff(player, progress, onSee)`: `progress` is a string or `null`.
- `renderReveal(player, progress, onHide)`: it owns the VI | EN toggle
  (`state.revealLang`, set to `state.lang` when "See my role" is tapped).

`renderDeal` and `renderRoleCheck` both use them, and the deal screen keeps
its exact current behaviour. The `dealGuard` tap guard wraps the buttons on
both screens.

The `visibilitychange` handler also covers the role check: if the page becomes
hidden while `roleCheck.view === 'reveal'`, the view returns to `handoff` for
the same player.

## 7. Pure logic (`js/deal.js`)

- `remainingCounts(counts, assignments)` returns `{ [roleId]: counts[roleId] −
  number assigned }` for every role in `counts`. A value can be negative.
- `validateAssignment(players, counts, assignments)` returns error codes:
  - `UNASSIGNED`: some player index `0..players.length−1` has no role.
  - `OVER_ASSIGNED`: some role is assigned more often than its count, or is
    assigned at all with a count of 0 or missing.

  Each code appears at most once. The caller has already passed `counts`
  through `validateSetup`.
- `assignRoles(players, assignments)` returns
  `players.map((name, i) => ({ name: name.trim(), roleId: assignments[i] }))`,
  the same shape as `dealRoles`.

## 8. Storage and resume

- `isSavedGame` accepts the stage `'check'` as well as `'deal'` and `'tracker'`.
- Resuming at stage `'check'`: restore `state.game` from the saved game and
  open Role check with `{ view: 'list', from: 'assign', seen: new Set() }`.
  Resume never lands on a reveal view.
- Opening the Role check from the Tracker does not change the saved stage
  (`'tracker'`), so a refresh returns to the Tracker.
- `save()` writes `currentGame` when the screen is `deal`, `tracker`, or
  `roleCheck` with `from: 'assign'` (stage `'check'`). When the Role check was
  opened from the tracker, it writes stage `'tracker'`.

## 9. i18n

New VI and EN keys for: the two Roles buttons, the Assign title, placeholder,
"{n} left" and Continue, the Role check title, hint, Start game, Back to game,
return text and the tracker button. "I am the moderator" reuses
`deal.iAmModerator`, and the hand-off and reveal views reuse the existing
`deal.*` keys.

## 10. Testing

Unit tests are written before the code:

- `tests/deal.test.js`:
  - `remainingCounts`: no assignments, partial, full, and over-assigned
    (negative).
  - `validateAssignment`: valid, a missing index, over-assigned, a role not in
    counts, both errors together, custom role ids.
  - `assignRoles`: trimmed names, in order, the same shape as `dealRoles`.
- `tests/storage.test.js`: stage `'check'` round-trips, and an unknown stage is
  still rejected.

Manual checks in both languages:

- Random deal → Tracker → "Show a role privately" for a living player and a
  dead player → Back to game.
- Assign roles: the disabled options, the remaining summary, Continue gating,
  going Back to Roles to lower a count and seeing the pruning, Continue → Role
  check with ✓ marks → Start game.
- Refresh on the Assign, Role check (both `from` values), and Tracker screens.
- Switching away from the tab during a reveal on the Role check screen.

## 11. Role card

The shared reveal view (§6) shows the role as a playing card, on both the Deal
screen and the Role check screen.

**Icons (`js/roles.js`)**

- Every built-in role gets `icon`: werewolf 🐺, wolfcub 🐾, villager 🧑‍🌾,
  seer 🔮, bodyguard 🛡️, witch 🧪, hunter 🏹, cupid 💘, fool 🤡.
  `UNKNOWN_ROLE.icon` is ❓.
- Custom roles have an optional `icon`. `buildFields` trims `fields.icon`, and
  when it is empty the role has no `icon` key. `createCustomRole` and
  `updateCustomRole` carry the icon through. When an update clears the icon,
  the `icon` key is removed.
- `roleIcon(role) → string` returns `role.icon` when it is non-empty, and
  otherwise ❓. The UI always reads the icon through this function.
- Saved custom roles without `icon` stay valid; `isRoleList` is unchanged.

**Custom role form**

- A new "Biểu tượng / Icon" field below the team field, made of two parts:
  - a row of tap-to-pick buttons: 🐺 🦊 🧛 👻 🧙 👑 🕵️ 👼 💀 🐍 🌙 ⭐
  - a text input (`maxlength="8"`) that shows the current value
- Tapping a button puts its emoji in the input. Saving passes the input's
  value as `fields.icon`.

**Card**

- The card has a 5:7 aspect ratio and is centred. Its width is
  `min(100%, 340px)`.
- It has a 3px border in the team colour (`--wolf`, `--village`, `--neutral`)
  and a faint tint of the same colour as its background.
- Front, from top to bottom:
  - the icon (font-size 96px)
  - "{name}, your role is"
  - the role name in the team colour
  - the team badge
  - the rules
- The rules area scrolls (`overflow-y: auto`), so the card never grows taller
  than its aspect ratio and the "Seen, hide" button stays in view.
- Back: a 🌕 centred on a dark diagonal-stripe pattern (CSS only).

**Flip**

- The hand-off view shows the card back under the player's name.
- "See my role" switches to the reveal view. There the card is rendered face
  down and then flipped: the `flipped` class is added on the next animation
  frame, giving a 3D `rotateY(180deg)` with `transition: transform 0.5s`.
- With `@media (prefers-reduced-motion: reduce)` there is no transition, and
  the card is rendered with `flipped` already on.
- The VI | EN toggle re-renders the card already flipped, without animating
  again. The flip animates only on the first render after "See my role".
- The `visibilitychange` behaviour is unchanged: going back to the hand-off view
  shows the back again.

**Not changed:** the Tracker, Recap, Roles and Assign screens show no cards and
no icons.

**Testing**

- `tests/roles.test.js`:
  - every built-in role has a non-empty `icon`
  - `createCustomRole` keeps a trimmed icon and has no `icon` key for an
    empty or whitespace-only icon
  - `updateCustomRole` replaces the icon, and removes it when cleared
  - `roleIcon` falls back to ❓
- Manual checks:
  - the flip on Deal and on Role check
  - reduce motion
  - the VI/EN toggle does not flip the card again
  - the longest built-in rules (Witch) scroll inside the card
  - a custom role with and without an icon
  - a phone width of 320px

## 12. Out of scope

- Players choosing their own role.
- Saving the ✓ seen marks.
- Splitting `app.js` into one module per screen.
