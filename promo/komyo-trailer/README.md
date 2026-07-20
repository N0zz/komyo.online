# komyo-trailer — 3 trailer versions × 2 formats (HyperFrames)

Everything is plain HTML+CSS+GSAP rendered to MP4 by [HyperFrames] — fully editable, no NLE.

## Layout

```text
variants/           the 6 editable compositions (source of truth)
  v1-16x9.html      V1 "raw & simple"      1920×1080 ~35.5s
  v1-9x16.html      V1                     1080×1920 ~33.5s
  v2-16x9.html      V2 "cinematic"         1920×1080 ~59s
  v2-9x16.html      V2                     1080×1920 ~39s
  v3-16x9.html      V3 "pain → cure"       1920×1080 ~50s
  v3-9x16.html      V3                     1080×1920 ~35s
index.html          scratch slot — the CLI checks/renders THIS file (copy a variant in)
frame.md            design spec (brand truth: palette, fonts, texture kit, footage table)
TRAILERS.md         the beat sheets for all three versions
assets/footage/     the 12 gameplay recordings (remuxed .mov→.mp4, untouched content)
assets/audio/       music rendered OFFLINE from komyo's own game-kit music engine
                    (snakebanger 122bpm · forcefield 128bpm) + *.beats.json beat maps
assets/brand/       logo-512.png · favicon.svg · mascot-head.svg
assets/qr.js        komyo's in-repo QR encoder (same one the score cards use)
renders/            final MP4s
```

## Edit → check → render loop

```bash
cp variants/v1-16x9.html index.html
npm run check                 # lint + runtime + layout + motion + WCAG in one pass
npx --yes hyperframes@0.7.53 snapshot --at 1.5,5,9,23,33   # eyeball key frames
npm run render -- --quality high --output renders/v1-16x9.mp4
cp index.html variants/v1-16x9.html   # if you edited index.html directly, save it back
```

Or edit live in the Studio timeline: `npm run dev` → browser UI, every element clickable.

## The knobs you'll most likely touch

- **Trim a cut:** each `<video class="clip gameplay">` has `data-start` (when it appears in the
  trailer), `data-duration`, and `data-media-start` (in-point INSIDE the source clip, seconds).
  Cuts sit on the music's bar grid — V1/V2: `0.06 + n×1.96721` (122bpm) · V3 after the wipe:
  `wipe + n×1.875` (128bpm). Keep cuts on the grid or they stop hitting the beat.
- **Copy:** all captions/slams are plain text in the HTML.
- **Colors:** `--accent` on `body` (house teal `#2ee8c8`); per-game pill accents inline (`--pc`).
- **Music:** swap `src` of `#bgm`. Regenerate/extend tracks from the actual game engine with
  `tools/render-music.mjs` (`cd tools && npm i` once):
  `node render-music.mjs snakebanger 76 out.wav "0:0.55,2:0.7,6:0.9,10:1"`
  (any track key from game-kit's TRACKS works — it boots game-kit.js headless and renders the
  WebAudio scheduler offline; also writes the .beats.json grid).
- **QR target:** the `KOMYO_QR.encode('https://komyo.online?utm_source=trailer&utm_medium=qr')`
  line in each file.

## Gotchas (the framework will bite you otherwise)

- Only `index.html` may carry `data-composition-id` at the project root — that's why the
  variants live in `variants/`.
- Gameplay `<video>`s carry `transform: scale(1.03)` with `transform-origin: 50% 0` — it crops
  the site's version-tag footer baked into the recordings. Don't remove it.
- Don't end a fade-out exactly at that element's own clip end; fade an inner wrapper + `tl.set`
  hard kill (see `#hook-inner`).
- Videos/audio must stay DIRECT children of the root `div`; the framework owns playback.
