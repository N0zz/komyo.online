# komyo Parental Lock Plan

> **Status (2026-07-21): BUILT — awaiting the final eyeball pass before ship.** All Phase-1 boxes
> below are implemented and every suite is green. Recovery pivoted mid-build from a documented
> console command to the **daily support code** (decision recorded below). Rode along: the Settings
> modal height-discipline rework (the dialog is now the bound, .about scrolls inside — the old
> 90–96vh caps could exceed the UA dialog frame cap and bleed in landscape). The 📖 word-check gate
> and external-link gating are saved LATER phases (deliberately not in the first ship).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parents can hand their phone/laptop to a kid without the kid spending trophies, wiping
data, or turning the lock off. Kit-owned end to end (the shop, reset and export flows are already
kit/catalogue code) — zero per-game changes.

**Decisions (from the discussion):**

- **Deterrent, not security.** Client-side only; anyone with devtools clears it. The threat model
  is a child, and that's enough. Said plainly in the help text.
- **PIN stored HARD-HASHED, never plaintext/djb2** — people reuse PINs (phone unlock, bank card),
  so the stored value must not disclose it: `gamekit_lock = {v:1, salt, hash, iter}`, hash =
  **PBKDF2-SHA-256(pin, salt, ~100k iter)** via `crypto.subtle` (built-in, https + localhost OK;
  headless → guarded fallback so tests run). Honest limit: 4 digits = 10k combos, so offline brute
  force is only slowed (minutes), never stopped — the hash's real job is that a *glance* at
  devtools reveals nothing. Setup UI still nudges: "pick a fresh PIN, not your phone/bank one".
- **Recovery = the daily support code, zero-knowledge (pivoted from console-only):** the
  "Forgot PIN?" panel accepts an 8-digit code derived from the UTC date
  (`gamekit.lock.supportCode()`); a match removes the lock without revealing the PIN. Support
  reads it to the parent on request (kept in the Discord INTERNAL staff channel — never posted
  publicly, kids read the public server) and generates it on demand via the console snippet or
  `node scripts/support-code.mjs` — the code self-rotates at UTC midnight, so there is nothing to
  store, post daily, or update. Yesterday's UTC code is also accepted (midnight edge). Wrong codes
  burn the same 5-try cooldown pool as wrong PINs. Chosen over console-command help (non-technical
  parents can't drive a console; mobile browsers have none) and over `?unlock=` links (a link
  opens Safari on iOS, which CANNOT reach a home-screen install's separate storage container —
  in-app code entry works in every context). Derivable from the public repo by design — a kid who
  reverse-engineers today's code earned it. `localStorage.removeItem('gamekit_lock')` remains the
  unadvertised technical backstop.
- **The PIN IS the lock (button model):** Settings shows "Set PIN" when off → "Change PIN" +
  "Turn off" when on ("Turn off" stays visible but disabled/grayed when off, so the row never
  reflows). Turning off (PIN-gated) deletes the lock entirely; re-enabling means choosing a fresh
  PIN. There is no separate enable/disable state to reason about.
- **Wrong-try cooldown in the UI** (what actually stops the kid): 5 wrong tries → 30 s lockout,
  persisted in the blob (`fails`, `until`) so a reload doesn't reset it.
- **`gamekit_lock` is EXCLUDED from Export** and stripped on Import — the PIN must not travel in
  shared backup files, and importing someone's save must not overwrite your lock.
- **Guard points (v1):** ① spending trophies (shop BUY — panel + the menu-grid cosmetic buy path),
  ② "↺ Reset game data", ③ Export/Import modal, ④ removing/changing the lock itself.
  One kit wrapper: `gamekit.lock.require(cb)` → cb immediately when no lock; else PIN modal.
- **Separate from 🐣 Easy picks** (difficulty ≠ protection); Easy picks may *suggest* the lock,
  never force it.

---

## Phase 1 — PIN lock (NOW)

- [x] `gamekit.lock` API in game-kit.js: `enabled()`, `setup(pin)`, `verify(pin)`, `clear()`,
      `require(cb)`; PBKDF2 via `crypto.subtle` with a guarded headless fallback; cooldown state
- [x] Kit PIN-pad modal: 4 dots, numpad + backspace, wrong-try shake, cooldown countdown,
      "Forgot PIN?" expander + the deterrent-not-security note
- [x] Support-code recovery: `supportCode()`/`verifySupport()` + the modal's 8-digit support mode
      + `scripts/support-code.mjs` (see the recovery decision above)
- [x] Guard ①: shopPanel `doBuy` + the `gamekit.menu` grid `buy(id)` cosmetic path
- [x] Guard ②: the ☰ "↺ Reset game data" confirm (kit) — PIN before the hold-confirm
- [x] Guard ③: catalogue Export/Import modal open; exclude `gamekit_lock` from the export blob,
      strip it from imported blobs (this device's lock survives an import); "Reset all data" is
      PIN-gated too and KEEPs the lock
- [x] Guard ④ + Settings UI (catalogue ⚙️): "🔒 Parental lock" row — Set PIN (enter twice) /
      Change PIN / Turn off (PIN-gated, disabled when off)
- [x] i18n: all `lock.*` keys in ALL 7 locales (coverage test enforces parity)
- [x] Tests (`test.mjs` game-kit section): setup/verify/clear round-trip, require() gating,
      cooldown after 5 fails, support-code determinism + today/yesterday acceptance
- [x] Changelog entry
- [x] Eyeball pass ×3 viewports (desktop / portrait / landscape) — incl. the reworked Settings
      height ladder in landscape — then commit + push (SHIPPED 2026-07-21, `93170ad`)

## Phase 2 — Later (saved ideas, not scheduled)

- [ ] **📖 Word-check gate** (the Disney+ kids-profile pattern): random digits spelled out as
      localized words, typed on the same numpad — a *reading test*, no secret, no storage, no
      recovery problem. Blocks pre-readers only (~≤6), so it under-protects komyo's 6–10 lane on
      its own → ship as a second lock-strength choice in Settings (PIN stays default/recommended).
      Shares the modal + all guard plumbing; localized number words = 10 keys ×7.
- [ ] **External-link gating while locked** (Buy Me a Coffee, Discord, socials, newsletter) — the
      full "hand the phone over" story behind the footer's kid-safe claim
- [ ] Easy-picks cross-suggestion ("handing the device to a kid? you can also lock spending")
