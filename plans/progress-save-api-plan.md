# Progress-save API (resume / history) — kit-owned, incremental

Advances **ROADMAP Path to launch #5** (kit-owned progress-save API). Built by *extracting* Sudoku's
existing history into a kit primitive, then onboarding the other long-session board games — NOT by
designing a whole API up front. Idle/persistent games (Foxden, "level 3") ride the same primitive
later with their own lifecycle; not in scope here.

## The primitive

`gamekit.progress(slug, { key?, max?, version? })` → `{ save, load, list, current, has, remove, clear }`.

- ONE localStorage key = a bare array of entries `[{ v, id, ts, ...payload }]`, newest-first, capped to
  `max` (**1 = single "resume" slot**, **N = capped history**). Payload is game-defined + opaque.
- Kit owns the `v/id/ts` envelope, the cap, and quota-safety (`QuotaExceededError` swallowed in ONE place).
- `save(payload)` upserts by `payload.id` (assigns one if absent), bubbles to front, caps. Games call it on
  **discrete events** (a move/shot resolving), never per-frame.
- Default key `<slug>_progress` is slug-prefixed → the ☰ "Reset game data" (prefix `<slug>_`) clears it.
- Sync localStorage (matches Sudoku + the no-accounts/offline identity). No async until a backend ever exists.

## Per-game save UX (declared per game)

- **none** — no save (all reflex/short games: snake, flappy, breakout, stacker, asteroids/+, …).
- **resume** (`max:1`) — single slot + a "Resume" affordance. → **2048, bubbles, minesweeper**.
- **history** (`max:N`) — capped list + an "In progress" picker. → **sudoku** (cap 20).

## Steps

- [x] **Phase 1 — primitive + Sudoku extraction.** Add `gamekit.progress`; migrate Sudoku's `sudoku_history`
      onto it (same key + entry shape → zero player-data migration). Suite green (139), top-level 605.
- [x] **Phase 2 — 2048 (resume).** Slot per mode (id=mode); save on each move; clear on over/win + fresh
      start; "Continue · <mode> <score>" on the start menu; `confirmLeave` dropped (progress persists). Added
      reusable `game.common.continue`/`newGame` to all 7 locales. Round-trip test. Suite 82, top-level 605.
- [x] **Phase 3 — bubbles (resume).** Slot per mode; serialize {mode, timeDescent, grid(colorIdx), offsets,
      parity, counters, timers, shotColor, nextColor, score, level}; save when a shot settles / grid descends
      (never mid-flight); clear on over/win + fresh start; Continue per mode; `confirmLeave` dropped. Round-trip
      test (grid + score). Suite 159, top-level 605.
- [ ] **Phase 4 — minesweeper (resume).** serialize the board + revealed/flagged + first-click state; save on
      reveal/flag; **resumed runs are ineligible for best-TIME** (you could pause the clock); Continue per
      difficulty. Test.
- [ ] **Phase 5 — polish.** Reuse existing `game.common.*` i18n keys where possible (avoid new-locale tax);
      Export/Import already covers the slug-prefixed keys via the existing data blob — verify. Update ROADMAP
      Path-to-launch #5 status. Full suites + menu gate + 5-viewport eyeball.

## Notes / risks

- **Sudoku is load-bearing** — kept its `__test` hooks (`history/currentSave/resumeHistory/saveNow`), key and
  format identical; first + reference consumer.
- **Save at rest, model-is-truth** — persist the settled game model, never transient view state (animations,
  particles, in-flight bubbles).
- **Best-score integrity** — resuming the same run isn't score-scumming; only minesweeper's best-TIME needs
  the resumed-ineligible rule.
- **Level 3 (idle/persistent)** is a separate game genre on top of this primitive (offline accrual, no
  wipe-on-loss) — deliberately out of scope; the primitive leaves the seam.
