# komyo Replay System Plan

> **Status (2026-07-21): IDEA — discussed, not started.** Two-part initiative agreed viable:
> (B) kit-owned video clip capture (cheap, no game changes) and (A) deterministic input-replay
> (a kit contract + per-game adoption). Ship B first; A pilots on asteroids-plus; then join them
> ("render any past run as a clip").

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players (1) capture and share short video clips of their runs, and (2) record, rewatch,
save and share full runs as tiny deterministic replays — no backend, no accounts, in keeping with the
site's zero-deps/static constraints.

**Why it's a good fit:** the kit already enforces the hard prerequisite for input-replay — every game
runs a fixed-timestep, deterministic `update()` drivable externally (`__test.step(n)`). A replay is
just `seed + inputs per step`, re-simulated through the same `update()`.

**Architecture decisions (from the discussion):**

- **Clips (B) are kit-only:** `canvas.captureStream()` + `MediaRecorder`, rolling "last ~15 s"
  buffer, audio tapped from the kit's WebAudio graph (`MediaStreamAudioDestinationNode` on the
  sound/music buses). Zero game changes. Clips are download/native-share only (never persisted —
  blobs don't belong in localStorage).
- **Replays (A) are a kit contract games opt into:** per-run seeded RNG (seed stored in the replay)
  + games route gameplay input through a kit recorder each step. The kit owns record, playback
  (feed recorded inputs into the same `update()`, render normally, scrubber UI) and storage.
- **Storage:** the ~10 KB localStorage budget does NOT apply — replays live in **IndexedDB**
  (new `gamekit.replays` store; browser-managed quota, best-effort → treat replays as
  nice-to-have, bests stay in localStorage) **+ file export/import** ("⬇ Save replay" /
  "Load replay") which doubles as the sharing mechanism. No backend option exists by design.
- **Replay format is versioned from day one:** `{v:1, slug, mode, seed, build, inputs}` with
  inputs delta-encoded/quantized (pointer-heavy games generate the most data). `build` (sha) is
  recorded so playback can warn on cross-build mismatch — gameplay changes between builds can
  desync old replays; warn, don't block.
- **A feeds B:** once playback exists, "🎬 Render as clip" re-simulates a stored replay through
  the capture pipe — clips of any past run, at capture-time quality, with no recording overhead
  during live play.

**Known costs / risks:**

- ~9/18 games have seed plumbing only on the test path; normal play rolls raw `Math.random`.
  Every adopting game needs a per-run seeded RNG in its gameplay path.
- The kit owns zero gameplay input today (all kit listeners are chrome) — input routing is a
  per-game retrofit, the expensive part. Hence: contract + pilot, not a site-wide switch.
- Safari `MediaRecorder` codec variance (webm vs mp4) — feature-detect, fall back, and hide the
  button where unsupported. All new APIs need the usual headless guards.
- IndexedDB eviction under storage pressure — cap stored replays per game (e.g. last 3 + pinned
  best), surface "export to file" as the durable path.

---

## Phase 1 — Clip capture (kit-only, ships alone)

- [ ] `gamekit.clips` — rolling `MediaRecorder` buffer on the game canvas (`captureStream`),
      start/stop tied to run start/end, ~15 s window, feature-detected (headless/unsupported → inert)
- [ ] Audio tap: route the kit sound + music buses through a `MediaStreamAudioDestinationNode`
      into the clip stream (kit owns the whole WebAudio graph, so no game changes)
- [ ] Codec strategy: prefer `video/mp4` where supported (Safari), else `video/webm`; hide the
      feature when neither records
- [ ] UI: "🎬 Save clip" entry on the end menu / share row (download + native share with the file);
      i18n keys ×7 locales
- [ ] Eyeball pass (desktop + portrait + landscape) incl. perf check that recording doesn't
      drop frames on a mid phone; suites green; changelog entry

## Phase 2 — Replay contract (kit)

- [ ] `gamekit.replay` — per-run seeded RNG helper (seed rolled at run start, stored),
      `input(state)` per-step recorder, versioned format `{v, slug, mode, seed, build, inputs}`
      with delta-encoding/quantization for pointer streams
- [ ] Playback driver: feed recorded inputs into the game's `update()` step-by-step (same engine
      as `__test.step`), render normally; minimal scrubber/exit UI; build-mismatch warning
- [ ] Storage: `gamekit.replays` IndexedDB store (cap per game: last 3 + pinned best; graceful
      when IndexedDB is unavailable) + file export/import (compact JSON, gzip if cheap)
- [ ] Test-harness support: record → replay → assert identical final state (the determinism
      regression net for adopting games)

## Phase 3 — Pilot: asteroids-plus

- [ ] Runtime seeded RNG for the whole run (synergy: this is also the daily-seeded-runs
      prerequisite from the roguelike knobs)
- [ ] Route all gameplay input through `gamekit.replay.input()`; adopt record/playback UI
- [ ] Suite: recorded-run determinism assert; eyeball pass ×3 viewports; changelog entry

## Phase 4 — Join A + B

- [ ] "🎬 Render as clip" on a stored replay: re-simulate through playback + capture pipe
      (offline, can run faster-than-realtime where the recorder allows)
- [ ] Share-row integration (clip beside the score card)

## Phase 5 — Roll-out

- [ ] Fold the replay contract into the `komyo-new-game` skill (templates + contract checklist)
- [ ] Per-game retrofit checklist for the remaining live games (seeded RNG + input routing each);
      prioritize by shareability (aim-trainer, snake, flappy, …) — game-by-game, no deadline
