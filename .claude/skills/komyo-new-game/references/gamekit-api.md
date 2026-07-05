# game-kit API reference (komyo)

Complete reference for the shared game framework in `game-kit.js`. Everything a game needs —
top chrome, the three-screen menu, the main loop, canvas sizing, audio, best scores, challenges,
cosmetics, sharing and PWA updates — hangs off the single global `window.gamekit`. The kit is fully
headless-safe: every browser API is guarded, so the object exists and all methods are callable in a
mocked DOM without throwing (they no-op instead).

This doc mirrors the source (the public `api` object is defined at the very end of `game-kit.js`).
When in doubt, the code is truth.

## Table of contents

- [Alias convention](#alias-convention)
- [The mandatory set (at a glance)](#the-mandatory-set-at-a-glance)
- [nav / chrome](#nav--chrome)
- [menu — the 3-screen framework](#menu--the-3-screen-framework)
  - [menu.show(cfg) — exhaustive](#menushowcfg--exhaustive)
  - [Group styles](#group-styles)
  - [The returned handle](#the-returned-handle)
- [loop](#loop)
- [layout](#layout)
- [canvas: fitCanvas / roundRect](#canvas-fitcanvas--roundrect)
- [sound (SFX)](#sound-sfx)
- [music](#music)
- [best store / stats / results](#best-store--stats--results)
- [challenges](#challenges)
- [cosmetics / trophies / shop](#cosmetics--trophies--shop)
- [share / cards / discord](#share--cards--discord)
- [i18n — t / lang / langs](#i18n--t--lang--langs)
- [pwa / updates / version](#pwa--updates--version)
- [misc utilities](#misc-utilities)
- [Mandatory vs optional vs never-call-directly checklist](#mandatory-vs-optional-vs-never-call-directly-checklist)
- [Top gotchas](#top-gotchas)

---

## Alias convention

Every game aliases the API exactly once, right after the atomic `<head>` unit has loaded (the kit is
NOT `defer`, so `window.gamekit` exists before the inline `<script>` runs):

```js
const KIT = window.gamekit;
```

All calls below are written as `KIT.<method>` for brevity; `gamekit.<method>` is identical.

---

## The mandatory set (at a glance)

A new game MUST call these (they are the contract the test suites + kit assume):

| Method | Why it is mandatory |
| --- | --- |
| `KIT.nav({slug, …})` | The entire top chrome + reset/challenge/cosmetics wiring; `slug` is the one identity. |
| `KIT.menu.show(cfg)` | The only way to render START / GAME-OVER screens (and the only recording path, via `record:`). |
| `KIT.loop(update, render, opts)` | The fixed-timestep main loop (grandfathered games have their own equivalent). |
| `KIT.fitCanvas(canvas, W, H)` | The one canvas sizing + DPR policy; re-run from the resize path. |
| `KIT.layout.on(cb)` | Coalesced relayout on resize/rotate; also provides `hudTop()` headroom. |
| `KIT.pwa()` | Service-worker registration + the one update policy. |
| `KIT.saveBest` / `KIT.bestScore` | The single best-score store (no per-game best keys). |
| `KIT.sound` | SFX channel — `SND.define(...)` + `SND.play(...)` for game feedback. |

Everything else is optional (music, cosmetics, share customisation, challenges panel) or
kit-internal (`recordResult`, `challengeEval`) — see the final checklist.

---

## nav / chrome

### `KIT.nav(opts)` — MANDATORY

Builds the whole top chrome and injects the right-hand button cluster. Call once at boot.

`opts` keys:

- `slug` — **the one identity.** From it the kit derives, unless you override them:
  - `opts.reset` ← `slug + '_'` (the localStorage prefix the ↺ Reset button clears)
  - `opts.challenges` ← `slug` (the challenges key; enables the 🏆 button)
  - `opts.cosmetics` ← `slug` (only when `window.COSMETICS` is loaded; enables the 🎨 button)
  You should never need to pass `reset`/`challenges`/`cosmetics` explicitly.
- `music` (bool) — add the ♪ Music slider to the sound panel (only meaningful if the game plays music).
- `home` (string) — the "komyo ›" link href (default `'../../'`).
- `theme` (object|fn) — `--gkm-*` menu theme, forwarded to confirms/modals opened from the chrome.
- `onMenu` (fn) — overrides the ‹ Menu button's default `location.reload()` (e.g. asteroids reshows
  its picker). Guarded by `confirmLeave`.
- `onPause` (fn) — wires the ⏸ button to the game's own pause instead of the kit's universal overlay.
- `confirmLeave` (`true` | string | fn → message|false) — guards mid-run exits via ‹ Menu and the
  home link; evaluated at click time so it can return `false` on the start screen and a message
  mid-run. `true` uses a default message. Pauses the game under the confirm.
- `controls` (object) — enables the 🎮 button; the cfg passed to `controlsModal` (see below).
- `genres` (object) — slug→genre map forwarded to the challenges panel (only `distinctGenres`
  needs it).

Side effects: also calls `audioMenu(...)`, `versionTag()`, wires `layout.on(fitNav)`, shows the
tap-to-play splash (`tapToStart()`), and blocks the canvas context menu.

**Gotcha:** the slug you pass here MUST equal the folder name, the `games.js` slug, the `record`/
`share`/`saveBest` slug, and the `CHALLENGES.goodRun` key — a mismatch breaks silently.

### `KIT.showMenuButton(show)` — optional

Show/hide the ‹ Menu button. It's only meaningful DURING play (on the game's own menu it confuses
people). Call `showMenuButton(true)` when a run starts, `showMenuButton(false)` on the menu screen.

### `KIT.showPauseButton(show)` — optional

Show/hide the ⏸ button (e.g. hide it on the menu screen).

### `KIT.audioMenu(opts)` — internal (nav calls it)

Builds the right-hand cluster (⏸ pause, 🔊 sound panel with SFX/♪ sliders, optional 🏆 challenges,
🎨 cosmetics, 🎮 controls, and the ☰ game menu with version/Update/Embed/Reset). Games do not call
this directly — `nav()` calls it. `opts`: `{music, reset, onPause, controls, challenges, cosmetics,
genres, theme}`.

### `KIT.controls(cfg, theme)` — optional (usually via `nav({controls})`)

Opens the controls modal. `cfg`: `title?`, `note?`, and rows in `keyboard` / `mouse` / `touch`, each
row `[keys, action]`. Modal — freezes the game and Esc-closes.

### `KIT.confirm(msg, onYes, yesLabel, onCancel, opts)` — optional

In-page confirm dialog (replaces `window.confirm`). `yesLabel` defaults to `'OK'`; `onCancel` fires
on Cancel/overlay-click/Esc. `opts`: `{hold: ms}` (press-and-HOLD the yes button, for destructive
actions), `{theme}`. Keyboard-steerable (←/→/Tab, Enter/Space, Esc); default focus is the safe
Cancel. Modal (`_modalOpen` gate → `isPaused()` true underneath).

### `KIT.embedModal(opts)` — optional (wired into the ☰ menu automatically)

The "⧉ Embed this game" iframe-snippet modal. `opts`: `{slug, title}` for one game, or
`{games:[{slug,title,icon?}]}` for a picker.

### `KIT.versionTag()` — internal (nav calls it)

Renders the tiny bottom-left build stamp (SHA · deploy date). Hidden on dev/local.

---

## menu — the 3-screen framework

`KIT.menu` is the declarative overlay engine for the three screens every game has: START, PAUSE, END.
One structure + behaviour; the look is fully per-game via `--gkm-*` CSS custom properties (set in the
game's CSS or passed as a `theme` object). Built with `createElement` + direct refs, so it drives
identically headless and live.

- `KIT.menu.show(cfg)` → returns a handle (see below). Tears down any previous menu first.
- `KIT.menu.hide()` — dismiss the menu (a game starting a run). **This also arms the next
  `cfg.record`** (bumps the run counter), which is why an internal re-show can't double-record.
- `KIT.menu.current()` — the current handle, or `null`.

### menu.show(cfg) — exhaustive

Every `cfg` key:

| Key | Type | Meaning |
| --- | --- | --- |
| `kind` | `'start'`\|`'pause'`\|`'end'` | Screen kind (default `'start'`). Adds `gamekit-menu-<kind>` class. |
| `title` | string | The `<h1>` (omit for no title). |
| `score` | number | Renders the big score readout (`gkm-score`). Formatted with thousands separators. |
| `scoreText` | string | Overrides the formatted `score` (e.g. a speedrun `mm:ss.cs`). |
| `best` | number | "Best: N" line under the score (only rendered when `score != null`). |
| `newBest` | bool | Appends "★ New best!" to the best line. **Compute this BEFORE the single end save.** |
| `lines` | string[] | Extra `<p class="gkm-line">` rows (HTML allowed). |
| `banner` | fn(state)→html | A live line under the title, re-rendered on every refresh (e.g. a credit counter). |
| `hint` | fn(state)→string | A `<p class="gkm-hint">` line, re-rendered on change. |
| `groups` | array | Option rows / selectors / grids / shops — see [Group styles](#group-styles). |
| `toggles` | array | Boolean checkboxes: `{id, label, caption?, default?, disabled?}`. Rendered after groups. |
| `actions` | array | Buttons: `{id, label, primary?, danger?, confirm?, confirmYes?}`. |
| `record` | object | `{slug, mode, score, time?, stats?}` — **the ONE recording path.** Recorded once per run. |
| `share` | object | `{slug, accent, icon, title, message, params, card?}` → a share row + Discord auto-post. |
| `onPlay` | fn(state) | Fires when the `id:'play'` action activates. `state` = selections + toggle booleans. |
| `onAction` | fn(id, state) | Fires for any non-`play` action id. |
| `onChange` | fn(state) | Fires on every selection/toggle change (e.g. to live-stamp the URL). |
| `onEsc` | fn | Fires on Escape (e.g. pause→resume). |
| `theme` | object\|fn | `--gkm-*` overrides (short keys are prefixed with `--gkm-`; `--`-prefixed keys pass through). A fn resolves at open time (e.g. flappy day/night). |
| `backdrop` | fn(ctx,w,h,state,frame) | Animated/painted canvas behind a frosted box. `theme.scrim`/`theme.overlay` dims it. |
| `backdropAnimate` | bool | Run `backdrop` every rAF frame (respects `prefers-reduced-motion` → static frame only). |

Notes:

- `state` passed to callbacks = each group's current selection id merged with each toggle's boolean.
- **`record:` is recorded exactly once per run** — the menu records BEFORE building the DOM (so the
  "✓ Good run" trickle receipt is accurate), and is idempotent across re-shows until `menu.hide()`
  arms the next run. The `record.slug` falls back to `share.slug` if omitted.
- If `record.slug` has a `CHALLENGES.goodRun` bar and the score cleared it, a "✓ Good run" line is
  auto-added (with the +5 🏆 trickle receipt).
- `share` is rendered via `shareRow` into a host div inside the scroll area (see the share section).
- Speedrun/sprint records render as TIME (from `record.time`) on the score card automatically.

### Group styles

Each entry in `groups` is `{id, label?, default?, style?, choices:[…]}`. `default` sets the initial
selected choice id (else the first choice). Style-specific choice fields:

**(default — button row, no `style`)** — `choices: {id, label, desc?}`. Simple selectable buttons;
`desc` renders as a sub-line.

**`style:'cards'`** — rich mode cards. `choices: {id, label, tag?, desc, mech, best, preview,
pvW?, pvH?}`:
- `desc` / `best` / `mech` may be a value OR `fn(state)` (re-evaluated on every change).
- `mech` is a string, an array of chips, or `fn(state)→chips`; each chip is a string or
  `{label, hot?}` (hot = highlighted).
- `preview` is `fn(ctx,w,h,state)` drawn into the card's canvas (default 120×120, override `pvW`/`pvH`).
- `locked` (value|fn) dims the card and blocks selection.

**`style:'slider'`** — a segmented slider; each stop label is a focusable choice. `choices: {id,
label}`. Pointer-drag or click a label to select.

**`style:'grid'`** — thumbnail grid. `choices: {id, label, preview, pvW?, pvH?, sub?, best?,
locked?, cost?, lockedLabel?, afford?, price?, desc?, buy?}`:
- `preview` `fn(ctx,w,h,state)` (default 46×40); `sub`/`best`/`cost`/`lockedLabel`/`afford` may be
  value or fn.
- A **locked cell with a `buy(id, handle)` fn is buyable in place** (the cosmetics wiring): two-step
  touch (first tap focuses so the price/desc reads, second tap or the BUY button buys); mouse
  hover+click buys in one go. A successful `buy` returning truthy selects the cell. This is what
  `KIT.cosmetics.menuGroup(...)` produces.

**`style:'popup'`** — a map/skin picker: a trigger button showing the current choice; clicking opens
a modal (list + big preview + description). `choices: {id, label, preview, desc?, sub?, best?,
pvW?, pvH?}`; group-level `pickerTitle?`.

**`style:'shop'`** — an ACTION grid (buy/pick, not a held selection). Powers the Asteroids+ level-up
picker + between-wave shop. Group-level: `onPick(id, handle)` (fires on click/Enter; the menu
re-renders after so costs/affordability update live), `sub(item,state)→html`,
`disabled(item,state)→bool` (dims + blocks), `icon` per choice (painter, like cards' preview),
`cols:3` (fixed 3-across shape), `pickLabel(item,state)→label` (the small-screen BUY/TAKE button).
`choices: {id, label, tag?, desc, icon?}`.

Big-list styles (`cards`/`grid`/`shop`) trigger the landscape-phone SPLIT layout: the list goes in a
left pane, title + simple selectors/toggles/hint/actions in a right rail (nodes re-parented, not
rebuilt, so state/listeners/canvas bitmaps survive).

### The returned handle

`menu.show(cfg)` returns (a headless no-op stub with the same shape if there's no DOM):

- `hide()` — same as `menu.hide()` (dismiss + arm next record).
- `el` — the overlay DOM node (or `null`).
- `selection()` — the current `state` object (selections + toggles).
- `focus(i)` — move keyboard focus to focusable index `i` (wraps).
- `select(grp, choice)` → bool — programmatically select a choice (used by the headless harness).
- `toggle(id, on?)` → bool — set/flip a toggle (omit `on` to flip).
- `activate(actionId)` → bool — fire an action by id (as if clicked).
- `focusedId()` → the currently focused element's id (action id / toggle id / choice id), or `null`.

Keyboard: arrows/WASD move focus, Enter/Space activate, Esc → `onEsc`. Focus starts on the primary
action if any.

---

## loop

### `KIT.loop(update, render, opts)` — MANDATORY (new games)

THE main loop: a fixed-timestep accumulator. Real elapsed time accumulates and drains in fixed
`1000/60 ms` steps — `update()` runs once per step (so physics is identical at 60/90/120 Hz),
`render()` runs once per display frame. Kit pause is built in (paused → render only, no dt jump on
resume); a tab stall is clamped at 100 ms (no catch-up spiral).

`opts`:
- `mult` — `fn()→number` scaling game-time (a 2× toggle = exactly 2× real-time on any screen).
- `frame` — `fn()` run once per display frame BEFORE stepping (input polling etc.).

**Gotchas:**
- Never do `rAF → update()` directly — that ships a frame-rate-dependent game.
- `update()` must stay drivable via `__test.step(n)` (headless, rAF is a no-op → the loop never
  ticks; tests call `update()` themselves).
- Grandfathered exceptions with their own equivalent fixed-step + isPaused accumulators: breakout,
  snake, asteroids, asteroids-plus. New games use `KIT.loop`.

### Pause helpers — optional

- `KIT.isPaused()` → bool — true when the game paused it, a quiet freeze is on, OR **any kit overlay
  is open** (confirm / controls / embed / sound panel / menu). The loop freezes under any modal.
- `KIT.setPaused(bool)` — set the universal pause (shows the overlay).
- `KIT.togglePause()` — flip it.

---

## layout

### `KIT.layout` — MANDATORY (`.on` + `hudTop`)

- `layout.w` / `layout.h` (getters) — viewport CSS px.
- `layout.portrait` / `layout.landscape` / `layout.narrow` (getters) — `narrow` = portrait OR
  ≤560px wide.
- `layout.hudTop()` → **the ONE HUD headroom number: 92 (narrow) / 48 (otherwise).** Reserve this
  many px at the top so the `.gamekit-hud` clears the nav. Never re-derive these numbers.
- `layout.state()` → `{w, h, portrait, landscape, narrow, hudTop}` snapshot.
- `layout.on(cb)` → `layout` — register a relayout callback, fired (coalesced into one rAF) on
  resize/orientationchange/visualViewport changes. **Does NOT fire on registration** (games already
  call their own resize at boot). Re-run `fitCanvas` from here.
- `layout.requireOrientation('portrait'|'landscape')` → bool — shows a "rotate your phone" overlay
  when the orientation is wrong; returns whether the wanted orientation is met. Keeps the ‹ Menu nav
  clickable above the splash.
- `layout.__emit(w, h)` — test hook: set mocked dims + relayout now.

**Gotcha:** in the layout/overlap test suite, `topReserve` in your `__test.layout` getter must be
≥ `hudTop()` — that's the headless stand-in for "the score box doesn't sit under the nav".

---

## canvas: fitCanvas / roundRect

### `KIT.fitCanvas(canvas, w, h, opts)` — MANDATORY

The ONE canvas sizing + DPR policy. The game computes its own CSS size (each has its own playfield
policy) and calls this from its resize path. Sets the CSS box, scales the backing store by
`devicePixelRatio` (capped at 2; headless → 1), and applies the matching transform, so **all game
drawing + pointer math stays in CSS px.** Returns `{w, h, dpr}`.

- Omit `w`/`h` for a full-viewport canvas (uses the viewport size).
- `opts.dpr === false` opts out (scaled-world canvases that manage their own transforms — asteroids,
  asteroids-plus).
- `opts.maxDpr` overrides the cap of 2.

**Gotchas:**
- Scale pointer coords by `W / rect.width`, NEVER by `canvas.width` (the backing store is dpr-scaled).
- Reads of `canvas.width` in game logic should switch to the game's own `W`/`H` (CSS px).
- Re-run it via `layout.on(...)`.

### `KIT.roundRect(g, x, y, w, h, r)` — optional

`beginPath` + a rounded-rect path (caller fills/strokes). `r` is a number or a CSS-style radii array.
The kit also installs the `ctx.roundRect` polyfill, so bare `ctx.roundRect(...)` calls are always
safe everywhere (old Safari + the headless mock).

---

## sound (SFX)

### `KIT.sound` — MANDATORY (game feedback)

The SFX channel (settings key `gamekit_sfx_muted` / `_vol`). No-op when muted or headless.

- `sound.define(map)` → `sound` — register named SFX. Each value is
  `fn(ctx)` where `ctx = {tone, noise, voice, noiseHit, seq, now, play}`:
  - `tone(f, d, type?, g?)` — a simple oscillator beep.
  - `noise(d, g?)` — a filtered noise burst.
  - `voice(o)` — the rich synth voice; `o` keys: `f, dur, type, gain, attack, slideTo, detune,
    filter, cutoff, cutoffTo, q, reverb, vibrato, vibratoDepth, t`.
  - `noiseHit(o)` — the rich noise voice (same opts family).
  - `seq(arr, gap, fn)` — schedule `fn(item, i)` every `gap` ms.
  - `now()` — current audio time (for scheduling `t:`).
  - `play(name)` — play another defined SFX.
- `sound.play(name)` — play a defined SFX (resumes the AudioContext if suspended).
- `sound.tone/noise/voice/noiseHit/seq` — the same primitives, callable directly.
- `sound.isMuted()` / `sound.setMuted(m)` / `sound.toggle()` → muted / `sound.volume(v?)`
  (getter when no arg).

**Kit-owned stingers** (already defined — play them, never redefine): `victory`, `newbest`,
`levelup`, `gameover`, `lose`. **Gotcha:** `SND.define` must never reuse one of these names — the kit
plays them itself, so an override self-recurses into silence.

---

## music

### `KIT.music` — optional

The Music channel: a procedural generative engine, kit-owned (settings key `gamekit_music_muted` /
`_vol`, routed through `musicGain`).

- `music.play(themeKey)` — start/swap a theme (seamless swap if already running). Theme keys live in
  `music.themes`: `space, neon, synthwave, meadow, candy, pastel, tactical, castle`, plus the Keep
  Defender per-map set (`kd_grass, kd_ice, kd_lava, kd_desert, kd_dungeon, kd_marsh`).
- `music.stop()` — stop and clear the theme.
- `music.current()` → the current theme key (or `null`).
- `music.themes` — the theme registry object.
- `music.gain()` → the effective gain (0 when muted).
- `music.isMuted()` / `music.setMuted(m)` / `music.toggle()` / `music.volume(v?)` — channel controls.
- `music.subscribe(cb)` — for a game with its OWN engine (asteroids): `cb({muted, volume, gain})`
  fires now + on every change so you can `applyGain(s.gain)`.

**Gotcha:** music only starts after the first user gesture (browsers keep the AudioContext suspended
until then — the tap-to-play splash is that gesture). Pass `music: true` to `nav()` to show the ♪
slider.

---

## best store / stats / results

The single source of truth for bests is `gamekit_pb`; `gamekit_stats` holds lifetime rollups.

### `KIT.saveBest(slug, modeLabel, data)` — MANDATORY

Save a best without counting a play. `data`: `{score, time?, stats?}`. `score` keeps the MAX, `time`
keeps the best (MIN > 0), `stats` keep the max per key. Returns `{isBest, record:{score,time,plays,
stats}}`. `modeLabel` is the human label the profile shows ("Classic", "Marsh · Hard").

### `KIT.bestScore(slug, modeLabel)` — MANDATORY

→ the best score number for that mode (0 if none).

### `KIT.best(slug, modeLabel)` — optional

→ `{score, time, plays, stats}` for that mode.

**Gotcha:** compute `isBest` / `newBest` BEFORE the single end-of-run save — a mid-run save makes
"★ New best!" never fire. aim-trainer's `endGame` is the reference. Use the kit store only; no
per-game best keys.

### `KIT.recordResult(slug, data)` — NEVER call directly

Internal: records the latest result, appends to today's activity log (for cross-game challenges),
updates per-day best, all-time best (+1 play), lifetime stats, and the good-run trophy trickle.
**Games use the end menu's `record:` instead** — an imperative call double-counts. Documented here
only so you recognise it.

### `KIT.lastResult(slug)` — optional

→ the last recorded result `{mode, score, time, stats, ts}` (or `null`). Used by the share card.

### `KIT.playedToday()` — optional

→ today's UTC activity log `{slugs, totalScore, count, goodRuns}`.

### `KIT.profile()` — optional (catalogue uses it)

→ aggregate all-time stats from `gamekit_pb`: `{perGame, gamesPlayed, modesPlayed, plays, top,
favGame, favMode, since, daysPlayed, goodRuns}`.

### `KIT.resetScores(prefix)` — optional (wired into ☰ Reset automatically)

Clears every localStorage key starting with `prefix` AND drops that game from `gamekit_pb`.

---

## challenges

Kit-owned logic; data in `challenges.js` (`window.CHALLENGES`). The catalogue drawer, in-game panel
and tile badges all route through these — never fork the math.

### `KIT.challengesPanel(opts)` — optional (wired into the 🏆 button automatically)

The in-game 🏆 modal: today's daily + this week's weekly (with the goal targeting `opts.slug`
highlighted), a trophies pill, a Cosmetics pill (opens the store), and the good-run bonus line.
`opts`: `{slug, genres, theme}`. Modal (freezes the game).

### `KIT.activeChallenge(slug)` — optional

→ bool: does THIS game have an active daily/weekly challenge right now? Drives the 🏆 glow.

### `KIT.challengeEval(goal, opts)` — internal / advanced

THE one evaluator. `opts`: `{genres, day, playable, titles}`. Returns `{val, target, done, pct,
title, slug}`. The catalogue routes through this; games rarely call it directly.

### `KIT.challengePick(kind, day?)` — internal / advanced

THE hashed, same-for-everyone daily/weekly pick. `kind`: `'daily'|'weekly'`; `day` = UTC day number
(defaults to today). Returns `{id, goal, idx, period}`. Drawer, in-game panel and tile badges all
route through this — never re-derive it.

**New-game wiring:** every live game needs a `CHALLENGES.goodRun` bar entry (keyed by slug) or it
silently never earns good runs. Add goal entries when the game goes live.

---

## cosmetics / trophies / shop

Kit-owned; registry data in `cosmetics.js` (`window.COSMETICS`). Challenge points are **trophies 🏆**
everywhere player-facing. Two metrics: **lifetime** (Σ `gamekit_done`, drives titles) and the
**spendable balance** (lifetime − Σ owned costs, derived, never stored).

### `KIT.cosmetics` — optional (expected for new games)

- `cosmetics.lifetime()` → total trophies earned (only grows).
- `cosmetics.balance()` → spendable trophies.
- `cosmetics.spent()` → Σ owned costs.
- `cosmetics.owned(id)` → bool (free defaults are pre-owned).
- `cosmetics.buy(id)` → bool (idempotent; fails if balance < price).
- `cosmetics.selected(setId)` → the selected item id for a set (falls back to the free default). **A
  game reads this in its render:** `const id = KIT.cosmetics.selected('<slug>.<set>')`.
- `cosmetics.select(setId, id)` → bool (must be owned; `site.cursor` re-applies the cursor).
- `cosmetics.progress(game?)` → `{owned, total, pct}` (scoped to a game or overall).
- `cosmetics.items()` / `cosmetics.item(id)` — registry access.
- `cosmetics.menuGroup(setId, opts)` — **the ONE wiring for a start-menu STYLE grid** (a
  `style:'grid'` group with select + buy-in-place). `opts`: `{id?, label?, preview?, pvW?, pvH?,
  freeLabel?}`. Note: the CLAUDE.md guidance is that the 🎨 store modal owns selection/buying — do
  NOT add per-game STYLE grids to the start menu; games just read `selected(...)` in render.
- `cosmetics.goodRunBonus()` → `{count, cap, per}` (also on the top-level api).

### `KIT.shopPanel(opts)` — optional (wired into the 🎨 button automatically)

The Cosmetics store modal. `opts`: `{game}` (scope to one game + site-wide cursors; header becomes
"🎨 <Game> cosmetics"), `{allGames}` (fn → an "All games →" link), `{onTitles}` (fn → a "See titles"
button), `{theme}`, `{onClose}`. Returns `{el, close, buy(id)}`. The top-bar 🎨 button opens it
scoped to the current game automatically.

### `KIT.goodRunBonus()` — optional

→ `{count, cap, per}` — the good-run trophy trickle state (+5 🏆 per good run, capped 3/day). The end
menu's "✓ Good run" line is the receipt.

**New-game wiring (optional but expected):** add sets/items to `cosmetics.js` (`<slug>.<set>.<key>`,
free default at price 0), load `cosmetics.js` in the `<head>` + `sw.js` SHELL, and read the selected
skin in render. The 🎨 button + store are automatic.

---

## share / cards / discord

### `KIT.shareRow(el, o)` — optional (usually via menu `share:`)

Renders the Native/X/Reddit/Copy/Card share row into `el`, and auto-posts the score to Discord when
the row becomes visible (consent-tiered). `o`: `{slug, url?, title, message, params?, accent, icon,
mascot, card?}`:
- `message` is a fn → a standalone sentence (no URL), evaluated at click time.
- `params` (object or fn) → appended as a query string so a shared link deep-links back to the mode.
- `card` (object or fn → `{score, sub, accent, icon, mascot}`) customises the score card; defaults
  come from the last recorded result, so no per-game wiring is needed.

**Discord auto-post** is gated by `discordTier()`: no consent → nothing; consent → anonymous;
Settings opt-in → named. Deduped + 60s throttled.

### `KIT.shareText(o)` — optional

Builds the consistent share sentence: `{verb?, score, unit?, game, emoji?, mode?, extra?[]}` →
`"{verb} {score} {unit} in {game} {emoji} — {mode}, {extra…}"`.

### `KIT.shareUrls(url, message)` — optional

→ `{x, reddit, copy}` share URLs/strings.

### `KIT.scoreCard(opts)` — optional

Builds the branded 1200×630 "neon marquee" score-card image → a Promise<Blob|null>. `opts`: `{slug,
title, accent, icon, score, scoreText, label:'SCORE'|'TIME', sub, player, mascot}`.

### `KIT.profileCard(opts)` — optional

Builds the "My Profile" card (1200×630) → Promise<Blob|null>. `opts`: `{player, accent,
stats:[{label,value}], rows:[{name,best,mode,accent}], collection:{owned,total,pct}}`.

### `KIT.shareCard(blob, opts)` — optional

Opens the in-page Share…/Copy image/Download menu for a card blob. `opts`: `{slug, title}`.

### `KIT.postDiscord(text, url, file)` — internal / advanced

Posts to the public Komyo Discord webhook. Games rely on `shareRow`'s auto-post; direct calls are rare.

### `KIT.discordTier()` — optional

→ `'off'` | `'anon'` | `'named'` — the current consent tier for the Discord auto-post.

---

## i18n — t / lang / langs

The kit's translation engine. Locale data lives in `i18n.js` (`window.KOMYO_I18N`, loaded in the
atomic `<head>` + `sw.js` SHELL); `game-kit.js` owns lookup, plurals, and the language picker.

### `KIT.t(key, params)` — MANDATORY (every player-facing string)

Looks up `key` in the active locale, falling back to `en`, then `params.def`, then the key itself.
`params`:
- `def` — the English source text. ALWAYS pass it; never rely on a key already existing in `i18n.js`.
- Any other param interpolates into `{name}` tokens in the string:
  `KIT.t('game.x.scoreLine', { score, def: 'Score {score}' })`.
- `count` — selects the plural category via `Intl.PluralRules` when the entry is a plural object
  (`{ one, few, many, other }`). `def:` can't pluralize, so plural keys need real `en` entries.

### `KIT.lang()` / `KIT.setLang(code)` / `KIT.onLang(cb)` — optional

`lang()` → the active locale code. `setLang(code)` persists it (`gamekit_lang`), sets `<html lang>`,
and notifies subscribers (unsupported codes fall back to `'en'`). `onLang(cb)` subscribes to language
changes; returns an unsubscribe fn.

### `KIT.langs()` — optional

→ a copy of the configured language list `[{code, label}, …]`. **This is the runtime source of truth
for which locales exist** — discover the set from here (or `Object.keys(window.KOMYO_I18N)`), never
hardcode it.

### `KIT.langButton(opts)` / `KIT.langMenu(opts)` — optional (the chrome wires them)

`langButton(opts)` → a flag trigger element that opens `langMenu` (the flag-grid picker modal; a
locale with 0 keys renders as "soon" and isn't selectable). `nav()` already puts a language entry in
the ☰ menu and the catalogue header has its own button — games don't call these.

---

## pwa / updates / version

### `KIT.pwa(file)` — MANDATORY

Service-worker registration + the ONE update policy. The catalogue passes `'sw.js'`; a game calls
`KIT.pwa()` (defaults to `sw.js`). A new build **never auto-reloads a visible page** — it lights a
dot on the ☰ menu (and the catalogue's "Update now"); the player applies it via the ☰ Update button.
The only reloads are that explicit apply and a backgrounded tab. Scope hand-overs are told apart
from real updates by the worker script URL.

### `KIT.updates` — optional

- `updates.check()` → Promise — fetch fresh `version.js` vs the running build; sets `available`.
- `updates.apply()` — update every scope's SW + reload (the ☰ Update button calls this).
- `updates.state()` → `{status, available, controlled, latest}` (`status`:
  idle|checking|ok|offline|refreshing).
- `updates.onChange(cb)` — subscribe to state changes.
- `updates.info` — alias of `buildInfo`.

### `KIT.buildInfo()` — optional

→ `{sha, url, built, when, label}` (label = `sha · local deploy date+time`; `'dev'` locally).

---

## misc utilities

- `KIT.stampUrl(params)` — `history.replaceState` the query string (deep-link state without reload).
- `KIT.param(name, default?)` — read a query param (e.g. a shared mode preselect).
- `KIT.player()` → the device display name (a random family-friendly nickname, assigned + persisted
  once). `KIT.setName(n)` sets it (empty → a new random one).
- `KIT.utcDateStr(ms?)` → `'YYYY-MM-DD'` (UTC). `KIT.utcDayNumber(ms?)` → whole UTC days since epoch
  (the "same for everyone" period key).
- `KIT.inActivity` (bool) — running inside a Discord Activity (discordsays.com).
- `KIT.proxyUrl(u)` — rewrite an external URL through the Discord Activity `/.proxy/` mappings
  (no-op elsewhere).

---

## Mandatory vs optional vs never-call-directly checklist

**MANDATORY (every new game):**
- `KIT.nav({slug, …})`
- `KIT.menu.show(cfg)` for START and END (with `record:` + `share:`), `KIT.menu.hide()` to start a run
- `KIT.loop(update, render, opts)` (or a grandfathered equivalent)
- `KIT.fitCanvas(canvas, W, H)` in the resize path
- `KIT.layout.on(cb)` + reserve `KIT.layout.hudTop()` px of top headroom
- `KIT.pwa()`
- `KIT.saveBest(...)` / `KIT.bestScore(...)` (the only best store)
- `KIT.sound` — `SND.define({...})` + `SND.play(...)`
- `KIT.t(key, { def })` — every player-facing string (no raw English literals in the UI)

**OPTIONAL (use when the game needs it):**
- `KIT.music.play/subscribe`, `nav({music:true})`
- `KIT.cosmetics.selected(...)` in render + a `cosmetics.js` entry
- `KIT.showMenuButton` / `KIT.showPauseButton`, `KIT.setPaused` / `KIT.togglePause` / `KIT.isPaused`
- `KIT.confirm`, `nav({confirmLeave, controls, onMenu, onPause})`
- `KIT.shareText` / `KIT.shareUrls` / `KIT.scoreCard` (menu `share:` covers most cases)
- `KIT.stampUrl` / `KIT.param` (deep-link modes), `KIT.player` / `KIT.setName`
- `KIT.updates` / `KIT.buildInfo` / `KIT.versionTag`

**NEVER CALL DIRECTLY (kit-internal — the wiring calls them):**
- `KIT.recordResult` — use the end menu's `record:` (an imperative call double-counts)
- `KIT.challengeEval` / `KIT.challengePick` — the catalogue/panel route through these; don't fork
- `KIT.audioMenu` — `nav()` calls it
- `KIT.postDiscord` — `shareRow`'s auto-post handles it

---

## Top gotchas

1. **The slug is the ONE identity.** Folder name = `games.js` slug = `nav({slug})` =
   `record`/`share`/`saveBest` slug = `CHALLENGES.goodRun` key. A mismatch breaks silently (wrong
   URLs, orphaned storage, dead challenges, a reset that wipes another game).
2. **`record:` in the end menu is the ONLY way results are recorded.** Never call
   `KIT.recordResult` directly — the menu path is idempotent per run; an imperative call
   double-counts.
3. **Compute `isBest` / `newBest` BEFORE the single end-of-run save.** A mid-run save makes
   "★ New best!" never fire.
4. **Never reuse a kit-owned stinger name** (`victory`, `newbest`, `levelup`, `gameover`, `lose`) in
   `SND.define` — the override self-recurses into silence.
5. **After `fitCanvas`, all drawing + pointer math stays in CSS px.** Scale pointers by
   `W / rect.width`, never by `canvas.width` (the backing store is dpr-scaled).
6. **Reserve `KIT.layout.hudTop()` px of top headroom** for the `.gamekit-hud` (92 narrow / 48
   desktop) — never hardcode the numbers. `topReserve` in the layout test must be ≥ `hudTop()`.
7. **`update()` must be drivable via `__test.step(n)`, never assume rAF.** Headless, rAF is a no-op;
   `KIT.loop` never ticks and tests call `update()` themselves. Keep updates deterministic (seeded
   RNG in asserted paths).
