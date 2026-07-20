# komyo trailer — design spec (brand truth)

Derived from the score-card design language (`buildScoreCard` in `~/arcade/game-kit.js`) per
`plans/promo-content-plan.md`: "every marketing asset is derived from the score card's design
language." Share the *language*, not the layout.

## Palette

- **Canvas:** `#0a0f17` → `#121a28` (the card's base gradient). For full-frame fills use a
  RADIAL gradient or solid `#0b0e17` + localized glows (linear full-screen gradients band in H.264).
- **House accent:** `#2ee8c8` (teal — frame, wordmark glow, CTA, QR ring).
- **Type colors:** headline `#eef4fc` · secondary `#9fb2c8` · label `#67788f` · body `#cdd9e8`
  · url `#dfe9f5`.
- **Multi-accent motif:** each game keeps its own accent in tiles/frames/captions (that IS the
  breadth pitch). Live-game accents:
  asteroids `#9fe8ff` · asteroids+ `#b98cff` · keep-defender `#e0b25a` · forcefield `#38bdf8`
  · bubbles `#2ee8c8` · frog-bonk `#7ed957` · breakout `#ff5cc8` · sudoku `#f0b429`
  · stacker `#ff9aa2` · trap-the-cat `#f0a6c8` · flappy `#8fd3a6` · range `#ff7a3c`
  · snake `#7fffb0` · 2048 `#f2b179` · minesweeper `#35e0ff` · balloon-pop `#ff9ec2`
  · critter-match `#ffb86b` · glow-says `#7ee787`.

## Brand marks

- Wordmark: lowercase `komyo`, weight 900, white→accent vertical gradient
  (`linear-gradient(180deg,#fff 30%, var(--accent) 120%)`) + accent drop-shadow glow.
- Mascot: `assets/brand/mascot-head.svg` (chibi fox head) · logo `assets/brand/logo-512.png`.
- URL lockup: `komyo.online` mono 700 (JetBrains Mono), accent or `#dfe9f5`.
- QR: `assets/qr.js` → `window.KOMYO_QR.encode('https://komyo.online?utm_source=trailer&utm_medium=video')`
  drawn dark `#0b0e17` on white rounded card, accent ring shadow. (Short URL = big modules.)

## Score-card texture kit (reuse everywhere)

- **Neon frame:** rounded 24–30px, 3px accent border @ 65% + outer glow `0 0 42px accent40%`
  + inset glow.
- **Perspective grid floor:** accent lines @ 8–10% opacity converging to a horizon at ~55% height.
- **Sparkles:** 10–16 dots (65% accent / 35% white), soft radial halos, slow drift/breathe.
- **Top accent bloom:** wide radial ellipse from top-center, accent @ ~34%, on the canvas.

## Typography (HyperFrames embedded set)

- **Display / slams:** `Archivo Black` (400 only — already heavy). Tracking -0.02em. White or
  accent; big: 96–200px (16:9), 84–150px (9:16).
- **UI / captions / chips:** `Montserrat` 700/900.
- **Data / metadata / url:** `JetBrains Mono` 400/700 (the card's monospace register).
- Never mix in another sans. Register switching: Archivo = shout, Montserrat = speak, Mono = data.

## Caption chips (V1 raw register)

White 800 Montserrat on `rgba(11,14,23,.86)` chip, radius 16px, `box-decoration-break: clone`,
accent `<b>` keywords. 9:16: keep hooks in the upper third (clear of TikTok top UI), captions
≥ 460px above bottom (clear of TikTok bottom band); 60px side margins.

## Audio

- `assets/audio/snakebanger-76s.m4a` — 122 BPM, first beat at 0.06s, beat 0.4918s, bar 1.96721s
  (beat grid in `snakebanger-76s.beats.json`). V1 + V2 bed.
- `assets/audio/forcefield-76s.m4a` — 128 BPM, first beat 0.06s, beat 0.46875s, bar 1.875s. V3 bed.
- Cut ON the bar grid; slams land on downbeats. Fade music out over the last 1.5–2s.
- Both tracks open ~2 bars sparser (intensity ramp) — use that as the hook's headroom.

## Key strengths (the message — pick per beat, do not dump all at once)

free forever · no ads · no paywalls · no accounts · no "your kid wants to buy something" ·
plays in the browser · installs like an app (PWA) · works offline · your data stays on your device
· kid-safe · 18 games live, more coming.

Footer one-liner (site truth): "built for fun · free forever · no ads · no accounts · kid-safe ·
every game works offline".

## Footage (all 1920×1080@60; trims via `data-media-start`; scouted windows)

| file | game | accent | window (s) | juice | focusX (9:16 object-position) |
|---|---|---|---|---|---|
| 5_gameplay_frogs | Frog Bonk | #7ed957 | 0.5–7.0 | COMBO ×51→×64, castle flash @4.0 | 0.5 |
| 6_gameplay_snake | Neon Snake | #7fffb0 | 0.0–4.5 | food @1.5, @3.5 | 0.45 |
| 6_gameplay_forcefield | Forcefield | #38bdf8 | 1.5–6.5 | ×6 +44 @3.0, BREACH flash @5.7 | 0.5 |
| 4_gameplay_stack | Stack | #ff9aa2 | 2.0–7.0 | confetti @7.0 | 0.5 (best vertical) |
| 5_gameplay_2048 | 2048 | #f2b179 | 2.0–7.0 | 64 merge @3.8 | 0.5 |
| 6_gameplay_td | Keep Defender | #e0b25a | 3.5–8.0 | AoE blasts, WAVE 12 @7.5 | 0.35 |
| 7_gameplay_asteroids | Asteroids | #9fe8ff | 0.5–4.5 | FRENZY @3.0 (avoid >5.5 empty) | 0.5 |
| 3_gameplay_flappy | Meadow Flyer | #8fd3a6 | 1.0–6.0 | bursts @4.0/5.0 | **0.08 — left-anchored crop** |
| 3_gameplay_kitten | Trap the Cat | #f0a6c8 | 2.0–6.3 | trap hearts @6.0 | 0.47 |
| 4_gameplay_memory | Critter Match | #ffb86b | 4.0–8.4 | board win @8.4 | 0.5 (board clips a bit) |
| catalogue | site scroll | #2ee8c8 | 0.3–4.5 | badges/tiles | 16:9 only (grid dies vertical) |
| collections | Collection modal | #2ee8c8 | 0.5–5.5 | skins + music rows | modal survives vertical |

Avoid each clip's tail end screens (flappy ≥6.5 "Oh no!", kitten ≥6.8, stack ≥7.6 "OOPS!",
forcefield ≥8.0 "PLANET LOST").
