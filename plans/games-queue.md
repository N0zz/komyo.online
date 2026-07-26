# Games queue (build pool)

The pool of games we might build, with effort + build notes. **The roadmap does not name games** — it
carries one line ("more games, continuous"); this file is where the candidates live.

Rules that apply to every entry:

- Every new game goes through the dev-process gate in `CLAUDE.md` (design+mock → POC → MVP → 2–3
  iterations) and the knobs in `game-design-knobs.md`.
- **Bias low-tuning genres** (puzzle / timing / arcade-skill); **avoid balance-heavy** ones (tower
  defense, roguelite shooters) — see the `komyo-avoid-balance-heavy-genres` guard.
- Ship in **small batches**, each polished with real depth. Never a game straight from one prompt.
- Most entries below already exist as greyed **"coming soon" tiles** in `games.js` (titles, icons and
  genre tags match the catalogue). Entries under "not yet tiles" get a tile once picked + named.
- **Triage first.** The pool is bigger than this file and bigger than we can build — pick the next
  batch deliberately (a triage pass) before starting any build. Untriaged sources: the competitor
  study (`~/komyo-competitor-teardown.md`) and the weird-mechanic POC lane
  (`plans/viral-shots-plan.md`).

Acquisition context: we do **not** bet on one designed-to-be-viral flagship. The strategy is many
cheap shots on goal — weird-mechanic POC batches (kill most, promote the sticky ones), notable
reworks of live games as extra tickets, and the "komyo daily" ritual. See
`plans/viral-shots-plan.md` (decided 2026-07-12). Run it alongside the trivial queue builds; don't
block them on it.

## Single player

| Game | Effort | Build notes |
| --- | --- | --- |
| **Dusk Runner** 🦖 `ARCADE`+`REFLEX` | low | Chrome offline-dino style — mono line-art, ground runner, jump/duck, obstacle spawner, speed ramp, day→night palette shift |
| **Pump Stop** ⛽ `SKILL` (+`STRATEGY` manager) | trivial–low (solo) · med (manager) | Solo: hold to pump, **stop at the target** with momentum/overrun, scored by closeness. **Tolerance is tight (~1%):** $20 off by 20¢ = fine, by 50¢ = too far under. **Manager expansion (idea, discuss later):** run **4 pumps** — cars arrive with a paid limit, stop each near its limit. Over = free-gas penalty (costs the station); tiny-under = fine; a car left under-served/unattended → patience runs out → it **blocks the pump**; **all 4 blocked = game over**. Attention is the scarce resource → triage is the game. **Open decisions:** (a) cars **auto-fill and you only tap *stop*** vs you actively ***pump*** each; (b) **one active pump at a time** vs **all at once**; (c) tolerance band (~1%? scales with difficulty?). Tension: a tight ~1% band is hard to hit while juggling 4 pumps — (a)/(b) set how forgiving it must be. |
| **Keyfall** ⌨️ `TYPING`+`SKILL` | low–med | falling words — type each before it lands; speed ramp, combos, WPM. Opens a wider WORD/TYPING lane (more later: anagram, spelling, Wordle-style guesser) |
| **Word Hunt** 🔍 `WORD`+`PUZZLE` | low–med | letter-grid word search — drag to circle, timer, themed packs; word-placement generator |
| **Sky Sling** 🎈 `SKILL`+`ARCADE` | med | bottom slingshot — drag back to aim & set power, release to fire at floating balloons; projectile physics (gravity + shifting wind), ricochets, multi-pop combos, ammo limits. Physics-aim — distinct from the kids tap-only Balloon Pop |
| **Blink** 👁️ `LOGIC`+`PUZZLE` | med | observation/memory — items cross the screen ~10–30s, then Q&A ("how many ducks?") incl. **trick questions** about things never shown (background color, an item that wasn't there) |
| **Pocket Rally** 🏎️ `RACING`+`ARCADE` | med | top-down multi-lane straight — weave the traffic, don't clip a bumper, distance + speed score |
| **Market Parking** 🅿️ `SKILL`+`RACING` | med | packed lot, too few spots — race rivals to an empty space and park before them; P1–4 (bots fill the solo game) |
| **Floodgate** 🚰 `LOGIC`+`PUZZLE` | med | pipe-routing — rotate tiles to connect source→drain before the flood; **solvable-by-construction**, leak-plug variant, grid + timer scaling |
| **Invaders** 👾 `SHOOTER`+`ARCADE` | med | formation movement, descending rows, shields, escalating waves |
| **Road Hop** 🐸 `ARCADE`+`CASUAL` | med | lane spawns, log-riding, endless scroll. **Direction (2026-07-26):** don't cross *between* the cars — hop **across car roofs**, with road signs as the obstacles you must duck/avoid. Cars move, so the landing target moves; the frogger-style crossing stays the fallback reading |
| **Arcane** 🔮 `ACTION`+`SHOOTER` | med–high | spell variety + wave AI (scope-dependent) |
| **Icy Tower** 🧗 `PLATFORMER`+`ARCADE` | high | momentum + variable jump + wall-bounce + combos + rising floor |
| **Pulse Dash** 🔺 `RHYTHM`+`REFLEX` | high | obstacles authored to a beat + generate/sync a track |

## New modes for live games (not new tiles)

Both already ship as locked "SOON" cards in their menus.

- **Neon Snake — Enhanced mode** — buffed-up snake with random pickups dropping on the board, each
  granting a timed/instant effect: walls off for X seconds (wrap through edges), 2× speed burst,
  snake length −50%, score multiplier window, maybe a ghost-mode (pass through yourself). Tune drop
  rarity so runs stay skill-first.
- **Range — Reaction mode** — a reaction-speed test: one target at a time pops up after a random
  1–5 s delay; measure the click time per target over a Sprint-style count (10/50/100), score =
  **average (show median too)** reaction ms, not total time. Guard the obvious cheats: a click
  before the target shows = false start (penalty/discard), and cap outliers so one lapse doesn't
  wreck the average.

## Lane ideas (no tile yet)

A game gets a tile once it's picked + named.

- **More endless-racing** (beyond Pocket Rally) — outrun-style pseudo-3D highway runner (curves +
  hills, canvas raster trick), a motorbike lane-splitter (near-miss scoring), or a top-down
  drift/rally sprint. Pick 1–2 that feel most distinct from Pocket Rally.
- **More puzzle/riddle** (beyond Sudoku/Minesweeper/Floodgate/Blink) — nonogram/picross, sokoban,
  tents-and-trees / logic-riddle packs, daily riddle ("one brain-teaser a day" pairs
  with challenges). All solvable-by-construction per the design knobs.
- **Colour + logic pack** *(2026-07-14, unconfirmed — competitor study)* — a coherent colour lane
  rather than scattered clones: **Flow Connect** (Flow Free / Numberlink — connect coloured dot
  pairs, fill every cell, no crossings; best touch UX → build first), **Color Flood** (flood-fill
  from a corner in ≤N moves, seeded Daily + VS-bot), **Water Sort** (pour liquids until each tube is
  one colour), **Loop Maze** (one-loop Slitherlink/"Zip" deduction; hand-authored level packs). All
  solvable-by-construction.
- **More retro-arcade** *(2026-07-14, unconfirmed — competitor study)* — classic slots we don't
  cover: **Pong** (VS-bot + local 2P; tiny, on-identity), **Missile Command** (mouse-aim city
  defense, vector-native), **Lunar Lander** (physics landing, reuses the Asteroids space theme), a
  **block-faller** (Tetris-style — needs a non-trademark name; fills a real gap), a **maze-muncher**
  (Pac-Man dot-chase — biggest build, "someday flagship"). A Centipede/Galaga-style formation
  shooter overlaps Invaders (lower prio).

## Raw ideas (no tile, no name yet)

Added 2026-07-26 — straight from the idea dump, deliberately rough. Names, genre tags and tiles come
at triage; effort is a first guess. Most of these are gentle/short-session, which lines up with the
parents+teens marketing lane.

| Idea | Effort | Notes |
| --- | --- | --- |
| **Fruit Basket** (catch game) | trivial–low | falling items caught in a basket below; miss X and it's over, speed/spawn ramp. **Cosmetics are the point:** the falling object and the catcher are both skins (fruit → feathers, basket → a pair of hands), so one mechanic carries many looks. Kids-lane friendly, one-axis input |
| **Balance / walk the rope** | trivial–low | tightrope crossing — hold your equilibrium against drift/wind gusts with left/right nudges; distance score, wobble meter. Very cheap, very readable, good clip material |
| **Fox chase / escape** 🦊 | low–med | foxes patrol the area; when one **spots** you (vision cone / line of sight) it chases and the rest may join — run, break line of sight, survive. On-brand with the mascot. Knobs: patrol paths, spot delay, chase vs. player speed (chaser must be *almost* as fast) |
| **Memory maze** | low | pre-level shows the route for a few seconds, then the maze goes **invisible** and you walk it from memory; a wrong step = fall / reset. Route length scales per level. Pairs with the Glow Says memory lane; kids + adults both read it instantly |
| **Mouse maze to the chest** | low | walk a floor grid in 4 directions to reach a chest, but the floor has **edges** — step off and you fall into the crocodile river. Hazard-avoidance rather than route puzzling; can share tech with Memory maze (same grid + fall) |
| **Swing monkey variation** | low–med | rope/grapple swinging — attach, ride the arc, release at the right moment to carry momentum to the next anchor; distance or height score. Timing-skill, no balance tuning. `gamekit.loopAlpha()` matters here (fast linear motion) |
| **Sliding-tile puzzle** (15-puzzle) | low | promoted out of the puzzle-lane list into its own candidate — shuffle-then-solve, always solvable by construction (shuffle from the solved state), move counter + timer, picture mode as a cosmetic. Daily-seeded board is free |
| **Base + run-and-gun** | med–high | walk and shoot; return to **base** to buy better weapons/armor; enemies attack both you and the base; your death = respawn at base (keep progress), **base destroyed = game over**. ⚠️ Collides with the avoid-balance-heavy guard — economy × waves × upgrades is exactly the tuning load that ate the tower-defense builds. Only take it on deliberately, and scope it small (one map, ~4 upgrades) if so |

## Kids-first (ages 6–10)

Built *for* young kids: one-tap / big-target controls, no reading required, gentle/no fail-state,
celebratory feedback. The **`KIDS` lane is live** (Balloon Pop 🎈 · Glow Says 🏮 · Critter Match 🐾,
shipped 2026-07-12; genre filter wired) — still want to fold the gentle existing games into it
(Stack, Bubble Pop, a slow Snake, gentle Meadow). The no-ads / no-payments / no-chat / offline story
is the parent pitch.

| Game | Effort | Build notes |
| --- | --- | --- |
| **Color Pop** 🎨 | low | tap regions to fill color; no fail, screenshot-shareable |
| **Tap & Learn** 🔠 | low–med | early-learning taps (count the ducks, tap the letter A) — *educational*, pairs with the WORD lane |
| **Maze Pals** 🐭 | low | guide the mouse to the goal; big tiles, no timer |

## Local multiplayer (single-screen)

One file, shared input on one device (desktop = split keyboard; mobile = each player owns a screen
half).

| Game | Effort | Build notes |
| --- | --- | --- |
| **Mash Dash** 🏁 `PARTY` 2–4P | trivial | button-mash race to the line |
| **Air Hockey** 🏒 `SPORT` 2P | low–med | puck physics + 2 paddles. *(favorite)* |
| **Light Cycles** 🏍️ `ARCADE` 2–4P | med | neon trail-fill arena, box rivals in. *(favorite)* |
| **Slime Volleyball** 🏐 `SPORT` 2P | med | two blobs + ball + net physics. *(favorite)* |
| **Ring Out** 🟡 `SPORT` 2–4P | med | sumo — shove rivals off the disc |
| **Gravity Duel** 🚀 `ACTION` 2P | med | gravity well + two ships orbit / aim / shoot |
| **Flap Fight** 🪶 `ARCADE` 2–4P | med | flap to ride higher and stomp — Joust on one screen |

Not a tile yet: **Snake Battle** (multiplayer trail duel — overlaps Light Cycles; pick one).

## Persistent / long-running lane (saved state)

A **second category: games with saved progress** that resume where you left off. **Foxden** 🦊
`IDLE` (grow a fox den over days) is the placeholder / flagship — idle/clicker is the cheapest proven
entry. **Why:** the strongest retention lever we lack — a daily reason to return; pairs with
Challenges + Discord.

Design constraints: all `localStorage` (no server), per-device (clearing wipes progress → lean on
Export/Import), **timestamp-based offline accrual** (not a live timer), **versioned save schema** from
day one, ~≤100 KB budget.

**Gate: the persistent-game lifecycle** (offline accrual + no-wipe-on-loss, on top of
`gamekit.progress`) **ships before the first game in this lane** — see
`plans/progress-save-api-plan.md` — and pairs with the Safari/iOS storage-loss warning.

## Shipped from this pool

Forcefield · Frog Bonk (was "Frog Rush") · Sudoku · Minesweeper · 2048 · Trap the Cat · Glow Says ·
Balloon Pop · Critter Match. Full history in `ROADMAP-archive.md`.
