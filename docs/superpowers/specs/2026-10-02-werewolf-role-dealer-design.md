# Werewolf Role Dealer & Moderator Assistant — Design

Date: 2026-10-02
Status: Draft, awaiting review

## 1. Purpose

A mobile web app for in-person Werewolf (Ma Sói) games. One phone is passed
around to deal secret roles, then returned to a non-playing moderator who
tracks the game and, at the end, shows everyone a recap of what happened.

### Requirements (from the user)

- Deal secret roles by passing one phone around.
- Runs in a mobile web browser. Phones only; desktop layout is not a goal.
- The app suggests a balanced role set from the player count; the host adjusts it.
- Built-in roles with rules, plus host-defined custom roles.
- Vietnamese and English. Players can read their own role in either language.
- The host types player names.
- The host is a moderator who does not play.
- The moderator records deaths (night and day) and notes during the game.
- At game end, a recap of everything that happened is shown to all players.

### Assumptions

- 5–20 players get a suggested setup; 3–30 players are allowed with manual setup.
- No backend and no accounts. All persistence is browser `localStorage`.
- Supported browsers: current mobile Safari (iOS) and Chrome (Android).

### Out of scope

- Each player using their own phone (online rooms).
- Guided night actions (the app walking through wake order and resolving
  who dies). The event model must not prevent adding this later.
- Desktop-specific layout.

## 2. Architecture

A static site with no build step and no runtime dependencies. Plain HTML, CSS
and JavaScript ES modules. Deployable to any static host (GitHub Pages,
Netlify) and works from a local static server.

```
index.html          single page, mobile viewport meta
css/style.css       mobile-first styles, touch targets ≥ 44px
js/i18n.js          UI strings {vi, en}; t(key, lang)
js/roles.js         built-in role definitions
js/suggest.js       suggestRoles(playerCount) -> {roleId: count}
js/deal.js          validateSetup(...), dealRoles(players, counts, rng)
js/game.js          phases, event log, undo, win check
js/storage.js       localStorage wrapper with in-memory fallback
js/app.js           screen rendering and event wiring (only DOM module)
tests/*.test.js     unit tests, run with `node --test`
```

`roles`, `suggest`, `deal`, `game`, `i18n` and `storage` contain no DOM
code. `storage` takes the storage object as a parameter so tests can pass a
fake. `deal` takes the random source as a parameter so tests are deterministic.

## 3. Languages

- UI text lives in `i18n.js` as `{key: {vi, en}}`. Vietnamese is the default.
- App-wide language toggle (VI | EN) in the header, saved as `lang`.
- The role reveal screen and the final recap have their own VI | EN toggle.
  The reveal toggle starts at the app-wide language for each player and
  resets when the next player's turn begins.
- Text fallback: if the requested language is empty, show the other one.

## 4. Roles

Role shape:

```js
{ id, team: 'wolf' | 'village' | 'neutral',
  name: { vi, en }, rules: { vi, en }, custom: boolean }
```

Built-in roles:

| id | VI | EN | Team | Rules (summary; full text written in both languages) |
|---|---|---|---|---|
| werewolf | Ma Sói | Werewolf | wolf | Each night the werewolves wake together and choose one player to kill. They win when they equal or outnumber everyone else alive. |
| villager | Dân Làng | Villager | village | No special power. Discuss and vote during the day to find the werewolves. |
| seer | Tiên Tri | Seer | village | Each night, choose one player; the moderator signals whether they are a werewolf. |
| bodyguard | Bảo Vệ | Bodyguard | village | Each night, protect one player from the werewolves. Cannot protect the same player two nights in a row. |
| witch | Phù Thủy | Witch | village | Has one healing potion (save the werewolves' victim) and one poison potion (kill one player). Each can be used once per game. |
| hunter | Thợ Săn | Hunter | village | When killed, immediately takes one other player down with them. |
| cupid | Thần Tình Yêu | Cupid | village | On the first night, link two players as lovers. If one dies, the other dies too. |
| wolfcub | Sói Con | Wolf Cub | wolf | A werewolf. If killed, the werewolves kill two players the following night. |
| fool | Kẻ Ngốc | Fool | neutral | Wins if voted out (hanged) during the day. |

Custom roles are created by the host with: Vietnamese name (required),
Vietnamese rules (required), English name and rules (optional), and team.
Their id is generated (`custom-<timestamp>`). The host can edit and delete them.

## 5. Role suggestion

`suggestRoles(n)` for 5 ≤ n ≤ 20; returns `null` outside that range.

1. Wolf-team size = `floor(n / 4)`, minimum 1.
2. Add specials by threshold: Tiên Tri (n ≥ 5), Bảo Vệ (n ≥ 6),
   Phù Thủy (n ≥ 8), Thợ Săn (n ≥ 10), Thần Tình Yêu (n ≥ 14).
3. At n ≥ 12, one werewolf slot becomes Sói Con.
4. All remaining slots are Dân Làng.
5. Kẻ Ngốc and custom roles are never suggested.

Examples: n = 5 → 1 Ma Sói, 1 Tiên Tri, 3 Dân Làng.
n = 12 → 2 Ma Sói, 1 Sói Con, Tiên Tri, Bảo Vệ, Phù Thủy, Thợ Săn, 5 Dân Làng.

## 6. Setup validation and dealing

`validateSetup(players, counts)` returns a list of error codes (empty when valid):

- `TOO_FEW_PLAYERS`: fewer than 3 players.
- `TOO_MANY_PLAYERS`: more than 30 players.
- `EMPTY_NAME`: a name is blank after trimming.
- `DUPLICATE_NAME`: two names equal after trimming, case-insensitive.
- `COUNT_MISMATCH`: total role count ≠ player count.
- `NO_WOLF`: no wolf-team role in the counts.

`dealRoles(players, counts, rng)` builds the role list from the counts,
shuffles it with Fisher–Yates, and pairs it with players in entry order.
The default `rng` uses `crypto.getRandomValues`.

## 7. Screens and flow

Only one screen is visible at a time. All text comes from `i18n`.

1. **Người chơi / Players**: list of name inputs with add/remove. Prefilled
   from `lastPlayers`. "Next" is disabled while name errors exist.
2. **Vai trò / Roles**: suggested counts (or all zero outside 5–20), +/− per
   role, live total "12/12", "Thêm vai tùy chỉnh / Add custom role" form,
   edit/delete on custom roles. "Chia bài / Deal" is disabled while
   `validateSetup` returns errors; errors are shown inline.
3. **Chia bài / Deal**, repeated for each player in entry order:
   - Hand-off: "Đưa máy cho **Minh**" + "Xem vai / See role" button.
   - Reveal: role name, team, rules, VI | EN toggle, "Đã xem, ẩn đi / Seen, hide" button.
   - If the page becomes hidden (`visibilitychange`) on the reveal view, it
     returns to the hand-off view for the same player.
   - After the last player: "Đưa máy cho quản trò / Give the phone to the
     moderator" with a confirmation button before continuing.
4. **Theo dõi ván / Game tracker** (moderator only):
   - Header shows the current phase (Đêm 1 / Night 1, Ngày 1 / Day 1 …).
   - Player list with roles; dead players greyed out with cause and phase.
   - Tap a living player → choose a cause → death recorded in the current phase.
   - Buttons: "+ Ghi chú / Note", "Hoàn tác / Undo",
     "Sang phase tiếp / Next phase", "Kết thúc ván / End game".
   - A banner appears when the win check returns a result, with
     "Xác nhận / Confirm" (ends the game) and "Chơi tiếp / Keep playing".
   - "End game" without a suggested result asks the moderator to pick the
     winner: Village, Werewolves, Fool, or "Không xác định / Undecided".
5. **Tổng kết ván / Final recap** (shown to everyone):
   - Winner banner.
   - All players with role and alive/dead status.
   - Timeline grouped by phase, e.g. "Đêm 1: Minh bị Sói cắn",
     "Ngày 1: Lan bị treo cổ", notes included.
   - VI | EN toggle, "Ván mới / New game" button (clears `currentGame`,
     returns to screen 1).

## 8. Game model (`game.js`)

```js
game = {
  players: [{ name, roleId }],
  phase: { kind: 'night' | 'day', number },   // starts at night 1
  events: [Event],
  winner: null | 'village' | 'wolf' | 'fool' | 'undecided'
}
Event =
  | { type: 'death', phase, player, cause }
  | { type: 'note',  phase, text }
cause = 'wolf' | 'hanged' | 'poison' | 'hunter' | 'lover' | 'other'
```

Functions (all pure, return a new game object):

- `nextPhase(game)`: night n → day n → night n+1.
- `recordDeath(game, player, cause)`: rejects players already dead.
- `addNote(game, text)`: rejects empty text.
- `undo(game)`: removes the last event; no-op when there are none.
- `alivePlayers(game)`: players without a death event.
- `checkWinner(game, roles)`: in this order:
  1. `fool` if a player whose role is `fool` has a `hanged` death.
  2. `village` if no wolf-team player is alive.
  3. `wolf` if alive wolf-team players ≥ all other alive players.
  4. otherwise `null`.

  Custom roles use their chosen team. The result is only a suggestion; the
  moderator confirms it.
- `endGame(game, winner)`: sets `winner`.

Phase changes are not events; the timeline groups events by their `phase`.
Phases without events are omitted from the recap.

## 9. Persistence (`storage.js`)

| Key | Content |
|---|---|
| `ww.lang` | `'vi'` or `'en'` |
| `ww.lastPlayers` | array of names |
| `ww.customRoles` | array of custom role objects |
| `ww.currentGame` | `{ stage: 'deal' \| 'tracker', dealIndex, game }` |

- `currentGame` is written after each deal step and each tracker action.
- On load, if `currentGame` exists, ask "Tiếp tục ván đang chơi? / Continue
  the current game?". Yes → resume at the saved stage (deal resumes at the
  hand-off view of `dealIndex`). No → clear it.
- On game end, `currentGame` is cleared when the recap opens.
- Corrupt JSON in any key is treated as missing.
- If `localStorage` throws (e.g. private mode), an in-memory store is used
  and the app works without remembering anything across reloads.
- Deleting a custom role removes it from the role counts of the current setup.
  Deletion is blocked while a game in progress uses that role.

## 10. Testing

Unit tests with Node's built-in runner (`node --test tests/`), no dependencies:

- `suggest`: totals equal n for every n in 5–20; wolf-team size; each
  threshold; `null` outside the range; never suggests fool or custom roles.
- `deal`: every validation error code; dealt roles match counts exactly;
  output is a permutation; deterministic with a seeded rng.
- `game`: phase sequence; recordDeath/addNote/undo; dead player rejected;
  every `checkWinner` branch including custom-role teams and fool.
- `storage`: round-trip of each key; corrupt JSON; throwing storage fallback.
- `roles` / `i18n`: every built-in role and every UI key has non-empty vi and en.

Manual check in a mobile viewport (Chrome device toolbar, ~390px wide):
full flow players → roles → deal → tracker → recap in both languages,
refresh mid-deal and mid-game, and switching away from the tab on the reveal view.
