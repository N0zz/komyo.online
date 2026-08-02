# komyo Roadmap — archive

Shipped, dropped, parked and settled. Split out of `ROADMAP.md` on **2026-07-26** so the roadmap
holds only open work. Nothing in this file is a task.

**Read the decision guards below before proposing anything — those are closed on purpose.**

## Decision guards (don't re-propose)

- **A cumulative achievement may never cost 50 🏆.** 50 is the skill tier — a wall you have to get good
  at. Grinding a counter is not difficulty, and pricing it like skill makes "kill 500 things" worth more
  than "reach wave 20 on Hard". Suite-enforced (2026-07-30).
- **An achievement must not restate a challenge goal.** `challenges.js` already owns "score N in X";
  achievements are conditions, bests and cumulative totals that stay true once done (2026-07-30).
- **No fourth side-stack button for achievements.** They are a tab inside the Collection modal, which is
  already scoped per game + site-wide — exactly the scoping achievements need. A fourth button costs the
  gutter measurement and the landscape rail, which is where things have shipped broken before (2026-07-30).
- **"Join the Discord" / "install the app" / "play offline" are not achievements.** With no accounts the
  first can't be verified (it reduces to a button that pays trophies to anyone who clicks), and the other
  two ask for device actions many players can't take at all (2026-07-30).

- **No standalone math game** — closed 2026-07-27: a second tile that differs from Type Siege only in
  whether the enemy carries a word or a sum is catalogue padding, and a curated catalogue is most of
  what keeps komyo from reading as shovelware. Discoverability does not override that — a tile whose
  purpose is to be found IS the padding. Math ships as a Type Siege MODE, surfaced via the UPDATED
  badge, a MATH tag and the page's SEO text. A math game earns its own tile only when it stops being
  the same game (different enemy behaviour or win condition); a content swap never earns one.
  → `plans/backlog-notes.md` § Games
- **No user-facing sort control** — closed 2026-07-06: sortable Favorites + the Recently-played rail
  cover the need; a Featured/Newest/A–Z dropdown adds chrome without value at this catalogue size.
- **No per-tile personal bests** — every game has many modes, so there's no single best to show, and it
  overcrowds the home page.
- **No on-site local "recent plays" ticker** — with no server it only shows your own plays and misreads
  as a community feed (tried + removed). The shared feed is Discord; see Distribution for the live route.
  **Superseded 2026-08-02 by the activity log** (shipped): the same corner, deliberately reframed as a
  PERSONAL history — records, achievements, challenges, cosmetics, titles, good-run days, never "runs".
  What changed is the framing and the content, not the verdict on a fake community feed: a local list of
  *other people's* plays is still out, and a per-run ticker is still out (it was the noise that made the
  old one read as a feed). It survives because it backfills — achievements, cosmetic buys, challenge
  history and good-run days are already dated in their own stores, so it opens full on day one rather
  than looking dead. Those stores only keep a DAY, so `gamekit_log` doubles as a **precision cache**:
  each new unlock / purchase / good run / same-day challenge also writes a timestamped stamp, matched
  back to its derived row by key. Wipe the log and every row survives at day granularity — it is never
  the source of truth. Existing history was deliberately NOT back-stamped (there is no time to
  recover, and a plausible invented one is worse than admitting the date), and a retroactively
  awarded challenge stays day-only because awarding scans ~15 days whenever the catalogue opens. **Shape and corner are settled — don't re-propose either:** it is an inline
  MMO-chat stack of loose bubbles in the **bottom-LEFT** (a ~5-bubble-tall box, newest at the bottom, ~62%
  opacity at rest, full on hover), shown by default, paged ONLY by scrolling up, resized by a corner
  grip (drag; double-click resets; per-device, clamped to the viewport on every relayout), with the
  controls BELOW the stack in the corner so the handle sits in one fixed place open or closed:
  ✕ → collapse to a clock button carrying an unseen count, eye → pin it back.
  **Touch is a different product**: `:hover` never fires, so the resting dim left it permanently at
  62% and washed into the tiles — on a coarse pointer it is full-strength, near-opaque, starts
  COLLAPSED below 820px, hides the grip, and a peek raises a scrim over the page. All gated on
  `(hover: none)`, and those rules must sit AFTER the base ones in the file (equal specificity). Rejected attempts, in order: a framed drop-down
  panel (too heavy for ambient content); the bottom-RIGHT corner (the side stack, the back-to-top
  button and the tucked ‹‹ tab already share that edge — clearing all three pushed the stack up into
  the middle of the page); an in-scroll "▲ older" pill (scrolled out of reach, clipped by the top
  fade); a −/+ size stepper (confusing next to a scroll region that already
  pages itself — replaced by the drag grip); and controls ABOVE the stack (they floated detached at
  its far top-right).
  **No emoji in the chrome** — the bubbles are full of emoji, so emoji controls read as content.
- **No formal idea→release checklist / per-game QA blocker list** — testers play what they *like* and
  report issues there; they won't grind a feature checklist over untested games, and a blocker list of
  untested games is meaningless. Organic test-and-report instead. (Revisit only if the tester pool
  grows enough to staff structured QA.)
- **No batching of Discord score posts** — batching only pays off by aggregating across many players at
  a central point, which needs a server; a single player doesn't finish games fast enough for
  per-player batching to mean anything. Use the filter + per-game channels instead.
- **No game-portal push** — closed 2026-07-26 after the itch.io test (Asteroids+ listed, ~0 views):
  our recognizable remakes can't win generic-tag browse, and per-portal uploads are real labor. Site
  only. Revisit *only* as cheap SEO backlinks once an original earns its own landing page.
- **No parental lock beyond the PIN** — closed 2026-07-26: the shipped PIN gate is enough; the
  Disney+-style spelled-out-digits word check and external-link gating are dropped.
- **"Retune from GA4/feedback" is not a roadmap item** — closed 2026-07-26: rebalancing challenges,
  targets and games from real data + player feedback is simply how we work, continuously. Don't file
  it as a task.
- **No long prose in `ROADMAP.md`** — closed 2026-07-26 (the 550→lean rewrite): the roadmap is a todo
  list, one line per item. Rationale goes to `plans/backlog-notes.md` or a `plans/*-plan.md`; games go
  to `plans/games-queue.md`. Don't re-grow the roadmap into a design doc.

## ✅ Done

- **In-run new-best pulse — SHIPPED (2026-07-29).** Beating your own record now lands twice: a flash +
  "New best!" banner the instant you pass your old bar mid-run, and confetti + the `newbest` stinger on
  the end screen. Kit-owned end half (`menu.show`, all games); the live half needs the game's own score,
  so each of the **19 viable games** calls `gamekit.bestWatch`/`bestTick`. Four games have **no live bar
  by design** — minesweeper, sudoku, trap-the-cat, critter-match — and time-primary modes disarm
  themselves. Full reasoning + the don't-"fix"-these list: `plans/backlog-notes.md`.
- **Achievements 🏅 — SHIPPED (2026-07-30).** 79 evergreen, never-rotating goals — 15 site-wide + 2–5
  per live game — paying 🏆 into the LIFETIME total (so they also climb the titles ladder). Data in
  `achievements.js`, logic kit-owned (`gamekit.achievements`), UI = the Achievements tab of the
  Collection modal (a wall of rows with live progress bars, grouped by game, searchable and filterable
  like the shop), plus a bar in the profile, a one-line end-menu receipt and a dot on the Collection
  button. An entry declares ONE shape: `max:` (best-ever, from the `gamekit_pb` MAXes), `sum:`
  (cumulative, the new `gamekit_tally`), `site:` (a closed counter vocabulary) or `run:` (a per-run
  conditional, no bar). First evaluation BACKFILLS `max:`/`site:` from existing history, so returning
  players opened the wall to what they had already earned. 13 games gained one or two `record.stats`
  fields to feed the predicates. Registry, predicate matrix, backfill, payout-once and the head/SHELL
  lockstep are all suite-covered, and the whole set shipped translated into all 8 languages.
  → `plans/achievements-plan.md`

- **Tube Racer 🌀 — SHIPPED (2026-07-28).** A supersonic pseudo-3D tunnel racer: you're magnetically
  stuck to the inside of a pipe, roll 360° around the wall to line up with each barrier's gap, and
  trade heat for speed (boost scores faster and breaks Mach 2; the blue cooling strips are the only
  refund). Four modes — Classic (endless, Easy/Normal/Hard), Sprint (3000 m, time-primary), Redline
  (boost jammed on), Cruise (🐣, no overheat death, 5 hulls) — plus narrowing segments that heat the
  engine and shear plates that kill steering for 0.9s. Hazards ESCALATE by score, not distance
  (friction 1.2k → shear 3.5k → rotating bars 5k → iris shutters 6.5k → sentinels 8k → crossfire +
  the Plug 10k), each announced on arrival — so a player who boosts hard escalates their own
  difficulty. **No difficulty selector**: an easier setting gave wider gaps AND a slower ramp while
  score, records and challenge targets ignored which you picked, so the easiest option strictly
  dominated — the escalation IS the difficulty. Throttle has three positions (boost / coast /
  brake); braking sheds heat fast and costs score, which is what gives a friction band entered too
  hot an answer that isn't luck. Plus a **fixed-tube camera** + invert-steering for players the
  world-spin makes queasy. (Two features were built and cut: warp-gate pickups — too much on screen
  at once — and signposted **junctions** with four rule sets, first as markers on one pipe and then
  as genuinely diverging twin tunnels; both read as visual clutter you had no time to parse at
  speed. The `run_choice{choice_kind:'route'}` telemetry went with them, so the game ships with no
  in-run decisions and therefore no run telemetry.) Two cosmetic sets (4 tube
  palettes = the whole screen, 5 bike hulls incl. a fox), own `tuberacer` music track (kit
  tactical + trance; dropped out of the audio-lint sibling band entirely), seeded track generation,
  149-assert suite. **Built POC-first** (`plans/tube-racer-poc.html`, played and approved before any kit work).
  Findings worth keeping: (1) a true `1/z` projection makes a barrier ~5px until 0.15s before impact
  — the game uses a flattened `r = focal / z^0.55` and derives every speed FROM the readable window
  (~2s telegraph at cruise vs ~0.7s boosting); (2) pipe curvature is render-only — collisions are
  angle-vs-angle, so a bend can never make a gap unfair; (3) **scaling the pipe radius to "narrow"
  it scales the player too**, so it reads as the camera zooming out — the mechanic survives as
  flat-radius friction bands; (4) a heat warning keyed to a projected time-to-overheat from the LIVE
  rate is wildly inconsistent (coast to 95%, then commit to boost, and the lead collapses to
  0.17s) — severity is the heat LEVEL, flat out, at 50/65/75%; (5) hull damage must never be able
  to trigger the heat death: a flat +0.2 heat per scrape killed players by OVERHEATING while they
  still held spare hull, and the end screen blamed the wrong system; (6) the heat gauge belongs on
  the tube's flanks and on the hull itself, not in a screen corner you can't look at while
  threading a gap; (7) collision used the same generous half-width as the pickup lanes, making
  hazards ~3× wider than the drawn craft — generous for lanes, honest for walls.

- **Single-SW migration — DONE (verified 2026-07-28).** No per-game `sw.js` remains anywhere under
  `games/`; the ONE root-scope `sw.js` + `sw-core.js` serve the whole site, and `gamekit.pwa()`
  unregisters every non-root scope on boot (`game-kit.js` § pwa migration sweep), so a pre-migration
  install can't shadow the root worker. The only thing no test can fake — the hand-over on a phone
  that still has an old per-game PWA installed — is not worth tracking as a task; the sweep is
  unconditional and runs on every game page load.

- **🐣 Easy picks — DONE (2026-07-12).** Optional Settings switch for young players: every
  difficulty-bearing menu group/toggle in every game carries a `kid:` flag — when the switch is on,
  the kit marks the gentlest option with 🐣 AND makes it the menu default, and KIDS-tagged tiles
  sort first on the home page. All 18 live games annotated, Settings row translated ×8, kit +
  catalogue behavior test-enforced; the new-game skill requires the annotation on every future game.

- **Per-game SEO pass (2026-07-12).** Every live game page now ships the full discoverability
  unit: keyworded `<title>` + meta description + canonical + hreflang ×8 + OG/Twitter +
  `VideoGame` JSON-LD, plus a **crawlable `#gk-about` section** (how-to, FAQ, related-game links)
  that doubles as the new ☰ **"ℹ️ How to play"** panel in every game — static English for
  raw-HTML/LLM crawlers, kit-localized in place for players and Google (all 8 languages).
  `testSEO` in `test.mjs` enforces the whole unit; the komyo-new-game skill bakes it into every
  future game. **Still on the user: Google Search Console + Bing Webmaster verification** (the
  measuring instrument for whether any of this ranks) + the ongoing Reddit backlink work.

- **Six-game batch SHIPPED (2026-07-12).** Overnight-built MVPs → 2 playtest-feedback rounds →
  fully translated (185 keys × 7 locales) → changelog'd + deployed: **Minesweeper 💣 · 2048 🔢 ·
  Trap the Cat 🐱 · Glow Says 🏮 · Balloon Pop 🎈 · Critter Match 🐾** — catalogue now at **18 live
  games**, kids lane open (3 kids-first titles). Rode along: cosmetics price-tier sweep (every game
  2+ cheap skins, new premium tier), 🎁 Welcome gift (one-time 100 🏆) + ✨ Free play try-on mode,
  catalogue filter persistence + hold-to-clear, the ⚡ good-run widget.

- **Sudoku shipped (2026-07-10).** Technique-graded generator (unique-solution, Easy→Expert by
  required technique), UTC Daily (weekday-rotating difficulty, per-band bests), Zen, teaching hints
  (highlight + reasoning, never a reveal), pencil marks/undo/digit counters, in-progress board list
  (autosave, resume, cap 20), 4 board themes + Ink/Animals/Shapes digit styles, 7 locales.
  Kit gains along the way: daily-pick freeze (playableSince), disabled menu actions, card corner-🗑,
  and **live language switch rebuilds open menus in ALL 12 games**. Plan: `plans/sudoku-plan.md`.

- **Audio v2 — reactive music engine — DONE (2026-07-07).** The Audio Lab mock's generative "modern"
  engine shipped into the kit as the default music for all 11 games: gameplay-driven **intensity**
  (each game feeds 0..1 from its state; layers ease in/out, never pop), the per-game track registry
  (unique progressions/keys, 6 Keep Defender biome tracks), **music as a cosmetic** (Snake defaults
  to Remaster; Banger unlockable at 100 🏆) with **▶ preview before buy** in the Collection. Zero-asset.
  Plan: `plans/audio-ship-plan.md` (all ticked). *Leftover (nice-to-have): point `plans/audio-lint.mjs`
  at the kit's real track registry instead of the mock.* Follow-up ideas: `plans/audio-music-plan.md`
  ("Audio v3" — scale to hundreds of seeded tracks, see Later).

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

### Also shipped / superseded — moved out of the open sections (2026-07-26)

Verbatim, in their original roadmap order. Any leftover work from these got a one-line
open bullet in `ROADMAP.md`.

- **✨💡 Discover rails — DONE (deployed 2026-07-22)** — two untried-only home-page
  carousels: "What's new" (added/updated ≤30 days, freshest first) + "For you" (genre-affinity
  from local play history + POPULAR nudge + daily tie rotation); no gate — new users see them
  too; 🐣 Easy picks lifts KIDS games; both collapsible, vanish when everything's tried. v1
  (single rail) shipped same day, then split per discussion. NEW/UPDATED tile badges later
  aligned to the same 30-day window (2026-07-22) so shelf and badges stay in lockstep.
  **Later/if-ever:** the 🎲 tinder-deck picker (from the Random button, never a new button/menu
  item). Plan + decision log: **`plans/discover-plan.md`**.

- **🔒 Parental lock — DONE (deployed 2026-07-22)** — hand the device to a kid without them spending
  trophies / wiping data: kit-owned PIN gate (PBKDF2-hashed via `crypto.subtle`, never plaintext —
  people reuse bank/phone PINs) on shop BUY, "↺ Reset game data", Export/Import, and the lock's own
  settings; 5-wrong-tries cooldown; zero-knowledge recovery = a **daily 8-digit support code**
  (UTC-derived, self-rotating, typed into the Forgot-PIN pad — works even in iOS home-screen
  installs; support generates it on demand via `scripts/support-code.mjs` or a console snippet
  kept in the INTERNAL Discord staff channel); `gamekit_lock` excluded from Export. Deterrent, not
  security (client-side, said plainly). Separate from 🐣 Easy picks. **Later:** 📖 word-check gate
  (Disney+-style spelled-out digits — reading test, no secret; second strength option) +
  external-link gating. Plan: **`plans/parental-lock-plan.md`**.

- ~~**Discord changelog posts get cut mid-sentence**~~ *(fixed 2026-07-12)* — long entries now split
  into multiple messages on bullet boundaries (never mid-sentence).

- **Marketing plan: re-aim channels at teen+parents — DONE (2026-07-22)** *(policy set 2026-07-14 —
  decided; applies to NEW posts only, not the launch posts already up; re-aim now applied).* Fold into
  `plans/marketing_plan.md`: indie-community sharing is likely WEAK for us (those crowds are saturated
  with indie games and are mostly fellow devs, not players) — shift weight to family + hobbyist/teen
  channels (parenting & family-gaming subs/forums, family-friendly app roundups, school-holiday activity
  lists, kid-safe game directories, plus teen/retro-arcade + web-games spaces). Pitch = **depth · works
  offline · no accounts · no ads · family-friendly, fun for all ages** (matches the confirmed direction —
  de-emphasize "kid-safe" as the headline).

- **Reddit groundwork — STARTED (2026-07-05).** Advertising in some existing threads + actively
  commenting on target subs to build presence/karma; own threads planned within a few days. Feeds
  Path-to-launch #3.

- **Competitor study → identity direction CONFIRMED; first changes SHIPPED (2026-07-14).** Studied 3
  sibling AI-built arcades (Skorven, iplay.free, playhive.net); full notes in
  `~/komyo-competitor-teardown.md`. **Direction (confirmed):** all-ages skewing **teen+parents**; keep the
  terminal/retro identity — it's off both AI-slop skins (puzzler "Bricolage+orange+glass" / kids
  "Fredoka+Nunito+candy") — just soften it; lead the pitch on **depth + truly offline + no accounts + no
  ads**, not the commodity "no ads/no sign-ups/kid-safe" quad every sibling recites. **Shipped:** the
  on-page **SEO/pitch copy re-aim** (title/meta/OG/Twitter/JSON-LD/footer, EN + 7 locales) + a chrome
  polish (terminal-console **cyan edge-glow** on nav / sound-menu / side stack). **Dropped:** palette
  warm-up (catalogue's already per-game/per-genre colored) + a tile motion-signature (kept the 5px lift).
  **Still open:** (a) **mascot/logo** — concepts explored 2026-07-14 (`plans/mascot-logo-mock.html` + a
  fur/ear polish pass); still needs the spec-freeze → final art (see the mascot bullet); (b) the **game
  ideas** to triage — colour+logic pack + retro-arcade lane in the coming-soon queue, saved but not yet
  selected; (c) **marketing-channel re-aim** — see the bullet above. *(og-image.png refreshed to the
  18-game catalogue + edge-glow chrome, `?v=6` — DONE 2026-07-14.)*

- ~~**Fable review of recent additions**~~ *(done 2026-07-06)* — komyo-new-game skill, i18n
  implementation and translations reviewed & tested.

- **komyo TikTok account — CREATED (2026-07-11).** The channel for the 9:16 per-game/feature shorts
  from `plans/promo-content-plan.md`. **2 trailer cuts posted (2026-07-13)**; per-game shorts drip is
  the ongoing next step (needs the 9:16 game-trailer template — see Video tooling).

- **Socials expanded to 5 channels (2026-07-20):** Instagram + Facebook pages created (first posts up)
  alongside TikTok/YouTube/Discord; icon links added to the site footer + ☰ drawer. Every future clip
  releases to all 5 per **`plans/clip-release-plan.md`** (Reels on IG/FB, per-platform QR renders +
  UTM scheme, paste-ready metadata kit, Discord auto-mirrors YouTube).

- **Launch trailers — SHIPPED (2026-07-13).** 3 concepts × 2 formats (16:9 + 9:16), built with the
  HyperFrames pipeline: **V1** raw/simple · **V2** cinematic score-card-stage (voted best) · **V3**
  "pain → cure" parody-portal narrative. Music = the game engine's own tracks rendered offline
  (snakebanger / forcefield). Two review rounds folded in (per-version QR UTMs `tr-v1/v2/v3`, concrete
  copy, synthetic catalogue scrolls, snake full-board fix, V3 pain-hook trim + thesis-line hero).
  Renders in `~/komyo-promo/komyo-trailer/renders/`. **Uploaded to YouTube + TikTok; announced on
  Discord.** Beat sheets `TRAILERS.md`, brand spec `frame.md`, editing guide `README.md` (all in the
  komyo-trailer dir). See the **Local promo assets** index in `plans/promo-content-plan.md`.

- **Reddit launch posts — LIVE (2026-07-13).** 4 posts up: r/SideProject (origin story) · r/IndieGaming
  (trailer, GenAI-declared) · r/playmygame (**mod-approved** after a public AI-transparency reply — the
  disclose-first-then-repo-receipts playbook, recorded in `plans/marketing_plan.md`) · r/WebGames
  (Asteroids+ single-game, per P4 rules). Next Reddit: r/ClaudeCode making-of, then r/WebGames drip
  (originals). Held one-shots: r/InternetIsBeautiful, Show HN, Product Hunt.

- **itch.io — Asteroids+ listed (2026-07-13); priority DOWNGRADED to "backlinks tier."** Reusable kit
  built: `scripts/package-game.mjs <slug>` → self-contained portal zip (verified boots standalone) +
  a per-game trailer CONFIG template + image templates (`~/komyo-promo/itch-assets/`). Decision: itch
  is worth it as **SEO backlinks + landing pages, NOT browse traffic** (generic-tag browse is hopeless);
  **lead future listings with ORIGINALS (Forcefield next), not clones.** Deploy automation (butler +
  GH Action) is designed, not built. AlternativeTo submission gated to **≥ 2026-07-20** (7-day account age).

- **Video tooling — HyperFrames — IN PRODUCTION (POC 2026-07-12 → trailers shipped 2026-07-13).**
  Pipeline proven and used for the launch trailers + the Asteroids+ per-game trailer (16:9). Reusable
  templates live in `~/komyo-promo/komyo-trailer/variants/` (trailer versions + a config-block per-game
  template). **Deferred:** a proper **9:16 game-trailer framework/template** — landscape-game vertical
  framing is hard (roaming subject, sparse dark footage); parked for a dedicated template pass. Offline
  music renderer: `~/komyo-promo/komyo-trailer/tools/render-music.mjs` (boots game-kit headless).
  Original eval:
  HeyGen's **HyperFrames** (May 2026, Apache-2.0, free, no per-render fees): agent-native
  "write HTML → render deterministic MP4" — Claude Code writes HTML/CSS/JS with timing attributes,
  a headless-Chrome + FFmpeg renderer encodes it; CLI (`npx hyperframes …`) + bundled Claude skills;
  custom sizes handle 9:16. **Fit:** strong for a code-native solo creator — titles, captions,
  beat-synced cuts, 9:16 crops layered over captured gameplay, scriptable + reproducible. Caveat: it
  composites/overlays, it's not a timeline editor — rough-cut the raw capture first (FFmpeg trims),
  pair with CapCut for quick TikTok-native shorts; DaVinci Resolve stays the free full-NLE fallback
  for the 30–60 s trailer. (Don't confuse with hyperframe.ai — a B2B doc-to-explainer SaaS, not a fit.)

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

- ~~**Storage-usage discipline — write it into every dev surface**~~ *(done 2026-07-11)* — the rules
  (the ~5 MB quota is per ORIGIN and shared; cap every list, event-driven debounced writes, ~≤10 KB
  per arcade game / ~≤100 KB per progress game, versioned saves) now live in **CLAUDE.md** (game
  conventions), **`game-design-knobs.md`** (cross-cutting), and the **komyo-new-game skill**
  (contract checklist + `gamekit-api.md` § Storage discipline). The save-API guards (Path to
  launch #5) will enforce the same rules in code + tests.

- ~~**Side-stack v2: Profile in games**~~ *(shipped 2026-07-11)* — the profile modal + side stack are
  kit-owned; every game now carries Profile + Challenges + Collection identically to the catalogue.

- ~~**Move the Collection button to the home page**~~ *(shipped 2026-07-05)* — the 🎨 Collection is a
  top-level button in the right-edge quick menu (with Profile + Challenges); the Challenges-drawer pill was
  removed (its collection bar still opens the store).

- **`gamekit.menu` framework (v3)** *(decided — launch prio #1, see Path to launch)* — promote the
  asteroids-style mode tiles + option-group rows into a reusable `gamekit.menu`: declarative config →
  one consistent menu system across all games, less per-game markup, easy to rebuild. Migrate every
  live game onto it.

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

- **"My profile" — v1 SHIPPED (2026-07-01).** Catalogue ☰ → 👤 My profile: summary (games / modes / plays /
  days), favorites (favorite game by plays, most-played mode, favorite genre, top score, good runs,
  playing-since), per-game PB tables (best + plays, only games with a PB), and a shareable stats-card
  image. Backed by the kit's **single source of truth for bests** — all 9 games read/write via
  `gamekit.best`/`gamekit.saveBest` (`gamekit_pb`, keyed by a human mode label) + `gamekit_stats` for
  lifetime rollups. No per-game best-keys, so menu & profile can't diverge; reset prunes the store; portable
  via Export/import. **Wrapped-style expansion (next):** challenges completed, this-week /
  this-month / all-time toggles, "new games tried", milestone badges (played-every-game, first-10k),
  night-owl/early-bird from play-hour, and a **"Your year in komyo"** multi-slide seasonal
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

- **"Play a random game" button + challenge — SHIPPED (2026-07-01).** 🎲 Random button in the toolbar
  picks a playable game, **prefers unplayed** (a `gamekit_pb` entry = played), falls back to all when
  everything's been tried. Plus a `scope:'random'` daily & weekly challenge ("play today's/this-week's
  pick") resolved from the deterministic, same-for-everyone `CHALLENGES.randomSlug(idx, playable)` — based
  on **all** games (never unplayed), lights the CHALLENGE tile badge on the pick, and stores the resolved
  game title in history. Only the *button* filters to unplayed.

- **UI overlap audit — DONE (2026-07-26).** Closed by the kit **layout contract** (2026-07-23/24):
  `layout.archetype()`/`playRect()`/`boardRect()`, every game migrated (incl. asteroids/+), and
  `runLayoutSuite` asserting `board ⊆ playRect()` across all 5 viewports in CI — plus the real-browser
  menu-fit suite. The cross-resolution *fairness* half shipped alongside it; see
  `plans/fairness-overlap-plan.md` (done) and `plans/kit-layout-contract-plan.md`.
  Original entry: ~~added 2026-07-05, deferred as "works today; the fixes risk breaking more than they fix".~~

- **9:16 game-trailer template — DONE (2026-07-26).** The deferred vertical-framing pass of the
  HyperFrames pipeline shipped as the `komyo-game-trailer` skill (V2 social trailer + text-free card
  preview loop + still fallback, per-game card fit pass), with V2 variants cut for 2048, Balloon Pop,
  Critter Match and Range.

### Path to launch — the steps that completed (full text, 2026-07-26)

Their numbering is still live in `ROADMAP.md` (referenced from `plans/*`); only the detail moved here.

- **#1** · **Translations / i18n — DONE (2026-07-05).** All 8 languages live (en/pl/es/pt/fr/it/cs/uk), full
  coverage incl. the changelog, enforced by tests. Left over (non-gating): a native QA pass + mobile QA
  across languages × orientations. See `plans/i18n-plan.md`.

- **#3** · **Single service worker for the whole site — DONE (2026-07-06).** The pre-launch gate landed:
  ONE root-scope SW caches everything (catalogue + shared files + all locales + every live game —
  `GAME_SLUGS` in `sw.js`, lockstep with games.js test-enforced); the 11 per-game `sw.js` are gone,
  games register `pwa('../../sw.js')`, `gamekit.pwa()` sweeps legacy per-game scope registrations
  on boot, the root SW's activate purges the old `komyo-<slug>-*` caches, `updates.apply()` is a
  single worker swap, the catalogue's idle-register loop is deleted, deploy stamps only `sw.js`.
  Per-game manifests kept — installs keep working (root SW satisfies installability). Left to
  verify post-deploy: a previously-installed game PWA migrates cleanly (open → old worker
  unregisters → next launch runs on the root worker).

- **#4** · **Score card as the DEFAULT share payload — DONE (2026-07-06).** The endgame share is now
  score-card-first: `gamekit.shareRow` renders the card **inline** + ONE **Share** button that opens
  the image menu (native share attaches the card image **+** the link/text together · Copy image ·
  Download). Dropped the X/Reddit/copy-link buttons — a link web-intent can't carry the card, and
  mobile's native sheet already lists every app. The **site** share (footer + drawer) collapsed to a
  single adaptive button (native sheet on mobile, copy-link on desktop) — a bare link doesn't need a
  social-icon row. Profile share unchanged (already image-first). Rationale in the
  `plans/share-reorg-mocks.html` mock (option D).

- **#5** · **Kit-owned progress-save API — ✅ CORE BUILT (2026-07-24)** *(added 2026-07-11)*. Shipped
  incrementally by extracting sudoku's board-history into a reusable primitive:
  **`gamekit.progress(slug, {key,max,version})`** → `save/load/list/current/has/remove/clear` over one
  slug-prefixed localStorage key (bare array of `{v,id,ts,...payload}`, newest-first, capped; 1 = resume
  slot, N = history). Versioned envelope, per-key cap, `QuotaExceededError` handled in ONE place,
  event-driven writes (never per-frame). **Four consumers:** sudoku (history, cap 20 — reference),
  2048 · bubbles · minesweeper (single-slot resume; minesweeper resumed runs post best score but not best
  time). See `plans/progress-save-api-plan.md`. **Remaining for the idle/saved-state lane (Foxden):** the
  *persistent-game lifecycle* on top of this primitive — timestamp-based offline accrual + no-wipe-on-loss
  (a game genre, not an API knob). Backend stays localStorage (sync); the boundary keeps a later IndexedDB
  swap invisible. Saves ride the existing per-game reset + Export/Import via the slug prefix.

## Dropped (not doing)

- **Privacy policy — counsel review as a tracked item** — dropped 2026-07-28: v1 is published and
  consent-gated, and it stands as-is. A lawyer read happens if one becomes available; it is not
  launch-blocking, has no owner and no date, so tracking it only kept a permanently-blocked line on the
  roadmap. Fold any edits in if a review ever returns — don't re-file it as work.
- **Branded 404 page** — dropped 2026-07-28: a themed root `404.html` is pure polish on a path almost
  nobody hits (the catalogue is one page deep and every game URL is linked), and Pages can't customise
  any other status code anyway.
- **CI check: the `updated` badge stays honest** — dropped 2026-07-28: the honest-badge rule is a
  convention in CLAUDE.md, and a diff-based check can't tell a notable update from a typo fix — so it
  would either nag on every bugfix or be silenced with an exempt list. Keep bumping `updated:` by hand
  when a game gains a mode or feature.
- **Pre-launch QA as a formal gate** — organic test-and-report via friends/family instead (the tester pool
  isn't big enough to staff a checklist; see Decision guards).
- **Wrapped-style profile expansion** — the profile v1 is enough for launch.

## Parked (someday)

- **Attract mode behind start menus** — a self-playing demo of the actual game as the menu backdrop
  (arcade classic; guarantees the menu look matches gameplay by construction). Per-game work: a demo
  driver + running update/render in a menu-safe mode. Park until a game wants it.

- **IndexedDB backend for big saves** *(idea — noted 2026-07-11)* — the ready escape hatch if the
  ~5 MB shared-origin localStorage quota ever pinches (single saves in the hundreds of KB–MBs: big
  procedural worlds, replays, binary data). IndexedDB is async (no main-thread jank), stores
  structured/binary data without stringify, and quota is GB-scale (Chrome up to ~60% of disk,
  Firefox 10%, Safari ~1 GB+). The move: swap the progress-save API's backend (Path to launch #5)
  to IDB while localStorage keeps the small hot data (settings, bests, trophies — sync reads at
  boot). Contained refactor, NOT a rewrite — but only pays once the save API exists and a concrete
  game actually needs >~200 KB saves. Don't build speculatively.
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

- **"Prompt-your-own-game" generator (paid, SEPARATE product)** *(idea — noted 2026-07-16)* — a
  chat on the site where a user describes a game and our game-creation skill builds it live. Model:
  a **generation *session* with a compute budget capped ~10–30% below what the user paid** (that
  gap is the margin, net of Stripe/moderation/hosting — not a big earner, "just something"); want
  to keep iterating/perfecting → pay for more session. Reliability is fine (games boot ~80–90%);
  the failure mode is "not fun," which is the user's creative risk — they pay regardless (needs a
  live cost meter + in-session playtest so spend feels earned; a "never-booted → credits back"
  valve). Generated games live in a **separate, walled-off "unreviewed" catalogue/product — never
  on the kid-safe main surface**; **prompt + output moderation is mandatory** before any public
  exposure. Community favorites get **promoted to the curated main catalogue only after review**.
  Prereq: perfect the game-creation skill first and measure the *safe-and-boots* rate before
  building any of this.
