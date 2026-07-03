# Genres — thin pointer

**The authority for all per-genre design knobs is
[`/Users/kkolodziejczyk/arcade/game-design-knobs.md`](/Users/kkolodziejczyk/arcade/game-design-knobs.md)**
(also referenced from `CLAUDE.md` via `@game-design-knobs.md`). Read it before designing a game.
This file does NOT duplicate it — it only adds the genre→starter map and the repo's selection bias.

## Genre → core-mechanic starter

Where to begin the POC (build this mechanic first, confirm it's fun, then iterate — see CLAUDE.md's
"Adding / changing a game" ladder):

| genre | core mechanic to prototype first |
|-------|----------------------------------|
| **Puzzle** | a board model as the single source of truth; resolve cascades in a loop until the board stops changing; generate solvable-by-construction. |
| **Timing / reflex (one-button)** | one input, a moving target/window, a clean hit/miss judgment; feel from the timing window + feedback, not from content. |
| **Arcade-skill (catcher / dodger)** | a mover under player control + a stream of spawns to catch/avoid; difficulty from spawn rate & speed ramp. |
| **Aiming** | first shot accurate, spread grows on sustained fire, distance/center scoring, crisp hitmarker (see the knobs' aiming section). |
| **Platformer** | derive physics from feel targets (jump height, time-to-apex, asymmetric gravity, coyote time, jump buffer) — the knobs give the exact numbers. |

## Repo bias — favor low-tuning genres

- **Favor:** puzzle, timing/reflex, arcade-skill. These ship well from a small mechanic and cost
  little balancing.
- **Avoid (learned the hard way):** tower defense and roguelite shooters. Keep Defender and
  Asteroids+ ate large tuning cycles (wave/HP/economy/upgrade curves) for a hobby project. Only
  reach for a balance-heavy genre with a strong reason.
- **Slot one original, shareable mechanic alongside the remakes.** The catalogue has plenty of
  classics; a distinctive original hook (something worth sharing a score of) is worth more than
  another faithful clone.
