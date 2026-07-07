# Audio v2 — ship the reactive music engine

Near-term execution plan: promote the Audio Lab mock (`plans/audio-lab.html`) into the real kit — the
generative **"modern" engine becomes the default in-game music for all 11 games**, driven by gameplay
intensity, with music as a new **cosmetic** (preview + unlock). Stays zero-asset (pure Web Audio).

Reference: the mock (`plans/audio-lab.html`) is the source of truth for the engine + per-game palettes;
`plans/audio-lint.mjs` is the distinctness linter (already linter-clean: 0 hard flags). Future "scale to
hundreds" work is the separate `plans/audio-music-plan.md`.

## Decisions locked
- **Scope:** new reactive engine for **all 11 games** (not snake-only).
- **Snake default = Modern·Remaster**; **Modern·Banger** is an unlockable music cosmetic (~100 🏆).
- Layer changes from intensity must **ease/fade in**, never pop.
- **`.ogg` files stay off** — procedural only.

## Phase 1 — Port the engine into `game-kit.js` (music engine v2)
- [x] Move the mock's synth voices (`voice`/`superVoice`/`noiseBurst`/`kick`/`snare`/`clap`/`hat`/`tom`),
  buses (`reverb`/`delay`/`padBus`/`drumBus`), `duck`, and the loudness-normalized levels into the kit's
  music engine (all headless-guarded, like today's engine).
- [x] Bring over the **track schedulers**: `enhStep` (modern, groove-driven), `snakeModern` (remaster),
  and the per-game `perc` kits + grooves (banger/rave/trance/tactical + prod epic/lush/synthwave).
- [x] Define a **track registry** = merged theme+palette specs (from the mock), keyed per game
  (`snake`, `snake.banger`, `asteroids`, `asteroidsplus`, `forcefield`, `range`, `breakout`, `bubbles`,
  `frogbonk`, `keep`, `meadow`) with the mock's unique progressions/keys. Keep Defender needs **6 biome
  tracks** (reuse the castle/epic palette with 6 distinct progs).
- [x] `music.play(trackId)` renders from the registry. Keep the API shape (`play/stop/volume/muted/
  subscribe/current`) so games change one string. Old theme keys alias to their game track.
- [x] **Intensity API:** `music.intensity(target 0..1)` / `music.intensity()`. The engine keeps a
  *smoothed* current value that eases toward target each scheduler tick (no jumps).
- [x] **Eased layer transitions (item 3):** every layer (hats, arp, snare, sub, doubles, fills…) gets a
  `presence` 0..1 = a smoothstep of intensity around its entry threshold, eased over ~1–2 bars; note
  gains multiply by `presence` so layers **fade in/out** instead of switching on a step.
- [x] Verify **Asteroids / Asteroids+** (handle-with-care, own engines) adopt kit music cleanly.

## Phase 2 — Gameplay-driven intensity per game (item 2 — TBD per game)
Each game maps its state → intensity 0..1 and calls `music.intensity(v)` (per frame or on change; kit
smooths). Zen/gentle/kids modes bias low. Proposed sources (tune during playtest):

| Game | Intensity driven by (proposed) |
| --- | --- |
| Neon Snake | snake length / speed |
| Asteroids · Asteroids+ | rocks on screen + wave (+ boss / near-ship danger) |
| Keep Defender | live enemies + wave # + low keep HP |
| Forcefield | spawn rate / difficulty ramp / low shields |
| Bubble Pop | board fill % + active combo |
| Frog Bonk | wave + active enemies + combo streak |
| Brick Breaker | bricks cleared % + ball speed + level |
| Stack | tower height + drop speed |
| Range | streak / reaction pace / time pressure |
| Meadow Flyer | scroll speed / score |

- [x] Wire each game's `update` to compute + feed intensity.
- [x] Confirm `__test` still drives cleanly (intensity is inert headless).

## Phase 3 — Music as a cosmetic (items 4 & 5)
- [x] Extend `cosmetics.js` with a **music category**: set `<game>.music`, items = default (price 0) +
  alts. **Snake:** `snake.music` = `{ remaster (default, 0), banger (~100 🏆) }`.
- [x] Kit reads the selected track at music start: `music.play(cosmetics.selected('<game>.music') || default)`.
  Re-apply on selection change.
- [x] Snake default flips to **remaster**; banger only plays when owned+selected.
- [x] i18n: add `cos.*` name/desc keys for the new music items in **`pl` + every locale** (coverage test
  enforces) — use the `komyo-i18n-translate` skill.

## Phase 4 — Preview in the Collection shop (item 6)
- [x] `music.preview(trackId)` / `music.stopPreview()` — plays a track on demand without clobbering the
  game's current music state; auto-stops on modal close / switching item / second press.
- [x] `shopPanel` renders a **▶ Preview** control on music items (toggle play/stop, clear playing state).
- [x] Decide: preview plays even if the Music channel is muted (explicit user action) — likely yes, at a
  fixed preview volume.

## Phase 5 — Tests · changelog · polish
- [x] All suites green (`node test.mjs` + per-game). Music engine boots headless; games boot; cosmetics
  + i18n coverage pass.
- [x] `changelog.js`: one player-facing entry (richer music that builds with the action · Snake remaster
  + unlockable Banger in the Collection · preview before you buy).
- [x] No new files → root `sw.js` SHELL unchanged (engine lives in `game-kit.js`).
- [ ] Update `plans/audio-lint.mjs` to read the kit's real track registry (lint production music, not just
  the mock). — NOT DONE (still reads the mock; nice-to-have follow-up).
- [x] Local browser eyeball before push (music/UX can't be headless-verified) — offer the local URL.

## Open questions (resolve during build, non-blocking)
- Keep Defender biome tracks: 6 distinct progs vs fewer shared — pick during Phase 1.
- Intensity smoothing constants + update cadence — tune in playtest.
- Preview vs Music-mute interaction (Phase 4 above).
