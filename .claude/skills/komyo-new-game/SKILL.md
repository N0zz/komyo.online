---
name: komyo-new-game
description: >-
  Create a new browser game for the komyo arcade (repo at ~/arcade) from a game
  concept. Use this WHENEVER the user wants to add, build, prototype, or design a
  new komyo game — even if they only describe how it plays, looks, or feels and
  never mention "skill", "framework", "gamekit", or any files. It handles ALL the
  framework plumbing (menus, game loop, layout, storage, best scores, audio,
  challenges, cosmetics, pause, PWA, share cards, catalogue registration, tests)
  so the user only supplies the idea and playtests. Triggers on "add a game",
  "let's build a <genre> game", "new komyo game", "make a game where you…",
  "prototype a game about…", "port/remake/clone <game> to komyo", or any pitch
  for a game to put on the arcade.
---

# Create a komyo game

You turn a **game concept** (how it plays / looks / feels) into an on-framework
komyo game. The komyo framework already owns ~90% of any game — chrome, menus,
loop, layout, canvas sizing, storage, best scores, audio, challenges, cosmetics,
pause, PWA, share, updates are all `gamekit.*` calls. **Your job is the mechanic
plus filling a fixed skeleton and registering the game** — never re-implement
framework features per game.

Read `~/arcade/CLAUDE.md` and `~/arcade/game-design-knobs.md` before starting —
they are the source of truth; this skill operationalizes them.

## The one rule that makes this work: staged process, not one-shot

The repo's hard rule (CLAUDE.md): **never ship a game from a single prompt.** A
concept is the *input*; you run it through stages, playing the thing between them.
The concept triggers the skill — the *process* is what produces quality. Do not
dump a finished game and declare victory; end at a playable, tests-green MVP and
hand back a playtest loop.

Track the stages as todos and work them in order:

### 1 · Concept intake
Take the user's play/look/feel description. Ask **2–4 targeted questions only if
something essential is missing**: genre / core verb, win & lose conditions,
session length, visual theme + one accent color, control scheme (pointer / keys /
touch). Don't interrogate — a rich pitch may need nothing. Bias toward the genres
the repo does well; see `references/genres.md`.

### 2 · Design note
Before code: a short concept + a rough layout sketch (what's on screen, where the
HUD sits, the core loop in 2–3 sentences), **plus the scaling model** — fixed
logical world (default) vs viewport-is-the-world vs scaled world, per
`references/responsive.md` §1; if viewport-is-the-world, list every gameplay
distance (spawn, ranges, knockbacks) the design will need. For anything with a
novel mechanic, consider a quick mock at `~/arcade/plans/<slug>.html` (the repo
publishes plans). This is the CLAUDE.md "design + mock" gate.

### 3 · POC — the mechanic only
Build ONLY the core mechanic on a canvas: `update()` / `render()` / input, driven
by `gamekit.loop`. No menus, no registration yet. Serve locally
(`cd ~/arcade && python3 -m http.server 8765`) and gut-check it. **If it isn't
fun, stop and rework the concept** — this is the cheapest place to fail.

### 4 · MVP — wrap it in the kit shell
Run `node .claude/skills/komyo-new-game/scripts/scaffold.mjs <slug> "<title>"
"<icon>" "<accent>"` to stamp `games/<slug>/` from the templates. Then fill:
`gamekit.nav()`, the three `gamekit.menu` screens (start / pause / end, with the
`record:` and `share:` blocks), the `.gamekit-hud`, the best-store helpers, and
the `__test` hook incl. the `layout` getter. Follow `references/game-anatomy.md`
section by section. Add the first real feature.

### 5 · Iterate ×2–3
Each pass: add one feature and fix the bugs the previous playthrough surfaced.
Play it each time. This is where feel and tuning happen. **At least one pass in
browser device mode at 390×780 with a coarse pointer** (phone reach, rotation,
entities arriving "from nowhere") — see `references/responsive.md` §5.
**One iteration is the visual-quality pass** — the game ships at the bar in
`references/visual-quality.md` (one light direction, form shading, glossy eyes,
cached textured terrain, post grade, menu-backdrop parity), reviewed twice
screenshot-driven, unless its identity is deliberately flat/glow.

### 6 · Wire the feature systems
- **Challenges (mandatory):** add the game's `CHALLENGES.goodRun` bar — without it
  the game *silently never earns good runs*. Add two goal entries + their ids to
  the `daily` pool when it goes live. See `references/registration.md`.
- **Cosmetics (expected):** add ≥1 skin set to `cosmetics.js` (a free default at
  price 0), a `sets` label, and a `games` meta entry; read the selected skin in
  render via `KIT.cosmetics.selected('<slug>.<set>')`. Do NOT add a per-game style
  grid to the start menu — the 🎨 modal owns selection.
- **Audio:** `SND.define(...)` for SFX, `KIT.music.play('<theme>')` for ambience.
  See `references/audio.md`.
- **Icons:** `node scripts/gen-icon.mjs <emoji> '<background-css>' games/<slug>`
  (macOS + Chrome + `sips`; if unavailable, tell the user to generate the two PNGs
  manually).
- **PWA:** `gamekit.pwa()` (already in the template, outside the IIFE).

### 7 · Register the game
Edit the shared files (see `references/registration.md` for exact shapes):
`games.js` (entry with `added: "YYYY-MM-DD"`, no `soon:`), `sitemap.xml`,
`llms.txt`, prepend one player-facing `changelog.js` entry, and add the game's
keys (title/blurb, in-game strings, `cos.*`, `challenge.goal.*`) to
**`i18n.pl.js`** (the `pl` reference locale's own file — en defs are inline in
code as `def:`).

### 7b · Translate the new keys — hand off to komyo-i18n-translate
`pl` alone is not enough: the coverage test requires every OTHER populated
locale to stay a **complete superset of `pl`**, so the new keys must land in
each locale's own `i18n.<code>.js` file. **Discover the currently-configured
locales at runtime** — merge `i18n.js` + every root `i18n.<code>.js` (or use
`gamekit.langs()` / `KOMYO_I18N_AVAILABLE` in `i18n.js`) — never hardcode a
locale list:

```bash
cd ~/arcade && node -e "const fs=require('node:fs'),vm=require('node:vm');const sb={window:{}};sb.globalThis=sb;for(const f of ['i18n.js'].concat(fs.readdirSync('.').filter(f=>/^i18n\.[a-z]{2}\.js$/.test(f)).sort()))vm.runInNewContext(fs.readFileSync(f,'utf8'),sb,{filename:f});for(const[k,v]of Object.entries(sb.window.KOMYO_I18N))console.log(k,Object.keys(v).length)"
```

Every discovered non-`en` locale with keys is a required target. Run the
**komyo-i18n-translate** skill in its incremental mode ("add the new keys to
all existing complete locales") to translate them into each `i18n.<code>.js`.

### 8 · Verify + hand off
Run `node test.mjs` AND `node games/<slug>/test.mjs` — both green, including the
layout suite. Serve locally and give the user the preview URL
(`http://localhost:8765/games/<slug>/`). Then hand back the playtest loop: "play
it and tell me what to tune." **Do not claim it's finished** — fun is the human's
call.

## Contract checklist — verify ALL before hand-off

These break **silently** (wrong URLs, dead challenges, results not recorded, a
frame-rate-dependent game, a reset that wipes another game). The generated
`test.mjs` + `node test.mjs` are your proof. Confirm each:

- **Slug is ONE identity** — folder name = `games.js` slug = `nav({slug})` =
  best/record slug = `CHALLENGES.goodRun` key = `sw.js` `SCOPE`. Byte-identical.
- **Results recorded ONLY via the end menu's `record:` block** — never call
  `gamekit.recordResult` directly (it double-counts; the menu path is idempotent).
- **Compute `isBest` BEFORE the single end-of-run `saveBest`** — mid-run saves make
  "★ New best!" never fire.
- **`SND.define` never reuses a kit stinger name** (`levelup`, `lose`, `victory`,
  `newbest`, `gameover`) — the override self-recurses into silence.
- **All drawing in CSS px** after `gamekit.fitCanvas`; scale pointers by
  `W / rect.width` (never `canvas.width`). Reserve `gamekit.layout.hudTop()` px of
  top headroom; the `layout` getter's `topReserve` must be ≥ `hudTop()`.
- **Gameplay geometry scales with the viewport** (viewport-is-the-world games) —
  distances derive from `W`/`H` (never desktop-tuned px constants), entities never
  act while off-screen, spawns hug the screen edge, every displacement clamps into
  the field, and the model invariants are asserted in the `runLayoutSuite` check
  callback. See `references/responsive.md` §3–4 — Frog Bonk shipped all three of
  these bugs with the layout suite green.
- **Main loop is `gamekit.loop(update, render)`** — never `rAF → update()` directly.
  `update()` must be drivable by `__test.step(n)` and deterministic (seeded RNG in
  any path an assert checks).
- **`CHALLENGES.goodRun` bar exists** for the game.
- **Atomic `<head>` order** (analytics.js · game-kit.css · version.js · game-kit.js
  · challenges.js · cosmetics.js · i18n.js) AND the `sw.js` `SHELL` lists the same
  shared files in lockstep — plus every per-locale `i18n.<code>.js` file (copy the
  current set from `games/breakout/sw.js`; a missing one silently kills that
  language offline).
- **All player-facing strings go through `KIT.t(key, { def: 'English' })`** — no raw
  English literals in the UI (menus, share, controls, HUD labels). `game.<slug>.*` for
  game-specific, `game.common.*` for shared. See `references/i18n.md`.
- **New keys added for EVERY populated locale** (each in its own `i18n.<code>.js`; `pl`
  reference = `i18n.pl.js`) — the i18n-coverage test in `node test.mjs` REQUIRES `pl` to
  have every `game.<slug>.*` key (title/blurb + all UI strings) + `cos.*` for any skins,
  AND every other populated locale to be a complete superset of `pl`. English works via
  `def:` inline in code. Discover the current locale set at runtime (merged i18n files /
  `gamekit.langs()` / `KOMYO_I18N_AVAILABLE`, never hardcode it); translate the new keys
  via the **komyo-i18n-translate** skill (stage 7b).
- **Exactly one attribute-less `<script>`**, last before `</body>` (the test
  harness extracts it); `gamekit.pwa()` is called after the IIFE closes.
- **Headless-safe** — guard `AudioContext`, `navigator.vibrate`, `matchMedia`; the
  game must boot in the mocked DOM without throwing.
- **Ships at the visual-quality bar** (`references/visual-quality.md`) — cached
  textured terrain (tufts not hair-strokes), one light direction with cast shadows,
  form-shaded entities with glossy eyes, grade+vignette, menu backdrop at the same
  bar (~2× stronger vs the kit's menu overlay), deterministic `h01` texture, drawn
  board assets with emoji kept to the DOM UI. Flat/glow-identity games are exempt.

## Reference index — read the one the stage needs

- `references/gamekit-api.md` — the full `gamekit.*` API (signatures, mandatory vs
  optional, gotchas). The `menu.show(cfg)` section is the one you'll use most.
- `references/game-anatomy.md` — the `index.html` skeleton, section by section, with
  real snippets. Read at stage 4 (MVP).
- `references/testing.md` — `test.mjs` + the shared harness + `runLayoutSuite` + the
  `__test`/`layout` contract. Read at stages 4 and 8.
- `references/responsive.md` — fitting all devices: choosing the scaling model,
  scaling MODEL geometry (spawns, ranges, knockbacks) with the viewport, making it
  testable, phone-shaped playtesting. Read at stage 2 (design) and whenever the
  playfield is the window.
- `references/visual-quality.md` — the shipping visual bar: the seven requirements
  (light, shading, eyes, cached texture, post, menu parity, grounded pickups/FX),
  the hard performance/determinism rules, the two-round screenshot review, cost
  planning. Read at stage 5 (the visual pass) and before any look-dev mock.
- `references/registration.md` — every shared file a game touches (games.js,
  challenges.js, cosmetics.js, sw.js, manifest, icons, sitemap, llms, changelog),
  exact shapes + the ordered checklist. Read at stages 6–7.
- `references/audio.md` — SFX voice recipes + music theme keys.
- `references/genres.md` — genre → mechanic starter map + the repo's genre bias;
  points to `~/arcade/game-design-knobs.md`.
- `references/i18n.md` — string handling. **i18n is live: emit `KIT.t(key, {def})` for
  every player-facing string** (`def:` is the English source, so it works with no
  `i18n.js` edit). Read at stage 4 (MVP) so strings are keyed as you write them.

## Templates & scripts

- `assets/index.html.tmpl`, `test.mjs.tmpl`, `sw.js.tmpl`, `manifest.json.tmpl` —
  the contract-correct skeleton. `scripts/scaffold.mjs` stamps them into
  `games/<slug>/` with the slug/title/icon/accent filled.
- The reference game to imitate is `~/arcade/games/breakout/`. When in doubt, read
  it — it's the canonical implementation these templates come from.
