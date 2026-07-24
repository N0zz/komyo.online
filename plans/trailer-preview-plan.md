# komyo Game-Card + Trailer/Screenshot Preview — Implementation Plan

> **Status: PLANNED (2026-07-23).** Design locked with the user across a long design session. Not
> started. Talk-before-implement: the implementing session builds this, keeps every suite green, and
> waits for the user's local eyeball before any push (player-facing visual change).
>
> **Interactive mock (the source of truth for the look/behaviour):**
> `plans/trailer-card-mock.html` — serve the repo root and open
> `http://localhost:8765/plans/trailer-card-mock.html`. Sample screenshots captured this session live
> in `plans/trailer-shots/` (Bubble Pop + 2048 — concept placeholders only, see "Screenshots" below).

> **For agentic workers:** implement task-by-task; steps use `- [ ]` checkboxes. Run **all** suites
> (`node test.mjs` + touched game suites) after changes, then the **5-viewport eyeball pass**
> (Playwright MCP, headless). Do NOT commit/push until the user approves.

## Goal

Give every catalogue tile a **"MORE ˅" strip** that expands an inline **game card** below the tile's
row. The card shows, in a fixed **9:16 media slot**:

- a **trailer** (muted, autoplaying) **if the game has one**, else
- a **gameplay screenshot** (every other game).

Plus the game's real "How to play" text and a Play button. Everything on-site — no YouTube embed, no
tracking, no ads, no rabbit-hole, no leaving the site (aligns with *instant · light · kid-safe · no
ads · works offline*).

**Rule the user set: trailer if available, screenshot for all others.** So every live game gets a
card with at least a screenshot; there is effectively **no text-only state** in the shipped feature
(the mock still shows a text-only fallback for Breakout just to illustrate the degenerate case).

**First trailers:** `trap-the-cat` + `forcefield` (local v2-stage finals exist). **Screenshots:**
every other live game (bulk capture — see rollout).

## The design (locked decisions)

Distilled from the session so the implementer doesn't re-litigate:

- **Expander, not a tile ▶ chip.** A reviewer flagged that a corner ▶ overloads the tile and reads
  as a second "Play". Instead: a full-width **`MORE ˅`** strip at the **bottom ~15% of every tile**
  (mono, accent-tinted, hairline top border). It reads as "expand", never as a play button.
  (Supersedes the earlier chip→lightbox design entirely — do not build a lightbox.)
- **Whole tile still launches the game.** The tile body is the primary Play action, unchanged. The
  strip is a separate small target (stop propagation). The card is **never** the only way to play —
  the user was firm on this.
- **Inline full-width detail row (Google-Images pattern).** Clicking `MORE` inserts a card as a
  **full-width row spanning all columns, after the row the tile is in** — not stuffed under one
  column (that misaligns the grid). Card **content is bounded (~760px) and centered** so it never
  stretches absurdly on 3–4-column / big screens. **This row-insert across changing column counts is
  the main engineering cost and the biggest eyeball risk** (column count changes 1→2→3→4 per
  breakpoint; re-place the card on resize).
- **One card open at a time (accordion).** Opening another closes the first — so trailers never
  stack/autoplay together.
- **2 columns desktop → stacks on mobile.** Desktop: `media | info`. Below 640px: single column,
  media on top. (2-col is desktop-only; a phone can't do side-by-side with a 9:16 media.)
- **Card info = title + description + centered Play.** **No tags in the card** — they already live on
  the tile; showing them again triples them (tile + kicker + chips). Removed.
- **Description = the real `seo.<slug>.howto` string.** Every game already has a rich, crawlable
  `<p data-t="seo.<slug>.howto">` in its `index.html`, **already i18n-keyed and pl-translated**
  (coverage-enforced). The card reads the same `t('seo.<slug>.howto')` key — **zero new content, zero
  new translation.**
- **All media is 9:16** so the card slot never changes between a trailer game and a screenshot game.
  Non-9:16 boards (snake, 2048) show as a centered board with letterbox bands — **accepted** (that's
  how they look on a phone). Portrait-native games (Bubble Pop) fill the frame.
- **Screenshots keep the score HUD**, hide only the utility buttons + side tab. (User's call: more
  "real game", matches trailer framing.)
- **Cozy mode only — NO strip in compact density.** The catalogue has two densities: default **cozy**
  (icon + title + tags + blurb + `PLAY ›`) and **compact** (`.grid.compact` — icon + name only,
  ~104px, ~3–4/row). The card is a cozy-mode feature; the `MORE ˅` strip renders **only when the grid
  is NOT `.compact`**. Rationale: compact exists for dense scanning, a full-width strip blows its
  density, and a tiny ˅ dot would be unclickable on a small phone (user's call). Compact users flip to
  cozy or just tap the game.

## Architecture

### 1. `games.js` — two per-game media fields

- `trailer: "trailer.v1.mp4"` — optional; only `trap-the-cat` + `forcefield` at first.
- `shot: "shot.v1.png"` — the gameplay screenshot; **every live game** eventually gets one.

Both are filenames relative to `games/<slug>/`. Versioned (`.v1`) so a recut/reshoot rotates cleanly
out of cache. Card media resolution: **trailer if `trailer` set, else `shot`, else text-only**.

### 2. Catalogue tile — the `MORE ˅` strip (every tile)

- Full-width strip at the tile bottom, mono + accent, hairline top border, `MORE ˅` (chevron rotates
  when open). Keyboard-reachable (focusable, Enter/Space). Click **stops propagation** so it doesn't
  launch the game.
- Localized label via `t()` (see i18n).

### 3. The game card (inline detail row)

- Kit-owned or catalogue-local component that builds the full-width row and inserts it after the
  clicked tile's row (compute row membership by `offsetTop`; re-place on resize). Bounded card
  (~760px), centered, accent border + glow, protruding `✕`, Esc/click-outside to close, focus
  restored to the strip on close.
- **Media column (9:16):**
  - **trailer:** `<video muted loop playsinline preload="none">` — autoplay on expand; a spinner
    until the first frame; **connection-aware weak fallback** (save-data / `effectiveType` < 4g →
    first-frame + tap-to-play instead of autoplay-fetch).
  - **screenshot:** `<img>` with `object-fit:cover` in the same 9:16 frame.
- **Info column:** title (+ glyph), `seo.<slug>.howto` text, **centered Play** button. No tags.
- Headless-safe: guard `video.play()` (rejects in jsdom); never throw on boot.

### 4. Assets — trailers

Compress the local v2-stage finals to preview grade (≤1.5 MB, 480px wide, `crf 30`, **audio
stripped**, faststart):

```bash
ffmpeg -i "promo/komyo-trailer/finals-games/game-v2-stage-9x16-trapthecat-catost.mp4" \
  -vf "scale=480:-2" -c:v libx264 -crf 30 -preset slow -an -movflags +faststart \
  games/trap-the-cat/trailer.v1.mp4
ffmpeg -i "promo/komyo-trailer/finals-games/game-v2-stage-9x16-forcefield.mp4" \
  -vf "scale=480:-2" -c:v libx264 -crf 30 -preset slow -an -movflags +faststart \
  games/forcefield/trailer.v1.mp4
```

Verify each ≤1.5 MB; if over, drop to `scale=432:-2` / `crf 32`. Keep the full-quality originals as
the YouTube uploads (not in the repo).

### 5. Assets — screenshots (capture from REAL play, NOT headless)

**Hard lesson from this session:** headless posing via `__test` does **not** render live-action games
1:1 — the eat-flash/trail effects, cosmetics, paused-state rendering and animation timing all differ
from a real browser (snake came out magenta-bodied with a segment trail; real snake is green
head→tail with a magenta food pellet). Turn-based/static games (2048, Bubble Pop) headless-capture
acceptably, but even those aren't guaranteed 1:1.

**Therefore screenshots are captured by actually playing each game.** Recipe:

- **Portrait window (~9:16)** so the shot fills the card's media slot (e.g. 414×736).
- **Play to a representative, lively moment** (a mid-game board, a decent score).
- **Keep the score HUD**; hide the utility buttons (pause/sound/controls/fullscreen/☰) + the side
  stack tab. (A small dev helper can toggle these, or crop.)
- Save as `games/<slug>/shot.v1.png` (or `.webp` for size). **Size-budget each ≤~150 KB** (compress);
  they load only on card expand.
- Default cosmetics unless a skin is the point.
- Non-9:16 boards: letterbox bands are fine (accepted).

The user can produce these directly from their browser (fastest, guaranteed 1:1) or the implementer
captures during the build. `plans/trailer-shots/{bubbles,2048}.png` are **placeholder concept shots
only** — replace with real-play captures at ship time.

### 6. Service worker — persistent media cache + connection-aware idle prefetch

Applies to **trailers** (screenshots are small — see note):

- **Not in the SHELL.** Trailers live in a dedicated `komyo-media` cache **never purged on SW VERSION
  bumps** (deploys don't re-download). Filename version (`v1`→`v2`) rotates entries.
- **Cache-first fetch handler** for `**/trailer.*.mp4`; **Range-request aware** (video scrubbing
  sends `Range:` — don't break seeking; document the chosen strategy).
- **Idle prefetch, connection-gated** (page-side): after `load`, `requestIdleCallback`, prefetch
  trailers **only if** `navigator.connection?.saveData !== true` and `effectiveType` is 4g+. Weak /
  metered → skipped; those users only fetch on an explicit tap.
- **Screenshots:** small PNG/WebP. Simplest correct approach: cache-first in the same `komyo-media`
  bucket on first card-expand (no forced prefetch needed given the size). Optionally add to the SHELL
  later if we want them offline-guaranteed — but keep them out of the SHELL initially to avoid
  bloating every deploy's precache (there will be ~one per live game).

### 7. Portal zip — exclude trailer (and probably the shot)

`scripts/package-game.mjs` builds `dist-portal/<slug>.zip`. **Exclude `trailer.*.mp4`** (promo, not
gameplay). Decide on `shot.*` — likely exclude too (it's a catalogue asset, not needed inside the
portable game). One ignore rule.

### 8. i18n

- `seo.<slug>.howto` — **reused, already translated.** No work.
- New player-facing strings needing `en` + `pl` (pl or the coverage suite fails): the `MORE` strip
  label + aria, the card's **Play** label, the card **close** label, the trailer spinner/weak-fallback
  text. Other locales may stay empty (fall back to `en`).

### 9. Tests

- Catalogue suite: `MORE` strip renders on tiles; clicking it opens a card and **does not launch the
  game** (propagation stopped); the card resolves media correctly (trailer vs shot vs text) from the
  `games.js` fields; only one card open at a time.
- Card component: open/close don't throw headless; `video.play()` guarded.
- SEO/lockstep + i18n coverage stay green.

## Rollout steps (checklist)

- [ ] `games.js`: add `trailer:` to `trap-the-cat` + `forcefield`; add `shot:` per live game (batch —
      can land incrementally, card falls back to text-only until a game's `shot` is set).
- [ ] Compress the two trailers (ffmpeg above); verify ≤1.5 MB; note actual sizes.
- [ ] Capture real-play screenshots (portrait 9:16, HUD kept, utility chrome hidden) for the first
      batch of live games; compress ≤~150 KB; save `games/<slug>/shot.v1.png`.
- [ ] Build the game-card component + full-width row-insert (row membership per breakpoint, re-place
      on resize), bounded/centered, headless-safe.
- [ ] Render the `MORE ˅` strip on every tile in `index.html` (keyboard-reachable, stops
      propagation, localized). Card media resolves trailer→shot→text.
- [ ] Card info: title + `t('seo.<slug>.howto')` + centered Play. No tags.
- [ ] Trailer: autoplay-on-expand, spinner, connection-aware weak fallback.
- [ ] SW `komyo-media` cache + cache-first (Range-aware) for `trailer.*.mp4`; connection-gated idle
      prefetch (page-side). Screenshots cache-first on first expand.
- [ ] `scripts/package-game.mjs`: exclude `trailer.*.mp4` (and `shot.*`).
- [ ] i18n: add `en` + `pl` keys for MORE / Play / close / spinner-fallback.
- [ ] Tests: strip presence + no-launch-on-click + media resolution + one-open; card open/close
      headless; i18n coverage green.
- [ ] `node test.mjs` + touched game suites — all green.
- [ ] **5-viewport eyeball** (Playwright MCP, headless): desktop 1280×800 · 1920×1080 · 2560×1440 ·
      portrait 360×640 · **landscape 640×360**. Focus: the **full-width row-insert across column
      counts** (1→4 cols), card bounding/centering on big screens, the 2-col→stack transition at
      640px, the 9:16 media slot (trailer + screenshot + text), and landscape overflow.
- [ ] `CHANGELOG` entry (player-facing): "Tap MORE on any game to see a card with a trailer or
      gameplay preview + how to play — right on the catalogue, no leaving the site."
- [ ] Do **NOT** bump each game's `updated:` — a catalogue card is not a change to the game itself
      (would trigger a spurious UPDATED badge).
- [ ] Hand to user for local eyeball; push only after approval (batch with other pending pushes).

## Trailer skill integration (do when trailers are added later)

New trailers must **replace** a game's screenshot in the card. The card already prefers a trailer over
a screenshot (`gcBuild`: `hasVid = !!g.trailer; hasShot = !hasVid && !!g.shot`), so the only work is
wiring the field. **Add a final step to the `komyo-game-trailer` skill:**

> After the compressed `games/<slug>/trailer.v1.mp4` is placed, set **`trailer: "trailer.v1.mp4"`** on
> that game's `games.js` entry. The catalogue game-card then shows the trailer instead of the
> screenshot automatically. Optionally remove the now-redundant `games/<slug>/shot.v1.webp`.

(The skill lives under `~/.claude` — per the global rule, the change is provided here for the user to
apply, not edited directly.)

## Out of scope (deferred, not forgotten)

- **In-game ☰ "▶ Watch trailer" row** — cheap follow-up if the card component is reusable; lower
  value (player is already in the game).
- **Consent-gated richer preview / thumbnails** — only worth it at much larger scale; the on-site
  self-hosted media already avoids tracking, so no consent gate is needed for it.
- **`snake` trailer** — local `snakebanger` final exists (9.2 MB); onboard via `trailer:` once
  verified, in a later batch.
- **Automated screenshot capture** — parked. Live-action games don't headless-pose 1:1; real-play
  capture is the reliable route. Revisit only if a per-game "screenshot mode" test hook is added.
