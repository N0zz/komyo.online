# komyo trailer — the three versions (beat sheets)

Craft rules from `plans/promo-content-plan.md`: first 3s decide everything; front-load the
differentiators; kinetic captions over CONTINUING gameplay (never full-stop text panels, one hero
card max); the kid-purchase-nag gets its own beat; breadth montage weighted heaviest; CTA lingers.
All cuts land on the music's bar grid. Files are standalone (no sub-comps) so each version is
independently editable; every gameplay `<video>` uses `data-media-start` trims from `frame.md`.

Outputs (renders/): `v1-16x9.mp4 v1-9x16.mp4 v2-16x9.mp4 v2-9x16.mp4 v3-16x9.mp4 v3-9x16.mp4`.

## V1 — "raw & simple" (polished POC register) · snakebanger 122bpm · ~35s / ~30s

Full-bleed gameplay, chip captions, hard cuts on bars, brand pill watermark, simple end card.
Bar grid: 0.06 + n×1.96721.

| bars | t (s) | shot | copy (chips) |
|---|---|---|---|
| 0–2 | 0.0–4.0 | frogs (busiest) | hook: "tiny free browser games" / "**no catch.**" |
| 2–4 | 4.0–7.9 | forcefield (×6 → BREACH) | "**NO ADS.**" → "**NO PAYWALLS.**" (beat slams) |
| 4–6 | 7.9–11.9 | snake | "**NO ACCOUNTS.**" → "no 'your kid wants to buy something.'" |
| 6–7 | 11.9–13.8 | stack (confetti) | montage begins — game title chips |
| 7–8 | 13.8–15.8 | 2048 (64 merge) | |
| 8–9 | 15.8–17.8 | td (AoE) | |
| 9–10 | 17.8–19.7 | asteroids (FRENZY) | |
| 10–11 | 19.7–21.7 | kitten (trap) | |
| 11–13 | 21.7–25.6 | flappy | "works **offline** · installs like an app" |
| 13–15 | 25.6–29.6 | catalogue scroll (16:9) / collections (9:16) | "18 games · more every week" |
| 15–18 | 29.6–35.5 | end card | wordmark + pills + QR + **komyo.online** (lingers) |

9:16 drops the catalogue beat → collections modal; captions upper-third/safe-band per frame.md.

## V2 — "high-quality cinematography" · snakebanger · ~59s / ~39s

The score-card WORLD as a stage: dark canvas, top bloom, perspective grid floor, sparkles.
Gameplay lives in neon score-card frames that fly/tilt in 3D; kinetic Archivo slams between;
velocity-matched transitions; one hero moment (the anaphora build). Structure:

1. **Cold open** (bars 0–2): black → wordmark draws in with glow + grid floor rises. Mono
   metadata top corners ("browser games / free forever" ticker).
2. **Hook burst** (2–6): three ~1-bar gameplay hits INSIDE full-bleed zoom (frogs, forcefield
   breach, snake), whip-pan between, each with its accent flashing the frame.
3. **Anaphora hit** (6–12, the hero): gameplay keeps rolling in a tilted card behind; giant
   Archivo slams stack on beats: NO ADS. / NO PAYWALLS. / NO ACCOUNTS. / then the specific one
   held longer: NO "YOUR KID WANTS TO BUY SOMETHING." (quote styled as a system-dialog chip).
4. **Breadth constellation** (12–20): the multi-accent motif — framed clips cascade through the
   grid-floor stage (stack, 2048, td, asteroids, kitten, memory), each 1 bar, camera drifting;
   accent-colored title pills.
5. **Any device + offline** (20–26): flappy full-bleed → shrinks into a phone-shaped frame
   (portrait crop) standing on the grid floor; wifi glyph slashes off; "still plays." chip;
   "installs like an app · your data stays on your device".
6. **Features quick** (26–28): collections modal in a card, one bar; "unlock skins with trophies".
7. **CTA** (28–30 bars ≈ 55–59s): end card — wordmark, strengths pills, QR card, url; sparkles;
   grid floor; fade music.

9:16 (~39s): beats 1(short)·2·3·4(4 clips)·5(native portrait)·7.

## V3 — different concept: "the pain → the cure" (parody open) · forcefield 128bpm · ~50s / ~35s

Structurally different from V2: a NARRATIVE, not a showcase. Dramatizes the origin story
(hunting clean games / ad-swamped sites / the kid-purchase nag) as a fake "OTHER games site"
built in HTML — then komyo wipes it all away. Bar grid: 0.06 + n×1.875.

1. **The pain** (0–7.5s, NO music — only annoying UI dings): a parody site "FreeGamezPortal"
   assembles itself: a tiny cramped game iframe drowning under: banner ads, a cookie wall,
   "REGISTER TO CONTINUE", a spinning prize wheel, popup on popup (each lands with a 'ding').
   Beat: the system dialog "Your kid wants to buy 500 gems (12,99 €) — Allow?" slides in, HOLD.
   Mono caption: "finding a clean game shouldn't be this hard."
2. **The wipe** (7.5s): everything SLAMS off-screen (gravity drop + whoosh) → 1 beat of pure
   dark → forcefield track DROPS in full.
3. **The cure** (7.5–24s): full-bleed clean gameplay (frogs → snake → forcefield breach →
   stack), calm chips in sequence: "just games." / "free forever." / "no ads. no accounts." /
   "no purchase nags. ever."
4. **Everywhere** (24–32s): 2048 + flappy; chips "browser · phone · installed app" /
   "works offline — data stays on your device".
5. **Proof** (32–38s): catalogue scroll (16:9) / collections (9:16): "18 free games. more coming."
6. **CTA** (38–50s): end card, but V3-flavored: the parody site's carcass (tiny, grayscale,
   crossed out) vs the komyo card ("this, instead."), QR + url linger.

9:16 (~35s): compress pain to 5.5s (3 popups + the nag), same wipe, 3 gameplay chips, CTA.

## Shared implementation notes

- Root sized per format: 1920×1080 (`data-resolution="landscape"`) / 1080×1920 (portrait).
- `<video>`/`<audio>` at host root only; trims via `data-media-start`; audio fades via
  `tl.to('#bgm',{volume:0,...})`.
- 9:16 crops: `object-fit:cover` + `object-position:<focusX> 50%` (flappy 8%).
- Safe bands (9:16): hooks top ~430px, captions bottom ≥460px, brand pill top-left.
- Every scene: bg texture + midground + foreground metadata (video-composition density rule).
- QR drawn once per file via inline script from qr.js (deterministic, no network).
