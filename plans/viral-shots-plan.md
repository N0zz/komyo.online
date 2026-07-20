# Viral shots — many cheap tickets, not one flagship

*Decided 2026-07-12. Replaces the roadmap's "one original-mechanic, shareable game" slot (which came
from the 2026-07-02 full-repo review, `~/komyo-review-2026-07.md` §5 — the
`komyo-market-expansion-discussion` memory it cited was never written; this plan is now the record).*

## Why

The review's research verdict stands: **no documented case (2020–2026) of a small independent
catalogue building an audience through breadth** — every traction story is one original game + one
channel event (Wordle's emoji grid, 2048 on HN, Slither via streamers, Infinite Craft). neal.fun is
the model that fits komyo: **hits acquire, the catalogue retains.**

But hits are lottery tickets — nobody designed Wordle to be viral, 2048 was a weekend clone-of-a-clone.
So the strategy is NOT "design the viral game and push it"; it's **maximize cheap shots on goal**,
across more than one channel. (User decision 2026-07-12: Pump Stop / Blink are not the vehicle —
custom themes narrow the audience; the winner is generic/abstract theme + a weirdly addicting mechanic.)

## What the actual hits share (selection criteria for a shot)

- **Graspable in ~5 seconds, zero teaching cost** — you already knew how to play Wordle.
- **A comparable, spoiler-free result you can paste as TEXT/emoji** (the Wordle grid, "I got 2048",
  a daily result) — image score cards are weaker: they need a click to view and can't go in a group chat
  as a one-liner.
- **One-more-try pull, or once-a-day scarcity** — the daily format also syncs everyone's
  conversation ("did you get today's?").
- **Generic/abstract theme** — mechanics travel, themes narrow.

## The three lanes (all run in parallel, none blocks the build queue)

### 1. Weird-mechanic POC lane

Batches of tiny 1–2 h mechanic prototypes on a separate branch — mechanic only, no kit shell, no
polish. The cost per lottery ticket is the POC, not a finished game. **Kill criterion: did the user
replay it unprompted.** Kill most; only the sticky ones get promoted through the full dev gate
(design+mock → POC → MVP → iterations) and the kit plumbing.

- [ ] Brainstorm the first POC batch (5–10 one-line mechanic ideas; generic themes, weird loops)
- [ ] Build the batch as bare prototypes on a `poc/` branch
- [ ] Playtest → kill/keep verdicts recorded here
- [ ] Promote survivors into the games queue (full skill pipeline)
- [ ] Repeat in slow batches (a POC batch every few weeks alongside queue builds)

### 2. Reworks of live games as extra tickets

A notable new mode/variant on a live game is a cheap shot (Suika = "merge, but fruit"; the
Wordle-like wave = "Wordle, but X"). Each notable rework also re-fires the existing channel for
free: UPDATED badge + changelog entry + Discord post.

- [ ] When picking work, treat "weird new mode for a live game" as equal-priority with new remakes
- [ ] Candidate list (grow it): daily-seeded runs (roguelite knob already in the design knobs),
      inverted/constraint modes (one-life, mirrored, timed-zen), score-attack variants of the kids games

### 3. "komyo daily" share artifact — the cheapest ticket (from the review's §7)

The daily challenge **already exists** (one hashed game+goal, same for everyone, via `challengePick`)
— no new seeded runs needed. The only missing piece is the **spoiler-free emoji/text share artifact**
(the Wordle-grid lesson): make the existing daily part of the shareable loop without building anything new.

**Streaks are OFF the table — predatory.** No login / day-count streak mechanic (the Duolingo pattern
that punishes a missed day). Retention comes from good games + the daily ritual, not loss-aversion.

- [ ] Design the emoji/text result grid for the existing daily (score band / result — NOT a streak)
- [ ] Design the text share artifact (paste-safe, legible with no URL, link appended)
- [ ] Front-and-center placement on the catalogue (not buried in the drawer)
- [ ] Build + ship + measure via GA4 share/UTM events

## Not doing

- No single "flagship" bet, no big-budget original before POC evidence.
- No blocking the trivial-remake queue on any of this — remakes keep the search channel growing.
- No portal listings decision here (separate roadmap item).
