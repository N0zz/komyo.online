# Achievements plan (komyo)

Auto-unlocking, evergreen goals that pay 🏆 trophies. Kit-owned logic, data in a registry —
the same split as `cosmetics.js` / `challenges.js`.

**Status:** BUILT (2026-07-30) — registry + kit engine + wall + 79 achievements, translated into all
8 languages. Nothing outstanding.

## Why this exists, and what it must not become

komyo already has three progression systems. Achievements only earn their place by filling the gap
none of them cover:

| System | Shape | Rotates? | Scope |
| --- | --- | --- | --- |
| Challenges | daily / weekly goals | yes, expires | one game at a time |
| Titles | one lifetime-trophy ladder | no | account-wide, single axis |
| Cosmetics | spend trophies | no | per game + site-wide |
| **Achievements** | **one-off, evergreen goals** | **never** | **per game + site-wide** |

**The gap: nothing today is a permanent, discoverable, per-game goal.** Challenges rotate away;
titles are a single number going up. Nothing says "clear the campaign" or "survive wave 20 without
selling a tower" and then leaves it there forever.

**Hard rule: an achievement must never restate a challenge goal.** If `challenges.js` already asks
for it as a daily/weekly, it is not an achievement. Achievements are things that stay true once done.

**No streaks.** Nothing that rewards consecutive days (see the decision guards in
`ROADMAP-archive.md`). Cumulative totals are fine; "7 days in a row" is not.

## Two categories

**1. Game-specific** — `game: '<slug>'`. Examples of the three mechanical shapes:

- *per-run*: "bonk 25 mages in a single run" (frog-bonk) — reads one number off the run.
- *cumulative*: "bonk 1,000 mages total" — needs the tally store below.
- *conditional clear*: "finish Tube Racer without touching a speed lane", "finish the campaign" —
  reads a boolean the game reports.

**2. Site-wide** — `game: ''`. Cosmetics/collection milestones ("buy your first cosmetic",
"own 25% of all cosmetics"), breadth ("play 10 different games", "earn a good run in 5 games").

**Rejected: "join the Discord".** With no accounts we cannot verify it, so it reduces to a button
that pays trophies to anyone who clicks. If the nudge is wanted, it ships as a link tile with no
reward.

## Registry: `achievements.js`

Data only, loaded in the atomic `<head>` unit next to `cosmetics.js` (and added to the root `sw.js`
SHELL). `window.ACHIEVEMENTS = [ … ]`:

```js
{ id: 'frog-bonk.mages25',      // '<slug>.<key>' or 'site.<key>' — the ONE identity, storage key included
  game: 'frog-bonk',            // '' = site-wide
  icon: '🐸',                   // emoji, drawn as text (no assets)
  price: 15,                    // 🏆 paid ON UNLOCK (see bands)
  hint: true,                   // show the locked row with its description (the replay driver)
  test: (r, T) => r.stats.mages >= 25 }   // see the predicate contract
```

`name`/`desc` are **not** in the registry — they are i18n keys (`ach.<id>.name` /
`ach.<id>.desc`), exactly like `cos.*`, so the coverage test in `test.mjs` enforces the Polish
translation and every other locale stays all-or-nothing.

### The predicate contract

`test(run, tally)` is called by the kit **once per recorded run**, and must be pure.

- `run` = the record the end menu already passes: `{ slug, mode, score, time, outcome, stats }`.
- `tally` = the cumulative counters for this slug (see below), already including this run.
- Site-wide predicates get `run` too, plus they may read `gamekit.cosmetics` and `gamekit.profile()`.

Anything a predicate needs beyond that, the **game** supplies by adding one number or boolean to
`record.stats` — which every game already knows how to do. No new per-game plumbing, no new events.

## Storage

Two keys, both versioned, both written **once per run** (never per frame):

**`gamekit_ach`** — what is unlocked. `{ v:1, u: { '<id>': <ts> } }`. Bounded by the registry size.

**`gamekit_tally`** — cumulative counters, the one thing the kit cannot already answer.
`gamekit_pb` keeps per-mode stats as a **MAX** (`game-kit.js:2168`) and `gamekit_stats` holds only
`{first, days, lastDay, goodRuns}`, so nothing sums a stat across runs today.

```js
{ v:1, t: { 'frog-bonk': { mages: 1240, kills: 8800 }, '': { plays: 412 } } }
```

**Counters grow forever, so the key set must not.** A game cannot invent tally keys at will: the
kit sums only the stat names a registry entry actually asks for (derived once from
`window.ACHIEVEMENTS` at load), which caps the store at the registry's own size. Numeric only,
clamped, ≤10 KB — the per-game storage budget in CLAUDE.md applies.

Both keys are slug-agnostic top-level kit stores, so they belong in Export/Import next to
`gamekit_owned` / `gamekit_cos_sel`, and **not** to any game's `<slug>_` reset prefix.

## Evaluation hook

One place: inside `recordResult` (`game-kit.js:2211+`), after the best store is written and the
tally is updated — the same spot that already re-syncs the challenge and title dots. It is the ONE
recording path per CLAUDE.md, and it is idempotent per run, so an achievement cannot double-unlock
from a re-shown end menu.

Order per run: `pbSave` → tally += → evaluate predicates → award trophies → unlock → dot the button.

Kit API (mirrors `gamekit.cosmetics`):

```text
gamekit.achievements → {
  all(game?), unlocked(id), progress(game?)  // {done, total} for the badge wall + tile hints
  evaluate(run)                              // internal, called by recordResult
  panel(opts)                                // the badge-wall modal
}
```

## Trophies

Paid on unlock, added to **lifetime** (so they feed the titles ladder) and therefore to the
spendable balance. Bands, matching the cosmetics price bands:

- **5** — entry tier that fires in the first session ("first cosmetic bought", "first good run").
  Deliberately small: these are flavour, not income.
- **15** — a normal per-run or clear achievement.
- **50** — the genuinely hard ones (a full campaign, a no-hit clear).

**Cosmetic-unlock achievements ("own 25% of cosmetics") sit at 5.** Paying real trophies for
spending trophies is a partial refund; keep it flavour.

Economy note: this is an injection spread over weeks of play, not a lump, and the spending pool grows
with every new game and cosmetic set. The titles ladder is tuned hard enough to absorb it
(`challenges.js` titles: 100 → 10,000 lifetime). Re-check the shop bands once the launch set is
priced, not before.

## UI

**No new side-stack button.** The right-edge stack is already Profile / 🏆 Challenges / 🎨
Collection, and a fourth costs the gutter measurement and the landscape rail — the exact place
things have shipped broken before (see the 2026-07-12 note in CLAUDE.md). Achievements are a **tab
inside the Collection modal** (`gamekit.shopPanel`), which is already scoped per game + site-wide,
which is exactly the scoping achievements need.

- **Locked rows are visible**, with their description, when `hint: true`. The hint is the whole
  point — a hidden achievement drives nothing.
- Unlock feedback reuses what exists: the end menu's receipt line (like "✓ Good run") plus the
  Profile button's one-shot pulse (`game-kit.js:2840`). No new overlay, no new stinger.
- The badge wall shows `progress()` as "12 / 30".

## i18n cost — the real budget constraint

Two strings per achievement × 8 locales. A 30-achievement launch set is **~420 translations** on
top of `en`. That, not the trophy economy, is what caps the launch size. Ship ~30 (≈15 site-wide,
2–3 for a handful of games) and grow it per game afterwards, the way cosmetics grew.

## Launch set — goals, with the effort each one costs

Per-run yields are read off the games' own code (spawn tables, score formulas) and cross-checked
against each game's `CHALLENGES.goodRun` bar, which is what a *decent* run of that game scores.
"Runs" = runs of that quality. Times are wall-clock at that pace, not including menu time.

Calibration the whole set follows:

| Tier | Means | Cumulative goals sized at | 50 🏆 allowed? |
| --- | --- | --- | --- |
| **5 🏆** | fires in the first session or two | ~2–5 good runs | no |
| **15 🏆** | a week of casual play on that game | ~10–25 good runs | no |
| **50 🏆** | a skill wall — a thing you have to get *good* at | never a grind | yes, only here |

**50 🏆 is skill-only.** No `sum:` (cumulative) achievement may cost 50 — grinding is not difficulty,
and the suite enforces it.

### Cumulative goals (the ones with a real "how long" answer)

| Achievement | 🏆 | Goal | Per run | ≈ runs | ≈ time |
| --- | --- | --- | --- | --- | --- |
| frog-bonk · Getting the Hang of It | 5 | 300 bonks | ~125 (wave 10) | 2–3 | ~15 min |
| floodgate · Plumber | 5 | 25 boards | 3–5 | 6–8 | ~40 min |
| mirror-maze · Light Bender | 5 | 50 mazes | 5–8 | 7–10 | ~1 h |
| frog-bonk · Mage Hunter | 15 | 1,500 bonks | ~125 | 12 | ~1 h |
| tower-defense · Siege Breaker | 15 | 5,000 kills | ~400 (to wave 10) | 12–13 | ~2 h |
| forcefield · Deflector | 15 | 500 blocks | 40–60 | 9–12 | ~30 min |
| bubbles · Pop Machine | 15 | 5,000 pops | ~250 | 20 | ~1.5 h |
| breakout · Demolition | 15 | 5,000 bricks | 150–250 | 20–30 | ~1.5 h |
| sudoku · Puzzle Habit | 15 | 20 puzzles | 1 | 20 | ~3 h |
| trap-the-cat · Cat Wrangler | 15 | 25 cats | 1 | 25 | ~30 min |
| flappy · Frequent Flyer | 15 | 1,000 gates | ~50 | 20 | ~20 min |
| aim-trainer · Marksman | 15 | 2,500 hits | 60–100 | 25–40 | ~30 min |
| type-siege · Ten Thousand Keys | 15 | 10,000 letters | 400–600 | 17–25 | ~1.5 h |
| dusk-runner · Marathon | 15 | 42,195 m | ~900 m | ~47 | ~1 h |
| floodgate · Waterworks | 15 | 100 boards | 3–5 | 25–30 | ~3 h |
| mirror-maze · Prism Master | 15 | 250 mazes | 5–8 | 35–50 | ~5 h |
| minesweeper · Twenty-Five Boards | 15 | 25 clears | 1 win | 25+ | ~1 h |
| critter-match · Critter Friend | 15 | 25 boards | 1 | 25 | ~40 min |
| glow-says · Perfect Pitch | 15 | 250 notes | ~8 | ~30 | ~40 min |
| tube-racer · Thousand Klicks | 15 | 1,000 km | 30 km (sprint) | ~33 | ~4 h |

### Best-ever goals (one good run, or a skill wall)

| Achievement | 🏆 | Goal | Reference point |
| --- | --- | --- | --- |
| asteroids · Field Sweep / Deep Field / Belt Runner | 5 / 15 / 50 | wave 5 / 10 / 15 | good run ≈ 8,000 pts |
| asteroids+ · Upgraded / Outer Rim / Run Complete | 5 / 15 / 50 | wave 10 / 20 / win | a full win is the hard one |
| tower-defense · The Keep Holds | 5 | wave 10 | the campaign's own victory point |
| frog-bonk · Ten Waves | 5 | wave 10 | good run ≈ 2,000 pts |
| snake · Long Snake / Serpent | 5 / 15 | length 50 / 100 | good run = 300 pts |
| 2048 · Four Digits / 2048 / Beyond | 5 / 15 / 50 | 1024 / 2048 / 4096 | daily goal is a 256 tile |
| type-siege · Touch Typist / Fast Fingers / Blur | 5 / 15 / 50 | 40 / 60 / 80 WPM | 80 WPM is a real typist |
| tube-racer · Mach One / Mach 1.5 / Redline | 5 / 15 / 50 | Mach 1 / 1.5 / 2 | engine tops out at Mach 2.08 |
| mirror-maze · Fifth Tier | 15 | tier 5 | tiers grow with the run |
| stacker · Skyline | 15 | 75 pts | good run = 50 |
| stacker · Ten in a Row | 15 | 10 perfect drops | streak, not total |
| forcefield · Three Minutes | 15 | 180 s survived | good run ≈ 1,200 pts |
| balloon-pop · Ten Combo | 5 | 10× combo | kid-friendly, first session |
| dusk-runner · Two Kilometres | 50 | 2,000 m | good run = 900 m |
| flappy · Century Flight | 50 | 100 gates | good run = 50 |
| glow-says · Twelve Notes | 50 | 12-note tune | weekly goal caps at 8 |

### Site-wide

| Achievement | 🏆 | Goal | Effort |
| --- | --- | --- | --- |
| First Purchase | 5 | 1 paid cosmetic | first shop visit |
| Looking Around | 5 | 5 games | one sitting |
| Good Run | 5 | 1 good run | first session |
| Titled | 5 | wear an earned rank | 100 lifetime 🏆 |
| Regular | 5 | 50 runs | a few days |
| Collector / Curator | 5 / 5 | 25% / 50% of buyable cosmetics | ~2,000 / ~4,000 🏆 spent |
| Wide Taste | 15 | 8 of 14 categories | ~8–10 games |
| Regular Visitor | 15 | 15 games | most of the arcade |
| All-Rounder | 15 | good run in 5 games | a week |
| Veteran | 15 | 500 runs | weeks |
| Trophy Hoard | 15 | 2,500 lifetime 🏆 | weeks |
| Completionist | 15 | every buyable cosmetic | the long haul |
| Full Set of Hands | 15 | every cursor | mid-term |
| Every Cabinet | 50 | every live game | completionist breadth |

### Conditionals (no number — you either did it or you didn't)

17 achievements are single-run conditions and show ✓ / locked instead of a bar: sudoku's clean and
Expert solves, minesweeper's Expert and flagless clears, breakout's flawless level, bubbles' five-level
clear, tower-defense's Hard-20 and no-sell runs, tube-racer's scratch-free sprint, floodgate's par,
mirror-maze's hint-free maze, critter-match's sharp board, balloon-pop's no-sting run, aim-trainer's
90% run, type-siege's 100%-accuracy wave, dusk-runner's stumble-free 500 m, trap-the-cat's 15-click win.

## Tests

- `test.mjs`: registry validity (ids unique, `game` is `''` or a live slug, prices in the bands,
  every `ach.*` key present in `pl`), tally key set derived from the registry, storage caps.
- Predicate matrix, headless: feed synthetic `run` objects through `evaluate()` and assert exactly
  the expected set unlocks, that a second identical run unlocks nothing new, and that trophies land
  once (the double-award trap).
- Per-game: for each game named in a per-game achievement, drive it via `__test` to the point the
  predicate should fire and assert it does — this is what catches a game that renamed a stat.
- Menu-fit: the Collection modal with the achievements tab at 360×640 and 640×360
  (`test-menu-browser.mjs`).

## What the build changed vs this plan

- **`metric` + `goal` instead of a bare `test()`**: an entry declares ONE shape — `max:'<stat>'`
  (best-ever, from the `gamekit_pb` per-mode MAXes), `sum:'<stat>'` (cumulative, `gamekit_tally`),
  `site:'<counter>'` (a closed kit vocabulary) or `run: fn(run)` (a conditional). The bar and the
  unlock read the SAME number, so they cannot disagree — the failure mode a separate `test()` invites.
- **Backfill on first evaluation**: `max:`/`site:` shapes are re-derived from existing history, so a
  returning player opens the wall to what they already earned instead of an empty grid. `sum:` shapes
  start at 0 (nothing summed stats before this), which is why every progressive cumulative pair has a
  small first tier.
- **`achSync()` is the ONE non-run entry point** (page load, a shop purchase, a title equip) instead of
  a bespoke hook per event.
- **Percent counters measure PAID cosmetics** (`cosPaidPct`): free defaults are auto-owned, so a fresh
  device reads ~20% of the whole catalogue and "own a quarter" would be nearly complete at install.
- **A cumulative goal may never cost 50 🏆** (suite-enforced): grinding is not difficulty.
- **The end-menu receipt is ONE line**, collapsing to "N achievements unlocked · +X 🏆" when a run
  unlocks several — five rows overflow the 640×360 rail.
- **A stat reported at a CHECKPOINT must be a delta, not a running total.** Mirror Maze shows an end
  menu per solved maze, so `mazes: solvedCount` summed 1+2+3+… and put a 50-maze goal at 10 mazes; it
  reports `solved: 1` per checkpoint instead. Any future checkpoint game has the same trap.
- **Rejected here too: "wear a title" as a real goal.** The kit auto-adopts tier 0 at first boot, so
  the counter reads the worn TIER and only counts from tier 1 (the first earned rank).

## Steps

- [x] Agree the launch set (the 30 lines, with names/descriptions in `en`)
- [x] `achievements.js` registry + head load order + root `sw.js` SHELL entry
- [x] `gamekit_tally` counter store (registry-derived key set, versioned, per-run write)
- [x] `gamekit_ach` unlock store + `gamekit.achievements` API
- [x] Hook `evaluate()` into `recordResult`, with the trophy award
- [x] Achievements tab in the Collection modal (locked rows + progress)
- [x] End-menu receipt line + Profile pulse on unlock
- [x] Per-game `record.stats` additions for the per-game predicates
- [x] Tests: registry, predicate matrix, per-game firing, menu-fit
- [x] `pl` translations, then the other six locales (one agent per locale, 165 keys each) (see `plans/i18n-plan.md` for the chunking flow)
- [x] Export/Import: both new keys ride along (the blob copies all of localStorage)
- [ ] Changelog: ONE bullet ("achievements added"), written at the end from what shipped
