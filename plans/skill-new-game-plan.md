# komyo "Create a game" Skill — Implementation Plan

> **Status (2026-07-11): SHIPPED 2026-07-04** — the `komyo-new-game` skill is live at
> `.claude/skills/komyo-new-game/`, `t()`-native, battle-tested (Forcefield, Frog Bonk, Sudoku), and has
> since gained the visual-quality bar + responsive + reactive-music references. Boxes below back-ticked
> in a hygiene pass; the skill itself (not this plan) is the living source of truth now.

> **For agentic workers:** REQUIRED SUB-SKILL: use `skill-creator` for the draft → test → review → iterate loop, and `superpowers:executing-plans` / `superpowers:subagent-driven-development` for task tracking. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A repo-local Claude skill that turns a *game concept* (how it plays / looks / feels) into an on-framework komyo game — the skill handles ALL framework plumbing (menus, loop, layout, storage, best-store, audio, challenges, cosmetics, pause, PWA, share, registration, tests) via bundled references + templates, so the human only supplies the idea and playtests.

**Architecture:** Progressive-disclosure skill (`SKILL.md` + `references/` + `assets/` templates + `scripts/`). SKILL.md drives a staged process (intake → design → POC → MVP → iterate → wire → register → verify) that mirrors the repo's dev-process gate; each stage pulls in only the reference it needs. The skill generates a game by copying the canonical templates (derived from `games/breakout/`) and filling the game-specific parts, then editing the shared registration files. Correctness is enforced by a **contract checklist** (the silent-failure rules) + the existing test suites as the regression net.

**Tech Stack:** Markdown skill files, JS templates (vanilla ES5-style, matching the repo — no build/deps), the repo's `test-harness.mjs` + `node test.mjs` as the acceptance gate, `scripts/gen-icon.mjs` for icons, skill-creator's eval harness for iteration.

## Global Constraints

- **Skill location:** repo-local `~/arcade/.claude/skills/komyo-new-game/` (versioned with the framework it references; sidesteps the global "don't read `~/.claude`" rule). Add `.claude/` handling to `.gitignore` review — the skill SHOULD be committed (it's part of the project), so ensure it is NOT ignored.
- **Skill name:** `komyo-new-game` — no `synerise-` prefix (that convention is for the user's devops/work skills, not this personal project).
- **The skill emits English-inline strings for now** (current repo convention), written so they're trivially keyable later — see "Coordination with the i18n plan" below.
- **The skill must not weaken the repo's hard contracts.** Every generated game satisfies the CLAUDE.md contracts (enumerated in the Contract Checklist task). The generated `test.mjs` + `node test.mjs` are the proof.
- **References mirror live code, not this plan.** Author `references/` by reading the *current* `game-kit.js` / `games/breakout/` etc. at build time — the framework surveys are the blueprint, but code is the source of truth (references drift is the top maintenance risk; see Self-Review).
- **No new deps.** `gen-icon.mjs` is macOS + Chrome + `sips` only; the skill calls it and degrades gracefully (manual-icon note) if unavailable.
- **The staged process is the point — not one-shotting.** The skill never claims a game is "done" from the concept alone; it ends at a playable, tests-green MVP + an explicit playtest/iterate handoff.

---

## Coordination with the i18n plan (`plans/i18n-plan.md`)

**These two plans overlap on per-game strings and must stay consistent. Whichever ships FIRST, the SECOND must be updated to match — this is a hard cross-dependency, not a nicety.**

- **If i18n ships FIRST** (before this skill is built): drop the "English-inline" decision here. The templates, `references/registration.md`, and the Contract Checklist must instead have the skill:
  - emit `KIT.t('game.<slug>.*', {params})` keyed strings (never raw literals);
  - include `i18n.js` in the template `<head>` (after `cosmetics.js`) **and** the `sw.js` SHELL;
  - have `scripts/scaffold.mjs` append the new game's `en` keys to `i18n.js` and stub/MT the `pl/es/pt/fr` sections;
  - add an `i18n coverage` check to the generated `test.mjs`.
  Update this plan's Phase 0 + Tasks 3/4/5 accordingly before executing them.

- **If this skill ships FIRST** (before i18n): it generates English-inline games per the current decision. Then, when i18n is implemented, `plans/i18n-plan.md` **Phase 5 (per-game extraction) must include every skill-generated game**, and its **Task 26 must additionally update THIS skill** (templates + a new `references/i18n.md` + the Contract Checklist) to emit keyed strings going forward. Any games generated in the gap are keyed manually during i18n Phase 5.

- **Regardless of order:** the loser-of-the-race plan owns a task to reconcile. `references/i18n.md` exists in this skill from day one as a stub documenting the future switch, so the intent is discoverable even before i18n lands.

---

## File Structure

```
~/arcade/.claude/skills/komyo-new-game/
├── SKILL.md                    (<500 lines: frontmatter + the staged process + contract checklist + reference pointers)
├── references/
│   ├── gamekit-api.md          (the gamekit API map — signatures, mandatory/optional, gotchas; has a ToC)
│   ├── game-anatomy.md         (index.html skeleton, section-by-section, with trimmed real snippets)
│   ├── testing.md              (test.mjs anatomy + harness API + runLayoutSuite + the __test/layout contract)
│   ├── registration.md         (games.js / challenges.js / cosmetics.js / sw.js / manifest / icons / sitemap / llms / changelog — exact shapes + the ordered checklist)
│   ├── audio.md                (SND.define voice recipes + the music theme keys; the "never reuse kit stingers" rule)
│   ├── genres.md               (thin: points to ../../../game-design-knobs.md + a genre→mechanic starter map)
│   └── i18n.md                 (STUB: how the skill will emit t() once i18n ships; see coordination section)
├── assets/
│   ├── index.html.tmpl         (canonical game skeleton with {{PLACEHOLDER}} slots)
│   ├── test.mjs.tmpl
│   ├── sw.js.tmpl
│   └── manifest.json.tmpl
└── scripts/
    └── scaffold.mjs            (stamp games/<slug>/ from templates + inject registration stubs)
└── evals/
    └── evals.json              (skill-creator test prompts + assertions)
```

Existing repo files the skill *uses* (not created here): `scripts/gen-icon.mjs`, `game-design-knobs.md`, `test-harness.mjs`, `games/breakout/*` (the reference).

---

## Phase 0 — Decisions locked (reference, no task)

1. Location: `~/arcade/.claude/skills/komyo-new-game/` (repo-local, committed).
2. Name: `komyo-new-game`.
3. Auto-registration: the skill **edits the shared files itself** (games.js, challenges.js, cosmetics.js, sitemap.xml, llms.txt, changelog.js) — that's the core value.
4. Scope: full staged process, ending green tests + a local-preview handoff; stops at a playable MVP + iterate loop (not "done").
5. Strings: English-inline now, keyable later (see i18n coordination).
6. Evals: objective (boots, suites green, contracts satisfied) via skill-creator.

---

## Phase 1 — Scaffold the skill + author the references

### Task 1: Create the skill directory + empty skeleton

**Files:** Create `~/arcade/.claude/skills/komyo-new-game/SKILL.md` (frontmatter only for now), the empty `references/`, `assets/`, `scripts/`, `evals/` dirs.

- [x] **Step 1:** Confirm `.claude/` is not gitignored in `~/arcade` (`grep claude .gitignore`); if it is, note it for the user (do not edit ignore rules unilaterally — global rule forbids editing claude config files, but `.gitignore` is fine to flag).
- [x] **Step 2:** Create `SKILL.md` with draft frontmatter (name + a deliberately "pushy" description — triggering is the #1 failure mode for skills):

```yaml
---
name: komyo-new-game
description: >-
  Create a new browser game for the komyo arcade (~/arcade) from a game concept.
  Use this WHENEVER the user wants to add, build, prototype, or design a new komyo
  game — even if they only describe how it plays, looks, or feels and don't mention
  "skill", "framework", or files. Handles all gamekit plumbing (menus, loop, layout,
  storage, audio, challenges, cosmetics, PWA, share, catalogue registration, tests)
  so the user only supplies the idea. Triggers on "add a game", "let's build a
  <genre> game", "new komyo game", "prototype a game where…", or any komyo game pitch.
---
```

- [x] **Step 3:** Commit `feat(skill): scaffold komyo-new-game skill skeleton`.

### Task 2: Author `references/gamekit-api.md`

**Files:** Create `references/gamekit-api.md`.

- [x] **Step 1:** Read the CURRENT `game-kit.js` (do not paste from any survey — regenerate from live code). Produce the API map grouped by subsystem (nav/chrome, menu, loop, layout, canvas, sound, music, best-store, challenges, cosmetics, share/cards, pwa/updates, misc), each entry: signature, one-line purpose, mandatory/optional, gotchas. Start with a table-of-contents (file is >300 lines).
- [x] **Step 2:** Exhaustively document `menu.show(cfg)` (every cfg key: kind, title, score/scoreText/best/newBest/lines, groups + all styles, toggles, hint, banner, actions, onPlay/onAction/onChange/onEsc, theme, backdrop, share, record) and the returned handle — the skill leans on this the most.
- [x] **Step 3:** Commit `docs(skill): gamekit API reference`.

### Task 3: Author `references/game-anatomy.md` + `references/testing.md`

**Files:** Create both.

- [x] **Step 1:** `game-anatomy.md` — read the current `games/breakout/index.html` (+ skim `stacker`, `flappy` for variation). Document top-to-bottom: the atomic `<head>` unit (exact tag set + the shared-script order, `game-kit.js` → `challenges.js` → `cosmetics.js`), body/`.gamekit-hud` structure, the inline IIFE skeleton (aliases → SND.define → state FSM → best helpers → resize/`fitCanvas` + `layout.on` → 3 `menu.show` screens with `record:`+`share:` → update/render → input in CSS px → `nav()` → `KIT.loop` → boot → `pwa()` outside the IIFE), and the `__test` hook + `layout` getter (minimum: `state`, `score`, `layout` with `topReserve`, `start()`, `step(n)`, `menu()`). Use trimmed real snippets.
- [x] **Step 2:** `testing.md` — read `games/breakout/test.mjs` + `test-harness.mjs`. Document the harness API (`bootGame(file,opts)`, `ok/section/summary`, `runLayoutSuite(makeGame,check)`, the drive handle), the boot/state/behavior/best/cosmetics test patterns, and the layout-suite invariants (portrait/landscape/desktop sweep; `topReserve >= hudTop()`).
- [x] **Step 3:** Commit `docs(skill): game anatomy + testing references`.

### Task 4: Author `references/registration.md`, `audio.md`, `genres.md`, `i18n.md`

**Files:** Create all four.

- [x] **Step 1:** `registration.md` — read the current `games.js`, `challenges.js`, `cosmetics.js`, `games/breakout/{sw.js,manifest.json}`, `scripts/gen-icon.mjs`, `sitemap.xml`, `llms.txt`, `changelog.js`. Document each contribution's exact shape (games.js entry fields; the **mandatory `goodRun` bar**; goal entries + `daily` pool; cosmetics `add(...)` with a free default at price 0 + `sets` label + `games` meta; sw.js SHELL in lockstep; manifest; icon-gen command; sitemap/llms lines; one changelog entry per push). End with the consolidated ordered checklist ("to add a live game `<slug>`, create 6 files + edit 7") + the cross-file consistency traps (slug identity, accent agreement).
- [x] **Step 2:** `audio.md` — `SND.define({name: c => …})` voice recipes (tone/noise/voice/noiseHit/seq), the music theme keys, and the **never reuse kit stingers** rule (`levelup`/`lose`/`victory`/`newbest`/`gameover`).
- [x] **Step 3:** `genres.md` — a thin pointer to `../../../game-design-knobs.md` (do NOT duplicate it) + a short genre→core-mechanic starter map, and the repo's bias note (favor puzzle/timing/arcade-skill; avoid balance-heavy TD/roguelite-shooter — cite `komyo-avoid-balance-heavy-genres`).
- [x] **Step 4:** `i18n.md` — STUB per the coordination section: today the skill emits English-inline; document how it will switch to `KIT.t('game.<slug>.*')` + `i18n.js` head/SHELL + scaffold key-injection once `plans/i18n-plan.md` ships.
- [x] **Step 5:** Commit `docs(skill): registration, audio, genres, i18n references`.

---

## Phase 2 — Templates + scaffold script

### Task 5: Author `assets/*.tmpl`

**Files:** Create `assets/index.html.tmpl`, `test.mjs.tmpl`, `sw.js.tmpl`, `manifest.json.tmpl`.

- [x] **Step 1:** Derive each template from the CURRENT breakout files, replacing game-specifics with clearly-marked slots: `{{SLUG}}`, `{{TITLE}}`, `{{BLURB}}`, `{{ICON}}`, `{{ACCENT}}`, `{{THEME_KEY}}`, and comment-delimited regions for `<!-- MECHANIC: update/render/state -->`, `<!-- MENU: start/pause/end -->`, `<!-- __TEST hook + layout getter -->`, `<!-- SND.define -->`, `<!-- CONTROLS -->`. The template must already be contract-correct (atomic head order, `KIT.loop`, `fitCanvas` via `layout.on`, `record:` end menu, one bare `<script>` last, `pwa()` outside the IIFE, `__test` with `layout.topReserve`).
- [x] **Step 2:** `test.mjs.tmpl` — imports `../../test-harness.mjs`, `bootGame` + boot assert + a `runLayoutSuite` block + `summary()`, with slots for game-specific behavior asserts.
- [x] **Step 3:** `sw.js.tmpl` (SCOPE/VERSION/SHELL with the shared files in lockstep) + `manifest.json.tmpl`.
- [x] **Step 4:** Sanity-check: manually copy the templates into a throwaway `games/_tmpltest/`, fill minimally, run `node games/_tmpltest/test.mjs`, confirm it boots + layout suite passes, then delete it. Commit `feat(skill): game templates (contract-correct skeleton)`.

### Task 6: Author `scripts/scaffold.mjs`

**Files:** Create `scripts/scaffold.mjs`.

- [x] **Step 1:** Write a Node script `node scaffold.mjs <slug> "<title>" "<icon>" "<accent>"` that: creates `games/<slug>/`, stamps the 4 templates with the slot values, and prints the remaining manual steps (icon-gen command + the registration edits the model still makes with judgment). Keep shared-file edits (games.js/challenges.js/…) OUT of the script — they need placement judgment; the script only does the deterministic folder stamping (skill-creator's "bundle the repeated deterministic work" principle).
- [x] **Step 2:** Test the script end-to-end on a throwaway slug, run its generated `test.mjs`, delete. Commit `feat(skill): scaffold.mjs folder stamper`.

---

## Phase 3 — SKILL.md body (the process)

### Task 7: Write the SKILL.md body

**Files:** Modify `SKILL.md`.

- [x] **Step 1:** Write the staged process (keep <500 lines; push detail into the references). Sections:
  1. **Concept intake** — accept a play/look/feel description; ask 2–4 targeted questions ONLY if thin (genre, core verb, win/lose, session length, visual theme + accent, control scheme). Reference `genres.md`.
  2. **Design note** — a short concept + layout sketch before code (the dev-process gate's design step). Optionally a quick `plans/<slug>.html` mock for anything novel.
  3. **POC** — mechanic only (canvas + `update/render/input` + `KIT.loop`), no menus/registration; gut-check via local preview. If it isn't fun, STOP.
  4. **MVP** — run `scaffold.mjs`, fill the kit shell (nav/menu/best/HUD) + the `__test` hook; one real feature. Reference `game-anatomy.md`.
  5. **Iterate ×2–3** — a feature + the bugs each playthrough surfaces.
  6. **Wire features** — `goodRun` bar (mandatory), cosmetics set(s), controls, audio, share, icons via `gen-icon.mjs`, `pwa()`. Reference `registration.md` + `audio.md`.
  7. **Register** — games.js (`added:` date), sitemap.xml, llms.txt, changelog.js entry. Reference `registration.md`.
  8. **Verify + handoff** — `node test.mjs` + `node games/<slug>/test.mjs` green; serve locally; hand the user the preview URL + the "playtest & tell me what to tune" loop. Reference `testing.md`.
- [x] **Step 2:** Add the **Contract Checklist** (the silent-failure rules the skill must verify before handoff): slug is one identity (folder = games.js = `nav({slug})` = record slug = `goodRun` key = SW `SCOPE`); results via end-menu `record:` only; `isBest` before the single save; no kit-stinger reuse in `SND.define`; all drawing in CSS px after `fitCanvas`; reserve `layout.hudTop()`; `__test.step(n)` drives `update()` (never rAF), seeded RNG in asserted paths; `goodRun` bar present; atomic `<head>` order + SW SHELL lockstep; exactly one attribute-less `<script>` last; headless-safe guards.
- [x] **Step 3:** Add a **reference index** (when to read which `references/*.md`), so progressive disclosure works.
- [x] **Step 4:** Fresh-eyes review SKILL.md against the reference set; trim anything not pulling weight (skill-creator's lean-prompt principle — explain *why* each contract matters rather than piling MUSTs). Commit `feat(skill): SKILL.md staged process + contract checklist`.

---

## Phase 4 — Evaluate + iterate (skill-creator loop)

### Task 8: Write eval prompts

**Files:** Create `evals/evals.json`.

- [x] **Step 1:** 3 realistic concept prompts spanning genres the repo favors (low-tuning): e.g. a timing/reflex one-button game; a small grid/puzzle; an arcade-skill catcher. Each phrased as a real user pitch (play/look/feel, no framework jargon). Include `expected_output` descriptions.
- [x] **Step 2:** Commit `test(skill): eval prompts`.

### Task 9: Run with-skill vs baseline, review, iterate

**Files:** `komyo-new-game-workspace/iteration-1/…` (skill-creator layout), skill fixes.

- [x] **Step 1:** Per eval, spawn two subagents in the same turn — one WITH the skill, one baseline (no skill) — each producing a game folder + registration edits in an isolated copy/worktree (use `isolation: 'worktree'` so parallel games don't collide). Save outputs per skill-creator's workspace layout.
- [x] **Step 2:** While runs go, draft objective assertions and put them in `eval_metadata.json`: (a) `games/<slug>/index.html` exists + boots (`bootErr===null`); (b) `node games/<slug>/test.mjs` passes incl. the layout suite; (c) `node test.mjs` still green (registration didn't break the catalogue); (d) slug identical across folder/games.js/sw.js SCOPE/challenges goodRun; (e) end menu has a `record:` block, no direct `recordResult`; (f) a `goodRun` bar was added; (g) exactly one attribute-less `<script>`; (h) `__test.layout` exposes `topReserve`.
- [x] **Step 3:** Grade (script the checkable assertions), aggregate the benchmark, launch the eval viewer for the user, read feedback.
- [x] **Step 4:** Improve the skill from feedback (generalize, don't overfit; move any repeated subagent work into `scripts/` or a reference). Re-run into `iteration-2/`. Repeat until the user's happy / feedback is empty. Commit each iteration `iter(skill): <what changed>`.

### Task 10: Optimize the description for triggering

- [x] **Step 1:** Generate ~20 trigger eval queries (should-trigger komyo game pitches vs tricky near-misses — e.g. "fix a bug in snake" should NOT trigger; "make me a game where you dodge falling stuff" SHOULD). Review with the user.
- [x] **Step 2:** Run skill-creator's `run_loop.py` with the session model id; apply `best_description` to the frontmatter. Commit `perf(skill): optimize trigger description`.

---

## Phase 5 — Docs, coordination, ship

### Task 11: Wire docs + the i18n cross-reference

**Files:** Modify `CLAUDE.md` (repo), `ROADMAP.md`, `plans/i18n-plan.md` (reciprocal link).

- [x] **Step 1:** `CLAUDE.md` — under "Adding / changing a game", note the `komyo-new-game` skill as the front door + that it enforces the contracts; keep the manual steps as the fallback/reference.
- [x] **Step 2:** `ROADMAP.md` — mark item #3 ("Create a game" skill) built.
- [x] **Step 3:** Confirm `plans/i18n-plan.md` links back to this plan (its coordination section) and that this plan's coordination section is accurate. Whichever plan is executed second inherits the reconcile task described in both coordination sections.
- [x] **Step 4:** Batch-commit + push per the repo's GH-Pages push rule. `docs(skill): CLAUDE.md + roadmap + i18n cross-reference`.

---

## Self-Review notes (risks to watch)

- **Reference drift is the #1 risk.** `references/*.md` and `assets/*.tmpl` are snapshots of live code; a kit refactor silently staleness them. Mitigation: the templates are exercised by real `node test.mjs` runs (a broken template fails loudly), and Task 2/3/4 explicitly regenerate from live code. Consider a lightweight CI check later that greps the template's kit calls against `game-kit.js`.
- **Scope creep in SKILL.md.** If it grows past ~500 lines, push more into references and keep SKILL.md as the process spine.
- **The skill can't guarantee *fun*.** It guarantees on-framework + tests-green; tuning/feel is the human playtest loop (stages 3/5/8). Don't let evals imply "fun" is auto-verified — they check structure, not enjoyment.
- **i18n order dependency** — see the coordination section; the second-shipped plan MUST run its reconcile task or generated games silently miss translations / the skill emits stale string patterns.
- **gen-icon.mjs environment** — macOS + Chrome + `sips`; degrade gracefully off-Mac.
