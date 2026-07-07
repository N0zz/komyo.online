# komyo Roadmap

Working notes — mostly **open items (unordered)**; the one ordered track is **Path to launch** below.
Per-game feel/balance polish is continuous and not tracked here. Shipped history lives in the in-page
changelog / git. Design docs live in `~/` (not in the repo): mobile-rotation, gamedev-skills,
challenges, tv-controller.

## ✅ Done

- **Knobs audit pass — DONE (2026-06-29).** All 9 games reviewed vs `@game-design-knobs.md` (feel +
  balance). Keep Defender done (difficulty tiers + rebalance). Asteroids+ rebalanced (×10 scale, caps,
  expiry, kamikaze, finite 30-wave finale) — **shipped but still being playtested** (tracked in the
  `komyo-asteroids-plus-rebalance` note; difficulty tiers parked). Meadow Flyer speed-creep shipped.
  Other games were fine or got minor tweaks. Layout already locked by per-game `__test.layout` tests.
- **Sound & music — DONE (2026-07-01).** Kit-owned procedural music engine + richer SFX + shared reverb +
  stingers; music on every game's menu & in-game (Keep Defender swaps per-map biome tracks), Asteroids
  laser shot; catalogue global Settings page. See the `komyo-audio-design` note.
- **`gamekit.menu` framework — DONE (2026-07-01).** All 9 games migrated to the declarative kit menu
  (cards / sliders / grid / map-popup + animated backdrops), suites green.
- **Profile page + share card fit — DONE (2026-07-02, on-phone verified 2026-07-06).** Title
  box = title + name full-width with a right meta column (🏆 pts / 💪 good runs / 📅 since — always shown,
  never hidden at 0); core counts in a centered divider strip; ✕ floats on the modal corner; avatar emoji
  dropped. **Shared image now matches the live modal:** crop fixed (the clone inherited `bottom:0` →
  viewport-tall canvas), particle frame composited in, and sizing props are no longer pixel-frozen so the
  export reflows instead of truncating when the rasterizer's fonts drift (Android).
- **Score card — DONE (2026-07-02).** "Neon marquee" redesign, mock-transcribed: per-game accent +
  icon theme (from the share config), silhouette frame glows, gradient score with halo, sparkles, mascot
  logo + wordmark, ▶ play-on CTA; speedrun/sprint records render as TIME. 780×410 rounded-on-alpha WebP
  (~20 KB; JPEG on Safari). Share menu (Share… / Copy image / Download + preview) — Copy writes a single
  PNG flavor (fixes the Discord double-paste; cause was the OS sheet's multi-flavor Copy). The **Discord
  games-log posts the card itself** (halved) via Components V2 — bare image, clickable play link below,
  one request. *Mascot art refresh stays gated (Later).*

- **Cosmetics shop / trophies — DONE (2026-07-03).** Challenge points are now **trophies 🏆**
  everywhere; two metrics (lifetime → titles; spendable = lifetime − spent → the shop). New shared
  `cosmetics.js` registry (skins for all 9 games + site-wide desktop cursors, canvas painters, banded
  prices) + `gamekit.cosmetics` API + a kit-owned **store modal** (`shopPanel`: per-game groups, search
  + filter, select→BUY confirm, read-only "see titles" link) reachable from the Challenges drawer, the
  profile collection bar, and a per-game **top-bar 🎨 button** (scoped to that game + an "All games →"
  link). Each game reads its selected skin in render (no start-menu clutter). **Good-run trophy trickle**
  (+2 🏆 per good run, capped 3/day, end-menu receipt). **Meadow Flyer birds migrated** off banked cash
  → trophies 1:1 (owned birds kept). **Titles are worn, not just earned** — the ladder's unlocked ranks
  are tap-to-equip, a new higher tier auto-switches. Asteroids+ got a CRT-green whole-game hull. The
  hashed daily-pick was unified through `gamekit.challengePick` (drawer/panel/badges had desynced). The
  pre-interaction PWA silent reload was removed (badge/prompt only). Design doc: `plans/cosmetics-shop.html`.
  *Parked: mascot-attire cosmetics (gated on the real mascot); deed-locked exclusives; collector badges.*

- **i18n system + ALL 8 LANGUAGES — DONE (2026-07-05).** Full no-build i18n: kit `t()` engine +
  `Intl.PluralRules`, language picker (home Settings + in-game ☰), `?lang=`/`navigator.language`/persisted
  pick, `hreflang` + translated meta, and a **coverage test** enforcing every locale is empty-or-complete
  (now incl. every changelog entry + a per-key `{param}`-token parity check). **Live: en, pl, es, pt, fr,
  it, cs, uk** across catalogue + kit + every game + legal pages + the full changelog. Produced via the
  split-into-parts + consistency-review process, captured as the `komyo-i18n-translate` repo skill.
  Remaining: a native QA pass + mobile QA across languages × orientations. See `plans/i18n-plan.md`.
- **Home page rework — DONE (2026-07-05).** Four shelves (★ Favorites / Recently played / All games /
  Coming soon; SP+MP merged), Recently-played rail (full cards, » paddle, edge fade), favorites
  drag & drop (mouse threshold / touch long-press, ghost-clone drop slot, native long-press menu
  suppressed), right-edge quick-menu drawer (Profile wearing the current title + Challenges + Collection;
  measured-gutter default, ‹‹ tab, choice persisted), notification dots (title→Profile mirror,
  new-challenge-rotation→Challenges with ★ NEW badge inside the drawer, tab bubbling), Install/Language/
  Fullscreen icon row top-right (incl. a new `gamekit.fullscreen` + per-game ☰ entry), and the PWA
  stale-precache fix (`{cache:'reload'}`) behind the "updated but the game still shows a dot" bug.
  Design doc: `plans/top-right-menu-mock.html`.
- **Forcefield — DONE (2026-07-04).** New game (game #10), first pull from the POC branch. Planet
  shield-defense: a battle station charges + fires at a huge planet; sweep your atmosphere dome over the marked
  impact and tap to deflect (instant), or it fires on its own at the deadline. Modes: Timed / Shields / Double
  (station centre, a planet + player each side, 1–2 players); Easy/Med/Hard scale sweep speed + dome width;
  planet skins + bolt colours in the Collection; 2 daily challenges + good-run bar; PL + ES strings.
  *(Challenge targets retuned 2026-07-06.)*
- **Frog Bonk 🐸 — DONE (2026-07-06).** New game (game #11; the "Frog Rush" queue idea), built via the
  full dev-process gate + two playtest-feedback rounds. Whack-a-mole castle defense: the frog king bonks
  hatted invaders (scout/knight/mage/brute + chief mini-bosses) with a head-anchored soft hammer;
  telegraphed ranged attacks, combo scoring, fly economy. Waves (15, winnable, 2×2 upgrade shop:
  repair/walls/moat/ballista) · Endless · Zen (wander-and-leave visitors, invulnerable castle). 3/4-view
  keep, per-season meadows + hammer skins in the Collection (2 sets), animated menu backdrop whose king
  wears the equipped hammer, 2 daily challenges + good-run bar, all 8 languages, 66-assert suite. Road
  Hop's tile icon ceded 🐸 → 🚧. Kit gains along the way: music reverb routed through the music channel
  (mute now truly mutes — every game) + `cols:2` shop grids. *(Challenge targets retuned 2026-07-06.)*
- **Visual texture-pass initiative — DONE (2026-07-06).** Catalogue-wide graphics detail upgrade,
  driven by look-dev mocks the user approved before each implementation (`plans/frog-bonk-lookdev.html`,
  `plans/frog-bonk-texture-pass.html`, `plans/graphics-detail-review.html`, `plans/keep-defender-assets.html`).
  Shipped: **Frog Bonk** (all 4 meadows: cached grass tufts + colour patches + one light direction,
  per-stone castle, gradient frogs w/ glossy eyes, detailed hammer/swords, grade+vignette, textured menu
  scenery) · **Keep Defender** (drawn towers with 3 visible upgrade levels on a growing stone base —
  emoji stay in the UI — drawn enemies 1:1 with the old species, 6 themed board textures, textured keep,
  new buff/frost/impact FX, coin/orb/medallion pickups, textured menu backdrop, mage slow removed
  [Frost owns slow], THREAT uncapped) · **Meadow Flyer** (layered sky/haze/hills, ribbed stems + leaf
  collars, shaded clouds/flowers/birds, ground tufts, day+night grades, **render interpolation** fixing
  the fixed-timestep pipe hitch) · **Bubble Pop** (candy-gloss orbs + board depth + shaded walls).
  **Keep simple (decided):** Snake, Brick Breaker, Forcefield, Range, both Asteroids — flat/glow is
  their identity; **Stack closed as keep-simple too (2026-07-06)** — the minimal pastel look IS the
  style. Initiative fully wrapped. The bar is codified in the komyo-new-game skill
  (`references/visual-quality.md`: 7 requirements, determinism/perf rules, 2-round screenshot review)
  plus `references/responsive.md` (model-geometry scaling, from the frog-bonk mobile bugs).

## 🚀 Path to launch (ordered)

Reprioritised **2026-07-04**. Foundations are done (kit menu, audio, profile/best-store, challenges,
cosmetics/trophies, GA4, PWA, share, Discord auto-post). The real levers now are **reach** (more languages)
and **game count**. **Not gating launch:** the **real mascot** is dropped to Later — the placeholder chibi
art ships fine and gets swapped whenever real art lands; the **privacy policy** is in review and treated as
**non-blocking** (no longer a hard gate).

*Recently done:* the **cosmetics shop / titles** system · the **"create a game" skill** (gate cleared, used
to build Forcefield) · **friends/family circle** invited & trickling · the **i18n system + PL + ES live** ·
the **visual texture-pass initiative** (frog-bonk / Keep Defender / Meadow Flyer / Bubble Pop + the skill
quality bar — see the Done entry).

### Ordered path

1. **Translations / i18n — DONE (2026-07-05).** All 8 languages live (en/pl/es/pt/fr/it/cs/uk), full
   coverage incl. the changelog, enforced by tests. Left over (non-gating): a native QA pass + mobile QA
   across languages × orientations. See `plans/i18n-plan.md`.
2. **Build more games — *in progress*.** Toward the content bar; each via the dev-process gate (design+mock →
   POC → MVP → iterate). **Forcefield shipped** (first pull from the POC branch). **Frog Bonk shipped**
   (2026-07-06). **Bias low-tuning genres**
   (puzzle / timing / arcade-skill), **avoid balance-heavy** (tower defense, roguelite shooters). See
   `komyo-avoid-balance-heavy-genres`. Slot in **one original-mechanic, shareable game** alongside the remakes
   (see `komyo-market-expansion-discussion`). More POC prototypes wait on a separate branch. Build order below.
3. **Single service worker for the whole site — DONE (2026-07-06).** The pre-launch gate landed:
   ONE root-scope SW caches everything (catalogue + shared files + all locales + every live game —
   `GAME_SLUGS` in `sw.js`, lockstep with games.js test-enforced); the 11 per-game `sw.js` are gone,
   games register `pwa('../../sw.js')`, `gamekit.pwa()` sweeps legacy per-game scope registrations
   on boot, the root SW's activate purges the old `komyo-<slug>-*` caches, `updates.apply()` is a
   single worker swap, the catalogue's idle-register loop is deleted, deploy stamps only `sw.js`.
   Per-game manifests kept — installs keep working (root SW satisfies installability). Left to
   verify post-deploy: a previously-installed game PWA migrates cleanly (open → old worker
   unregisters → next launch runs on the root worker).
4. **Score card as the DEFAULT share payload — DONE (2026-07-06).** The endgame share is now
   score-card-first: `gamekit.shareRow` renders the card **inline** + ONE **Share** button that opens
   the image menu (native share attaches the card image **+** the link/text together · Copy image ·
   Download). Dropped the X/Reddit/copy-link buttons — a link web-intent can't carry the card, and
   mobile's native sheet already lists every app. The **site** share (footer + drawer) collapsed to a
   single adaptive button (native sheet on mobile, copy-link on desktop) — a bare link doesn't need a
   social-icon row. Profile share unchanged (already image-first). Rationale in the
   `plans/share-reorg-mocks.html` mock (option D).
5. **LAUNCH + marketing campaigns — *started* (reddit groundwork underway, see In flight).** Prep the materials (promo video / montage + Discord preview cuts,
   per-game OG/Twitter cards, story-format share card), then publish everywhere: portals (itch.io, free-to-play
   indexes), news, forums, subreddits, Discord servers, socials. Paid ads considered later.

### Ongoing (post-launch)

Rolling, no fixed order: **ship new games** · **fix bugs** · **manage & grow the community** · **keep
marketing** (experiments — QR stickers, merch, plushie) · and, in free time, **consider new features /
integrations** (see below). Plus **target tuning** (retune daily/weekly challenge targets from real GA4
completion data; confirm the UTC daily reset) and **TV + gamepad + a11y**.

### Later (non-gating)

- **QR-based save import/export** *(idea — noted 2026-07-07)* — reuse the in-repo `qr.js` encoder to
  turn a player's Export blob (bests / owned cosmetics / selections) into a scannable QR, and add a
  scan-to-import path (camera → decode → apply), so saves move device→device with no account/backend.
  **Blocker:** our encoder tops out at **QR v6 (~106 bytes)**; an export blob is far bigger (hundreds
  of bytes+), so this needs (a) extending `qr.js` to high versions (v7+ = version-info blocks +
  multiple alignment patterns) and likely (b) compressing the blob first — and a **decoder** (camera
  scan), which we don't have. Non-trivial; park until there's demand. (The score-card QR shipped
  2026-07-07 only needs a short URL, so it stays on v1–6.)

- **Render-interpolation for the remaining linear movers** *(noted 2026-07-06)* — `gamekit.loopAlpha()`
  now cures fixed-step judder; applied where visible: Meadow Flyer (everything), Brick Breaker (ball +
  power-ups, via its own accumulator), Forcefield (dome sweep + ricochets). Remaining candidates, all
  LOW visibility (motion is slow, brief, eased or masked): **Keep Defender** walkers (0.4–2 px/step +
  bob), **Bubble Pop** flying shot (sub-second), **Range** drifting targets (slow), **Asteroids /
  Asteroids+** (own loops, rotating drift — handle-with-care pair, only touch if someone notices).
  Pattern + all-or-none layer rule documented in the komyo-new-game skill (`gamekit-api.md`).

- **Top-bar button labels on desktop** *(idea — undecided)* — at ≥~900px show icon + short label on
  the right cluster (`📱 Install · Language · ⚙️ Settings · ⛶ Fullscreen`); icon-only below (today's
  look). ☰ stays bare. Static label text (no "Exit fullscreen" swap — state lives in the icon);
  only "Install" needs a new i18n key ×7; eyeball label widths per locale (uk/pt/it run long).
- **Tile blurbs behind an (i)** *(idea — parked, START WITH MOCKS in plans/)* — hide the always-on
  description; preferred direction: a small gray (i) next to the tile's ★ (tap/hover → blurb
  popover). Rejected: whole-tile hover tooltip. Blurb length is test-capped meanwhile (source ≤120,
  translations ≤170) so descriptions stay tile-sized either way.
- **Real mascot** *(external — owned by others)* — when it lands: swap the placeholder chibi everywhere +
  **mascot art refresh** of `buildScoreCard`/`buildProfileCard` around it, + a **mascot attire shop** (spend
  trophies on logo / score-card / profile mascot cosmetics). Placeholder art ships fine until then.
  Shine/PNG/share spec the shipped cards reuse: on-screen can animate (glints/particles); the **shared** card
  must be a **static PNG** (animation can't survive an image), so bake the glow/gradient/halo into the still
  (particles won't serialize into the DOM-snapshot + Safari taints → drawn-card fallback; gradient + glow
  reach the bar). **Sharing = image-first, text only as fallback** — native Web Share / Discord webhook /
  download-copy take the image; **X / Reddit intents are link+text only** (can't attach a local PNG), so better
  previews there need pre-generated per-game/score **OG images** (server-side → parked).
- **Privacy policy** *(in review — non-blocking)* — counsel is reviewing; ship-with-what-we-have (GA4 +
  Discord auto-post + EU visitors are all consent-gated already). Fold in edits when the review returns.
- **Discord Activity polish** — fix the proxied-feedback "network error" + verify webhook/GA4 in-Activity
  (bonus lane, not the main audience — see bug backlog).
- **Infra:** staging env (`staging.komyo.online`) **+ consider a Cloudflare CDN in front of GH Pages**
  (bandwidth headroom past ~100 GB/mo + the escape hatch we discussed). Staging must isolate side effects:
  `noindex` + robots disallow, **no prod GA4**, **no prod Discord webhook**, **no real Kit signups**. DNS:
  `staging` CNAME → `n0zz.github.io` in OVH; keep the two `CNAME` files straight.
- **New features / integrations** — free-time only, post-launch (see Integrations below): the deeper
  challenge/anti-cheat/Discord-role ideas stay parked until there's a backend + real demand.

### Dropped (not doing)

- **Pre-launch QA as a formal gate** — organic test-and-report via friends/family instead (the tester pool
  isn't big enough to staff a checklist; see Decision guards).
- **Wrapped-style profile expansion** — the profile v1 is enough for launch.

## Coming-soon games (queue)

Ship **lots** of games, each **polished with real depth** — added slowly, in small batches. Every new
game follows the dev-process gate in CLAUDE.md (design+mock → POC → MVP → 2–3 iterations) and the
design knobs (`@game-design-knobs.md`).

**All of the games below are already live as greyed "coming soon" placeholder tiles in `games.js`** —
titles, icons and genre tags here match the catalogue. This table is the build queue: effort + notes
per game. Roughly easiest → hardest within each group.

**▶ Next build order (2026-07-03):** **2048 → Dusk Runner → Minesweeper → Sudoku → a small kids batch**
(Balloon Pop / Glow Says / Critter Match). Rationale: all low-tuning + high-recognition = fast to build,
zero teaching cost, and organically searchable ("2048", "sudoku", "minesweeper", "dino game"); the kids
batch widens the no-ads/kid-safe lane. This batch is all remakes — per `komyo-market-expansion-discussion`,
slot **one original-mechanic, shareable game** in after 2048/Dusk Runner (don't block on it).

### Single player

| Game | Effort | Build notes |
| --- | --- | --- |
| **2048** 🔢 `PUZZLE`+`LOGIC` | trivial–low | classic slide-and-merge grid (swipe/arrows); well-known rules = zero teaching cost; undo?, board-size variants 3×3/5×5 |
| **Dusk Runner** 🦖 `ARCADE`+`REFLEX` | low | Chrome offline-dino style — mono line-art, ground runner, jump/duck, obstacle spawner, speed ramp, day→night palette shift |
| **Minesweeper** 💣 `LOGIC`+`PUZZLE` | low–med | classic grid — reveal / flag / chord; **first-click-safe** board gen (never lose on tile 1) + flood-fill reveal; difficulty = size + mine density; no balance tuning |
| **Pump Stop** ⛽ `SKILL` (+`STRATEGY` manager) | trivial–low (solo) · med (manager) | Solo: hold to pump, **stop at the target** with momentum/overrun, scored by closeness. **Tolerance is tight (~1%):** $20 off by 20¢ = fine, by 50¢ = too far under. **Manager expansion (idea, discuss later):** run **4 pumps** — cars arrive with a paid limit, stop each near its limit. Over = free-gas penalty (costs the station); tiny-under = fine; a car left under-served/unattended → patience runs out → it **blocks the pump**; **all 4 blocked = game over**. Attention is the scarce resource → triage is the game. **Open decisions:** (a) cars **auto-fill and you only tap _stop_** vs you actively **_pump_** each; (b) **one active pump at a time** vs **all at once**; (c) tolerance band (~1%? scales with difficulty?). Tension: a tight ~1% band is hard to hit while juggling 4 pumps — (a)/(b) set how forgiving it must be. |
| **Keyfall** ⌨️ `TYPING`+`SKILL` | low–med | falling words — type each before it lands; speed ramp, combos, WPM. Opens a wider WORD/TYPING lane (more later: anagram, spelling, Wordle-style guesser) |
| **Word Hunt** 🔍 `WORD`+`PUZZLE` | low–med | letter-grid word search — drag to circle, timer, themed packs; word-placement generator |
| **Sky Sling** 🎈 `SKILL`+`ARCADE` | med | bottom slingshot — drag back to aim & set power, release to fire at floating balloons; projectile physics (gravity + shifting wind), ricochets, multi-pop combos, ammo limits. Physics-aim — distinct from the kids tap-only Balloon Pop |
| **Blink** 👁️ `LOGIC`+`PUZZLE` | med | observation/memory — items cross the screen ~10–30s, then Q&A ("how many ducks?") incl. **trick questions** about things never shown (background color, an item that wasn't there) |
| **Pocket Rally** 🏎️ `RACING`+`ARCADE` | med | top-down multi-lane straight — weave the traffic, don't clip a bumper, distance + speed score |
| **Market Parking** 🅿️ `SKILL`+`RACING` | med | packed lot, too few spots — race rivals to an empty space and park before them; P1–4 (bots fill the solo game) |
| **Floodgate** 🚰 `LOGIC`+`PUZZLE` | med | pipe-routing — rotate tiles to connect source→drain before the flood; **solvable-by-construction**, leak-plug variant, grid + timer scaling |
| **Sudoku** 🔢 `LOGIC`+`PUZZLE` | med | grid + notes + hints are low; real work is the **unique-solution generator** (backtracking solver → dig cells) |
| **Invaders** 👾 `SHOOTER`+`ARCADE` | med | formation movement, descending rows, shields, escalating waves |
| **Road Hop** 🐸 `ARCADE`+`CASUAL` | med | lane spawns, log-riding, endless scroll |
| **Trap the Cat** 🐱 `PUZZLE`+`LOGIC` | med | hex grid + cat BFS pathfinding to the nearest edge |
| **Arcane** 🔮 `ACTION`+`SHOOTER` | med–high | spell variety + wave AI (scope-dependent) |
| **Icy Tower** 🧗 `PLATFORMER`+`ARCADE` | high | momentum + variable jump + wall-bounce + combos + rising floor |
| **Pulse Dash** 🔺 `RHYTHM`+`REFLEX` | high | obstacles authored to a beat + generate/sync a track |

Not new tiles — modes (added 2026-07-03, teased in the menus as locked "SOON" cards):

- **Neon Snake — Enhanced mode** — buffed-up snake with random pickups dropping on the board,
  each granting a timed/instant effect: walls off for X seconds (wrap through edges), 2× speed
  burst, snake length −50%, score multiplier window, maybe a ghost-mode (pass through yourself)…
  Tune drop rarity so runs stay skill-first; the locked menu card ships already.
- **Range — Reaction mode** — a reaction-speed test: one target at a time pops up after a random
  1–5 s delay; measure the click time per target over a Sprint-style count (10/50/100), score =
  **average (show median too)** reaction ms, not total time. Guard the obvious cheats: a click
  before the target shows = false start (penalty/discard), and cap outliers so one lapse doesn't
  wreck the average. Locked menu card ships already.

Not yet tiles (lane/genre ideas, added 2026-07-03 — a game gets a tile once it's picked + named):

- **More endless-racing lane** (beyond Pocket Rally) — e.g. an outrun-style pseudo-3D highway
  runner (curves + hills, canvas raster trick), a motorbike lane-splitter (near-miss scoring), or
  top-down drift/rally sprint. Pick 1–2 that feel most distinct from Pocket Rally.
- **More puzzle/riddle lane** (beyond Sudoku/Minesweeper/Floodgate/Blink) — nonogram/picross,
  sokoban, sliding-15, tents-and-trees / logic-riddle packs, daily riddle ("one brain-teaser a
  day" pairs with challenges/streaks). All solvable-by-construction per the design knobs.
- ~~**Frog Rush** 🐸~~ — **shipped 2026-07-06 as Frog Bonk** (see Done).

### Kids-first (ages 6–10)

Built *for* young kids: one-tap / big-target controls, no reading required, gentle/no fail-state,
celebratory feedback. The **`KIDS` genre tag now exists** (all six carry it, so the filter is already
wired) — still want to fold the gentle existing games into it (Stack, Bubble Pop, a slow Snake,
gentle Meadow). The no-ads / no-payments / no-chat / offline story is the parent pitch.

| Game | Effort | Build notes |
| --- | --- | --- |
| **Balloon Pop** 🎈 | trivial–low | tap big floating balloons; combos/colors; no fail. Kid-safe tap game (distinct from Sky Sling) |
| **Critter Match** 🐾 | low | flip cards to match animal pairs; grid sizes scale by age |
| **Glow Says** 🟢 | low | Simon — repeat the growing color/tone sequence |
| **Color Pop** 🎨 | low | tap regions to fill color; no fail, screenshot-shareable |
| **Tap & Learn** 🔠 | low–med | early-learning taps (count the ducks, tap the letter A) — *educational*, pairs with the WORD lane |
| **Maze Pals** 🐭 | low | guide the mouse to the goal; big tiles, no timer |

### Local multiplayer (single-screen)

One file, shared input on one device (desktop = split keyboard; mobile = each player owns a screen half).

| Game | Effort | Build notes |
| --- | --- | --- |
| **Mash Dash** 🏁 `PARTY` 2–4P | trivial | button-mash race to the line |
| **Air Hockey** 🏒 `SPORT` 2P | low–med | puck physics + 2 paddles. *(favorite)* |
| **Light Cycles** 🏍️ `ARCADE` 2–4P | med | neon trail-fill arena, box rivals in. *(favorite)* |
| **Slime Volleyball** 🏐 `SPORT` 2P | med | two blobs + ball + net physics. *(favorite)* |
| **Ring Out** 🟡 `SPORT` 2–4P | med | sumo — shove rivals off the disc |
| **Gravity Duel** 🚀 `ACTION` 2P | med | gravity well + two ships orbit / aim / shoot |
| **Flap Fight** 🪶 `ARCADE` 2–4P | med | flap to ride higher and stomp — Joust on one screen |

Not yet a tile (idea): **Snake Battle** (multiplayer trail duel — overlaps Light Cycles; pick one).

### Persistent / long-running games (saved-state lane) — *idea worth pursuing*

A **second category: games with saved progress** that resume where you left off. **Foxden** 🦊 `IDLE`
(grow a fox den over days) is the shipped placeholder / flagship for this lane — idle/clicker is the
cheapest proven entry. **Why:** the strongest retention lever — a daily reason to return that the
current arcade games lack; pairs with Challenges + Discord. All `localStorage` (no server), so
Export/Import matters more. Design for: per-device storage (clearing wipes progress — lean on
Export/Import), timestamp-based offline accrual (not a live timer), and a **versioned save schema**
from day one.

## Product & growth

### In flight / near-term

- **Discord changelog posts get cut mid-sentence** *(bug, added 2026-07-05)* — Discord caps message
  length (2000 chars; webhook embeds have their own caps) and `scripts/post-changelog.mjs` doesn't
  split/trim to it, so long releases truncate mid-sentence. Fix: split a long entry into multiple
  messages on bullet boundaries (never mid-sentence), or post title + first bullets + a "full
  changelog →" link.
- **UI overlap audit** *(added 2026-07-05)* — systematically hunt element collisions across
  resolutions/orientations: the in-game top bar vs the score pill (worst offender), kit menus that
  don't fit under the top bar on small/weird viewports, drawers vs the side stack, etc. The headless
  layout suite only measures canvas-internal rects (`__test.layout`) — DOM chrome overlaps need
  either real-browser screenshot sweeps or exposing chrome rects to the suite.
- **Marketing plan: re-aim at where parents & kids are** *(added 2026-07-05)* — fold into the
  `plans/marketing_plan.md` review: indie-community sharing is likely WEAK for us (those crowds are
  saturated with indie games and are mostly fellow devs, not players) — shift weight to
  parent/family/teacher channels (parenting subs & forums, family-friendly app roundups, school
  holiday activity lists, kid-safe game directories) where "free, no ads, no accounts, kid-safe,
  works offline" is the actual pitch.
- **Reddit groundwork — STARTED (2026-07-05).** Advertising in some existing threads + actively
  commenting on target subs to build presence/karma; own threads planned within a few days. Feeds
  Path-to-launch #3.
- ~~**Fable review of recent additions**~~ *(done 2026-07-06)* — komyo-new-game skill, i18n
  implementation and translations reviewed & tested.
- **Marketing plan (brainstorm + prep) — drafted (2026-07-05),** `plans/marketing_plan.md`.
  **Next: review & refine into a tl;dr.** No long prose/explanation — per plan, just the list of
  **where to post** and **what to post**, plus called-out **red flags / crucial points only** (budget
  risk, ToS/spam risk, anything that could backfire). (Feeds Path-to-launch #5 + the Marketing
  sections below.)
- **Review local Claude Code memories about komyo** (added 2026-07-02) — audit the Claude memory
  notes for stale komyo entries: plans that shipped, superseded decisions, rebrand leftovers;
  prune/merge so future sessions don't act on outdated context.
- **Real mascot art** *(in progress)* — chibi fox-girl (Holo-ish, red/orange hair, fox ears); replaces
  the header + score-card placeholder; reuse on social, stickers, 404, newsletter, empty states.
- ~~**Daily-challenge target tuning.**~~ *(done 2026-07-06)* — targets retuned across the catalogue
  (incl. Forcefield + Frog Bonk); post-launch re-checks from real GA4 data stay in Ongoing.

- **Aggregate usage insights via GA4 — v1 SHIPPED (2026-07-01).** Anonymous, consent-gated GA4 events
  via `window.gamekitTrack` (no-ops unless the cookie banner was accepted; counts only, no per-user
  data). Shipped: `audio_state` (load ping) + `audio_pref` (mute toggles, from the kit so in-game +
  Settings both count); `challenge_shown` + `challenge_done` (→ completion rates per goal);
  `feature_open` (profile/faq/changelog/settings/data/embed/challenges/newsletter/feedback/random);
  `data_export`/`data_import`; `game_play` {slug,mode}. Event categories named in `privacy.html` §3.
  **Next (read once real data flows):** if most players disable music, flip it to opt-in / lower the
  default; retune challenge targets from `challenge_done`÷`challenge_shown`. Caveat: samples only
  *consented* users → read as a trend, not a census.

- **Privacy policy — legal review** *(in progress)*. The plain-language AI draft is published at
  `komyo.online/privacy.html` (treat as v1 — accurate, not lawyer-hardened) and links from the cookie
  banner + About. **Waiting on the lawyer's response** (handoff briefs:
  `~/komyo-prawnik-brief-pl.md` PL + `~/komyo-privacy-lawyer-brief.md` EN). Open: PL-authoritative
  version + LLM convenience translations, the children/analytics question, and the Discord auto-post
  clause. Revisit `privacy.html` once counsel replies.

### Catalogue / kit

- **Tips & tricks widget** *(idea, added 2026-07-04)* — there are no loading screens, so surface
  rotating tips somewhere on the home page (e.g. bottom-right corner), cycling continuously; dismissable
  and re-openable via a small bubble button. Content: how-to-play nuggets, feature callouts (challenges,
  Collection, offline install, languages), keyboard shortcuts. Keep it unobtrusive + reduced-motion-safe.
- **Welcome speech bubble from the mascot** *(idea, added 2026-07-04)* — the header mascot says "welcome"
  in a random rotation across all supported languages (a little i18n flex). Subtle, not distracting — a
  brief bubble on load / occasional, reduced-motion-safe. (Pairs with the real-mascot work.)
- ~~**Move the Collection button to the home page**~~ *(shipped 2026-07-05)* — the 🎨 Collection is a
  top-level button in the right-edge quick menu (with Profile + Challenges); the Challenges-drawer pill was
  removed (its collection bar still opens the store).

- **`gamekit.menu` framework (v3)** *(decided — launch prio #1, see Path to launch)* — promote the
  asteroids-style mode tiles + option-group rows into a reusable `gamekit.menu`: declarative config →
  one consistent menu system across all games, less per-game markup, easy to rebuild. Migrate every
  live game onto it.

- **Audit the whole site for duplicated reused UI elements → shared kit components** *(refactor)* —
  the same widget is hand-written in multiple places with its own markup+CSS, so they drift and we keep
  hand-syncing them (the trophies + Collection **pills** already bit us twice: challenges drawer vs
  profile vs the in-game 🏆 panel; also candidates: the **collection/progress bar**, the good-run bonus
  line, the streak/points pill, buttons). Fix pattern: extract one kit factory (e.g. `gamekit.cosmeticPills(opts)`)
  + one shared CSS class in `game-kit.css`, used by BOTH the catalogue (`index.html`) and the in-game
  panel (`game-kit.js`). **Task: sweep index.html + game-kit.js for every element rendered in ≥2 places,
  list them, and extract the DOM ones into shared kit helpers.** Caveat — the **canvas** share/score/profile
  cards can't reuse DOM/CSS (they're pixels); for those, share only the DATA/label formatting (one
  function) so text can't drift, and accept the draw code is re-implemented. Moderate effort, not a rewrite.

- **Menu backdrops should share the real game engine** *(refactor — someday, not now)* — each menu's
  animated `cfg.backdrop` is currently a **hand-written re-derivation** of the game's look (starfield,
  meadow, neon snake, TD map…). That means any change to a game's visuals must be duplicated in its
  backdrop and **can drift** out of sync. Rework so a menu backdrop renders a **live idle frame of the
  actual game** (factor each game's scene draw into a shared `drawScene(frame)` the menu can call), so
  there's one source of truth. Bigger refactor (needs ambient-motion in a non-playing state); deferred.

- ~~**"CHALLENGE" tile badge + filter**~~ *(shipped — badge in the `BADGES` map + a CHALLENGE filter
  chip live in index.html; keyed to game-scoped challenges via `gamekit.challengePick`)*.
- ~~**In-game Challenges button (🏆 top bar)**~~ *(shipped — `gamekit.nav` adds the 🏆 button in every
  game; `gamekit.challengesPanel` is the shared board, `gamekit.activeChallenge` drives the glow)*.
- **Claude skill: scaffold a new game on our framework** *(idea — dev tooling, big leverage)* — a
  `synerise`-style skill (name TBD, komyo-scoped) that captures **once** everything a new game must obey
  — repo layout, the three-screen schema, `gamekit.menu` declarative config, `gamekit.sound`/`music`
  usage, the `__test`/`__test.layout` hooks + headless-safety rules, the single-source best store
  (`gamekit.best`/`saveBest` + `modeLabel()`), PWA files (manifest/sw/icons), `games.js` + changelog +
  sitemap/llms wiring, and the design knobs (`@game-design-knobs.md`) — distilled from the existing 9
  games' patterns and this repo's CLAUDE.md. Then: **describe a game in ~5 min → get a working,
  on-framework MVP in a 20–30 min session** (POC → MVP that boots green in the suites, correct theme,
  menu, sound, tests). The skill encodes the *dev-process gate* so the output isn't a one-prompt game —
  it stops at a playable MVP for human iteration, not a "done" claim. **Build it by mining the repo once**
  (patterns are already consistent across all 9 games), store as a reusable skill, then author new games
  through it. Nice-to-have accelerator for the "build to 15–20 games" bar, not a launch blocker.
- **CI check: `updated` badge stays honest** *(idea — dev tooling)* — a GitHub Action that fails when a
  game's OWN files changed but its `updated` date in `games.js` wasn't bumped (so the UPDATED badge never
  goes stale/missing). **Crucial nuance:** shared changes (`game-kit.js/css`, `challenges.js`, etc.) affect
  every game and must NOT require bumping any game's `updated` — a minor menu/kit tweak shouldn't mark all
  9 games "updated" when the games themselves didn't change. So: "game changed" = a diff under
  `games/<slug>/` (probably excluding deploy-stamped `sw.js` VERSION churn); shared/kit diffs are exempt.
- **Custom error pages** — verify what GitHub Pages actually allows. A root **`404.html`** *is*
  supported → build a branded one (mascot + search / back-to-catalogue; ties into the mascot reuse).
  Other codes (403 / 5xx) are served by GitHub/Fastly and **aren't customizable** on a static Pages
  site — confirm the limits and document what we can/can't do.
- **"My profile" — v1 SHIPPED (2026-07-01).** Catalogue ☰ → 👤 My profile: summary (games / modes / plays /
  days), favorites (favorite game by plays, most-played mode, favorite genre, top score, good runs,
  playing-since), per-game PB tables (best + plays, only games with a PB), and a shareable stats-card
  image. Backed by the kit's **single source of truth for bests** — all 9 games read/write via
  `gamekit.best`/`gamekit.saveBest` (`gamekit_pb`, keyed by a human mode label) + `gamekit_stats` for
  lifetime rollups. No per-game best-keys, so menu & profile can't diverge; reset prunes the store; portable
  via Export/import. **Wrapped-style expansion (next):** play/longest streak, challenges completed, this-week /
  this-month / all-time toggles, "new games tried", milestone badges (played-every-game, first-10k,
  N-day-streak), night-owl/early-bird from play-hour, and a **"Your year in komyo"** multi-slide seasonal
  card. Deeper ones (total minutes played) need coarse session-time tracking in the kit. Original spec:
- **"My profile" modal + shareable stats card** *(original spec, superseded by v1 above)* — a profile the player opens from the catalogue
  (☰ menu, next to Settings) that summarizes THIS device's play: total games played + total game-modes
  played, and the best score across everything. Below the summary, per-game high-score tables/lists
  **sorted by game**, showing each mode's PB. **Only list games where the player has a PB** — if every
  mode of a game is 0/empty, hide that game entirely (so a fresh device shows little/nothing, and it
  fills in as they play). Data is already on-device: per-game `*_best*` localStorage keys + the kit's
  `recordResult`/`lastResult` history — no backend. **Key requirement: a Share button** that renders the
  *exact view shown in the modal* as a **score-card image** (reuse `gamekit.scoreCard`/`buildScoreCard`)
  and shares it (Native/X/Reddit/Copy + Discord), so the shared image matches what the user sees. Pairs
  with the global Settings page and the score-card redesign (gate the visual on the real mascot).
- **Sitemap coverage — add the static pages** *(SEO fix)* — `sitemap.xml` currently lists only the
  catalogue + each live game, not `tos.html` / `privacy.html` (nor any future standalone pages). Decide
  whether these belong in the sitemap (they're indexable, low-churn, low-priority) — likely **yes, add
  them** with a low `<priority>` so search engines can discover them; also cross-check `llms.txt` and
  `robots.txt` list what we intend. One-time audit + a note in CLAUDE.md's "when a page goes live" step
  so new standalone pages get added going forward.
- **"Play a random game" button + challenge — SHIPPED (2026-07-01).** 🎲 Random button in the toolbar
  picks a playable game, **prefers unplayed** (a `gamekit_pb` entry = played), falls back to all when
  everything's been tried. Plus a `scope:'random'` daily & weekly challenge ("play today's/this-week's
  pick") resolved from the deterministic, same-for-everyone `CHALLENGES.randomSlug(idx, playable)` — based
  on **all** games (never unplayed), lights the CHALLENGE tile badge on the pick, and stores the resolved
  game title in history. Only the *button* filters to unplayed.
### Platforms

- **TV & controller support** (Android/Google TV · remote · gamepad) — full design at
  `~/komyo-tv-controller-design.md`. a11y + remote + gamepad for **all viable games** (the a11y/keyboard
  win alone justifies it); non-viable games **clearly marked Steam-style** (🎮/⌨️/📺 badges), not forced.
  Steps: (1) keyboard **focus + spatial nav** for catalogue/menus, (2) kit **`gamekit.input`** layer
  (keyboard+gamepad+touch), (3) per-game `controls` capability map → badges **+ catalogue filters**,
  (4) 10-foot polish. (GitHub Pages can't install as a TV app — target browser play.)

### Distribution

- **Promo video / ad montage** *(idea)* — record short clips of the menus (now with animated
  backdrops) + a few games. Capture the source footage once at high quality, then export **two cuts**:
  - **Full montage (YouTube / Twitch / social)** — the good-quality version: 1080p+ (up to 1440p/4K
    source), longer, higher bitrate, with music. The main marketing asset for socials + channel trailers.
  - **Discord Activity "Video Preview"** — the tiny in-directory clip (shown on hover + on the
    click-through upsell): a brief screen-recording of the activity. Hard limits: **640×360 · 16:9 · mp4 ·
    ≤0.5 MB · 10 s** → short, low-bitrate cut; a per-activity preview if games ship as separate Discord
    activities. Downscaled from the same source footage.
  Do it once the menus + games look final.
- **List on game portals** — itch.io, free-to-play indexes.
- **Discord Activity (play inside a voice channel)** *(idea — strong architectural fit)* — register a
  Discord app with **Activities** enabled (Embedded App SDK) so people launch komyo **inside a voice
  channel** and play together right on the server. Our games are static, self-contained and
  same-origin / no external deps, which is exactly what the sandboxed Activity iframe wants (the main
  chore is routing any requests through Discord's `/.proxy/` URL mapping + the CSP). Bonus: the SDK
  exposes the Discord user, so we could **auto-set the display name** for the score post. Pairs with the
  Discord-first community plan; needs a public, approved app. Likely **post-launch** (after the server +
  mods are real), but low-friction given the architecture.
- **Discord auto-post at scale (decided).** Keep posts **client-side**, shard by **one channel + one
  webhook per game** — each game is then an independent ~30/min bucket (the ceiling is keyed to channel
  *and/or* webhook, and per-game makes both unique, so it works either way). No practical per-server
  cap; Discord's global ~50 req/s is **per origin IP**, and client posts come from each player's own
  browser, so that never bites. Gate volume with a **filter + adjustable threshold** — only post scores
  above a tunable level (records / notable runs), with a knob to dial how chatty it is. The realistic
  wall is a *single game* getting >~30 finishers/minute (a great problem, far off).
  - *Not doing — batching* (needs a server to aggregate across players; pointless per-player — see
    Decision guards). *Parked — a relay* in front of the webhook (the client-embedded webhook is an
    open spam target; a relay would hide+rate-limit it, but it's a Cloudflare-Worker route we're
    avoiding for now — see Parked).
- **Shared scores feed = Discord** (the score auto-post is the games-log). A live **on-site** feed needs
  an off-GitHub backend (Pages is static — can't host an endpoint, so no GH load risk): **(a)** scheduled
  Action scrapes Discord → static `scores.json` (stopgap, near-live, one-way, GitHub-native — preferred),
  or **(b)** Cloudflare Worker + KV (`POST /score` → capped list, `GET /recent`; truly live — *parked,
  see Parked*). Filter to **good scores / records only**; public `POST` has the same abuse surface as
  the webhook. **Defer** until real traffic (an empty live feed looks deader than none).
- **Optional:** opt-in toggle for the Discord score auto-post.

### Integrations (ideas — for later)

Filter for all of these: **does it keep the no-server / no-ads / no-accounts identity?** Most
"integrations" quietly need a backend; these are sorted by whether they do.

**Good & low-friction (fit the ethos):**

- **Twitch chat (client-side, no backend)** — *the standout.* A streamer logs in with Twitch; the game
  connects to **Twitch chat over IRC-WebSocket from the browser** (no server), and viewers affect/play
  via chat: vote the next wave, spawn a boss, names on-screen, chat-triggered events — e.g. emoji/message
  spam thresholds spawning monsters or firing visual effects (per-game opt-in; some games suit it, some
  don't). Fits "self-contained"; streamer + chat is the best organic-reach lever. Suits Keep Defender /
  Asteroids. *(2026-07-03)* **"Chat plays komyo"** variant — chat votes what game to play next and then
  makes the moves (command voting per turn/tick); realistic for turn-based or genuinely slow games
  (a future Sudoku / Trap the Cat / Floodgate lane, or a slowed-down Snake), hopeless for reflex games.
  (Deeper hooks — channel-point EventSub, a published Twitch **Extension** panel — need an Extension
  Backend Service → parked.)
- **Google Play via PWA wrap** — games are already PWAs; Bubblewrap / PWABuilder wraps the catalogue (or
  a game) as a TWA → real Play Store presence, no backend, no ads. Best app-store route. (iOS needs a
  wrapper + Apple review — harder.)
- **itch.io HTML5 uploads** — zip each game; itch hosts + brings players, ad-free-friendly, embeddable.
  Concretizes "list on portals."
- **Cloud-sync the Export/import blob** *(idea — optional convenience)* — let a player connect a personal
  storage provider (Google Drive / Dropbox / OneDrive) so the base64 export auto-syncs (backup + carry
  between devices) without manual export/import. Client-side OAuth to the *user's own* drive — **no komyo
  backend, no accounts on our side** (keeps the no-server / privacy stance). Watch: OAuth needs registered
  app credentials + redirect handling on a static site, and token storage; keep it strictly opt-in. Nice
  step up from manual Export/import once profiles matter to people.
- **Challenge-points progression / economy** *(idea — big; needs a backend to do properly)* — spend the
  challenge points on rewards:
  - **Titles** — unlock cosmetic titles at point thresholds, shown on the profile page (cheap, client-only).
  - **Collectibles shop** — buy **mascot skins** with points; the mascot is the logo + shows on score cards,
    so a skin is visible and worth chasing (client-only if purchases live on-device).
  - **Per-game cosmetics shop** — PROMOTED to Path to launch #5 (2026-07-03); spec lives there now.
  - **Discord roles/titles** — spend points for a Discord role — a real status carrot. Needs a Discord bot +
    OAuth (link account → grant role), i.e. a small backend.
  - **The hard part = anti-cheat.** Points on-device are trivially forged (export → bump → import), so any
    reward that grants *external* value (a Discord role) must verify the **whole history** — plays, records,
    and challenge-completion log — not just the number. Recompute expected points from that history; if it
    doesn't reconcile (claims 1000 but history supports ~10), reject and optionally flag (a jokey **"cheater"**
    role). Note honestly: since everything is currently client-side, a determined cheater can craft a
    *consistent* fake history offline — client verification only raises the bar (you'd have to recreate a
    plausible full history), it doesn't prevent. **True** integrity needs server-side authoritative recording
    (log each result as it happens), which is a real departure from today's **no-backend / no-accounts /
    device-only** model. So: titles + mascot-skin shop are doable client-side now; Discord-role spending and
    real anti-cheat are a separate, backend-gated project — decide if the status payoff justifies leaving the
    serverless stance.
- **Duel / tournament mode** *(idea, added 2026-07-03 — feasibility TBD)* — join a P2P lobby with
  friends, pick ~3–5 games+modes between players/teams, everyone plays them for highest score; best
  score takes the game, most games won takes the match. To consider honestly before building:
  (a) **"no servers" is only half-true for P2P** — WebRTC data channels are serverless for the match
  itself, but pairing needs a signaling channel (manual room-code/copy-paste blobs are possible but
  clunky; a tiny relay is the usual answer — collides with the no-backend stance, see Parked);
  (b) **cheating is trivial** — scores are client-reported, so a duel is honor-system only (fine for
  friends, meaningless for strangers — same anti-cheat wall as the points economy); (c) a cheap
  near-term substitute: a **challenge-link mode** ("beat my 4,320 in Asteroids — same seed") that
  shares a target via URL params, async instead of live, zero infra. Decide if the live-lobby version
  is worth it at all given (a)+(b).
- **More share targets + story-format card** — add WhatsApp / Telegram / Bluesky / Mastodon / Threads
  intents (just URL schemes) + a **vertical "story" score-card** for IG/TikTok Stories. Cheap; leverages
  the existing share row.
- **Per-game OG/Twitter cards** — static per-game share images so a shared *game* link looks good (not
  just the homepage). Small SEO/social win, no infra.

**Needs a server/Worker → parked** (we're avoiding that — note the benefit, don't build): dynamic
*per-score* OG images, global cross-player leaderboards, Reddit/X **auto-posting** of records, Twitch
Extensions w/ EBS, Discord channel-point hooks.

**Marketing, not integration:** YouTube / TikTok / Shorts = a *content* play (clips of satisfying
moments, a devlog, a komyo channel), no API work. (Discord **Activity** — play in a voice channel — is
the best Discord-native one; already under Distribution.) **Idea — a dedicated TikTok / YT Shorts
channel** posting short feature/game ads, hashtags **#komyo-feature** / **#komyo-game**.

**Honest tradeoff:** the big traffic portals (Poki, CrazyGames, GameDistribution) send real volume but
inject **their ads** + want **their SDK** — collides with the "no ads · plays offline" pitch. itch.io
and Play-via-PWA don't. Treat the ad-portals as a separate, deliberate decision later.

Ranked pick if/when we act: Twitch chat → richer share targets + story card (cheap, pre-launch) →
Play Store via PWA → itch.io. Rest are post-launch or parked.

## Marketing experiments

- **Mascot QR stickers** — high-boredom-with-phone spots (bus stops, cafés, queues); tracked URL (GA4) +
  a reason to scan (pair with the Daily Challenge). Small measurable side-experiment.
- **Merch** — mascot on stickers/tees/mugs/pins (print-on-demand). Brand + fun, not revenue; gate behind
  the mascot + some audience.
- **Hand-made komyo plushie** — one-off passion/brand object; giveaway / hero photo. Needs the mascot.
- **AI/vibecoding-channel marketing — the repo IS the ad** *(idea — risky, considerable)*. Advertise in
  AI / genAI / vibecoding communities (Show HN, r/ClaudeAI, r/vibecoding, AI-dev X/YouTube), promoting
  the **GitHub repo itself** as the artifact: a whole product built AI-first with the full development
  history public (~400 commits in the first week, CLAUDE.md-driven workflow, per-game test harnesses,
  the create-a-game skill). People check what the repo *produces* → discover komyo.online. Upside: the
  "watch a complete product get built" story is rare content, and that audience IS the HN/curator crowd
  that features browser games; it's a second acquisition lane that doesn't compete on game keywords.
  Risks to weigh before doing it: publicly brands the site "AI-made" (quality skepticism sticks to the
  brand, not just the post), audience is devs not players (traffic may not convert to play sessions),
  and it spotlights the repo for cloners (public anyway, but promotion invites it). Mitigation if tried:
  lead with the games' polish, frame AI as the *how*; do it as one deliberate launch-style post, not the
  identity.

## Parked (someday)

- **Live "users online now" count** — not possible client-side on a static site; conflicts with the
  no-server identity. Routes if reconsidered: GA4 Realtime via a relay (approximate) or a small presence
  backend (Cloudflare Worker + Durable Object / WebSocket — accurate but real infra). Empty-room risk on
  a young site.
- **Sort tiles by popularity (GA4-driven)** — scheduled Action reads the GA4 Data API → static
  `stats.json`; `render()` sorts playable tiles (favorites pinned; missing/zero → current order). Could
  also drive the "POPULAR" badge.

- **Cloudflare Worker (any role)** — *avoiding for now: prefer staying GitHub-Pages-only, no extra
  platform.* Saved only for what it *would* give if ever reconsidered: (a) a truly-live on-site scores
  feed (`POST /score` → capped list, `GET /recent`); (b) a validating, rate-limiting **relay** in front
  of the Discord webhook (hides the URL → kills the client-embedded-webhook spam surface, drips under
  rate limits). Not wanted now — note the benefits, don't build it.

## Decision guards (don't re-propose)

- **No user-facing sort control** — closed 2026-07-06: sortable Favorites + the Recently-played rail
  cover the need; a Featured/Newest/A–Z dropdown adds chrome without value at this catalogue size.
- **No per-tile personal bests** — every game has many modes, so there's no single best to show, and it
  overcrowds the home page.
- **No on-site local "recent plays" ticker** — with no server it only shows your own plays and misreads
  as a community feed (tried + removed). The shared feed is Discord; see Distribution for the live route.
- **No formal idea→release checklist / per-game QA blocker list** — testers play what they *like* and
  report issues there; they won't grind a feature checklist over untested games, and a blocker list of
  untested games is meaningless. Organic test-and-report instead. (Revisit only if the tester pool
  grows enough to staff structured QA.)
- **No batching of Discord score posts** — batching only pays off by aggregating across many players at
  a central point, which needs a server; a single player doesn't finish games fast enough for
  per-player batching to mean anything. Use the filter + per-game channels instead.
