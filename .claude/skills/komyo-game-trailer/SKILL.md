---
name: komyo-game-trailer
description: >-
  From one gameplay recording of a komyo game, produce the full media set: the
  9:16 social promo trailer (V2 "stage"), a text-free full-bleed gameplay PREVIEW
  loop for the catalogue game card, and a still fallback — then wire them into the
  site and hand back paste-ready TikTok / YouTube titles and descriptions. Use this
  WHENEVER the user asks for a trailer, promo video, Short, TikTok, or catalogue
  preview for a komyo game. Expects two inputs: WHICH GAME (a games.js slug) and the
  GAMEPLAY RECORDING file path — ask for whichever is missing. Triggers on
  "make/create a trailer for <game>", "trailer/promo/preview for the <game> game",
  "cut a Short/TikTok for <game>".
---

# Create a komyo game trailer + card preview

From **one gameplay recording** you produce **three assets** and wire them into the site:

1. **Social trailer** — V2 "stage" (cinematic score-card world, gameplay in a neon card, hook +
   feature lines + CTA + scan-to-play QR). 9:16 60fps. For TikTok / YouTube / Instagram / Facebook.
2. **Card preview loop** — a **text-free, full-bleed** gameplay loop shown in the catalogue game
   card (`games/<slug>/preview.v1.mp4`). Language-neutral (no baked text), so it's correct in every
   locale — the card's own translated blurb/how-to does the describing.
3. **Still fallback** — `games/<slug>/shot.v1.webp` (720×1280), shown when the preview can't play
   (save-data, video error) and required by the catalogue as the media fallback.

Everything lives in the trailer project (in-repo; templates/tools tracked, footage/beds/renders gitignored):

```text
~/arcade/promo/komyo-trailer/
  variants/game-v2-stage-9x16.html   V2 social base template (forcefield demo, 128bpm grid)
  tools/card-loop.sh                 builds the card PREVIEW loop from footage (seamless-loop recipe)
  tools/render-music.mjs             offline render of the kit's procedural OST
  tools/RECORDING.md                 how recordings are captured + release cadence
  assets/footage/                    prepped per-game clips (<slug>_p.mp4)
  assets/audio/                      music beds (<track>-76s.m4a + .beats.json)
  finals-games/                      rendered social trailers
```

## Hard rules (decided with the user — do not re-litigate)

- **One social trailer, one render, all platforms.** V2 "stage" is the ONLY social format —
  V3 "hype" is retired (2026-07-24). No per-platform QR variants: the single render's generic QR
  (`utm_source=tr`) serves every channel. (Decided after per-platform renders proved not worth it.)
- **The card preview is a SEPARATE asset from the social trailer** — text-free full-bleed gameplay,
  never the V2 stage cut. The V2 layout boxes gameplay in empty stage space and is built around
  English text; it does NOT fit a game card. Never point the card `preview:` at a V2 render.
- **Frame 0 is a poster.** Every composition's first frame must be composed and content-bearing —
  no element that carries "what is this" (the gameplay) may be at `opacity:0` on frame 0, or the
  thumbnail is black. The V2 opening card starts VISIBLE and rises in (not a fade-from-black).
- **The game's OWN OST is the only music bed.** No shared/house anthem (dropped 2026-07-20).
- **QR stays static** — opacity fade only, never scale pops/pulses/drift on `#qrcard` (2026-07-20).
- **60fps render, real-time footage.** No slow-mo, no speed-ups. Root `data-fps="60"` + `--fps 60`.
- **Full vertical composition, never a crop-pan** of the gameplay.
- **No game-count copy** ("18 games" rots; "18+" reads NSFW). Count-free strengths only:
  free · no ads · no accounts · works offline · kid-safe.
- **No invented, understated or half-true claims in copy.** Every claim traces to the GAME SOURCE
  (Step 1), not to the footage — a capture is one session and silently omits modes, player counts
  and penalties. Understating counts as lying too ("solo or 2-player" for a 1–4-player game). Ship
  a **claim audit** (claim → file:line) with the metadata; anything you can't cite, cut.

## Inputs (ask if missing)

1. **Game slug** — must exist in `~/arcade/games.js`.
2. **Recording path** — ideally 1080×1920 @ 60fps portrait, per `tools/RECORDING.md`. Several rounds
   in one take is expected (the more variety captured — themes, skins, modes — the better the preview).

## Step 1 — Gather the game's facts

**READ THE GAME'S SOURCE. A recording is one session, not the feature set.** Every copy claim comes
from the source below; the footage only proves a claim is *visible*, never that it's *complete*.
(2026-07-26: copy written from footage alone shipped "no way to lose" for a game with a penalty
mode, "solo or 2-player" for a 1–4-player game, and listed a `SOON` mode as playable.)

- **`seo.<slug>.howto` in `~/arcade/i18n.js`** — read it for orientation only. **It is PROSE, not a
  spec, and paraphrasing it invents mechanics**: "Boards grow from a quick 4×3 to a challenge grid"
  describes a size *picker*, and became the false line "boards that grow". Never lift a phrase from
  it into copy — go to the option definitions and describe what you find there.
- **The option definitions are the ONLY authority** — the `MODES`/`MODE_ORDER` consts and the
  `menu.show` `groups`/`toggles` `choices` in `games/<slug>/index.html`. Quote their real values
  (Critter Match's boards are `{small:6, medium:10, large:15}` pairs → "6, 10 or 15 pairs").
  **Count every choice in the row, including the default**, and state the full range: the PLAYERS row
  is `Solo / 2P / 3P / 4P` → the game is **1–4 players**; writing "2–4" drops the default and
  understates. Two more traps that make copy a lie:
  - **`locked: true` + a `tag: 'SOON'` choice is NOT playable** — never list it (Range's Reaction).
  - **A play-variant state var** (`let play = 'solo' | 'p2' | 'p3' | 'p4' | 'speed'`) carries modes
    the menu shows as separate rows — count them all (Critter Match is 1–4 players *and* Speedrun).
- **Penalty/fail mechanics** — grep the mode `mech:` lines and the game's hint strings. "No way to
  lose" is only true if NO mode penalises (Balloon Pop's Bees mode costs 5 pops per sting).
- From `~/arcade/games.js`: `title`, `blurb`, `accent`, `tags`, `icon` (the gametag emoji MUST be
  the games.js `icon`, not one you pick), the live URL `https://komyo.online/games/<slug>/`.
- Music track: grep the game's `index.html` for `KIT.music.play('<track>')`, then the track's `bpm`
  from the `tracks` table in `~/arcade/game-kit.js`. **Resolve aliases** — `music.play('tactical')`
  hits the `ALIAS` map and renders as `range`; `render-music.mjs` only knows real track names.
- Timing math from bpm (templates ship on forcefield's 128bpm grid): **SCALE = 128 / bpm**,
  **BAR = 240 / bpm** (= 4 × 60/bpm).

## Step 2 — Prep the footage

1. `ffprobe` the recording (dims/fps/duration). Conform to 1080-wide portrait if needed.
2. Extract a full-res top strip and **measure the nav chrome height by eye** — crop just past the
   nav buttons (~96px at dpr 2), KEEPING the in-game HUD pill. Leave the bottom version-stamp footer
   IN (`_p.mp4` keeps it — the V2 card's `object-position` window simply ends above it, see the Step 5
   fit pass; the card loop crops it explicitly in step 6b). **If the fit pass puts that game on
   `object-fit: contain`, the whole source height shows and the footer appears** — re-encode that
   game's `_p.mp4` with `crop=1080:1784:0:0`.
3. Encode: `ffmpeg -i <rec> -vf "crop=1080:<H>:0:<Y>" -c:v libx264 -crf 18 -an -movflags +faststart
   assets/footage/<slug>_p.mp4` (H even).
4. **Map the recording**: a 4s-per-tile montage (`-vf "fps=1/4,scale=135:240,tile=8xN"`), then 2fps
   strips around anything interesting. Chart: round boundaries, win/end-card pops (exact second),
   menu/modal/shop detours to AVOID, theme/skin changes (these are the preview's variety).

## Step 3 — Pick the clip windows (then VERIFY each one)

Pick **four ~4s windows** (`data-media-start` on `#v1..#v4`): **variety first** — different
skins/boards/themes/modes across v1–v3 — and the **payoff last**: v4 opens ~1.5–2s before the
win/end-card pop so the pop lands inside the window (and BEFORE any menu/shop the run cut to).

- **Empirically verify EVERY window** by extracting frames at start/mid/end from the SOURCE at the
  SCALED (longer) timestamps before rendering. Recordings hide earlier-round win cards and
  pause/collection modals where "obviously gameplay" should be — caught only on the frames.
- **The card preview reuses windows v1–v3** (the variety shots, NOT the payoff v4). So pick v1–v3 to
  be clean, active, visually distinct gameplay that also reads well FULL-BLEED (v4/payoff is
  social-only).

## Step 4 — Render the game's OST bed

```bash
cd ~/arcade/promo/komyo-trailer/tools
node render-music.mjs <track> 76 ../assets/audio/<track>-76s.wav "0:0.55,2:0.7,6:0.9,10:1"
cd ../assets/audio && ffmpeg -i <track>-76s.wav -c:a aac -b:a 192k <track>-76s.m4a && rm <track>-76s.wav
```

The printed bpm and the `.beats.json` `barDur` must match your BAR — if not, your track lookup was wrong.

## Step 5 — Author the V2 social variant

Copy the base template to `variants/game-v2-stage-9x16-<slug>.html`, then do BOTH passes with a small
python script using **asserted exact-string replacements** (`assert text.count(old) == 1`) — never
freehand-edit 24KB of timing attributes:

**Retarget pass** (content): `--accent` on `<body>` AND `accent:` in `GAME`; all 4 `<video src>` →
`assets/footage/<slug>_p.mp4` + the chosen `data-media-start`s; copy slots — hook slam (the game's
verb, ALL-CAPS with one `<em>`) + 3 feature lines (short lowercase, one `<b>` each) + `cardsub` +
`gametag` + CTA tag; `qrUrl` → `https://komyo.online/games/<slug>?utm_source=tr&utm_medium=qr`; both
visible URL lines → `komyo.online/games/<slug>`.

**Scale pass** (only when bpm ≠ 128): multiply every `data-start`/`data-duration` by SCALE (3
decimals), set `var BAR = <240/bpm>`, swap the `<audio src>` to the game's bed, scale the `#bgm`
fade-out position (`21`). **`data-media-start` is NEVER scaled** (real-time source offsets). Lint
gotcha: after scaling, no small `.clip` `data-start` (gametag/brand/meta) may land within 0.05s of an
exit-tween duration (0.26/0.3/0.34/0.35) or the linter false-triggers `gsap_exit_missing_hard_kill`.

**Fit pass (per game — the card CROPS, and the default crop is wrong for most games).** The
`.cardvid` box is **900×1120** and the source is **1080×1824**, so `object-fit: cover` scales by
`900/1080 = 0.8333` and shows only **1344 of 1824 source rows** — 480 rows are cut. The template's
default `object-position: 50% 12%` shows rows **58–1402**; anything the game draws below row 1402
(or above 58) is simply gone. Measure, don't eyeball:

```bash
# brightest pixel per row on a real gameplay frame → where the game actually draws
ffmpeg -y -v error -ss <t> -i assets/footage/<slug>_p.mp4 -frames:v 1 \
  -vf "crop=1080:1824:0:0" -f rawvideo -pix_fmt gray /tmp/f.raw
python3 -c "d=open('/tmp/f.raw','rb').read(); W=1080
p=[max(d[y*W:(y+1)*W]) for y in range(1824)]
b=[y for y in range(80,1780) if p[y]>150]; print('content rows', b[0], '→', b[-1])"
```

Run it on **every** window (each mode/board size draws differently), then:

- **Content fits in 1344 rows** → keep `cover` and centre it:
  `Y% = ((centre − 672) × 0.8333) / 400`, where `centre = (top + bottom) / 2`.
  Verify `start + 1344 < 1786` (the version-stamp footer) — the footer is kept out by this window,
  NOT by the footage. (2048: board rows 463–1450 → 12% cut the bottom row; 60% centres it.)
- **Content is TALLER than 1344 rows** (full-screen play areas where objects spawn edge to edge)
  → `object-fit: contain` + `background:` the game's own backdrop colour, so the whole play area is
  visible with the pillars reading as bezel. Sample the colour:
  `ffmpeg -ss <t> -i <slug>_p.mp4 -frames:v 1 -vf "crop=40:40:8:8,scale=1:1" -f rawvideo -pix_fmt rgb24 - | xxd -p`
  **`contain` shows the FULL source height, so the footer becomes visible** — re-encode that game's
  prepped footage with `crop=1080:1784:0:0` to drop it. (Range: targets spawn rows 108–1740.)

## Step 6 — Render + QA the social trailer

```bash
cd ~/arcade/promo/komyo-trailer
cp variants/game-v2-stage-9x16-<slug>.html index.html
npx --yes hyperframes@0.7.53 render --fps 60 --quality high --output finals-games/game-v2-stage-9x16-<slug>.mp4
```

QA: extract a 6-frame grid at the key beats (hook, each window, payoff, CTA) and READ them — every
window shows what you intended, text doesn't collide, accent/QR/URL/emoji are the game's, an `aac`
audio stream exists, and **frame 0 is a composed poster (not black)**. Fix and re-render anything off.

Then a **full-resolution zoom on the card itself** — the 6-frame grid is too small to see a clipped
edge, and that's exactly what hides:

```bash
ffmpeg -y -v error -ss <t> -i finals-games/game-v2-stage-9x16-<slug>.mp4 -frames:v 1 \
  -vf "crop=1000:1250:40:280,scale=500:625" /tmp/zoom.png
```

Check, on EVERY window: the play area is whole (no clipped board row, no target/object cut by the
card edge), there's no large dead band inside the card, and **no version stamp is visible**. A
clipped bottom row or a half-empty card means the Step 5 fit pass is wrong — fix the
`object-position`/`object-fit`, don't accept it.

## Step 6b — Cut the card preview loop

`tools/card-loop.sh` builds a **text-free, full-bleed, seamless-looping** gameplay clip from the same
footage, reusing windows v1–v3:

```bash
bash tools/card-loop.sh assets/footage/<slug>_p.mp4 <keepH> ../../games/<slug>/preview.v1.mp4 <t0> <t1> <t2> [SXF=0.5]
```

- `<keepH>` = source height AFTER cropping the bottom version-stamp footer (even; measure it by eye
  from a bottom strip — footers differ per recording).
- `<t0> <t1> <t2>` = the v1–v3 window media-starts (variety; skip the payoff). Order them so the
  most active window leads (a static opener reads as "not looping").
- **Seamless-loop recipe** (baked into the script, do not re-derive): rotate clip0's first `SXF`
  seconds (15 frames @0.5s) to the END as the crossfade target — play `clip0[SXF..end] → clip1 →
  clip2 → xfade → clip0[0..SXF]`. `<video loop>` then wraps `clip0[SXF-1]→clip0[SXF]` = consecutive
  frames of one capture → **no jump, no freeze, no duplicated frames**; the dissolve hides the
  window change. (Browsers don't loop `<video>` frame-perfectly; this recipe puts the seam on
  consecutive real frames so the hiccup is invisible.)
- Output: 480×854, muted, ~10.5s, ~120–540 KB.

**QA the wrap**: sample the last 3 frames → first 3 frames — motion must be continuous across the
boundary (no repeat, no jump). Also confirm the windows are clean full-bleed (footer gone, no modal).

## Step 6c — Still fallback

If the game has no `shot:` in games.js, cut one from a strong clean footage frame (same full-bleed
crop as the preview, at 720×1280):

```bash
ffmpeg -y -ss <t> -i assets/footage/<slug>_p.mp4 -frames:v 1 \
  -vf "crop=1080:<keepH>:0:0,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" /tmp/shot.png
cwebp -q 82 /tmp/shot.png -o ../../games/<slug>/shot.v1.webp
```

## Step 7 — Wire the assets into the site

The catalogue game card auto-uses these once games.js declares them (see `index.html` card build:
`hasVid = !!g.preview`, `hasShot = !hasVid && !!g.shot`):

- **`games.js`**: add `preview: "preview.v1.mp4"` and ensure `shot: "shot.v1.webp"` on the game's entry.
- Place `preview.v1.mp4` + `shot.v1.webp` in `games/<slug>/`.
- **No `sw.js` change** — the preview is idle-prefetched by the catalogue on good connections, not in
  the SW shell. The social trailer stays in `finals-games/` (not shipped on the site).
- Serve locally and eyeball the card at the five viewports (esp. that the preview loops cleanly and
  the fallback shot looks right). Nothing is pushed until the user's eyeball pass.

## Step 8 — Upload metadata (social trailer)

**Read `~/arcade/plans/clip-release-plan.md`** — the 5-channel runbook (TikTok, YT Shorts, IG Reel,
FB Reel, Discord auto-mirror), UTM scheme, IG/FB caption templates, cadence. One render serves all
channels (generic QR). Produce paste-ready per-platform blocks:

- **YouTube Shorts** — Title ≤100 chars (hook + game name + "free browser game"); description = 1–2
  hook sentences, then `Play free in your browser (no ads, no accounts, works offline):` + bare
  `komyo.online/games/<slug>`, hashtags starting `#Shorts` + genre tags.
- **TikTok** — one caption: hook (POV/question), plain `komyo.online/games/<slug>`, hashtags + `#fyp`.
- **IG Reel / FB Reel** — per the release plan's templates.
- **Cadence** (from `tools/RECORDING.md`): stagger platforms by hours/a day; 1 game = a week of
  content, not a one-time dump.

## Definition of done

- `assets/footage/<slug>_p.mp4` + `assets/audio/<track>-76s.m4a` (+beats) exist.
- ONE V2 social mp4 in `finals-games/`, on the game's bpm grid + OST, QA'd frame-by-frame, frame 0 a poster.
- **Fit pass done**: content rows measured per window, `object-position`/`object-fit` set from that
  measurement, card zoom shows nothing clipped and no version stamp.
- **Claim audit written**: every copy line in the trailer AND the metadata cites a source file:line;
  no `locked`/`SOON` mode listed as playable; player counts and penalty modes stated in full.
- `games/<slug>/preview.v1.mp4` (text-free full-bleed seamless loop) + `games/<slug>/shot.v1.webp` exist.
- `games.js` declares `preview:` + `shot:`; the catalogue card shows the loop (shot as fallback).
- TikTok + YT (+ IG/FB) metadata delivered with the cadence reminder.
- User pointed at localhost + the trailer file for the eyeball pass — nothing published for them.
