# Kit-owned layout contract

**Problem.** Each game computes its own play-area geometry and reserves. The kit owns only the top
chrome (nav + HUD pill) and hands games one number — `hudTop()`. Everything else (board rect, build
strips, control zones, secondary info bars) is each game's own guess. Overlaps happen at the seam
where the game's guess meets kit chrome, and every new game re-guesses — so it never converges.
Fixing games one by one is Sisyphean and gets worse as the catalogue grows.

**Goal.** The kit owns play-area geometry. A game declares an **archetype** and renders strictly
inside a kit-provided **safe rect**. Overlap becomes impossible by construction, and a headless test
enforces it so regressions (and new games) can't reintroduce it.

---

## 1. The contract (kit API)

Extend `gamekit.layout` (already exposes `w/h/portrait/landscape/narrow`, `hudTop()`, `on(cb)`,
`requireOrientation`, `__emit`).

### Reserved zones + safe rect

The kit tracks reserved bands on all four edges and derives the safe play area:

```
gamekit.layout.reserve(edge, px)      // edge: 'top'|'bottom'|'left'|'right'; kit clamps + coalesces
gamekit.layout.playRect()             // -> { x, y, w, h } in CSS px = viewport minus ALL reserves
gamekit.layout.boardRect(opts?)       // -> centered square/rect INSIDE playRect (for board games)
```

- `top` defaults to `hudTop()` (existing HUD headroom) — games no longer hardcode it.
- Games place their canvas/board using `playRect()` / `boardRect()`; they never read raw
  `innerWidth/Height` for gameplay bounds again.
- `layout.on(cb)` already coalesces relayout; `playRect()` recomputes there.

### Archetype declaration

Declared once via `nav()` (or `gamekit.layout.archetype(name, opts)`), which sets the standard
reserves + which kit containers mount:

| Archetype     | Reserves           | Kit provides                              | Games |
|---------------|--------------------|-------------------------------------------|-------|
| **action**    | top HUD            | HUD pill; canvas fills `playRect()`       | breakout, flappy, snake, aim-trainer, frog-bonk, range, asteroids, asteroids-plus |
| **controls**  | top HUD + bottom   | HUD + kit-owned **bottom control strip** (responsive, its own overflow) | tower-defense |
| **board**     | top HUD + optional secondary bar | HUD + `boardRect()` centered; kit-owned **secondary info bar** slot | 2048, sudoku, bubbles, critter-match, glow-says, minesweeper, trap-the-cat, stacker, forcefield |

The **controls** strip and the **secondary info bar** are the two zones no kit concept exists for
today — they are exactly the tower-defense (board vs build buttons) and bubbles (board vs "special"
bar) overlaps. The kit owns their container, responsive layout, and reserve, so games stop guessing.

Scaled-world games (asteroids/+) map their world transform into `playRect()` instead of raw
viewport — see §4.

---

## 2. The enforcement (headless no-overlap test)

Generalize `runLayoutSuite` (today asserts `topReserve >= hudTop()`):

- Games expose in `__test.layout`: the board/canvas rect **plus** any secondary zone rects.
- The kit computes reserved-zone rects from the declared archetype.
- Assert across all 5 viewports: **board rect ⊆ `playRect()`**, and **no drawn element intersects
  any reserved zone**. A game that overlaps chrome fails the suite — before the eyeball, and a new
  game can't ship the bug.

This is the payoff: it turns "fix forever" into "fix once + enforce in CI."

---

## 3. Rollout

1. **Backbone** — build `reserve/playRect/boardRect` + archetype wiring in `game-kit.js`/`.css`;
   extend `runLayoutSuite` with the no-overlap assert. Keep all suites green (no game migrated yet).
   **✅ DONE** — `gamekit.layout.archetype/reserve/playRect/boardRect/topReserve` in `game-kit.js`;
   `runLayoutSuite` asserts `board ⊆ playRect()` for any game that declared an archetype
   (`__test.layout.board`), dormant for un-migrated games.
2. **Canaries — one per archetype** (prove the contract on the real hard cases):
   - **action:** `breakout` — **✅ DONE**, the reference template (canvas full-bleed, playfield =
     `playRect()`; portrait 2-row HUD reserved via `reserve('top', …)`).
   - **controls:** `tower-defense` — **✅ DONE**. Bottom strip (portrait) reserves its *measured*
     wrapped height → fixes the board/buttons overlap; left strip (landscape). Board = `playRect()`.
   - **board (hard):** `bubbles` — **✅ DONE**. Top band reserved for the `#specialIndicator` →
     fixes the special-bar overlap.
   - **board (basic):** `2048` — **✅ DONE**. Centered board fitted in `playRect()`.
   - **de-special:** `asteroids-plus` — **⏭ NEXT** (see §4; deferred as its own careful migration).
   Each canary migration sources geometry from the contract instead of raw viewport reads.
3. **Migrate the rest** — **✅ DONE** (whole catalogue except asteroids/+). Migrated: snake, sudoku,
   critter-match, glow-says, minesweeper, trap-the-cat, stacker, forcefield, flappy, aim-trainer
   (= "Range"), frog-bonk, balloon-pop. Each sources geometry from `playRect()`/`boardRect()`, declares
   its archetype, exposes `__test.layout.board`; all 16 pass `board ⊆ playRect` across 5 viewports.
   Notable: sudoku's number-pad + minesweeper's DIG/FLAG pill + snake's D-pad use dynamic
   `reserve('bottom'|'left'|'right')`; flappy/frog-bonk/aim-trainer/balloon-pop/forcefield re-sourced
   their resolution-fairness scale from `playRect()` (unchanged at the desktop reference).
   Only **asteroids / asteroids-plus** remain (§4).
4. **New games follow the contract from day one.** Fold this into the project CLAUDE.md
   `Adding / changing a game` build steps + the "hard contracts" conventions list, so every new game:
   - declares `gamekit.layout.archetype('action'|'controls'|'board', opts)` at boot;
   - sources all board/canvas geometry from `gamekit.layout.playRect()` / `boardRect()` — never raw
     `innerWidth/innerHeight` or a hand-rolled `hudTop` for gameplay bounds;
   - exposes `__test.layout.board = {x,y,w,h}` (the drawn play area) so `runLayoutSuite` enforces
     `board ⊆ playRect()` across all 5 viewports.
   Reference templates: **breakout** (action), **2048** (board), **tower-defense** (controls),
   **bubbles** (board + reserved bottom bar). A new game that skips the archetype declaration simply
   isn't checked — so the CLAUDE.md step is what makes it non-optional.

---

## 4. Rework asteroids / asteroids-plus onto the kit (no "special kid")

Both currently run **custom loops** and a **custom `#topHud`**, opting out of kit conventions. Bring
them in line with every other game:

- Replace the custom `#topHud` with the kit `.gamekit-hud` (archetype **action**).
- Move to `gamekit.loop` where feasible (they are grandfathered exceptions with their own fixed-step
  accumulators — reconcile with the kit accumulator, keeping determinism + `__test.step`).
- The scaled world maps its transform into `playRect()` (not raw viewport), so it obeys the same
  reserves and passes the no-overlap test like everyone else.
- Keep both suites green (`node games/asteroids/test.mjs`, `node games/asteroids-plus/test.mjs`);
  respect `games/asteroids/CLAUDE.md` (handle-with-care).

---

## Interim state (pre-contract)

The current working tree has interim per-game HUD-width fixes (range/frog/aim via kit,
asteroids, asteroids-plus). These are superseded by the contract and will be removed/absorbed
during canary migration — do not treat them as the final layout.

Open per-game overlaps still unfixed and deferred INTO the contract work (not patched separately):
snake landscape board overlap; bubbles secondary-bar overlap; tower-defense portrait board/buttons
overlap + landscape build-button icon fit.
