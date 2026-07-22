# Fairness + overlap fix plan

**Locked:** 2026-07-22. Fix cross-resolution *fairness* and *overlap/clip* across all games via **one
universal scaling model + a per-game orientation treatment**. Feeds the ROADMAP "no overlap/clip +
fair across resolutions" item — **not** marked done until automated tests cover every game.

Sources: [resolution-fairness-audit.md](resolution-fairness-audit.md) ·
[viewport-overlap-sweep.md](viewport-overlap-sweep.md) ·
interactive spec mock: [resolution-fairness-mock.html](resolution-fairness-mock.html) ·
sweep screenshots in `~/komyo-sweep/` (not committed).

---

## The standard

### A. Universal scaling model (every game)

- **Fixed-aspect play region, pure contain** — scales to fill one axis edge-to-edge (≤2 themed-fill
  bars; 0 bars when screen aspect matches). **No arbitrary padding.**
- **World games (real-time):** the play region/background fills the screen; the **HUD overlays** it
  (translucent).
- **Board games:** the play region sits **below the top bar** (chrome never overlaps the board);
  side/bottom margins are expected and fine.
- **Objects sized as % of the play region (pure)** — speeds, ranges, radii and sizes all derive from
  the region by one uniform scale, so **fairness is automatic** (nothing normalized piece-by-piece).
  - **Min clamp (~44px)** on *tappable / aim* objects so they stay hittable on small phones;
    **optional max clamp** so nothing is cartoonish on huge displays. **No per-resolution multipliers**
    (they re-introduce unfairness).
- **UI (buttons / pills) scaled as % with clamps** — min 44px touch floor, sensible max.
- **Non-overlapping top bar** — score pill fits the gap between the Menu chip and the button cluster,
  drops to a 2nd row when the gap is too narrow; collapse secondary buttons into ☰ on very narrow
  (≤360px). (This is the overlap-plan fix for the landscape HUD↔cluster collision.)
- **Themed fill + vignette** in any residual bars.

### B. Orientation menu (pick one per game)

1. **agnostic** — square/grid scales cleanly both ways (one layout).
2. **rotate-to-fill** — a landscape design rotated 90° to fill portrait, **sprites kept upright**;
   only for orientation-invariant games (top-down / tap, no gravity, no axis-locked input).
3. **native-both** — fixed-"up" games that already play both orientations (paddle stays at the
   bottom, etc.); no rotation.
4. **lock** — gravity/axis-locked games locked to their natural orientation (rotate prompt).

*(radial/space games are effectively **agnostic** — rotation is a visual no-op.)*

### C. Per-game treatment

| Treatment | Games |
|-----------|-------|
| rotate-to-fill | frog-bonk, tower-defense, aim-trainer |
| radial / space (no rotation) | forcefield, asteroids, asteroids-plus |
| agnostic square/grid | 2048, sudoku, minesweeper, glow-says, critter-match, trap-the-cat, snake |
| native-both (no rotation, +normalize) | breakout, flappy, balloon-pop |
| lock | stacker (portrait), bubbles (portrait — already locked) |

---

## Session progress — 2026-07-22 (implementation started)

**Shipped (committed, suites green):**
- ✅ Kit: landscape HUD drops below the nav row (≤768) + `hudTop()` 92 in that band — fixes overlap for every `.gamekit-hud` game.
- ✅ Kit: menu option-list scroll cue on short screens (mode-list clip in balloon-pop/glow-says/minesweeper/trap-the-cat).
- ✅ tower-defense: full slim HUD (GOLD·SCORE·WAVE+remain·THREAT-meter), castle HP on the keep, BEST/MODE→pause/end, Mage un-clipped. Verified in-browser.
- ✅ breakout: ball speed normalized by field height (device-fair crossing time).
- ✅ flappy: pipe gap normalized to the playable band (constant screen-share).
- ✅ aim-trainer: targets/spawn/speed scaled to play-area (device-fair leaderboard). ⚠ consider leaderboard reset.
- ✅ snake / asteroids / asteroids-plus: custom HUDs drop below nav in landscape ≤768.

**Remaining (the big "scaling & orientation rework" — future session):**
- Full fixed-aspect play-region + objects-as-% + %-clamped UI + themed-fill/vignette across all games.
- Rotations: frog-bonk, tower-defense, aim-trainer (rotate-to-fill portrait).
- frog-bonk approach+range normalization; bubbles fixed row-budget + desktop-landscape lock.
- 2560 empty-space via board-scale-up; object-clamp helper; test-harness fairness assertion; docs (§5) + breakout reference fix.

## Worklist

### Phase 1 — shared kit (highest leverage; do first)
- [ ] Play-region helper: fixed-aspect + pure contain; world=HUD-overlay vs board=below-the-bar mode; `refScale` from the region.
- [~] `%`-clamped UI + **non-overlapping top bar** (pill gap / 2nd-row / collapse-to-☰ ≤360) — fixes the landscape HUD↔cluster overlap across ~7 games at once.
  - [x] **Landscape HUD↔cluster overlap fixed** (2026-07-22): kit drops the center HUD below the nav row at ≤768px (was ≤560) + `hudTop()` reserves 92px in that band. All games, tests green, verified in-browser (breakout 640×360).
  - [ ] `%`-clamped UI button sizing + pill 2nd-row / collapse-to-☰ on very narrow (≤360).
- [ ] Object `%`-size helper with min/max clamp for tappable/aim objects.
- [ ] Themed-fill + vignette bar treatment.
- [ ] **Test harness fairness assertion** beside `runLayoutSuite`: a difficulty proxy (time-to-threat / target-size fraction) is equal across the 5 viewports within tolerance. This is the automated net that makes the whole thing enforceable.

### Phase 2 — fairness fixes (per game, TDD: assert-fails → fix → passes)
- [ ] **aim-trainer (HIGH)** — normalize target radius / spawn spread / move speed; **decide whether to reset its leaderboard** (existing bests are device-polluted).
- [ ] **breakout** — ball speed as % of height; **fix the doc** that wrongly cites breakout as the fixed-logical-world reference.
- [ ] **flappy** — gap (and gravity/flap) from playable height.
- [ ] **frog-bonk** — rotate-to-fill portrait + normalize approach speed **and** the ranged offsets (mage/brute) into `castR` multiples.
- [ ] **bubbles** — fixed reference row-budget for the lose line; close the desktop-landscape portrait-lock gap.
- [ ] **asteroids / asteroids-plus** (optional, accepted tradeoff) — scale entities + cap the large-screen arena.

### Phase 3 — overlap papercuts
- [~] **tower-defense** — [x] Mage clip fixed (safe-center scroll) + [x] landscape HUD drop (2026-07-22); [ ] rotate-to-fill (Phase 4).
- [ ] **mode-list clip** in landscape start menus (balloon-pop, glow-says, minesweeper, trap-the-cat) — scroll affordance / shorter lists.
- [ ] **2560 empty-space** — resolved by the universal board-scale-up; verify per game.

> **Note (2026-07-22):** the kit HUD-drop fixes every game that uses a plain `.gamekit-hud`. Games with
> their own `#top.gamekit-hud` media overrides (tower-defense — done) or a fully custom HUD
> (asteroids, asteroids-plus, snake) need per-game reconciliation — check each in landscape.

### Phase 4 — apply orientation treatment (per the table in §C)
- [ ] rotate-to-fill: frog-bonk, tower-defense, aim-trainer
- [ ] lock: stacker, bubbles · native-both: breakout, flappy, balloon-pop · agnostic: the rest

### Phase 5 — docs + rollout
- [ ] `game-design-knobs.md` — add a **resolution-fairness** knob: no gameplay quantity in raw px; choose the treatment at design time.
- [ ] komyo-new-game skill (`responsive.md` / `SKILL.md`) — make the scaling model + orientation choice a **required** design decision; correct the breakout reference.
- [ ] ROADMAP — record progress (**not** "done" until the Phase-1 automated assertion covers every game).
- [ ] Changelog — one player-facing entry when it ships (e.g. "games now play consistently across screen sizes; no more cramped phone / oversized desktop").

---

## Notes / open decisions
- **aim-trainer leaderboard reset** — yes/no (Phase 2, item 1).
- Per-resolution object multipliers were **rejected** — they trade fairness for comfort; clamps handle the edges instead.
- The eyeball gate is the Playwright 5-viewport sweep (script + montage tool from this investigation are reusable); run it per phase before push.
