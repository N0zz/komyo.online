# CLAUDE.md — Asteroids project

Guidance for working in this repo. Read before editing.

## What this is

A set of **frozen, self-contained** HTML5 Canvas games + a launcher. No build step,
no dependencies, no external assets — every game is one `.html` file with inline
CSS/JS. Open `index.html` to play; run `node test.mjs` to test.

## Core conventions

- **Each shipped version is frozen.** Once a version is released in the menu, do not
  change its gameplay. New ideas = a **new file** + a new entry in `versions.js`.
  (Bug-fix exceptions should be deliberate and tested.)
- **`versions.js` is the single source of truth** for the launcher menu. Add a version
  by adding a file and one `{ file, title, desc, tag, goal }` entry. `tag` is
  `CLASSIC` or `ROGUELITE` and decides which menu row it appears in.
- **No external resources.** Keep everything inline and offline. No CDNs, fonts, or
  image assets — the retro look is all canvas vector drawing + CSS.

## The roguelite trio is generated — edit the base, then regenerate

`roguelite-milestones.html` and `roguelite-shop.html` are **generated copies** of
`roguelite-levelup.html`. They differ only by the `PROGRESSION` constant near the top
of the script (`'levelup' | 'milestones' | 'shop'`) and the `<title>`.

**Always edit `roguelite-levelup.html`, then regenerate the other two:**

```bash
sed -e "s/const PROGRESSION = 'levelup';/const PROGRESSION = 'milestones';/" \
    -e "s|<title>Roguelite: Auto Level-Up</title>|<title>Roguelite: Score Milestones</title>|" \
    roguelite-levelup.html > roguelite-milestones.html
sed -e "s/const PROGRESSION = 'levelup';/const PROGRESSION = 'shop';/" \
    -e "s|<title>Roguelite: Auto Level-Up</title>|<title>Roguelite: Wave Shop</title>|" \
    roguelite-levelup.html > roguelite-shop.html
```

Never hand-edit the two generated files — changes will be overwritten.

## Testing

- `node test.mjs` — headless harness (mocks DOM/canvas, steps the game loop, simulates
  input, asserts state transitions). It must stay green; add assertions for new behavior.
- Each game exposes a small `window.__test` hook (getters + helpers like `start`,
  `gotoWave`, `forcePick`, `giveUpgrade`, `clearEnemies`). It's harmless in normal play
  and exists only so the harness can drive state. Keep it in sync when adding mechanics.
- There is no browser automation available here; the harness is the regression net.
  Always run it after changes, and syntax-check inline scripts if unsure.

## Conventions that matter

- The game loop reschedules `requestAnimationFrame` **first**, then runs update/render
  in a `try/catch` — a single bad frame must never permanently freeze the game.
- Speedrun is opt-in via `?speedrun=1` (the launcher appends it). The timer advances
  only while `state === 'playing'`.
- The in-game **Quit to menu** button posts `window.parent.postMessage('asteroids:menu')`;
  the launcher listens and returns to version select.
- Match the existing terse, single-line code style in the game files. Comment sparingly.
