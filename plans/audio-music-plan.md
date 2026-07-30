# Procedural music — scaling plan

Execution plan for taking the kit's generative music from a handful of per-genre themes to a large
library of distinct, per-game (and per-biome/level/daily-seed) tracks — **staying zero-asset**
(pure Web Audio, no files), which is the whole identity.

## Where this came from

Explored in the **Audio Lab** mock: `plans/audio-lab.html` (Current-vs-Modern comparison across all 11
live games) + `plans/audio-lint.mjs` (the **distinctness linter** — parses the mock's config live and
flags tracks that overlap too much). Decision so far: **procedural-first**; real `.ogg` files stay
deferred (size/pipeline/licensing cost + drops the code-only identity) — revisit only if the linter
proves procedural can't reach the needed variety.

## The core finding (why a plan is needed)

Distinctness is **not** limited by progressions (near-infinite) — it's limited by the low-cardinality
**identity axes**, dominated by *style/groove family* (~7) × *drum kit* (~6), which are correlated
(each style ≈ one kit). So there are only ~**7–8 truly-distinct "flavors."** Two tracks that share
style + kit start at ~0.42 similarity before a single note, so a unique progression alone can't
separate them.

Practical ceiling **today**: ~7–8 genuinely distinct, ~15–30 that pass the linter (accepting
same-family "genre siblings"). To reach **hundreds**, expand the vocabulary AND switch from
*authoring* each track to *generating + curating*.

## SHIPPED 2026-07-30 — engine v3 (and a phase 0 the plan had missed)

The plan below led with **synthesis variety**. Playtesting against a commercial reference track said the
first-order problem was something else entirely, and none of it was in the plan: the music sounded *flat*
(no dynamics), *thin* (few simultaneous sources, no sub), *aimless* (the melody rolled `Math.random()` per
note, so nothing ever repeated or resolved) and *short* (one 8-bar loop forever). Measured against the
reference: crest factor 16–19 dB vs its 8 dB — i.e. no glue at all.

What landed in `game-kit.js`:

- [x] **Phase 0 — a mastered mix bus** (wasn't in this plan; biggest win per hour). Music sums into
  `musicSum` → glue compressor → `WaveShaper` soft-clip → limiter → `musicGain`. Separate drum / bass /
  voice / pad / fx buses, so the kick can **sidechain-duck** the melodic side. Measured crest is now
  6.6–9.1 dB, in the reference's range.
- [x] **Phase 0b — layered drums + a real sub.** A kick is 4 sources (sub sweep, mid body, click,
  room tail), a clap is band-split. A dedicated sub layer under 90 Hz took energy below 160 Hz from
  ~45% to a measured **64%** at peak.
- [x] **Phase 4 (partly) — the motif generator.** One deterministic hook per track from its seed
  (`makeMotif`), developed by transpose / invert / octave / retrograde, replayed identically forever.
  The 15–20 extra **modes** are still open.
- [x] **Phase 5 — arrangement / sections.** Six templates (`dance` / `lush` / `epic` / `tactical` /
  `puzzle` / `retro`); a track is `arr: '<template>'` + a seed + optional `secE` / `mute` overrides.
  Sections carry an `e` energy, and **intensity picks the section** — so the arrangement is adaptive
  rather than a fixed timeline. Transitions are rule-bound: 4-bar phrase lines only, a hysteresis
  margin (without it a smooth ramp flaps between neighbours), decided one bar early so that bar plays
  a direction-aware fill, landing on a crash with pad + sub ringing across the seam. Peak sections run
  7–10 simultaneous sources vs v2's 5–6; calm sections 2–3.
- [x] All **30 tracks re-voiced**, ids and `ALIAS` preserved (no game or cosmetic broke). Snake's two
  purchasable tracks keep their ids, names and prices, with Neon Banger still the denser of the pair.
- [x] **`audio-lint.mjs`** gained `arr` and `seed` as axes and a `game` field for same-game families
  (it used to flag Keep Defender's own biomes against each other). Result: **0 redesign flags** (was 1)
  and 5 siblings all at exactly 55%, the floor of the band (was 9, worst 75%).
- [x] **`plans/audio-lab-v2.html`** — a soundboard for all 30 tracks that **drives the real engine**
  via `gamekit.music` (`state()` / `arrangement()` / `jump()` / `adaptive()` / `analyser()`) instead of
  re-implementing it, so it cannot drift the way the v1 mock did.

**Still open below:** phase 1 (seed → *whole song* + linter-as-selector), phase 2 (Karplus–Strong + FM),
phase 3 (rhythm grammar / time signatures), phase 4's mode expansion. Those remain the route to
*hundreds* of tracks; v3 was the route to tracks that sound produced.

**Parked for playtesting:** the adaptive switch waits for the next 4-bar phrase line, up to ~1.6 s
behind the game's intensity. `gamekit.music.phrase(2)` halves that if it feels sluggish in a real run —
decide from play, not from the lab.

## The plan (phased — each phase shippable on its own)

The one real unlock: **make a song a pure function of a seed, then use the linter as a *selector*** —
generate thousands of seeds, auto-pick the N most mutually-distinct. Search the space; don't handcraft.

- [ ] **1. Seed → song + linter-as-selector (architecture first — highest leverage).**
  One integer seed → deterministic choices for every axis (mode, tempo, groove, timbres, motif,
  arrangement). Extend `audio-lint.mjs` from checker → selector: generate ~10k seeds, compute pairwise
  distinctness, greedily pick the most mutually-distinct subset of size N. Each game claims a **region**
  of the space (e.g. Keep Defender → minor modes, orchestral timbres, martial rhythm); its
  biomes/levels/daily-seed each draw a distinct song *from its own family*.
- [ ] **2. Add 2 synthesis families (biggest perceived-variety jump per hour).**
  Beyond osc-wave + one lowpass: **Karplus–Strong** (plucked string / harp / koto) and **FM**
  (bells / e-piano / brass). Selectable per role (bass/lead/pad). Later: wavetable, PWM, formant/vox.
- [ ] **3. Rhythm grammar.** Replace the ~7 hardcoded grooves with a pattern grammar: per-instrument
  steps, swing, **straight / shuffle / triplet** subdivision, and **time signatures (4/4, 3/4, 6/8,
  7/8)**. Time-sig + subdivision are highly salient and barely used today.
- [ ] **4. Motif generator + modes.** A seeded short **hook** developed by transpose / invert /
  retrograde (memorable "a tune", not a random-walk wash), over ~**15–20 modes** (Dorian, Phrygian-dom,
  whole-tone, blues, hirajoshi…) + chord qualities (7ths, sus, power).
- [ ] **5. Arrangement / sections.** Intro / verse / chorus / drop with changing instrumentation, so
  each song has an arc.

**Expected reach:** phases 1–2 alone → ~30–50 distinct; through phase 4 → hundreds. Even a modest
expansion (15 modes × 9 tempo-feels × 8 lead timbres × 6 bass timbres × 10 grooves) is ~65k structural
combos, mostly perceptually distinct — selecting a few hundred mutually-distinct becomes trivial.

## Honest tradeoffs (decide before committing)

- **Effort:** this is building a real mini generative-music engine (synths + grammar + motif +
  arrangement + seed pipeline). Substantial but very doable in Web Audio; still 0 KB / offline / on-brand.
- **Distinct ≠ good:** the linter guarantees tracks *differ*, not that each is *pleasant*. Need a light
  quality heuristic + human spot-check of the final curated set (not all 10k).
- **The files alternative** gives unlimited variety + higher fidelity but reintroduces size/pipeline/
  licensing and drops the code-only identity. Seed+curate keeps everything procedural for ~0 bytes.

## Immediate (pre-plan) polish still open in the mock

Loudness normalized; per-game palettes distinct (linter clean: 0 hard flags, worst pair 62%). Remaining
"genre siblings" (electronic-dance family: Snake/Bubble/Frog; calm family: Stack/Meadow) are acceptable
family resemblance — only pushable lower by diversifying their drum kits (a "cohesive family vs maximally
different" call).
