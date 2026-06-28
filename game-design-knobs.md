# Game design knobs (komyo)

Design knobs we honor when building/polishing games, distilled **in our own words** from the
engine-agnostic genre playbooks in
[awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
(Apache-2.0). We take *inspiration only* — no engine, no deps, plain HTML/canvas/JS, our own
implementation. This file is referenced from CLAUDE.md via `@game-design-knobs.md`.

## Cross-cutting (apply to every game)

- **Model is truth, the view only renders it.** Keep game state separate from drawing; never let
  animations *be* the state. Kills the "animation desynced from logic" bug class — and makes the
  rotation **relayout→redraw** pass safe.
- **`dt`-scaled / fixed-step updates.** Movement and timers scale by time, not frame count, so
  speed is identical at any frame rate. Our `__test.step(n)` already drives a deterministic
  `update()` — keep it that way.
- **Versioned saves.** Any persisted state (bests, idle progress, Export/Import blob) carries a
  `version` field + a migration path from day one, so an update never breaks old saves.
- **Expose the numbers.** Show score/best/lives/wave so the player can plan; clear hit/score
  feedback on every meaningful action.

## Per-genre

### Tower defense (Keep Defender / tower-defense)
- 7 systems to cover: pathing, spawner, towers, targeting, economy, lives, UI.
- Enemy HP grows ~**1.1–1.2×/wave**; wave pacing = **spike → breather → spike** (not monotonic).
- Income tuned so the player can **"almost afford"** each wave.
- **Targeting priority** (first / closest / strongest / weakest) changes play more than raw stats —
  keep variety meaningful.
- Balance check: `dmg_dealt ≈ (dmg × fire_rate) × (range_coverage / enemy_speed)`.

### Puzzle (bubbles, breakout, future Sudoku / Pipe Layer / Spot & Recall)
- Board model is the single source of truth; **resolve cascades in a loop until the board stops
  changing**.
- **Generate solvable-by-construction** (verify a solution exists, or build backward from one) —
  *mandatory* for Sudoku & Pipe Layer. Detect deadlock (no valid move) → shuffle/end.
- Introduce one mechanic at a time.

### Roguelike / roguelite (asteroids roguelite)
- **One seeded RNG per run**, seed stored → reproducible, resumable, and enables **daily-seeded
  runs** (ties into Challenges).
- **Separate run state (wiped on death) from profile state (unlocks, bests, achievements).**
- Scale difficulty/loot by depth/wave; keep resources scarce enough to create pressure.

### Platformer (future Icy Tower)
- Feel from targets, then derive physics: jump height **3–4 tiles**, time-to-apex **0.30–0.40 s**,
  **fall gravity 1.5–2.0× the rise**, **coyote time 0.08–0.12 s**, **jump buffer 0.10–0.15 s**,
  variable jump cut **×0.4–0.5 on release**. `gravity = 2·H / t_apex²`, `jump_v = −2·H / t_apex`.
- Failure modes to pre-empt: input buffering, coyote time, asymmetric gravity (no float),
  corner-correction (no wall-stick).

### Aiming / shooter feel (Range / aim-trainer)
- First shot accurate, **spread grows on sustained fire**; **precision/center multiplier**;
  distance-based scoring; crisp hitmarker + distinct hit/score confirm. (Skip 3D/recoil-pattern
  depth unless a mode needs it.)

### Survival / idle / persistent (future saved-state lane)
- Progression is a **tiered ladder** (each tier unlocks the next — avoid flat grind), respawning
  resource taps (no permanent depletion).
- **Soft-fail with warnings + a recovery path**, not binary instant-death (avoids save-scumming).
- Offline/idle accrual = timestamp-based "what happened while you were away", not a live timer.

### Card / visual-novel (no current game — park)
- Card: a card is in exactly one **zone**; **data-driven effects** + one resolver; phase-based
  turn FSM; seeded shuffle.
- VN: flag-conditioned branching; **save = exact position + all flags**; tunable text speed/skip.
