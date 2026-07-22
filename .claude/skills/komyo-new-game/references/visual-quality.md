# Visual quality bar — level of detail every komyo game ships with

Established by the 2026-07 texture-pass initiative (frog-bonk, keep-defender,
meadow-flyer, bubble-pop). New games ship AT this bar from the start — retrofits
cost far more than building on-bar. The exception is games whose identity is
deliberately flat/glow (neon, synthwave, vector, tactical, minimal pastel — snake,
breakout, forcefield, aim-trainer, asteroids, stacker): for those, polish means
bloom/readability, not detail; don't texture them.

**Core principle: flat fills are a POC look, not a shipping look.** A shipping
scene has one light source, form shading on every hero element, textured
terrain, grounded entities, and a post grade — all derived from the game's own
palette so the theme stays coherent.

## The seven requirements

1. **One light direction** — upper-left sun, lower-right shadows, everywhere.
   Every standing prop and creature gets a soft cast shadow (2–3 expanding
   ellipse passes along the sun vector — see `castShadow` in frog-bonk / the
   `towerShadow`/`critterShadow` pair in tower-defense). Shadows stay grounded
   when the body bobs or jumps.
2. **Form shading on hero elements** — bodies get a radial gradient (light
   toward the sun corner → base → darker away), plus a rim-light arc on the
   sun side. Where gradients are unavailable (painters shared with headless
   menu-icon paths — see flappy's `drawBirdModel`), use flat translucent
   overlay shapes instead; the effect is the same.
3. **Glossy creature eyes** — sclera, iris, pupil, double catchlight (one
   bright upper, one faint lower). This single detail carries more perceived
   quality than anything else on a small sprite.
4. **Textured terrain, cached** — big soft colour patches (low alpha, LARGE
   radius — visible blobs read as camo spots) + per-theme micro-texture.
   Grass is **tufts, never single hairs**: three short blades fanning from a
   shared root, tinted darker than the terrain, occasional sunlit tip —
   scattered single strokes read as rain streaks. Derive every tint from the
   theme palette via a `shade`/`tint` helper so all skins/maps stay coherent.
   Paint ALL of it into a cached offscreen background (frog-bonk `ensureBg`,
   tower-defense `ensureBoard`): per-frame cost must be one `drawImage`.
5. **Post pass** — a subtle diagonal colour grade (warm sun corner → cool
   shade corner) + vignette, as two cached gradient fills per frame. Keep it
   gentle (~0.10/0.12 alpha, vignette ≤ 0.3); UI text may draw after it.
6. **Menu backdrop parity** — the start-menu backdrop gets the SAME quality
   language as the board. Two traps: the kit dims backdrops under a ~60% menu
   overlay, so texture must be ~2× stronger there to survive; and backdrop
   "tiles" often render far larger than in-game, so size texture marks in
   FIXED px, not tile units. Cache static scenery per size if the backdrop
   animates (frog-bonk `mbScenery`).
7. **Grounded, material pickups & effects** — collectibles get contact
   shadows and materials (minted coin with edge + embossed face + travelling
   glint; glassy orb with bolt; bronze medallion for event icons). Status
   effects are themed shapes, never plain circles: frost = ice shards
   gripping the body + twinkling motes; buffs = orbiting sparkles + a
   drifting note. Impact hits kick up a few budgeted particles.

## Hard rules that keep it shippable

- **Deterministic texture**: all static scatter uses the `h01` integer hash,
  never `Math.random` in a render path — random re-rolls shimmer per frame
  and break test determinism.
- **Per-frame budget**: heavy texture lives in the cached bg; per-frame
  gradients are cached where geometry is static (per entity TYPE, like
  frog-bonk's `FGRADS`); particle spawns respect a budget constant.
- **View-only animation state** (`vtick`-style counters) never touches game
  state — `update()` must stay deterministic for `__test.step(n)`.
- **Readability beats richness**: colour-coded gameplay elements (bubble
  colours + symbols, tower tier colours) keep their exact hues and marks;
  shading layers go around them, never over them.
- **Emoji policy**: drawn assets on the board; emoji stay in DOM UI (build
  bars, panels, tooltips) where their instant recognition matters.

## The review discipline (why "looks done" isn't done)

Every visual pass gets **two review rounds before hand-off**, both
screenshot-driven (headless Chrome + a wrapper that clicks past the
tap-to-play splash and stages entities via `__test`):

1. **Scale & composition round** — desktop AND 360×640 portrait AND **640×360
   landscape** (never skip landscape — every real landscape regression shipped
   because only desktop + portrait were screenshotted), all themes/skins/modes
   (day+night, every map). Include every game-owned control (touch pills,
   toolbars) at the landscape size. Known failure classes: element
   scale ratios drift (tower-defense's first turrets were dwarfed by their
   bases), texture too dense (reads as noise — halve it), menu backdrop
   invisible under the kit overlay, fixed-size touch controls dominating the
   short landscape viewport (minesweeper's 62px bottom pill).
2. **Alignment & code round** — re-read the new painters for: overlays
   clipped to their parent shape (an unclipped AO gradient rect = a square
   shadow on the grass), elements anchored to a returned platform/surface Y
   (never re-derived offsets), dead constants left behind, fillStyle set
   inside loops.
- **The silhouette test**: at real game size, every asset must read as what
  it is. If a sword reads as a cigarette, it's a redesign, not a tune.

## Cost expectations (for planning)

Frog-bonk's full pass ≈ +400 lines; tower-defense (towers ×3 levels + 6
enemies + 6 map themes) ≈ +700; flyer/bubbles ≈ +150–250 each. Runtime cost ≈
zero when rule 4's caching is followed. Budget a look-dev mock in `plans/`
first for anything with new asset families (the tower/enemy gallery pattern) —
the user approves the direction before implementation.
