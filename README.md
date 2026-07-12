<p align="center">
  <img src="logo-512.png" alt="Komyo Games logo" width="116" height="116">
</p>

<h1 align="center">Komyo Games</h1>

<p align="center">
  <a href="https://komyo.online/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20%20OPEN%20KOMYO%20GAMES-1f6feb?style=for-the-badge" alt="Open Komyo Games" height="64">
  </a>
</p>

<p align="center">
  <a href="https://github.com/sponsors/N0zz"><img src="https://img.shields.io/badge/%E2%99%A5%20Sponsor-ff5d8f?style=for-the-badge" alt="Sponsor"></a>
  <a href="https://buymeacoffee.com/komyo.online"><img src="https://img.shields.io/badge/%E2%98%95%20Buy%20me%20a%20coffee-ffce5c?style=for-the-badge&logoColor=000" alt="Buy me a coffee"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-orange?style=for-the-badge" alt="License: PolyForm Noncommercial 1.0.0"></a>
</p>

---

A little **catalogue** of self-contained browser games. Each game is its
own folder of static HTML/Canvas + vanilla JS — no build step, no dependencies, no
external assets — and gets a tile on the home page plus a top-left **‹ Menu** / **Komyo Games ›**
nav. Every game follows the same flow: **menu (pick a mode) → play → scoreboard (with a
shareable score card)**. The home page groups tiles into **Favorites** (drag to reorder) →
**Recently played** → **All games** → **Coming soon**.

Cross-game, all on-device (no accounts, no server): **daily/weekly challenges** earn **trophies 🏆**,
which unlock **titles** and buy **cosmetics** (per-game skins + site-wide cursors) in the 🎨 store — plus
per-game best scores, a profile card, and optional consent-gated GA4 + a public Discord score post.

The whole site speaks **8 languages** — English, Polski, Español, Português, Français, Italiano,
Čeština, Українська — and **every game works offline** (one site-wide service worker).

## Games

| Game | Folder | About |
| --- | --- | --- |
| **Asteroids** | `games/asteroids/` | Fly/shoot/survive — Classic + Classic-Enhanced arcade, speedruns, mobile controls |
| **Asteroids+** | `games/asteroids-plus/` | Roguelite Asteroids — XP, upgrades, bosses and a wave shop |
| **Keep Defender** | `games/tower-defense/` | Fixed-path tower defense — towers, gold, waves (Castle & Parchment theme) |
| **Forcefield** | `games/forcefield/` | Slide your atmosphere dome to block the battle station's fire — solo or 2-player |
| **Bubble Pop** | `games/bubbles/` | Puzzle-Bobble bubble shooter — match 3+, Arcade/Endless/Zen + special shots |
| **Frog Bonk** | `games/frog-bonk/` | Whack-a-mole castle defense — bonk the invaders with the king's soft hammer |
| **Brick Breaker** | `games/breakout/` | Paddle/ball/bricks with power-ups and level progression (synthwave neon) |
| **Sudoku** | `games/sudoku/` | Daily puzzles, hints and zen mode on the classic 9×9 |
| **Stack** | `games/stacker/` | One-tap tower stacker — slice the overhang, chain perfect drops (pastel-clean theme) |
| **Trap the Cat** | `games/trap-the-cat/` | Wall off the hex board to corner the cat before it escapes |
| **Meadow Flyer** | `games/flappy/` | One-tap flyer through a soft storybook meadow |
| **Range** | `games/aim-trainer/` | Timed flick-aim target practice with accuracy + combo (tactical theme) |
| **Neon Snake** | `games/snake/` | Grid snake in glowing neon — arrows/WASD/swipe, deadly walls |
| **2048** | `games/2048/` | Slide and merge the tiles — double your way up to 2048 |
| **Minesweeper** | `games/minesweeper/` | Flag the bombs, read the numbers, deduce the rest |
| **Balloon Pop** | `games/balloon-pop/` | Kids — tap the floating balloons, no way to lose |
| **Critter Match** | `games/critter-match/` | Kids — flip the cards, find the matching animals |
| **Glow Says** | `games/glow-says/` | Kids — watch the lights, repeat the tune |

More on the way — single-player (Dusk Runner, Pump Stop, Keyfall, Word Hunt, Invaders,
Road Hop, Floodgate, Icy Tower, …), more **kids games** (Color Pop, Maze Pals, Tap & Learn)
and **local multiplayer** (Light Cycles 2–4P, Air Hockey, Slime Volleyball, Mash Dash, …).

**Stay updated:** hit **📬 Subscribe** on the home page to get an email when a new
game ships or something gets fixed (free, no spam, unsubscribe anytime).

## Install on your phone (PWA)

The arcade is a Progressive Web App — install it to play **fullscreen & offline**, no
app store:

- **Android (Chrome):** tap the **📱 Install** button on the home page, or menu **⋮ → “Add to Home screen”**.
- **iPhone (Safari):** **Share** → **“Add to Home Screen”**.
- **Desktop (Chrome/Edge):** the **Install** button, or the install icon in the address bar.

**Install individual games too.** Every game is its own Progressive Web App — open
a game and use **Install / Add to Home Screen** to put just that game on your home
screen (its own icon, opens fullscreen, plays offline). Handy if you only want one.

## Add a game

1. Create `games/<slug>/index.html` — load the shared `<head>` unit (`analytics.js` ·
   `game-kit.css` · `version.js` · `game-kit.js` · `challenges.js` · `cosmetics.js` · `games.js` ·
   `i18n.js`) and build the shell from the kit: `gamekit.nav()`, `gamekit.menu` (start/pause/end),
   `gamekit.loop()`, `gamekit.fitCanvas()`, `gamekit.pwa()`. Keep game logic inline with a
   `window.__test` hook and the menu → play → scoreboard(+share) flow.
2. Add one entry to **`games.js`**: `slug`, `title`, `blurb`, `icon`, `accent`, `tags`, and
   optionally `soon: true` (greyed coming-soon tile), `mp: true` + `players` (e.g. `"2–4P"`),
   `added`/`updated` dates (auto NEW/UPDATED badges). Add the game's strings to the locales
   (`i18n.js` + each `i18n.<code>.js`), its challenge `goodRun` bar to `challenges.js`, its skins
   to `cosmetics.js`, and a player-facing entry to `changelog.js`.
3. Add `games/<slug>/test.mjs` on the shared harness (`test-harness.mjs` — `bootGame()` +
   game asserts + the layout suite) and keep it green.
4. Register the game in the root `sw.js`: add its slug to `GAME_SLUGS` (the ONE site-wide service
   worker precaches its HTML/manifest/icons for offline); the game calls `gamekit.pwa('../../sw.js')`.
   When it goes live, add its URL to `sitemap.xml` and `llms.txt`.

## Testing

```bash
node test.mjs                  # catalogue wiring + Keep Defender logic + kit + cosmetics + boots every live game
node games/<slug>/test.mjs     # any single game's own suite (e.g. games/snake/test.mjs)
node games/asteroids/test.mjs  # a single game's suite (Classic + Classic-Enhanced behind ?v=)
```

Dependency-free headless harnesses (mock the DOM/canvas, drive each game via a
`window.__test` hook). Keep them green.

## Layout

```text
index.html        catalogue (tiles from games.js) + drawers/modals (profile, settings, challenges, shop) + PWA/share/feedback/newsletter
games.js          catalogue manifest         challenges.js  daily/weekly goals + goodRun bars + titles
cosmetics.js      cosmetics registry (skins + cursors)   changelog.js  player-facing releases
analytics.js      consent-gated GA4 loader   version.js    build stamp (sha/date)
i18n.js           i18n loader + English strings   i18n.<code>.js  one file per locale (pl/es/pt/fr/it/cs/uk)
game-kit.js      shared game shell (nav, menus, sound+music, loop, layout, challenges, cosmetics, best store, share, PWA)
game-kit.css     shared shell styles         sw-core.js   service-worker engine (imported by the root sw.js)
qr.js             dependency-free QR encoder (scan-to-play on score cards)
favicon.svg       Komyo Games icon           plans/       public design docs/mocks
manifest.json     PWA manifest      sw.js   the ONE site-wide service worker (offline for catalogue + every game)
robots.txt sitemap.xml llms.txt   crawler/SEO/LLM site maps
CNAME             custom domain (komyo.online)   .nojekyll   serve files as-is on GitHub Pages
test.mjs          catalogue + Keep Defender + kit + i18n coverage + boots every live game   test-harness.mjs  the shared headless harness
scripts/          gen-icon.mjs (game icons) + post-changelog.mjs (Discord changelog action)
games/<slug>/     each game, standalone (index.html + test.mjs + manifest/icons)
```

> History note: `games/asteroids/` was imported with `git subtree` so its full
> commit history is preserved — view per-game history on GitHub via the folder's
> **History** view (`/commits/main/games/asteroids`).

## License

Source-available under the **PolyForm Noncommercial License 1.0.0** — free to use, copy,
modify and share for any **noncommercial** purpose; **commercial use is not permitted**.
See [`LICENSE`](LICENSE). © 2026 komyo.
