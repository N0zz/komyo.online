# Recording komyo gameplay for 9:16 trailers

Goal: a clean **1080×1920 @ 60fps** portrait capture of a game, played natively.

## 1. Open the game in a chromeless, exact-size window

```bash
open -na "Google Chrome" --args \
  --user-data-dir="/tmp/komyo-rec" \
  --app="https://komyo.online/games/<slug>/" \
  --window-size=560,1020
```

- `--app=` → no tabs, no address bar (just the game). Point it at the game (`/games/<slug>/`) or the catalogue (`https://komyo.online/`).
- `--user-data-dir=` → a fresh isolated Chrome instance so the flags actually apply even when Chrome is already running. (Note: this instance has no profile/cosmetics — enable **Free play** in the game's collection to unlock skins, or just hide the cursor.)
- `--window-size=560,1020` → tweak until the game's content area is ~9:16. Exact pixels don't matter — see step 3.
- Read-only size check (paste in DevTools ⌥⌘I → Console, does NOT resize): `innerWidth*devicePixelRatio + ' x ' + innerHeight*devicePixelRatio` → aim for ~1080×1920. Do this on the **built-in Retina screen** (devicePixelRatio 2), not an external non-Retina monitor.

## 2. OBS settings

- **Settings → Video:** Base (Canvas) `1080x1920`, Output (Scaled) `1080x1920`, Common FPS `60`. (Type the resolution in — not in the dropdown.)
- **Settings → Output → Recording:** format `mp4` (or mov), quality `High`/`Indistinguishable`.
- **Source:** add **"macOS Screen Capture"** (NOT the deprecated "Window Capture") → Method **Window** → pick the Chrome app window. Grant Screen Recording permission if prompted.
- Right-click source → **Transform → Fit to screen** (or **Reset Transform** for 1:1 if the window is already ~1080×1920). Alt-drag edges to **crop the thin title bar** so only the game fills the frame.
- Toggle **Show Cursor** off if you want to hide the pointer.

## 3. Capture

- Play **several rounds continuously** — different skins/modes are all usable. Don't chase one perfect take; we trim the juicy ~6–8s windows (combos, breaches) into the template.
- If the recording isn't exactly 1080×1920, don't worry — conform at the end (crisp): `ffmpeg -i in.mov -vf scale=1080:1920 out.mp4` (pad instead of scale if the aspect is off).
- Drop the file somewhere and hand it over; it gets cropped/trimmed into `assets/footage/` and wired into the templates.

## Known caveat

At desktop-ish window widths the game may treat the viewport as desktop, so **Double (2-player) mode renders in the landscape orientation** (two domes side-by-side) even in a portrait window. Fine for a quick 2-player beat, but single-player reads best in 9:16.

## Releasing (platform note)

Different algorithms — release differently:

- **YouTube Shorts = winner-take-all.** Two similar Shorts posted together cannibalize (observed ~550 vs 4 views). Post **one at a time, spaced 3–5 days**; each gets a fair push and it doubles as a sequential A/B.
- **TikTok = per-video test pool.** Both versions get their own audience (~even views), but **stagger by hours/a day** rather than dumping simultaneously; TikTok rewards steady cadence.
- Reframe: 1 game (2 trailers × 2 platforms + variants) = a week of content to spread out, not a one-time dump. Let the winning register become the template default.
