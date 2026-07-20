---
name: komyo-game-trailer
description: >-
  Create the two 9:16 promo trailers (V2 "stage" + V3 "hype") for one komyo game
  from a gameplay recording, plus ready-to-paste TikTok / YouTube Shorts titles
  and descriptions. Use this WHENEVER the user asks for a trailer, promo video,
  Short, or TikTok for a komyo game. Expects two inputs: WHICH GAME (a games.js
  slug) and the GAMEPLAY RECORDING file path — ask for whichever is missing.
  Triggers on "make/create a trailer for <game>", "trailer for the <game> game",
  "promo video for <game>", "cut a Short/TikTok for <game>".
---

# Create a komyo game trailer pair

You turn **one gameplay recording** of a komyo game into **two finished 9:16
60fps trailers** — V2 "stage" (cinematic score-card world, gameplay in a neon
card) and V3 "hype" (near-full-bleed graded gameplay, kinetic word slams) — and
hand back the mp4 paths **plus upload metadata** for TikTok and YouTube Shorts.

Everything lives in the trailer project, NOT in ~/arcade:

```text
~/komyo-promo/komyo-trailer/
  variants/game-v2-stage-9x16.html   V2 base template (forcefield demo, 128bpm grid)
  variants/game-v3-hype-9x16.html    V3 base template (same grid)
  assets/footage/                    prepped per-game clips (<slug>_p.mp4)
  assets/audio/                      music beds (<track>-76s.m4a + .beats.json)
  tools/render-music.mjs             offline render of the kit's procedural OST
  tools/RECORDING.md                 how recordings are captured + release cadence
  finals-games/                      rendered outputs
```

## Hard rules (decided with the user — do not re-litigate)

- **The game's OWN OST is the only music bed.** No shared/house anthem, no
  forcefield bed A/B (dropped 2026-07-20: the original OST always fit better).
- **QR stays static** — the templates show it with an opacity fade only. Never
  add scale pops, pulses, or drift to `#qrcard` (dropped 2026-07-20).
- **60fps render, real-time footage.** No slow-mo (kills unique-frame cadence),
  no speed-ups. Root `data-fps="60"` + `--fps 60`.
- **Full vertical composition, never a crop-pan** of the gameplay.
- **No game-count copy** ("18 games" rots; "18+" reads NSFW). Count-free
  strengths only: free · no ads · no accounts · works offline · kid-safe.
- **No invented features in copy.** Verify every claim against games.js
  blurb/tags and what the footage actually shows.

## Inputs (ask if missing)

1. **Game slug** — must exist in `~/arcade/games.js`.
2. **Recording path** — ideally 1080×1920 @ 60fps portrait, captured per
   `tools/RECORDING.md`. Several rounds in one take is expected.

## Step 1 — Gather the game's facts

- From `~/arcade/games.js`: `title`, `blurb`, `accent`, `tags`, the live URL
  `https://komyo.online/games/<slug>/`.
- Music track: grep the game's `index.html` for `KIT.music.play('<track>')`,
  then the track's `bpm` from the `tracks` table in `~/arcade/game-kit.js`.
- Derive the timing math from the bpm (the templates ship on forcefield's
  128bpm grid): **SCALE = 128 / bpm**, **BAR = 240 / bpm** (= 4 × 60/bpm).

## Step 2 — Prep the footage

1. `ffprobe` the recording (dims/fps/duration). Conform to 1080-wide portrait
   if needed (`scale`, pad if aspect is off).
2. Extract a full-res top strip (`crop=1080:340:0:0`, one frame) and **measure
   the nav chrome height by eye** — crop just past the nav buttons (~96px at
   dpr 2), KEEPING the in-game HUD pill. The bottom version-stamp footer stays:
   the templates crop it via `transform: scale(1.03)`.
3. Encode: `ffmpeg -i <rec> -vf "crop=1080:<H>:0:<Y>" -c:v libx264 -crf 18 -an
   -movflags +faststart assets/footage/<slug>_p.mp4` (H even).
4. **Map the recording**: a 4s-per-tile montage first
   (`-vf "fps=1/4,scale=135:240,tile=8xN"`), then 2fps strips around anything
   interesting. Chart: round boundaries, win/end-card pops (exact second),
   menu/modal/shop detours to AVOID, skin changes.

## Step 3 — Pick the clip windows (then VERIFY each one)

- **V2** = four ~4s windows (`data-media-start` on `#v1..#v4`): variety first —
  different skins/boards/modes across v1–v3, and the **payoff last**: v4 opens
  ~1.5–2s before the win/end-card pop so the pop lands inside the window.
- **V3** = one continuous window (`#bed`): pick `media-start` so the climax pops
  ~1.5–2s **before** the CTA hand-off (`HO = bar(8)`, footage time at HO =
  media-start + HO·… after scaling — compute it, don't guess).
- **Empirically verify EVERY window** by extracting frames at its start / mid /
  end from the SOURCE at those timestamps before rendering. Recordings hide
  earlier-round win cards where "obviously gameplay" should be (the trap-the-cat
  hero window opened on a stray win card at footage 21s — caught only on the
  rendered frames). Windows must also clear the modal detours at their SCALED
  (longer) durations.

## Step 4 — Render the game's OST bed

```bash
cd ~/komyo-promo/komyo-trailer/tools
node render-music.mjs <track> 76 ../assets/audio/<track>-76s.wav "0:0.55,2:0.7,6:0.9,10:1"
cd ../assets/audio && ffmpeg -i <track>-76s.wav -c:a aac -b:a 192k <track>-76s.m4a && rm <track>-76s.wav
```

The printed bpm and the `.beats.json` `barDur` must match your BAR — if not,
your track lookup was wrong.

## Step 5 — Author the two variants

Copy each base template to `variants/game-v2-stage-9x16-<slug>.html` /
`variants/game-v3-hype-9x16-<slug>.html`, then do BOTH passes with a small
python script using **asserted exact-string replacements** (`assert
text.count(old) == 1`) — never freehand-edit 24KB of timing attributes:

**Retarget pass** (content):

- `--accent` on `<body>` AND `accent:` in the `GAME` config → the games.js accent.
- All 4 (V2) / 1 (V3) `<video src>` → `assets/footage/<slug>_p.mp4` + the
  chosen `data-media-start`s.
- Copy slots — V2: hook slam + 3 feature lines + `cardsub` + `gametag` + CTA tag;
  V3: 4 word slams + `gametag` + `wordmark`. Keep the arcs:
  - V3 slams: short statement → escalation → 2-line punch (`s-b`) → lowercase
    question (`s-q`). ALL-CAPS with one `<em>` accent word each; s-a fits ~11
    chars/line at 176px.
  - V2: hook = the game's verb ("CORNER THE CAT."); features = short lowercase
    with one `<b>` word each.
- `qrUrl` → `https://komyo.online/games/<slug>?utm_source=tr&utm_medium=qr`;
  both visible URL lines → `komyo.online/games/<slug>`.

**Scale pass** (timing — only when bpm ≠ 128): multiply every `data-start` /
`data-duration` by SCALE (3 decimals), set `var BAR = <240/bpm>`, swap the
`<audio src>` to the game's bed, and scale the `#bgm` fade-out timeline position
(V2: `21`, V3: `20.1`). **`data-media-start` is NEVER scaled** (real-time source
offsets). Lint gotcha: after scaling, no small `.clip` `data-start` (gametag/
brand/meta) may land within 0.05s of an exit-tween duration (0.26/0.3/0.34/0.35)
or the linter false-triggers `gsap_exit_missing_hard_kill` — nudge the start if
it does.

## Step 6 — Render + QA

```bash
cd ~/komyo-promo/komyo-trailer
cp variants/game-v2-stage-9x16-<slug>.html index.html
npx --yes hyperframes@0.7.53 render --fps 60 --quality high --output finals-games/game-v2-stage-9x16-<slug>.mp4
# same for v3
```

QA before handing over: extract a 6-frame grid per render at the key beats
(hook, each window/slam, payoff, CTA) and READ the frames — check every window
shows what you intended, text doesn't collide, accent/QR/URL are the game's.
Confirm an `aac` audio stream exists. Fix and re-render anything off — a wrong
window costs one 45s re-render, a wrong upload costs a platform slot.

Then give the user the mp4 paths for their local eyeball pass — they review
before uploading anywhere.

## Step 7 — Upload metadata (always part of the deliverable)

Produce per-trailer, per-platform metadata, paste-ready in fenced blocks:

- **YouTube Shorts** — Title ≤100 chars (hook + game name + "free browser
  puzzle/game"); description = 1–2 hook sentences (first line shows under the
  title), then `Play free in your browser (no ads, no accounts, works offline):`
  + `https://komyo.online/games/<slug>?utm_source=yt&utm_medium=shorts`, then
  hashtags starting `#Shorts` + genre/theme tags.
- **TikTok** — one caption: hook (POV/question style works), plain-text URL
  (links aren't clickable — short domain, no UTM noise:
  `komyo.online/games/<slug>`), hashtags incl. genre + `#fyp`.
- **Cadence rules** (repeat them to the user, from `tools/RECORDING.md`):
  YT Shorts are winner-take-all — post ONE at a time, 3–5 days apart (doubles
  as a sequential A/B). TikTok: both versions, staggered by hours/a day.
  1 game = a week of content, not a one-time dump.

## Definition of done

- `assets/footage/<slug>_p.mp4` + `assets/audio/<track>-76s.m4a` (+beats) exist.
- Two variant HTMLs in `variants/`, on the game's own bpm grid + OST.
- Two 60fps mp4s in `finals-games/`, QA'd frame-by-frame at the key beats.
- TikTok + YT Shorts titles/descriptions delivered with the cadence reminder.
- User pointed at the files for the eyeball pass — nothing published for them.
