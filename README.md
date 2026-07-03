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
nav. Every game follows the same flow: **menu (pick a mode) → play → scoreboard (with share
buttons)**. The home page groups tiles into **Single player** and **Multiplayer** sections.

Cross-game, all on-device (no accounts, no server): **daily/weekly challenges** earn **trophies 🏆**,
which unlock **titles** and buy **cosmetics** (per-game skins + site-wide cursors) in the 🎨 store — plus
per-game best scores, a profile card, and optional consent-gated GA4 + a public Discord score post.

## Games

| Game | Folder | About |
| --- | --- | --- |
| **Asteroids** | `games/asteroids/` | Fly/shoot/survive — classic arcade + roguelite modes, speedruns, mobile controls |
| **Keep Defender** | `games/tower-defense/` | Fixed-path tower defense — towers, gold, mage/fast-forward/boss telegraph (Castle & Parchment theme) |
| **Stack** | `games/stacker/` | One-tap tower stacker — slice the overhang, chain perfect drops (pastel-clean theme) |
| **Neon Snake** | `games/snake/` | Grid snake in glowing neon — arrows/WASD/swipe, deadly walls |
| **Meadow Flyer** | `games/flappy/` | One-tap flyer through a soft storybook meadow |
| **Brick Breaker** | `games/breakout/` | Paddle/ball/bricks with power-ups and level progression (synthwave neon) |
| **Range** | `games/aim-trainer/` | Timed flick-aim target practice with accuracy + combo (tactical theme) |
| **Bubble Pop** | `games/bubbles/` | Puzzle-Bobble bubble shooter — match 3+, Arcade/Endless/Zen + special shots |

More on the way — single-player (Sudoku, Invaders, Road Hop, Icy Tower, Trap the Cat,
Pulse Dash, Dino Jump, …) and **local multiplayer** (Light Cycles 2–4P, Air Hockey,
Slime Volleyball).

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

1. Create `games/<slug>/index.html` — load the shared kit in `<head>`
   (`game-kit.css` + `game-kit.js`) and use `gamekit.nav()`, `gamekit.sound`, `gamekit.shareRow()`,
   `gamekit.pwa()` for the nav / sound + mute / share / PWA. Keep game logic inline with a
   `window.__test` hook and the menu → play → scoreboard(+share) flow.
2. Add one entry to **`games.js`**: `slug`, `title`, `blurb`, `icon`, `accent`, `tag`, and
   optionally `soon: true` (greyed coming-soon tile), `mp: true` + `players` (e.g. `"2–4P"`,
   Multiplayer section), `badges: ["new"]`/`["pick"]` (gold/purple tile badge).
3. Add `games/<slug>/test.mjs` (dependency-free headless harness; **preload `../../game-kit.js`**
   in the sandbox before the inline script) and keep it green.
4. `sw.js` `SHELL` includes the HTML, icons, and `../../game-kit.js` + `../../game-kit.css` (offline).

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
game-kit.js      shared game shell (nav, menus, sound+music, loop, layout, challenges, cosmetics, best store, share, PWA)
game-kit.css     shared shell styles         sw-core.js   shared service-worker engine (each sw.js imports it)
favicon.svg       Komyo Games icon           plans/       public design docs/mocks
manifest.json     PWA manifest      sw.js   service worker (offline)
CNAME             custom domain (komyo.online)   .nojekyll   serve files as-is on GitHub Pages
test.mjs          catalogue + Keep Defender + kit + cosmetics harness   test-harness.mjs  the shared headless harness
games/<slug>/     each game, standalone (index.html + test.mjs + manifest/sw/icons)
```

> History note: `games/asteroids/` was imported with `git subtree` so its full
> commit history is preserved — view per-game history on GitHub via the folder's
> **History** view (`/commits/main/games/asteroids`).

## License

Source-available under the **PolyForm Noncommercial License 1.0.0** — free to use, copy,
modify and share for any **noncommercial** purpose; **commercial use is not permitted**.
See [`LICENSE`](LICENSE). © 2026 komyo.
