# Achievements plan (komyo)

Auto-unlocking, evergreen goals that pay 🏆 trophies. Kit-owned logic, data in a registry —
the same split as `cosmetics.js` / `challenges.js`.

**Status:** planned, nothing built.

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

## Launch set — sizing only

| Bucket | Count | Notes |
| --- | --- | --- |
| Site-wide | ~15 | cosmetics/collection milestones, breadth-of-play, trophy totals |
| Per-game | ~15 | 2–3 each for the games with an obvious evergreen goal |
| **Total** | **~30** | ≈420 translations |

Games with an obvious first achievement: tower-defense, frog-bonk, asteroids-plus, tube-racer,
mirror-maze, floodgate, sudoku, type-siege (the ones with campaigns, waves or clear conditions).
The rest can wait — an achievement nobody can describe in one line is filler.

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

## Steps

- [ ] Agree the launch set (the 30 lines, with names/descriptions in `en`)
- [ ] `achievements.js` registry + head load order + root `sw.js` SHELL entry
- [ ] `gamekit_tally` counter store (registry-derived key set, versioned, per-run write)
- [ ] `gamekit_ach` unlock store + `gamekit.achievements` API
- [ ] Hook `evaluate()` into `recordResult`, with the trophy award
- [ ] Achievements tab in the Collection modal (locked rows + progress)
- [ ] End-menu receipt line + Profile pulse on unlock
- [ ] Per-game `record.stats` additions for the per-game predicates
- [ ] Tests: registry, predicate matrix, per-game firing, menu-fit
- [ ] `pl` translations, then the other six locales (see `plans/i18n-plan.md` for the chunking flow)
- [ ] Export/Import: include both new keys
- [ ] Changelog: ONE bullet ("achievements added"), written at the end from what shipped
