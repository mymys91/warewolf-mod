# Ma Sói: role dealer & moderator assistant

A phone web app for in-person Werewolf (Ma Sói) games, in Vietnamese and English.

1. The host enters the players' names.
2. The app suggests a balanced set of roles; the host adjusts it or adds custom roles.
3. One phone is passed around: each player privately sees their role and its rules.
4. The moderator (who does not play) records deaths and notes during the game.
5. At the end, everyone sees a recap: the winner, every role, and what happened each night and day.

Live: https://mymys91.github.io/warewolf-mod/

## Development

No build step and no dependencies. ES modules need a local server:

```sh
npx serve .            # or: python -m http.server
```

Run the tests (Node 20+):

```sh
npm test
```

Design: [docs/superpowers/specs/2026-10-02-werewolf-role-dealer-design.md](docs/superpowers/specs/2026-10-02-werewolf-role-dealer-design.md)
