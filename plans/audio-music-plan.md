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
