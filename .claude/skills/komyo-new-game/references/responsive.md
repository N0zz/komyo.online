# Fit every device — plan, manage and scale gameplay geometry

The layout suite + `fitCanvas` + `hudTop()` guard the **view** (canvas fits, HUD
clears the nav). Games still ship broken on phones when the **model** — spawn
positions, attack ranges, knockback distances — is tuned in desktop pixels.
This shipped for real (Frog Bonk, day one): a spawn ring sized by the screen
*diagonal* left frogs acting ~300px off-screen on a 390px-wide portrait phone;
fixed attack ranges (`castR + 340`) let enemies throw stones from outside the
view; unclamped knockback shoved frogs off the playfield. The layout tests were
green the whole time — they can't see model-space bugs unless you expose and
assert them.

**Core principle: the view scales automatically; the model only scales if you
derive it from the viewport and gate it on visibility.**

## 1 · Pick the scaling model in the design note (stage 2)

Decide this before the POC — retrofitting a model is the expensive path.

| Model | How | Games | When |
|---|---|---|---|
| **Fixed logical world** | Design in constant `W×H`; compute the CSS box from the viewport; `fitCanvas(canvas, W, H)` | breakout, stacker | **Default.** Gameplay geometry is byte-identical on every device — the whole bug class can't exist |
| **Viewport-is-the-world** | Playfield = window (`W = innerWidth` …) | frog-bonk, aim-trainer, keep-defender | Only when the design needs the whole screen as the field (whack-a-mole, aim trainer, tower defense). ALL rules in §3 apply |
| **Scaled world + camera** | World bigger than screen, own transform, `fitCanvas(..., {dpr:false})` | asteroids, asteroids-plus | Rare; read the asteroids CLAUDE.md first |

Write the choice into the design note. If viewport-is-the-world, list every
distance the game will use (spawn, ranges, knockbacks, speeds) — each one is a
per-device liability to plan for.

## 2 · Design targets

- **360×640 portrait is the design floor** — test the floor, not the typical
  (survive 360-wide and every phone above it survives too). Sanity-check 320px
  width — the absolute worst case.
- The full eyeball set is five viewports: desktop 1280×800 · 1920×1080 ·
  2560×1440, portrait 360×640, landscape 640×360. A viewport-is-the-world game
  must be *playable*, not merely rendered, at all of them. The headless
  `runLayoutSuite` sweeps the same five.
- Kit tools: `KIT.layout.narrow` (portrait or ≤560px), `hudTop()`,
  `requireOrientation('portrait'|'landscape')` (use it instead of designing for
  both when the mechanic only works in one), `KIT.layout.on(resize)`.
- Half-width matters more than width: on 360×640 with a centered playfield,
  anything beyond ~180px horizontally from center is **invisible**. Desktop
  tuning (≥640px from center visible) silently assumes >3× that.

## 3 · Rules for viewport-is-the-world games

- **Derive distances from the viewport, never absolute px.** Scale radii/ranges
  off `Math.min(W, H - topMargin)` (frog-bonk's `castR` does this) or clamp
  them to the visible extent. A constant tuned on desktop WILL land off-screen
  on a phone.
- **Off-screen is inert — gate acting on visibility, not on tuned radii.** Any
  entity that attacks, casts, telegraphs, or triggers player-visible
  consequences must first pass an on-screen predicate:
  ```js
  const onScr = e.x > e.r && e.x < W - e.r && e.y > topMargin + e.r * 0.5 && e.y < H - e.r;
  ```
  Off-screen entities may move/approach, nothing else. (This is also the fix
  when a range *must* stay big for balance — keep the range, add the gate.)
- **Spawn just past the nearest screen edge along the entry ray** — never on a
  circle sized by the diagonal (on tall screens its horizontal points are
  ~300px out):
  ```js
  const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
  const tx = dx > 0 ? (W - cx) / dx : dx < 0 ? -cx / dx : Infinity;
  const ty = dy > 0 ? (H - cy) / dy : dy < 0 ? -cy / dy : Infinity;
  const t = Math.min(tx, ty) + 60;                  // 60px past the edge
  spawn(cx + dx * t, cy + dy * t);
  ```
- **Clamp every displacement into the field** — knockback, dash, explosion
  push, wind, anything that moves an entity outside its own locomotion:
  ```js
  e.x = Math.min(W - e.r, Math.max(e.r, e.x));
  e.y = Math.min(H - e.r, Math.max(topMargin + e.r, e.y));
  ```
  And prefer an **animated hop over a teleport** for knockbacks — an instant
  jump yanks the entity out from under a mid-swing tap (whiff → lost combo).
- **Touch targets stay absolute; world geometry scales.** Fingers don't shrink
  with screens — keep tap forgiveness generous (`HIT_PAD ≈ 26`, effective
  target ≥ 40px) even as everything else scales down. Never derive hit pads
  from the viewport.
- **Re-feel desktop-tuned magnitudes at 390px.** A 60px knockback is 4% of a
  desktop width but 15% of a phone's — same constant, different game.

## 4 · Manage it — make model scaling testable

- **All geometry derives inside `resize()`** (re-run via `KIT.layout.on`) — no
  gameplay constant frozen at load time; size-dependent caches (bg canvas)
  invalidated there.
- **Expose the model geometry in the `__test.layout` getter** (spawn extent,
  key ranges, arena rects) — the layout suite can only assert what the getter
  returns.
- **Put model invariants in the `runLayoutSuite` check callback** — it already
  sweeps 360×640 / 640×360 / 1280×800 / 1920×1080 / 2560×1440; add per-viewport asserts beside the
  view ones. The frog-bonk regression section is the pattern to copy:
  - sample `spawnPos()` ~200×: every spawn within ~70px of a screen edge;
  - step the sim a few hundred steps: **no entity ever acts while off-screen**
    (sweep each step, assert the predicate);
  - drive a knockback at an edge entity: position stays in-bounds;
  - knockback is a phased hop (`ph === 'air'`), not an instant jump.
- Expose thin test injectors (`spawnPos`, `firePea(i)`-style) on `__test` so
  the asserts drive the REAL code paths, not reimplementations.

## 5 · Playtest phone-shaped before shipping (stages 3, 5 and 8)

Headless tests can't feel reach or readability — eyeball it:

- Run the **5-viewport Playwright-MCP pass** (desktop 1280×800 · 1920×1080 ·
  2560×1440, portrait 360×640, landscape 640×360): navigate → resize → screenshot
  → inspect each; for games, snapshot + click past the TAP TO PLAY splash and
  INSERT COIN first. Run the MCP `--headless` (headed shows a `--no-sandbox`
  infobar that pollutes shots).
- Plus a browser-device-mode pass at **360×640 with coarse pointer** (touch-only
  controls don't even render on a desktop pointer) and a rotation. Do this at the
  POC too — model-scaling problems are design problems, cheapest to catch before
  the MVP.
- Watch for the classic symptoms: things arriving "from nowhere" (off-screen
  actors), long invisible approaches, UI under the HUD, targets your thumb
  can't reach, effects that feel violent on a small field.
- If input feel matters, real device over LAN:
  `python3 -m http.server 8765` → `http://<mac-ip>:8765/games/<slug>/`.
