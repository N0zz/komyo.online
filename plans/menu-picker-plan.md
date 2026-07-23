# Menu picker — no menu ever scrolls

**Requirement (from the user).** Every game menu shows ALL its options on screen at once — **no
scrolling anywhere, at any viewport**. When there are too many options to fit, the big list moves
into a **picker submenu** (the tower-defense map-picker pattern): the main menu stays compact.

## Why (the finding)

Nearly every game selects its mode/board with **rich cards** (`style:'cards'`, a 92px preview +
padding = **~114px each**). glow-says has 4 cards (~486px), breakout 3, critter-match 2. On a
360×640 phone the menu box holds ~508px of content; in landscape 640×360 only ~284px. So 3–4 cards
plus a title, a difficulty row, a hint and the Play button **always** overflow → the menu scrolls
(the current landscape "split-scroll" was a mitigation, not a fix). The real-browser `test-menu-browser.mjs`
model — with card heights counted — flags every card-mode menu OVER. That is the work list.

## The mechanical gate (already built)

`test-menu-browser.mjs` (headless Chromium, dev-only Playwright dep) loads each game and measures
(monospace → reliable text width) at 640×360 and 360×640. It asserts: **content fits without
scroll** (card/grid/shop heights counted) and **no button breaks mid-word**. It's RED today; it goes
green as menus adopt the picker. Fold it into `test.mjs` (via `runMenuFit()`) once green so a
scrolling menu can never ship again. New games get added to its `GAMES` list.

## ✅ Shipped solution — compact single-screen menus (picker = rare fallback)

Not "picker everywhere" (that made 18/18 games a 2-tap dropdown — overkill). Instead the menu was
made to **fit on one screen** at every viewport by compacting elements, with the picker reserved for
genuinely huge lists:

- **Cards → compact single-column rows on small screens** (game-kit.css `@media`): 34px preview +
  name/best on one line, no blurb (~46px each, full width → text never cramps/wraps). NOT a 2-up grid
  (a 3-card grid leaves a half-empty row and squeezes text).
- **Landscape keeps the 2-column split** (list left, title/Play rail right) so it uses the width —
  compact cards make the list column fit WITHOUT scrolling.
- **Narrow portrait compaction** (`@media (max-width:560px)`): tighter title/sections/buttons/actions
  so a dense 3-group menu (e.g. snake: walls + speed + size) fits one screen.
- **`test-menu-browser.mjs` is the gate** — all 18 live games FIT at 640×360 and 360×640 (real-browser measured);
  `test.mjs`. Keep the estimator constants in lockstep with the menu CSS.
- **Picker (`style:'picker'`) stays** for a rare genuinely-long list (compact trigger + modal) — see
  below.

## (Reference) kit-owned picker — the rare-overflow fallback

A menu group whose `style` is `cards` / `grid` / `shop` no longer renders inline. Instead the kit
renders, in the main menu, a compact **summary row**:

```
  ┌──────────────────────────────────────┐
  │ [▦]  Large · best 15        Change ▸ │   ← current selection + a Change button
  └──────────────────────────────────────┘
```

Tapping it opens a **picker overlay** (its own screen) with the full-size cards; picking one returns
to the menu with the summary updated. The main menu therefore only ever contains: title + summary
row(s) + simple row groups (mode/difficulty) + hint + Play — which fits at every viewport.

- **Kit does the work.** `gamekit.menu` renders the summary + the picker overlay + wiring; games keep
  declaring the same `groups` (a `style:'cards'` group is auto-picked). The picker reuses the existing
  card/grid/shop renderers, so no game-art changes.
- **Consistent, no measurement.** Always-picker for big groups (not "only when it overflows") — one
  predictable UX, no fragile render-time measuring. One extra tap to *change* mode; the current mode
  is always visible. This mirrors tower-defense's map picker.
- **Simple row groups stay inline** (mode toggles, difficulty) — they're compact and readable.

## Rollout

1. **Kit:** add the summary-row + picker-overlay rendering to `gamekit.menu` for `cards/grid/shop`
   groups; keep keyboard/touch parity + theming; the selection still flows through `onChange`/state.
2. **Verify against the gate:** run `npm run test:menus` — every game must reach FIT at both viewports.
   Fix any residual overflow (a menu that's still too tall after the picker → compact its row groups).
3. **Fold `runMenuFit()` into `test.mjs`** so the suite stays green and blocks future regressions.
4. **CLAUDE.md:** document that big option lists use the kit picker (automatic for `cards/grid/shop`)
   and that menus must pass `npm run test:menus`.

## Notes / open questions

- Games with a **row** group that's itself too tall (many difficulties) are rare; handle case-by-case
  (compact, or promote to a picker) — the gate will tell us.
- The landscape **split-scroll** layout becomes redundant once big groups are pickers; remove it after
  migration to simplify the menu CSS.
- End screens (score card + stats) are a separate case (they already 2-column split) — out of scope
  here unless the gate flags them.
