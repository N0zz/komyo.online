# Frog Bonk — execution plan

Whack-a-mole × castle defense. The frog king defends his meadow castle with a soft hammer;
enemy frogs hop in from all sides. Kid-safe: no gore — bonked frogs boing off the map with a
rainbow trail. Slug `frog-bonk`, icon 🐸, accent `#7ed957`, tags REFLEX · KIDS.

## Core loop

Frogs spawn off-screen all around → hop (jump · wait · jump) toward the castle at center →
player taps a frog → the king's hammer swings out and bonks it (1 tap = 1 HP) → at 0 HP the
frog is launched off-map (spin + boing + rainbow trail) and drops flies 🪰 → frogs that reach
the castle latch on and chomp its HP → castle at 0 = game over.

- **Hammer:** short wind-up (~150 ms) + cooldown (~470 ms) so spam-clicking loses to timing.
  Whacking grass = whiff, small extra cooldown, combo resets.
- **Combo:** damaging hits within a 2 s window chain; each combo step +10% kill score
  (cap +100%); combo ≥3 drops a bonus fly per kill (waves mode).
- **Fairness:** every ranged attack is telegraphed (mage's glowing orb, brute's raised stone);
  whacking the caster mid-wind-up cancels the attack.

## Enemy frogs (hat + weapon = identity)

| type   | look                | HP | move        | attack                                  | score | flies |
|--------|---------------------|----|-------------|-----------------------------------------|-------|-------|
| scout  | leaf cap, dagger    | 1  | fast hops   | melee chomp 1                            | 10    | 1     |
| knight | steel helm, sword   | 2  | medium      | melee chomp 1                            | 25    | 2     |
| mage   | wizard hat, staff   | 1  | slow        | stops at range, telegraphed bolt 1       | 30    | 2     |
| brute  | horned helm, club   | 3  | slow        | melee chomp 2 + occasional thrown stone 1| 50    | 3     |
| chief  | crown, big club     | 6+ | very slow   | melee chomp 3 (waves 5/10/15 mini-boss)  | 150   | 8     |

## Modes × difficulty

- **Waves** — 15 waves, winnable (VICTORY per difficulty). Between waves: castle regen +2 and
  the 🪰 upgrade shop (kit `style:'shop'` menu). Chiefs at waves 5/10/15.
- **Endless** — continuous spawns, interval ramps down forever; flies auto-convert to score.
- **Zen** — slow drip of frogs, castle can't die; finish via the pause menu's "Finish & save".
- **Difficulty** (Waves/Endless; Zen is fixed): Easy 20 castle HP / slower / fewer · Medium 15 /
  baseline · Hard 12 / faster / more. Best per `Waves · Easy` … `Zen` mode labels.

## Per-run upgrades (waves mode, paid in flies — player still does all the killing)

- **Repair** +5 castle HP (repeatable, price grows)
- **Stone Walls** +5 max & current HP (max 3)
- **Moat** frogs crossing the ring rest longer between hops (max 2)
- **Pea Ballista** auto-knockback (no damage) every few seconds (max 2)

## Presentation

- Meadow: layered greens, swaying grass tufts, flowers, drifting petals; dirt paths worn
  toward the gate; round stone keep + banner + the frog king on top holding the hammer.
- Hammer swing arcs over the field to the tap point; impact = squash, stars, shockwave.
- Music: `castle` theme (war-ish) in Waves/Endless, `meadow` in Zen. SFX: bonk, whiff, boing,
  chomp, cast, stone, wave horn, coin, fly blip, combo blips.
- Cosmetics: **Hammer skins** (Wooden free · Fluffy 25 · Candy 50 · Inflatable 50 · Royal
  Gold 100) + **Meadow seasons** (Sunny free · Autumn 25 · Rainy 50 · Snowy 100 — the
  weather-variant content as a shop set).

## Steps

- [x] Design note (this file)
- [x] Scaffold `games/frog-bonk/` + core mechanic (frogs, hammer, castle)
- [x] Modes (waves/endless/zen) + difficulty + shop + telegraphs + polish passes
- [x] Challenges (goodRun + 2 goals), cosmetics (2 sets), icons
- [x] Register: games.js (+ Road Hop icon → 🚧), sitemap, llms.txt, changelog
- [x] i18n: pl keys, then all populated locales (es/pt/fr/it/cs/uk)
- [x] Suites green (`node test.mjs` + all per-game suites)
- [x] Local playtest QA on :8765 — two feedback rounds applied (hitboxes, economy, castle/king/meadow
  art, zen wander mechanic, head-anchored hammer, animated menu backdrop, Frog Siege → Frog Bonk rename)
- [x] Shipped 2026-07-06 — challenge targets (800/2,000) stay provisional pending real scores

## Tuning knobs (provisional — retune from playtests)

- Hammer: windup 9 steps, cooldown 28, whiff penalty +15, hit forgiveness +14 px.
- Hops: dist 46–60 px, airborne 22 steps; sit steps scout 25 / knight 40 / mage 50 / brute 55.
- Chomp every 144 steps; mage cast 130 steps; brute stone windup 90 steps, ~every 6 s.
- Waves: count ≈ 4 + 1.5×wave (difficulty ×0.8/1/1.25); spawn spacing ~0.9 s.
- Endless: spawn 2.2 s → ×0.985 per spawn → floor 0.45 s.
- Challenge targets: easy 800 / hard 2000 = goodRun bar (provisional).
