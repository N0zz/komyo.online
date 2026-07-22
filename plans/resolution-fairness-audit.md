# komyo — resolution / viewport fairness audit (all 18 games)

**Date:** 2026-07-22 · **Method:** per-game source audit (5 parallel agents) of each `games/<slug>/index.html` update()/model + layout path.
**Question:** does the game play *differently* across screen sizes because gameplay geometry is tied to raw viewport pixels? (The "frog-bonk" bug: on a 4K screen the frog has a long lane → easy; on a phone it's at your castle instantly → hard.)

## The core principle

Unfairness appears when a **gameplay-relevant quantity is measured in raw pixels** while the play area size changes with the device. The fix is to express gameplay in a **consistent virtual space**, two ways:

- **A — Fixed logical world (letterbox):** design in a constant virtual `W×H`, scale-to-fit, bars on the odd axis. All relationships invariant *for free*. Cost: possible empty bars on off-ratio screens.
- **B — Fill the screen, normalize every gameplay magnitude** to a reference (`refScale = min(W,H)/REF`): approach *time*, speeds, **and all ranges/radii**. No bars. Cost: per-game care — **miss one quantity and unfairness returns.**

**The range caveat (important):** normalizing approach *time* alone is not enough for games with ranged units (mages, towers, splash, knockback). Every spatial quantity — attack range, coverage radius, projectile reach — must be normalized too, or balance still drifts. This is why **A is safer the more spatial systems a game has**; B is fine for a single "one thing approaches, react in time" mechanic.

## Summary — severity by game

| Game | World model | Severity | Fix |
|------|-------------|----------|-----|
| **aim-trainer** | viewport-is-the-world | **HIGH** | B |
| breakout | viewport-is-the-world (mixed) | moderate | B (or A) |
| flappy | viewport-is-the-world | moderate | B |
| frog-bonk | viewport-is-the-world | moderate | B (+ finish ranges) |
| bubbles | hybrid (vertical coupled) | moderate | B |
| asteroids | scaled-world | moderate | accepted / B for strict parity |
| asteroids-plus | scaled-world | moderate | accepted / B for strict parity |
| forcefield | normalized (angular) | none | already-fair |
| balloon-pop | scaled-world (normalized) | none | already-fair |
| tower-defense | scaled grid | none | already-fair |
| trap-the-cat | fixed-logical (hex) | none | already-fair |
| snake | fixed-logical (grid) | none | already-fair |
| stacker | fixed-logical (constants) | none | already-fair |
| critter-match | fixed-logical (board) | none | already-fair |
| 2048 | fixed-logical (grid) | none | already-fair |
| sudoku | fixed-logical (grid) | none | already-fair |
| minesweeper | fixed-logical (grid) | none | already-fair |
| glow-says | fixed-logical (pads) | none | already-fair |

**11 fair · 6 moderate · 1 high.** Turn-based/board/grid games are fair by construction; the problem is confined to real-time viewport-is-the-world games.

## Ranked worklist

1. **aim-trainer (HIGH).** Competitive per-mode leaderboard on a viewport-coupled field: target radius (~9% of a 360px phone vs ~1.3% of 2560px), spawn spread, and move speed are all pixel-fixed → phone players hit more/sec and **inflate the boards; stored bests are not comparable across devices** (a data-integrity problem, not just difficulty). **Fix B:** scale `TARGET_BASE_R`, spawn `pad`/region, and `MOVE_SPEED_MIN/MAX` by `min(W,H-HUD)/REF` (or letterbox the field). Timing constants already fair. *Note: fixing this arguably invalidates existing aim-trainer bests — decide whether to reset that leaderboard.*

2. **breakout (moderate) — + doc correction.** Ball speed is pixel-fixed (`5.85+level*0.65`) against a viewport-scaled field, so the ball crosses in ~1.2s on a phone vs ~3.4s on 4K (~3× more forgiving on desktop; "slow-mo on desktop, fast on phone"). **Fix B:** scale ball speed (and ideally `BALL_R`, `PADDLE_H`, `MIN_VY`) off `min(W,H)`; or A. **⚠ Doc bug:** CLAUDE.md and the komyo-new-game skill cite **breakout as *the* fixed-logical-world reference** — it isn't. See "Doc fixes" below.

3. **flappy (moderate).** Gap is a fixed 240px = 46% of a portrait phone's playable band but **85% on a short/landscape screen → trivially easy** (gapY range collapses to ~29px). Horizontal cadence is fair; the vertical is a different game by aspect ratio. **Fix B:** derive `GAP_H`/`GAP_MIN` (and ideally gravity/flap) from playable height (gap ≈ fixed fraction ~0.40 of the band).

4. **frog-bonk (moderate) — the original example.** viewport-is-the-world; spawn-to-castle ≈ 180px on a phone vs 700–1280px on 4K against a fixed ~50px hop → ~4 hops vs ~13–25 (several-fold more reaction time on big screens). Off-screen gating for casts is already correct. **Fix B:** scale hop speed + sit cadence by `min(W,H-topMargin)/REF`, **and** express the mage/brute fixed offsets (`+120/+170/+340`) as `castR` multiples so ranged reach stays constant in field-space (they partly ride `castR` already — finish it). *If B feels fiddly here given the multiple actor types, A (fixed logical arena) is the cleaner alternative.*

5. **bubbles (moderate).** Horizontally fair (fixed 12-col band), but the **survivable descent count rides screen height**: ~11 descents of runway on a phone vs ~31 on 4K (≈3× easier on tall screens), Arcade/Endless only. Also the portrait-lock is **conditional** — desktop landscape windows are left unlocked and play with the extra runway. **Fix B:** size `ROW_H` so a constant N rows always spans `topMargin→loseY` on every height (not just short screens), or cap descents-to-lose to a constant.

6. **asteroids / asteroids-plus (moderate — accepted tradeoff, lowest priority).** Scaled-world clamps small screens (`S=900/min` under 640) but leaves large desktops an unbounded, sparser, easier arena (fixed-px rock sizes/speeds cover a smaller fraction; fixed-px player abilities in asteroids-plus get relatively weaker too). Documented design choice in the game's CLAUDE.md. **Fix (optional) B:** cap the large-screen world dimension and/or scale entity+ability radii/speeds by `min(W,H)/900`.

## Verified fair (no action)

- **forcefield** — gameplay is defined in normalized angular `[0,1]` arc space + frame timing; byte-identical difficulty everywhere. *Reference for "normalize the model."*
- **balloon-pop** — scaled-world done right: rise distance ≈ `H`, rise speed ∝ `H/700` → **crossing time constant** across viewports. *This is the frog-bonk bug solved correctly — the reference for approach B.*
- **tower-defense** — fixed 15×9 grid; ranges are `cells × cell-px`, enemy distances equally scaled → coverage identical in cell-space. *Reference for grid + normalized ranges.*
- **snake, stacker, trap-the-cat, critter-match, 2048, sudoku, minesweeper, glow-says** — grid/board or absolute-constant models; grid size fixed by mode, timers on the kit 60 Hz loop, no viewport-coupled difficulty. Only cross-device difference is tap-target size (UX/a11y, not fairness).

## Doc fixes (independent of the code work)

The docs point new-game authors at the **wrong reference**:
- CLAUDE.md and `komyo-new-game/references/responsive.md` name **breakout** as the fixed-logical-world example — but breakout is viewport-is-the-world with a pixel-fixed ball (item #2). Replace the reference with a genuinely fair one: **snake / stacker** (fixed-logical), **tower-defense** (grid + normalized ranges), **forcefield** (normalized angular model), or **balloon-pop** (scaled-world with normalized crossing time).

## Add-game skill update (once the approach is locked) — as requested

When we decide the standard (likely: **A for spatially-rich real-time games, B with a shared `refScale` helper for simple approach games, grid/normalized models stay as-is**), fold it in so new games can't reintroduce the bug:

1. **`game-design-knobs.md`** — add a cross-cutting "Resolution fairness" knob: *no gameplay magnitude (distance, speed, range, radius, reaction window) may be measured in raw viewport px; pick model A or B at design time and normalize every quantity.*
2. **`komyo-new-game/references/responsive.md`** — make the world-model choice (A/B/grid) a **required, first-class decision** in the design note (§1), with the range caveat spelled out, and correct the breakout reference.
3. **`komyo-new-game/SKILL.md`** — add a fairness check to the iterate/test step.
4. **Automation (the real endgame):** a shared kit helper (`refScale = min(W,H)/REF`) applied consistently, **plus a test-harness assertion** that a difficulty proxy is viewport-invariant — e.g. drive `__test.step` at the 5 viewports and assert time-to-threat (frog-to-castle, ball-to-paddle, balloon-crossing) or target-size-fraction is equal within tolerance. This is the automated counterpart to the visual sweep and belongs next to `runLayoutSuite`.

---
*Companion to the visual overlap/clip sweep (`plans/viewport-overlap-sweep.md`). The 745 sweep screenshots + contact sheets live in `~/komyo-sweep/` (outside the repo, not committed). Both feed the roadmap "no overlap/clip + fair across resolutions" item — identified only, not marked done.*
