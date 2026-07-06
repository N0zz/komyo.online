# Registration — every shared file a new game must touch

A game is not just its `games/<slug>/` folder. Going live means editing several **shared,
repo-root files** in lockstep. Miss one and the failure is usually **silent** (dead badge, orphaned
storage, a challenge that never completes, no offline). Each section below gives the EXACT shape a
game contributes, labeled:

- `[MANDATORY]` — the game breaks or a feature silently dies without it.
- `[OPTIONAL]` — expected polish, but the game works without it.
- `[AUTOMATIC]` — the kit/catalogue derives it; **do not hand-edit**.

The running example is a fictional live game **`floodgate`** (slug `floodgate`, title
"Floodgate", puzzle, accent `#5fb8d9`, icon 🚰).

---

## 1. `games.js` — the catalogue manifest `[MANDATORY]`

`window.GAMES` is an array of plain objects. One entry per game. This is the ONLY place a tile
comes from.

### Fields

| field     | req?         | shape / rule |
|-----------|--------------|--------------|
| `slug`    | **required** | folder name, byte-identical everywhere (see traps). |
| `title`   | **required** | display name (may differ from slug — slug `tower-defense` → title "Keep Defender"). |
| `blurb`   | **required** | one-sentence tile description. |
| `icon`    | **required** | a single emoji. |
| `accent`  | **required** | hex color; the tile's glow + theme (see accent-agreement trap). |
| `tags`    | **required** | array of 1–3 genre tags, UPPERCASE (`["PUZZLE","LOGIC"]`); each tag's color is canonical in `TAG_COLORS` (index.html), never per-game. |
| `soon`    | optional     | `true` = greyed, non-clickable "coming soon" tile. **Omit entirely for a live game.** |
| `added`   | live only    | `"YYYY-MM-DD"` — drives the **NEW** badge for 7 days `[AUTOMATIC badge]`. Set on launch. |
| `updated` | live only    | `"YYYY-MM-DD"` — bump on a notable update (new mode/feature, not bugfixes); drives **UPDATED** badge for 7 days `[AUTOMATIC badge]`. |
| `mp`      | optional     | `true` = renders in the **Multiplayer** section instead of Single player `[AUTOMATIC sectioning]`. |
| `players` | mp only      | pill text, e.g. `"2P"` / `"2–4P"`. |
| `badges`  | optional     | manual badges array, e.g. `["pick"]` → **POPULAR** (purple). NEW/UPDATED are auto and must NOT be listed here. |

### Badges — automatic vs manual

- **NEW** (gold) and **UPDATED** (blue) are computed from `added` / `updated` (within 7 days; NEW
  wins over UPDATED). You never write "NEW"/"UPDATED" — you write the dates.
- **POPULAR** (purple) is the only manual one: `badges: ["pick"]`.

### Sectioning — automatic

The catalogue splits tiles into **Single player** and **Multiplayer** (`mp: true`) sections, and
within each orders favorites → available → coming-soon (`soon`). You don't order the array; just
add your object anywhere sensible.

### Canonical live-entry snippet

```js
{
  slug: "floodgate",
  title: "Floodgate",
  blurb: "Rotate the pipes to route water source-to-drain before it floods. Beat the timer.",
  icon: "🚰",
  accent: "#5fb8d9",
  tags: ["LOGIC", "PUZZLE"],
  added: "2026-07-10",
  updated: "2026-07-10",
},
```

(A `soon` tile is the same minus `added`/`updated`, plus `soon: true`.)

---

## 2. `challenges.js` — good-run bar + goals

### 2a. The `goodRun` per-game bar `[MANDATORY]`

`window.CHALLENGES.goodRun` is a **flat `slug → threshold` map**. A run scoring at least this counts
as a "good run" (feeds the goodRuns challenge metric + the +5🏆 trickle). **A missing slug means the
game silently never earns good runs** — this is the single most-forgotten edit.

```js
window.CHALLENGES.goodRun = {
  snake: 300, bubbles: 5000, breakout: 1500, stacker: 50, flappy: 50,
  'aim-trainer': 600, 'tower-defense': 2000, asteroids: 8000, 'asteroids-plus': 30000,
  floodgate: 12,   // ← add this line
};
```

**RULE:** the bar = the game's **hard daily goal target** (2b below), kept in lockstep. Exception:
score-less/wave-based games (tower-defense) estimate the equivalent score.

### 2b. Goal entries `[MANDATORY for the daily rotation]`

`window.CHALLENGES.goals` is a map of `id → goal`. The convention is **two tiers per game** — an
easy day and a hard day — that interleave in the shuffled daily pool.

```js
// in CHALLENGES.goals:
'flood-1': { slug: 'floodgate', title: 'Solve 6 boards in Floodgate',  metric: 'score', target: 6 },
'flood-2': { slug: 'floodgate', title: 'Solve 12 boards in Floodgate', metric: 'score', target: 12 },
```

Goal fields: `{ slug, title, metric, target }` (single-game). `metric` is `'score'` | `'time'` |
any `stats` key the game records; checked vs the kit's per-day best. (`scope:'cross'` and
`scope:'random'` goals exist but are meta/site-wide, not per new game.)

Then **add the ids to the `daily` pool array** so they actually rotate in:

```js
daily: [ …existing…, 'flood-1', 'flood-2' ],
```

The **hard target (`flood-2` = 12) MUST equal the `goodRun` bar (12).**

Goal `title` strings stay English in `challenges.js` — they are the `def:` source; the kit renders
them via `t('challenge.goal.<id>', { def: goal.title })`. **`challenge.goal.<id>` is a dynamic key
the coverage scanner can't see** (built by concatenation in `game-kit.js`), so a missing translation
is *silent English*, not a red test — add `challenge.goal.flood-1` / `challenge.goal.flood-2` keys to
`i18n.pl.js` (and the other locale files) yourself (§9).

### 2c. Titles ladder + `randomSlug` `[AUTOMATIC — do not touch]`

`CHALLENGES.titles`, `titleFor`, and `randomSlug` are global machinery. A new game needs **no**
change to any of them — `randomSlug` already draws from all non-`soon` games automatically.

---

## 3. `cosmetics.js` — skins `[OPTIONAL but expected]`

Data-only registry; the kit owns storage, economy, and the store modal. Contribute via the
`add(game, set, key, name, price, desc, painter)` helper inside the IIFE.

### The `add()` call

```js
// ---- 🚰 Floodgate — pipe skins ----
add('floodgate', 'pipe', 'copper', 'Copper',   0,   'Standard-issue plumbing.', fill('#b87333'));
add('floodgate', 'pipe', 'brass',  'Brass',    25,  'A warm polished shine.',    grad(['#e8cc8a','#c89a2a'], 1));
add('floodgate', 'pipe', 'neon',   'Neon',     100, 'Glowing conduit tubes.',    grad(['#5fb8d9','#2ee8c8'], 0));
```

Rules the tests enforce:

- **id format** `<slug>.<set>.<key>` — built automatically as `game + '.' + set + '.' + key`.
- **EVERY set needs exactly one FREE default at `price: 0`** (here `copper`).
- **Price bands:** 10 / 25 (cheap) · 50 (mid) · 100 (premium). Stay in-band except deliberately
  flagged exceptions (the Meadow Flyer progressive bird tail is the only current one).
- The **painter** draws a small swatch on any square canvas — drawing only, never touches the DOM.
  Reuse the existing helpers (`fill`, `grad`, `orb`, `star`, `paddle`, …) or add one.
- The `name`/`desc` strings here are the English `def:` source — the store renders them via
  `t('cos.<id>.name')` / `t('cos.<id>.desc')` and the set label via `t('cos.set.<setId>')`. The
  coverage test derives these keys from the registry, so missing translations DO fail the suite —
  add them in §9.

### The set label `[MANDATORY if you added a set]`

Add to `COSMETICS.sets` (keyed by `<slug>.<set>`):

```js
sets: {
  …,
  'floodgate.pipe': { label: 'Pipe skins' },
},
```

### The game meta entry `[MANDATORY if the game has any cosmetics]`

Games don't load `games.js`, so the store modal re-states title/icon/accent here. **Must match
`games.js`** (accent-agreement trap):

```js
games: {
  …,
  'floodgate': { title: 'Floodgate', icon: '🚰', accent: '#5fb8d9' },
},
```

### Reading the selected skin (in the game's own render)

```js
const KIT = window.gamekit;
const id = KIT.cosmetics.selected('floodgate.pipe'); // e.g. 'floodgate.neon'
// map id → your draw colors; the 🎨 button + store modal are kit-owned (automatic).
```

Do NOT build a per-game STYLE grid in the start menu — the 🎨 modal owns selection/buying.

---

## 4. Root `sw.js` — register the game in the site-wide service worker `[MANDATORY]`

There is **no per-game `sw.js`** — ONE root-scope service worker (repo-root `sw.js`, importing
`sw-core.js`) caches the catalogue, the shared head files, every locale AND every live game.
Registering a new game is one edit: **add the slug to `GAME_SLUGS` in the root `sw.js`, in
`games.js` order** — the SW then precaches the game's `./`, `index.html`, `manifest.json`,
`favicon.svg` and both icons. The top-level suite enforces the lockstep (a live game missing from
`GAME_SLUGS` fails `node test.mjs`); a missing entry would otherwise silently mean "this game
doesn't work offline".

The game's inline script registers that worker with `window.gamekit.pwa('../../sw.js')` (already in
the template) — never `pwa()` bare (that would try to register a dead per-game scope). If the game
ships an EXTRA file beyond the standard set (rare — logic stays inline), add it to the root `SHELL`
by hand.

---

## 5. `games/<slug>/manifest.json` — PWA manifest `[MANDATORY]`

```json
{
  "name": "Floodgate",
  "short_name": "Floodgate",
  "description": "Route the water, beat the timer — a pipe puzzle.",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#04121a",
  "theme_color": "#5fb8d9",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- `start_url` and `scope` are both `"."` (relative to the game folder).
- `display: "standalone"`.
- `theme_color` **must match the game's `accent`** (accent-agreement trap). `background_color` is a
  dark base for the splash.
- Icons are `192`/`512`, `purpose: "any maskable"`.

---

## 6. Icons + favicon `[MANDATORY]`

Generate the PWA icons with the repo script:

```bash
node scripts/gen-icon.mjs 🚰 '#5fb8d9' games/floodgate
```

- Args: `<emoji> <background-css> <outDir>`. Background may be a solid color or a
  `linear-gradient(...)`.
- Writes `icon-512.png` + downscales to `icon-192.png`.
- **Dependency:** macOS + Google Chrome (renders the color emoji headless) + `sips`. If Chrome is
  missing the script errors out — there's no fallback.

Also add `games/<slug>/favicon.svg` (a small inline SVG; the other games have one each — copy one
and swap the glyph/color).

---

## 7. SEO — on go-live only (not for `soon` tiles) `[MANDATORY at launch]`

### `sitemap.xml` — add a `<url>`, priority **0.8** (games band)

```xml
<url><loc>https://komyo.online/games/floodgate/</loc><lastmod>2026-07-10</lastmod><priority>0.8</priority></url>
```

### `llms.txt` — add a bullet under `## Games`

```md
- [Floodgate](https://komyo.online/games/floodgate/): Rotate pipes to route water source-to-drain before the timer floods the board.
```

`robots.txt` needs **no** edit (it allows all crawlers and points at the sitemap already). Any new
*standalone page* (not a game) also goes in sitemap.xml at low priority (~0.3) — not relevant to a
game.

---

## 8. `changelog.js` — one release entry `[MANDATORY]`

**Prepend** one entry to the top of `window.CHANGELOG` (newest first). One entry **per push**;
player-facing language only (a player-noticeable thing — never kit/test/build/refactor).

```js
{ date: '2026-07-10', title: 'New game: Floodgate 🚰', items: [
  'New: Floodgate — rotate the pipes to route water from source to drain before the board floods. Three sizes, a timer mode, and a relaxed no-timer mode.',
] },
```

Do NOT retro-edit an already-shipped entry — the Discord poster diffs against the push base, so a
fresh entry posts cleanly while an edited old one mis-posts.

---

## 9. i18n — translations (`i18n.pl.js` + the other `i18n.<code>.js` files) `[MANDATORY]`

The i18n catalogue is split per language: `i18n.js` is the loader + the `en` (def-source) dict;
every other locale lives in its own root file `i18n.<code>.js` (the `pl` reference in `i18n.pl.js`).
The coverage test (`node test.mjs`) requires the `pl` locale to contain every referenced key, and
every OTHER populated locale to remain a **complete superset of `pl`** — so a new game's keys go
into `i18n.pl.js` AND every other populated locale's `i18n.<code>.js` (en stays inline in code as
`def:`). **Discover the currently-configured locales at runtime** (never hardcode the list — a
future language must not require an edit here) by merging `i18n.js` + every `i18n.<code>.js`:

```bash
cd ~/arcade && node -e "const fs=require('node:fs'),vm=require('node:vm');const sb={window:{}};sb.globalThis=sb;for(const f of ['i18n.js'].concat(fs.readdirSync('.').filter(f=>/^i18n\.[a-z]{2}\.js$/.test(f)).sort()))vm.runInNewContext(fs.readFileSync(f,'utf8'),sb,{filename:f});for(const[k,v]of Object.entries(sb.window.KOMYO_I18N))console.log(k,Object.keys(v).length)"
```

(Or simply read `window.KOMYO_I18N_AVAILABLE` from `i18n.js` and add `'en'`.)

Key families a new game contributes:

| family | English source | enforced? |
|---|---|---|
| `game.<slug>.title` / `.blurb` | `games.js` entry | test-enforced (derived from `GAMES`) |
| `game.<slug>.*` in-game strings | every `KIT.t('game.<slug>.…', { def })` call in `index.html` | test-enforced (literal scan) |
| `cos.<id>.name` / `.desc` | `cosmetics.js` `add(...)` args | test-enforced (derived from registry) |
| `cos.set.<setId>` | `COSMETICS.sets` label | test-enforced (derived from registry) |
| `challenge.goal.<id>` | `challenges.js` goal `title` | **NOT enforced — dynamic key the scanner skips; missing = silent English. Add it yourself.** |

Workflow: add the full key set to `i18n.pl.js` by hand (the failing test lists any you missed —
except `challenge.goal.*`, which never fails; grep the existing entries for the pattern), then hand
off to the **komyo-i18n-translate** skill (incremental mode) to add the same keys to every other
populated locale's `i18n.<code>.js`. `en` stays sparse (`def:` in code is the English source) —
except plural keys, which must exist in the `en` dict in `i18n.js`.

---

## Consolidated ordered checklist — to add a live game `<slug>`

**Create 5 files** in `games/<slug>/`:

1. `index.html` (the game; atomic `<head>` + kit shell + inline logic + `__test`).
2. `test.mjs` (imports the shared harness).
3. `manifest.json` (§5).
4. `favicon.svg` (§6).
5. `icon-192.png` + `icon-512.png` — via `gen-icon.mjs` (§6; counts as one step, two files).

**Edit 9 shared files** at repo root:

0. root `sw.js` — add the slug to `GAME_SLUGS` (§4).
1. `games.js` — GAMES entry (§1).
2. `challenges.js` — `goodRun` bar **and** two goal entries + add ids to `daily` (§2).
3. `cosmetics.js` — `add()` calls + `sets` label + `games` meta (§3) *(optional but expected)*.
4. `i18n.pl.js` — all the game's key families in `pl` (§9; en defs are inline in code), then the
   komyo-i18n-translate skill (incremental mode) for every other populated locale's `i18n.<code>.js`.
5. `sitemap.xml` — `<url>` at priority 0.8 (§7).
6. `llms.txt` — Games bullet (§7).
7. `changelog.js` — prepend one entry (§8).
8. `test.mjs` (repo root) — it boots every live game, so the new game is auto-covered; confirm it
   picks the game up (no edit usually needed, but verify).

**Then run all suites and keep them green:**

```bash
node test.mjs
node games/floodgate/test.mjs
```

---

## Cross-file consistency traps

- **Slug identity — byte-identical everywhere.** Folder name = `games.js` `slug` = `nav({slug})` =
  the root `sw.js` `GAME_SLUGS` entry = `challenges.js` `goodRun`/goal `slug` = `cosmetics.js`
  `add(game,…)` + `games` key. One mismatch = wrong URLs, orphaned storage keys, a dead challenge,
  a game that never caches offline, or a reset that wipes another game — all silent.
- **Accent agreement.** The same hex must appear in `games.js` `accent`, `cosmetics.js` `games.<slug>.accent`,
  and `manifest.json` `theme_color`. They drift independently if you're not deliberate.
- **Hard-tier goal target = the good-run bar.** `challenges.js` goal `<slug>-2.target` **must equal**
  `CHALLENGES.goodRun.<slug>`. Retune them together.
- **Head ↔ SHELL lockstep.** The shared files in the atomic `<head>` must all be in the ROOT
  `sw.js` `SHELL` — which additionally lists every `i18n.<code>.js` locale file (the head only
  loads `i18n.js`; the loader fetches the locale files at runtime, so offline they exist only if
  the SHELL cached them). A head file missing from the root SHELL silently kills it offline.
- **NEW/UPDATED are dates, not strings.** Never put "NEW"/"UPDATED" in `badges`; set `added`/`updated`.
- **`challenge.goal.<id>` is a dynamic i18n key** — the coverage scanner can't see it, so a missing
  translation renders silent English instead of failing the suite. Add it with the other keys (§9).
