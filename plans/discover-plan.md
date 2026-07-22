# komyo Discover Plan — "What's new" + "For you" rails

> **Status (2026-07-21): BUILT (v2, split rails) — awaiting the localhost eyeball before ship.**
> v1 (a single ✨ Discover rail) shipped earlier the same day (`15dbb9d`) and was immediately
> superseded by this split after discussion. This file is the decision log for the whole feature.

**Goal:** push-style discovery on the home page — surface games the player hasn't tried yet,
without them having to search or gamble on 🎲 Random. Born from the "3 web-design psychology
principles" review (chunking / don't make people hunt) + the "Random gives no choice" gap.

## The contract (both rails)

- **Untried-only.** "Tried" = any `gamekit_pb` entry (a finished run) OR a Recently-played slot
  (launched via Play) OR favorited. So the rails never overlap Favorites, Recent, or each other —
  the ONLY duplication is with **All games**, which stays the complete canonical index (removing
  rail games from All would break "I can find every game in All").
- Each rail renders only when non-empty; both vanish once everything's been tried. A rail is a
  one-row `recent-wrap` carousel (same component as Recently played) with `discover-wrap` +
  `discover-new-wrap` / `discover-you-wrap` marker classes; capped at **8** tiles.
- Section order: Favorites → Recently played → **What's new** → **For you** → All games → Coming soon.
- Collapsible like every section (keys `discover-new` / `discover-you` in `arcade_collapsed`).
- **🐣 Easy picks** lifts KIDS games to the front of both rails (the rails front the site for new
  players — consistency with the easy-picks promise).

## "What's new" (`cat.discoverNew` — ✨ What's new)

- Untried games whose `added` OR `updated` (games.js) is within **30 days**, freshest first.
- Why 30 and not the badge's 7: at our release pace a 7-day rail would sit empty most weeks;
  30 days ≈ 2–4 games. The NEW/UPDATED badges still mark the ≤7-day ones inside the rail.

## "For you" (`cat.discoverForYou` — 💡 For you)

- Every other untried game, scored by **genre affinity + POPULAR nudge**, ties rotated daily:
  - *Affinity:* the player's lifetime plays per tag (from `gamekit_pb` × games.js tags), and a
    game scores `3 × (its tags' share of those plays)`. 100% local — nothing leaves the device.
    New users (no history) → 0 → falls back to POPULAR + rotation.
  - *POPULAR* (`badges:["pick"]`) adds +2. (NEW/UPDATED weights became moot here — fresh games
    live in the other rail.)
  - *Daily tie rotation:* hash of `(utcDayNumber, slug)` — deterministic, same for everyone,
    keeps the rail from looking frozen; no `Math.random` (suites stay seedable).

## Decisions (from the discussion, 2026-07-21)

- **No "played ≥3 games" gate.** v1 gated the rail until 3 finished runs; rejected — Discover
  shows for brand-new users too (before any history it's effectively "popular/new first").
- **Recently played keeps recording on LAUNCH** (Play pressed), not on run end — that's the
  design; Discover's "tried" definition includes those launches.
- **Badge weights, v1 (single rail):** NEW 4 > UPDATED 3 > POPULAR 2 — chosen so UPDATED+POPULAR
  (5) outranks plain NEW (4). Superseded for "For you" by the split (only POPULAR remains there)
  but kept here as the precedent for any future badge-weighted ordering.
- **Two rails over one** (user call, same day): long-time users should see fresh arrivals AND
  personal picks as separate shelves. (My earlier "revisit at ~40 games" stance — overruled.)
- **Labels:** "What's new" / "For you" (user-fixed wording).
- **Netflix-ification is opt-out per player:** every section head is click-to-fold, persisted
  per-device (`arcade_collapsed`) — players who dislike shelf sprawl fold what they don't want.

## Later / if ever

- **🎲 Tinder-style deck** — parked. If it ever lands, it spawns from the **Random button**
  (tap → card: Play / Next / ✕, same untried pool), NOT a new header button (chrome budget) and
  NOT a menu item (discovery must be push). Condition: the rails prove players engage with
  untried-game browsing; keep a "just play it" fast path so Random stays one-tap.
- Affinity could weight recency of plays (recent sessions say more than lifetime totals) — only
  if the simple version feels off in practice.

## Steps

- [x] v1: single ✨ Discover rail + i18n (7 locales) + changelog e70 + tests (`15dbb9d`)
- [x] v1.1: drop the ≥3 gate; Easy-picks KIDS lift; genre affinity + daily rotation; 4/3/2 weights
- [x] v2: split into What's new (≤30 d, freshest first) + For you (affinity); i18n keys swapped
      (`cat.discover` → `cat.discoverNew`/`cat.discoverForYou`), changelog e71 + 7 translations
- [x] suites green (`node test.mjs`)
- [ ] localhost eyeball — desktop / portrait / landscape (the two rails, folding, Easy-picks on)
- [ ] ship: commit + push (batch), verify Discord changelog post
