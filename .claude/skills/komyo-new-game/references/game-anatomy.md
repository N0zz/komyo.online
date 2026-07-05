# Game anatomy — a komyo `games/<slug>/index.html`, top to bottom

A single self-contained HTML file. No build, no external assets. Everything below is trimmed from
real games (`breakout` is the canonical template; `stacker`/`flappy` show variation). Read the live
files before copying — **code is the source of truth**.

The whole page is: atomic `<head>` unit → minimal `<style>` → body (`<canvas>` + HUD + one inline
`<script>`) → `gamekit.pwa()` after the IIFE.

---

## 1. The atomic `<head>` unit

Fixed boilerplate. Only **three strings are game-specific** — the `<title>`, the `theme-color`, and
the `apple-mobile-web-app-title`. Everything else is byte-identical across games.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no">
<title>Brick Breaker</title>                                    <!-- GAME-SPECIFIC -->
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#ff5cc8">                     <!-- GAME-SPECIFIC (accent) -->
<link rel="manifest" href="manifest.json">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Brick Breaker"> <!-- GAME-SPECIFIC -->
<link rel="apple-touch-icon" href="icon-192.png">
<script src="../../analytics.js" defer></script>
<link rel="stylesheet" href="../../game-kit.css">
<script src="../../version.js"></script>
<script src="../../game-kit.js"></script>
<script src="../../challenges.js"></script>
<script src="../../cosmetics.js"></script>
<script src="../../i18n.js"></script>
<style> … </style>
</head>
```

**The shared-script block is atomic and order-sensitive.** These are all same-origin, in-repo files
that ship with the site and are cached offline by the game's `sw.js` SHELL — they are NOT external
"dependencies." Rules:

- **`analytics.js` is the only `defer`.** Everything else loads synchronously so `window.gamekit`
  exists before the inline script runs (the inline script is NOT deferred either).
- **Canonical order** (use this — it's the breakout template): `analytics.js` (defer) · `game-kit.css`
  · `version.js` · **`game-kit.js` → `challenges.js` → `cosmetics.js` → `i18n.js`**. The kit must be
  defined before `challenges.js`/`cosmetics.js` register their data against it; `i18n.js` is the
  i18n LOADER + the `en` dict — it synchronously pulls in the active locale's `i18n.<code>.js`
  (each locale ships as its own root file) so `window.KOMYO_I18N` is complete before the inline
  script's first `t()` call. The `<head>` tag itself is unchanged by that split — only ever load
  plain `i18n.js` here, never a locale file directly.
- The game's `sw.js` SHELL must list these SAME files in lockstep — **plus every per-locale
  `i18n.<code>.js` file** (the loader fetches them at runtime, so offline they only exist if the
  SHELL cached them). A missing one silently kills that feature (or that language) offline. The
  real current breakout SHELL:

  ```js
  self.SHELL = ['./','./index.html','./manifest.json','./favicon.svg','./icon-192.png','./icon-512.png','../../analytics.js','../../game-kit.js','../../game-kit.css','../../challenges.js','../../cosmetics.js','../../i18n.js','../../i18n.pl.js','../../i18n.es.js','../../i18n.pt.js','../../i18n.fr.js','../../i18n.it.js','../../i18n.cs.js','../../i18n.uk.js','../../version.js'];
  ```

  (The locale list is a snapshot — mirror `KOMYO_I18N_AVAILABLE` in `i18n.js` / copy from
  `games/breakout/sw.js` at build time.)

(`flappy` happens to load `challenges.js`/`cosmetics.js` before `game-kit.js`; that ordering works
because those files defer their kit hookups, but **follow the canonical breakout order for new
games**.)

---

## 2. The minimal `<style>` block

Keep it tiny — the kit owns all chrome (nav, menus, HUD pill, share row) via `game-kit.css`. A
game's own CSS is just: a root palette, the box-sizing reset, the full-viewport `#game` canvas, and
HUD value colors. Never restyle `.gamekit-hud`'s position/background — only the `.val` text colors.

```html
<style>
  :root { --mg:#ff00ff; --cy:#00ffff; --bg:#0a0010; }        /* game palette */
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body { margin:0; height:100%; overflow:hidden; background:var(--bg); color:#fff;
    font-family: 'Courier New', Courier, monospace; user-select:none; touch-action:none; }
  #game { display:block; width:100vw; height:100vh; }
  /* Position/background/font come from the shared .gamekit-hud (center-top pill).
     Keep only the game's value colours. */
  #hud .val { color:var(--cy); text-shadow:0 0 8px var(--cy); }
</style>
```

`touch-action:none` + `user-select:none` + `overflow:hidden` are required (no scroll/zoom/select on
a game surface). Distinct visual theme per game (synthwave, pastel, meadow, …).

---

## 3. Body structure

Exactly: the canvas, any optional game-specific DOM, the `.gamekit-hud` container, then **one
attribute-less inline `<script>` LAST before `</body>`**, and `gamekit.pwa()` OUTSIDE the IIFE.

```html
<body>
<canvas id="game"></canvas>
<div id="bkpad" aria-hidden="true"><span>◀</span><span>▶</span></div>  <!-- optional game DOM -->
<div id="hud" class="gamekit-hud">
  <div class="stat"><span class="lbl" id="lblScore">SCORE</span><span class="val" id="scoreEl">0</span></div>
  <div class="stat"><span class="lbl" id="lblBest">BEST</span><span class="val" id="bestEl">0</span></div>
  <div class="stat"><span class="lbl" id="lblLives">LIVES</span><span class="hrt" id="livesEl">♥♥♥</span></div>
</div>
<script>
(() => {
  /* … the whole game (see §4) … */
})();
  window.gamekit.pwa();   /* OUTSIDE the IIFE, after it runs */
</script>
</body>
</html>
```

- Score/best HUD items go inside a **`.gamekit-hud`** container (id `hud`). The kit positions it
  center-top; the game reserves `gamekit.layout.hudTop()` px of headroom in its layout.
- The static label text (`SCORE`/`BEST`/…) is English placeholder only — give each `.lbl` an id and
  localize once at boot via `KIT.t` (breakout's `i18nHudLabels()`):
  `document.getElementById('lblScore').textContent = KIT.t('game.<slug>.hudScore', { def: 'SCORE' })`.
- The inline `<script>` has **no attributes** — the test harness extracts the last attribute-less
  `<script>` before `</body>`, so `<head>` `<script src=…>` never confuse it.
- **`gamekit.pwa()` is called after the IIFE closes** (outside it), so it's excluded from the inline
  script the harness runs headlessly.

---

## 4. The inline IIFE skeleton (in order)

The one `(() => { … })()` before `</body>`. Order that works well:

**a. Aliases + audio.** Grab canvas/ctx/kit once. Define SFX (never reuse a kit stinger name like
`levelup`/`lose` — that self-recurses into silence).

```js
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const KIT = window.gamekit;
const SND = window.gamekit.sound;
SND.define({
  bounce: (c) => c.voice({ f: 520, dur: 0.05, type: 'triangle', gain: 0.13 }),
  break:  (c) => { c.voice({ f: 740, slideTo: 1180, dur: 0.09, type: 'square', gain: 0.11 }); c.noiseHit({ dur: 0.06, gain: 0.07 }); },
});
```

**b. Config consts + state FSM.** Tunables as named consts. The canonical state machine is
`'ready' | 'playing' | 'paused' | 'over'`. (Some games track pause via the kit overlay and only
carry `ready|playing|over` in their own `state` — either is fine; breakout uses `paused` explicitly.)

```js
const PADDLE_H = 14, BALL_R = 7, LIVES_START = 3;
let W, H, topMargin = 44;
let state = 'ready';            // ready | playing | paused | over
let score = 0, best = 0, lives = LIVES_START, level = 1;
let gameMode = 'classic';
```

**c. Best-store helpers.** The kit best store is the ONLY source of truth (`gamekit_pb`). Never a
per-game best key. `modeLabel` is the human label the profile shows.

```js
const modeLabel = m => { m = m || gameMode; return m.charAt(0).toUpperCase() + m.slice(1); };  // storage key — stays English
const modeDisplay = m => KIT.t('game.breakout.mode' + modeLabel(m), { def: modeLabel(m) });    // displayed name — translated
function loadBest(mode) { return KIT ? KIT.bestScore('breakout', modeLabel(mode)) : 0; }
function saveBest()     { if (KIT) KIT.saveBest('breakout', modeLabel(gameMode), { score }); }
```

The `modeLabel` used for storage (`saveBest` / `record.mode`) is a stable English string; only the
*displayed* name goes through `KIT.t` (the `modeDisplay` split above — breakout's real idiom).

Compute `isBest` / `newBest` **before** the single end-of-run save, or "★ New best!" never fires.
`stacker.gameOver()` is a clean reference: `const prevBest = currentBest(); saveBest(); const isBest = score > prevBest;`.

**d. `resize()` — canvas sizing + HUD headroom.** Compute CSS size from the viewport, hand it to
`KIT.fitCanvas` (which applies the retina backing store), then reserve `KIT.layout.hudTop()` px up
top so the playfield clears the HUD pill. Wire it via `KIT.layout.on(...)` (coalesced resize +
orientationchange + visualViewport). ALL drawing/pointer math stays in CSS px.

```js
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  KIT.fitCanvas(canvas, W, H);           // retina backing store; drawing stays in CSS px
  topMargin = KIT.layout.hudTop();       // headroom for the center-top HUD (92 narrow / 48 desktop)
  /* … recompute layout from W/H/topMargin … */
}
window.gamekit.layout.on(resize);
```

(Breakout uses `topMargin = KIT.layout.narrow ? 128 : KIT.layout.hudTop()` because its 5-stat pill
wraps — but `topReserve` must still be **≥ `hudTop()`**, never less. Don't re-derive the 92/48.)

**e. The three `KIT.menu.show` screens.** All three screens are `gamekit.menu`:

- **START** (`kind:'start'`) — mode/options via `groups` (`style:'cards'` for rich mode cards with a
  canvas `preview`), `toggles`, `actions:[{id:'play',primary:true}]`, `hint`, `onChange`, `onPlay`.
- **END** (`kind:'end'`) — score + best + `newBest` (computed before save) + `actions` (Play again /
  Menu) + the kit `share:` row + **`record:` — the ONLY way results are recorded** (idempotent per
  run; never call `gamekit.recordResult` directly).
- **PAUSE** (`kind:'pause'`) — resume / quit actions + `onEsc`.

**Every player-facing string goes through `KIT.t(key, { def: 'English' })`** — `def:` is the English
source, so the game works with zero `i18n.js` edits, and translations land later without touching the
game. This is the real breakout code:

```js
function showStartMenu() {
  state = 'ready'; KIT.showMenuButton(false); KIT.showPauseButton(false);
  KIT.menu.show({ kind: 'start', theme: MENU_THEME, title: KIT.t('game.breakout.menuTitle', { def: 'BRICK BREAKER' }), backdrop: menuBackdrop,
    groups: [{ id: 'mode', label: KIT.t('game.common.modeLabel', { def: 'MODE' }), style: 'cards', default: gameMode, choices: [
      { id: 'classic', label: modeDisplay('classic'), mech: [KIT.t('game.breakout.mechLevels', { def: 'Levels' })], best: () => loadBest('classic'), preview: (g,w,h)=>pvBrick(g,w,h,3) },
      /* … */
    ] }],
    toggles: [{ id: 'speed2x', label: KIT.t('game.breakout.speed2x', { def: '2× speed' }), default: loadSpeedPref() }],
    actions: [{ id: 'play', label: KIT.t('game.breakout.insertCoin', { def: 'INSERT COIN' }), primary: true }],
    hint: st => { const d = MODE_DESCS[st.mode]; return d ? KIT.t('game.breakout.desc' + modeLabel(st.mode), { def: d }) : ''; },
    onChange: st => { gameMode = st.mode; KIT.stampUrl({ mode: st.mode }); },
    onPlay:   st => { gameMode = st.mode; startMode(st.mode); },
  });
}
function showEnd() {
  KIT.menu.show({ kind: 'end', theme: MENU_THEME, title: KIT.t('game.breakout.gameOver', { def: 'GAME OVER' }), backdrop: menuBackdrop,
    record: { slug: 'breakout', mode: modeLabel(gameMode), score },              // records exactly once; mode = the ENGLISH storage label
    score, best, newBest: score >= best && score > 0,
    lines: [KIT.t('game.breakout.endLine', { mode: gameMode.toUpperCase(), level, def: gameMode.toUpperCase() + ' · level ' + level })],
    share: { slug: 'breakout', accent: '#ff5cc8', icon: '🧱', title: KIT.t('game.breakout.title', { def: 'Brick Breaker' }),
             message: () => shareMsg(), params: () => ({ mode: gameMode }) },
    actions: [{ id: 'again', label: KIT.t('game.common.playAgain', { def: 'PLAY AGAIN' }), primary: true }, { id: 'menu', label: KIT.t('game.common.menu', { def: 'MENU' }) }],
    onAction: id => { if (id === 'again') startMode(gameMode); else if (id === 'menu') toMenu(); } });
}
```

Reuse the already-translated `game.common.*` keys (`playAgain`, `menu`, `paused`, `resume`,
`quitToMenu`, `modeLabel`, `score`, `best`, …) for shared strings; mint `game.<slug>.*` keys for
game-specific ones. Interpolate with `{param}` tokens (never `+`-join sentence fragments — word
order changes between languages). See `references/i18n.md`.

**f. `update()` / `render()`.** Model is truth; the view only renders it. `update()` advances one
fixed 60 Hz step and must be drivable via `__test.step(n)` (never rely on rAF). `render()` reads the
selected cosmetic skin — `KIT.cosmetics.selected('<slug>.<set>')` — and draws in CSS px.

```js
function render() {
  const id = KIT.cosmetics && KIT.cosmetics.selected('breakout.ball');   // apply the equipped skin
  const sk = BALL_SKINS[id] || BALL_SKINS['breakout.ball.neon'];
  /* draw background, entities with sk, HUD-independent visuals … */
}
```

**g. Input.** Pointer coords scaled by `W / rect.width` (CSS px, never `canvas.width`); touch aim
maps to canvas coords, not client coords. Keys: Space/Enter (action), Esc (pause). Game-over restart
accepts tap AND key.

```js
function cx(e, r) { return (e.clientX - r.left) * (W / r.width); }   // scale to CSS px
canvas.addEventListener('pointerdown', e => { const r = canvas.getBoundingClientRect(); /* … */ });
window.addEventListener('keydown', e => {
  if (state === 'playing') {
    if (e.key === 'Escape') { e.preventDefault(); pauseGame(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); launch(); }
  }
});
```

**h. `KIT.nav(...)` + music.** The whole top chrome in one call. `slug` derives the reset prefix
(`slug + '_'`) and the challenges key — do NOT pass `reset:`/`challenges:`.

```js
KIT.nav({ slug: 'breakout', music: true, home: '../../', theme: MENU_THEME,
  onMenu: () => toMenu(),
  onPause: () => { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); },
  confirmLeave: () => (state === 'playing' || state === 'paused') ? KIT.t('confirm.leave', { def: "Leave this run? You'll lose your progress." }) : false,
  controls: { title: KIT.t('game.breakout.controlsTitle', { def: 'Brick Breaker — Controls' }),
    mouse: [[KIT.t('game.breakout.ctrlMove', { def: 'Move' }), KIT.t('game.breakout.ctrlSlidePaddle', { def: 'Slide paddle' })], [KIT.t('game.common.click', { def: 'Click' }), KIT.t('game.breakout.ctrlLaunch', { def: 'Launch' })]],
    keyboard: [['← →', KIT.t('game.breakout.ctrlMovePaddle', { def: 'Move paddle' })], [KIT.t('game.common.spaceEnter', { def: 'Space · Enter' }), KIT.t('game.breakout.ctrlLaunch', { def: 'Launch' })], [KIT.t('game.common.esc', { def: 'Esc' }), KIT.t('game.common.pause', { def: 'Pause' })]],
    touch: [[KIT.t('game.breakout.ctrlHoldSide', { def: 'Hold L / R side' }), KIT.t('game.breakout.ctrlSlidePaddle', { def: 'Slide paddle' })], [KIT.t('game.common.tap', { def: 'Tap' }), KIT.t('game.breakout.ctrlLaunch', { def: 'Launch' })]] } });
KIT.music.play('synthwave');
```

(Controls labels are player-facing too — key glyphs like `'← →'` stay literal, everything worded
goes through `KIT.t`, exactly as breakout does.)

**i. The main loop — `KIT.loop`.** New games use the kit's fixed-timestep accumulator (60 Hz at any
refresh rate, kit-pause built in). It never ticks headlessly — tests drive `__test.step(n)`.

```js
KIT.loop(update, render);            // stacker/flappy: the standard for new games
```

(Breakout/snake/asteroids are **grandfathered** exceptions that ship their own equivalent fixed-step
+ isPaused accumulator. Don't copy that for a new game — use `KIT.loop`.)

**j. Boot.** `resize()` → `updateHud()` → start the loop → `showStartMenu()` (with any `?mode=`/
`?bird=` deep-link preselected first).

```js
resize(); updateHud(); KIT.loop(update, render);
showStartMenu();
```

**After the IIFE:** `window.gamekit.pwa();` (see §3).

---

## 5. The `__test` hook + `layout` getter

The last thing inside the IIFE. `window.__test` is the deterministic drive surface the harness uses;
it's harmless in normal play. **Universal minimum every game must expose:**

- `get state()` — the FSM value.
- `get score()` — current score.
- `get layout()` — JS-computed bounds in canvas px (see below), including **`topReserve`**.
- `start()` — begin a run (and usually `startMode(m)` for multi-mode games).
- `step(n)` — call `update()` n times directly (drives the sim without rAF).
- `menu()` — `KIT.menu.current()` so tests can `.activate('again')` on the end menu.

Plus game-specific getters/setters for whatever the suite asserts (breakout: `lives`, `bricks`,
`ballStuck`, `mode`, `best(m)`, `setBall`, `setPaddle`, `launch`, `ballCount`, …).

The **`layout` getter** returns `{ W, H, topReserve, …element rects }` — all in canvas px, computed
from state (not read off the DOM). `runLayoutSuite` asserts `W===viewport.w`, `H===viewport.h`, and
**`topReserve >= gamekit.layout.hudTop()`** itself; the game's own `check` callback asserts the rest.
Real breakout getter:

```js
get layout() {
  const pw = widePaddle > 0 ? paddleW * 1.6 : paddleW;
  let bt = brickOffY, bb = brickOffY, bl = W, br = 0;
  for (const b of bricks) { const r = brickRect(b);
    bt = Math.min(bt, r.y); bb = Math.max(bb, r.y + r.h);
    bl = Math.min(bl, r.x); br = Math.max(br, r.x + r.w); }
  return { W, H, topReserve: topMargin, brickOffY, brickTop: bt, brickBottom: bb,
    brickLeft: bricks.length ? bl : W / 2, brickRight: bricks.length ? br : W / 2,
    paddleY: paddleY(), paddleLeft: paddleX - pw / 2, paddleRight: paddleX + pw / 2 };
},
```

Full breakout hook (trimmed to shape):

```js
window.__test = {
  get state() { return state; },
  get score() { return score; },
  get lives() { return lives; },
  get bricks() { return bricks.length; },
  get mode() { return gameMode; },
  get layout() { /* … as above … */ },
  start: startGame,
  startMode,
  launch,
  menu() { return KIT ? KIT.menu.current() : null; },
  best(m) { return loadBest(m); },
  setPaddle(x) { paddleX = paddleTarget = x; },
  setBall(x, y, vx, vy) { /* set balls[0] + ballStuck=false */ },
  step(n) { for (let i = 0; i < (n || 1); i++) update(); },
};
```

**Notes on the getter:** `topReserve` must equal the headroom the game actually reserves and be
`≥ hudTop()`. Only measure JS-computed layouts — never fabricate coords for CSS/DOM-positioned HUD
elements (they can't be measured headlessly). For scaled-world canvases (asteroids), the suite is
run with `{size:false}` and the getter omits the `W===viewport` guarantee.
