# Asteroids / Asteroids+ — onto the kit (no "special kid")

**Status: NOT STARTED** (deferred). This is the last game work from the layout-contract initiative —
every other live game is on the contract; asteroids and asteroids-plus are the exception.

## Goal

Bring `games/asteroids/` and `games/asteroids-plus/` in line with every other game: on the **layout
contract** (archetype + `playRect()`), using the **kit HUD**, so they stop being the special cases.

## Current state (what makes them special)

- **Custom `#topHud`** instead of the shared `.gamekit-hud` (own pill markup + CSS, own responsive
  rules). Carries **interim tweaks** from the menu pass (`width:80vw` portrait `#topHud`, landscape
  `max-width` reserves) — these are stop-gaps to remove, not the target.
- **Custom fixed-step loop** (grandfathered — see CLAUDE.md; breakout/snake also keep theirs, so the
  loop does NOT need to change for the contract).
- **Scaled world** (`S = m<640 ? min(2.6, 900/m) : 1`) — draws in a scaled coordinate space, not raw
  CSS px; `fitCanvas` is opted out (`{dpr:false}`-style self-managed transform).
- Menus already use `gamekit.menu` (they PASS the browser menu-fit gate today — start + end).

## Plan

1. **Read `games/asteroids/CLAUDE.md` first** (handle-with-care). Keep both suites green throughout:
   `node games/asteroids/test.mjs`, `node games/asteroids-plus/test.mjs`.
2. **Declare the archetype** at boot: `gamekit.layout.archetype('action')` (top HUD only).
3. **HUD** — pick one:
   - (preferred) replace the custom `#topHud` with the shared `.gamekit-hud` markup + `.gamekit-hud`
     items, so the kit owns position/measure/theming like everywhere else; OR
   - (min) keep `#topHud` but register it with the contract via `archetype('action', {hud:'#topHud'})`
     so the kit auto-measures it into the top reserve (like snake's `{hud:'#hud'}`).
   Either way, **delete the interim `80vw` / landscape `max-width` `#topHud` rules** — the contract's
   measured top reserve replaces them.
4. **Source the arena/world bounds from `playRect()`** — the scaled-world transform maps into
   `playRect()` (not raw viewport), so the play area clears the reserved top chrome and obeys the same
   rules as every other game. Keep the scaled coordinate space internally; just base its origin/extent
   on `playRect()`.
5. **Expose `__test.layout.board = {x,y,w,h}`** (the play/arena rect in CSS px) and add the game to
   its `runLayoutSuite` check — the headless `board ⊆ playRect()` assert (pass `{size:false}` for the
   scaled-world canvas, like the existing asteroids layout test already does for canvas sizing).
6. **Loop stays** (grandfathered custom fixed-step + `isPaused` accumulator). Do not rewrite it.
7. **Verify**: both game suites + `node test.mjs` (605+) green; `npm run test:menus` still 18/18;
   then a real-browser eyeball of gameplay + HUD at the 5 viewports (esp. 360×640 / 640×360) — the
   scaled world + HUD is exactly where a regression would hide.

## Risks / notes

- Scaled-world ↔ `playRect()` is the fiddly part: pointer math + spawn distances are in scaled units;
  re-basing the transform on `playRect()` must not change gameplay feel at the desktop reference.
- asteroids classic has an in-page **mode picker** (`?v=classic|enh`, no `?v` → picker) — not a
  `gamekit.menu`, so the menu-fit gate skips its picker; eyeball it manually.
- Removing the interim `#topHud` tweaks is safe only once the kit HUD / measured reserve is in place.

## Done when

Both games declare an archetype, draw inside `playRect()`, expose `__test.layout.board`, pass the
layout + menu gates, and carry no bespoke `#topHud` width hacks — i.e. they look and behave like the
other 16 games. Then update this file's status to DONE and drop the "exception" notes in
`plans/kit-layout-contract-plan.md` §4 + CLAUDE.md.
