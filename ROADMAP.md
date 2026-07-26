# komyo Roadmap

**Open work only.** Everything shipped, dropped or parked — plus the **decision guards**
("don't re-propose") — lives in **[`ROADMAP-archive.md`](ROADMAP-archive.md)**. Check the guards
before proposing anything new.

Mostly **unordered**; the one ordered track is **Path to launch** below (its numbering is referenced
from `plans/*` — don't renumber). Per-game feel/balance polish is continuous and not tracked here.
Player-facing shipped history also lives in the in-page changelog / git. Design docs live in `~/`
(not in the repo): mobile-rotation, gamedev-skills, challenges, tv-controller.

**Item shape** — one bullet per item, titled so the file skims by title alone:

```text
- **Title — status (date)** *(optional tag)* — one-line gist.
  Indented detail, rationale, links.
```

Statuses: *idea* · *planned* · *in progress* · *blocked*. When an item ships, move the whole thing to
the archive and leave a one-line open bullet behind for any leftover.

## 🚀 Path to launch (ordered)

Reprioritised **2026-07-04**. Foundations are done (kit menu, audio, profile/best-store, challenges,
cosmetics/trophies, GA4, PWA, share, Discord auto-post). The real levers now are **reach** (more languages)
and **game count**. **Not gating launch:** the **real mascot** is dropped to Later — the placeholder chibi
art ships fine and gets swapped whenever real art lands; the **privacy policy** is in review and treated as
**non-blocking** (no longer a hard gate).

*Recently done:* the **cosmetics shop / titles** system · the **"create a game" skill** (gate cleared, used
to build Forcefield) · **friends/family circle** invited & trickling · the **i18n system + PL + ES live** ·
the **visual texture-pass initiative** (frog-bonk / Keep Defender / Meadow Flyer / Bubble Pop + the skill
quality bar — see the archive).

### Ordered path

1. **Translations / i18n — DONE (2026-07-05).** All 8 languages live (en/pl/es/pt/fr/it/cs/uk),
   coverage test-enforced. *Left over (non-gating): a native QA pass + mobile QA across languages ×
   orientations.* Detail: archive · `plans/i18n-plan.md`.
2. **Build more games — *in progress*.** Toward the content bar; each via the dev-process gate (design+mock →
   POC → MVP → iterate). **Forcefield shipped** (first pull from the POC branch). **Frog Bonk shipped**
   (2026-07-06). **Sudoku shipped** (2026-07-10). **Six-game batch shipped** (2026-07-12) — **18 live
   games**. **Bias low-tuning genres**
   (puzzle / timing / arcade-skill), **avoid balance-heavy** (tower defense, roguelite shooters). See
   `komyo-avoid-balance-heavy-genres`. For acquisition, don't bet on one designed-to-be-viral game —
   **maximize cheap shots on goal**: a weird-mechanic POC lane + reworks of live games as tickets +
   the "komyo daily" ritual. See `plans/viral-shots-plan.md` (strategy decided 2026-07-12; grew out of
   the 2026-07-02 review's §5 flagship-vs-breadth verdict, `~/komyo-review-2026-07.md`). More POC
   prototypes wait on a separate branch. Build order below.
3. **Single service worker for the whole site — DONE (2026-07-06).** ONE root-scope SW caches the
   catalogue + shared files + all locales + every live game. *Left to verify post-deploy: a
   previously-installed game PWA migrates cleanly (old worker unregisters → next launch runs on the
   root worker).* Detail: archive.
4. **Score card as the DEFAULT share payload — DONE (2026-07-06).** Endgame share is card-first
   (inline card + ONE Share button); the site share collapsed to a single adaptive button. Detail:
   archive · `plans/share-reorg-mocks.html`.
5. **Kit-owned progress-save API — ✅ CORE BUILT (2026-07-24)** *(added 2026-07-11)* —
   `gamekit.progress(slug, {key,max,version})` shipped with four consumers (sudoku history cap 20 ·
   2048 · bubbles · minesweeper single-slot resume). Detail: archive · `plans/progress-save-api-plan.md`.
   **Remaining for the idle/saved-state lane (Foxden):** the *persistent-game lifecycle* on top of this
   primitive — timestamp-based offline accrual + no-wipe-on-loss (a game genre, not an API knob).
   Backend stays localStorage (sync); the boundary keeps a later IndexedDB swap invisible. Saves ride
   the existing per-game reset + Export/Import via the slug prefix.
6. **LAUNCH + marketing campaigns — *started* (reddit groundwork underway, see In flight).** Prep the materials (promo video / montage + Discord preview cuts,
   per-game OG/Twitter cards, story-format share card), then publish everywhere: portals (itch.io, free-to-play
   indexes), news, forums, subreddits, Discord servers, socials. Paid ads considered later.

### Ongoing (post-launch)

Rolling, no fixed order: **ship new games** · **fix bugs** · **manage & grow the community** · **keep
marketing** (experiments — QR stickers, merch, plushie) · and, in free time, **consider new features /
integrations** (see below). Plus **target tuning** (retune daily/weekly challenge targets from real GA4
completion data; confirm the UTC daily reset) and **TV + gamepad + a11y**.

### Later (non-gating)

- **3D / three.js — evaluated (initial tl;dr 2026-07-11): stay no-deps for now; deeper eval only if a
  3D-camera game lane is ever wanted.** Facts (r185, MIT): zero-build IS officially supported
  (importmap + self-hosted files, no bundler) but costs **~188 KB gz** un-tree-shaken — vendorable
  in-repo, so "no external deps" would technically survive; **WebGL2 is the hard minimum** (WebGL1
  dropped r163; WebGL2 ~97 % support incl. iOS 15+). The dealbreaker today: **the renderer can't run
  in our headless harness** — headless-gl is WebGL1-only/stale, so `__test.step(n)` + the mocked-canvas
  test contract (our regression net) doesn't carry over; only scene-graph/math is Node-testable.
  And none of our genres need a true 3D camera — outrun-style pseudo-3D, isometric, sprite-scaling and
  starfields are canvas-2D tricks we can already do. If a single game ever truly needs 3D: consider
  **OGL** (~8 KB gz, three-like API, Unlicense) or raw WebGL2 for that ONE game, model-is-truth state
  fully testable headless with render untested — a deliberate exception, not a kit direction.
- **Procedural music v3 — scale to many distinct songs** *(idea — noted 2026-07-07)* — the kit's generative
  music tops out at ~7–8 truly-distinct "flavors" today (limited by style×kit vocabulary, not
  progressions). Phased path to *hundreds* of distinct per-game/biome/daily-seed tracks (seed→song +
  linter-as-selector → synthesis families → rhythm grammar → motif+modes → arrangement) in
  **`plans/audio-music-plan.md`**. Follows Audio v2 (shipped 2026-07-07, see archive). Stays zero-asset;
  `.ogg` files deferred.

- **Replay system — clips + deterministic replays** *(idea — noted 2026-07-21)* — two-part:
  (B) kit-owned **video clip capture** (`canvas.captureStream` + `MediaRecorder`, rolling last-15 s
  buffer, audio tapped from the kit's WebAudio graph — zero game changes, ships alone) and
  (A) **deterministic input-replay** (per-run seeded RNG + inputs routed through a kit recorder,
  re-simulated through the same fixed-step `update()` — the `__test.step(n)` contract already
  guarantees the hard part). Replays live in **IndexedDB** (`gamekit.replays`, capped, best-effort)
  + file export/import (which doubles as sharing); the ~10 KB localStorage budget doesn't apply.
  A feeds B: "render any past run as a clip". Roll-out: clips first → kit replay contract →
  asteroids-plus pilot (synergy with daily-seeded runs) → per-game adoption + the new-game skill.
  Plan: **`plans/replay-plan.md`**.

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

## Coming-soon games (queue)

Ship **lots** of games, each **polished with real depth** — added slowly, in small batches. Every new
game follows the dev-process gate in CLAUDE.md (design+mock → POC → MVP → 2–3 iterations) and the
design knobs (`@game-design-knobs.md`).

**All of the games below are already live as greyed "coming soon" placeholder tiles in `games.js`** —
titles, icons and genre tags here match the catalogue. This table is the build queue: effort + notes
per game. Roughly easiest → hardest within each group.

**▶ Next build order (2026-07-12):** **Dusk Runner → Pump Stop solo → Mash Dash → Maze Pals /
Color Pop** (pick by mood, all trivial–low). *(The 2026-07-12 six-game batch — Minesweeper · 2048 ·
Trap the Cat · Glow Says · Balloon Pop · Critter Match — is fully shipped: playtested, translated,
changelog'd, deployed. Sudoku ✅ 2026-07-10.)*
Rationale: all low-tuning + high-recognition = fast to build, zero teaching cost, and organically
searchable ("minesweeper", "2048", "dino game"); the kids batch widens the no-ads/kid-safe lane.
That batch was all remakes — for the acquisition side, the old "one original-mechanic flagship" slot
was replaced (2026-07-12) by the **many-cheap-shots strategy** in `plans/viral-shots-plan.md`:
weird-mechanic POC batches (kill most, promote the sticky ones), notable reworks of live games as
extra tickets, and "komyo daily" as the cheapest candidate. Run it alongside the queue builds
(don't block the trivial ones on it).

### Single player

| Game | Effort | Build notes |
| --- | --- | --- |
| **Dusk Runner** 🦖 `ARCADE`+`REFLEX` | low | Chrome offline-dino style — mono line-art, ground runner, jump/duck, obstacle spawner, speed ramp, day→night palette shift |
| **Pump Stop** ⛽ `SKILL` (+`STRATEGY` manager) | trivial–low (solo) · med (manager) | Solo: hold to pump, **stop at the target** with momentum/overrun, scored by closeness. **Tolerance is tight (~1%):** $20 off by 20¢ = fine, by 50¢ = too far under. **Manager expansion (idea, discuss later):** run **4 pumps** — cars arrive with a paid limit, stop each near its limit. Over = free-gas penalty (costs the station); tiny-under = fine; a car left under-served/unattended → patience runs out → it **blocks the pump**; **all 4 blocked = game over**. Attention is the scarce resource → triage is the game. **Open decisions:** (a) cars **auto-fill and you only tap _stop_** vs you actively **_pump_** each; (b) **one active pump at a time** vs **all at once**; (c) tolerance band (~1%? scales with difficulty?). Tension: a tight ~1% band is hard to hit while juggling 4 pumps — (a)/(b) set how forgiving it must be. |
| **Keyfall** ⌨️ `TYPING`+`SKILL` | low–med | falling words — type each before it lands; speed ramp, combos, WPM. Opens a wider WORD/TYPING lane (more later: anagram, spelling, Wordle-style guesser) |
| **Word Hunt** 🔍 `WORD`+`PUZZLE` | low–med | letter-grid word search — drag to circle, timer, themed packs; word-placement generator |
| **Sky Sling** 🎈 `SKILL`+`ARCADE` | med | bottom slingshot — drag back to aim & set power, release to fire at floating balloons; projectile physics (gravity + shifting wind), ricochets, multi-pop combos, ammo limits. Physics-aim — distinct from the kids tap-only Balloon Pop |
| **Blink** 👁️ `LOGIC`+`PUZZLE` | med | observation/memory — items cross the screen ~10–30s, then Q&A ("how many ducks?") incl. **trick questions** about things never shown (background color, an item that wasn't there) |
| **Pocket Rally** 🏎️ `RACING`+`ARCADE` | med | top-down multi-lane straight — weave the traffic, don't clip a bumper, distance + speed score |
| **Market Parking** 🅿️ `SKILL`+`RACING` | med | packed lot, too few spots — race rivals to an empty space and park before them; P1–4 (bots fill the solo game) |
| **Floodgate** 🚰 `LOGIC`+`PUZZLE` | med | pipe-routing — rotate tiles to connect source→drain before the flood; **solvable-by-construction**, leak-plug variant, grid + timer scaling |
| **Invaders** 👾 `SHOOTER`+`ARCADE` | med | formation movement, descending rows, shields, escalating waves |
| **Road Hop** 🐸 `ARCADE`+`CASUAL` | med | lane spawns, log-riding, endless scroll |
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
  day" pairs with challenges). All solvable-by-construction per the design knobs.
- **Colour + logic pack** *(idea — added 2026-07-14, unconfirmed; from the competitor study)* — a
  coherent colour lane rather than scattered clones: **Flow Connect** (Flow Free / Numberlink — connect
  coloured dot pairs, fill every cell, no crossings; best touch UX → build first), **Color Flood**
  (flood-fill from a corner in ≤N moves, seeded Daily + VS-bot), **Water Sort** (pour liquids until each
  tube is one colour), **Loop Maze** (one-loop Slitherlink/"Zip" deduction; hand-authored level packs).
  All solvable-by-construction. See `~/komyo-competitor-teardown.md`.
- **More retro-arcade lane** *(idea — added 2026-07-14, unconfirmed; from the competitor study)* —
  classic-arcade slots we don't cover yet: **Pong** (VS-bot + local 2P; tiny, on-identity), **Missile
  Command** (mouse-aim city defense, vector-native), **Lunar Lander** (physics landing, reuses the
  Asteroids space theme), a **block-faller** (Tetris-style — needs a non-trademark name; fills a real
  gap), a **maze-muncher** (Pac-Man dot-chase — biggest build, "someday flagship"). Centipede/Galaga-style
  formation shooter overlaps Invaders (lower prio). See `~/komyo-competitor-teardown.md`.
- ~~**Frog Rush** 🐸~~ — **shipped 2026-07-06 as Frog Bonk** (see archive).

### Kids-first (ages 6–10)

Built *for* young kids: one-tap / big-target controls, no reading required, gentle/no fail-state,
celebratory feedback. The **`KIDS` lane is live** (Balloon Pop 🎈 · Glow Says 🏮 · Critter Match 🐾
shipped 2026-07-12; the genre filter is wired) — still want to fold the gentle existing games into
it (Stack, Bubble Pop, a slow Snake, gentle Meadow). The no-ads / no-payments / no-chat / offline
story is the parent pitch.

| Game | Effort | Build notes |
| --- | --- | --- |
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
from day one. **Gate: the kit-owned progress-save API (Path to launch #5) ships before the first
game in this lane**; pair with the Safari/iOS data-loss warning (Catalogue / kit).

## Product & growth

### In flight / near-term

**Current focus (2026-07-22):** in flight = **marketing clip drips + trailers** (the per-game 9:16
shorts drip across all 5 socials); next dev work = **more games** (build queue below) + the
**kit-owned persistence / progress-save API** (Path to launch #5 — gates the saved-state lane).
Recently shipped: Parental lock, Discover rails, and the teen+parents identity/channel re-aim.

- **🎲 Tinder-deck game picker** *(idea — later/if-ever)* — swipe-a-deck picker behind the existing
  🎲 Random button, never a new button or menu item. Left over from the Discover rails work (shipped
  2026-07-22, see archive). Plan: `plans/discover-plan.md`.

- **Parental lock — second strength option** *(planned)* — 📖 word-check gate (Disney+-style
  spelled-out digits: a reading test, no secret) + external-link gating. Left over from the PIN lock
  (shipped 2026-07-22, see archive). Plan: `plans/parental-lock-plan.md`.

- **Triage the saved game ideas** *(open — from the competitor study, 2026-07-14)* — the colour+logic
  pack and the retro-arcade lane sit in the coming-soon queue, saved but not yet selected. Notes:
  `~/komyo-competitor-teardown.md`.

- **Marketing plan (brainstorm + prep) — drafted (2026-07-05),** `plans/marketing_plan.md`.
  **Next: review & refine into a tl;dr.** No long prose/explanation — per plan, just the list of
  **where to post** and **what to post**, plus called-out **red flags / crucial points only** (budget
  risk, ToS/spam risk, anything that could backfire). (Feeds Path-to-launch #5 + the Marketing
  sections below.)

- **Reddit drip — next posts** *(in progress)* — next up: r/ClaudeCode making-of, then a r/WebGames
  drip (originals only). Held one-shots: r/InternetIsBeautiful, Show HN, Product Hunt. The 4 launch
  posts went live 2026-07-13 (see archive); the disclose-first AI-transparency playbook is recorded in
  `plans/marketing_plan.md`.

- **itch.io — lead future listings with ORIGINALS** *(in progress — "backlinks tier" priority)* —
  Forcefield next. `scripts/package-game.mjs <slug>` builds the self-contained portal zip; per-game
  trailer + image templates in `~/komyo-promo/itch-assets/`. Deploy automation (butler + GH Action) is
  designed, not built. AlternativeTo submission is unblocked (the 7-day account age passed). Asteroids+
  listed 2026-07-13 (see archive).

- **Promo content plan — planned (2026-07-09),** `plans/promo-content-plan.md`. The *assets* to post
  (sibling to marketing_plan.md = *where* to post): a reusable **promo graphic** + a **30–60s trailer**
  + **9:16 per-game/feature shorts**, all derived from the **score card as the brand visual language**
  (printed real score cards double as marketing). Capture is **manual, once** (fun game states are a
  human call — no capture scripting); I build the mocks/templates/copy, we assemble together. Also
  covers the flyer/sticker print track + QR-at-print-size caveats. Open decisions: site-level accent +
  flyer dimensions. Sequenced **graphic first** (unblocks Reddit + flyers).
- **Review local Claude Code memories about komyo** (added 2026-07-02) — audit the Claude memory
  notes for stale komyo entries: plans that shipped, superseded decisions, rebrand leftovers;
  prune/merge so future sessions don't act on outdated context.
- **Real mascot art** *(NOT near-term — the current mascot is the keeper)* — after the 2026-07-14 fixes
  (fur/ear polish, concepts mock), the chibi fox-girl we have **stays as-is for the foreseeable future**;
  a from-scratch refresh is pushed **far out**, not on the near roadmap. It's good enough and re-doing it
  carries the re-upload tax below. Keep the notes here for whenever a refresh is actually revisited —
  chibi fox-girl (Holo-ish, red/orange hair, fox ears); reused on social, stickers, 404, newsletter,
  empty states.
  **Approach idea (2026-07-14, unconfirmed — from the competitor study):** artists are expensive/slow, so
  consider a **gen-AI bridge — but one-and-done, not many iterations**, because the real cost is the
  re-upload tax (logo lives on socials, Discord, itch, BuyMeACoffee, …). Do it **spec-first** (converge on
  a written character spec cheaply, then generate once and freeze). **Split the freeze-once avatar/logo
  (goes everywhere) from the on-site mascot illustration (iterate freely — we redeploy for free).** User
  steer: the **logo should be derived from the mascot** (a simplified mark of the same character) so it
  stays recognizable long-term — not a separate abstract emblem. Details in `~/komyo-competitor-teardown.md`.

- **GA4 read-back — retune from real data** *(open — v1 shipped 2026-07-01, see archive)* — if most
  players disable music, flip it to opt-in / lower the default; retune challenge targets from
  `challenge_done` ÷ `challenge_shown`. Caveat: consented users only — read as a trend, not a census.

- **Privacy policy — legal review** *(in progress)*. The plain-language AI draft is published at
  `komyo.online/privacy.html` (treat as v1 — accurate, not lawyer-hardened) and links from the cookie
  banner + About. **Waiting on the lawyer's response** (handoff briefs:
  `~/komyo-prawnik-brief-pl.md` PL + `~/komyo-privacy-lawyer-brief.md` EN). Open: PL-authoritative
  version + LLM convenience translations, the children/analytics question, and the Discord auto-post
  clause. Revisit `privacy.html` once counsel replies.

### Catalogue / kit

- **Safari/iOS data-loss warning: install the PWA or keep backups** *(planned 2026-07-11)* — Safari's
  ITP evicts ALL script-writable storage (every localStorage save: bests, trophies, cosmetics, game
  progress) after **7 days of Safari use without visiting the site**; installed home-screen PWAs are
  exempt. Plan: detect Safari/iOS (weight it up once a player has meaningful progress / any
  progress-based game state), show a clear, non-nagging notice — "install the app or export a backup,
  or your progress can be lost after inactivity" — linking straight to the Install flow + Data
  Export. Also request **`navigator.storage.persist()`** (Safari 15.2+, Chrome grants heuristically)
  as the silent first line of defense on every engaged device. Matters ×10 once the saved-state lane
  (Foxden) ships — sequence it with that lane at the latest.

- **Backdrop-truth pass (opportunistic)** *(added 2026-07-11)* — three start-menu backdrops still
  IMITATE in-game objects with menu-local code and will drift: **asteroids-plus** (`mbRock` + fake
  enemies), **snake** (menu-local snake/grid), **breakout** (imitation brick wall). When next touching
  each game visually, fold its backdrop onto the real painters (forcefield's retarget pattern).
  Don't sweep them for their own sake. See the new backdrop knob in `game-design-knobs.md`.

- **Tips & tricks widget** *(idea, added 2026-07-04)* — there are no loading screens, so surface
  rotating tips somewhere on the home page (e.g. bottom-right corner), cycling continuously; dismissable
  and re-openable via a small bubble button. Content: how-to-play nuggets, feature callouts (challenges,
  Collection, offline install, languages), keyboard shortcuts. Keep it unobtrusive + reduced-motion-safe.

- **Welcome speech bubble from the mascot** *(idea, added 2026-07-04)* — the header mascot says "welcome"
  in a random rotation across all supported languages (a little i18n flex). Subtle, not distracting — a
  brief bubble on load / occasional, reduced-motion-safe. (Pairs with the real-mascot work.)

- **Audit the whole site for duplicated reused UI elements → shared kit components** *(refactor)* —
  the same widget is hand-written in multiple places with its own markup+CSS, so they drift and we keep
  hand-syncing them (the trophies + Collection **pills** already bit us twice: challenges drawer vs
  profile vs the in-game 🏆 panel; also candidates: the **collection/progress bar**, the good-run bonus
  line, the points pill, buttons). Fix pattern: extract one kit factory (e.g. `gamekit.cosmeticPills(opts)`)
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

- **Sitemap coverage — add the static pages** *(SEO fix)* — `sitemap.xml` currently lists only the
  catalogue + each live game, not `tos.html` / `privacy.html` (nor any future standalone pages). Decide
  whether these belong in the sitemap (they're indexable, low-churn, low-priority) — likely **yes, add
  them** with a low `<priority>` so search engines can discover them; also cross-check `llms.txt` and
  `robots.txt` list what we intend. One-time audit + a note in CLAUDE.md's "when a page goes live" step
  so new standalone pages get added going forward.

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
    the archive's Decision guards). *Parked — a relay* in front of the webhook (the client-embedded webhook is an
    open spam target; a relay would hide+rate-limit it, but it's a Cloudflare-Worker route we're
    avoiding for now — see Parked in the archive).
- **Shared scores feed = Discord** (the score auto-post is the games-log). A live **on-site** feed needs
  an off-GitHub backend (Pages is static — can't host an endpoint, so no GH load risk): **(a)** scheduled
  Action scrapes Discord → static `scores.json` (stopgap, near-live, one-way, GitHub-native — preferred),
  or **(b)** Cloudflare Worker + KV (`POST /score` → capped list, `GET /recent`; truly live — *parked,
  see Parked in the archive*). Filter to **good scores / records only**; public `POST` has the same abuse surface as
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
  clunky; a tiny relay is the usual answer — collides with the no-backend stance, see Parked in the archive);
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
