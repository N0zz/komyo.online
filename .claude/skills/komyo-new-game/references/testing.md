# Testing a komyo game — the `test.mjs` anatomy

Every game ships a `games/<slug>/test.mjs`. There is **no browser automation** — the shared
`test-harness.mjs` (repo root) is the whole regression net: it mocks DOM/canvas/localStorage,
preloads the real `game-kit.js`, extracts the page's inline script, and runs it in a `vm` sandbox
you drive through `window.__test`. Always run the suites after any change and keep them green.

Reference: `games/breakout/test.mjs`.

---

## 1. Imports

Import the shared scaffold from the harness — never re-implement a reporter or a DOM mock.

```js
import fs from 'node:fs';
import path from 'node:path';
import { bootGame, ok, section, summary, runLayoutSuite, ROOT } from '../../test-harness.mjs';

const FILE = 'games/breakout/index.html';
const runGame = (opts) => bootGame(FILE, opts);
// challenges/cosmetics are separate <script src> files — read them to feed via preCode when a test
// needs the registry (cosmetics/skins). ROOT is the repo root.
const COSMETICS  = fs.readFileSync(path.join(ROOT, 'cosmetics.js'), 'utf8');
const CHALLENGES = fs.readFileSync(path.join(ROOT, 'challenges.js'), 'utf8');
```

- `ok(cond, msg)` — one assertion (prints `✗ msg` on failure, tallies pass/fail).
- `section(title)` — a labelled group header.
- `summary()` — prints the totals and `process.exit(1)` if anything failed. **Call it last.**
- `runLayoutSuite(makeGame, check)` — the standard portrait/landscape/desktop layout sweep (§4).

---

## 2. The harness API

**`bootGame(file, opts)`** — boots the game and returns a *drive handle*. `file` may carry a query
(`'games/breakout/index.html?mode=endless'`). `opts` (all optional):

| opt | meaning |
| --- | --- |
| `w`, `h` | viewport size (default 1280×800) |
| `store` | seed `localStorage` — object of string values (e.g. `{ breakout_speed2x: '1' }`) |
| `seed` | seed a deterministic `Math.random` (pass wherever the game rolls RNG in an asserted path) |
| `search` | URL query string (or embed it in `file`) |
| `preCode` | string or string[] run **after** the kit, **before** the game (feed `challenges.js`, `cosmetics.js`, or a `navigator.maxTouchPoints=5` shim) |

The **drive handle** (what `bootGame` returns):

- `T()` / `test()` — the live `window.__test` object. Call it fresh each time (`T().score`), never cache.
- `store` — the backing localStorage object (read persisted keys after a run).
- `errors` — array of thrown errors during frames; `bootErr` — the first boot error or `null`.
- `doc`, `win` — the mocked `document` / `window` (`win.gamekit`, `doc.body.classList`, …).
- `el(id)` — a mock element (`.fire('pointerdown', {…})`, `.classList`, `.textContent`).
- `step(n)` — advance n **display frames** (advances the clock + drains the rAF queue) — for
  bespoke rAF-driven engines. (Note: `T().step(n)` instead drives the sim's `update()` directly.)
- `resize(w, h)` — drive a viewport change via `gamekit.layout.__emit` (fires the relayout callbacks).
- `key(type, k)`, `down(k)`, `up(k)` — dispatch keyboard events to window/document listeners.
- `fireRaf(t)` — run queued rAF callbacks at an explicit timestamp (kit-loop accumulator tests).

---

## 3. Test patterns

**Boot + state asserts** — confirm it loads and the FSM starts in `ready`.

```js
section('Breakout: boot');
const g = runGame();
ok(g.bootErr === null, 'boots without error: ' + g.bootErr);
ok(g.T() != null, 'exposes window.__test');

section('Breakout: initial state');
const T = g.T;
ok(T().state === 'ready', 'initial state is "ready" (got ' + T().state + ')');
```

**Behaviour asserts** — set deterministic state via `__test`, `step(n)` the sim, assert getters.
`T().step()` drives `update()` directly, so no rAF/clock is involved.

```js
section('Breakout: setBall hits a brick');
T().start();
T().launch();
const bricksBefore = T().bricks, scoreBefore = T().score;
T().setPaddle(640);
T().setBall(640, 120, 0, -15);   // aim straight up into row 1, fast
T().step(30);
ok(T().bricks < bricksBefore, 'hitting bricks removes them');
ok(T().score  > scoreBefore,  'destroying bricks increases score');
```

**Best-persistence** — play to game-over, then read the kit store (`gamekit_pb`, keyed by
capitalized modeLabel). A small reader keeps the assert clean.

```js
const pbScore = (store, mode) => {
  try { return ((JSON.parse(store['gamekit_pb'] || '{}').breakout || {})[mode] || {}).score || 0; }
  catch (e) { return 0; }
};
// … after reaching state 'over' …
ok(pbScore(g.store, 'Classic') >= sc, 'best persisted >= final score');
```

**End-menu flow** — the end screen is a kit menu; drive its actions through `T().menu()`.

```js
ok(T().menu() != null, 'kit end menu is shown on game over');
T().menu().activate('again');
ok(T().state === 'playing', 'Play Again starts a new game');
ok(T().score === 0, 'Play Again resets score');
```

**Store-seeding prefs** — restore a saved toggle/best at boot.

```js
const gp = runGame({ store: { breakout_speed2x: '1' } });
ok(gp.T().speedMult === 2, 'speed pref restored from storage');

const gm = runGame({ store: { gamekit_pb: JSON.stringify({ breakout: { Classic: { score: 250 } } }) } });
ok(gm.T().best('classic') === 250, 'classic best read from store');
```

**Touch** — the DOM mock is desktop by default; opt into touch via `preCode`.

```js
const gm = runGame({ preCode: 'navigator.maxTouchPoints = 5;' });
ok(gm.doc.body.classList.contains('bktouch'), 'touch UI enabled when maxTouchPoints > 0');
// or a late runtime touch: gt.el('game').fire('pointerdown', { pointerType: 'touch', pointerId: 1 });
```

**Cosmetics** — feed the registry files via `preCode` (order: challenges, then cosmetics) and seed
`gamekit_owned` / `gamekit_cos_sel` to force a skin, then render and assert no errors.

```js
const g = runGame({ preCode: [CHALLENGES, COSMETICS], store: {
  gamekit_owned:   JSON.stringify({ 'breakout.ball.comet': { c: 0, t: 0 } }),
  gamekit_cos_sel: JSON.stringify({ 'breakout.ball': 'breakout.ball.comet' }),
} });
g.T().start(); g.step(5);
ok(g.errors.length === 0, 'comet skin renders without errors');
```

---

## 4. The layout suite

Standard for every live game. `runLayoutSuite(makeGame, check)` sweeps the three viewports —
**portrait 390×780 / landscape 780×390 / desktop 1280×800** — booting a fresh game per viewport.
`makeGame(v)` must return a **started** `bootGame` handle. For each viewport the suite itself asserts
the shared invariants: `__test.layout` is present, `L.W===v.w && L.H===v.h`, and **`topReserve >=
gamekit.layout.hudTop()`** (the headless stand-in for "the score box doesn't sit under the nav").
Your `check(g, v, L)` callback asserts the game-specific bounds.

```js
section('Breakout: layout fits the screen (no off-screen / score-box overlap)');
runLayoutSuite(
  () => { const gl = runGame(); gl.T().start(); return gl; },
  (gl, v, L0) => {
    gl.T().step(1);                     // one frame so the paddle re-centers to the new width
    const L = gl.T().layout;
    ok(L.brickTop >= L.topReserve,      v.name + ': top bricks clear the HUD');
    ok(L.brickLeft >= 0 && L.brickRight <= L.W, v.name + ': bricks within width');
    ok(L.brickBottom < L.paddleY,       v.name + ': bricks sit above the paddle');
    ok(L.paddleLeft >= 0 && L.paddleRight <= L.W, v.name + ': paddle within width');
    ok(L.paddleY > 0 && L.paddleY < L.H, v.name + ': paddle within height');
  }
);
```

For a scaled-world canvas (asteroids), pass `{ size: false }` as the third arg so the suite skips the
`W===viewport` guarantee.

---

## 5. Always end with `summary()`

```js
summary();   // prints PASS/FAIL totals; exits non-zero if anything failed
```

Run per-game: `node games/<slug>/test.mjs`. Run everything: `node test.mjs` (catalogue + Keep
Defender + boots every live game + a game-kit section). Determinism: pass `{ seed }` to any suite
whose asserts depend on `Math.random`, or it will flake.
