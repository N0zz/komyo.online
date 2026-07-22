# komyo visual sweep — issues report

**Date:** 2026-07-22 · **Build:** local (`main` @ working tree)
**Captured:** 745 screenshots via headless Playwright · 5 viewports × (18 games × 7 screens + ~21 site surfaces)
**Zero** capture failures, **zero** JS page errors (`_sweep.log`).

## Viewports swept

| Tag | Size | Role |
|-----|------|------|
| `p360x640` | 360×640 | portrait floor (Android) |
| `l640x360` | 640×360 | landscape short-height floor ← **most issues here** |
| `d1280` | 1280×800 | laptop |
| `d1920` | 1920×1080 | common desktop |
| `d2560` | 2560×1440 | high-res ceiling (empty-space check) |

## How to review

- **All singles:** `~/komyo-sweep/*.png` — names sort as `game-<slug>__<screen>__<vp>.png` and `site-<name>__<vp>.png`.
- **Contact sheets:** `~/komyo-sweep/_montages/*.png` — `L-*` landscape, `P-*` portrait, `X-*` 2560, one row per game/surface.

---

## MAJOR — real overlap / clip (functional)

### 1. HUD collides with the right nav cluster in landscape (640-wide)
The center-top `.gamekit-hud` pill keeps its items on one horizontal line at 640px (it only wraps when `narrow` = portrait or ≤560px). Games with many HUD items **plus a MODE label** run the pill's right end *under* the ⏸ pause button and the rest of the right cluster.

- **Confirmed:** `game-breakout__3gameplay__l640x360.png` — "MODE Classic" sits underneath the ⏸ button.
- **Same pattern:** snake ("Normal Walls"), stacker ("Classic"), aim-trainer ("Timer"), asteroids-plus, frog-bonk, tower-defense.
- **Clean (for contrast):** the identical HUDs in **portrait** wrap to centered lines with room to spare (`P-gameplay.png`) — so this is a 640-wide-specific collision, not a general HUD bug.
- **Likely fix direction:** treat the 561–768px landscape band as "narrow" for HUD wrapping, or right-pad the HUD to reserve the cluster's width, or drop/truncate the MODE label when the pill would reach the cluster. (Design fix — not making a call here.)

### 2. tower-defense clips its last tower in landscape
`game-tower-defense__3gameplay__l640x360.png` — the vertical tower picker (Archer / Cannon / Frost / **Mage**) overflows the 360px height; **Mage is cut off** at the bottom edge with no visible scroll affordance. Landscape-only — portrait puts the towers in a bottom grid where all of them + "Start Wave" fit (`game-tower-defense__3gameplay__p360x640.png`). The top HUD here is also the worst case of issue #1 (wraps to 2 rows, right end under ⏸).

---

## MODERATE — clipped but reachable

### 3. Start-menu mode list clips its last card in landscape
Games whose START menu shows a scrolling mode list cut the last mode below the fold at 360px height, with no obvious "scroll for more" cue:
- balloon-pop (**Bees**), glow-says (**Expert**), minesweeper (**Expert**), trap-the-cat (**Hard**).
- Evidence: `L-menu.png`. Usable (the column scrolls) but the cutoff reads as "that's all the modes."

---

## LOW — cosmetic (empty space at high-res)

### 4. Letterboxing / large empty margins at 2560×1440
No overlaps at 2560 (the HUD has ample room), but content maxes out and floats in a large empty field — the "big-setup empty space" anticipated on the roadmap:
- **Fixed-max board games:** 2048, sudoku, critter-match, glow-says, minesweeper — small centered board, wide dark margins.
- **Vertical games:** stacker, bubbles — narrow centre strip, big side gutters.
- Evidence: `X-gameplay.png`. Options later: decorative backdrop fill, or scale boards/cells up on very wide viewports. Aesthetic, not blocking.

---

## Verified NON-issues (checked, fine)

- **minesweeper landscape DIG/FLAG pill** — now correct (this was the 2026-07-12 landscape break; **fixed**).
- **bubbles in landscape** — shows "Rotate your phone to play" (portrait-locked by design), intended.
- **Site modals in landscape** — settings, FAQ, hamburger drawer, and the **collection/shop** (all 18, themed) all fit cleanly, close button clear (`L-site.png`, `L-collection.png`, plus full-res settings/faq/hamburger).
- **Portrait gameplay (all 18)** — HUD wraps correctly, no overlaps (`P-gameplay.png`).
- **Cookie consent banner** appears on the catalogue in every context — expected (fresh profile, consent not yet accepted).

---

## Ranked worklist

1. **#1 HUD ↔ nav-cluster overlap (landscape)** — affects ~7 games, one shared kit fix (the HUD wrap/reserve rule). Highest leverage.
2. **#2 tower-defense Mage clip (landscape)** — game-specific.
3. **#3 mode-list clip (landscape menus)** — 4 games; scroll-affordance or shorter lists.
4. **#4 2560 empty space** — cosmetic, batch later.

## Roadmap note

This is the **manual/visual** half of the "ensure stuff doesn't overlap or clip" roadmap item — issues identified once, **not** marked done. The proper follow-up is automated global assertions (e.g. extend `runLayoutSuite` / a DOM-geometry check to assert HUD ↔ cluster and menu-content ↔ viewport non-overlap at every viewport, especially the 640-wide band). The capture script (`scratchpad/sweep/sweep.mjs`) + montage tool are reusable for re-runs.
