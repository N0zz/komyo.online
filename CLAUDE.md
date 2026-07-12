# CLAUDE.md — komyo

Guidance for working in this repo. Read before editing.

**When the user asks "wdyt" (what do you think): TALK, don't build.** Give your take, trade-offs
and a recommendation, then STOP and discuss — do NOT implement until an explicit go-ahead.

Game design knobs we honor (per-genre, distilled from external playbooks): @game-design-knobs.md

## What this is

**komyo** — a small catalogue of **self-contained** browser games. Live at
**https://komyo.online** (GitHub Pages, repo `N0zz/komyo.online`, cloned at `~/arcade`).
`index.html` is the catalogue; each game is one folder under `games/`. No build step.

**Planning & tracking lives in the repo — update it, don't invent new trackers or memory files.**
`ROADMAP.md` (repo root) is the living roadmap (Done / Path to launch / near-term / games queue /
marketing). `plans/*-plan.md` are the per-initiative execution plans with `- [ ]` step checkboxes
(e.g. `plans/i18n-plan.md`). When the user gives a roadmap/plan update, fold it into these files.

## Layout

```text
index.html      catalogue (renders tiles from games.js) + drawers/modals (profile, settings, challenges…)
games.js        catalogue manifest — window.GAMES = [{slug,title,blurb,icon,accent,tags,soon?,added?,updated?,mp?,players?,badges?}]
challenges.js   window.CHALLENGES — daily/weekly goals + per-game goodRun bars + the titles ladder
i18n.js         i18n LOADER + the en (def-source) dict; each other locale is its own i18n.<code>.js —
                the loader sync-loads the ACTIVE language (document.write, atomic head) and lazy-loads
                the rest after load. A new locale = its file + KOMYO_I18N_AVAILABLE + the root sw.js SHELL.
cosmetics.js    window.COSMETICS — the cosmetics registry (skins per game + site-wide cursors, painters,
                prices in 🏆 trophies); loaded like challenges.js (catalogue AND games, in the SW SHELL)
changelog.js    window.CHANGELOG — player-facing releases (drives the 🗒️ modal + the Discord post)
analytics.js    GA4 loader, consent-gated (see "Analytics")
version.js      build stamp {sha, built} — 'dev' locally, stamped by the Pages deploy workflow
game-kit.js     SHARED game shell — see "Shared kit" (nav, menus, sound, loop, layout, best store, PWA)
game-kit.css    shared shell styles (nav/menus/HUD/share row)
qr.js           REUSABLE QR encoder (no deps) — window.KOMYO_QR.encode(text)→{size,modules} | null
                (byte mode, EC-M, versions 1–6). LAZY-loaded by game-kit on score-card render (not in
                the atomic head); cached in the root sw.js SHELL for offline. Use for any future QR need.
sw-core.js      service-worker engine — the ONE root sw.js sets SCOPE/VERSION/SHELL and imports it
plans/          PUBLIC design docs & mocks (komyo.online/plans/<name>.html — transparency by intent);
                new plans/designs go here (not ~/), and get sitemap.xml (priority 0.2) + llms.txt entries
test.mjs        top-level suite: catalogue + Keep Defender + live-games boot + game-kit test
test-harness.mjs  the ONE shared headless harness (sandbox/bootGame/runLayoutSuite) all suites import
scripts/        post-changelog.mjs (Discord changelog action) + gen-icon.mjs (icon generation) + bench.sh
sw.js           the ONE site-wide service worker (root scope) — SHELL covers the catalogue, the shared
                head files, every locale AND every live game (slug list in games.js order, test-enforced)
manifest.json favicon.svg og-image.png logo-*.png   CNAME .nojekyll .gitignore
games/<slug>/   each game: index.html (+ test.mjs, manifest.json, favicon.svg, icon-192/512.png)
```

## Game conventions (the rules that matter)

These are **hard contracts** — the test suites and the kit assume them; breaking one usually fails
silently, not loudly.

- **No external dependencies / assets.** No build, no CDNs/fonts/images — visuals are canvas
  vector + system fonts + emoji-as-text. Games DO load the **in-repo, same-origin** shared head
  files (see "Shared kit"); these ship with the site and are cached offline (the root `sw.js`
  SHELL), so they're not external "dependencies." All game-specific logic stays inline in the one
  `index.html`.
- **The slug is the ONE identity:** folder name = `games.js` slug = `nav({slug})` = the
  `record`/`share`/`saveBest` slug = the `CHALLENGES.goodRun` key. A mismatch breaks silently
  (wrong URLs, orphaned storage keys, dead challenges, a reset that wipes another game).
- **One inline `<script>` (IIFE) before `</body>`** that sets `window.__test`.
- **`window.__test` hook** — getters for state + a `step(n)` that drives the core `update()`
  **directly** (never relies on `requestAnimationFrame`, a no-op in tests), deterministic
  (support a seeded RNG where the game rolls `Math.random` in asserted paths), plus a read-only
  `layout` getter (JS-computed bounds in canvas px, incl. `topReserve`). Harmless in normal play.
- **Headless-safe:** guard `AudioContext` (lazy, inert if absent), `navigator.vibrate`,
  `matchMedia`. Must boot in a mocked DOM without throwing. (`ctx.roundRect` is safe everywhere —
  the kit installs the polyfill.)
- **Shell comes from game-kit** (see "Shared kit"): nav, pause, sound menu, ☰ game menu,
  challenges, controls, menus, share row and PWA registration are all `gamekit.*` calls — do NOT
  re-implement them per game. Score/best HUD lives in a **`.gamekit-hud`** container; reserve
  **`gamekit.layout.hudTop()`** px of top headroom (92 narrow / 48 desktop — never re-derive the
  numbers per game).
- **Three screens, all `gamekit.menu`:** (1) START — mode/options via menu `groups`/`toggles`
  with a clear selected state; (2) GAME; (3) END — `menu.show({kind:'end', record, share, …})`
  with score + best + "Play again" + the kit share row. **`record:` in the end menu is the ONLY
  way results are recorded** — never call `gamekit.recordResult` directly (the menu path is
  idempotent per run; an imperative call double-counts).
- **Best scores:** the kit best store only — `gamekit.saveBest(slug, modeLabel, {score})` /
  `gamekit.bestScore(slug, modeLabel)`, no per-game best keys. Compute `isBest` BEFORE the single
  end-of-run save (mid-run saves make "★ New best!" never fire), aim-trainer's `endGame` is the
  reference.
- **Storage discipline.** localStorage is **~5 MB for the whole ORIGIN** — the kit + every game share
  one pool, so a single leaking game can throw `QuotaExceededError` and break saves site-wide. The kit
  stores (`saveBest`/cosmetics/challenges) are already bounded; anything a game persists beyond them
  must: cap every list (no unbounded histories/logs/replays), write on events with a debounce (never
  per-frame/per-tick), stay within **~≤10 KB per arcade game** (~≤100 KB for a progress-save game),
  and carry a versioned schema (`{v:1,…}`) from day one. Watch storage growth while developing.
- **Main loop = `gamekit.loop(update, render, opts)`** — the kit's fixed-timestep accumulator
  (60 Hz steps at any refresh rate, kit-pause built in). Never `rAF → update()` directly — that
  ships a frame-rate-dependent game. `update()` must stay drivable via `__test.step(n)`.
  (Grandfathered exceptions with their own equivalent fixed-step + isPaused accumulators:
  breakout, snake, asteroids, asteroids-plus. New games use the kit loop.)
- **Canvas sizing = `gamekit.fitCanvas(canvas, W, H)`** in the game's resize path, re-run via
  `gamekit.layout.on(…)` — the game computes its CSS size, the kit applies the retina backing
  store; ALL drawing + pointer math stays in CSS px (scale pointers by `W / rect.width`, never
  `canvas.width`). Scaled-world games (asteroids, asteroids-plus) keep their own sizing.
- **SFX:** `SND.define({…})` must never reuse a kit-owned stinger name (`levelup`, `lose`, …) —
  the kit plays those itself, so an override self-recurses into silence.
- **Game-over restart accepts tap AND key;** touch aim maps to canvas coords, not client coords.
- **If a game renders its OWN mouse cursor** (e.g. aim-trainer's crosshair), set `cursor:none` on that
  element **and** `data-gk-hide-cursor` on it — the kit's site cursor skins (incl. the blinking terminal
  follower) then hide there instead of doubling up over the game's cursor.
- **Each game is its own installable PWA** via its `manifest.json` + `icon-192/512.png` (distinct
  color-emoji icon) + apple/theme meta in `<head>` — but offline/updates come from the ONE root-scope
  `sw.js` (its SHELL lists the game's files + the slug in `GAME_SLUGS`; a root SW controlling
  `/games/<slug>/` satisfies installability). No per-game `sw.js` — games call
  `gamekit.pwa('../../sw.js')`.
- **Distinct visual theme per game.** (asteroids=space, keep-defender=castle/parchment,
  bubbles=candy/aqua, snake=neon, breakout=synthwave, flappy=meadow, stacker=pastel, range=tactical.)
- **Responsive:** size the playfield from the viewport (don't hardcode px) so it fits narrow /
  zoomed screens — see the Bubble Pop fit fix.

## Shared kit (`game-kit.js` + `game-kit.css` + `sw-core.js`)

**The `<head>` unit is atomic** (NOT `defer`, so `window.gamekit` exists before the inline script),
in this order: `analytics.js` · `game-kit.css` · `version.js` · `game-kit.js` · `challenges.js` ·
`cosmetics.js` · `games.js` (the kit profile modal reads `window.GAMES` for titles/icons) ·
`i18n.js` (the loader — it document.writes the active `i18n.<code>.js` so `t()`
is complete before the inline script; the other locales lazy-load after `load`).
The root `sw.js` SHELL lists the SAME shared files in lockstep — PLUS every `i18n.<code>.js` locale
file and every live game's files — a missing one silently kills that feature offline (test-enforced).
Games alias the API once: `const KIT = window.gamekit;`.

- `gamekit.nav({ slug, music, home, theme, onMenu, onPause, confirmLeave, controls, genres })` —
  the whole top chrome: left `‹ Menu · komyo ›` bar + right cluster (⏸ pause, 🔊 sound menu with
  SFX/♪ Music sliders, 🎮 controls when `controls` given, ⛶ fullscreen, and the **☰ game menu** —
  version + an Update button that IS the status, "⧉ Embed this game", "↺ Reset game data").
  `nav()` also mounts the **kit-owned side stack** (`gamekit.sideStack`) — the SAME right-edge
  Profile / 🏆 Challenges / 🎨 Collection drawer as the catalogue (identical DOM/CSS/behavior +
  the full profile & titles modals, all kit-owned; `index.html` mounts the same component via
  `gamekit.sideStack({})`). In games it's visible at all times: on menu screens the measured
  gutter (vs the open menu box) picks the default like on the home page; when a run starts it
  auto-tucks behind the ‹‹ tab, and re-opening it mid-run counts as an open overlay → the game
  pauses until it's tucked again.
  **`slug` derives the localStorage reset prefix (`slug + '_'`) and the challenges key** — don't
  pass `reset:`/`challenges:` (explicit overrides exist but shouldn't be needed). `onMenu`
  overrides the Menu button's default reload (asteroids: drop `?v`, reshow the picker);
  `confirmLeave: true|msg|fn` guards mid-run exits (pauses under the confirm); `onPause` wires ⏸.
- `gamekit.menu` — the declarative three-screen framework: `menu.show(cfg)` / `menu.hide()`.
  cfg: `kind:'start'|'pause'|'end'`, `title`, `score/scoreText/best/newBest/lines`, `groups`
  (option rows — a plain button-row group takes `disabled:(state)=>bool` to gray out + block the
  whole row in modes where it's moot, e.g. difficulty under zen; `style:'cards'` = rich mode cards with a canvas `preview(ctx,w,h,state)`;
  `style:'shop'` = an action grid for buy/pick — powers the Asteroids+ level-up picker + shop;
  shop opts: `icon:` painter per choice, `cols:3` fixed picker shape, `pickLabel:` → the
  small-screen BUY/TAKE button; on touch the first tap selects (desc shows in a focused-desc
  line), the second tap or that button buys — mouse hover+click buys in one go),
  `toggles`, `hint(state)`, `banner(state)`, `actions:[{id,label,primary?,danger?,confirm?}]`,
  **`kid: true` on a group's gentlest choice / `kid: true|false` on a toggle (= easiest state)** —
  powers **🐣 Easy picks** (catalogue Settings, `gamekit.easyPicks()`): marks those with 🐣, makes
  them the menu defaults, and sorts KIDS-tagged tiles first at home. Every difficulty-bearing
  group/toggle in every game carries the flag (cosmetic groups don't),
  `onPlay/onAction/onChange/onEsc`, `theme` (`--gkm-*` vars), `backdrop` (animated canvas), and
  `share:{slug,accent,icon,title,message,params}` (share row + score card + Discord) +
  **`record:{slug,mode,score,time?,stats?}`** — the kit records it exactly once per run
  (idempotent across menu re-shows). Speedrun/sprint records render as TIME from `record.time`.
- `gamekit.sound` — **SFX** channel (`gamekit_sfx_muted`/`_vol`): `SND.define({ name:
  ({tone,noise,voice,noiseHit,seq,now,play}) => {…} })`, `SND.play('name')` (no-op when
  muted/headless). Never define a kit-owned stinger name (`levelup`, `lose`, …).
- `gamekit.music` — **Music** channel: the kit's procedural engine (`gamekit.music.play('track')`),
  plus `subscribe(s => applyGain(s.gain))` for a game with its own engine (asteroids).
- `gamekit.loop(update, render, {mult?, frame?})` — THE main loop: fixed-timestep accumulator
  (1000/60 ms steps at any refresh rate), kit-pause built in (paused → render only), 100 ms stall
  clamp. `mult()` scales game-time (a 2× toggle = exactly 2×); `frame()` runs once per display
  frame (input polling). Headless it never ticks — tests drive `__test.step(n)`.
  **`gamekit.loopAlpha()`** = the accumulator's 0..1 phase into the next step at render time —
  offset constant-velocity movers by `perStepVelocity * alpha` in render for hitch-free scrolling
  at any refresh rate (fixed steps alone judder on 0-/2-step frames; flappy is the reference).
- `gamekit.layout` — `w/h/portrait/landscape/narrow` getters, **`hudTop()`** (the ONE HUD headroom
  number: 92 narrow / 48 otherwise; narrow = portrait or ≤560px wide), `on(cb)` (coalesced
  relayout on resize/orientationchange/visualViewport), `requireOrientation('portrait'|'landscape')`
  (rotate overlay), and the test hook `__emit(w,h)`.
- `gamekit.fitCanvas(canvas, w, h, opts?)` — sets the CSS box + a devicePixelRatio-scaled backing
  store (cap 2, `opts.maxDpr` overrides; headless → 1) + the matching transform, so drawing stays
  in CSS px. Call from the game's resize path. `{dpr:false}` opts out (scaled-world canvases).
- `gamekit.roundRect(g, x, y, w, h, r)` — beginPath + rounded-rect path (caller fills/strokes);
  the kit also installs the `ctx.roundRect` polyfill (array radii supported) so bare calls are
  always safe.
- **Best store (the single source of truth, `gamekit_pb`):** `gamekit.saveBest(slug, modeLabel,
  {score,time?,stats?})`, `gamekit.bestScore(slug, modeLabel)`, `gamekit.best(...)` →
  `{score,time,plays,stats}`; `gamekit_stats` holds lifetime rollups. `modeLabel` is the human
  label the profile shows ("Classic", "Marsh · Hard"). `gamekit.recordResult` exists internally —
  games use the end menu's `record:`, never call it.
- **Challenges (kit-owned logic, data in `challenges.js`):** `gamekit.challengeEval` (the ONE
  evaluator — the catalogue routes through it), `gamekit.challengePick(kind[,day])` (the ONE hashed
  same-for-everyone daily/weekly pick — drawer, in-game panel and tile badges all route through it,
  never re-derive it), `gamekit.activeChallenge(slug)` (drives the 🏆 glow),
  `gamekit.challengesPanel(opts)` (the in-game 🏆 modal). `window.CHALLENGES` carries goals +
  daily/weekly rotations, **`goodRun` per-game bars (every live game needs one or it silently never
  earns good runs)**, the `titles` ladder, `randomSlug`, and **`playable` + `playableSince`** (the
  canonical random-pick pool, mirrored from games.js — test-enforced; a new live game adds its slug
  IN games.js ORDER + its **public go-live (push) date** — never a local build date. The kit admits
  a game's goals/random slot only from the period AFTER `playableSince` (strict `<`), so a mid-day
  push never re-rolls a daily/weekly pick players already saw).
- **Cosmetics / trophies (kit-owned, data in `cosmetics.js`):** challenge points are **trophies 🏆**
  everywhere player-facing. TWO metrics: **lifetime** (Σ `gamekit_done`, drives titles) and the
  **spendable balance** (lifetime − Σ owned costs, derived not stored). `gamekit.cosmetics` →
  `lifetime()/balance()/owned(id)/buy(id)/selected(set)/select(set,id)/progress(game?)`; buying/selecting
  live in `gamekit_owned` + `gamekit_cos_sel` (per-device, in Export/Import). `gamekit.shopPanel(opts)`
  is the store modal (opts: `game` = scope to one game + site-wide cursors; `allGames`, `onTitles`,
  `theme`); the side stack's **🎨 Collection button** opens it scoped to the current game. Games apply the selected skin in their own render (`const id =
  KIT.cosmetics.selected('<game>.<set>')`) — do NOT add per-game STYLE grids to the start menu (the 🎨
  modal owns selection/buying). **Good-run trophy trickle:** +5 🏆 per good run, capped 3/day
  (`gamekit.goodRunBonus()` → `{count,cap,per}`; one `gr#YYYY-MM-DD` entry in `gamekit_done`); the end
  menu's "✓ Good run" line is the receipt. **Titles are worn, not just earned:** the ladder's unlocked
  ranks are tap-to-equip (`gamekit_title_sel`); a new higher tier auto-switches (`gamekit_title_adopted`).
- `gamekit.shareRow(el, { slug, title, message })` — **score-card-first**: renders the neon score
  card inline + ONE **Share** button that opens the image menu (native share attaches the card image
  **+** the link/text together, plus Copy image / Download). No X/Reddit/copy-link buttons — a link
  web-intent can't carry the card, and mobile's native sheet already lists every app. `message` is a
  fn → a standalone sentence (no url), evaluated at click time; `gamekit.scoreCard/profileCard/
  shareCard` render + share the neon card images (the score card embeds a themed **scan-to-play QR**
  of the share URL via `qr.js`); the Discord auto-post is consent-tiered
  (`gamekit.discordTier()`: no consent → nothing, consent → anonymous, Settings toggle → named).
  (The catalogue's own site share is a single adaptive button — native sheet on mobile, copy-link on
  desktop — not this row.)
- `gamekit.pwa()` — registers the ONE root-scope SW (catalogue passes `'sw.js'`, games
  `'../../sw.js'`) + the ONE update policy: a new build **never auto-reloads the visible page** — it
  lights a dot on ☰ (and the catalogue's Settings "Update now") and the player applies it via the ☰
  Update button (`gamekit.updates.apply()`). The only reloads are that explicit apply and a
  **backgrounded tab** (invisible, non-disruptive). (The old pre-interaction "launch fast-path" silent
  reload was removed — it raced the tap-to-play splash and forced a second tap.) Hand-overs are told
  apart from real updates by the worker **script URL**, never by timing; `pwa()` also sweeps out
  legacy per-game scope registrations (pre single-SW migration).
- `gamekit.updates` — `check()` (fresh `version.js` vs the running build), `apply()` (update the
  root SW — covers the whole site — + reload), `state()`/`onChange(cb)`; `gamekit.buildInfo()` → `{sha, built, when, label}`
  (label = `sha · local deploy date+time`, shown by `versionTag()`, the ☰ panel and the catalogue
  footer/Settings).
- Misc: `gamekit.isPaused()/setPaused/togglePause` (any kit overlay counts as paused — the loop
  freezes under modals), `gamekit.showMenuButton/showPauseButton(bool)`, `gamekit.confirm(msg,
  onYes, yesLabel)`, `gamekit.resetScores(prefix)`, `gamekit.stampUrl(params)`/`param(name)`
  (deep-link state), `gamekit.player()/setName()`, `gamekit.shareUrls/shareText`,
  `gamekit.embedModal`, `gamekit.versionTag()`.
- **`.gamekit-hud`** (CSS) — the standard **center-top** HUD (translucent pill, wraps; clears the
  left nav and the right cluster). Games put score/best items in a `.gamekit-hud` container and
  reserve `gamekit.layout.hudTop()` px of top headroom in their layout.

The kit is fully headless-safe (every browser API guarded). **Asteroids is on the kit too** — a
single-engine game (no launcher/iframe); the roguelite lives separately in `games/asteroids-plus/`.

## Adding / changing a game

**Development process (the minimum bar — a single-prompt game is almost never good enough):**

1. **Design + mock** — discuss the concept, mechanics, and a rough layout *before* coding.
2. **POC** — build the core mechanic only; confirm it actually works / is fun. If it isn't, stop here.
3. **MVP** — add the first real feature and *play it for a while* to feel it.
4. **2–3 iterations** — each adds a feature and fixes the bugs the playthrough surfaced.

Don't ship a game straight from one prompt; treat the above as the floor for every new game.

### Build steps

1. `games/<slug>/index.html` — the atomic `<head>` unit (see "Shared kit"); shell = `gamekit.nav
   ({slug, …})` + `gamekit.menu` (start/pause/end screens with `record:` + `share:`) +
   `gamekit.loop` + `gamekit.fitCanvas` + `gamekit.pwa()`; game logic inline with the `__test`
   hook (incl. the `layout` getter). Reference: `games/breakout/index.html`.
2. `games/<slug>/test.mjs` — import the shared harness (`../../test-harness.mjs`):
   `bootGame('games/<slug>/index.html', opts)` (kit preloaded automatically) + game-specific
   asserts driven via `__test`, a `runLayoutSuite` section, and `summary()` at the end.
   Reference: `games/breakout/test.mjs`.
3. Icon: `node scripts/gen-icon.mjs <emoji> <background-css> games/<slug>` (Chrome headless 512 →
   `sips` 192).
4. `manifest.json` (per-game, for installability) + register the game in the ROOT `sw.js`: add the
   slug to `GAME_SLUGS` (games.js order — its HTML/manifest/icons precache from there; test-enforced).
   No per-game `sw.js`; the game's inline script calls `gamekit.pwa('../../sw.js')`.
5. Add the game's **`CHALLENGES.goodRun` bar** (and, when it goes live, goal entries) in
   `challenges.js` — without the bar it never earns good runs.
5b. **Cosmetics (optional but expected):** add the game's sets/items to `cosmetics.js`
   (`<slug>.<set>.<key>`, free default at price 0, prices in the 🏆 bands), load `cosmetics.js` in the
   `<head>` (see the atomic head order), and read the selected skin in the game's render
   (`KIT.cosmetics.selected('<slug>.<set>')`). The 🎨 button + store modal are automatic (kit-owned).
6. Add an entry to `games.js` (`soon: true` = greyed "coming soon" tile). Set **`added: "YYYY-MM-DD"`**
   on a new game (drives the auto **NEW** badge for 7 days). **Whenever you ship a notable update to a
   game (new mode/feature — not every bugfix), bump that game's `updated: "YYYY-MM-DD"`** (drives the
   **UPDATED** badge for 7 days). Keep these dates accurate — they're the only source for those badges.
   Also **add a `CHANGELOG` bullet** in `changelog.js` for the change (see Catalogue specifics).
   When a game goes **live** (not `soon`), add its `https://komyo.online/games/<slug>/` URL to
   both `sitemap.xml` and `llms.txt`, AND to the homepage's two crawler surfaces in `index.html`
   (LLM fetchers / no-JS crawlers never see the JS-rendered tiles): the static `nojs-games` link
   list inside `#grid` and the `ItemList` JSON-LD in `<head>` — both lockstep with games.js live
   games, test-enforced (`testSEO`). `robots.txt` allows all crawlers (search + AI/LLM) and points
   at the sitemap; `llms.txt` is a curated markdown map of the site for LLMs. **Any new standalone
   page** (e.g. `tos.html`, `privacy.html`, a future about/guide page) also goes in `sitemap.xml`
   (low `<priority>` ~0.3) and, if useful to LLMs, in `llms.txt` — not just games.
7. Run **all** the suites and keep them green.

## Testing

- **All suites run through the shared `test-harness.mjs`** (repo root) — the ONE sandbox
  (DOM/canvas/localStorage mocks, controllable rAF queue + `performance.now` clock, seeded-RNG
  option), one reporter, one inline-script extractor. Suites import
  `{ bootGame, ok, section, summary, runLayoutSuite }` and keep only game-specific asserts.
- `node test.mjs` — top-level: catalogue + Keep Defender + boots every live game + a **game-kit**
  test section. `node games/<slug>/test.mjs` — each game's own suite (incl. asteroids).
- **i18n coverage is enforced** (an `test.mjs` section): the `pl` locale must contain EVERY referenced
  key (literal `t()`/`data-t` keys + each game's `game.<slug>.title`/`.blurb` + all `cos.*` name/desc),
  and every other locale must be **empty or carry EXACTLY `pl`'s key set** (no half-translated
  locale, no stale leftover keys);
  plural keys must exist in `en`. So adding a player-facing string without its Polish translation FAILS
  the suite — that's how "shipped English-only by accident" is caught. `en` is exempt (the `def:` source).
- `bootGame(file, opts)` preloads the real `game-kit.js` automatically (mirrors the `<head>` load
  order), accepts `{w, h, store, seed, search, preCode}`, and returns the drive handle
  (`T()`/`test()`, `resize(w,h)` via `gamekit.layout.__emit`, `key/down/up`, `step(n)` for
  rAF-driven engines, `fireRaf(t)`, `store`, `errors`). Its extractor grabs the **last
  attribute-less `<script>` before `</body>`** (greedy), so `<script src=...>` in `<head>` and any
  earlier bare `<script>` can't confuse it.
- **Determinism:** pass `{seed}` wherever the game rolls `Math.random` in asserts' path
  (asteroids, asteroids-plus, tower-defense do) — unseeded suites flake.
- No browser automation here — the harness is the regression net. Always run after changes.
- **Layout/overlap tests (standard for every live game).** Each game exposes a read-only
  `__test.layout` getter returning JS-computed bounds in canvas px (`W`, `H`, a `topReserve` for the
  `.gamekit-hud` headroom, and the key drawn elements' rects). The suite calls
  `runLayoutSuite(makeGame, check)` — it sweeps **portrait (390×780) / landscape (780×390) /
  desktop (1280×800)** and asserts the shared invariants itself (layout getter present, canvas
  matches the viewport, **`topReserve` ≥ the kit's `hudTop()`** — the headless stand-in for "the
  score box doesn't sit under the nav"); game-specific bounds go in the `check` callback (pass
  `{size:false}` for scaled-world canvases like asteroids). Don't fabricate coords for
  DOM/CSS-positioned HUD elements (only JS-computed layouts can be measured headlessly).
  Reference: `games/breakout/test.mjs`.

## Local preview (test in a browser before pushing)

The headless suites can't catch visuals, layout, or touch UX. For anything player-facing, serve
the site locally and eyeball it **before** committing/pushing — the site is static, but service
workers, the manifest, and `analytics.js` need a real HTTP origin (they don't work over `file://`).

```bash
cd ~/arcade && python3 -m http.server 8765    # then open http://localhost:8765/
```

- Catalogue: `http://localhost:8765/` · a game: `http://localhost:8765/games/<slug>/`.
- After a redeploy/edit, **hard-refresh** (service workers cache aggressively) or the old build shows.
- Mobile/touch UX (joysticks, the snake D-pad, rotation): use the browser's device-mode (coarse
  pointer) — touch-only controls don't render on a desktop pointer.
- **The eyeball pass is THREE viewports, never two: desktop, portrait (~390×780), and landscape
  (~780×390).** This applies to EVERY player-facing change — kit chrome, modals/drawers, menus, new
  buttons or text, not just games. Landscape (short-height) is where overlays overflow, fixed-size
  controls dominate, and rails starve — it's exactly the pass that gets skipped when a change
  "works on desktop and portrait" (2026-07-12: shop rail, side stack and the minesweeper pill all
  shipped broken in landscape this way). The headless suites only cover JS-computed game layouts;
  kit DOM/CSS has NO automated geometry check, so this manual pass is the only landscape gate.
- Stop the server when done: `lsof -ti:8765 | xargs kill`.

When the change is visual/interactive, offer the user this local URL to verify before pushing —
and name landscape explicitly in what to check.

## Git & deploy

- **Per-game commits** for clean history. End commit messages with a
  `Co-Authored-By:` line for the Claude model that authored them (no pinned model name here).
- **Batch pushes.** GitHub Pages soft-limits builds (~10/hr) and every push triggers a build +
  Action run, so commit per topic locally but **push several commits together**, not after each one.
- Hosting: **GitHub Pages from `main`** (built-in Fastly CDN — no Cloudflare). Custom domain
  `komyo.online` via the root `CNAME` file + **OVH DNS** (4 GitHub A records on the apex) + Enforce HTTPS.
  Don't delete `CNAME` (Pages would reset the domain). Edge cache can serve stale for ~minutes
  after deploy → version changed assets (e.g. `og-image.png?v=2`).

## Catalogue specifics

- **GA4** (`G-S4JQPYNDNM`) is **consent-gated**: `analytics.js` loads gtag only after the cookie
  banner's *Accept* (stored in `localStorage.gamekit_consent`, shared across the origin so per-game
  pages track too). Footer tag: **"built for fun · free forever · no ads · no accounts · kid-safe ·
  every game works offline"** (the key-strengths one-liner — keep it in sync with reality).
  **Shared links carry UTM tags** for attribution (`gamekit.withUtm(url, source, medium)`, source
  `sc`=scorecard): native/copy share = `medium=share`, Discord auto-post = `medium=discord`, catalogue
  Share button = `utm_source=catalogue&utm_medium=share`. The **score-card QR** is special: it drops
  the mode/diff deep-link (QR = `?utm_source=sc&utm_medium=qr`, links to the game only) so the URL is
  SHORT — fewer QR modules = bigger modules = scannable when printed small (a v6 dense QR at ~15–18mm
  didn't scan; dropping to v5 + the code filling its footprint fixed it). The shareable/copy link
  still keeps mode/diff. A QR scan has no referrer, so without UTM it'd read as "direct".
- **OG/Twitter** meta + `og-image.png` (1200×675, a 16:9 page screenshot). Regenerate it on
  rebrands and bump `?v=` so scrapers refetch; re-scrape via the FB Sharing Debugger.
- **Newsletter:** Kit. The inline Subscribe modal POSTs to Kit form **9615603**; sending domain
  `komyo.online` is DKIM/DMARC-verified (records in OVH), default from `news@komyo.online`.
- **Catalogue layout (2026-07-05 rework):** tiles render from `games.js` into ordered sections —
  **Favorites** (drag & drop reorder, always on) → **Recently played** (the "continue playing"
  carousel from `gamekit.recentlyPlayed`) → **All games** (single + multiplayer merged) →
  **Coming soon** (`soon: true`, greyed) — split by centered horizontal dividers. MP tiles
  (`mp: true`) show a `players` pill (👥 2P / 2–4P) and keep their genre tag. **Badges** (shimmer+sparkle marks, top-left, stackable
  vertically) come from the `BADGES` map in `index.html`: **NEW** (gold) and **UPDATED** (blue) are
  auto-applied from a game's `added` / `updated` date in `games.js` (within 7 days; NEW wins over
  UPDATED); **POPULAR** (purple, `badges: ["pick"]`) is manual. Add a type = one map entry + a color
  rule. Header carries a **mascot placeholder**
  (chibi fox-girl inline SVG — swap for real art later).
- **Changelog:** the `window.CHANGELOG` array in **`changelog.js`** (newest first, loaded as a
  `<script src>` and cached in the SW shell) drives the 🗒️ Changelog modal (opened from the ☰ menu;
  releases split by `<hr>`, lazy-loaded, searchable incl. by date) **and** the Discord changelog post.
  Each entry is one **release per topic/push**:
  `{ date: 'YYYY-MM-DD', title: '…', items: ['New: …', 'Fix: …', 'Added …'] }`. **One entry per push** —
  when you ship a batch of player-facing changes, **prepend a new entry** for it (multiple entries may
  share a date; that's fine and expected). Do NOT retro-edit an already-shipped entry to tack on new
  bullets — the Discord poster diffs against the push base, so editing an old entry mis-posts it; a
  fresh entry posts cleanly. Keep bullets plain-language and about what a *player* notices (a new game,
  a bug they'd hit, a mode/feature) — **never** internal/kit/test/build/refactor work. Write it for
  players, not as a commit log. **Discord:** a push that edits `changelog.js` triggers `.github/
  workflows/discord-changelog.yml` → `post-changelog.mjs`, which posts **only the entries added in that
  push** (diff vs the push base), so Discord mirrors this file exactly. Non-changelog pushes post nothing.
- Monetization is optional only: **Buy Me a Coffee** (footer) + GitHub Sponsors (README badge
  only — the footer Sponsor link was removed; footer = coffee + a GitHub-icon repo link).

## Asteroids (single engine — handle with care, but in scope)

`games/asteroids/` is **Classic Asteroids** — one `index.html` engine, Classic + Classic-Enhanced
behind the `ENHANCED` flag (mode chosen by `?v=classic` / `?v=enh`; an **in-page picker** shows with
no `?v`). No launcher, no `levels/`, no codegen. The **roguelite** Asteroids is the separate
`games/asteroids-plus/` game. Both follow the standard **menu → game → scoreboard + share** schema.
Read `games/asteroids/CLAUDE.md` first; keep both suites green (`node games/asteroids/test.mjs` and
`node games/asteroids-plus/test.mjs`).
